// Engraved map tiles: watercolour wash, sea hatching, coastline, relief hatching, vegetation,
// strange places, roads and houses. Verbatim port of the proto's tuile(); a tile is drawn once
// on a canvas and then cached as a Phaser texture by the Map scene.
import { hash2 } from '../world/noise';
import { CIRCUMFERENCE, wrapIndex, wrapX } from '../world/planet';
import { TILE, altitude, humidity } from '../world/terrain';
import { DESERT_HUMIDITY, JUNGLE_HUMIDITY, coldness, heat, temperature } from '../world/climate';
import { drawDunes, drawIce, drawJungle, drawSavanna } from './climate';
import { drawBridges, drawRivers, waterMask } from './rivers';
import { riversNear } from '../world/rivers';
import { settlement, type Settlement } from '../world/settlements';
import { roadsAround } from '../world/roads';
import { landmark } from '../world/landmarks';
import { drawLandmarkIcon } from './icons';
import { drawHills, drawMountains } from './relief';
import { clearing, drawTown, drawTownGrounds } from './towns';
import { drawWonder } from './wonders';
import { hasLandmarkArt, hasMonumentArt, hasWonderArt } from './wonderArt';
import { WONDER_CLEARING, wondersNear } from '../world/wonders';
import { MONUMENT_CLEARING, monumentsNear } from '../world/monuments';
import { drawMonument } from './monuments';
import { INK } from './palette';

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

/** Marching-squares segments per case: pairs of edge names. */
const SEGMENTS: Record<number, string[]> = {
  1: ['l', 'b'], 2: ['b', 'r'], 3: ['l', 'r'], 4: ['h', 'r'], 5: ['l', 'h', 'b', 'r'], 6: ['h', 'b'], 7: ['l', 'h'],
  8: ['l', 'h'], 9: ['h', 'b'], 10: ['h', 'r', 'l', 'b'], 11: ['h', 'r'], 12: ['l', 'r'], 13: ['b', 'r'], 14: ['l', 'b'],
};

/** Watercolour of the ground at (X, Y) with altitude v, before relief shading. */
function terrainColour(v: number, X: number, Y: number): number[] {
  const t = temperature(X, Y, v), cold = coldness(t);
  const mix = (a: number[], b: number[], k: number): number[] => a.map((n, i) => n + (b[i] - n) * k);
  if (v < 0) {
    const p = Math.min(1, -v / 0.45), sea = [168 - 60 * p, 202 - 46 * p, 214 - 26 * p];
    return mix(sea, [214 - 30 * p, 226 - 22 * p, 232 - 14 * p], cold); // frozen seas are pale
  }
  const hu = humidity(X, Y);
  let c = v < 0.03 ? [228, 216, 176] : hu > 0.55 && v < 0.45 ? [170, 186, 132] : hu < 0.32 ? [230, 208, 156] : [212, 210, 162];
  c = mix(c, [206, 204, 186], cold); // tundra: grey-green, washed out
  // hot lands: desert sand, savanna gold or jungle green, blending smoothly with humidity
  const k = (a: number, b: number): number => Math.max(0, Math.min(1, (hu - a) / (b - a)));
  const hot = mix(mix([238, 208, 142], [200, 192, 104], k(DESERT_HUMIDITY - 0.02, DESERT_HUMIDITY + 0.02)), [104, 148, 82], k(JUNGLE_HUMIDITY - 0.02, JUNGLE_HUMIDITY + 0.02));
  c = mix(c, hot, heat(t));
  if (v > 0.5) { const k = Math.min(1, (v - 0.5) / 0.5); c = c.map((a, n) => a + ([186, 160, 128][n] - a) * k); }
  if (v > 1.05 - cold * 0.3) c = [236, 232, 222]; // snow, lower in the cold
  return c;
}

