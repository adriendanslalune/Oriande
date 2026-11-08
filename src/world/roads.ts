import { fbm, hash2 } from './noise';
import { CIRCUMFERENCE } from './planet';
import { altitude, MOUNTAIN_ALTITUDE, ROAD_MAX_ALTITUDE } from './terrain';
import { settlement, type Settlement } from './settlements';

export interface Point { x: number; y: number }

export interface Road {
  p: Settlement;
  q: Settlement;
  /** the road as a polyline from p to q, world units */
  points: Point[];
  /** cumulative length at each point; the last one is the road's length */
  lengths: number[];
  /** bounding box, world units */
  minX: number; minY: number; maxX: number; maxY: number;
  /** touches a city: drawn wider */
  major: boolean;
}

/** Roads keep to dry land; they may cross a low ridge through a pass, never high mountains. */
export const passable = (v: number): boolean => v > 0.005 && v < ROAD_MAX_ALTITUDE;

/** A detour is not worth a road beyond this many times the straight distance. */
const MAX_DETOUR = 1.8;

const linkMemo = new Map<string, Settlement[]>();

/**
 * The settlements a settlement is linked to by road, nearest first: its relative neighbours
 * (see below) that an actual road can reach around mountains and water.
 */
export function neighbours(b: Settlement): Settlement[] {
  const known = linkMemo.get(b.rkey);
  if (known) return known;
  const cands: [number, Settlement][] = [];
  for (let dj = -4; dj <= 4; dj++) for (let di = -4; di <= 4; di++) {
    if (!di && !dj) continue;
    const o = settlement(b.ti + di, b.tj + dj);
    if (!o) continue;
    const d = Math.hypot(o.x - b.x, o.y - b.y);
    if (d < 980) cands.push([d, o]);
  }
  cands.sort((p, q) => p[0] - q[0]);
  const out: Settlement[] = [];
  for (const [d, o] of cands) {
    // the relative neighbourhood rule: no other town closer to both. The network is then
    // symmetric and planar: roads meet in towns instead of crossing in the fields.
    if (cands.some(([dc, c]) => dc < d && c !== o && Math.hypot(c.x - o.x, c.y - o.y) < d)) continue;
    // no link across the sea (straight line, 9 samples)...
    let sea = false;
    for (let k = 1; k < 10; k++) {
      const u = k / 10;
      if (altitude(b.x + (o.x - b.x) * u, b.y + (o.y - b.y) * u) < 0) { sea = true; break; }
    }
    // ...and there must be an actual road, around mountains and water
    if (!sea && roadPath(b, o)) out.push(o);
  }
  linkMemo.set(b.rkey, out);
  return out;
}

export const firstNeighbour = (b: Settlement): Settlement | null => neighbours(b)[0] || null;

/** The proto's road shape between two settlements: a gentle curve, always the same. */
export function roadCurve(a: Settlement, b: Settlement): [Settlement, Settlement, Point] {
  const [p, q] = a.key < b.key ? [a, b] : [b, a];
  const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2, nx = -(q.y - p.y), ny = q.x - p.x;
  const k = (hash2(p.wi * 3 + q.wi, p.tj * 5 + q.tj) - 0.5) * 0.35;
  return [p, q, { x: mx + nx * k, y: my + ny * k }];
}

/** Point at parameter u in [0, 1] along the proto's curve. */
export const pointOnCurve = (p: Point, q: Point, c: Point, u: number): Point => ({
  x: (1 - u) * (1 - u) * p.x + 2 * (1 - u) * u * c.x + u * u * q.x,
  y: (1 - u) * (1 - u) * p.y + 2 * (1 - u) * u * c.y + u * u * q.y,
});

/** Whether the straight segment a-b stays on passable ground (sampled every 6 units). */
function clear(a: Point, b: Point): boolean {
  const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 6));
  for (let k = 1; k <= n; k++) if (!passable(altitude(a.x + (b.x - a.x) * k / n, a.y + (b.y - a.y) * k / n))) return false;
  return true;
}

const length = (pts: Point[]): number => pts.reduce((s, p, i) => (i ? s + Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y) : 0), 0);

const pathMemo = new Map<string, Point[] | null>();

/**
 * The road between two settlements as a polyline from the first (by key) to the second, or null
 * if there is no reasonable way. The proto's curve is kept when it avoids mountains and water;
 * otherwise the road goes around them.
 */
