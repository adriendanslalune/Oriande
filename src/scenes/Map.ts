import Phaser from 'phaser';
import { num, t, tn } from '../i18n';
import { TILE } from '../world/terrain';
import { newGame, advance, startJourney, wrapPosition, LEAGUE, START_ZOOM, type TravelEvent } from '../game/travel';
import { pathLength, planRoute, prefetchWays } from '../game/route';
import { CONTACT, HUNT_RUN, ITEMS, REGROUP, beastsNear, end, hunt, stepFight, type Beast } from '../game/combat';
import { SLEEP_FOOD, canCook, canSleepByFire, cook, eat, sleepByFire, stepHunger } from '../game/survival';
import { campLit } from '../game/camp';
import { isSeen } from '../game/travel';
import { FISH_REACH, HARVEST_REACH, RECIPES, canCraft, castFrom, craft, fishable, has, startWork, stepWork, weaponOf } from '../game/craft';
import { resourceAt } from '../world/resources';
import { iconOfResource } from '../ui/icons';
import { Sheet, type RecipeCard, type Slot } from '../ui/sheet';
import { buy, goods, kindOf, rumor, sell, sellable, sleep, townAt, weaponDamage } from '../game/town';
import type { Settlement } from '../world/settlements';
import { settlement } from '../world/settlements';
import { landmark } from '../world/landmarks';
import { wondersNear } from '../world/wonders';
import { monumentsNear } from '../world/monuments';
import { latitude, longitude } from '../world/planet';
import { prefetchRivers } from '../world/rivers';
import { sky, weatherAt, worldTime } from '../world/weather';
import { loadGame, saveGame } from '../game/save';
import type { GameState } from '../game/state';
import type { TileArt } from '../render/tiles';
import { TileSource, type ReadyTile } from '../render/tileSource';
import { Overlay, Z_ATLAS, type View } from '../render/overlay';
import { GLPainter } from '../render/glPainter';
import { Hud } from '../ui/hud';
import { DPR, DPR_FORCED, setDPR } from '../ui/screen';

const ZMIN = 0.008, ZMAX = 3; // the atlas can show ~1,300 leagues across: a planet needs it
/** Autosave period while playing, ms. The game is also saved whenever the page is hidden. */
const SAVE_EVERY = 2500;
/** Memory for tile pictures, bytes (more if the screen needs it). */
const TILE_BUDGET = 72 * 1024 * 1024;
/** Tile resolutions, pixels per world unit: the map uses the smallest that is sharp enough. */
const LEVELS = [0.5, 1, 2];
/** Tiles shrunk on this thread per frame when zooming out (cheap, but not free). */
const SHRINKS_PER_FRAME = 4;
/** How long a new tile takes to fade in, ms. */
const FADE_MS = 220;

interface CachedTile {
  art: Omit<TileArt, 'canvas'>;
  image: Phaser.GameObjects.Image;
  texture: string;
  source: HTMLCanvasElement | ImageBitmap;
  res: number;
  born: number;
}

const tileBytes = (res: number): number => (TILE * res) ** 2 * 4;
let textureSerial = 0;

/** "49°42′ N · 4°18′ O": degrees and minutes, with the compass letters of the language. */
function formatCoords(lat: number, lon: number): string {
  const dm = (a: number): string => { const m = Math.round(Math.abs(a) * 60); return `${Math.floor(m / 60)}°${String(m % 60).padStart(2, '0')}′`; };
  return t('hud.coords', {
    lat: dm(lat), ns: t(lat >= 0 ? 'dir.n' : 'dir.s'),
    lon: dm(lon), ew: t(lon >= 0 ? 'dir.e' : 'dir.w'),
  });
}

/** "vent d'ouest": where the wind blows from, in eight directions. */
function windName(w: { dx: number; dy: number; speed: number }): string {
  if (w.speed < 2.5) return t('wind.calm');
  const from = Math.atan2(-w.dy, -w.dx); // the wind comes from the opposite of where it blows
  const dirs = ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'];
  return t('wind.from', { d: t('wind.' + dirs[((Math.round(from / (Math.PI / 4)) % 8) + 8) % 8]) });
}

/** The world map: tiles as Phaser textures under a screen-space overlay. */

export class MapScene extends Phaser.Scene {
  private state!: GameState;
  /** camera centre (world) and zoom (CSS px per world unit) */
  private view!: View;
  private follow = true;
  private readonly tiles = new Map<string, CachedTile>();
  private tileSource!: TileSource;
  /** ms until a hunting explorer's route is redrawn towards the prey */
  private chaseTimer = 0;
  /** frame times being measured, and how many measures in a row were too slow */
  private qualityFrames: number[] = [];
  private qualitySlow = 0;
  private qualityFrom = 0;
  private now = 0;
  private tileLayer!: Phaser.GameObjects.Layer;
  private overlay!: Overlay;
  private overlayTexture?: Phaser.Textures.CanvasTexture;
  /** the GPU painter of the overlay (WebGL), or none (canvas renderer) */
  private painter?: GLPainter;
  private hud!: Hud;
  private hudTimer = 0;
  private saveTimer = SAVE_EVERY;
  private riverTimer = 3000;
  // gestures
  private readonly fingers = new Map<number, [number, number]>();
  private pinchStart = 0;
  private pinchZoom = 0;
  private moved = 0;

  constructor() {
    super('Map');
  }