/** Draw tile (ti, tj) at `res` pixels per world unit. */
export function drawTile(ti: number, tj: number, createCanvas: CanvasFactory = domCanvas, res = TILE_RES): TileArt {
  const T = TILE;
  const cv = createCanvas();
  cv.width = cv.height = Math.round(T * res);
  const g = cv.getContext('2d')!;
  g.scale(res, res); g.lineCap = 'round'; g.strokeStyle = INK; g.fillStyle = INK;
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
    let c = terrainColour(v, X, Y);
    if (v >= 0) {
      const gx = hv(i + 1, j) - hv(i - 1, j), gy = hv(i, j + 1) - hv(i, j - 1), shade = Math.max(-1, Math.min(1, (gx + gy) * 9));
      c = c.map((a) => a * (1 - shade * 0.14));
    }
    const o = (jj * NL + ii) * 4;
    im.data[o] = c[0]; im.data[o + 1] = c[1]; im.data[o + 2] = c[2]; im.data[o + 3] = 150;
  }
  lg.putImageData(im, 0, 0);
  g.imageSmoothingEnabled = true;
  g.drawImage(lav, -1.5 * STEP, -1.5 * STEP, NL * STEP, NL * STEP);

  // The coastline, and two fainter lines offshore that follow it like ripples (the way old
  // maps show water near a shore), by marching squares.
  for (const L of [-0.14, -0.05, 0]) {
    const coast = Math.abs(L) < 0.001;
    g.strokeStyle = coast ? INK : L > -0.1 ? 'rgba(40,70,90,.45)' : 'rgba(40,70,90,.25)';
    g.lineWidth = coast ? 1.6 : 0.6; g.setLineDash([]); g.beginPath();
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
  g.strokeStyle = INK;

  // Settlements whose grounds reach this tile, and the roads around: towns clear the forest
  // around them and orient their houses and fields along their roads.
  const towns: Settlement[] = [];
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const b = settlement(ti + di, tj + dj); if (b) towns.push(b); }
  const roads = roadsAround(ti, tj, 6).filter((r) => r.maxX + 60 > x0 && r.minX - 60 < x0 + T && r.maxY + 60 > y0 && r.minY - 60 < y0 + T + 60);
  const wonders = wondersNear(x0, y0, x0 + T, y0 + T, 80);
  const monuments = monumentsNear(x0, y0, x0 + T, y0 + T, 70);
  const cleared = (X: number, Y: number): boolean => towns.some((b) => Math.hypot(X - b.x, (Y - b.y) * 1.15) < clearing(b))
    || wonders.some((w) => Math.hypot(X - w.x, Y - w.y + 15) < WONDER_CLEARING)
    || monuments.some((m) => Math.hypot(X - m.x, Y - m.y + 12) < MONUMENT_CLEARING);

  // Rivers and lakes first: plants are drawn after them (never in the water), so trees on the
  // banks lean over the water.
  const rivers = riversNear(x0 - 40, y0 - 40, x0 + T + 40, y0 + T + 60);
  drawRivers(g, x0, y0, rivers);
  const water = waterMask(x0, y0, rivers);

  // Hills: small mounds (mountains come after the vegetation, so they stand above it).
  drawHills(g, x0, y0, (X, Y) => cleared(X, Y) || water(X, Y));

  // Vegetation and soils by climate: forests, marshes, grass, sands; tundra; savanna and jungle;
  // nothing in the desert.
  // NB: sands use whatever fillStyle the previous plant left, as in the proto.
  for (let gy = Math.floor((y0 - 12) / 10); gy * 10 < y0 + T + 12; gy++) for (let gx = Math.floor((x0 - 12) / 10); gx * 10 < x0 + T + 12; gx++) {
    const wg = wrapIndex(gx, CIRCUMFERENCE / 10); // the planet wraps: draw lots with the wrapped index
    const X = gx * 10 + 5 + (hash2(wg * 3 + 11, gy) - 0.5) * 7, Y = gy * 10 + 5 + (hash2(wg, gy * 3 - 7) - 0.5) * 7, jx = X - x0, jy = Y - y0, v = altitude(X, Y);
    if (v < 0.02 || v > 0.6) continue;
    const hu = humidity(X, Y), r = hash2(wg * 7 + 1, gy * 13 + 2);
    if (cleared(X, Y) || water(X, Y)) continue; // fields and gardens around towns; rivers and lakes
    const t = temperature(X, Y, v), cold = coldness(t) > 0.5;
    if (heat(t) > 0.5) { // hot lands
      if (hu < DESERT_HUMIDITY) continue; // the desert: dunes come later
      if (hu < JUNGLE_HUMIDITY) drawSavanna(g, jx, jy, r);
      else drawJungle(g, jx, jy, r, v);
      continue;
    }
    if (cold) { // tundra: a few stunted conifers, lichen, frozen pools
      if (hu > 0.55 && r < 0.3) {
        const t2 = 2.4 + r * 3;
        g.fillStyle = 'rgba(80,104,70,.5)'; g.beginPath(); g.moveTo(jx, jy - t2 - 1); g.lineTo(jx + t2 * 0.45, jy + 1); g.lineTo(jx - t2 * 0.45, jy + 1); g.closePath(); g.fill(); g.lineWidth = 0.5; g.stroke();
      } else if (r < 0.25) {
        g.fillStyle = 'rgba(120,120,100,.55)';
        for (const [dx, dy] of [[0, 0], [1.4, 0.6], [0.5, 1.5]]) { g.beginPath(); g.arc(jx + dx, jy + dy, 0.55, 0, 6.3); g.fill(); }
      }
      continue;
    }
    if (hu > 0.55 && v < 0.45 && r < 0.85) {
      if (v > 0.3) { // conifers
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
    } else if (hu >= 0.32 && hu <= 0.55 && r < 0.12) { // a tuft of grass
      g.lineWidth = 0.45; g.beginPath();
      g.moveTo(jx - 0.6, jy); g.quadraticCurveTo(jx - 1, jy - 1.2, jx - 2, jy - 2);
      g.moveTo(jx, jy); g.lineTo(jx + 0.1, jy - 2.6);
      g.moveTo(jx + 0.6, jy); g.quadraticCurveTo(jx + 1, jy - 1.2, jx + 2, jy - 1.9);
      g.stroke();
    }
  }


  // where a river crosses a range, the peaks step aside: a valley (every 4th point is enough)
  const valleys = rivers.map((r) => r.points.filter((_, k) => k % 4 === 0 || k === r.points.length - 1).map(([x, y]) => ({ x, y })));

  // Climates: dune fields in the deserts, ice floes on the frozen seas.
  drawDunes(g, x0, y0, (X, Y) => cleared(X, Y) || water(X, Y));
  drawIce(g, x0, y0);

  // Mountains: engraved peaks, back to front.
  // no peak over a wonder: its clearing counts as an obstacle like a road
  const wonderGround = [...wonders, ...monuments].map((w) => [{ x: w.x - 30, y: w.y - 10 }, { x: w.x + 30, y: w.y - 10 }]);
  drawMountains(g, x0, y0, terrainColour, [...roads.map((r) => r.points), ...wonderGround, ...valleys]);
  g.strokeStyle = INK; g.fillStyle = INK;

  // The strange place of this tile, if any.
  const L = landmark(ti, tj);
  if (L && !hasLandmarkArt(L.kind)) drawLandmarkIcon(g, L.kind, L.x - x0, L.y - y0); // else drawn by the overlay

  // Roads, then settlements (those of neighbouring tiles may spill onto this one).
  g.strokeStyle = INK;
  // Every road the same brown; roads to a city are wider. A detour can reach ~5 tiles from its
  // towns (980 apart at most, 320 of detour margin), hence the radius of 6.
  const arable = (X: number, Y: number): boolean => { const v = altitude(X, Y); return v > 0.03 && v < 0.5; };
  for (const b of towns) drawTownGrounds(g, b, b.x - x0, b.y - y0, roads, arable);
  g.setLineDash([]); g.lineJoin = 'round';
  for (const r of roads) {
    if (r.maxX + 10 < x0 || r.minX - 10 > x0 + T || r.maxY + 10 < y0 || r.minY - 10 > y0 + T) continue;
    const line = (): void => { g.beginPath(); r.points.forEach((pt, k) => (k ? g.lineTo(pt.x - x0, pt.y - y0) : g.moveTo(pt.x - x0, pt.y - y0))); g.stroke(); };
    g.lineWidth = r.major ? 2.6 : 1.8; g.strokeStyle = INK; line();
    g.lineWidth = r.major ? 1.5 : 0.9; g.strokeStyle = 'rgb(200,165,112)'; line();
  }
  g.strokeStyle = INK;
  // above the roads; a wonder with an illustration is drawn by the overlay instead
  drawBridges(g, x0, y0, roads, rivers);
  for (const w of wonders) if (!hasWonderArt(w.kind)) drawWonder(g, w, w.x - x0, w.y - y0);
  for (const m of monuments) if (!hasMonumentArt(m.kind)) drawMonument(g, m, m.x - x0, m.y - y0);
  for (const b of towns) drawTown(g, b, b.x - x0, b.y - y0, roads);

  // What moves on top: sea points for waves, forest points for leaves.
  const waves: TileArt['waves'] = [], trees: TileArt['trees'] = [];
  for (let y = 8; y < T; y += 22) for (let x = 8; x < T; x += 22) {
    const wx = wrapX(x0 + x);
    const X = x0 + x + (hash2(wx, y0 + y * 2) - 0.5) * 12, Y = y0 + y + (hash2(wx + x, y0 + y) - 0.5) * 12, v = altitude(X, Y);
    if (v < -0.04) { if (coldness(temperature(X, Y, v)) < 0.5) waves.push([X, Y, hash2(wx + 3, Y | 0) * 6.28]); } // no waves on the ice
    else if (v > 0.02 && v < 0.45 && humidity(X, Y) > 0.55 && !cleared(X, Y)) trees.push([X, Y]); // no leaves off fields
  }
  return { canvas: cv, waves, trees };
}
