// Everything drawn on top of the tiles each frame, in screen space (CSS pixels): footsteps,
// fog, life (waves, leaves, smoke, travellers, birds), names, explorer, compass, scale, and the
// atlas overview. Ported from the proto's dessiner()/animer()/apercuGeneral().
import { hash2 } from '../world/noise';
import { TILE, altitude } from '../world/terrain';
import { settlement, knownSettlement } from '../world/settlements';
import { roadsAround, pointOnRoad } from '../world/roads';
import { landmark } from '../world/landmarks';
import { wondersNear } from '../world/wonders';
import { monumentsNear } from '../world/monuments';
import { inLake, lakesNear, riversNear } from '../world/rivers';
import { animalsOf, herdsNear, lifeOf, presence, type Animal, type Look } from '../world/fauna';
import { CONTACT, speciesById } from '../game/combat';
import { FISH_SECONDS, HARVEST_SECONDS, has, weaponOf } from '../game/craft';
import { drawAnimal, drawSkeleton } from './animals';
import { DPR } from '../ui/screen';
import { isGL } from './glPainter';
import { worldTime } from '../world/weather';
import { SEA_CELL, seaLabel } from '../world/names';
import { CELL, LEAGUE, START_ZOOM, isSeen, routeAhead } from '../game/travel';
import { CIRCUMFERENCE, nearestCopy, wrapIndex } from '../world/planet';

/** Fog cells around the planet. */
const CELLS_AROUND = CIRCUMFERENCE / CELL;
import type { GameState } from '../game/state';
import { t, tn } from '../i18n';
import type { TileArt } from './tiles';
import { cityRadius } from './towns';
import { WeatherLayer } from './weather';
import { sky } from '../world/weather';
import { LANDMARK_ART, MONUMENT_ART, WONDER_ART, landmarkImage, monumentImage, wonderImage } from './wonderArt';
import { INK, PAPER } from './palette';

/** Durations of the fight's animations, ms: the explorer's swing, the animal's lunge, a flinch. */
const STRIKE_MS = 380, LUNGE_MS = 420, HURT_MS = 220;
/** The cast of a fishing line: rod back, whipped forward, the float flying out to the water. */
const CAST_MS = 1300;
/** The colour of a steel blade. */
const STEEL = 'rgb(188,194,200)';

type Attack = 'bite' | 'swipe' | 'ram' | 'kick';

/** What the explorer holds and does, for the drawing. */
interface Gear {
  weapon: 'poings' | 'baton' | 'lance' | 'coutelas' | 'sabre';
  /** work in hand: its kind, what is gathered, where on screen (the float), how far along (0..1) */
  work: { kind: 'harvest' | 'fish'; res: string | null; at: [number, number]; done: number } | null;
}

/**
 * An animal's blow at progress p in [0, 1) (p < 0: no blow): how far it moves at the explorer
 * (dx, screen pixels at zoom 1), how it tilts (turn, radians, positive = head down towards the
 * explorer) and whether it has turned its back (a kick).
 *  - bite: a quick low dart, the head dipping, jaws first;
 *  - swipe: it rears up on its hind legs and comes down with a paw (bears);
 *  - ram: it draws back, then charges head down (boar, rhino, bison...);
 *  - kick: it turns its back and lashes out, rump up (giraffe, moose, ostrich).
 */
function attackMotion(kind: Attack, p: number): { dx: number; turn: number; away: boolean } {
  if (p < 0) return { dx: 0, turn: 0, away: false };
  const bell = Math.sin(Math.PI * p);
  switch (kind) {
    case 'swipe': { const up = Math.sin(Math.PI * Math.min(1, p / 0.7)); return { dx: 3 * bell + (p > 0.5 ? 4 * bell : 0), turn: -0.55 * up, away: false }; }
    case 'ram': {
      if (p < 0.35) { const b = p / 0.35; return { dx: -6 * Math.sin(b * Math.PI / 2), turn: 0.05 * b, away: false }; }
      const u = (p - 0.35) / 0.65, thrust = Math.sin(Math.PI * Math.min(1, u * 1.6)) ;
      return { dx: -6 * (1 - Math.min(1, u * 3)) + 15 * thrust, turn: 0.16 * thrust, away: false };
    }
    case 'kick': { const away = p > 0.08 && p < 0.92; return { dx: 4 * bell, turn: away ? -0.3 * Math.sin(Math.PI * (p - 0.08) / 0.84) : 0, away }; }
    default: return { dx: 11 * bell, turn: 0.14 * bell, away: false };
  }
}

/** Below this zoom the map turns into the atlas overview. */
export const Z_ATLAS = 0.3;

export interface View {
  /** camera centre, world units */
  x: number;
  y: number;
  zoom: number;
  /** viewport, CSS pixels */
  W: number;
  H: number;
  /** height of the header over the top of the map, CSS pixels: nothing is drawn under it */
  top?: number;
}

interface Leaf { x: number; y: number; life: number; ph: number; r: number }

export class Overlay {
  private readonly fog = document.createElement('canvas');
  private readonly fg = this.fog.getContext('2d')!;
  private leaves: Leaf[] = [];
  /** when each fog cell was first drawn as seen (ms), for its fade-in */
  private readonly seenAt = new Map<string, number>();
  private readonly stamp = document.createElement('canvas');
  /** the way to a tapped spot, waiting for the player to confirm the walk */
  plan: [number, number][] | null = null;
  /** the sky over the map */
  readonly weather = new WeatherLayer();
  /** fish leaping out of the water: where, when it started, which way */
  private fish: { x: number; y: number; t0: number; dir: number; size: number }[] = [];
  /** fish caught, to leap out of the water at the end of the line */
  private caught: [number, number][] = [];

  /** When the last line was cast (performance time, ms). */
  private castAt = -1e9;

  /** The explorer casts the line: the cast is played (see the explorer's drawing). */
  cast(): void { this.castAt = performance.now(); }

  /** A float, red above and white below, at (x, y) in the explorer's drawing units. */
  private float_(x: number, y: number): void {
    const { ctx } = this;
    ctx.fillStyle = 'rgb(176,48,36)'; ctx.beginPath(); ctx.arc(x, y - 0.6, 1.1, Math.PI, 0); ctx.fill();
    ctx.fillStyle = 'rgb(240,236,226)'; ctx.beginPath(); ctx.arc(x, y - 0.6, 1.1, 0, Math.PI); ctx.fill();
  }

  /** A fish caught at (x, y): it leaps out of the water there. */
  catchFish(x: number, y: number): void { this.caught.push([x, y]); }
  private fishTimer = 0;
  /** the current flight of birds and the world point it crosses */
  private flightId = -1;
  private flightAt: [number, number] = [0, 0];
  /** the explorer faces the way they last walked: 1 = east, -1 = west */
  private facing = 1;
  private leafTimer = 0;
  /** altitude of each seen fog cell, for the atlas */
  private readonly atlasCache = new Map<string, number>();

  constructor(private readonly ctx: CanvasRenderingContext2D) {
    // on the GPU, the fog canvas is a texture uploaded again each frame (it is small)
    if (isGL(ctx)) ctx.markDynamic(this.fog);
  }

  resize(W: number, H: number): void {
    this.fog.width = Math.ceil(W / 4);
    this.fog.height = Math.ceil(H / 4);
  }