  create(): void {
    this.state = loadGame() ?? newGame();
    const W = this.scale.width / DPR, H = this.scale.height / DPR;
    this.view = { x: this.state.x, y: this.state.y, zoom: this.state.zoom, W, H };

    this.tileLayer = this.add.layer();
    this.tileSource = new TileSource((t) => this.tileReady(t));
    if (this.game.renderer.type === Phaser.WEBGL) {
      // the overlay drawn by the GPU, in its own layer above the tiles
      this.painter = new GLPainter(this, this.add.layer(), DPR);
      this.overlay = new Overlay(this.painter as unknown as CanvasRenderingContext2D);
    } else {
      this.overlayTexture = this.textures.createCanvas('overlay', this.scale.width, this.scale.height)!;
      this.overlay = new Overlay(this.overlayTexture.context);
    }
    this.overlay.resize(W, H);
    this.add.image(0, 0, 'overlay').setOrigin(0, 0);
    // The camera never moves or zooms: tiles are placed in screen space each frame, snapped to
    // whole pixels like the proto, so neighbouring semi-transparent tiles meet without seams.

    this.hud = new Hud({
      zoomIn: () => this.setZoom(this.view.zoom * 1.6),
      zoomOut: () => this.setZoom(this.view.zoom / 1.6),
      center: () => { this.follow = true; if (this.view.zoom < Z_ATLAS) this.setZoom(START_ZOOM); },
      pack: () => this.openPack(),
      almanac: () => this.openAlmanac(),
    });
    this.sheet = new Sheet(() => { /* closed */ });
    this.game.canvas.setAttribute('aria-label', t('ui.map'));
    this.setupInput();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    // Phones kill background tabs without warning: save the moment the game is hidden.
    const saveNow = (): void => { saveGame(this.state); };
    const onVisibility = (): void => { if (document.visibilityState === 'hidden') saveNow(); };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', saveNow);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', saveNow);
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
      this.hud.destroy();
      this.sheet.destroy();
    });
  }

  private onResize(size: Phaser.Structs.Size): void {
    const w = size.width, h = size.height;
    this.view.W = w / DPR;
    this.view.H = h / DPR;
    this.cameras.main.setSize(w, h);
    this.overlayTexture?.setSize(w, h);
    this.overlay.resize(this.view.W, this.view.H);
  }

  private setZoom(z: number): void {
    this.view.zoom = this.state.zoom = Math.max(ZMIN, Math.min(ZMAX, z));
  }

  private setupInput(): void {
    const css = (p: Phaser.Input.Pointer): [number, number] => [p.x / DPR, p.y / DPR];
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.fingers.set(p.id, css(p));
      this.moved = 0;
      if (this.fingers.size === 2) {
        const [a, b] = [...this.fingers.values()];
        this.pinchStart = Math.hypot(a[0] - b[0], a[1] - b[1]);
        this.pinchZoom = this.view.zoom;
      }
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const before = this.fingers.get(p.id);
      if (!before) return;
      const now = css(p);
      this.fingers.set(p.id, now);
      if (this.fingers.size === 1) {
        const dx = now[0] - before[0], dy = now[1] - before[1];
        this.moved += Math.abs(dx) + Math.abs(dy);
        if (this.moved > 8) {
          this.follow = false;
          this.view.x -= dx / this.view.zoom;
          this.view.y -= dy / this.view.zoom;
        }
      } else if (this.fingers.size === 2 && this.pinchStart) {
        const [a, b] = [...this.fingers.values()];
        this.setZoom(this.pinchZoom * Math.hypot(a[0] - b[0], a[1] - b[1]) / this.pinchStart);
        this.moved = 99;
      }
    });
    const up = (p: Phaser.Input.Pointer): void => {
      const tap = this.fingers.size === 1 && this.fingers.has(p.id) && this.moved < 8;
      this.fingers.delete(p.id);
      if (this.fingers.size < 2) this.pinchStart = 0;
      if (tap && this.view.zoom >= Z_ATLAS) {
        const [sx, sy] = css(p), v = this.view, X = v.x + (sx - v.W / 2) / v.zoom, Y = v.y + (sy - v.H / 2) / v.zoom;
        // a right click walks (or hunts) at once; a tap or a left click asks first; a tap while
        // a menu of actions is open only closes it (the next one opens a new menu)
        if (p.button === 2) this.actNow(X, Y);
        else if (this.actAt) this.cancelPlan();
        else this.propose(X, Y);
      }
    };
    this.input.mouse?.disableContextMenu();
    // the keyboard, on a computer: Escape closes, I or S opens the pack, + and - zoom, Space centres
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape') { this.cancelPlan(); this.sheet.hide(); }
      else if (e.key === 'a' || e.key === 'A' || e.key === 'r' || e.key === 'R') this.openAlmanac();
      else if (e.key === 'i' || e.key === 'I' || e.key === 's' || e.key === 'S') this.openPack();
      else if (e.key === '+' || e.key === '=') this.setZoom(this.view.zoom * 1.25);
      else if (e.key === '-' || e.key === '_') this.setZoom(this.view.zoom / 1.25);
      else if (e.key === ' ') { this.follow = true; if (this.view.zoom < Z_ATLAS) this.setZoom(START_ZOOM); }
    });
    this.input.on('pointerup', up);
    this.input.on('pointerupoutside', up);
    this.input.on('wheel', (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => this.setZoom(this.view.zoom * (dy > 0 ? 0.88 : 1.13)));
  }

  /**
   * A tap on the map does not set off at once: it shows the way there and asks first
   * ("Walk to"), so that sliding or checking the map never sends the explorer off by mistake.
   */
  private propose(tx: number, ty: number): void {
    // a tap on an animal: hunt it (or, a dangerous one, attack it)
    const beast = this.beastAt(tx, ty, Math.max(10, 22 / this.view.zoom));
    if (beast) {
      const d = Math.hypot(beast.x - this.state.x, beast.y - this.state.y);
      this.overlay.plan = [[this.state.x, this.state.y], [beast.x, beast.y]];
      const verb = beast.species.danger >= 1 ? 'hunt.attack' : 'hunt.go';
      this.actions(beast.x, beast.y - beast.species.look.len * 0.6, [{ label: t(verb, { a: t('animal.' + beast.species.id) }), detail: tn('walk.leagues', d / LEAGUE, { n: num(d / LEAGUE, 1) }), go: () => this.goHunt(beast), icon: 'hunt' }]);
      return;
    }
    // a tap on (or near) a place already seen goes to that place, by its name
    const place = this.placeAt(tx, ty, Math.max(18, 26 / this.view.zoom));
    // a tap on the town the explorer is already in: go in
    const here = place?.town && townAt(this.state.x, this.state.y);
    if (place?.town && here && here.key === place.town.key && !this.state.fight) {
      const b = place.town;
      this.overlay.plan = null;
      this.actions(b.x, b.y, [{ label: t('town.enter', { n: b.name }), go: () => this.openTown(b), icon: 'enter' }]);
      return;
    }
    const x = place ? place.x : tx, y = place ? place.y : ty;
    const s = this.state, route = planRoute(s.x, s.y, x, y);
    const L = route ? pathLength(route.path) : 0;
    const water = !place && isSeen(s, tx, ty) && fishable(tx, ty);
    if ((!route || L < 1) && !water) { this.cancelPlan(); this.onEvent({ type: 'shore' }); return; }
    this.overlay.plan = route && L >= 1 ? route.path : null;
    const stop = !route || route.reached ? '' : ' · ' + t(route.blocked === 'mountain' ? 'walk.foot' : 'walk.shore');
    const detail = tn('walk.leagues', L / LEAGUE, { n: num(L / LEAGUE, 1) }) + stop;
    const walk = (): void => {
      this.cancelPlan();
      this.follow = true;
      // walking off during a hunt gives it up (walking away from a charging animal is fleeing)
      if (s.fight?.hunt) end(s, worldTime(), REGROUP);
      s.work = null;
      if (!startJourney(s, x, y)) this.onEvent({ type: 'shore' });
    };
    // the second action: gather what grows there, or fish in that water (with a rod)
    let alt: { label: string; detail: string; go: () => void; icon?: string } | undefined;
    const res = place || water || !isSeen(s, tx, ty) ? null : resourceAt(tx, ty);
    if (res && !s.fight) alt = {
      label: t('work.harvest', { r: t('item.' + res + '.name') }), detail: L >= 1 ? detail : '', icon: iconOfResource(res),
      go: () => {
        this.cancelPlan(); this.follow = true;
        startWork(s, 'harvest', tx, ty);
        if (Math.hypot(tx - s.x, ty - s.y) > HARVEST_REACH * 0.6) startJourney(s, tx, ty);
      },
    };
    if (water && !s.fight) {
      // fish from the nearest edge of that water on the way there, not round the far side
      const cast = castFrom(s.x, s.y, tx, ty);
      const here = cast && Math.hypot(cast.water[0] - s.x, cast.water[1] - s.y) <= FISH_REACH * 0.8;
      const way = cast && !here ? planRoute(s.x, s.y, cast.shore[0], cast.shore[1]) : null;
      const LF = way ? pathLength(way.path) : 0;
      if (cast && (here || LF >= 1)) {
        if (way) this.overlay.plan = way.path;
        alt = {
          icon: 'fish', label: t('work.fish'), detail: here ? '' : tn('walk.leagues', LF / LEAGUE, { n: num(LF / LEAGUE, 1) }) + (has(s, 'canne') ? '' : ' · ' + t('work.needRod')),
          go: () => {
            this.cancelPlan();
            if (!has(s, 'canne')) { this.hud.showNote(t('work.needRod'), t('work.needRod.text'), 6000); return; }
            this.follow = true;
            if (!here) startJourney(s, cast.shore[0], cast.shore[1]);
            startWork(s, 'fish', cast.water[0], cast.water[1]);
          },
        };
      }
    }
    if (L < 1 && !alt) { this.cancelPlan(); this.onEvent({ type: 'shore' }); return; }
    // the likely action first: gathering or fishing where something can be had, then walking there
    const items: { label: string; detail?: string; go: () => void; icon?: string }[] = [];
    if (alt) items.push(alt);
    if (L >= 1) items.push({ label: t('walk.go') + (place ? ' ' + place.name : ''), detail, go: walk, icon: place?.town ? 'enter' : 'walk' });
    this.actions(x, y, items);
  }

  /** Where the menu of actions points, on the map (it follows the map when it is dragged). */
  private actAt: [number, number] | null = null;

  /** Show the menu of actions beside world point (x, y). */
  private actions(x: number, y: number, items: { label: string; detail?: string; go: () => void; icon?: string }[]): void {
    this.actAt = [x, y];
    this.hud.showActions(items, () => this.cancelPlan());
    this.placeActions();
  }

  private placeActions(): void {
    if (!this.actAt) return;
    const v = this.view;
    this.hud.placeActions(v.W / 2 + (this.actAt[0] - v.x) * v.zoom, v.H / 2 + (this.actAt[1] - v.y) * v.zoom);
  }

  /**
   * A town's page (phase 1, step 5): an atlas page over the map. A village has an inn and a small
   * merchant; a city also a bigger merchant who pays better, a smith and a tavern.
   */
  private openTown(b: Settlement): void {
    this.actAt = null;
    const s = this.state, k = kindOf(b), name = (id: string): string => t('item.' + id + '.name');
    const ecus = (n: number): string => tn('town.ecus', n, { n });
    type Entry = { label: string; sub: string; use: (() => void) | null; head?: boolean; info?: boolean; icon?: string };
    const done = (): void => { saveGame(s); this.hud.setLife(s.hp, s.maxHp, s.gold, s.food); this.openTown(b); };
    const e: Entry[] = [];
    // the inn
    e.push({ label: t('town.inn'), sub: '', use: null, head: true });
    const tired = s.hp < s.maxHp, rich = s.gold >= k.inn;
    e.push({
      icon: 'sleep', label: t('town.sleep', { p: ecus(k.inn) }), sub: !tired ? t('town.sleep.full') : rich ? t('town.sleep.sub') : t('town.sleep.poor'),
      use: tired && rich ? () => { sleep(s, b); done(); this.hud.showNote(t('town.slept'), t('town.slept.text'), 3000); } : null,
    });
    // the merchant: buying, then selling
    e.push({ label: t('town.shop'), sub: '', use: null, head: true });
    for (const g of goods(s, b).filter((x) => !x.smith)) {
      const it = ITEMS.find((i) => i.id === g.id)!;
      e.push({
        icon: it.kind === 'food' ? 'food' : 'tools', label: t('town.buy', { a: name(g.id), p: ecus(g.price) }),
        sub: it.kind === 'food' ? t('town.buy.food', { n: it.heal, k: s.items[g.id] ?? 0 }) : t('item.' + g.id + '.text'),
        use: s.gold >= g.price ? () => { buy(s, b, g.id); done(); } : null,
      });
    }
    e.push({ label: t('town.sellHead'), sub: '', use: null, head: true });
    const wares = sellable(s, b);
    if (!wares.length) e.push({ label: '', sub: t('town.nothingToSell'), use: null, info: true });
    for (const w of wares) e.push({ icon: 'coin', label: t('town.sell', { a: name(w.id), n: w.n }), sub: t('town.sell.sub', { p: ecus(w.price) }), use: () => { sell(s, b, w.id); done(); } });
    // the smith, in a city
    const arms = goods(s, b).filter((x) => x.smith);
    if (k.forge.length) {
      e.push({ label: t('town.smith'), sub: '', use: null, head: true });
      if (!arms.length) e.push({ label: '', sub: t('town.smith.done'), use: null, info: true });
      for (const g of arms) {
        const [lo, hi] = weaponDamage(g.id) ?? [0, 0];
        e.push({ icon: 'hunt', label: t('town.buy', { a: name(g.id), p: ecus(g.price) }), sub: t('town.weapon.sub', { a: lo, b: hi }) + ' · ' + t('item.' + g.id + '.text'), use: s.gold >= g.price ? () => { buy(s, b, g.id); done(); } : null });
      }
    }
    // the tavern, in a city: what is being said tonight
    const r = rumor(b, worldTime());
    if (r) e.push({ label: t('town.tavern'), sub: '', use: null, head: true }, { label: '', sub: t('rumor.' + r), use: null, info: true, icon: 'rumor' });
    this.overlay.plan = null;
    this.hud.showPack(e, t(b.city ? 'town.page.city' : 'town.page.village', { n: b.name }) + ' · ' + t('town.purse', { hp: s.hp, max: s.maxHp, g: ecus(s.gold) }), '');
  }

  /** Go after this animal (hunt it, or attack it). */
  private goHunt(beast: Beast): void {
    this.cancelPlan();
    this.follow = true;
    this.state.work = null;
    if (this.state.fight?.hunt) end(this.state, worldTime(), REGROUP);
    if (!this.state.fight) hunt(this.state, beast);
    this.chaseTimer = 0;
  }

  /**
   * A right click (on a computer): no question asked. On an animal, go after it; anywhere else,
   * walk there at once (to a place by its name when one is clicked).
   */
  private actNow(tx: number, ty: number): void {
    const beast = this.beastAt(tx, ty, Math.max(10, 22 / this.view.zoom));
    if (beast) { this.goHunt(beast); return; }
    const place = this.placeAt(tx, ty, Math.max(18, 26 / this.view.zoom));
    const x = place ? place.x : tx, y = place ? place.y : ty, s = this.state;
    this.cancelPlan();
    this.follow = true;
    if (s.fight?.hunt) end(s, worldTime(), REGROUP);
    s.work = null;
    if (!startJourney(s, x, y)) this.onEvent({ type: 'shore' });
  }

  /** Work in hand this frame: gathering, fishing; what it gives. */
  private workStep(dt: number): void {
    const s = this.state, evs = stepWork(s, dt);
    // all a handful brings, on one slip: "+3 bois · +1 champignons"
    const got = evs.filter((e) => e.kind === 'gathered') as { res: string; n: number; x: number; y: number }[];
    if (got.length) this.overlay.float(got[0].x, got[0].y - 30, got.map((e) => t('work.gathered', { n: e.n, r: t('item.' + e.res + '.name').toLowerCase() })).join(' · '), 'loot');
    for (const e of evs) {
      if (e.kind === 'gathered' || e.kind === 'caught') this.hud.pulsePack();
      if (e.kind === 'begin' && e.work === 'fish') this.overlay.cast();
      else if (e.kind === 'gathered') { /* on the slip above */ }
      else if (e.kind === 'caught') { this.overlay.float(e.x, e.y - 10, t('work.caught'), 'loot'); this.overlay.catchFish(e.x, e.y); }
      else if (e.kind === 'nothing') this.overlay.float(s.x, s.y - 30, t('work.nothing'), 'you');
      else if (e.kind === 'tooFar') this.hud.showNote(t('work.tooFar'), t('work.tooFar.text'), 3000);
      saveGame(s);
    }
  }

  /** The pack and the almanac, as pages over the map. */
  private sheet!: Sheet;
  /** the thing tapped in the pack, whose card is shown */
  private sacSel: string | null = null;

  /**
   * The pack (asked by Adrien: clear compartments, things in slots with their picture and how many):
   * what the explorer carries in hand and wears, the tools made, then food and materials. Tapping a
   * slot shows its card below, with what can be done with it (eat, cook). Making things is the
   * almanac's (see openAlmanac). By a lit campfire, sleeping is offered at the top.
   */
  private openPack(sel = this.sacSel): void {
    this.actAt = null; this.cancelPlan();
    const s = this.state, now = worldTime(), name = (id: string): string => t('item.' + id + '.name');
    const again = (keep: string | null): void => { saveGame(s); this.hud.setLife(s.hp, s.maxHp, s.gold, s.food); this.openPack(keep && (s.items[keep] ?? 0) > 0 ? keep : null); };
    this.sacSel = sel;
    const slot = (id: string, worn = false): Slot => ({ id, name: name(id), count: s.items[id] ?? 0, worn });
    const owned = (kind: string) => ITEMS.filter((it) => it.kind === kind && (s.items[it.id] ?? 0) > 0).map((it) => it.id);
    // carried: the weapon in hand (the best one), the jacket, the torch; the other tools in the pack
    const weapon = weaponOf(s).id, worn = [weapon !== 'poings' ? weapon : '', has(s, 'veste') ? 'veste' : '', has(s, 'torche') ? 'torche' : ''].filter(Boolean);
    const tools = owned('tool').filter((id) => !worn.includes(id)); // a weapon not in hand stays in the pack
    const MAT_ORDER = ['bois', 'pierre', 'fibre', 'herbes', 'peau', 'os'];
    const mats = owned('material').sort((a, b) => MAT_ORDER.indexOf(a) - MAT_ORDER.indexOf(b));
    const fire = campLit(s, now) && Math.hypot(s.camp!.x - s.x, s.camp!.y - s.y) < 40;
    // the card of the thing tapped
    let detail: Parameters<Sheet['showSac']>[0]['detail'] = null;
    const it = sel ? ITEMS.find((i) => i.id === sel) : undefined;
    if (it && (s.items[it.id] ?? 0) > 0) {
      const lines: string[] = [], actions: { label: string; use: (() => void) | null }[] = [];
      if (it.kind === 'food') {
        lines.push(t('pack.eat.sub', { f: it.food ?? 0, h: it.heal }) + (it.sick ? t('pack.raw') : ''));
        actions.push({ label: t('sac.eat'), use: () => { const meal = eat(s, it.id); if (meal?.sick) this.hud.showNote(t('sick.title'), t('sick.text'), 5000); again(it.id); } });
        if (it.cooks) actions.push({ label: t('sac.cook', { b: name(it.cooks) }), use: canCook(s, it.id, now) ? () => { cook(s, it.id, now); this.overlay.float(s.x, s.y - 30, '+1 ' + name(it.cooks!).toLowerCase(), 'loot'); again(it.id); } : null });
        if (it.cooks && !fire) lines.push(t('sac.needFire'));
      } else if (it.kind === 'tool') lines.push(t('item.' + it.id + '.text'));
      else lines.push(t('sac.material'));
      detail = { id: it.id, name: name(it.id) + (s.items[it.id] > 1 && it.kind !== 'tool' ? ' × ' + s.items[it.id] : ''), lines, actions };
    }
    this.sheet.showSac({
      title: t('sac.title'), sub: t('sac.sub', { hp: s.hp, max: s.maxHp, f: Math.round(s.food), g: s.gold }),
      top: fire ? { title: t('pack.fire'), actions: [{ label: t('pack.sleep') + (canSleepByFire(s, now) ? ' · −' + SLEEP_FOOD + ' ' + t('hud.bellyLabel').toLowerCase() : ''), use: canSleepByFire(s, now) ? () => { sleepByFire(s, now); this.hud.showNote(t('fire.slept'), t('town.slept.text'), 3000); again(sel); } : null }] } : null,
      sections: [
        { title: t('sac.worn'), slots: worn.map((id) => slot(id, true)), empty: t('pack.fists') },
        { title: t('pack.tools'), slots: tools.map((id) => slot(id)), empty: t('sac.noTools') },
        { title: t('pack.food'), slots: owned('food').map((id) => slot(id)), empty: t('sac.noFood') },
        { title: t('pack.materials'), slots: mats.map((id) => slot(id)), empty: t('sac.noMats') },
      ],
      selected: sel,
      detail,
      select: (id) => this.openPack(id === sel ? null : id),
    });
  }

  /**
   * The almanac of recipes (asked by Adrien): everything that can be made, what it takes, what
   * the pack holds; what can be made now is shown plainly and made with a tap.
   */
  private openAlmanac(): void {
    this.actAt = null; this.cancelPlan();
    const s = this.state, now = worldTime(), name = (id: string): string => t('item.' + id + '.name');
    const cards: RecipeCard[] = RECIPES.map((r) => {
      const tool = ITEMS.find((i) => i.id === r.id)?.kind === 'tool';
      const state: RecipeCard['state'] = tool && has(s, r.id) ? 'done' : canCraft(s, r.id) ? 'ready' : 'missing';
      return {
        id: r.id, name: name(r.id), text: t('item.' + r.id + '.text'),
        needs: Object.entries(r.needs).map(([k, n]) => ({ id: k, name: name(k), have: s.items[k] ?? 0, need: n })),
        state,
        make: () => {
          craft(s, r.id, now); saveGame(s); this.hud.pulsePack();
          if (r.id === 'feu') { this.sheet.hide(); this.hud.showNote(t('fire.title'), t('fire.text'), 6000); return; }
          this.overlay.float(s.x, s.y - 30, '+1 ' + name(r.id).toLowerCase(), 'loot');
          this.openAlmanac();
        },
      };
    });
    const rank = { ready: 0, missing: 1, done: 2 };
    cards.sort((a, b) => rank[a.state] - rank[b.state]);
    const ready = cards.filter((c) => c.state === 'ready').length;
    this.sheet.showAlmanac(t('almanac.title'), ready ? tn('almanac.ready', ready, { n: ready }) : t('almanac.sub'), cards);
  }

  /** The animal under a tap, if any (only where the explorer has seen). */
  private beastAt(x: number, y: number, r: number): Beast | null {
    const s = this.state;
    if (this.view.zoom < 0.45) return null; // too small to make out
    let best: Beast | null = null, bd = r;
    for (const b of beastsNear(s, x, y, r + 20, worldTime())) {
      const d = Math.hypot(b.x - x, b.y - y - 4); // the tap lands on its body, a little above its feet
      if (d < bd && isSeen(s, b.x, b.y)) { bd = d; best = b; }
    }
    return best;
  }

  /** Dangers of the world this frame: charges, blows, kills, and what to show of them. */
  private fightStep(dt: number, delta: number): void {
    const s = this.state;
    const evs = stepFight(s, dt, worldTime());
    const f = s.fight;
    // a hunt: the explorer goes after the prey, the route redrawn as it moves
    this.chaseTimer -= delta;
    if (f?.hunt && this.chaseTimer <= 0) {
      this.chaseTimer = 400;
      const d = Math.hypot(f.x - s.x, f.y - s.y);
      if (d > CONTACT * 0.7) startJourney(s, f.x + (s.x - f.x) / d * CONTACT * 0.6, f.y + (s.y - f.y) / d * CONTACT * 0.6, HUNT_RUN);
      else s.journey = null;
    }
    for (const e of evs) {
      const name = (sp: string): string => t('animal.' + sp);
      if (e.kind === 'hit' || e.kind === 'miss') { this.overlay.blow(e.who, e.kind === 'hit'); this.overlay.float(e.x, e.y, e.kind === 'hit' ? '−' + e.damage : t('fight.miss'), e.who === 'foe' ? 'foe' : 'you'); }
      else if (e.kind === 'charge') { this.cancelPlan(); this.follow = true; this.hud.showNote(t('fight.charge.title', { a: name(e.species) }), t('fight.charge.text'), 5000); }
      else if (e.kind === 'killed') { this.hud.pulsePack(); this.overlay.spurt(e.x, e.y, 6, e.x >= s.x ? 1 : -1, 14); this.overlay.float(e.x, e.y - 22, t('fight.meat', { n: e.meat }) + (e.hide ? ' · ' + t('fight.spoils', { n: e.hide, a: t('item.peau.name').toLowerCase() }) : '') + (e.bone ? ' · ' + t('fight.spoils', { n: e.bone, a: t('item.os.name').toLowerCase() }) : ''), 'loot'); this.hud.showNote(t('fight.killed', { a: name(e.species) }), t('fight.killed.text', { n: e.meat }), 4000); }
      else if (e.kind === 'escaped') this.hud.showNote(t('fight.escaped', { a: name(e.species) }), '', 3000);
      else if (e.kind === 'gaveUp') this.hud.showNote(t('fight.gaveUp', { a: name(e.species) }), '', 3000);
      else if (e.kind === 'lost') { this.view.x = s.x; this.view.y = s.y; this.follow = true; this.hud.showNote(t('fight.wake.title'), t('fight.wake.text', { n: e.goldLost }), 8000); }
    }
    if (evs.length) saveGame(s);
  }

  /** The nearest place already seen within r of (x, y): a town, a strange place, a wonder. */
  private placeAt(x: number, y: number, r: number): { x: number; y: number; name: string; town?: Settlement } | null {
    const s = this.state;
    let best: { x: number; y: number; name: string; town?: Settlement } | null = null, bd = r;
    const consider = (px: number, py: number, name: () => string, town?: Settlement): void => {
      const d = Math.hypot(px - x, py - y);
      if (d < bd && isSeen(s, px, py)) { bd = d; best = { x: px, y: py, name: name(), town }; }
    };
    const ti = Math.floor(x / TILE), tj = Math.floor(y / TILE);
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const b = settlement(ti + di, tj + dj);
      if (b) consider(b.x, b.y, () => b.name, b);
      const L = landmark(ti + di, tj + dj);
      if (L) consider(L.x, L.y, () => t(`landmark.${L.kind}.name`, { n: L.name }));
    }
    for (const w of wondersNear(x - r, y - r, x + r, y + r, 40)) consider(w.x, w.y, () => t(`wonder.${w.kind}.name`, { n: w.name }));
    for (const m of monumentsNear(x - r, y - r, x + r, y + r, 40)) consider(m.x, m.y, () => t(`monument.${m.kind}.name`, { n: m.name }));
    return best;
  }

  private cancelPlan(): void {
    this.overlay.plan = null;
    this.actAt = null;
    this.hud.hideWalk();
  }

  private onEvent(e: TravelEvent): void {
    if (e.type === 'shore') this.hud.showNote(t('shore.title'), t('shore.text'));
    else if (e.type === 'wonder') this.hud.showNote(t('wonder.heading') + ' · ' + t(`wonder.${e.wonder.kind}.name`, { n: e.wonder.name }), t(`wonder.${e.wonder.kind}.text`), 14000, true);
    else if (e.type === 'monument') this.hud.showNote(t('monument.heading') + ' · ' + t(`monument.${e.monument.kind}.name`, { n: e.monument.name }), t(`monument.${e.monument.kind}.text`), 10000, true);
    else if (e.type === 'landmark') this.hud.showNote(t(`landmark.${e.landmark.kind}.name`, { n: e.landmark.name }), t(`landmark.${e.landmark.kind}.text`));
    else {
      const b = e.settlement;
      this.hud.showNote(b.city ? t('town.city.title', { n: b.name }) : b.name, t(b.city ? 'town.city.text' : 'town.village.text'));
    }
  }

  /**
   * Keep the game fluid on every device: when frames take too long (two measures in a row
   * under ~33 frames a second), draw at a lower resolution (2 → 1.5 → 1), a little softer but
   * much faster; the choice is remembered for the device. `?dpr=` in the address forces it.
   */
  private adaptQuality(time: number, delta: number): void {
    if (DPR_FORCED || DPR <= 1) return;
    if (!this.qualityFrom) this.qualityFrom = time + 4000; // let the map settle first
    if (time < this.qualityFrom || document.visibilityState !== 'visible' || delta > 250) return;
    this.qualityFrames.push(delta);
    if (this.qualityFrames.reduce((a, b) => a + b, 0) < 2000) return;
    const avg = this.qualityFrames.reduce((a, b) => a + b, 0) / this.qualityFrames.length;
    this.qualityFrames = [];
    this.qualitySlow = avg > 30 ? this.qualitySlow + 1 : 0;
    if (this.qualitySlow < 2) return;
    this.qualitySlow = 0;
    setDPR(DPR > 1.5 ? 1.5 : 1);
    this.game.scale.resize(window.innerWidth * DPR, window.innerHeight * DPR);
    this.game.scale.setZoom(1 / DPR);
    this.qualityFrom = time + 3000;
  }

  /** The sharpest-needed resolution for the current zoom. */
  private level(): number {
    const need = this.view.zoom * DPR;
    return LEVELS.find((l) => l >= need * 0.85) ?? LEVELS[LEVELS.length - 1];
  }

  /**
   * Tiles are 128, 256 or 512 pixels wide: powers of two, which Phaser's WebGL renderer sets to
   * REPEAT. Smoothed at its edges, a tile then blends in a little of its opposite edge: the faint
   * lines seen between tiles. Their edges are clamped instead.
   */
  private clampEdges(texture: string): void {
    const r = this.game.renderer;
    if (r.type !== Phaser.WEBGL) return;
    const gl = (r as Phaser.Renderer.WebGL.WebGLRenderer).gl;
    const w = this.textures.get(texture).source[0].glTexture as unknown as { webGLTexture: WebGLTexture | null; wrapS: number; wrapT: number } | null;
    if (!w?.webGLTexture) return;
    w.wrapS = w.wrapT = gl.CLAMP_TO_EDGE; // kept if the context is lost and rebuilt
    // as Phaser's own setTextureFilter does: on unit 0, then the texture bound there put back
    gl.activeTexture(gl.TEXTURE0);
    const current = gl.getParameter(gl.TEXTURE_BINDING_2D) as WebGLTexture | null;
    gl.bindTexture(gl.TEXTURE_2D, w.webGLTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (current) gl.bindTexture(gl.TEXTURE_2D, current);
  }

  /** Show a tile picture (new, sharper, or shrunk), as a Phaser texture without a pixel copy. */
  private putTile(key: string, source: HTMLCanvasElement | ImageBitmap, res: number, art: Omit<TileArt, 'canvas'>): void {
    const texture = 'tile:' + key + '#' + textureSerial++;
    this.textures.addImage(texture, source as unknown as HTMLImageElement);
    this.clampEdges(texture);
    const c = this.tiles.get(key);
    if (c) {
      const old = c.texture, oldSource = c.source;
      c.image.setTexture(texture);
      this.textures.remove(old);
      if (oldSource !== source && 'close' in oldSource) oldSource.close();
      Object.assign(c, { texture, source, res, art });
    } else {
      const image = this.add.image(0, 0, texture).setOrigin(0, 0).setAlpha(0);
      this.tileLayer.add(image);
      this.tiles.set(key, { art, image, texture, source, res, born: this.now });
    }
  }

  private tileReady(t: ReadyTile): void {
    const key = t.ti + ',' + t.tj, c = this.tiles.get(key);
    // keep what is there if it is already what the map wants, or sharper than this
    if (c && (c.res === this.level() || c.res >= t.res)) { if ('close' in t.image) t.image.close(); return; }
    this.putTile(key, t.image, t.res, t.art);
  }

  /** A smaller copy of a tile picture (halving steps, for a clean result). */
  private shrink(c: CachedTile, res: number): HTMLCanvasElement {
    let src: CanvasImageSource = c.source, size = TILE * c.res;
    let out!: HTMLCanvasElement;
    while (size > TILE * res) {
      size /= 2;
      out = document.createElement('canvas'); out.width = out.height = size;
      const g = out.getContext('2d')!; g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, size, size);
      src = out;
    }
    return out;
  }

  /**
   * Place the visible tiles; ask for the missing or blurry ones (nearest first, then a ring
   * around the view, ready before the map slides there); forget the least recently seen.
   * Returns the visible tiles' art.
   */
  private syncTiles(): TileArt[] {
    const v = this.view, visible: TileArt[] = [];
    const atlas = v.zoom < Z_ATLAS;
    this.tileLayer.setVisible(!atlas);
    for (const c of this.tiles.values()) c.image.setVisible(false);
    if (atlas) return visible;
    const want = this.level();
    const ax = v.x - v.W / 2 / v.zoom, ay = v.y - v.H / 2 / v.zoom, bx = v.x + v.W / 2 / v.zoom, by = v.y + v.H / 2 / v.zoom;
    const sx = (x: number): number => Math.round((v.W / 2 + (x - v.x) * v.zoom) * DPR);
    const sy = (y: number): number => Math.round((v.H / 2 + (y - v.y) * v.zoom) * DPR);
    const ti0 = Math.floor(ax / TILE), ti1 = Math.floor(bx / TILE), tj0 = Math.floor(ay / TILE), tj1 = Math.floor(by / TILE);
    const jobs: { ti: number; tj: number; res: number; d: number }[] = [];
    let shrinks = 0, bytes = 0;
    for (let tj = tj0; tj <= tj1; tj++) for (let ti = ti0; ti <= ti1; ti++) {
      const key = ti + ',' + tj, c = this.tiles.get(key);
      const d = Math.hypot((ti + 0.5) * TILE - v.x, (tj + 0.5) * TILE - v.y);
      if (!c) { jobs.push({ ti, tj, res: want, d }); continue; }
      this.tiles.delete(key); this.tiles.set(key, c); // Map order is the LRU order
      if (c.res < want) jobs.push({ ti, tj, res: want, d });
      else if (c.res > want && shrinks < SHRINKS_PER_FRAME) { shrinks++; this.putTile(key, this.shrink(c, want), want, c.art); }
      const x0 = sx(ti * TILE), y0 = sy(tj * TILE);
      c.image.setVisible(true).setPosition(x0, y0).setDisplaySize(sx((ti + 1) * TILE) - x0, sy((tj + 1) * TILE) - y0)
        .setAlpha(Math.min(1, (this.now - c.born) / FADE_MS));
      bytes += tileBytes(c.res);
      visible.push(c.art as TileArt);
    }
    jobs.sort((p, q) => p.d - q.d);
    // the ring around the view, ready before the map slides there
    for (let tj = tj0 - 1; tj <= tj1 + 1; tj++) for (let ti = ti0 - 1; ti <= ti1 + 1; ti++) {
      if (tj >= tj0 && tj <= tj1 && ti >= ti0 && ti <= ti1) continue;
      const c = this.tiles.get(ti + ',' + tj);
      if (!c || c.res < want) jobs.push({ ti, tj, res: want, d: 0 });
    }
    this.tileSource.want(jobs);
    // forget the least recently seen tiles beyond the memory budget (never the visible ones)
    let total = 0;
    for (const c of this.tiles.values()) total += tileBytes(c.res);
    const budget = Math.max(TILE_BUDGET, bytes * 1.3);
    for (const [key, c] of this.tiles) {
      if (total <= budget || c.image.visible) break;
      total -= tileBytes(c.res);
      this.tiles.delete(key);
      c.image.destroy();
      this.textures.remove(c.texture);
      if ('close' in c.source) c.source.close();
    }
    return visible;
  }

  update(time: number, delta: number): void {
    const dt = Math.min(0.05, delta / 1000), s = this.state, v = this.view;
    this.now = time;
    const events: TravelEvent[] = [];
    const walking = advance(s, dt, events);
    this.fightStep(dt, delta);
    this.workStep(dt);
    for (const e of stepHunger(s, dt, walking)) {
      if (e.kind === 'hungry') this.hud.showNote(t('hunger.title'), t('hunger.text'), 6000);
      else if (e.kind === 'starving') this.overlay.float(s.x, s.y - 30, '−1', 'foe');
      else { this.view.x = s.x; this.view.y = s.y; this.follow = true; this.hud.showNote(t('hunger.fainted.title'), t('hunger.fainted.text', { n: e.goldLost }), 8000); saveGame(s); }
    }
    // a walk that ends in a town: its page opens
    if (walking && !s.journey && !s.fight && !s.work) { const b = townAt(s.x, s.y); if (b) this.openTown(b); }
    // crossing longitude 180°: the explorer comes back around the planet, the view follows
    v.x += wrapPosition(s);
    for (const e of events) this.onEvent(e);
    // rivers ahead: one more cell computed now and then, so they are ready before we get there
    this.riverTimer -= delta;
    if (this.riverTimer <= 0) { this.riverTimer = 1500; if (!prefetchRivers(s.x, s.y)) prefetchWays(s.x, s.y); }
    this.saveTimer -= delta;
    // Save on a timer, and right away when a walk ends or something was discovered.
    if (this.saveTimer <= 0 || events.length || (walking && !s.journey)) {
      this.saveTimer = SAVE_EVERY;
      saveGame(s);
    }
    if (this.follow) { v.x += (s.x - v.x) * 0.08; v.y += (s.y - v.y) * 0.08; }
    this.placeActions();

    this.adaptQuality(time, delta);
    const visible = this.syncTiles();
    if (this.painter) {
      this.painter.setBase(DPR);
      this.painter.begin();
      this.overlay.draw(s, v, visible, walking, time, dt);
    } else {
      this.overlayTexture!.context.setTransform(DPR, 0, 0, DPR, 0, 0);
      this.overlay.draw(s, v, visible, walking, time, dt);
      this.overlayTexture!.refresh();
    }

    this.hudTimer -= delta;
    if (this.hudTimer <= 0) {
      this.hudTimer = 250;
      v.top = this.hud.headerHeight();
      this.hud.setCoords(formatCoords(latitude(s.y), longitude(s.x)));
      // the weather where the explorer stands, the local hour and the sun over the horizon
      const w = weatherAt(s.x, s.y), light = sky(s.x);
      this.hud.setSky([t(`weather.${w.kind}`), w.kind === 'clear' && light.phase === 'night' ? '' : windName(w.wind)].filter(Boolean).join(' · '));
      const minutes = Math.floor(light.hour * 60);
      this.hud.setLife(s.hp, s.maxHp, s.gold, s.food);
      this.hud.setTime(t('hud.time', { h: Math.floor(minutes / 60), m: String(minutes % 60).padStart(2, '0') }), t(`sky.${light.phase}`));
      this.hud.setDial(light.hour, w.kind, light.darkness, light.glow);
    }
  }
}