export function roadPath(a: Settlement, b: Settlement): Point[] | null {
  const [p, q, c] = roadCurve(a, b);
  const key = p.rkey + '|' + q.rkey;
  const known = pathMemo.get(key);
  if (known !== undefined) return known;
  let out: Point[] | null = [];
  for (let k = 0; k <= 48; k++) out.push(pointOnCurve(p, q, c, k / 48));
  if (!out.every((pt, k) => k === 0 || clear(out![k - 1], pt))) {
    out = detour(p, q);
    if (out && length(out) > MAX_DETOUR * Math.hypot(q.x - p.x, q.y - p.y)) out = null;
  }
  pathMemo.set(key, out);
  return out;
}

// ---- detours: A* on a world grid, then straightened and rounded ----

const G = 16;
const altMemo = new Map<number, number>();
/** Altitude at grid node (i, j), cached: neighbouring roads share most of their grid. */
function gridAlt(i: number, j: number): number {
  const k = (i + 1048576) * 2097152 + (j + 1048576);
  let v = altMemo.get(k);
  if (v === undefined) { v = altitude(i * G, j * G); altMemo.set(k, v); }
  return v;
}

/** Detours keep a small margin from the shore and the mountains (towns can sit right by both). */
const roomy = (v: number): boolean => v > 0.012 && v < ROAD_MAX_ALTITUDE - 0.012;

/** Cost of one unit of road on ground of altitude v: flat land is cheapest, passes are dear. */
const groundCost = (v: number): number => 1 + Math.max(0, v - 0.3) * 4 + (v >= MOUNTAIN_ALTITUDE ? 6 : 0);

function detour(p: Point, q: Point): Point[] | null {
  const M = 320;
  const i0 = Math.floor((Math.min(p.x, q.x) - M) / G), i1 = Math.ceil((Math.max(p.x, q.x) + M) / G);
  const j0 = Math.floor((Math.min(p.y, q.y) - M) / G), j1 = Math.ceil((Math.max(p.y, q.y) + M) / G);
  const W = i1 - i0 + 1, H = j1 - j0 + 1, N = W * H;
  const id = (i: number, j: number): number => (j - j0) * W + (i - i0);
  const nearest = (pt: Point): number => {
    const ci = Math.round(pt.x / G), cj = Math.round(pt.y / G);
    for (let r = 0; r <= 4; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      if (roomy(gridAlt(ci + di, cj + dj))) return id(ci + di, cj + dj);
    }
    return -1;
  };
  const start = nearest(p), goal = nearest(q);
  if (start < 0 || goal < 0) return null;
  const gi = goal % W + i0, gj = Math.floor(goal / W) + j0;
  const cost = new Float64Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), done = new Uint8Array(N);
  // binary heap of [f, node]
  const heap: number[][] = [];
  const push = (f: number, n: number): void => {
    heap.push([f, n]);
    for (let k = heap.length - 1; k > 0;) { const pk = (k - 1) >> 1; if (heap[pk][0] <= heap[k][0]) break; [heap[pk], heap[k]] = [heap[k], heap[pk]]; k = pk; }
  };
  const pop = (): number[] => {
    const top = heap[0], last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      for (let k = 0; ;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; }
    }
    return top;
  };
  cost[start] = 0;
  push(0, start);
  let expanded = 0;
  while (heap.length && expanded < 12000) {
    const [, n] = pop();
    if (done[n]) continue;
    done[n] = 1; expanded++;
    if (n === goal) break;
    const ni = n % W + i0, nj = Math.floor(n / W) + j0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const mi = ni + di, mj = nj + dj;
      if (mi < i0 || mi > i1 || mj < j0 || mj > j1) continue;
      const m = id(mi, mj);
      if (done[m]) continue;
      const v = gridAlt(mi, mj);
      if (!roomy(v)) continue;
      const c = cost[n] + (di && dj ? Math.SQRT2 : 1) * G * groundCost(v);
      if (c < cost[m]) { cost[m] = c; from[m] = n; push(c + Math.hypot(mi - gi, mj - gj) * G, m); }
    }
  }
  if (!done[goal]) return null;
  const grid: Point[] = [];
  for (let n = goal; n >= 0; n = from[n]) grid.push({ x: (n % W + i0) * G, y: (Math.floor(n / W) + j0) * G });
  grid.reverse();
  // straighten: keep only the turns needed to stay clear of mountains and water
  const pts = [p, ...grid, q], straight: Point[] = [p];
  for (let i = 0; i < pts.length - 1;) {
    let j = pts.length - 1;
    while (j > i + 1 && !clear(pts[i], pts[j])) j--;
    straight.push(pts[j]);
    i = j;
  }
  // round the corners (Chaikin), keeping both ends
  let out = straight;
  for (let it = 0; it < 2; it++) {
    const next: Point[] = [out[0]];
    for (let k = 0; k < out.length - 1; k++) {
      const a = out[k], b = out[k + 1];
      if (k > 0) next.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 });
      if (k < out.length - 2) next.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
    }
    next.push(out[out.length - 1]);
    // a rounding that would clip a mountain or the shore is not worth it
    if (!next.every((pt, k) => k === 0 || clear(next[k - 1], pt))) break;
    out = next;
  }
  return out;
}

