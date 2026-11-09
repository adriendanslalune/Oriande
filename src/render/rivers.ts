// Rivers, lakes, waterfalls and bridges on the tiles, in the engraved style of the map.
// Rivers are ribbons with irregular banks, a sandy edge and reeds; lakes are drawn over them,
// so a river crossing a lake disappears into it.
import { fbm, hash2 } from '../world/noise';
import { CIRCUMFERENCE, wrapX } from '../world/planet';
import { inLake, lakeRadius, type Lake, type River } from '../world/rivers';
import type { Road } from '../world/roads';
import { INK } from './palette';

const T = 256, M = 24;
// soft colours: rivers belong to the map, they should not shout over it
const WATER = 'rgb(152,190,204)', WATER_LIGHT = 'rgba(222,236,240,.7)', SAND = 'rgba(214,198,156,.6)';
const BANK = 'rgba(70,100,115,.55)';

type P = [number, number];
const inView = (x: number, y: number, x0: number, y0: number, m = M): boolean => x > x0 - m && x < x0 + T + m && y > y0 - m && y < y0 + T + m;
/** Smooth noise in [-1, 1] at a world position, periodic around the planet. */
const wobble = (x: number, y: number, s: number): number => (fbm(x / s, y / s, 2, CIRCUMFERENCE / s) - 0.5) * 2;

/** The two banks of a river over points [a, b], in tile coordinates. */
function banks(r: River, a: number, b: number, x0: number, y0: number): { left: P[]; right: P[]; mid: P[]; w: number[]; idx: number[] } {
  const left: P[] = [], right: P[] = [], mid: P[] = [], w: number[] = [], idx: number[] = [];
  for (let k = a; k <= b; k++) {
    const [px, py] = r.points[Math.max(0, k - 1)], [qx, qy] = r.points[Math.min(r.points.length - 1, k + 1)];
    const dx = qx - px, dy = qy - py, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    const [x, y] = r.points[k], half = r.widths[k] / 2;
    const hl = half * (1 + wobble(x, y, 13) * 0.35), hr = half * (1 + wobble(x + 500, y, 13) * 0.35);
    left.push([x - x0 + nx * hl, y - y0 + ny * hl]);
    right.push([x - x0 - nx * hr, y - y0 - ny * hr]);
    mid.push([x - x0, y - y0]);
    w.push(r.widths[k]); idx.push(k);
  }
  return { left, right, mid, w, idx };
}

const line = (g: CanvasRenderingContext2D, pts: P[]): void => { g.beginPath(); pts.forEach((p, k) => (k ? g.lineTo(...p) : g.moveTo(...p))); };

/** Runs of consecutive points of a river near the tile. */
function runs(r: River, x0: number, y0: number): [number, number][] {
  const out: [number, number][] = [];
  let start = -1;
  for (let k = 0; k < r.points.length; k++) {
    const ok = inView(r.points[k][0], r.points[k][1], x0, y0);
    if (ok && start < 0) start = Math.max(0, k - 1);
    if ((!ok || k === r.points.length - 1) && start >= 0) { out.push([start, Math.min(r.points.length - 1, k + 1)]); start = -1; }
  }
  return out;
}

function drawLake(g: CanvasRenderingContext2D, l: Lake, x0: number, y0: number): void {
  const x = l.x - x0, y = l.y - y0, N = 40;
  const outline = (scale: number): void => {
    g.beginPath();
    for (let k = 0; k <= N; k++) { const a = (k / N) * Math.PI * 2, rr = lakeRadius(l, a) * scale; const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr * 0.75; if (k) g.lineTo(px, py); else g.moveTo(px, py); }
    g.closePath();
  };
  outline(1.08); g.fillStyle = SAND; g.fill(); // a sandy shore
  outline(1); g.fillStyle = WATER; g.fill(); g.strokeStyle = BANK; g.lineWidth = 0.8; g.stroke();
  g.strokeStyle = 'rgba(40,70,90,.35)'; g.lineWidth = 0.5; outline(0.82); g.stroke(); // ripple lines that follow the shore
  g.strokeStyle = 'rgba(40,70,90,.2)'; outline(0.62); g.stroke();
  g.strokeStyle = 'rgba(40,60,40,.7)'; g.lineWidth = 0.4; // reeds on the shore
  for (let k = 0; k < 14; k++) {
    if (hash2(Math.round(l.seed * 10) + k, 3) < 0.5) continue;
    const a = (k / 14) * Math.PI * 2, rr = lakeRadius(l, a), px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr * 0.75;
    g.beginPath(); for (const o of [-1, 0, 1]) { g.moveTo(px + o, py); g.lineTo(px + o * 1.4, py - 2.4); } g.stroke();
  }
}

