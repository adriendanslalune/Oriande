import Phaser from 'phaser';
import { num, t, tn } from '../i18n';
import { TILE } from '../world/terrain';
import { newGame, advance, startJourney, leaguesLeft, wrapPosition, START_ZOOM, type TravelEvent } from '../game/travel';
import { latitude, longitude } from '../world/planet';
import { prefetchRivers } from '../world/rivers';
import { sky, weatherAt } from '../world/weather';
import { loadGame, saveGame } from '../game/save';
import type { GameState } from '../game/state';
import type { TileArt } from '../render/tiles';
import { TileSource, type ReadyTile } from '../render/tileSource';
import { Overlay, Z_ATLAS, type View } from '../render/overlay';
import { Hud } from '../ui/hud';
import { DPR } from '../ui/screen';

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
  private now = 0;
  private tileLayer!: Phaser.GameObjects.Layer;
  private overlay!: Overlay;
  private overlayTexture!: Phaser.Textures.CanvasTexture;
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
    this.overlayTexture = this.textures.createCanvas('overlay', this.scale.width, this.scale.height)!;
    this.overlay = new Overlay(this.overlayTexture.context);
    this.overlay.resize(W, H);
    this.add.image(0, 0, 'overlay').setOrigin(0, 0);
    // The camera never moves or zooms: tiles are placed in screen space each frame, snapped to
    // whole pixels like the proto, so neighbouring semi-transparent tiles meet without seams.

    this.hud = new Hud({
      zoomIn: () => this.setZoom(this.view.zoom * 1.6),
      zoomOut: () => this.setZoom(this.view.zoom / 1.6),
      center: () => { this.follow = true; if (this.view.zoom < Z_ATLAS) this.setZoom(START_ZOOM); },
    });
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
    });
  }

  private onResize(size: Phaser.Structs.Size): void {
    const w = size.width, h = size.height;
    this.view.W = w / DPR;
    this.view.H = h / DPR;
    this.cameras.main.setSize(w, h);
    this.overlayTexture.setSize(w, h);
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
        const [sx, sy] = css(p), v = this.view;
        this.follow = true;
        this.hud.hideNote();
        if (!startJourney(this.state, v.x + (sx - v.W / 2) / v.zoom, v.y + (sy - v.H / 2) / v.zoom)) this.onEvent({ type: 'shore' });
      }
    };
    this.input.on('pointerup', up);
    this.input.on('pointerupoutside', up);
    this.input.on('wheel', (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => this.setZoom(this.view.zoom * (dy > 0 ? 0.88 : 1.13)));
  }

  private onEvent(e: TravelEvent): void {
    if (e.type === 'shore') this.hud.showNote(t('shore.title'), t('shore.text'));
    else if (e.type === 'wonder') this.hud.showNote(t('wonder.heading') + ' · ' + t(`wonder.${e.wonder.kind}.name`, { n: e.wonder.name }), t(`wonder.${e.wonder.kind}.text`), 14000, true);
    else if (e.type === 'landmark') this.hud.showNote(t(`landmark.${e.landmark.kind}.name`, { n: e.landmark.name }), t(`landmark.${e.landmark.kind}.text`));
    else {
      const b = e.settlement;
      this.hud.showNote(b.city ? t('town.city.title', { n: b.name }) : b.name, t(b.city ? 'town.city.text' : 'town.village.text'));
    }
  }

  /** The sharpest-needed resolution for the current zoom. */
  private level(): number {
    const need = this.view.zoom * DPR;
    return LEVELS.find((l) => l >= need * 0.85) ?? LEVELS[LEVELS.length - 1];
  }

  /** Show a tile picture (new, sharper, or shrunk), as a Phaser texture without a pixel copy. */
  private putTile(key: string, source: HTMLCanvasElement | ImageBitmap, res: number, art: Omit<TileArt, 'canvas'>): void {
    const texture = 'tile:' + key + '#' + textureSerial++;
    this.textures.addImage(texture, source as unknown as HTMLImageElement);
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
    // crossing longitude 180°: the explorer comes back around the planet, the view follows
    v.x += wrapPosition(s);
    for (const e of events) this.onEvent(e);
    // rivers ahead: one more cell computed now and then, so they are ready before we get there
    this.riverTimer -= delta;
    if (this.riverTimer <= 0) { this.riverTimer = 1500; prefetchRivers(s.x, s.y); }
    this.saveTimer -= delta;
    // Save on a timer, and right away when a walk ends or something was discovered.
    if (this.saveTimer <= 0 || events.length || (walking && !s.journey)) {
      this.saveTimer = SAVE_EVERY;
      saveGame(s);
    }
    if (this.follow) { v.x += (s.x - v.x) * 0.08; v.y += (s.y - v.y) * 0.08; }

    const visible = this.syncTiles();

    this.overlayTexture.context.setTransform(DPR, 0, 0, DPR, 0, 0);
    this.overlay.draw(s, v, visible, walking, time, dt);
    this.overlayTexture.refresh();

    this.hudTimer -= delta;
    if (this.hudTimer <= 0) {
      this.hudTimer = 250;
      v.top = this.hud.headerHeight();
      const n = s.named.length;
      this.hud.setCoords(formatCoords(latitude(s.y), longitude(s.x)));
      const w = weatherAt(s.x, s.y), light = sky(s.x);
      this.hud.setSky([t(`weather.${w.kind}`), w.kind === 'clear' && light.phase === 'night' ? '' : windName(w.wind), t(`sky.${light.phase}`)].filter(Boolean).join(' · '));
      this.hud.setCounters(
        tn('hud.leagues', s.leagues, { n: num(s.leagues, 2) }),
        n ? tn('hud.places', n, { n, cells: num(s.seen.size) }) : t('hud.places.none'),
        s.journey ? t('hud.eta', { n: num(leaguesLeft(s), 1) }) : '',
      );
    }
  }
}