const roadMemo = new Map<string, Road>();

/**
 * A real road winds: resample the line every few units and push each point sideways by a smooth
 * noise of its position (less near the towns), unless that would leave passable ground.
 */
function wind(points: Point[]): Point[] {
  const STEP = 8, A = 17, S = 75, out: Point[] = [points[0]];
  for (let k = 1; k < points.length; k++) {
    const a = points[k - 1], b = points[k], n = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / STEP));
    for (let m = 1; m <= n; m++) out.push({ x: a.x + (b.x - a.x) * m / n, y: a.y + (b.y - a.y) * m / n });
  }
  const total = out.length;
  return out.map((pt, k) => {
    if (k === 0 || k === total - 1) return pt;
    const pv = out[k - 1], nx = out[k + 1], dx = nx.x - pv.x, dy = nx.y - pv.y, L = Math.hypot(dx, dy) || 1;
    const fade = Math.min(1, k / 4, (total - 1 - k) / 4);
    const o = (fbm(pt.x / S, pt.y / S, 3, CIRCUMFERENCE / S) - 0.5) * 2 * A * fade;
    const w = { x: pt.x - (dy / L) * o, y: pt.y + (dx / L) * o };
    return passable(altitude(w.x, w.y)) ? w : pt;
  });
}

function makeRoad(a: Settlement, b: Settlement, raw: Point[]): Road {
  const [p, q] = a.key < b.key ? [a, b] : [b, a];
  const points = wind(raw);
  const lengths = [0];
  for (let k = 1; k < points.length; k++) lengths.push(lengths[k - 1] + Math.hypot(points[k].x - points[k - 1].x, points[k].y - points[k - 1].y));
  const xs = points.map((pt) => pt.x), ys = points.map((pt) => pt.y);
  return { p, q, points, lengths, minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys), major: p.city || q.city };
}

/** Point at fraction u in [0, 1] of a road's length. */
export function pointOnRoad(r: Road, u: number): Point {
  const L = r.lengths[r.lengths.length - 1], d = u * L;
  let k = 1;
  while (k < r.lengths.length - 1 && r.lengths[k] < d) k++;
  const a = r.points[k - 1], b = r.points[k], seg = r.lengths[k] - r.lengths[k - 1] || 1, w = (d - r.lengths[k - 1]) / seg;
  return { x: a.x + (b.x - a.x) * w, y: a.y + (b.y - a.y) * w };
}

/** Every road starting from a settlement within R tiles of (ti, tj), each listed once. */
export function roadsAround(ti: number, tj: number, R: number): Road[] {
  const out: Road[] = [];
  const seen = new Set<string>();
  for (let dj = -R; dj <= R; dj++) for (let di = -R; di <= R; di++) {
    const b = settlement(ti + di, tj + dj);
    if (!b) continue;
    for (const v of neighbours(b)) {
      const key = b.key < v.key ? b.rkey + '|' + v.rkey : v.rkey + '|' + b.rkey;
      if (seen.has(key)) continue;
      seen.add(key);
      let r = roadMemo.get(key);
      if (!r) { r = makeRoad(b, v, roadPath(b, v)!); roadMemo.set(key, r); }
      out.push(r);
    }
  }
  return out;
}