/**
 * A waterfall seen from above, as an engraver would: rocks breaking the river at the brink,
 * white water fanning out downstream, a pool of foam at the foot.
 */
function drawFall(g: CanvasRenderingContext2D, fx: number, fy: number, dx: number, dy: number, w: number, seed: number): void {
  const nx = -dy, ny = dx, W = Math.max(6, w / 2 + 3);
  const at = (a: number, b: number): P => [fx + nx * a + dx * b, fy + ny * a + dy * b];
  const rnd = (k: number): number => hash2(Math.round(seed * 1000) + k, k * 7 + 1);
  // white water: tapered streaks fanning downstream, between the brink and the pool
  g.fillStyle = 'rgba(232,242,246,.95)';
  g.beginPath(); g.moveTo(...at(-W * 0.8, 0)); g.lineTo(...at(W * 0.8, 0)); g.lineTo(...at(W * 1.05, 11)); g.lineTo(...at(-W * 1.05, 11)); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.98)'; g.lineCap = 'round';
  for (let k = 0; k < 9; k++) {
    const o = (k / 8 - 0.5) * 2 * W * 0.8, len = 7 + rnd(k) * 5;
    g.lineWidth = 0.6 + rnd(k + 20) * 0.6;
    g.beginPath(); g.moveTo(...at(o, 0.5)); g.quadraticCurveTo(...at(o * 1.05, len * 0.5), ...at(o * 1.2, len)); g.stroke();
  }
  g.strokeStyle = 'rgba(80,120,140,.5)'; g.lineWidth = 0.35; // a few darker threads give depth
  for (let k = 0; k < 4; k++) { const o = (rnd(k + 40) - 0.5) * 2 * W * 0.7; g.beginPath(); g.moveTo(...at(o, 2)); g.lineTo(...at(o * 1.15, 8)); g.stroke(); }
  // foam at the foot: clustered round puffs
  for (let k = 0; k < 11; k++) {
    const o = (rnd(k + 60) - 0.5) * 2 * W * 1.1, b = 11 + rnd(k + 80) * 4, rr = 1.4 + rnd(k + 100) * 1.8;
    g.beginPath(); g.arc(...at(o, b), rr, 0, 6.3); g.fillStyle = 'rgba(250,252,252,.95)'; g.fill();
  }
  // rocks at the brink, on both banks and in the stream: rounded stones, hatched to the south-east
  for (let k = 0; k < 6; k++) {
    const side = k < 2 ? -1 : k < 4 ? 1 : 0, o = side ? side * (W * 0.75 + rnd(k) * 3) : (rnd(k + 5) - 0.5) * W, b = -1 + rnd(k + 9) * 2.5, rr = side ? 2.6 + rnd(k + 3) * 1.8 : 1.3 + rnd(k + 3);
    const [cx, cy] = at(o, b);
    const stone = (): void => {
      g.beginPath();
      for (let m = 0; m <= 7; m++) { const a = (m / 7) * Math.PI * 2, q = rr * (0.75 + rnd(k * 10 + m) * 0.4); if (m) g.lineTo(cx + Math.cos(a) * q, cy + Math.sin(a) * q * 0.8); else g.moveTo(cx + Math.cos(a) * q, cy + Math.sin(a) * q * 0.8); }
      g.closePath();
    };
    stone(); g.fillStyle = 'rgb(176,164,140)'; g.fill();
    g.save(); stone(); g.clip(); g.strokeStyle = 'rgba(42,36,29,.55)'; g.lineWidth = 0.3; g.beginPath(); // shade the south-east half
    for (let h = 0; h < rr * 2; h += 0.9) { g.moveTo(cx + h, cy - rr); g.lineTo(cx + h - rr * 0.6, cy + rr); }
    g.stroke(); g.restore();
    stone(); g.strokeStyle = INK; g.lineWidth = 0.5; g.stroke();
  }
}

