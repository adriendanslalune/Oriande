// The sky over the map, drawn by the overlay each frame in screen space: cloud shadows and
// clouds, rain, snow, blowing sand, fog, lightning, the warm light of dawn and dusk, the night,
// and lit windows in the towns at night.
import { airShift, weatherAt, sky, worldTime, type Weather } from '../world/weather';
import { CIRCUMFERENCE, wrapIndex } from '../world/planet';
import { townWindows } from './towns';
import { isGL } from './glPainter';
import { DPR } from '../ui/screen';
import { settlement } from '../world/settlements';
import { TILE } from '../world/terrain';
import { hash2 } from '../world/noise';
import type { View } from './overlay';

type Screen = (x: number, y: number) => [number, number];
type World = (x: number, y: number) => [number, number];

/** Weather is sampled on a coarse grid of the screen, refreshed a few times per second. */
const CELL_PX = 18;
const REFRESH_MS = 400;

interface Cloud { x: number; y: number; r: number; dark: number; puffs: [number, number, number][] }

export class WeatherLayer {
  /** the night, at a quarter of the screen's resolution, with the lights punched out of it */
  private readonly night = document.createElement('canvas');
  private readonly ng = this.night.getContext('2d')!;
  private grid: Weather[] = [];
  private gw = 0;
  private gh = 0;
  private last = -1e9;
  private origin: [number, number] = [0, 0];
  private zoom = 1;
  private flash = 0;
  private bolt: [number, number][] = [];
  /** the weather where the view is centred, for the HUD and the wind of the leaves */
  centre: Weather | null = null;

