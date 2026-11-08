// Rivers and lakes on the tiles: a blue ribbon edged in ink, a trickle at the spring growing
// wide towards the mouth; lakes as irregular blue pools with an ink shore.
import { hash2 } from '../world/noise';
import { wrapX } from '../world/planet';
import type { River } from '../world/rivers';
import { INK } from './palette';

const T = 256;
const WATER = 'rgb(112,160,186)';

export function drawRivers(g: CanvasRenderingContext2D, x0: number, y0: number, rivers: River[]): void {
  g.lineCap = 'round'; g.lineJoin = 'round';
  // lakes first, rivers run into them
  for (const r of rivers) for (const [lx, ly, cells] of r.lakes) {
    const R = Math.min(60, 9 + Math.sqrt(cells) * 7), x = lx - x0, y = ly - y0;
    if (x < -R - 4 || x > T + R + 4 || y < -R - 4 || y > T + R + 4) continue;
    const seed = hash2(Math.round(wrapX(lx)), Math.round(ly));
    g.beginPath();
    for (let k = 0; k <= 12; k++) {
      const a = (k % 12) / 12 * 6.283, rr = R * (0.75 + hash2(Math.round(seed * 1e4) + (k % 12), 5) * 0.4);
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr * 0.7;
      if (k) g.lineTo(px, py); else g.moveTo(px, py);
    }
    g.closePath(); g.fillStyle = WATER; g.fill(); g.strokeStyle = INK; g.lineWidth = 1.1; g.stroke();
  }
  // each river in two passes: an ink edge, then the water; segment by segment for the width
  for (const pass of [0, 1]) for (const r of rivers) {
    if (r.maxX + 6 < x0 || r.minX - 6 > x0 + T || r.maxY + 6 < y0 || r.minY - 6 > y0 + T) continue;
    g.strokeStyle = pass ? WATER : INK;
    for (let k = 1; k < r.points.length; k++) {
      const [ax, ay] = r.points[k - 1], [bx, by] = r.points[k];
      if (Math.max(ax, bx) < x0 - 6 || Math.min(ax, bx) > x0 + T + 6 || Math.max(ay, by) < y0 - 6 || Math.min(ay, by) > y0 + T + 6) continue;
      const w = r.widths[k];
      g.lineWidth = pass ? w : w + 1.1;
      g.beginPath(); g.moveTo(ax - x0, ay - y0); g.lineTo(bx - x0, by - y0); g.stroke();
    }
  }
  g.strokeStyle = INK;
}