export function drawRivers(g: CanvasRenderingContext2D, x0: number, y0: number, rivers: River[]): void {
  g.lineCap = 'round'; g.lineJoin = 'round';
  const near = rivers.filter((r) => r.maxX + M > x0 && r.minX - M < x0 + T && r.maxY + M > y0 && r.minY - M < y0 + T);
  const parts = near.map((r) => ({ r, bs: runs(r, x0, y0).map(([a, b]) => banks(r, a, b, x0, y0)) }));
  // 1. sandy edges, wider than the water
  const dry = (r: River, k: number): boolean => r.join < 0 || k < r.join; // a tributary has no banks inside the river it joins
  // a river that reaches the sea ends square on the shoreline (no rounded sandy tip out at sea)
  const mouth = (r: River, b: ReturnType<typeof banks>, k: number): boolean => !r.lake && r.join < 0 && b.idx[k] === r.points.length - 1;
  for (const { r, bs } of parts) for (const b of bs) for (let k = 1; k < b.mid.length; k++) {
    g.strokeStyle = SAND; g.lineWidth = b.w[k] + 2.6; g.lineCap = mouth(r, b, k) ? 'butt' : 'round';
    g.beginPath(); g.moveTo(...b.mid[k - 1]); g.lineTo(...b.mid[k]); g.stroke();
  }
  g.lineCap = 'round';
  // 2. the water, as a ribbon between the banks
  g.fillStyle = WATER;
  for (const { bs } of parts) for (const b of bs) { line(g, [...b.left, ...[...b.right].reverse()]); g.closePath(); g.fill(); }
  // 3. the current: a paler thread and broken flow lines on wide rivers
  for (const { r, bs } of parts) for (const b of bs) for (let k = 1; k < b.mid.length; k++) {
    if (b.w[k] < 3) continue;
    g.strokeStyle = WATER_LIGHT; g.lineWidth = b.w[k] * 0.22; g.lineCap = mouth(r, b, k) ? 'butt' : 'round';
    g.beginPath(); g.moveTo(...b.mid[k - 1]); g.lineTo(...b.mid[k]); g.stroke();
  }
  g.lineCap = 'round';
  g.strokeStyle = 'rgba(60,95,110,.22)'; g.lineWidth = 0.3; g.setLineDash([3, 4]);
  for (const { bs } of parts) for (const b of bs) for (const side of [-1, 1]) {
    const pts: P[] = b.mid.map(([x, y], k) => {
      const [lx, ly] = b.left[k], f = 0.45 * side;
      return [x + (lx - x) * f, y + (ly - y) * f] as P;
    }).filter((_, k) => b.w[k] >= 4);
    if (pts.length > 1) { line(g, pts); g.stroke(); }
  }
  g.setLineDash([]);
  // 4. ink banks. At a confluence the banks of each river stop at the other's water: the
  // tributary's banks are clipped out of the river it joins, and that river's bank is clipped
  // out of the tributary's mouth, so the two waters open into one another.
  const ribbon = (b: ReturnType<typeof banks>, from = 0): Path2D => {
    const path = new Path2D(), l = b.left.slice(from), rr = b.right.slice(from).reverse();
    [...l, ...rr].forEach((p, k) => (k ? path.lineTo(...p) : path.moveTo(...p)));
    path.closePath();
    return path;
  };
  const holes = new Map<River, Path2D[]>(); // water each river's banks must not cross
  for (const { r, bs } of parts) {
    if (r.join < 0 || !bs.length) continue;
    const [ex, ey] = r.points[r.points.length - 1];
    const main = parts.find((o) => o.r !== r && o.r.points.some(([x, y]) => Math.abs(x - ex) < 1.5 && Math.abs(y - ey) < 1.5));
    if (!main) continue;
    holes.set(r, [...(holes.get(r) ?? []), ...main.bs.map((b) => ribbon(b))]);
    const last = bs[bs.length - 1], from = Math.max(0, last.idx.findIndex((k) => k >= r.join - 2));
    holes.set(main.r, [...(holes.get(main.r) ?? []), ribbon(last, from)]);
  }
  g.strokeStyle = BANK; g.lineWidth = 0.5;
  for (const { r, bs } of parts) {
    const hs = holes.get(r);
    if (hs) {
      g.save();
      const keep = new Path2D(); keep.rect(-M * 2, -M * 2, T + M * 4, T + M * 4);
      for (const h of hs) keep.addPath(h);
      g.clip(keep, 'evenodd');
    }
    for (const b of bs) { line(g, b.left); g.stroke(); line(g, b.right); g.stroke(); }
    if (hs) g.restore();
  }
  g.strokeStyle = 'rgba(40,60,40,.75)'; g.lineWidth = 0.35;
  for (const { r, bs } of parts) for (const b of bs) for (const [bank, sign] of [[b.left, 1], [b.right, -1]] as const) {
    for (let k = 2; k < bank.length - 2; k += 3) {
      if (!dry(r, b.idx[k])) break;
      const [x, y] = bank[k], [mx, my] = b.mid[k], wx = wrapX(x + x0), h = hash2(Math.round(wx * 0.5), Math.round((y + y0) * 0.5) + sign * 17);
      if (h > 0.4) continue;
      const ox = x - mx, oy = y - my, L = Math.hypot(ox, oy) || 1, ux = ox / L, uy = oy / L;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + ux * 1.6 - 0.4, y + uy * 1.6 - 1.2); g.moveTo(x, y); g.lineTo(x + ux * 1.8 + 0.5, y + uy * 1.8 - 1); g.stroke();
      void r;
    }
  }
  // 5. lakes over the rivers: a river crossing a lake disappears into it
  const lakes = near.flatMap((r) => r.lakes).filter((l, k, all) => all.indexOf(l) === k && inView(l.x, l.y, x0, y0, l.r * 1.3 + 4));
  for (const l of lakes) drawLake(g, l, x0, y0);
  // where a river meets a lake, the shore opens: redraw the river's water over the shore line,
  // and its banks up to the water's edge
  for (const { r, bs } of parts) for (const b of bs) {
    const near = (k: number): boolean => lakes.some((l) => Math.hypot(b.mid[k][0] + x0 - l.x, (b.mid[k][1] + y0 - l.y) / 0.75) < lakeRadius(l, Math.atan2((b.mid[k][1] + y0 - l.y) / 0.75, b.mid[k][0] + x0 - l.x)) * 1.12 + b.w[k]);
    const wet = (k: number): boolean => lakes.some((l) => inLake(l, b.mid[k][0] + x0, b.mid[k][1] + y0));
    for (let k = 1; k < b.mid.length; k++) {
      if (!near(k) && !near(k - 1)) continue;
      g.fillStyle = WATER;
      g.beginPath(); g.moveTo(...b.left[k - 1]); g.lineTo(...b.left[k]); g.lineTo(...b.right[k]); g.lineTo(...b.right[k - 1]); g.closePath(); g.fill();
      g.strokeStyle = WATER; g.lineWidth = 0.8; g.stroke(); // no seam between the pieces
      if (!wet(k) && !wet(k - 1) && dry(r, b.idx[k])) {
        g.strokeStyle = BANK; g.lineWidth = 0.5;
        g.beginPath(); g.moveTo(...b.left[k - 1]); g.lineTo(...b.left[k]); g.moveTo(...b.right[k - 1]); g.lineTo(...b.right[k]); g.stroke();
      }
    }
  }
  // 6. waterfalls
  for (const r of near) for (const [fx, fy, dx, dy] of r.falls) {
    if (!inView(fx, fy, x0, y0, 30)) continue;
    let k = 1; while (k < r.points.length - 1 && Math.hypot(r.points[k][0] - fx, r.points[k][1] - fy) > 1) k++;
    drawFall(g, fx - x0, fy - y0, dx, dy, r.widths[k], hash2(Math.round(wrapX(fx)), Math.round(fy)));
  }
  g.strokeStyle = INK; g.setLineDash([]);
}

