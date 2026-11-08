// Relief drawn the way old maps do it: small mounds for hills, little engraved peaks for
// mountains (lit west face, hatched east face, snow on the highest). Symbols sit on a world
// grid, so a tile and its neighbours draw the same symbols and they meet seamlessly.
import { hash2 } from '../world/noise';
import { altitude, MOUNTAIN_ALTITUDE } from '../world/terrain';
import { coldness, temperature } from '../world/climate';
import { INK } from './palette';

const T = 256;
const HILL_MIN = 0.36, MOUNTAIN_MIN = MOUNTAIN_ALTITUDE, SNOW_MIN = 1.0;

/** Small mounds on hilly ground, drawn under the vegetation. */
export function drawHills(g: CanvasRenderingContext2D, x0: number, y0: number, skip: (x: number, y: number) => boolean = () => false): void {
  const S = 12, M = 12;
  g.strokeStyle = INK;
  for (let gy = Math.floor((y0 - M) / S); gy * S < y0 + T + M; gy++) for (let gx = Math.floor((x0 - M) / S); gx * S < x0 + T + M; gx++) {
    const X = gx * S + (hash2(gx * 7 + 3, gy * 11) - 0.5) * 6, Y = gy * S + (hash2(gx * 13, gy * 5 + 1) - 0.5) * 6;
    const v = altitude(X, Y);
    if (v < HILL_MIN || v >= MOUNTAIN_MIN || hash2(gx * 3, gy * 17 + 5) > 0.35 || skip(X, Y)) continue;
    const k = (v - HILL_MIN) / (MOUNTAIN_MIN - HILL_MIN), w = 2.6 + k * 2.4, h = 1.6 + k * 1.8;
    const x = X - x0, y = Y - y0;
    g.lineWidth = 0.6;
    g.beginPath(); g.moveTo(x - w, y); g.quadraticCurveTo(x, y - h * 2, x + w, y); g.stroke();
    // shading on the east (away from the north-west light)
    g.lineWidth = 0.4;
    for (let q = 1; q <= 2; q++) { const u = 0.35 + q * 0.2; g.beginPath(); g.moveTo(x + w * u * 0.9, y - h * (1 - u) * 1.6); g.lineTo(x + w * u * 0.9 - 0.6, y); g.stroke(); }
  }
}

interface Peak { x: number; y: number; v: number; seed: number }

const rgb = (c: number[]): string => `rgb(${c.map((n) => Math.round(Math.max(0, Math.min(255, n)))).join(',')})`;

/** Mountain peaks, drawn back to front over the vegetation. */
/** Distance from (x, y) to a polyline. */
function distanceToLine(x: number, y: number, pts: { x: number; y: number }[]): number {
  let best = Infinity;
  for (let k = 1; k < pts.length; k++) {
    const a = pts[k - 1], b = pts[k], dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy || 1;
    const u = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / L2));
    best = Math.min(best, Math.hypot(a.x + dx * u - x, a.y + dy * u - y));
  }
  return best;
}

/**
 * Mountain peaks, drawn back to front over the vegetation. Peaks are left out along `roads`,
 * so a road crossing a low ridge shows as a pass rather than going through a peak.
 */
export function drawMountains(g: CanvasRenderingContext2D, x0: number, y0: number, colour: (v: number, x: number, y: number) => number[], roads: { x: number; y: number }[][] = []): void {
  const S = 16, M = 34;
  const peaks: Peak[] = [];
  for (let gy = Math.floor((y0 - M) / S); gy * S < y0 + T + M * 2; gy++) for (let gx = Math.floor((x0 - M) / S); gx * S < x0 + T + M; gx++) {
    const X = gx * S + (hash2(gx * 5 + 1, gy * 3 + 7) - 0.5) * 10 + (gy % 2 ? S / 2 : 0), Y = gy * S + (hash2(gx * 9 + 2, gy * 7) - 0.5) * 8;
    const v = altitude(X, Y), seed = hash2(gx * 31 + 7, gy * 29 + 3);
    // foothills are sparse, high ranges are packed
    if (v < MOUNTAIN_MIN || seed < 0.45 - (v - MOUNTAIN_MIN) * 1.2) continue;
    peaks.push({ x: X, y: Y, v, seed });
  }
  peaks.sort((a, b) => a.y - b.y || a.x - b.x); // far (north) first, so nearer peaks overlap them
  for (const p of peaks) {
    const k = Math.min(1, (p.v - MOUNTAIN_MIN) / 0.5), r2 = hash2(p.seed * 1e4, 3), r3 = hash2(p.seed * 1e4, 7);
    const h = 8 + k * 12 + p.seed * 3, w = h * (1.45 + r2 * 0.5);
    if (roads.some((r) => distanceToLine(p.x, p.y - h * 0.3, r) < w * 0.55 + 3)) continue; // a pass
    const x = p.x - x0, y = p.y - y0;
    // outline: left foot, left shoulder, summit, right shoulder, right foot
    const P = [x + (p.seed - 0.5) * w * 0.25, y - h];
    const Ls = [x - w * (0.22 + r3 * 0.1), y - h * (0.42 + r2 * 0.2)];
    const Rs = [x + w * (0.2 + r2 * 0.1), y - h * (0.38 + r3 * 0.22)];
    const Lf = [x - w / 2, y], Rf = [x + w / 2, y];
    const B = [P[0] + w * 0.12, y]; // where the ridge reaches the foot
    const base = colour(p.v, p.x, p.y);
    const poly = (...pts: number[][]): void => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const q of pts.slice(1)) g.lineTo(q[0], q[1]); g.closePath(); g.fill(); };
    g.fillStyle = rgb(base.map((n) => n + (245 - n) * 0.4)); // lit west face
    poly(Lf, Ls, P, B);
    g.fillStyle = rgb(base.map((n) => n * 0.78)); // shaded east face
    poly(B, P, Rs, Rf);
    if (p.v > SNOW_MIN - coldness(temperature(p.x, p.y, p.v)) * 0.3) { // snow on the summit (lower in the cold)
      const at = (a: number[], u: number): number[] => [P[0] + (a[0] - P[0]) * u, P[1] + (a[1] - P[1]) * u];
      g.fillStyle = 'rgb(248,246,240)';
      poly(at(Ls, 0.6), P, at(Rs, 0.6), at(Rs, 0.35).map((n, i) => n + (i ? 1.5 : -1)), at(B, 0.3), at(Ls, 0.3).map((n, i) => n + (i ? 1.5 : 1)));
    }
    g.strokeStyle = INK;
    // hatching on the shaded face, parallel to its outer slope
    g.lineWidth = 0.4;
    const dx = Rf[0] - P[0], dy = Rf[1] - P[1];
    for (let q = 1; q <= 4; q++) {
      const u = q / 5, sx = P[0] + (B[0] - P[0]) * u, sy = P[1] + (B[1] - P[1]) * u;
      g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + dx * (1 - u) * 0.6, sy + dy * (1 - u) * 0.6); g.stroke();
    }
    // ink outline and ridge
    g.lineWidth = 0.85;
    g.beginPath(); g.moveTo(Lf[0], Lf[1]); g.lineTo(Ls[0], Ls[1]); g.lineTo(P[0], P[1]); g.lineTo(Rs[0], Rs[1]); g.lineTo(Rf[0], Rf[1]); g.stroke();
    g.lineWidth = 0.5;
    g.beginPath(); g.moveTo(P[0], P[1]); g.lineTo((P[0] + B[0]) / 2 + 0.6, (P[1] + B[1]) / 2); g.lineTo(B[0], y - 0.5); g.stroke();
  }
}
