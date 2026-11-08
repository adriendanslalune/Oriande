// The sky over the map, drawn by the overlay each frame in screen space: cloud shadows and
// clouds, rain, snow, blowing sand, fog, lightning, the warm light of dawn and dusk, the night,
// and lit windows in the towns at night.
import { cloudCover, weatherAt, sky, type Weather } from '../world/weather';
import { settlement } from '../world/settlements';
import { TILE } from '../world/terrain';
import { hash2 } from '../world/noise';
import type { View } from './overlay';

type Screen = (x: number, y: number) => [number, number];
type World = (x: number, y: number) => [number, number];

/** Weather is sampled on a coarse grid of the screen, refreshed a few times per second. */
const CELL_PX = 18;
const REFRESH_MS = 400;

export class WeatherLayer {
  private readonly clouds = document.createElement('canvas');
  private readonly cg = this.clouds.getContext('2d')!;
  /** the part of the cloud image holding clouds: [x, y, w, h, fineness], or none */
  private cloudBox: [number, number, number, number, number] | null = null;
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
    // the cloud layer, three times finer than the weather grid: soft, rounded clouds; darker
    // under rain and storms
    const F = 3, fw = gw * F, fh = gh * F;
    const darkOf = (w: Weather): number => (w.kind === 'storm' ? 0.5 : w.kind === 'rain' || w.kind === 'snow' ? 0.25 : 0);
    const darkAt = (gx: number, gy: number): number => {
      const i0 = Math.max(0, Math.min(gw - 1, Math.floor(gx))), j0 = Math.max(0, Math.min(gh - 1, Math.floor(gy)));
      const i1 = Math.min(gw - 1, i0 + 1), j1 = Math.min(gh - 1, j0 + 1), fx = Math.max(0, Math.min(1, gx - i0)), fy = Math.max(0, Math.min(1, gy - j0));
      const d = (i: number, j: number): number => darkOf(this.grid[j * gw + i]);
      return (d(i0, j0) * (1 - fx) + d(i1, j0) * fx) * (1 - fy) + (d(i0, j1) * (1 - fx) + d(i1, j1) * fx) * fy;
    };
    this.clouds.width = fw; this.clouds.height = fh;
    const img = this.cg.createImageData(fw, fh);
    for (let j = 0; j < fh; j++) for (let i = 0; i < fw; i++) {
      const w = this.grid[Math.min(gh - 1, Math.floor(j / F)) * gw + Math.min(gw - 1, Math.floor(i / F))];
      const cover = cloudCover(ox + (i / F) * step, oy + (j / F) * step) * (w.cloud / Math.max(0.01, cloudCover(ox + Math.floor(i / F) * step, oy + Math.floor(j / F) * step)) || 0);
      const dark = darkAt(i / F - 0.5, j / F - 0.5); // smooth between grid cells: no blocks
      const a = Math.max(0, Math.min(1, (cover - 0.5) / 0.4)), k = (j * fw + i) * 4;
      img.data[k] = 252 - dark * 110; img.data[k + 1] = 251 - dark * 105; img.data[k + 2] = 248 - dark * 90;
      img.data[k + 3] = Math.round(a * (70 + dark * 60));
    }
    // the shadow, cast a little to the south-east, is composited into the same image (one draw
    // per frame instead of two), and only the part holding clouds is kept
    const ox2 = Math.round((10 / CELL_PX) * F), oy2 = Math.round((14 / CELL_PX) * F);
    const out = this.cg.createImageData(fw, fh);
    let x0 = fw, y0 = fh, x1 = -1, y1 = -1;
    for (let j = 0; j < fh; j++) for (let i = 0; i < fw; i++) {
      const k = (j * fw + i) * 4, si = i - ox2, sj = j - oy2;
      const sa = si >= 0 && sj >= 0 ? (img.data[(sj * fw + si) * 4 + 3] / 255) * 0.18 : 0, ca = img.data[k + 3] / 255;
      const a = ca + sa * (1 - ca);
      if (a < 0.004) continue;
      out.data[k] = (img.data[k] * ca + 40 * sa * (1 - ca)) / a;
      out.data[k + 1] = (img.data[k + 1] * ca + 36 * sa * (1 - ca)) / a;
      out.data[k + 2] = (img.data[k + 2] * ca + 30 * sa * (1 - ca)) / a;
      out.data[k + 3] = a * 255;
      if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j;
    }
    this.cg.putImageData(out, 0, 0);
    this.cloudBox = x1 < 0 ? null : [x0, y0, x1 - x0 + 1, y1 - y0 + 1, F];
  }

  /**
   * Paint the clouds (and their shadows) into a canvas `scale` times smaller than the screen:
   * the overlay paints them into its fog canvas, behind the paper of unexplored lands, so the
   * whole lot costs one full-screen draw.
   */
  paintClouds(g: CanvasRenderingContext2D, v: View, screen: Screen, scale: number): void {
    if (!this.cloudBox || !this.gw) return;
    const step = CELL_PX / this.zoom, [sx, sy] = screen(this.origin[0], this.origin[1]);
    const [bx, by, bw, bh, F] = this.cloudBox, px = (step * v.zoom) / F;
    g.imageSmoothingEnabled = true;
    g.drawImage(this.clouds, bx, by, bw, bh, (sx + bx * px) / scale, (sy + by * px) / scale, (bw * px) / scale, (bh * px) / scale);
  }

  private at(x: number, y: number): Weather | undefined {
    const step = CELL_PX / this.zoom, i = Math.round((x - this.origin[0]) / step), j = Math.round((y - this.origin[1]) / step);
    return i >= 0 && j >= 0 && i < this.gw && j < this.gh ? this.grid[j * this.gw + i] : undefined;
  }

  draw(ctx: CanvasRenderingContext2D, v: View, screen: Screen, world: World, now: number, dt: number, seen: (x: number, y: number) => boolean): void {
    if (now - this.last > REFRESH_MS || Math.abs(this.zoom - v.zoom) / v.zoom > 0.02) this.refresh(v, world, now);
    const t = now / 1000, step = CELL_PX / this.zoom;
    // (the clouds are painted by paintClouds, into the overlay's fog canvas)
    {

    // precipitation: drops placed on a fixed pseudo-random lattice of the screen, kept only
    // where it rains / snows / blows; all fall along the wind. Each kind is one batched path.
    const c = this.centre, wdx = c ? c.wind.dx : 0, sg = Math.sign(wdx || 1);
    const rain = new Path2D(), snow = new Path2D(), sand = new Path2D();
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

    // the hour: warm light at dawn and dusk, then the night, with lit towns
    const light = sky(v.x);
    if (light.glow > 0) { ctx.fillStyle = `rgba(255,150,70,${light.glow * 0.14})`; ctx.fillRect(0, 0, v.W, v.H); }
    if (light.darkness > 0) {
      ctx.fillStyle = `rgba(16,24,52,${light.darkness * 0.5})`; ctx.fillRect(0, 0, v.W, v.H);
      const [ax, ay] = world(0, 0), [bx, by] = world(v.W, v.H);
      for (let tj = Math.floor(ay / TILE) - 1; tj <= Math.floor(by / TILE) + 1; tj++) for (let ti = Math.floor(ax / TILE) - 1; ti <= Math.floor(bx / TILE) + 1; ti++) {
        const b = settlement(ti, tj);
        if (!b || !seen(b.x, b.y)) continue;
        const [x, y] = screen(b.x, b.y), R = (b.city ? 34 : 14) * v.zoom;
        const g = ctx.createRadialGradient(x, y, 0, x, y, R);
        g.addColorStop(0, `rgba(255,210,120,${light.darkness * 0.55})`); g.addColorStop(1, 'rgba(255,190,90,0)');
        ctx.fillStyle = g; ctx.fillRect(x - R, y - R, R * 2, R * 2);
        ctx.fillStyle = `rgba(255,226,150,${light.darkness * 0.9})`; // a few lit windows
        const n = b.city ? 12 : 4;
        for (let k = 0; k < n; k++) {
          if ((Math.floor(t / 3 + k) * 7 + k) % 9 === 0) continue; // a window goes dark now and then
          const a = hash2(b.wi * 5 + k, b.tj * 3) * 6.28, d = hash2(b.wi + k * 3, b.tj * 7) * R * 0.6;
          ctx.fillRect(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8, 1.4, 1.4);
        }
      }
    }
  }
}
