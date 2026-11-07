// Everything drawn on top of the tiles each frame, in screen space (CSS pixels): footsteps,
// fog, life (waves, leaves, smoke, travellers, birds), names, explorer, compass, scale, and the
// atlas overview. Ported from the proto's dessiner()/animer()/apercuGeneral().
import { hash2 } from '../world/noise';
import { TILE, altitude } from '../world/terrain';
import { settlement, knownSettlement } from '../world/settlements';
import { roadsAround, pointOnRoad } from '../world/roads';
import { landmark } from '../world/landmarks';
import { SEA_CELL, seaLabel } from '../world/names';
import { CELL, LEAGUE, isSeen } from '../game/travel';
import type { GameState } from '../game/state';
import { t, tn } from '../i18n';
import type { TileArt } from './tiles';
import { INK, PAPER } from './palette';

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
}

interface Leaf { x: number; y: number; life: number; ph: number; r: number }

export class Overlay {
  private readonly fog = document.createElement('canvas');
  private readonly fg = this.fog.getContext('2d')!;
  private leaves: Leaf[] = [];
  /** the explorer faces the way they last walked: 1 = east, -1 = west */
  private facing = 1;
  private leafTimer = 0;
  /** altitude of each seen fog cell, for the atlas */
  private readonly atlasCache = new Map<string, number>();

  constructor(private readonly ctx: CanvasRenderingContext2D) {}

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