  /** Sample the weather over the view (world-anchored), and paint the cloud layer. */
  private refresh(v: View, world: World, now: number): void {
    this.last = now;
    const gw = Math.ceil(v.W / CELL_PX) + 3, gh = Math.ceil(v.H / CELL_PX) + 3;
    // anchor the grid to the world, so that clouds do not shimmer when the view moves
    const step = CELL_PX / v.zoom, [ax, ay] = world(0, 0);
    const ox = Math.floor(ax / step) * step - step, oy = Math.floor(ay / step) * step - step;
    this.grid = [];
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) this.grid.push(weatherAt(ox + i * step, oy + j * step));
    this.gw = gw; this.gh = gh; this.origin = [ox, oy]; this.zoom = v.zoom;
    this.centre = weatherAt(v.x, v.y);
  }

  private at(x: number, y: number): Weather | undefined {
    const step = CELL_PX / this.zoom, i = Math.round((x - this.origin[0]) / step), j = Math.round((y - this.origin[1]) / step);
    return i >= 0 && j >= 0 && i < this.gw && j < this.gh ? this.grid[j * this.gw + i] : undefined;
  }

  draw(ctx: CanvasRenderingContext2D, v: View, screen: Screen, world: World, now: number, dt: number, seen: (x: number, y: number) => boolean): void {
    if (now - this.last > REFRESH_MS || Math.abs(this.zoom - v.zoom) / v.zoom > 0.02) this.refresh(v, world, now);
    const t = now / 1000, step = CELL_PX / this.zoom;
    this.clouds = this.makeClouds(v, world, worldTime()); // the shared world clock, not the page's
    this.drawShadows(ctx, v, screen, seen);
    {

    // precipitation: drops placed on a fixed pseudo-random lattice of the screen, kept only
    // where it rains / snows / blows; all fall along the wind. Each kind is one batched path.
    const c = this.centre, wdx = c ? c.wind.dx : 0, sg = Math.sign(wdx || 1);
    const P = (): Path2D => (isGL(ctx) ? ctx.newPath() : new Path2D()) as unknown as Path2D;
    const rain = P(), snow = P(), sand = P();
    let any = false;
    const N = 20; // lattice pitch, px
    for (let gy = -1; gy < v.H / N + 1; gy++) for (let gx = -1; gx < v.W / N + 1; gx++) {
      const r1 = hash2(gx * 7 + 3, gy * 13 + 1), r2 = hash2(gx * 5 + 11, gy * 3 + 7);
      const px0 = gx * N + r1 * N, py0 = gy * N + r2 * N;
      const [PX, PY] = world(px0, py0), wp = this.at(PX, PY);
      if (!wp || (wp.intensity <= 0 && wp.kind !== 'sandstorm')) continue; // nothing falls near here
      // where this drop is now (it falls and drifts), and the weather right there
      if (wp.kind === 'rain' || wp.kind === 'storm') {
        const fall = (t * 420 + r2 * 900) % (v.H + 40), x = px0 + wdx * 8 * ((fall / 60) % 1), y = (py0 + fall) % (v.H + 40) - 20;
        const [X, Y] = world(x, y), w = this.at(X, Y);
        if (w && (w.kind === 'rain' || w.kind === 'storm') && r1 <= w.intensity + 0.15 && seen(X, Y)) { rain.moveTo(x, y); rain.lineTo(x + wdx * 3, y + 8); any = true; }
      } else if (wp.kind === 'snow') {
        const fall = (t * 40 + r2 * 900) % (v.H + 40), x = (((px0 + Math.sin(t * 1.5 + r1 * 9) * 4 + wdx * fall * 0.15) % v.W) + v.W) % v.W, y = (py0 + fall) % (v.H + 40) - 20;
        const [X, Y] = world(x, y), w = this.at(X, Y);
        if (w && w.kind === 'snow' && r1 <= w.intensity + 0.15 && seen(X, Y)) { const r = 1.1 + r2 * 0.8; snow.moveTo(x + r, y); snow.arc(x, y, r, 0, 6.3); any = true; }
      } else if (wp.kind === 'sandstorm' && seen(PX, PY)) {
        for (const lane of [0, 0.5]) { // pale streaks of flying sand, long and thin, unlike the dunes
          const run = (t * 170 + (r2 + lane) * 900) % (v.W + 60), x = wdx >= 0 ? (px0 + run) % (v.W + 60) - 30 : v.W + 30 - (px0 + run) % (v.W + 60), yy = py0 + lane * 7;
          sand.moveTo(x, yy); sand.quadraticCurveTo(x - sg * 14, yy - 2, x - sg * 30, yy + 1); any = true;
        }
      }
    }
    if (any) {
      ctx.save(); ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(70,90,110,.45)'; ctx.lineWidth = 0.7; ctx.stroke(rain);
      ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fill(snow); ctx.strokeStyle = 'rgba(120,130,140,.5)'; ctx.lineWidth = 0.3; ctx.stroke(snow);
      ctx.strokeStyle = 'rgba(252,240,210,.75)'; ctx.lineWidth = 0.9; ctx.stroke(sand);
      ctx.restore();
    }
    }

    // sand haze and fog: washes over the area concerned (sampled on the coarse grid)
    for (let j = 0; j < this.gh; j++) for (let i = 0; i < this.gw; i++) {
      const w = this.grid[j * this.gw + i];
      const a = w.kind === 'sandstorm' ? 0.3 + w.intensity * 0.4 : w.fog * 0.55;
      if (a < 0.02) continue;
      const [x, y] = screen(this.origin[0] + i * step, this.origin[1] + j * step), R = CELL_PX * 1.2;
      const g = ctx.createRadialGradient(x, y, 0, x, y, R);
      const col = w.kind === 'sandstorm' ? '206,160,96' : '244,242,236';
      g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = g; ctx.fillRect(x - R, y - R, R * 2, R * 2);
    }

    // lightning in storms: now and then a bolt and a flash
    const storm = this.grid.findIndex((w) => w.kind === 'storm');
    this.flash = Math.max(0, this.flash - dt * 4);
    if (storm >= 0 && this.flash === 0 && Math.random() < dt / 5) {
      const [x, y] = screen(this.origin[0] + (storm % this.gw) * step, this.origin[1] + Math.floor(storm / this.gw) * step);
      this.bolt = [[x, y - 120]];
      for (let k = 1; k <= 7; k++) this.bolt.push([x + (Math.random() - 0.5) * 30, y - 120 + k * 17]);
      this.flash = 1;
    }
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,255,250,${this.flash * 0.22})`; ctx.fillRect(0, 0, v.W, v.H);
      if (this.flash > 0.5) {
        ctx.strokeStyle = `rgba(255,255,240,${this.flash})`; ctx.lineWidth = 1.6; ctx.beginPath();
        this.bolt.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
      }
    }

    // the warm light of dawn and dusk (the night itself is painted by paintNight)
    const light = sky(v.x);
    if (light.glow > 0) { ctx.fillStyle = `rgba(255,150,70,${light.glow * 0.14})`; ctx.fillRect(0, 0, v.W, v.H); }
  }

  /**
   * Little clouds drawn in clean lines, as in the French comics of the 70s: puffy tops, a flat
   * base, a pale shaded underside; their shadows drift over the ground. Each cloud lives in the
   * air, which moves with the wind: everyone sees the same clouds at the same moment.
   */
  private clouds: Cloud[] = [];
  private readonly layer = document.createElement('canvas');
  private readonly lg = this.layer.getContext('2d')!;

  private makeClouds(v: View, world: World, t: number): Cloud[] {
    if (v.zoom < 0.22) return []; // in the atlas, no clouds
    const CS = 200, N = CIRCUMFERENCE / CS, [ax, ay] = world(0, 0), [bx, by] = world(v.W, v.H);
    const clouds: Cloud[] = [];
    for (let aj = Math.floor(ay / CS) - 1; aj <= Math.floor(by / CS) + 2; aj++) {
      const shift = airShift(aj * CS, t);
      for (let ai = Math.floor((ax - shift) / CS) - 1; ai <= Math.floor((bx - shift) / CS) + 1; ai++) {
        const wa = wrapIndex(ai, N), h = (k: number): number => hash2(wa * 17 + k * 31, aj * 29 + k * 7);
        const x = ai * CS + shift + (h(1) - 0.5) * CS * 0.8, y = aj * CS + (h(2) - 0.5) * CS * 0.8;
        const w = weatherAt(x, y, t);
        if (h(3) > (w.cloud - 0.35) * 1.25) continue;
        const r = 11 + w.cloud * 17 + h(4) * 10, n = 3 + Math.floor(h(5) * 3);
        const puffs: [number, number, number][] = [];
        for (let k = 0; k < n; k++) {
          const u = n === 1 ? 0 : k / (n - 1) - 0.5, hump = 1 - Math.abs(u) * 1.4;
          puffs.push([u * r * 1.5 + (h(10 + k) - 0.5) * r * 0.2, -hump * r * 0.35 - h(20 + k) * r * 0.1, r * (0.32 + hump * 0.28 + h(30 + k) * 0.1)]);
        }
        const dark = w.kind === 'storm' ? 0.45 : w.kind === 'rain' || w.kind === 'snow' ? 0.22 : 0;
        clouds.push({ x, y, r, dark, puffs });
      }
    }
    return clouds;
  }

  /** The outline of a cloud on screen (puffs and flat base), shifted by (dx, dy) world units. */
  private path(c: Cloud, v: View, screen: Screen, dx: number, dy: number): Path2D {
    const [sx, sy] = screen(c.x + dx, c.y + dy);
    return cloudPath(c, v.zoom, sx, sy);
  }

  /** The clouds' shadows on the ground, cast to the south-east: seen at every zoom. */
  private drawShadows(ctx: CanvasRenderingContext2D, v: View, screen: Screen, seen: (x: number, y: number) => boolean): void {
    if (isGL(ctx)) { // on the GPU: each shadow is a picture, drawn once
      for (const c of this.clouds) {
        if (!seen(c.x + 18, c.y + 30)) continue;
        const [sx, sy] = screen(c.x + 18, c.y + 30);
        this.lay(ctx, this.picture(c, v.zoom, true, 0), sx, sy, v.zoom, 1);
      }
      return;
    }
    ctx.save();
    ctx.fillStyle = 'rgba(40,40,60,.13)';
    for (const c of this.clouds) if (seen(c.x + 18, c.y + 30)) ctx.fill(this.path(c, v, screen, 18, 30));
    ctx.restore();
  }

  /** Cloud and shadow pictures for the GPU, by shape, zoom step and darkness of the night. */
  private readonly pictures = new Map<string, { canvas: HTMLCanvasElement; R: number; zb: number }>();
  private picture(c: Cloud, z: number, shadow: boolean, night: number): { canvas: HTMLCanvasElement; R: number; zb: number } {
    const zb = Math.max(0.05, Math.round(z * 20) / 20), nb = Math.round(night * 10) / 10, k = DPR;
    const key = (shadow ? 's' : 'c' + nb + c.dark) + '|' + zb + '|' + c.r.toFixed(1) + c.puffs.map((p) => p.map((n) => n.toFixed(1)).join(',')).join(';');
    let pic = this.pictures.get(key);
    if (!pic) {
      if (this.pictures.size > 300) this.pictures.clear();
      const R = c.r * 2.2, canvas = document.createElement('canvas');
      canvas.width = canvas.height = Math.max(2, Math.ceil(R * 2 * zb * k));
      const g = canvas.getContext('2d')!;
      g.scale(k, k);
      const o = R * zb;
      if (shadow) { g.fillStyle = 'rgba(40,40,60,.13)'; g.fill(cloudPath(c, zb, o, o)); }
      else paintCloud(g, c, zb, o, o, nb);
      pic = { canvas, R, zb };
      this.pictures.set(key, pic);
    }
    return pic;
  }

  /** Lay a cloud picture down centred on (sx, sy), at zoom z. */
  private lay(ctx: CanvasRenderingContext2D, pic: { canvas: HTMLCanvasElement; R: number }, sx: number, sy: number, z: number, alpha: number): void {
    const size = pic.R * 2 * z;
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.drawImage(pic.canvas, sx - pic.R * z, sy - pic.R * z, size, size);
    ctx.restore();
  }

  /**
   * The clouds themselves, above everything on the ground, the explorer included. Seen from close
   * up we are under them: they fade in only as the view zooms out. At night they take the blue
   * of the sky.
   */
  drawClouds(ctx: CanvasRenderingContext2D, v: View, screen: Screen, seen: (x: number, y: number) => boolean): void {
    const fade = Math.max(0, Math.min(1, (1.2 - v.zoom) / 0.4)); // none at zoom 1.2+ (the default is 1.3), full at 0.8-
    if (fade <= 0 || !this.clouds.length) return;
    const z = v.zoom, night = sky(v.x).darkness;
    if (isGL(ctx)) { // on the GPU: each cloud is a picture, drawn once (its own outlines never show through)
      for (const c of this.clouds) {
        if (!seen(c.x, c.y)) continue;
        const [sx, sy] = screen(c.x, c.y);
        this.lay(ctx, this.picture(c, z, false, night), sx, sy, z, fade);
      }
      return;
    }
    // while fading, draw them opaque on a layer, then lay the layer down at once: otherwise the
    // inner outlines would show through
    const out = ctx;
    if (fade < 1) {
      if (this.layer.width !== out.canvas.width || this.layer.height !== out.canvas.height) { this.layer.width = out.canvas.width; this.layer.height = out.canvas.height; }
      this.lg.setTransform(out.getTransform()); this.lg.clearRect(0, 0, v.W, v.H);
      ctx = this.lg;
    }
    ctx.save();
    for (const c of this.clouds) {
      if (!seen(c.x, c.y)) continue;
      const [sx, sy] = screen(c.x, c.y);
      paintCloud(ctx, c, z, sx, sy, night);
    }
    ctx.restore();
    if (fade < 1) {
      out.save(); out.setTransform(1, 0, 0, 1, 0, 0); out.globalAlpha = fade; out.drawImage(this.layer, 0, 0); out.restore();
    }
  }

  /** The lights of the night, in screen space: [x, y, radius, kind (0 torch, 1 window)]. */
  lights(v: View, screen: Screen, world: World, seen: (x: number, y: number) => boolean, explorer: [number, number], now: number): [number, number, number, number][] {
    const d = sky(v.x).darkness, out: [number, number, number, number][] = [];
    if (d < 0.12) return out;
    const t = now / 1000, z = v.zoom;
    const [ex, ey] = screen(explorer[0], explorer[1]);
    out.push([ex, ey - 22 * z / 1.3, (62 + Math.sin(t * 11) * 2 + Math.sin(t * 17) * 1.5) * z, 0]);
    const [ax, ay] = world(0, 0), [bx, by] = world(v.W, v.H);
    for (let tj = Math.floor(ay / TILE) - 1; tj <= Math.floor(by / TILE) + 1; tj++) for (let ti = Math.floor(ax / TILE) - 1; ti <= Math.floor(bx / TILE) + 1; ti++) {
      const b = settlement(ti, tj);
      if (!b || !seen(b.x, b.y)) continue;
      (townWindows.get(b.rkey) ?? []).forEach(([dx, dy, w], k) => {
        if (hash2(b.wi * 13 + k, b.tj + Math.floor(t / 20 + k * 0.37)) < 0.18) return; // some windows go dark
        const [x, y] = screen(b.x + dx, b.y + dy);
        out.push([x, y, w * 0.32 * z, 1]);
      });
    }
    return out;
  }

  /**
   * The night: a deep blue veil, at a quarter of the screen's resolution, with the lights
   * punched out of it, painted into the overlay's fog canvas (`g`, `scale` times smaller).
   */
  paintNight(g: CanvasRenderingContext2D, v: View, scale: number, lights: [number, number, number, number][]): void {
    const d = sky(v.x).darkness;
    if (d <= 0) return;
    const W = Math.ceil(v.W / scale), H = Math.ceil(v.H / scale);
    if (this.night.width !== W || this.night.height !== H) { this.night.width = W; this.night.height = H; }
    const ng = this.ng;
    ng.globalCompositeOperation = 'source-over'; ng.clearRect(0, 0, W, H);
    ng.fillStyle = `rgba(14,30,78,${d * 0.66})`; ng.fillRect(0, 0, W, H);
    ng.globalCompositeOperation = 'destination-out';
    for (const [x, y, r, kind] of lights) {
      const R = (kind ? r * 9 : r) / scale, gr = ng.createRadialGradient(x / scale, y / scale, 0, x / scale, y / scale, R);
      gr.addColorStop(0, `rgba(0,0,0,${kind ? 0.55 : 0.92})`); gr.addColorStop(kind ? 1 : 0.7, `rgba(0,0,0,${kind ? 0 : 0.35})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      ng.fillStyle = gr; ng.fillRect(x / scale - R, y / scale - R, R * 2, R * 2);
    }
    ng.globalCompositeOperation = 'source-over';
    g.drawImage(this.night, 0, 0);
  }

  /** Over the night: the warm glow of the torch, and the lit windows. */
  drawLights(ctx: CanvasRenderingContext2D, v: View, lights: [number, number, number, number][]): void {
    const d = sky(v.x).darkness;
    if (d < 0.12) return;
    for (const [x, y, r, kind] of lights) {
      if (kind === 0) {
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(255,196,96,${0.32 * d})`); g.addColorStop(0.5, `rgba(255,170,70,${0.14 * d})`); g.addColorStop(1, 'rgba(255,160,60,0)');
        ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
      } else {
        const g = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
        g.addColorStop(0, `rgba(255,210,120,${0.35 * d})`); g.addColorStop(1, 'rgba(255,200,110,0)');
        ctx.fillStyle = g; ctx.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);
        ctx.fillStyle = `rgba(255,228,150,${d})`; ctx.fillRect(x - r * 0.5, y - r * 0.6, r, r * 1.2); // the window pane
      }
    }
  }
}

/** The outline of a cloud (puffs and flat base) around (sx, sy), at zoom z. */
function cloudPath(c: Cloud, z: number, sx: number, sy: number): Path2D {
  const p = new Path2D();
  for (const [px, py, pr] of c.puffs) { p.moveTo(sx + (px + pr) * z, sy + py * z); p.arc(sx + px * z, sy + py * z, pr * z, 0, Math.PI * 2); }
  const xs = c.puffs.map(([px, , pr]) => [px - pr * 0.8, px + pr * 0.8]).flat();
  p.rect(sx + Math.min(...xs) * z, sy - c.r * 0.05 * z, (Math.max(...xs) - Math.min(...xs)) * z, c.r * 0.28 * z);
  return p;
}

/** One cloud in clean lines: ink outline (strokes first, then fills hide the inner ones), flat base, shading. */
function paintCloud(ctx: CanvasRenderingContext2D, c: Cloud, z: number, sx: number, sy: number, night: number): void {
  const tint = (col: number[]): string => col.map((n, k) => Math.round(n + ([30, 48, 100][k] - n) * night * 0.7)).join(',');
  const p = cloudPath(c, z, sx, sy), base = sy + c.r * 0.23 * z;
  ctx.save();
  ctx.strokeStyle = `rgba(${tint([70, 74, 92])},.75)`; ctx.lineWidth = Math.max(0.8, 1.1 * z); ctx.stroke(p);
  const shade = 252 - c.dark * 120;
  ctx.fillStyle = `rgba(${tint([shade, shade, shade + 2 - c.dark * 10])},.95)`; ctx.fill(p);
  ctx.clip(p); // a pale blue-grey underside
  ctx.fillStyle = `rgba(${tint([170 - c.dark * 60, 182 - c.dark * 60, 204 - c.dark * 60])},.55)`;
  ctx.fillRect(sx - c.r * 2 * z, base - c.r * 0.22 * z, c.r * 4 * z, c.r * 0.5 * z);
  ctx.strokeStyle = 'rgba(70,74,92,.35)'; ctx.lineWidth = 0.6; // a couple of curls on the puffs
  for (const [px, py, pr] of c.puffs.slice(1, -1)) { ctx.beginPath(); ctx.arc(sx + px * z, sy + py * z + pr * 0.15 * z, pr * 0.55 * z, Math.PI * 1.1, Math.PI * 1.6); ctx.stroke(); }
  ctx.restore();
}
