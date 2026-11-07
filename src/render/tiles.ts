// Engraved map tiles: watercolour wash, sea hatching, coastline, relief hatching, vegetation,
// strange places, roads and houses. Verbatim port of the proto's tuile(); a tile is drawn once
// on a canvas and then cached as a Phaser texture by the Map scene.
import { hash2 } from '../world/noise';
import { TILE, altitude, humidity, strangeness } from '../world/terrain';
import { settlement, type Settlement } from '../world/settlements';
import { roadsAround } from '../world/roads';
import { landmark } from '../world/landmarks';
import { drawLandmarkIcon } from './icons';
import { INK, PAPER } from './palette';

/** Pixels per world unit in a tile texture. */
export const TILE_RES = 2;
/** Altitude sampling step, world units. */
const STEP = 4;

export interface TileArt {
  canvas: HTMLCanvasElement;
  /** sea points for animated waves: [x, y, phase] in world units */
  waves: [number, number, number][];
  /** forest points that shed leaves: [x, y] */
  trees: [number, number][];
}

export type CanvasFactory = () => HTMLCanvasElement;
const domCanvas: CanvasFactory = () => document.createElement('canvas');

/** Houses of a settlement drawn at (x, y) in tile coordinates. */
function drawHouses(g: CanvasRenderingContext2D, b: Settlement, x: number, y: number): void {
  const n = b.city ? 16 : 4 + Math.floor(hash2(b.ti, b.tj) * 3), R = b.city ? 17 : 8;
  g.lineWidth = 0.8;
  if (b.city) { g.setLineDash([2, 2]); g.beginPath(); g.arc(x, y, R + 6, 0, 6.3); g.stroke(); g.setLineDash([]); }
  const pts: [number, number][] = [];
  for (let k = 0; k < n; k++) {
    const a = hash2(b.ti * 7 + k, b.tj * 3 - k) * 6.283, d = Math.sqrt(hash2(b.ti - k, b.tj + k * 5)) * R;
    pts.push([x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8]);
  }
  pts.sort((p, q) => p[1] - q[1]);
  for (const [hx, hy] of pts) {
    g.fillStyle = PAPER; g.beginPath(); g.rect(hx - 2.5, hy - 1.5, 5, 3.5); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(hx - 3.2, hy - 1.5); g.lineTo(hx, hy - 4.5); g.lineTo(hx + 3.2, hy - 1.5); g.closePath(); g.fillStyle = INK; g.fill();
  }
  if (b.city) {
    g.fillStyle = PAPER; g.beginPath(); g.rect(x - 2.5, y - 9, 5, 9); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(x - 2.5, y - 9); g.lineTo(x, y - 17); g.lineTo(x + 2.5, y - 9); g.stroke();
    g.beginPath(); g.moveTo(x, y - 17); g.lineTo(x, y - 20); g.stroke();
  }
}

/** Marching-squares segments per case: pairs of edge names. */
const SEGMENTS: Record<number, string[]> = {
  1: ['l', 'b'], 2: ['b', 'r'], 3: ['l', 'r'], 4: ['h', 'r'], 5: ['l', 'h', 'b', 'r'], 6: ['h', 'b'], 7: ['l', 'h'],
  8: ['l', 'h'], 9: ['h', 'b'], 10: ['h', 'r', 'l', 'b'], 11: ['h', 'r'], 12: ['l', 'r'], 13: ['b', 'r'], 14: ['l', 'b'],
};