/** Intersection of segments ab and cd, as the parameter along ab, or -1. */
function cross(a: P, b: P, c: P, d: P): number {
  const r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]], den = r[0] * s[1] - r[1] * s[0];
  if (Math.abs(den) < 1e-9) return -1;
  const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den, u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : -1;
}

/** Stone bridges where roads cross rivers: drawn over the roads. */
export function drawBridges(g: CanvasRenderingContext2D, x0: number, y0: number, roads: Road[], rivers: River[]): void {
  const done: P[] = [];
  for (const road of roads) {
    if (road.maxX + M < x0 || road.minX - M > x0 + T || road.maxY + M < y0 || road.minY - M > y0 + T) continue;
    for (const r of rivers) {
      if (r.maxX < road.minX - 10 || r.minX > road.maxX + 10 || r.maxY < road.minY - 10 || r.minY > road.maxY + 10) continue;
      for (let i = 1; i < road.points.length; i++) {
        const a: P = [road.points[i - 1].x, road.points[i - 1].y], b: P = [road.points[i].x, road.points[i].y];
        if (!inView(a[0], a[1], x0, y0, 30)) continue;
        for (let k = 1; k < r.points.length; k++) {
          const c = r.points[k - 1], d = r.points[k];
          if (Math.max(c[0], d[0]) < Math.min(a[0], b[0]) || Math.min(c[0], d[0]) > Math.max(a[0], b[0]) || Math.max(c[1], d[1]) < Math.min(a[1], b[1]) || Math.min(c[1], d[1]) > Math.max(a[1], b[1])) continue;
          const t = cross(a, b, c, d);
          if (t < 0) continue;
          const X = a[0] + (b[0] - a[0]) * t, Y = a[1] + (b[1] - a[1]) * t;
          if (done.some(([px, py]) => Math.hypot(px - X, py - Y) < 12)) continue;
          done.push([X, Y]);
          const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L;
          drawBridge(g, X - x0, Y - y0, ux, uy, r.widths[k] + 7);
        }
      }
    }
  }
}