    // The explorer's footsteps.
    ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.setLineDash([1.5, 4]); ctx.beginPath();
    s.trace.forEach(([X, Y], k) => { const [x, y] = screen(X, Y); if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
    const [ex, ey] = screen(s.x, s.y);
    ctx.lineTo(ex, ey); ctx.stroke(); ctx.setLineDash([]);

    this.animate(s, v, screen, world, tiles, now, dt);

    // The fog: paper everywhere, holes punched (at quarter resolution) where the explorer has seen.
    const fg = this.fg, fog = this.fog;
    fg.globalCompositeOperation = 'source-over'; fg.clearRect(0, 0, fog.width, fog.height);
    fg.fillStyle = PAPER; fg.fillRect(0, 0, fog.width, fog.height); fg.globalCompositeOperation = 'destination-out';
    const ci0 = Math.floor(ax / CELL) - 1, ci1 = Math.ceil(bx / CELL) + 1, cj0 = Math.floor(ay / CELL) - 1, cj1 = Math.ceil(by / CELL) + 1, rr = CELL * v.zoom / 4 * 1.05;
    for (let cj = cj0; cj <= cj1; cj++) for (let ci = ci0; ci <= ci1; ci++) if (s.seen.has(ci + ',' + cj)) {
      const [sx, sy] = screen(ci * CELL, cj * CELL);
      const gr = fg.createRadialGradient(sx / 4, sy / 4, 0, sx / 4, sy / 4, rr);
      gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.6, 'rgba(0,0,0,.9)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      fg.fillStyle = gr; fg.fillRect(sx / 4 - rr, sy / 4 - rr, rr * 2, rr * 2);
    }
    ctx.imageSmoothingEnabled = true; ctx.drawImage(fog, 0, 0, v.W, v.H);
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
    for (let tj = tj0; tj <= tj1; tj++) for (let ti = ti0; ti <= ti1; ti++) {
      const b = settlement(ti, tj);
      if (!b || !isSeen(s, b.x, b.y)) continue;
      const [x, y] = screen(b.x, b.y);
      ctx.font = b.city ? '700 ' + Math.round(13 + v.zoom * 3) + "px 'Old Standard TT', serif" : 'italic ' + Math.round(11 + v.zoom * 2) + "px 'IM Fell English', serif";
      this.label(b.city ? b.name.toUpperCase() : b.name, x, y + (b.city ? 30 : 16) * Math.max(0.7, v.zoom));
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

    // Where the explorer is heading.
    const j = s.journey;
    if (j) {
      const [tx, ty] = screen(j.x1, j.y1);
      ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.beginPath();
      ctx.moveTo(tx - 5, ty - 5); ctx.lineTo(tx + 5, ty + 5); ctx.moveTo(tx + 5, ty - 5); ctx.lineTo(tx - 5, ty + 5); ctx.stroke();
    }
    if (j && Math.abs(j.x1 - j.x0) > 1) this.facing = j.x1 > j.x0 ? 1 : -1;
    this.explorer(ex, ey, walking, now);
    this.compass(v.W - 44, 96);
    this.scaleBar(v);
  }

  /** Waves, leaves, chimney smoke, travellers on the roads, a flight of birds now and then. */
  private animate(s: GameState, v: View, screen: (x: number, y: number) => [number, number], world: (x: number, y: number) => [number, number], tiles: TileArt[], now: number, dt: number): void {
    const { ctx } = this;
    ctx.strokeStyle = INK; ctx.fillStyle = INK;
    const time = now / 1000;
    ctx.lineWidth = 0.8;
    for (const tl of tiles) for (const [X, Y, ph] of tl.waves) {
      if (!isSeen(s, X, Y)) continue;
      const a = Math.sin(time * 1.3 + ph);
      if (a < 0) continue;
      const [x, y] = screen(X + Math.sin(time * 0.7 + ph) * 3, Y), w = 4 * v.zoom;
      ctx.globalAlpha = a; ctx.beginPath(); ctx.arc(x - w, y, w, 0.2, Math.PI - 0.2); ctx.arc(x + w, y, w, 0.2, Math.PI - 0.2); ctx.stroke();
    }
    ctx.globalAlpha = 1;

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
      f.life += dt; f.x += (14 + Math.sin(time * 2 + f.ph) * 8) * dt; f.y += (6 + Math.cos(time * 3 + f.ph) * 10) * dt; f.r += dt * 4;
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
    for (const { p, q, c } of roadsAround(Math.floor(v.x / TILE), Math.floor(v.y / TILE), Math.ceil(Math.max(v.W, v.H) / v.zoom / TILE / 2) + 1)) {
      const L = Math.hypot(q.x - p.x, q.y - p.y), nb = 1 + Math.floor(hash2(p.ti + q.ti, p.tj - q.tj) * 2);
      for (let k = 0; k < nb; k++) {
        const sp = 10 / L, ph = hash2(p.ti * 3 + k, q.tj * 7 - k), w = ((time * sp + ph) % 2 + 2) % 2, u = w < 1 ? w : 2 - w, pt = pointOnRoad(p, q, c, u);
        if (!isSeen(s, pt.x, pt.y)) continue;
        const [x, y] = screen(pt.x, pt.y);
        if (x < -20 || y < -20 || x > v.W + 20 || y > v.H + 20) continue;
        this.traveller(x, y, time * 6 + k, Math.min(v.zoom, 1.6));
      }
    }

    const flight = Math.floor(time / 14), pv = (time % 14) / 14;
    if (hash2(flight, 3) < 0.6) {
      const a0 = hash2(flight, 1) * 6.28, cx = v.x - Math.cos(a0) * 500 + Math.cos(a0) * 1000 * pv, cy = v.y - Math.sin(a0) * 500 + Math.sin(a0) * 1000 * pv;
      ctx.lineWidth = 0.9;
      for (let k = 0; k < 5; k++) {
        const [x, y] = screen(cx - Math.cos(a0) * k * 10 + Math.sin(a0) * (k % 2 ? 6 : -6) * k * 0.5, cy - Math.sin(a0) * k * 10 - Math.cos(a0) * (k % 2 ? 6 : -6) * k * 0.5), b = Math.sin(time * 9 + k) * 2;
        ctx.beginPath(); ctx.moveTo(x - 4, y - b); ctx.quadraticCurveTo(x - 2, y - 2, x, y); ctx.quadraticCurveTo(x + 2, y - 2, x + 4, y - b); ctx.stroke();
      }
    }
  }

  private traveller(x: number, y: number, step: number, s: number): void {
    const { ctx } = this;
    ctx.lineWidth = 0.9;
    const j = Math.sin(step) * 1.6 * s;
    ctx.beginPath(); ctx.arc(x, y - 6 * s, 1.3 * s, 0, 6.3); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x, y - 5 * s); ctx.lineTo(x, y - 2 * s); ctx.lineTo(x - j, y + 1 * s); ctx.moveTo(x, y - 2 * s); ctx.lineTo(x + j, y + 1 * s); ctx.stroke();
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
  private explorer(x: number, y: number, walking: boolean, now: number): void {
    const { ctx } = this;
    const u = 1.7, f = this.facing;
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
    // staff, held ahead, and the arm holding it
    const sx = X(3.6) + j * 0.3 * f;
    ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgb(90,62,38)';
    ctx.beginPath(); ctx.moveTo(sx, Y(-16)); ctx.lineTo(sx + j * 0.15, y + 0.5); ctx.stroke();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(X(1.2), Y(-12)); ctx.lineTo(sx, Y(-9.5)); ctx.stroke();
    // head
    ctx.lineWidth = 0.9; ctx.fillStyle = 'rgb(230,200,165)';
    ctx.beginPath(); ctx.arc(X(0.2), Y(-15), 1.7 * u, 0, 6.3); ctx.fill(); ctx.stroke();
    // wide-brimmed hat
    ctx.fillStyle = 'rgb(84,62,42)';
    ctx.beginPath(); ctx.ellipse(X(0.2), Y(-16.4), 3.6 * u, 0.75 * u, 0, 0, 6.3); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(X(-1.5), Y(-16.5)); ctx.lineTo(X(-1.3), Y(-19)); ctx.quadraticCurveTo(X(0.2), Y(-19.8), X(1.7), Y(-19)); ctx.lineTo(X(1.9), Y(-16.5)); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  /** Overview of everything discovered, small, like an atlas page. */
  private atlas(s: GameState, v: View, screen: (x: number, y: number) => [number, number], ax: number, ay: number, bx: number, by: number): void {
    const { ctx } = this;
    const c = Math.max(1, CELL * v.zoom);
    for (const k of s.seen) {
      const [ci, cj] = k.split(',').map(Number), X = ci * CELL, Y = cj * CELL;
      if (X < ax - CELL || X > bx + CELL || Y < ay - CELL || Y > by + CELL) continue;
      let h = this.atlasCache.get(k);
      if (h === undefined) { h = altitude(X, Y); this.atlasCache.set(k, h); }
      const [x, y] = screen(X, Y);
      ctx.fillStyle = h < 0 ? 'rgba(42,36,29,.38)' : h > 0.55 ? 'rgba(42,36,29,.3)' : h > 0.3 ? 'rgba(42,36,29,.14)' : 'rgba(42,36,29,.05)';
      ctx.fillRect(x - c / 2, y - c / 2, c + 0.5, c + 0.5);
    }
    ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.beginPath();
    s.trace.forEach(([X, Y], k) => { const [x, y] = screen(X, Y); if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
    ctx.stroke();
    ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.font = "700 11px 'Old Standard TT', serif";
    for (let tj = Math.floor(ay / TILE); tj <= Math.floor(by / TILE); tj++) for (let ti = Math.floor(ax / TILE); ti <= Math.floor(bx / TILE); ti++) {
      const b = knownSettlement(ti, tj);
      if (!b || !b.city || !isSeen(s, b.x, b.y)) continue;
      const [x, y] = screen(b.x, b.y);
      ctx.fillRect(x - 2, y - 2, 4, 4); ctx.fillText(b.name.toUpperCase(), x, y - 6);
    }
    const [ex, ey] = screen(s.x, s.y);
    ctx.beginPath(); ctx.arc(ex, ey, 5, 0, 6.3); ctx.lineWidth = 1.5; ctx.stroke();
    ctx.beginPath(); ctx.arc(ex, ey, 1.5, 0, 6.3); ctx.fill();
    ctx.font = "italic 13px 'IM Fell English', serif"; ctx.fillText(t('map.atlas'), v.W / 2, 84);
    this.compass(v.W - 44, 96);
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