export function drawTile(ti: number, tj: number, createCanvas: CanvasFactory = domCanvas): TileArt {
  const T = TILE;
  const cv = createCanvas();
  cv.width = cv.height = T * TILE_RES;
  const g = cv.getContext('2d')!;
  g.scale(TILE_RES, TILE_RES); g.lineCap = 'round'; g.strokeStyle = INK; g.fillStyle = INK;
  const x0 = ti * T, y0 = tj * T, N = T / STEP + 1, H = new Float32Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) H[j * N + i] = altitude(x0 + i * STEP, y0 + j * STEP);
  const h = (i: number, j: number): number => H[j * N + i];

  // The wash: one colour per sample, shaded by relief (light from the north-west), smoothly enlarged.
  const NL = N + 2, lav = createCanvas();
  lav.width = lav.height = NL;
  const lg = lav.getContext('2d')!, im = lg.createImageData(NL, NL);
  const hv = (i: number, j: number): number => (i >= 0 && j >= 0 && i < N && j < N) ? h(i, j) : altitude(x0 + i * STEP, y0 + j * STEP);
  for (let jj = 0; jj < NL; jj++) for (let ii = 0; ii < NL; ii++) {
    const i = ii - 1, j = jj - 1, v = hv(i, j), X = x0 + i * STEP, Y = y0 + j * STEP;
    let c: number[];
    if (v < 0) { const p = Math.min(1, -v / 0.45); c = [190 - 60 * p, 212 - 46 * p, 214 - 30 * p]; }
    else {
      const hu = humidity(X, Y), et = strangeness(X, Y);
      c = v < 0.03 ? [228, 216, 176] : hu > 0.55 && v < 0.45 ? (et > 0.62 ? [196, 178, 196] : [170, 186, 132]) : hu < 0.32 ? [230, 208, 156] : [212, 210, 162];
      if (v > 0.5) { const k = Math.min(1, (v - 0.5) / 0.5); c = c.map((a, n) => a + ([186, 160, 128][n] - a) * k); }
      if (v > 1.05) c = [236, 232, 222];
      const gx = hv(i + 1, j) - hv(i - 1, j), gy = hv(i, j + 1) - hv(i, j - 1), shade = Math.max(-1, Math.min(1, (gx + gy) * 9));
      c = c.map((a) => a * (1 - shade * 0.14));
    }
    const o = (jj * NL + ii) * 4;
    im.data[o] = c[0]; im.data[o + 1] = c[1]; im.data[o + 2] = c[2]; im.data[o + 3] = 150;
  }
  lg.putImageData(im, 0, 0);
  g.imageSmoothingEnabled = true;
  g.drawImage(lav, -1.5 * STEP, -1.5 * STEP, NL * STEP, NL * STEP);

  // The sea: horizontal hatching, tighter offshore.
  for (let Yg = Math.ceil(y0 / 3) * 3; Yg < y0 + T; Yg += 3) {
    const y = Yg - y0, row = Yg / 3;
    let inSea = false, xs = 0;
    for (let x = 0; x <= T; x += 2) {
      const v = x < T ? altitude(x0 + x, y0 + y) : 1;
      const sea = v < 0 && v > -0.32 && (v > -0.16 || ((row % 2) + 2) % 2 === 0) && !(v > -0.25 && v < -0.12 && ((row % 3) + 3) % 3 === 1);
      if (sea && !inSea) { inSea = true; xs = x; }
      if ((!sea || x === T) && inSea) { inSea = false; g.lineWidth = 0.45; g.beginPath(); g.moveTo(xs, y); g.lineTo(x, y); g.stroke(); }
    }
  }

  // The coastline and its dotted foam line, by marching squares.
  for (const L of [-0.04, 0]) {
    const coast = Math.abs(L) < 0.001, major = L > 0 && Math.round(L * 10) % 5 === 0;
    g.lineWidth = coast ? 1.6 : major ? 0.9 : 0.5; g.setLineDash(L < 0 ? [2, 3] : []); g.beginPath();
    for (let j = 0; j < N - 1; j++) for (let i = 0; i < N - 1; i++) {
      const a = h(i, j), b = h(i + 1, j), c = h(i + 1, j + 1), d = h(i, j + 1);
      const k = (a > L ? 8 : 0) | (b > L ? 4 : 0) | (c > L ? 2 : 0) | (d > L ? 1 : 0);
      if (k === 0 || k === 15) continue;
      const X = i * STEP, Y = j * STEP, f = (p: number, q: number): number => (L - p) / (q - p);
      const pts: Record<string, [number, number]> = {
        h: [X + f(a, b) * STEP, Y], r: [X + STEP, Y + f(b, c) * STEP], b: [X + f(d, c) * STEP, Y + STEP], l: [X, Y + f(a, d) * STEP],
      };
      const seg = SEGMENTS[k];
      for (let s = 0; s < seg.length; s += 2) { g.moveTo(...pts[seg[s]]); g.lineTo(...pts[seg[s + 1]]); }
    }
    g.stroke();
  }
  g.setLineDash([]);

  // Relief hatching: short strokes along the slope, longer where it climbs.
  for (let gy = Math.floor((y0 - 8) / 6); gy * 6 < y0 + T + 8; gy++) for (let gx = Math.floor((x0 - 8) / 6); gx * 6 < x0 + T + 8; gx++) {
    const jx = gx * 6 + 3 + (hash2(gx, gy * 5) - 0.5) * 4 - x0, jy = gy * 6 + 3 + (hash2(gy, gx * 5) - 0.5) * 4 - y0, v = altitude(x0 + jx, y0 + jy);
    if (v < 0.35) continue;
    const ga = altitude(x0 + jx + 2, y0 + jy) - altitude(x0 + jx - 2, y0 + jy), gb = altitude(x0 + jx, y0 + jy + 2) - altitude(x0 + jx, y0 + jy - 2), slope = Math.hypot(ga, gb);
    if (slope < 0.014) continue;
    const L = Math.min(5.5, slope * 160), ux = ga / slope, uy = gb / slope, shaded = ux * 0.6 + uy * 0.8 > 0; // south-east side darker
    g.lineWidth = shaded ? 0.9 : 0.45; g.beginPath(); g.moveTo(jx - ux * L / 2, jy - uy * L / 2); g.lineTo(jx + ux * L / 2, jy + uy * L / 2); g.stroke();
  }

  // Vegetation and soils: forests, marshes, sands, strange meadows.
  // NB: sands use whatever fillStyle the previous plant left, as in the proto.
  for (let gy = Math.floor((y0 - 12) / 10); gy * 10 < y0 + T + 12; gy++) for (let gx = Math.floor((x0 - 12) / 10); gx * 10 < x0 + T + 12; gx++) {
    const X = gx * 10 + 5 + (hash2(gx * 3 + 11, gy) - 0.5) * 7, Y = gy * 10 + 5 + (hash2(gx, gy * 3 - 7) - 0.5) * 7, jx = X - x0, jy = Y - y0, v = altitude(X, Y);
    if (v < 0.02 || v > 0.6) continue;
    const hu = humidity(X, Y), et = strangeness(X, Y), r = hash2(X | 0, Y | 0);
    if (hu > 0.55 && v < 0.45 && r < 0.85) {
      if (et > 0.62) { // giant mushrooms
        g.lineWidth = 0.7; g.beginPath(); g.moveTo(jx, jy + 3); g.lineTo(jx, jy - 1); g.stroke();
        g.beginPath(); g.ellipse(jx, jy - 2, 3, 1.6, 0, Math.PI, 0); g.fillStyle = 'rgba(200,170,200,.9)'; g.fill(); g.stroke();
      } else if (v > 0.3) { // conifers
        const t2 = 3.4 + r * 1.5;
        g.fillStyle = 'rgba(80,104,70,.55)'; g.beginPath(); g.moveTo(jx, jy - t2 - 1.5); g.lineTo(jx + t2 * 0.55, jy + 1); g.lineTo(jx - t2 * 0.55, jy + 1); g.closePath(); g.fill(); g.lineWidth = 0.55; g.stroke();
        g.beginPath(); g.moveTo(jx, jy - t2); g.lineTo(jx + t2 * 0.3, jy); g.stroke();
      } else { // broadleaf trees, shaded on the south-east side
        const R = 2.3 + r * 1.4;
        g.fillStyle = 'rgba(42,36,29,.25)'; g.beginPath(); g.ellipse(jx + 1.6, jy + 1.4, R, R * 0.7, 0, 0, 6.3); g.fill(); // cast shadow
        g.fillStyle = 'rgba(118,146,92,.85)'; g.lineWidth = 0.55;
        for (const [dx, dy, k] of [[-0.9, 0.3, 0.8], [0.9, 0.2, 0.8], [0, -0.8, 0.95]]) { g.beginPath(); g.arc(jx + dx * R * 0.7, jy + dy * R * 0.7, R * k, 0, 6.3); g.fill(); g.stroke(); }
        g.lineWidth = 0.45;
        for (let q = 0; q < 3; q++) { g.beginPath(); g.arc(jx + R * 0.25, jy + R * 0.2, R * (0.35 + q * 0.22), -0.2, 1.6); g.stroke(); }
      }
    } else if (hu > 0.62 && v < 0.1) { // marsh
      g.lineWidth = 0.5;
      for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(jx - 3 + k * 2, jy); g.lineTo(jx - 1 + k * 2, jy); g.stroke(); }
      g.beginPath(); g.moveTo(jx, jy); g.lineTo(jx, jy - 2.5); g.stroke();
    } else if (hu < 0.32 && r < 0.45) { // sand
      g.fillRect(jx, jy, 0.9, 0.9); g.fillRect(jx + 3, jy + 2, 0.9, 0.9);
    } else if (hu >= 0.32 && hu <= 0.55 && r < 0.12) { // grass
      g.lineWidth = 0.5; g.beginPath(); g.moveTo(jx - 1.5, jy); g.lineTo(jx, jy - 2.2); g.lineTo(jx + 1.5, jy); g.stroke();
    }
  }

  // The strange place of this tile, if any.
  const L = landmark(ti, tj);
  if (L) drawLandmarkIcon(g, L.kind, L.x - x0, L.y - y0);

  // Roads, then settlements (those of neighbouring tiles may spill onto this one).
  g.strokeStyle = INK;
  for (const { p, q, c } of roadsAround(ti, tj, 5)) {
    const minx = Math.min(p.x, q.x, c.x) - 10, maxx = Math.max(p.x, q.x, c.x) + 10, miny = Math.min(p.y, q.y, c.y) - 10, maxy = Math.max(p.y, q.y, c.y) + 10;
    if (maxx < x0 || minx > x0 + T || maxy < y0 || miny > y0 + T) continue;
    const major = p.city || q.city;
    for (const off of major ? [-1.3, 1.3] : [0]) {
      g.lineWidth = major ? 0.65 : 0.8; g.setLineDash(major ? [] : [3, 2.5]); g.beginPath();
      const len = Math.hypot(q.x - p.x, q.y - p.y), nx = -(q.y - p.y) / len * off, ny = (q.x - p.x) / len * off;
      g.moveTo(p.x - x0 + nx, p.y - y0 + ny); g.quadraticCurveTo(c.x - x0 + nx, c.y - y0 + ny, q.x - x0 + nx, q.y - y0 + ny); g.stroke();
    }
    g.setLineDash([]);
  }
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
    const b = settlement(ti + di, tj + dj);
    if (b) drawHouses(g, b, b.x - x0, b.y - y0);
  }

  // What moves on top: sea points for waves, forest points for leaves.
  const waves: TileArt['waves'] = [], trees: TileArt['trees'] = [];
  for (let y = 8; y < T; y += 22) for (let x = 8; x < T; x += 22) {
    const X = x0 + x + (hash2(x0 + x, y0 + y * 2) - 0.5) * 12, Y = y0 + y + (hash2(x0 + x * 2, y0 + y) - 0.5) * 12, v = altitude(X, Y);
    if (v < -0.04) waves.push([X, Y, hash2(X | 0, Y | 0) * 6.28]);
    else if (v > 0.02 && v < 0.45 && humidity(X, Y) > 0.55) trees.push([X, Y]);
  }
  return { canvas: cv, waves, trees };
}
