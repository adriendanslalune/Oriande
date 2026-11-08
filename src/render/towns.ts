// Villages and cities, drawn as on an old map: villages are houses strung along their roads in
// a patchwork of fields; cities have walls with towers and gates, streets, packed roofs, a
// cathedral, a market square, and suburbs. Everything is seeded by the settlement, so a town
// looks the same from every tile that shows part of it.
import { hash2 } from '../world/noise';
import type { Settlement } from '../world/settlements';
import type { Road } from '../world/roads';
import { INK } from './palette';

/** How far around a settlement the land is cleared of forest (fields, gardens). */
export const clearing = (b: Settlement): number => (b.city ? 58 : 32);

const ROOF = ['rgb(160,82,60)', 'rgb(140,70,52)', 'rgb(120,96,80)', 'rgb(172,98,70)'];
const WALL = 'rgb(232,222,198)', STONE = 'rgb(205,192,165)';
const FIELDS = ['rgba(222,196,112,.6)', 'rgba(150,172,98,.55)', 'rgba(176,146,104,.5)', 'rgba(196,186,120,.55)'];

/** Unit vectors of the roads leaving a settlement. */
function roadDirections(b: Settlement, roads: Road[]): number[] {
  const out: number[] = [];
  for (const r of roads) {
    if (r.p !== b && r.q !== b) continue;
    const pts = r.p === b ? r.points : [...r.points].reverse();
    // aim at the point ~15 units out, so a curve's first wiggle does not mislead
    let k = 1;
    while (k < pts.length - 1 && Math.hypot(pts[k].x - b.x, pts[k].y - b.y) < 15) k++;
    out.push(Math.atan2(pts[k].y - b.y, pts[k].x - b.x));
  }
  if (!out.length) out.push(hash2(b.wi * 3, b.tj * 5) * 6.283);
  return out;
}

/** Radius of a city's walls, world units. */
export const cityRadius = (b: Settlement): number => 25 + hash2(b.wi * 5, b.tj * 3) * 5;

/**
 * Fields around a settlement, drawn before the roads: a patchwork of strips laid out along the
 * main road, on dry low land only, thinning out towards the edge.
 */
export function drawTownGrounds(g: CanvasRenderingContext2D, b: Settlement, x: number, y: number, roads: Road[], arable: (X: number, Y: number) => boolean): void {
  const dirs = roadDirections(b, roads), R0 = b.city ? cityRadius(b) + 3 : 7, R1 = clearing(b);
  const rot = dirs[0], c = Math.cos(rot), s = Math.sin(rot);
  const FW = 7, FD = 4.5; // a field: 7 along the road, 4.5 across
  g.lineWidth = 0.3; g.strokeStyle = 'rgba(42,36,29,.45)';
  for (let v = -R1; v <= R1; v += FD) for (let u = -R1; u <= R1; u += FW) {
    const off = (Math.round(v / FD) % 2) * FW * 0.5; // stagger rows like real strips
    const cu = u + off, cv = v, px = x + c * cu - s * cv, py = y + s * cu + c * cv;
    const r = Math.hypot(px - x, (py - y) * 1.15);
    const k = Math.round(cu * 3 + cv * 7);
    const h = (a: number): number => hash2(b.wi * 31 + k + a, b.tj * 37 - k * 3 + a);
    if (r < R0 || r > R1 || h(1) < (r - R0) / (R1 - R0) * 0.7 || !arable(b.x + px - x, b.y + py - y)) continue;
    const corner = (du: number, dv: number): [number, number] => [x + c * (cu + du) - s * (cv + dv), y + s * (cu + du) + c * (cv + dv)];
    const pts = [corner(-FW / 2, -FD / 2), corner(FW / 2, -FD / 2), corner(FW / 2, FD / 2), corner(-FW / 2, FD / 2)];
    g.fillStyle = FIELDS[Math.floor(h(2) * FIELDS.length)];
    g.beginPath(); g.moveTo(...pts[0]); for (const p of pts.slice(1)) g.lineTo(...p); g.closePath(); g.fill(); g.stroke();
    if (h(3) < 0.45) { // furrows
      g.save(); g.lineWidth = 0.2; g.beginPath();
      for (let f = -FW / 2 + 1.2; f < FW / 2; f += 1.2) { g.moveTo(...corner(f, -FD / 2 + 0.4)); g.lineTo(...corner(f, FD / 2 - 0.4)); }
      g.stroke(); g.restore();
    }
  }
}

