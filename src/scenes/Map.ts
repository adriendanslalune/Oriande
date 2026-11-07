import Phaser from 'phaser';
import { num, t, tn } from '../i18n';
import { TILE } from '../world/terrain';
import { newGame, advance, startJourney, leaguesLeft, type TravelEvent } from '../game/travel';
import type { GameState } from '../game/state';
import { drawTile, type TileArt } from '../render/tiles';
import { Overlay, Z_ATLAS, type View } from '../render/overlay';
import { Hud } from '../ui/hud';
import { DPR } from '../ui/screen';

const ZMIN = 0.03, ZMAX = 3, ZSTART = 1.3;
/** Tile textures kept in memory (at least; more if the screen needs it). */
const CACHE_MIN = 90;
/** New tiles drawn per frame, to keep the frame rate when the view jumps. */
const NEW_TILES_PER_FRAME = 2;

interface CachedTile { art: TileArt; image: Phaser.GameObjects.Image; texture: string }

/** The world map: tiles as Phaser textures under a screen-space overlay. */
export class MapScene extends Phaser.Scene {
  private state!: GameState;
  /** camera centre (world) and zoom (CSS px per world unit) */
  private view!: View;
  private follow = true;
  private readonly tiles = new Map<string, CachedTile>();
  private tileLayer!: Phaser.GameObjects.Layer;
  private overlay!: Overlay;
  private overlayTexture!: Phaser.Textures.CanvasTexture;
  private hud!: Hud;
  private hudTimer = 0;
  // gestures
  private readonly fingers = new Map<number, [number, number]>();
  private pinchStart = 0;
  private pinchZoom = 0;
  private moved = 0;

  constructor() {
    super('Map');
  }

  create(): void {
    this.state = newGame();
    const W = this.scale.width / DPR, H = this.scale.height / DPR;
    this.view = { x: this.state.x, y: this.state.y, zoom: ZSTART, W, H };

    this.tileLayer = this.add.layer();
    this.overlayTexture = this.textures.createCanvas('overlay', this.scale.width, this.scale.height)!;
    this.overlay = new Overlay(this.overlayTexture.context);
    this.overlay.resize(W, H);
    this.add.image(0, 0, 'overlay').setOrigin(0, 0);
    // The camera never moves or zooms: tiles are placed in screen space each frame, snapped to
    // whole pixels like the proto, so neighbouring semi-transparent tiles meet without seams.

    this.hud = new Hud({
      zoomIn: () => this.setZoom(this.view.zoom * 1.6),
      zoomOut: () => this.setZoom(this.view.zoom / 1.6),
      center: () => { this.follow = true; if (this.view.zoom < Z_ATLAS) this.view.zoom = ZSTART; },
    });
    this.game.canvas.setAttribute('aria-label', t('ui.map'));
    this.setupInput();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
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
    this.view.zoom = Math.max(ZMIN, Math.min(ZMAX, z));
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
    else if (e.type === 'landmark') this.hud.showNote(t(`landmark.${e.landmark.kind}.name`, { n: e.landmark.name }), t(`landmark.${e.landmark.kind}.text`));
    else {
      const b = e.settlement;
      this.hud.showNote(b.city ? t('town.city.title', { n: b.name }) : b.name, t(b.city ? 'town.city.text' : 'town.village.text'));
    }
  }

  /** Make sure the visible tiles exist as textures; hide the others. Returns the visible tiles' art. */
  private syncTiles(): TileArt[] {
    const v = this.view, visible: TileArt[] = [];
    const atlas = v.zoom < Z_ATLAS;
    this.tileLayer.setVisible(!atlas);
    for (const c of this.tiles.values()) c.image.setVisible(false);
    if (atlas) return visible;
    const ax = v.x - v.W / 2 / v.zoom, ay = v.y - v.H / 2 / v.zoom, bx = v.x + v.W / 2 / v.zoom, by = v.y + v.H / 2 / v.zoom;
    const sx = (x: number): number => Math.round((v.W / 2 + (x - v.x) * v.zoom) * DPR);
    const sy = (y: number): number => Math.round((v.H / 2 + (y - v.y) * v.zoom) * DPR);
    let created = 0, count = 0;
    for (let tj = Math.floor(ay / TILE); tj <= Math.floor(by / TILE); tj++) for (let ti = Math.floor(ax / TILE); ti <= Math.floor(bx / TILE); ti++) {
      count++;
      const key = ti + ',' + tj;
      let c = this.tiles.get(key);
      if (c) this.tiles.delete(key); // re-insert: Map order is the LRU order
      else {
        if (created >= NEW_TILES_PER_FRAME) continue;
        created++;
        const art = drawTile(ti, tj), texture = 'tile:' + key;
        this.textures.addCanvas(texture, art.canvas);
        const image = this.add.image(0, 0, texture).setOrigin(0, 0);
        this.tileLayer.add(image);
        c = { art, image, texture };
      }
      this.tiles.set(key, c);
      const x0 = sx(ti * TILE), y0 = sy(tj * TILE);
      c.image.setVisible(true).setPosition(x0, y0).setDisplaySize(sx((ti + 1) * TILE) - x0, sy((tj + 1) * TILE) - y0);
      visible.push(c.art);
    }
    const max = Math.max(CACHE_MIN, count + 12);
    while (this.tiles.size > max) {
      const [key, c] = this.tiles.entries().next().value!;
      this.tiles.delete(key);
      c.image.destroy();
      this.textures.remove(c.texture);
    }
    return visible;
  }

  update(time: number, delta: number): void {
    const dt = Math.min(0.05, delta / 1000), s = this.state, v = this.view;
    const events: TravelEvent[] = [];
    const walking = advance(s, dt, events);
    for (const e of events) this.onEvent(e);
    if (this.follow) { v.x += (s.x - v.x) * 0.08; v.y += (s.y - v.y) * 0.08; }

    const visible = this.syncTiles();

    this.overlayTexture.context.setTransform(DPR, 0, 0, DPR, 0, 0);
    this.overlay.draw(s, v, visible, walking, time, dt);
    this.overlayTexture.refresh();

    this.hudTimer -= delta;
    if (this.hudTimer <= 0) {
      this.hudTimer = 250;
      const n = s.named.length;
      this.hud.setCounters(
        tn('hud.leagues', s.leagues, { n: num(s.leagues, 2) }),
        n ? tn('hud.places', n, { n, cells: num(s.seen.size) }) : t('hud.places.none'),
        s.journey ? t('hud.eta', { n: num(leaguesLeft(s), 1) }) : '',
      );
    }
  }
}