  draw(s: GameState, v: View, tiles: TileArt[], walking: boolean, now: number, dt: number): void {
    const { ctx } = this;
    const screen = (x: number, y: number): [number, number] => [v.W / 2 + (x - v.x) * v.zoom, v.H / 2 + (y - v.y) * v.zoom];
    const world = (sx: number, sy: number): [number, number] => [v.x + (sx - v.W / 2) / v.zoom, v.y + (sy - v.H / 2) / v.zoom];
    ctx.clearRect(0, 0, v.W, v.H);
    const [ax, ay] = world(0, 0), [bx, by] = world(v.W, v.H);
    if (v.zoom < Z_ATLAS) { this.atlas(s, v, screen, ax, ay, bx, by); return; }

    // No trail of past steps on the map (asked by Adrien): only the way ahead, drawn below.
    const [ex, ey] = screen(s.x, s.y);

    // Illustrations of wonders and strange places, at full resolution, back to front; the fog
    // comes over them.
    const pictures: { x: number; y: number; img: HTMLImageElement; width: number; ground: number }[] = [];
    for (const m of monumentsNear(ax, ay, bx, by, 90)) {
      const img = monumentImage(m.kind);
      if (img) pictures.push({ x: m.x, y: m.y, img, ...MONUMENT_ART[m.kind] });
    }
    for (const w of wondersNear(ax, ay, bx, by, 120)) {
      const img = wonderImage(w.kind);
      if (img) pictures.push({ x: w.x, y: w.y, img, ...WONDER_ART[w.kind] });
    }
    for (let tj = Math.floor(ay / TILE) - 1; tj <= Math.floor(by / TILE) + 1; tj++) for (let ti = Math.floor(ax / TILE) - 1; ti <= Math.floor(bx / TILE) + 1; ti++) {
      const L = landmark(ti, tj), img = L && landmarkImage(L.kind);
      const art = L && LANDMARK_ART[L.kind];
      if (L && img && art) pictures.push({ x: L.x, y: L.y, img, ...art });
    }
    pictures.sort((a, b) => a.y - b.y);
    for (const p of pictures) {
      const width = p.width * v.zoom, height = width * p.img.height / p.img.width, [x, y] = screen(p.x, p.y);
      ctx.drawImage(p.img, x - width / 2, y - height * p.ground, width, height);
    }

    this.animate(s, v, screen, world, tiles, now, dt);
    if (v.zoom >= 0.45) { this.stainsAndCarcasses(s, v, screen, now); this.animals(s, v, screen, ax, ay, bx, by, now, false); }

    // The sky: clouds, rain, snow, sand, fog, lightning, dawn, dusk and night.
    this.weather.draw(ctx, v, screen, world, now, dt, (X, Y) => isSeen(s, X, Y));

    // The fog: paper everywhere, holes punched (at quarter resolution) where the explorer has seen.
    const fg = this.fg, fog = this.fog;
    fg.globalCompositeOperation = 'source-over'; fg.clearRect(0, 0, fog.width, fog.height);
    fg.fillStyle = PAPER; fg.fillRect(0, 0, fog.width, fog.height); fg.globalCompositeOperation = 'destination-out';
    const ci0 = Math.floor(ax / CELL) - 1, ci1 = Math.ceil(bx / CELL) + 1, cj0 = Math.floor(ay / CELL) - 1, cj1 = Math.ceil(by / CELL) + 1, rr = CELL * v.zoom / 4 * 1.05;
    // newly seen cells fade in over a moment instead of popping up, so the land unveils itself
    // smoothly at the explorer's pace (cells already seen when the game opened show at once)
    if (this.seenAt.size === 0) for (const k of s.seen) this.seenAt.set(k, -1e9);
    const stamp = this.fogStamp(rr);
    for (let cj = cj0; cj <= cj1; cj++) for (let ci = ci0; ci <= ci1; ci++) {
      const key = wrapIndex(ci, CELLS_AROUND) + ',' + cj;
      if (!s.seen.has(key)) continue;
      let at = this.seenAt.get(key);
      if (at === undefined) { at = now; this.seenAt.set(key, at); }
      const a = Math.min(1, (now - at) / 900);
      const [sx, sy] = screen(ci * CELL, cj * CELL);
      fg.globalAlpha = a; fg.drawImage(stamp, sx / 4 - rr, sy / 4 - rr, rr * 2, rr * 2);
    }
    fg.globalAlpha = 1;
    // the night over everything (paper included), with the lights punched out of it
    const lights = this.weather.lights(v, screen, world, (X, Y) => isSeen(s, X, Y), [s.x, s.y], now, has(s, 'torche'));
    fg.globalCompositeOperation = 'source-over';
    this.weather.paintNight(fg, v, 4, lights);
    ctx.imageSmoothingEnabled = true; ctx.drawImage(fog, 0, 0, v.W, v.H);
    this.weather.drawLights(ctx, v, lights);
    if (v.zoom >= 0.45 && sky(v.x).darkness > 0.25) this.animals(s, v, screen, ax, ay, bx, by, now, true);
    ctx.fillStyle = 'rgba(42,36,29,.18)'; ctx.font = "italic 22px 'IM Fell English', serif"; ctx.textAlign = 'center';
    for (let k = 0; k < 3; k++) {
      const a = k * 2.1 + 0.4, X = s.x + Math.cos(a) * 560, Y = s.y + Math.sin(a) * 560;
      if (!isSeen(s, X, Y)) { const [x, y] = screen(X, Y); ctx.fillText(t('map.incognita'), x, y); }
    }

    // Names: strange places, villages, cities, seas.
    ctx.fillStyle = INK; ctx.textAlign = 'center';
    const ti0 = Math.floor(ax / TILE) - 1, ti1 = Math.floor(bx / TILE) + 1, tj0 = Math.floor(ay / TILE) - 1, tj1 = Math.floor(by / TILE) + 1;
    for (let tj = tj0; tj <= tj1; tj++) for (let ti = ti0; ti <= ti1; ti++) {
      const L = landmark(ti, tj);
      if (!L || !isSeen(s, L.x, L.y)) continue;
      const [x, y] = screen(L.x, L.y);
      if (x < -80 || x > v.W + 80 || y < -40 || y > v.H + 40) continue;
      ctx.font = (L.water ? 'italic ' : '') + Math.round(11 + v.zoom * 2) + "px 'IM Fell English" + (L.water ? '' : ' SC') + "', serif";
      this.label(t(`landmark.${L.kind}.name`, { n: L.name }), x, y + 10 + v.zoom * 12);
    }
    for (const m of monumentsNear(ax, ay, bx, by, 90)) {
      if (!isSeen(s, m.x, m.y)) continue;
      const [x, y] = screen(m.x, m.y);
      ctx.font = 'italic ' + Math.round(13 + v.zoom * 3) + "px 'IM Fell English SC', serif";
      this.label(t(`monument.${m.kind}.name`, { n: m.name }), x, y + 8 * v.zoom + 15);
    }
    for (const w of wondersNear(ax, ay, bx, by, 120)) {
      if (!isSeen(s, w.x, w.y)) continue;
      const [x, y] = screen(w.x, w.y);
      ctx.font = 'italic ' + Math.round(14 + v.zoom * 3) + "px 'IM Fell English SC', serif";
      this.label(t(`wonder.${w.kind}.name`, { n: w.name }), x, y + 10 * v.zoom + 16);
    }
    for (let tj = tj0; tj <= tj1; tj++) for (let ti = ti0; ti <= ti1; ti++) {
      const b = settlement(ti, tj);
      if (!b || !isSeen(s, b.x, b.y)) continue;
      const [x, y] = screen(b.x, b.y);
      ctx.font = b.city ? '700 ' + Math.round(13 + v.zoom * 3) + "px 'Old Standard TT', serif" : 'italic ' + Math.round(11 + v.zoom * 2) + "px 'IM Fell English', serif";
      // below the walls for a city, below the houses for a village
      this.label(b.city ? b.name.toUpperCase() : b.name, x, y + (b.city ? cityRadius(b) * 0.82 + 6 : 13) * v.zoom + (b.city ? 16 : 12));
    }
    for (let mj = Math.floor(ay / SEA_CELL) - 1; mj <= Math.floor(by / SEA_CELL) + 1; mj++) for (let mi = Math.floor(ax / SEA_CELL) - 1; mi <= Math.floor(bx / SEA_CELL) + 1; mi++) {
      const sea = seaLabel(mi, mj);
      if (altitude(sea.x, sea.y) > -0.25 || !isSeen(s, sea.x, sea.y)) continue;
      const [x, y] = screen(sea.x, sea.y);
      ctx.fillStyle = 'rgba(42,60,70,.75)'; ctx.font = 'italic ' + Math.round(16 + v.zoom * 6) + "px 'IM Fell English', serif";
      ctx.save(); ctx.translate(x, y); ctx.rotate(sea.angle);
      ctx.fillText(t(sea.key, { n: sea.name }).split('').join(String.fromCharCode(8202)), 0, 0);
      ctx.restore();
    }
    ctx.fillStyle = INK;

    // The way proposed to a tapped spot: dotted, with a little flag where it ends.
    if (this.plan) {
      const P = this.plan;
      ctx.strokeStyle = 'rgba(42,36,29,.7)'; ctx.lineWidth = 1.4; ctx.setLineDash([1, 4]); ctx.lineCap = 'round'; ctx.beginPath();
      P.forEach(([X, Y], k) => { const [x, y] = screen(X, Y); if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
      ctx.stroke(); ctx.setLineDash([]);
      const [fx, fy] = screen(...P[P.length - 1]), wave = Math.sin(now / 260) * 1.5;
      ctx.strokeStyle = INK; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx, fy - 20); ctx.stroke();
      ctx.fillStyle = 'rgb(168,52,40)';
      ctx.beginPath(); ctx.moveTo(fx, fy - 20); ctx.quadraticCurveTo(fx + 6, fy - 19 + wave, fx + 11, fy - 17 + wave); ctx.lineTo(fx, fy - 13); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.globalAlpha = 0.3; ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(fx, fy, 4, 1.4, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    }
    // Where the explorer is heading: the rest of the route, faintly, and a cross at the end.
    const ahead = routeAhead(s);
    if (ahead) {
      ctx.strokeStyle = 'rgba(42,36,29,.45)'; ctx.lineWidth = 1; ctx.setLineDash([2, 5]); ctx.beginPath();
      ahead.path.forEach(([X, Y], k) => { const [x, y] = screen(X, Y); if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
      ctx.stroke(); ctx.setLineDash([]);
      const [X, Y] = ahead.path[ahead.path.length - 1], [tx, ty] = screen(X, Y);
      ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.beginPath();
      ctx.moveTo(tx - 5, ty - 5); ctx.lineTo(tx + 5, ty + 5); ctx.moveTo(tx + 5, ty - 5); ctx.lineTo(tx - 5, ty + 5); ctx.stroke();
      if (Math.abs(ahead.dx) > 0.5) this.facing = ahead.dx > 0 ? 1 : -1;
    }
    // a fight: the animal (out of its herd now), facing the explorer, and the explorer facing it
    const f = s.fight;
    if (f) {
      const sp = speciesById(f.species)!, [fx, fy] = screen(f.x, f.y), dist = Math.hypot(s.x - f.x, s.y - f.y);
      const flees = sp.danger === 0 || (sp.danger === 1 && !f.hunt);
      const dir = (flees ? f.x - s.x : s.x - f.x) >= 0 ? 1 : -1;
      const moving = dist > CONTACT || flees, sc = 2 * v.zoom / START_ZOOM, toward = s.x >= f.x ? 1 : -1;
      // its blow, in its own manner (see `attackMotion`); and its flinch when struck
      const attack = this.attackKind = sp.attack ?? 'bite';
      const lp = (now - this.blows.foe) / LUNGE_MS, active = lp >= 0 && lp < 1, lunge = active ? Math.sin(Math.PI * lp) : 0;
      const rp = (now - this.blows.struck) / HURT_MS, recoil = rp >= 0 && rp < 1 ? Math.sin(Math.PI * rp) : 0;
      const m = attackMotion(attack, active ? lp : -1);
      const ox = (toward * m.dx - toward * recoil * 4) * v.zoom, rear = toward * m.turn;
      const facing = m.away ? -dir : dir;
      // a charge raises the dust behind it
      if (!flees && dist > CONTACT * 1.2) {
        ctx.fillStyle = 'rgba(150,130,100,.35)';
        for (let k = 1; k <= 4; k++) {
          const ph = ((now / 260 + k / 4) % 1), d = (6 + ph * 16) * v.zoom;
          ctx.globalAlpha = (1 - ph) * 0.8;
          ctx.beginPath(); ctx.arc(fx - toward * d, fy - 2 - ph * 6 * v.zoom + Math.sin(k * 3.1) * 3, (2 + ph * 4) * v.zoom, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      ctx.save(); ctx.translate(fx + ox, fy); ctx.rotate(rear);
      drawAnimal(ctx, sp.look, { x: f.x, y: f.y, dir: facing, pace: moving || lunge > 0.2 ? 1 : 0, phase: 0.3 }, 0, 0, sc, now / 1000, DPR, sky(f.x).darkness > 0.5);
      ctx.restore();
      // the staff's impact on it: a burst of ink strokes
      const ip = (now - this.blows.struck) / 260;
      if (ip >= 0 && ip < 1 && this.blows.landed) this.burst(fx + ox, fy - (sp.look.height ?? sp.look.len * 0.7) * sc * 0.6, ip, v.zoom);
      // blood spurts where a blow lands: on the animal, on the explorer
      if (this.blows.landed && ip >= 0 && this.bled.foe !== this.blows.struck) {
        this.bled.foe = this.blows.struck;
        this.spurt(f.x, f.y, (sp.look.height ?? sp.look.len * 0.7) * 2 / START_ZOOM * 0.55, f.x >= s.x ? 1 : -1, 5 + Math.min(6, Math.round(sp.look.len / 2)));
      }
      const hp0 = (now - this.blows.hurt);
      if (hp0 >= 0 && this.bled.you !== this.blows.hurt) { this.bled.you = this.blows.hurt; this.spurt(s.x, s.y, 13, s.x >= f.x ? 1 : -1, 5); }
      if (dist < CONTACT * 3) this.facing = f.x >= s.x ? 1 : -1;
      this.lifeBar(fx, fy - (sp.look.height ?? sp.look.len) * 2.2 * v.zoom / START_ZOOM - 8, f.hp / lifeOf(sp), 'foe');
    }
    // what the explorer holds and does: a weapon or bare fists, a torch at night, work in hand
    const w = s.work && s.work.left !== null && !s.journey ? s.work : null;
    if (w && Math.abs(w.x - s.x) > 1) this.facing = w.x > s.x ? 1 : -1;
    const [wx, wy] = w ? screen(w.x, w.y) : [0, 0];
    this.explorer(ex, ey, walking, now, v.zoom / START_ZOOM, sky(v.x).darkness > 0.12 && has(s, 'torche'), {
      weapon: weaponOf(s).id,
      work: w ? { kind: w.kind, res: w.res, at: [wx, wy], done: 1 - (w.left ?? 0) / (w.kind === 'fish' ? FISH_SECONDS : HARVEST_SECONDS) } : null,
    });
    // the animal's bite or claws on the explorer: red slashes, for a moment
    const cp = (now - this.blows.hurt) / 320;
    if (cp >= 0 && cp < 1) this.wound(this.attackKind, ex, ey - 22 * v.zoom / START_ZOOM, cp, v.zoom);
    this.drops(screen, v, dt);
    if (f) this.lifeBar(ex, ey - 40 * v.zoom / START_ZOOM, s.hp / s.maxHp, 'you');
    this.drawFloats(screen, now);
    // the clouds pass over the explorer (they fade out as the view zooms in under them)
    this.weather.drawClouds(ctx, v, screen, (X, Y) => isSeen(s, X, Y));
    this.compass(v.W - 44, (v.top ?? 70) + 40);
    this.scaleBar(v);
  }

  /** The hole one seen cell punches in the fog: a soft disc, drawn once per size. */
  private fogStamp(rr: number): HTMLCanvasElement {
    const size = Math.max(2, Math.ceil(rr * 2));
    if (this.stamp.width !== size) {
      this.stamp.width = this.stamp.height = size;
      const g = this.stamp.getContext('2d')!, r = size / 2;
      const gr = g.createRadialGradient(r, r, 0, r, r, r);
      gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.9)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, size, size);
    }
    return this.stamp;
  }

  /**
   * Wild animals wandering where the explorer has seen, on the shared world clock. By day the
   * day herds; after dark they sleep and the night's own come out (bats, owls, hedgehogs,
   * foxes, wolves...), drawn over the night veil in the colours of the dark (no eyeshine: asked by Adrien).
   */
  private animals(s: GameState, v: View, screen: (x: number, y: number) => [number, number], ax: number, ay: number, bx: number, by: number, now: number, night: boolean): void {
    const t = worldTime(), time = now / 1000, scale = 2 * v.zoom / START_ZOOM, ctx = this.ctx;
    const lakes = lakesNear(ax, ay, bx, by);
    const list: { a: Animal; look: Look; x: number; y: number; alpha: number }[] = [];
    for (const h of herdsNear(ax - 40, ay - 40, bx + 40, by + 40, 320, night)) {
      const look = h.species.look;
      if (look.len * scale < 4) continue; // too small to make out at this zoom
      const alpha = presence(h, night, t); // out, or resting (see world/fauna)
      if (alpha < 0.03) continue;
      const water = h.species.biomes.includes('sea') || h.species.biomes.includes('ice');
      const flies = look.kind === 'bat' || look.kind === 'owl';
      for (const [k, a] of animalsOf(h, t).entries()) {
        const key = h.key + ':' + k;
        if (s.fight?.key === key || (s.gone[key] ?? 0) > t) continue; // fighting (drawn apart), killed, or run off
        if (a.x < ax - 40 || a.x > bx + 40 || a.y < ay - 40 || a.y > by + 40 || !isSeen(s, a.x, a.y)) continue;
        if (!water && !flies && lakes.some((l) => inLake(l, a.x, a.y))) continue;
        const [x, y] = screen(a.x, a.y);
        list.push({ a, look, x, y, alpha });
      }
    }
    list.sort((p, q) => p.y - q.y);
    for (const p of list) {
      ctx.globalAlpha = p.alpha;
      drawAnimal(ctx, p.look, p.a, p.x, p.y, scale, time + p.a.phase, DPR, night);
    }
    ctx.globalAlpha = 1;
  }

  /** Waves, leaves, chimney smoke, travellers on the roads, a flight of birds now and then. */
  private animate(s: GameState, v: View, screen: (x: number, y: number) => [number, number], world: (x: number, y: number) => [number, number], tiles: TileArt[], now: number, dt: number): void {
    const { ctx } = this;
    ctx.strokeStyle = INK; ctx.fillStyle = INK;
    const time = now / 1000;
    // The tree of light and the crystal forests glow softly, breathing.
    for (const w of wondersNear(...world(0, 0), ...world(v.W, v.H), 120)) {
      if ((w.kind !== 'arbre' && w.kind !== 'cristal') || !isSeen(s, w.x, w.y)) continue;
      const art = !!wonderImage(w.kind); // the illustrations are taller than the engraved drawings
      const [x, y] = screen(w.x, w.y - (w.kind === 'arbre' ? (art ? 50 : 36) : (art ? 34 : 16))), r = (w.kind === 'arbre' ? (art ? 62 : 46) : (art ? 44 : 34)) * v.zoom;
      const a = 0.22 + 0.12 * Math.sin(time * 1.4 + w.x);
      const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
      const c = w.kind === 'arbre' ? '255,225,130' : '170,210,255';
      gr.addColorStop(0, `rgba(${c},${a})`); gr.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = gr; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.fillStyle = INK;
    this.riverLife(s, v, screen, world, time);
    this.leapingFish(s, v, screen, world, tiles, time, dt);
    ctx.strokeStyle = INK; ctx.fillStyle = INK; ctx.globalAlpha = 1;
    // Waves: small crests that rise, roll a little and fade.
    ctx.lineWidth = 1; ctx.lineCap = 'round'; ctx.strokeStyle = 'rgb(40,70,90)';
    for (const tl of tiles) for (const [X, Y, ph] of tl.waves) {
      if (!isSeen(s, X, Y)) continue;
      const a = Math.sin(time * 1.3 + ph);
      if (a < 0) continue;
      const [x, y] = screen(X + Math.sin(time * 0.7 + ph) * 3, Y), w = 5 * v.zoom, hgt = w * (0.35 + 0.25 * a);
      ctx.globalAlpha = a * 0.8;
      ctx.beginPath();
      ctx.moveTo(x - w, y);
      ctx.quadraticCurveTo(x - w * 0.35, y - hgt * 1.3, x + w * 0.2, y - hgt); // the rising face
      ctx.quadraticCurveTo(x + w * 0.5, y - hgt * 0.9, x + w * 0.45, y - hgt * 0.45); // curling crest
      ctx.moveTo(x + w * 0.2, y - hgt);
      ctx.quadraticCurveTo(x + w * 0.7, y - hgt * 0.6, x + w, y); // the back of the wave
      ctx.stroke();
    }
    ctx.globalAlpha = 1; ctx.strokeStyle = INK;

    this.leafTimer += dt;
    const trees: [number, number][] = [];
    for (const tl of tiles) for (const a of tl.trees) if (isSeen(s, a[0], a[1])) trees.push(a);
    while (this.leafTimer > 0.12 && trees.length) {
      this.leafTimer -= 0.12;
      const [X, Y] = trees[Math.floor(Math.random() * trees.length)];
      if (this.leaves.length < 60) this.leaves.push({ x: X, y: Y - 3, life: 0, ph: Math.random() * 6, r: Math.random() * 6 });
    }
    for (let k = this.leaves.length - 1; k >= 0; k--) {
      const f = this.leaves[k];
      const wd = this.weather.centre?.wind ?? { dx: 1, dy: 0.3, speed: 4 }; // leaves fly with the wind
      f.life += dt; f.x += (wd.dx * wd.speed * 3.5 + Math.sin(time * 2 + f.ph) * 8) * dt; f.y += (wd.dy * wd.speed * 3.5 + 6 + Math.cos(time * 3 + f.ph) * 10) * dt; f.r += dt * 4;
      if (f.life > 4) { this.leaves.splice(k, 1); continue; }
      const [x, y] = screen(f.x, f.y);
      ctx.globalAlpha = Math.min(1, (4 - f.life) * 1.5);
      ctx.save(); ctx.translate(x, y); ctx.rotate(f.r); ctx.beginPath();
      ctx.ellipse(0, 0, 1.8 * Math.min(v.zoom, 1.6), 0.8 * Math.min(v.zoom, 1.6), 0, 0, 6.3); ctx.fill(); ctx.restore();
    }
    ctx.globalAlpha = 1;

    const [ax, ay] = world(0, 0), [bx, by] = world(v.W, v.H);
    const ti0 = Math.floor(ax / TILE), ti1 = Math.floor(bx / TILE), tj0 = Math.floor(ay / TILE), tj1 = Math.floor(by / TILE);
    for (let tj = tj0 - 1; tj <= tj1 + 1; tj++) for (let ti = ti0 - 1; ti <= ti1 + 1; ti++) {
      const b = settlement(ti, tj);
      if (!b || !isSeen(s, b.x, b.y)) continue;
      const n = b.city ? 3 : 1;
      for (let k = 0; k < n; k++) {
        const hx = b.x + (k - 1) * 6, hy = b.y - (b.city ? 6 : 4);
        ctx.lineWidth = 0.7; ctx.globalAlpha = 0.7; ctx.beginPath();
        for (let u = 0; u <= 1; u += 0.1) {
          const [x, y] = screen(hx + Math.sin(time * 1.5 + u * 5 + k) * 2.5 * u + u * 4, hy - u * 16);
          if (u) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        }
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    for (const road of roadsAround(Math.floor(v.x / TILE), Math.floor(v.y / TILE), Math.ceil(Math.max(v.W, v.H) / v.zoom / TILE / 2) + 1)) {
      const { p, q } = road, L = road.lengths[road.lengths.length - 1], nb = 1 + Math.floor(hash2(p.wi + q.wi, p.tj - q.tj) * 2);
      for (let k = 0; k < nb; k++) {
        const sp = 10 / L, ph = hash2(p.wi * 3 + k, q.tj * 7 - k), w = ((time * sp + ph) % 2 + 2) % 2, u = w < 1 ? w : 2 - w, pt = pointOnRoad(road, u);
        if (!isSeen(s, pt.x, pt.y)) continue;
        const [x, y] = screen(pt.x, pt.y);
        if (x < -20 || y < -20 || x > v.W + 20 || y > v.H + 20) continue;
        this.traveller(x, y, time * 6 + k, Math.min(v.zoom, 1.6));
      }
    }

    // A flight of birds now and then. It crosses a fixed stretch of the world, chosen where the
    // view was when it took off: the birds no longer follow the camera.
    const flight = Math.floor(time / 14), pv = (time % 14) / 14;
    if (this.flightId !== flight) { this.flightId = flight; this.flightAt = [v.x, v.y]; }
    if (hash2(flight, 3) < 0.6) {
      const [fx, fy] = this.flightAt, a0 = hash2(flight, 1) * 6.28;
      const cx = fx - Math.cos(a0) * 500 + Math.cos(a0) * 1000 * pv, cy = fy - Math.sin(a0) * 500 + Math.sin(a0) * 1000 * pv, z = Math.min(v.zoom, 1.6);
      ctx.lineWidth = 0.9;
      for (let k = 0; k < 5; k++) {
        const [x, y] = screen(cx - Math.cos(a0) * k * 10 + Math.sin(a0) * (k % 2 ? 6 : -6) * k * 0.5, cy - Math.sin(a0) * k * 10 - Math.cos(a0) * (k % 2 ? 6 : -6) * k * 0.5), b = Math.sin(time * 9 + k) * 2 * z;
        ctx.beginPath(); ctx.moveTo(x - 4 * z, y - b); ctx.quadraticCurveTo(x - 2 * z, y - 2 * z, x, y); ctx.quadraticCurveTo(x + 2 * z, y - 2 * z, x + 4 * z, y - b); ctx.stroke();
      }
    }
  }

  /**
   * Running water: flecks of foam drift downstream, faster and whiter in torrents; at the foot
   * of waterfalls, spray rises and falls. Skipped when zoomed far out (too small to see).
   */
  private riverLife(s: GameState, v: View, screen: (x: number, y: number) => [number, number], world: (x: number, y: number) => [number, number], time: number): void {
    if (v.zoom < 0.45) return;
    const { ctx } = this, [ax, ay] = world(0, 0), [bx, by] = world(v.W, v.H);
    const SPACING = 11;
    ctx.lineCap = 'round';
    const rivers = riversNear(ax, ay, bx, by), lakes = rivers.flatMap((r) => r.lakes);
    for (const r of rivers) {
      const L = r.lengths[r.lengths.length - 1];
      let k = 1;
      // calm water: faint, thin glints drifting slowly downstream, a little livelier in torrents
      for (let d = (time * 6) % SPACING; d < L; d += SPACING) {
        while (k < r.lengths.length - 1 && r.lengths[k] < d) k++;
        const [px, py] = r.points[k - 1], [qx, qy] = r.points[k];
        if (px < ax - 10 || px > bx + 10 || py < ay - 10 || py > by + 10) continue;
        const st = r.steep[k], seg = r.lengths[k] - r.lengths[k - 1] || 1, u = (d - r.lengths[k - 1]) / seg;
        const extra = (time * 10 * st) % SPACING, uu = Math.min(1, u + extra / seg);
        const X = px + (qx - px) * uu, Y = py + (qy - py) * uu;
        if (!isSeen(s, X, Y) || lakes.some((l) => inLake(l, X, Y))) continue; // not over lakes
        // each glint fades in and out as it drifts, so the water shimmers instead of streaming
        const life = Math.sin(((d / SPACING + time * 0.35) % 1) * Math.PI);
        const [x, y] = screen(X, Y), dx = (qx - px) / seg, dy = (qy - py) / seg, len = (1.2 + st * 1.5) * v.zoom;
        const off = ((Math.floor(d / SPACING) * 7) % 5 - 2) / 2 * r.widths[k] * 0.25 * v.zoom; // spread across the river
        ctx.strokeStyle = `rgba(235,245,248,${(0.18 + st * 0.22) * life})`; ctx.lineWidth = 0.6 * Math.min(1.5, v.zoom);
        ctx.beginPath(); ctx.moveTo(x - dx * len - dy * off, y - dy * len + dx * off); ctx.lineTo(x + dx * len - dy * off, y + dy * len + dx * off); ctx.stroke();
      }
      for (const [fx, fy, dx, dy] of r.falls) { // spray at the foot of the falls
        if (fx < ax - 20 || fx > bx + 20 || fy < ay - 20 || fy > by + 20 || !isSeen(s, fx, fy)) continue;
        for (let m = 0; m < 6; m++) {
          const ph = (time * 1.6 + m / 6) % 1, o = (m - 2.5) * 2.4, sx = fx + dx * 13 - dy * o, sy = fy + dy * 13 + dx * o;
          const [x, y] = screen(sx, sy - ph * 7);
          ctx.globalAlpha = 0.7 * (1 - ph); ctx.fillStyle = 'rgb(250,252,252)';
          ctx.beginPath(); ctx.arc(x, y, (1.4 + ph * 3) * v.zoom, 0, 6.3); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    }
  }

  /**
   * Now and then a fish leaps out of the sea, a lake or a wide river: it arcs over the water,
   * with a ring of ripples where it leaves and where it dives back.
   */
  private leapingFish(s: GameState, v: View, screen: (x: number, y: number) => [number, number], world: (x: number, y: number) => [number, number], tiles: TileArt[], time: number, dt: number): void {
    if (v.zoom < 0.5) { this.fish.length = 0; this.caught.length = 0; return; }
    const { ctx } = this, DUR = 1.1;
    for (const [X, Y] of this.caught.splice(0)) this.fish.push({ x: X, y: Y, t0: time, dir: X > s.x ? -1 : 1, size: 1.6 });
    this.fishTimer -= dt;
    if (this.fishTimer <= 0 && this.fish.length < 4) {
      this.fishTimer = 0.6 + Math.random() * 1.2;
      // candidates: open water seen on screen (sea points of the tiles, lakes)
      const [ax, ay] = world(0, 0), [bx, by] = world(v.W, v.H), spots: [number, number, number][] = [];
      for (const tl of tiles) for (const [X, Y] of tl.waves) spots.push([X, Y, 1]);
      for (const r of riversNear(ax, ay, bx, by)) {
        for (const l of r.lakes) spots.push([l.x, l.y, 0.8]); // fish in lakes and the sea, not in rivers
      }
      const ok = spots.filter(([X, Y]) => X > ax && X < bx && Y > ay && Y < by && isSeen(s, X, Y));
      if (ok.length) {
        const [X, Y, size] = ok[Math.floor(Math.random() * ok.length)];
        this.fish.push({ x: X + (Math.random() - 0.5) * 6, y: Y + (Math.random() - 0.5) * 4, t0: time, dir: Math.random() < 0.5 ? -1 : 1, size });
      }
    }
    this.fish = this.fish.filter((f) => time - f.t0 < DUR + 0.6);
    for (const f of this.fish) {
      const u = (time - f.t0) / DUR, z = v.zoom * f.size, span = 9 * z;
      const [x0, y0] = screen(f.x, f.y);
      // ripples where it leaves and where it lands
      for (const [rx, start] of [[x0 - f.dir * span / 2, 0], [x0 + f.dir * span / 2, 0.8]] as const) {
        const a = (u - start) / 0.8;
        if (a < 0 || a > 1) continue;
        ctx.globalAlpha = 0.8 * (1 - a); ctx.strokeStyle = 'rgb(250,252,252)'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.ellipse(rx, y0, (1 + a * 4) * z, (0.5 + a * 1.6) * z, 0, 0, 6.3); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      if (u > 1) continue;
      // the leap: a parabola, the fish turned along it
      const px = x0 + f.dir * span * (u - 0.5), py = y0 - Math.sin(Math.PI * u) * 7 * z;
      // heading along the arc: up at the start, level at the top, down at the end
      const vx = f.dir * span, vy = -Math.cos(Math.PI * u) * 7 * z * Math.PI;
      ctx.save(); ctx.translate(px, py); ctx.rotate(Math.atan2(vy, vx)); ctx.scale(z, f.dir > 0 ? z : -z); // keep the back up
      ctx.fillStyle = 'rgb(186,198,200)'; ctx.strokeStyle = INK; ctx.lineWidth = 0.3;
      ctx.beginPath(); ctx.ellipse(0, 0, 2.6, 1, 0, 0, 6.3); ctx.fill(); ctx.stroke(); // body
      ctx.beginPath(); ctx.moveTo(-2.3, 0); ctx.quadraticCurveTo(-3.2, -0.3, -3.9, -1.2); ctx.lineTo(-3.4, 0); ctx.lineTo(-3.9, 1.2); ctx.quadraticCurveTo(-3.2, 0.3, -2.3, 0); ctx.fill(); ctx.stroke(); // tail
      ctx.beginPath(); ctx.moveTo(-0.6, -0.95); ctx.lineTo(0.3, -1.5); ctx.lineTo(0.8, -0.9); ctx.stroke(); // dorsal fin
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(1.6, -0.25, 0.25, 0, 6.3); ctx.fill(); // eye
      ctx.restore();
      // droplets trailing behind
      ctx.fillStyle = 'rgba(250,252,252,.9)';
      for (let k = 1; k <= 2; k++) { const uu = Math.max(0, u - k * 0.08); ctx.beginPath(); ctx.arc(x0 + f.dir * span * (uu - 0.5), y0 - Math.sin(Math.PI * uu) * 7 * z + k, 0.5 * z, 0, 6.3); ctx.fill(); }
    }
  }

  private traveller(x: number, y: number, step: number, s: number): void {
    const { ctx } = this;
    ctx.lineWidth = 0.9;
    const j = Math.sin(step) * 1.6 * s;
    ctx.beginPath(); ctx.arc(x, y - 6 * s, 1.3 * s, 0, 6.3); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x, y - 5 * s); ctx.lineTo(x, y - 2 * s); ctx.lineTo(x - j, y + 1 * s); ctx.moveTo(x, y - 2 * s); ctx.lineTo(x + j, y + 1 * s); ctx.stroke();
  }

  /**
   * The footsteps as one path. Points are stored where they were walked; after a lap around the
   * planet they jump by its circumference, so each point is unwrapped next to the previous one,
   * and the whole path is placed so that it ends at the explorer.
   */
  /** When the last blows were thrown and taken (performance.now ms), for the fight's animations. */
  private readonly blows = { you: -1e9, foe: -1e9, struck: -1e9, hurt: -1e9, landed: false };

  /** A blow in the fight: who threw it, and whether it landed (from the map's fight events). */
  blow(who: 'you' | 'foe', landed: boolean): void {
    const now = performance.now();
    if (who === 'you') {
      this.blows.you = now;
      // the staff comes down a moment after the swing starts: the impact then
      if (landed) { this.blows.struck = now + STRIKE_MS * 0.45; this.blows.landed = true; } else this.blows.landed = false;
    } else {
      this.blows.foe = now;
      if (landed) this.blows.hurt = now + LUNGE_MS * 0.45;
    }
  }

  /** Ink strokes bursting from where a blow lands. */
  private burst(x: number, y: number, p: number, z: number): void {
    const { ctx } = this, r0 = (3 + p * 8) * z, r1 = r0 + (4 - p * 2) * z;
    ctx.globalAlpha = 1 - p; ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let k = 0; k < 7; k++) { const a = k * 0.9 + 0.3; ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); ctx.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); }
    ctx.stroke(); ctx.globalAlpha = 1;
  }

  // ---- blood and carcasses ----

  /** the blows already bled for (their times), so each spurts once */
  private readonly bled = { foe: -1e9, you: -1e9 };
  /** drops of blood in the air: world position, height above the ground, speeds (world units) */
  private blood: { x: number; y: number; z: number; vx: number; vy: number; vz: number; r: number }[] = [];
  /** where drops fell: small stains on the ground that dry out and fade */
  private stains: { x: number; y: number; r: number; t0: number }[] = [];

  /** A spurt of blood from (x, y) at height h, thrown away from the blow (dir), n drops. */
  spurt(x: number, y: number, h: number, dir: number, n: number): void {
    for (let k = 0; k < n; k++) {
      const a = (Math.random() - 0.5) * 1.4, sp = 6 + Math.random() * 16;
      this.blood.push({ x, y, z: h * (0.7 + Math.random() * 0.4), vx: dir * Math.cos(a) * sp, vy: (Math.random() - 0.5) * 8, vz: 8 + Math.random() * 22, r: 0.35 + Math.random() * 0.45 });
    }
    if (this.blood.length > 160) this.blood.splice(0, this.blood.length - 160);
  }

  /** The drops fly, fall, and leave a stain where they land. */
  private drops(screen: (x: number, y: number) => [number, number], v: View, dt: number): void {
    const { ctx } = this, now = performance.now();
    ctx.fillStyle = 'rgb(150,22,18)';
    this.blood = this.blood.filter((d) => {
      d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt; d.vz -= 140 * dt;
      if (d.z <= 0) { this.stains.push({ x: d.x, y: d.y, r: d.r * (0.6 + Math.random() * 0.6), t0: now }); return false; }
      const [x, y] = screen(d.x, d.y);
      ctx.beginPath(); ctx.ellipse(x, y - d.z * v.zoom, d.r * v.zoom, d.r * v.zoom * 1.3, 0, 0, Math.PI * 2); ctx.fill();
      return true;
    });
    if (this.stains.length > 240) this.stains.splice(0, this.stains.length - 240);
  }

  /** Stains on the ground, and the skeletons of the last animals killed, where they fell, in their blood. */
  private stainsAndCarcasses(s: GameState, v: View, screen: (x: number, y: number) => [number, number], now: number): void {
    const { ctx } = this, STAIN_MS = 40000;
    this.stains = this.stains.filter((st) => now - st.t0 < STAIN_MS);
    ctx.fillStyle = 'rgb(120,24,20)';
    for (const st of this.stains) {
      const [x, y] = screen(st.x, st.y);
      ctx.globalAlpha = 0.6 * (1 - (now - st.t0) / STAIN_MS);
      ctx.beginPath(); ctx.ellipse(x, y, st.r * v.zoom * 1.2, st.r * v.zoom * 0.6, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    const scale = 2 * v.zoom / START_ZOOM, t = worldTime();
    for (const c of s.carcasses) {
      const sp = speciesById(c.species);
      if (!sp || !isSeen(s, c.x, c.y)) continue;
      const [x, y] = screen(c.x, c.y), L = sp.look.len * scale;
      if (L < 4 || x < -L * 2 || y < -L * 2 || x > v.W + L * 2 || y > v.H + L * 2) continue;
      // a pool of blood under it, spreading in the first minute
      const spread = Math.min(1, (t - c.t) / 60);
      ctx.fillStyle = 'rgba(120,24,20,.7)';
      ctx.beginPath(); ctx.ellipse(x + c.dir * L * 0.05, y + L * 0.04, L * (0.35 + spread * 0.3), L * (0.09 + spread * 0.08), 0, 0, Math.PI * 2); ctx.fill();
      drawSkeleton(ctx, sp.look, x, y, scale, c.dir, sky(c.x).darkness > 0.5);
    }
  }

  /** How the last fighting animal strikes (for the mark its blow leaves). */
  private attackKind: Attack = 'bite';

  /** The mark of a blow on the explorer: claws, teeth, or the shock of a horn or a hoof. */
  private wound(kind: Attack, x: number, y: number, p: number, z: number): void {
    if (kind === 'swipe') { this.claws(x, y, p, z); return; }
    const { ctx } = this, s = Math.min(1.4, z) * 1.2;
    ctx.globalAlpha = p < 0.5 ? 1 : (1 - p) * 2; ctx.lineCap = 'round';
    if (kind === 'bite') { // two rows of tooth marks closing on each other
      const gap = (5 - Math.min(1, p * 3) * 2.5) * s;
      ctx.fillStyle = 'rgb(168,40,32)';
      for (const side of [-1, 1]) for (let k = -2; k <= 2; k++) {
        ctx.beginPath(); ctx.ellipse(x + k * 2.6 * s, y + side * (gap + Math.abs(k) * 0.6 * s), 1 * s, 1.6 * s, 0, 0, Math.PI * 2); ctx.fill();
      }
    } else { // a horn or a hoof: a star of shock, the explorer knocked
      const r0 = (2 + p * 5) * s, r1 = r0 + (6 - p * 3) * s;
      ctx.strokeStyle = 'rgb(168,40,32)'; ctx.lineWidth = 1.8; ctx.beginPath();
      for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + 0.2; ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); ctx.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); }
      ctx.stroke();
      if (kind === 'kick') { ctx.fillStyle = 'rgba(42,36,29,.8)'; ctx.beginPath(); ctx.ellipse(x, y, 2.2 * s, 1.6 * s, 0, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
  }

  /** Claw marks: three red slashes drawn across the explorer, then fading. */
  private claws(x: number, y: number, p: number, z: number): void {
    const { ctx } = this, s = Math.min(1.4, z) * 1.2, grow = Math.min(1, p * 4);
    ctx.globalAlpha = p < 0.5 ? 1 : (1 - p) * 2; ctx.strokeStyle = 'rgb(168,40,32)'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let k = -1; k <= 1; k++) { const ox = k * 3.5 * s; ctx.moveTo(x + ox - 5 * s, y - 6 * s); ctx.quadraticCurveTo(x + ox, y - 1 * s, x + ox - 5 * s + 10 * s * grow, y - 6 * s + 12 * s * grow); }
    ctx.stroke(); ctx.globalAlpha = 1;
  }

  /** Numbers and words rising over a fight: damage, misses, meat. */
  private floats: { x: number; y: number; text: string; kind: 'you' | 'foe' | 'loot'; t0: number }[] = [];

  /** Show a word rising from a world point for a moment (`kind`: whose damage, or loot). */
  float(x: number, y: number, text: string, kind: 'you' | 'foe' | 'loot'): void {
    this.floats.push({ x, y, text, kind, t0: performance.now() });
    if (this.floats.length > 20) this.floats.shift();
  }

  private drawFloats(screen: (x: number, y: number) => [number, number], now: number): void {
    const { ctx } = this;
    this.floats = this.floats.filter((f) => now - f.t0 < 1000);
    ctx.textAlign = 'center';
    for (const f of this.floats) {
      const u = (now - f.t0) / 1000, [x, y] = screen(f.x, f.y);
      ctx.globalAlpha = Math.min(1, (1 - u) * 2.5);
      ctx.font = (f.kind === 'loot' ? 'italic 14px' : '700 16px') + " 'Old Standard TT', serif";
      ctx.fillStyle = f.kind === 'foe' ? 'rgb(168,52,40)' : f.kind === 'loot' ? 'rgb(70,96,50)' : INK;
      this.label(f.text, x, y - 30 - u * 26);
    }
    ctx.globalAlpha = 1; ctx.fillStyle = INK;
  }

  /** A small engraved gauge of life over a fighter. */
  private lifeBar(x: number, y: number, frac: number, who: 'you' | 'foe'): void {
    const { ctx } = this, w = 30, h = 4;
    ctx.fillStyle = 'rgba(236,227,203,.9)'; ctx.fillRect(x - w / 2, y, w, h);
    ctx.fillStyle = who === 'foe' ? 'rgb(168,52,40)' : 'rgb(88,120,70)'; ctx.fillRect(x - w / 2, y, w * Math.max(0, Math.min(1, frac)), h);
    ctx.strokeStyle = INK; ctx.lineWidth = 0.8; ctx.strokeRect(x - w / 2, y, w, h);
  }

  /** A name on the map, with a paper halo so it stays readable over forests and mountains. */
  private label(text: string, x: number, y: number): void {
    const { ctx } = this;
    ctx.save();
    ctx.strokeStyle = 'rgba(236,227,203,.85)'; ctx.lineWidth = 3.5; ctx.lineJoin = 'round';
    ctx.strokeText(text, x, y);
    ctx.restore();
    ctx.fillText(text, x, y);
  }

  /** The explorer: wide-brimmed hat, travelling coat, pack with a bedroll, staff, boots. */
  private explorer(atX: number, atY: number, walking: boolean, now: number, scale: number, torch = false, gear: Gear = { weapon: 'baton', work: null }): void {
    const { ctx } = this;
    const work = gear.work, armed = gear.weapon !== 'poings', blade = gear.weapon === 'coutelas' || gear.weapon === 'sabre';
    // a blow of the staff: raised over the head, then brought down on the animal (STRIKE_MS);
    // and the flinch when the animal's blow lands
    const sp = (now - this.blows.you) / STRIKE_MS, striking = sp >= 0 && sp < 1;
    const hp = (now - this.blows.hurt) / HURT_MS, hurt = hp >= 0 && hp < 1 ? Math.sin(Math.PI * hp) : 0;
    // Drawn at a fixed size in the world: it shrinks when zooming out, like everything else.
    ctx.save();
    ctx.translate(atX - this.facing * hurt * 3 * scale, atY); ctx.scale(scale, scale);
    if (striking) walking = false;
    const x = 0, y = 0, u = 1.7, f = this.facing;
    const swing = walking ? Math.sin(now / 110) : 0, j = swing * 2.4, bob = walking ? Math.abs(Math.cos(now / 110)) * 0.6 : 0;
    const X = (dx: number): number => x + dx * u * f; // dx measured towards the facing side
    const Y = (dy: number): number => y + dy * u - bob;
    ctx.save();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = INK;
    // shadow
    ctx.globalAlpha = 0.25; ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(x, y + 1.5, 8, 2.2, 0, 0, 6.3); ctx.fill(); ctx.globalAlpha = 1;
    // legs and boots
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(X(-0.5), Y(-6)); ctx.lineTo(x - j, y - 1); ctx.moveTo(X(0.5), Y(-6)); ctx.lineTo(x + j, y - 1); ctx.stroke();
    ctx.fillStyle = INK;
    for (const fx of [x - j, x + j]) { ctx.beginPath(); ctx.ellipse(fx + f * 0.9, y - 0.6, 1.8, 1, 0, 0, 6.3); ctx.fill(); }
    // pack on the back, bedroll on top
    ctx.lineWidth = 1;
    ctx.fillStyle = 'rgb(120,88,58)';
    ctx.beginPath(); ctx.rect(Math.min(X(-3.9), X(-1.2)), Y(-13.2), 2.7 * u, 6.2 * u); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgb(200,175,130)';
    ctx.beginPath(); ctx.ellipse(X(-2.6), Y(-13.9), 2.3 * u, 1 * u, 0, 0, 6.3); ctx.fill(); ctx.stroke();
    // coat
    ctx.fillStyle = 'rgb(150,128,86)';
    ctx.beginPath(); ctx.moveTo(X(-1.7), Y(-13)); ctx.lineTo(X(1.7), Y(-13)); ctx.lineTo(X(2.4), Y(-5.6)); ctx.lineTo(X(-2.4), Y(-5.6)); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(X(-2), Y(-8.6)); ctx.lineTo(X(2.1), Y(-8.6)); ctx.stroke(); // belt
    // what the hands do: work, a blow, or carrying the staff (or nothing) along
    const wood = 'rgb(90,62,38)';
    const spearTip = (px: number, py: number, dx: number, dy: number): void => { // a flint point at the end of the spear
      if (gear.weapon !== 'lance') return;
      const nx = -dy, ny = dx;
      ctx.fillStyle = 'rgb(110,104,98)'; ctx.strokeStyle = INK; ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(px + dx * 3.2 * u, py + dy * 3.2 * u); ctx.lineTo(px + nx * 0.9 * u, py + ny * 0.9 * u); ctx.lineTo(px - nx * 0.9 * u, py - ny * 0.9 * u); ctx.closePath(); ctx.fill(); ctx.stroke();
    };
    if (work && work.kind === 'fish' && !striking) {
      // the rod held out over the water, the line down to a float that bobs. Just after the work
      // starts, the cast (CAST_MS): the rod swings back over the shoulder, whips forward, and the
      // float flies out in an arc and drops into the water with a splash.
      const cp = (now - this.castAt) / CAST_MS, casting = cp >= 0 && cp < 1;
      const ease = (u: number): number => u * u * (3 - 2 * u);
      const key = (a: [number, number], b: [number, number], u: number): [number, number] => [a[0] + (b[0] - a[0]) * ease(u), a[1] + (b[1] - a[1]) * ease(u)];
      const REST: [number, number] = [11, -22], BACK: [number, number] = [-6, -24], FORE: [number, number] = [14, -15];
      const [ox, oy] = !casting ? REST : cp < 0.35 ? key(REST, BACK, cp / 0.35) : cp < 0.5 ? key(BACK, FORE, (cp - 0.35) / 0.15) : cp < 0.75 ? key(FORE, REST, (cp - 0.5) / 0.25) : REST;
      const tx = X(ox), ty = Y(oy), hx = X(2.4 + (ox - 11) * 0.12), hy = Y(-11 + (oy + 22) * 0.1);
      ctx.strokeStyle = INK; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(X(1.2), Y(-12)); ctx.lineTo(hx, hy); ctx.stroke();
      ctx.strokeStyle = wood; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(X(0.6), Y(-8)); ctx.quadraticCurveTo(X(0.6 + (ox - 0.6) * 0.45), Y(-8 + (oy + 8) * 0.7), tx, ty); ctx.stroke();
      const wx = (work.at[0] - atX) / scale, wy = (work.at[1] - atY) / scale; // where the float lands
      if (casting && cp < 0.45) {
        // the float still at the rod's tip, swinging behind it
        ctx.strokeStyle = 'rgba(42,36,29,.7)'; ctx.lineWidth = 0.4; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx - f * 1.5, ty + 4); ctx.stroke();
        this.float_(tx - f * 1.5, ty + 4.6);
      } else if (casting && cp < 0.85) {
        // in flight: an arc from the tip to the water
        const u = (cp - 0.45) / 0.4, fx = tx + (wx - tx) * u, fy = ty + (wy - ty) * u - Math.sin(Math.PI * u) * 16;
        ctx.strokeStyle = 'rgba(42,36,29,.6)'; ctx.lineWidth = 0.4; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.quadraticCurveTo((tx + fx) / 2, Math.min(ty, fy) - 3, fx, fy); ctx.stroke();
        this.float_(fx, fy);
      } else {
        const bx = wx, by = wy + Math.sin(now / 300) * 0.7 + (work.done > 0.85 ? Math.sin(now / 40) * 1.2 : 0);
        ctx.strokeStyle = 'rgba(42,36,29,.7)'; ctx.lineWidth = 0.4; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.quadraticCurveTo((tx + bx) / 2, Math.max(ty, by) + 2, bx, by); ctx.stroke();
        this.float_(bx, by);
        // the splash where it fell, then the slow rings round the float
        const sp = casting ? (cp - 0.85) / 0.15 : 1 + (now - this.castAt - CAST_MS) / 500;
        if (sp < 2.2) {
          ctx.strokeStyle = 'rgba(250,252,252,.9)'; ctx.lineWidth = 0.6;
          for (const k of [0, 0.4]) { const r = (sp - k) * 3.5; if (r > 0 && r < 7) { ctx.globalAlpha = 1 - r / 7; ctx.beginPath(); ctx.ellipse(bx, by + 0.4, r, r * 0.35, 0, 0, 6.3); ctx.stroke(); } }
          ctx.globalAlpha = 1;
          if (sp < 0.8) { ctx.fillStyle = 'rgba(250,252,252,.9)'; for (const d of [-1.5, 0, 1.5]) { ctx.beginPath(); ctx.arc(bx + d, by - 1 - Math.sin(sp * Math.PI / 0.8) * 3 * (1 - Math.abs(d) * 0.3), 0.45, 0, 6.3); ctx.fill(); } }
        } else { ctx.strokeStyle = 'rgba(250,252,252,.8)'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.ellipse(bx, by + 0.4, 2 + (now / 600 % 1) * 2, 0.7, 0, 0, 6.3); ctx.stroke(); }
      }
    } else if (work && !striking) {
      // gathering: bending to the ground and up again, bits flying off
      const ph = (now / 520) % 1, down = Math.sin(ph * Math.PI * 2) * 0.5 + 0.5;
      const hx = X(3.2 + down * 1.2), hy = Y(-11 + down * 9);
      ctx.strokeStyle = INK; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(X(1.2), Y(-12)); ctx.lineTo(hx, hy); ctx.stroke();
      const col = work.res === 'bois' ? 'rgb(120,84,50)' : work.res === 'pierre' ? 'rgb(120,116,108)' : 'rgb(120,140,70)';
      ctx.fillStyle = col;
      for (let k = 0; k < 3; k++) {
        const q = (ph + k / 3) % 1, px = X(4.5 + q * 3 * (k - 1)), py = Y(-1 - Math.sin(q * Math.PI) * 5);
        ctx.globalAlpha = 1 - q; ctx.fillRect(px - 0.8, py - 0.8, 1.6, work.res === 'fibre' ? 2.6 : 1.6);
      }
      ctx.globalAlpha = 1;
      if (work.res === 'bois') { ctx.strokeStyle = wood; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + f * 3, hy - 3); ctx.stroke(); } // a branch broken off
    } else if (striking && !armed) {
      // a punch: the fist thrown forward, then drawn back
      const ext = Math.sin(Math.PI * sp) * 7;
      ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(X(1.2), Y(-12)); ctx.lineTo(X(2 + ext), Y(-11.5)); ctx.stroke();
      ctx.fillStyle = 'rgb(230,200,165)'; ctx.beginPath(); ctx.arc(X(2.4 + ext), Y(-11.5), 1.1 * u, 0, 6.3); ctx.fill(); ctx.lineWidth = 0.7; ctx.stroke();
    } else if (!armed) {
      // empty-handed: the arm swings with the walk
      ctx.strokeStyle = INK; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(X(1.2), Y(-12)); ctx.lineTo(X(1.8) + j * 0.5 * f, Y(-7)); ctx.stroke();
    } else if (striking) {
      // the swing: from upright, back over the shoulder, then down onto the animal
      const a = sp < 0.35 ? -90 - (sp / 0.35) * 70 : sp < 0.55 ? -160 + ((sp - 0.35) / 0.2) * 190 : 30 - ((sp - 0.55) / 0.45) * 120;
      const r = a * Math.PI / 180, dx = Math.cos(r) * f, dy = Math.sin(r), hx = X(2.2), hy = Y(-11);
      ctx.strokeStyle = INK; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(X(1.2), Y(-12)); ctx.lineTo(hx, hy); ctx.stroke(); // the arm, raised
      if (blade) { // a cutlass or a sabre: the hilt in the fist, the blade sweeping down
        const bl = gear.weapon === 'sabre' ? 9 : 6.5;
        ctx.lineWidth = 1.4; ctx.strokeStyle = STEEL; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + dx * bl * u, hy + dy * bl * u); ctx.stroke();
        ctx.lineWidth = 0.6; ctx.strokeStyle = INK; ctx.stroke();
        ctx.lineWidth = 1.3; ctx.strokeStyle = 'rgb(150,120,60)'; ctx.beginPath(); ctx.moveTo(hx - dy * 1.4, hy + dx * 1.4); ctx.lineTo(hx + dy * 1.4, hy - dx * 1.4); ctx.stroke(); // the guard
      } else {
        ctx.lineWidth = 1.2; ctx.strokeStyle = wood;
        ctx.beginPath(); ctx.moveTo(hx - dx * 5 * u, hy - dy * 5 * u); ctx.lineTo(hx + dx * 11 * u, hy + dy * 11 * u); ctx.stroke();
        spearTip(hx + dx * 11 * u, hy + dy * 11 * u, dx, dy);
      }
      if (sp > 0.35 && sp < 0.6) { // the whoosh of the blow
        ctx.globalAlpha = 0.5; ctx.strokeStyle = INK; ctx.lineWidth = 0.6;
        ctx.beginPath();
        for (let k = 0; k <= 8; k++) { const q = (-160 + (a + 160) * k / 8) * Math.PI / 180, px = hx + Math.cos(q) * f * 12 * u, py = hy + Math.sin(q) * 12 * u; if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    } else {
      const sx = X(3.6) + j * 0.3 * f;
      if (blade) { // the blade carried point down at the side
        const bl = gear.weapon === 'sabre' ? 9 : 6.5, hx = X(2.6) + j * 0.3 * f, hy = Y(-9.5);
        ctx.lineWidth = 1.4; ctx.strokeStyle = STEEL; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + f * 1.2 * u, hy + bl * u); ctx.stroke();
        ctx.lineWidth = 0.6; ctx.strokeStyle = INK; ctx.stroke();
        ctx.lineWidth = 1.3; ctx.strokeStyle = 'rgb(150,120,60)'; ctx.beginPath(); ctx.moveTo(hx - 1.4, hy + 0.3); ctx.lineTo(hx + 1.4, hy + 0.3); ctx.stroke();
        ctx.strokeStyle = INK; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(X(1.2), Y(-12)); ctx.lineTo(hx, hy); ctx.stroke();
      } else {
        ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgb(90,62,38)';
        ctx.beginPath(); ctx.moveTo(sx, Y(-16)); ctx.lineTo(sx + j * 0.15, y + 0.5); ctx.stroke();
        spearTip(sx, Y(-16), 0, -1);
        ctx.strokeStyle = INK; ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.moveTo(X(1.2), Y(-12)); ctx.lineTo(sx, Y(-9.5)); ctx.stroke();
      }
    }
    // head
    ctx.strokeStyle = INK; ctx.lineWidth = 0.9; ctx.fillStyle = 'rgb(230,200,165)';
    ctx.beginPath(); ctx.arc(X(0.2), Y(-15), 1.7 * u, 0, 6.3); ctx.fill(); ctx.stroke();
    // wide-brimmed hat
    ctx.fillStyle = 'rgb(84,62,42)';
    ctx.beginPath(); ctx.ellipse(X(0.2), Y(-16.4), 3.6 * u, 0.75 * u, 0, 0, 6.3); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(X(-1.5), Y(-16.5)); ctx.lineTo(X(-1.3), Y(-19)); ctx.quadraticCurveTo(X(0.2), Y(-19.8), X(1.7), Y(-19)); ctx.lineTo(X(1.9), Y(-16.5)); ctx.closePath(); ctx.fill(); ctx.stroke();
    if (torch) { // a torch held high in the other hand, its flame flickering
      const tx = X(-2.6), ty = Y(-20.5), fl = Math.sin(now / 70) * 0.4 + Math.sin(now / 43) * 0.3;
      ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(X(-1.2), Y(-12)); ctx.lineTo(X(-2.2), Y(-15)); ctx.stroke(); // the arm
      ctx.strokeStyle = 'rgb(90,62,38)'; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(X(-2.1), Y(-13.5)); ctx.lineTo(tx, ty + 2.5); ctx.stroke(); // the handle
      ctx.fillStyle = 'rgba(255,150,40,.95)';
      ctx.beginPath(); ctx.ellipse(tx + fl * 0.6, ty - 1.2, 2.2, 3.6 + fl, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,236,150,.95)';
      ctx.beginPath(); ctx.ellipse(tx + fl * 0.3, ty - 0.4, 1.1, 2 + fl * 0.5, 0, 0, Math.PI * 2); ctx.fill();
    }
    if (work) { // how far the work has got: a ring filling up over the hat
      const cy = Y(-25);
      ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(236,227,203,.85)'; ctx.beginPath(); ctx.arc(x, cy, 3.2, 0, 6.3); ctx.stroke();
      ctx.strokeStyle = 'rgb(70,96,50)'; ctx.beginPath(); ctx.arc(x, cy, 3.2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, work.done)); ctx.stroke();
    }
    ctx.restore();
    ctx.restore();
  }

  /** Overview of everything discovered, small, like an atlas page. */
  private atlas(s: GameState, v: View, screen: (x: number, y: number) => [number, number], ax: number, ay: number, bx: number, by: number): void {
    const { ctx } = this;
    const c = Math.max(1, CELL * v.zoom);
    for (const k of s.seen) {
      const [ci, cj] = k.split(',').map(Number), X = nearestCopy(ci * CELL, v.x), Y = cj * CELL;
      if (X < ax - CELL || X > bx + CELL || Y < ay - CELL || Y > by + CELL) continue;
      let h = this.atlasCache.get(k);
      if (h === undefined) { h = altitude(X, Y); this.atlasCache.set(k, h); }
      const [x, y] = screen(X, Y);
      ctx.fillStyle = h < 0 ? 'rgba(42,36,29,.38)' : h > 0.55 ? 'rgba(42,36,29,.3)' : h > 0.3 ? 'rgba(42,36,29,.14)' : 'rgba(42,36,29,.05)';
      ctx.fillRect(x - c / 2, y - c / 2, c + 0.5, c + 0.5);
    }
    ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.font = "700 11px 'Old Standard TT', serif";
    const tilesInView = (Math.floor(bx / TILE) - Math.floor(ax / TILE) + 1) * (Math.floor(by / TILE) - Math.floor(ay / TILE) + 1);
    if (tilesInView < 25_000) for (let tj = Math.floor(ay / TILE); tj <= Math.floor(by / TILE); tj++) for (let ti = Math.floor(ax / TILE); ti <= Math.floor(bx / TILE); ti++) {
      const b = knownSettlement(ti, tj);
      if (!b || !b.city || !isSeen(s, b.x, b.y)) continue;
      const [x, y] = screen(b.x, b.y);
      ctx.fillRect(x - 2, y - 2, 4, 4); ctx.fillText(b.name.toUpperCase(), x, y - 6);
    }
    // discovered wonders: a small star with their name
    ctx.font = "italic 11px 'IM Fell English', serif";
    for (const w of wondersNear(ax, ay, bx, by, 0)) {
      if (!s.named.includes('w' + w.key)) continue;
      const [x, y] = screen(w.x, w.y);
      ctx.beginPath();
      for (let k = 0; k < 10; k++) { const a = k * Math.PI / 5 - Math.PI / 2, r = k % 2 ? 2.2 : 5.5; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
      ctx.closePath(); ctx.fill();
      ctx.fillText(t(`wonder.${w.kind}.name`, { n: w.name }), x, y + 15);
    }
    const [ex, ey] = screen(s.x, s.y);
    ctx.beginPath(); ctx.arc(ex, ey, 5, 0, 6.3); ctx.lineWidth = 1.5; ctx.stroke();
    ctx.beginPath(); ctx.arc(ex, ey, 1.5, 0, 6.3); ctx.fill();
    ctx.font = "italic 13px 'IM Fell English', serif"; ctx.fillText(t('map.atlas'), v.W / 2, (v.top ?? 70) + 18);
    this.compass(v.W - 44, (v.top ?? 70) + 40);
    this.scaleBar(v);
  }

  private compass(x: number, y: number): void {
    const { ctx } = this;
    ctx.strokeStyle = INK; ctx.fillStyle = INK; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x, y, 22, 0, 6.3); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, 18, 0, 6.3); ctx.stroke();
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4 - Math.PI / 2, l = k % 2 ? 13 : 26;
      ctx.beginPath(); ctx.moveTo(x + l * Math.cos(a), y + l * Math.sin(a));
      ctx.lineTo(x + 4 * Math.cos(a + 0.7), y + 4 * Math.sin(a + 0.7)); ctx.lineTo(x + 4 * Math.cos(a - 0.7), y + 4 * Math.sin(a - 0.7)); ctx.closePath();
      if (k === 0) ctx.fill(); else ctx.stroke();
    }
    ctx.font = "11px 'IM Fell English SC', serif"; ctx.textAlign = 'center'; ctx.fillText(t('map.north'), x, y - 30);
  }

  private scaleBar(v: View): void {
    const { ctx } = this;
    const opts = [1, 2, 5, 10, 20, 50, 100, 200];
    const n = opts.reduce((b, o) => (Math.abs(o * LEAGUE * v.zoom - 90) < Math.abs(b * LEAGUE * v.zoom - 90) ? o : b));
    const L = n * LEAGUE * v.zoom, x = 14, y = v.H - 26;
    ctx.strokeStyle = INK; ctx.fillStyle = INK; ctx.lineWidth = 1;
    ctx.strokeRect(x, y - 2, L, 4); ctx.fillRect(x, y - 2, L / 4, 4); ctx.fillRect(x + L / 2, y - 2, L / 4, 4);
    ctx.font = "italic 12px 'IM Fell English', serif"; ctx.textAlign = 'left'; ctx.fillText(tn('map.scale', n, { n }), x, y - 7);
  }
}