/** A small house seen from the side: wall, door, pitched roof, sometimes a chimney. */
function house(g: CanvasRenderingContext2D, x: number, y: number, w: number, roof: string, seed: number): void {
  const h = w * 0.55, rh = w * 0.5;
  g.fillStyle = WALL; g.strokeStyle = INK; g.lineWidth = 0.4;
  g.fillRect(x - w / 2, y - h, w, h); g.strokeRect(x - w / 2, y - h, w, h);
  g.fillStyle = INK; g.fillRect(x - w * 0.08 + (seed - 0.5) * w * 0.4, y - h * 0.55, w * 0.16, h * 0.55); // door
  g.fillStyle = roof;
  g.beginPath(); g.moveTo(x - w / 2 - 0.5, y - h); g.lineTo(x - w * 0.3, y - h - rh); g.lineTo(x + w * 0.3, y - h - rh); g.lineTo(x + w / 2 + 0.5, y - h); g.closePath(); g.fill(); g.stroke();
  if (seed > 0.55) { g.fillStyle = STONE; g.fillRect(x + w * 0.15, y - h - rh - 1, w * 0.12, rh * 0.6); g.strokeRect(x + w * 0.15, y - h - rh - 1, w * 0.12, rh * 0.6); }
}

/** A church: nave and a tower with a spire. */
function church(g: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  g.strokeStyle = INK; g.lineWidth = 0.45;
  g.fillStyle = STONE;
  g.fillRect(x - 4 * s, y - 3 * s, 6 * s, 3 * s); g.strokeRect(x - 4 * s, y - 3 * s, 6 * s, 3 * s); // nave
  g.fillStyle = ROOF[2];
  g.beginPath(); g.moveTo(x - 4.4 * s, y - 3 * s); g.lineTo(x - 3.4 * s, y - 5 * s); g.lineTo(x + 2 * s, y - 5 * s); g.lineTo(x + 2.4 * s, y - 3 * s); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = STONE;
  g.fillRect(x + 2 * s, y - 7 * s, 2.4 * s, 7 * s); g.strokeRect(x + 2 * s, y - 7 * s, 2.4 * s, 7 * s); // tower
  g.fillStyle = 'rgb(90,90,100)';
  g.beginPath(); g.moveTo(x + 1.8 * s, y - 7 * s); g.lineTo(x + 3.2 * s, y - 12 * s); g.lineTo(x + 4.6 * s, y - 7 * s); g.closePath(); g.fill(); g.stroke(); // spire
  g.beginPath(); g.moveTo(x + 3.2 * s, y - 12 * s); g.lineTo(x + 3.2 * s, y - 13.5 * s); g.moveTo(x + 2.6 * s, y - 13 * s); g.lineTo(x + 3.8 * s, y - 13 * s); g.stroke(); // cross
}