function drawBridge(g: CanvasRenderingContext2D, x: number, y: number, ux: number, uy: number, len: number): void {
  const vx = -uy, vy = ux, half = len / 2, W = 2.6;
  const at = (a: number, b: number): P => [x + ux * a + vx * b, y + uy * a + vy * b];
  // shadow on the water, then the deck
  g.fillStyle = 'rgba(42,36,29,.25)';
  g.beginPath(); g.moveTo(...at(-half + 1, W + 0.6)); g.lineTo(...at(half - 1, W + 0.6)); g.lineTo(...at(half - 1, W + 1.8)); g.lineTo(...at(-half + 1, W + 1.8)); g.closePath(); g.fill();
  g.fillStyle = 'rgb(206,192,164)'; g.strokeStyle = INK; g.lineWidth = 0.5;
  g.beginPath(); g.moveTo(...at(-half, -W)); g.lineTo(...at(half, -W)); g.lineTo(...at(half, W)); g.lineTo(...at(-half, W)); g.closePath(); g.fill(); g.stroke();
  // parapets, and the stones of the deck
  g.lineWidth = 0.8;
  for (const s of [-W, W]) { g.beginPath(); g.moveTo(...at(-half, s)); g.lineTo(...at(half, s)); g.stroke(); }
  g.lineWidth = 0.3;
  for (let a = -half + 2; a < half - 1; a += 2) { g.beginPath(); g.moveTo(...at(a, -W)); g.lineTo(...at(a, W)); g.stroke(); }
  // end posts
  g.fillStyle = INK;
  for (const a of [-half, half]) for (const s of [-W, W]) { g.beginPath(); g.arc(...at(a, s), 0.8, 0, 6.3); g.fill(); }
}

/**
 * Where the water is on a tile (rivers and lakes), on a 4-unit grid, so that plants and hills
 * are not drawn in it: drawn before the vegetation, the rivers then get trees leaning over them.
 */
export function waterMask(x0: number, y0: number, rivers: River[]): (x: number, y: number) => boolean {
  const C = 4, N = (T + 2 * M) / C, grid = new Uint8Array(N * N);
  const mark = (x: number, y: number, r: number): void => {
    const i0 = Math.floor((x - x0 + M - r) / C), i1 = Math.floor((x - x0 + M + r) / C), j0 = Math.floor((y - y0 + M - r) / C), j1 = Math.floor((y - y0 + M + r) / C);
    for (let j = Math.max(0, j0); j <= Math.min(N - 1, j1); j++) for (let i = Math.max(0, i0); i <= Math.min(N - 1, i1); i++) {
      if (Math.hypot((i + 0.5) * C - (x - x0 + M), (j + 0.5) * C - (y - y0 + M)) <= r + C * 0.3) grid[j * N + i] = 1;
    }
  };
  for (const r of rivers) {
    if (r.maxX + M < x0 || r.minX - M > x0 + T || r.maxY + M < y0 || r.minY - M > y0 + T) continue;
    for (let k = 0; k < r.points.length; k++) { const [x, y] = r.points[k]; if (inView(x, y, x0, y0)) mark(x, y, r.widths[k] / 2 - 0.5); }
    for (const l of r.lakes) {
      if (!inView(l.x, l.y, x0, y0, l.r * 1.5)) continue;
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if (inLake(l, x0 - M + (i + 0.5) * C, y0 - M + (j + 0.5) * C)) grid[j * N + i] = 1;
    }
  }
  return (x, y) => {
    const i = Math.floor((x - x0 + M) / C), j = Math.floor((y - y0 + M) / C);
    return i >= 0 && j >= 0 && i < N && j < N && grid[j * N + i] === 1;
  };
}