/** Houses and buildings: drawn after the roads. */
export function drawTown(g: CanvasRenderingContext2D, b: Settlement, x: number, y: number, roads: Road[]): void {
  const dirs = roadDirections(b, roads);
  const h = (k: number, a: number): number => hash2(b.wi * 17 + k * 13 + a, b.tj * 19 - k * 7 + a * 3);
  type Item = { x: number; y: number; draw: () => void };
  const items: Item[] = [];
  if (!b.city) {
    // a village: houses along its roads, a chapel when it is big enough
    const n = 5 + Math.floor(hash2(b.wi, b.tj) * 4);
    for (let k = 0; k < n; k++) {
      const a = dirs[k % dirs.length], along = 2 + h(k, 1) * 11, side = (h(k, 2) < 0.5 ? -1 : 1) * (2.5 + h(k, 3) * 2);
      const hx = x + Math.cos(a) * along - Math.sin(a) * side, hy = y + Math.sin(a) * along + Math.cos(a) * side;
      const w = 4.2 + h(k, 4) * 1.6, roof = ROOF[Math.floor(h(k, 5) * ROOF.length)], seed = h(k, 6);
      items.push({ x: hx, y: hy, draw: () => house(g, hx, hy, w, roof, seed) });
    }
    if (n >= 7) items.push({ x: x - 1, y: y + 1, draw: () => church(g, x - 1, y + 1, 0.7) });
  } else {
    // a city: walls with towers and gates, streets from the gates to the market square
    const R = cityRadius(b), N = 14;
    const wall: [number, number][] = [];
    for (let k = 0; k < N; k++) { const a = k / N * 6.283, r = R * (0.88 + h(k, 9) * 0.22); wall.push([x + Math.cos(a) * r, y + Math.sin(a) * r * 0.82]); }
    g.fillStyle = 'rgba(226,214,186,.92)';
    g.beginPath(); g.moveTo(...wall[0]); for (const p of wall.slice(1)) g.lineTo(...p); g.closePath(); g.fill();
    g.strokeStyle = INK; g.lineWidth = 1.5; g.stroke();
    g.strokeStyle = STONE; g.lineWidth = 0.6; g.stroke();
    // streets
    g.strokeStyle = 'rgb(200,165,112)'; g.lineWidth = 1.2;
    for (const a of dirs) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * R * 1.05, y + Math.sin(a) * R * 0.86); g.stroke(); }
    // market square
    g.fillStyle = 'rgb(214,196,160)'; g.strokeStyle = INK; g.lineWidth = 0.4;
    g.beginPath(); g.ellipse(x, y, 4, 3, 0, 0, 6.3); g.fill(); g.stroke();
    // towers on every other corner, gatehouses where streets leave
    g.lineWidth = 0.5;
    wall.forEach(([tx, ty], k) => { if (k % 2) return; g.fillStyle = STONE; g.beginPath(); g.arc(tx, ty, 1.8, 0, 6.3); g.fill(); g.stroke(); });
    for (const a of dirs) {
      const gx = x + Math.cos(a) * R, gy = y + Math.sin(a) * R * 0.82;
      g.fillStyle = STONE; g.fillRect(gx - 2, gy - 2, 4, 4); g.strokeRect(gx - 2, gy - 2, 4, 4);
      g.fillStyle = INK; g.fillRect(gx - 0.7, gy - 0.3, 1.4, 2.3);
    }
    // packed houses inside the walls, kept off the streets and the square
    const inside = (px: number, py: number): boolean => Math.hypot((px - x) / R, (py - y) / (R * 0.82)) < 0.8;
    const offStreet = (px: number, py: number): boolean => dirs.every((a) => {
      const ux = Math.cos(a), uy = Math.sin(a), t = (px - x) * ux + (py - y) * uy;
      return t < 0 || Math.abs(-(px - x) * uy + (py - y) * ux) > 2.6;
    }) && Math.hypot(px - x, (py - y) * 1.3) > 5.5;
    for (let k = 0; items.length < 56 && k < 260; k++) {
      const px = x + (h(k, 10) - 0.5) * 2 * R, py = y + (h(k, 11) - 0.5) * 2 * R * 0.82;
      if (!inside(px, py) || !offStreet(px, py)) continue;
      const w = 3 + h(k, 12) * 1.6, roof = ROOF[Math.floor(h(k, 13) * ROOF.length)], seed = h(k, 14);
      items.push({ x: px, y: py, draw: () => house(g, px, py, w, roof, seed) });
    }
    // the cathedral near the square
    const ca = dirs[0] + Math.PI * 0.75, cx = x + Math.cos(ca) * 9, cy = y + Math.sin(ca) * 7 + 3;
    items.push({ x: cx, y: cy, draw: () => church(g, cx, cy, 1.3) });
    // suburbs along the roads, outside the gates
    for (let k = 0; k < dirs.length * 3; k++) {
      const a = dirs[k % dirs.length], along = R + 5 + h(k, 20) * 12, side = (h(k, 21) < 0.5 ? -1 : 1) * (3 + h(k, 22) * 2);
      const hx = x + Math.cos(a) * along - Math.sin(a) * side, hy = y + Math.sin(a) * along * 0.86 + Math.cos(a) * side;
      const w = 3.4 + h(k, 23), roof = ROOF[Math.floor(h(k, 24) * ROOF.length)], seed = h(k, 25);
      items.push({ x: hx, y: hy, draw: () => house(g, hx, hy, w, roof, seed) });
    }
  }
  items.sort((p, q) => p.y - q.y); // back to front
  for (const it of items) it.draw();
}
