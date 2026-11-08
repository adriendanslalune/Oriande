// Rivers: born in the hills and mountains, they follow the steepest slope down a grid until they
// reach the sea, or end in a lake when they fall into a hollow. Rivers that meet share the same
// grid nodes from there on, so they merge into one. Deterministic, and periodic around the
// planet: sources are drawn with wrapped indices, traces run on the (periodic) terrain.
import { fbm, hash2 } from './noise';
import { altitude, drainage, TILE } from './terrain';
import { settlement } from './settlements';
import { CIRCUMFERENCE, beyondIce, wrapIndex } from './planet';

/** Rivers are computed and cached per cell of this size (32 tiles). */
export const RIVER_CELL = 8192;
/** One candidate spring per square of this size. */
const SOURCE_STEP = 512;
/** Grid of the descent: rivers that reach the same node merge. */
const G = 64; // divides the circumference
/** A river longer than this (grid steps) is cut; it never reaches more than 2 cells beyond its own. */
const MAX_STEPS = Math.floor(RIVER_CELL * 2 / G);
/** Shorter traces are dropped (a trickle into a hollow is not a river). */
const MIN_STEPS = 12;

export interface River {
  /** the river from its spring down to its mouth, smoothed, world units */
  points: [number, number][];
  /** width at each point, tile units: a trickle near the spring, wide near the mouth */
  widths: number[];
  /** ends in a lake (a hollow) rather than in the sea */
  lake: boolean;
  /** distance along the river at each point, world units */
  lengths: number[];
  /** how fast the water runs at each point, 0 (calm) to 1 (a mountain torrent) */
  steep: number[];
  /** waterfalls: [x, y, dx, dy] where the river drops over a ledge, flowing along (dx, dy) */
  falls: [number, number, number, number][];
  /** lakes along the way and at the end (see lakeRadius for their shape) */
  lakes: Lake[];
  minX: number; maxX: number; minY: number; maxY: number;
}

/** A lake: centre, mean radius (world units) and a seed for its irregular shore. */
export interface Lake { x: number; y: number; r: number; seed: number }

/** Radius of a lake's shore in direction `a` (radians): an irregular, smooth outline. */
export function lakeRadius(l: Lake, a: number): number {
  let k = 1;
  for (let h = 1; h <= 3; h++) k += Math.sin(a * (h + 1) + l.seed * (7 + h * 3)) * 0.12 / h;
  return l.r * k;
}

/** Whether (x, y) lies in the lake (the outline is flattened north-south like the map). */
export function inLake(l: Lake, x: number, y: number): boolean {
  const dx = x - l.x, dy = (y - l.y) / 0.75;
  return Math.hypot(dx, dy) < lakeRadius(l, Math.atan2(dy, dx));
}

/**
 * A lake in the hollow at (x, y) of `cells` flooded grid cells, kept clear of towns (they stand
 * on dry land, so the lake shrinks or disappears). Null when there is no room for one.
 */
function makeLake(x: number, y: number, cells: number): Lake | null {
  let r = Math.min(70, 10 + Math.sqrt(cells) * 7);
  const ti = Math.floor(x / TILE), tj = Math.floor(y / TILE);
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
    const b = settlement(ti + di, tj + dj);
    if (b) r = Math.min(r, (Math.hypot(b.x - x, (b.y - y) / 0.75) - (b.city ? 60 : 30)) / 1.4);
  }
  if (r < 9) return null;
  return { x, y, r, seed: hash2(wrapIndex(Math.round(x), CIRCUMFERENCE), Math.round(y)) * 100 };
}

const memo = new Map<string, River[]>();
const nodeMemo = new Map<number, number>();
/** A numeric key for grid node (i, j): |i| < 2^20 around the planet, |j| < 2^20. */
const nk = (i: number, j: number): number => (i + 1_048_576) * 2_097_152 + (j + 1_048_576);

/** Drainage level at grid node (i, j) (+ a tiny tie-breaker), cached: rivers share nodes. */
function level(i: number, j: number): number {
  const k = nk(i, j);
  let v = nodeMemo.get(k);
  if (v === undefined) {
    v = beyondIce(j * G) ? 9 : drainage(i * G, j * G) + hash2(wrapIndex(i, CIRCUMFERENCE / G), j) * 1e-4;
    if (nodeMemo.size > 400_000) nodeMemo.clear();
    nodeMemo.set(k, v);
  }
  return v;
}

/** How far around a hollow the river looks for a way out (grid steps). */
/** A hollow larger than this (grid cells flooded) gives up: the river ends in a lake. */
const MAX_FLOOD = 2500;
/** A filled hollow of at least this many cells is drawn as a lake. */
const LAKE_CELLS = 3;

/**
 * Water in a hollow at (i, j): it fills the hollow and spills over its lowest pass. Flood from
 * the hollow, always rising by the lowest edge, until reaching ground lower than the hollow:
 * the way there goes over the pass. Returns that way (from the hollow, excluded) and how many
 * cells were flooded, or null if the hollow is too big (the river ends in a lake).
 */
function spill(i: number, j: number): { way: [number, number][]; flooded: number } | null {
  const v0 = level(i, j), key = nk;
  const from = new Map<number, number>([[key(i, j), -1]]);
  const heap: [number, number, number][] = [[v0, i, j]];
  const push = (e: [number, number, number]): void => {
    heap.push(e);
    for (let k = heap.length - 1; k > 0;) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; }
  };
  const pop = (): [number, number, number] => {
    const top = heap[0], last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      for (let k = 0; ;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; }
    }
    return top;
  };
  let flooded = 0;
  while (heap.length && flooded < MAX_FLOOD) {
    const [, a, b] = pop();
    flooded++;
    if (level(a, b) < v0 && !(a === i && b === j)) {
      const way: [number, number][] = [];
      for (let k = key(a, b); k !== key(i, j); k = from.get(k)!) way.push([Math.floor(k / 2_097_152) - 1_048_576, (k % 2_097_152) - 1_048_576]);
      return { way: way.reverse(), flooded };
    }
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const k = key(a + di, b + dj);
      if (from.has(k)) continue;
      from.set(k, key(a, b));
      push([Math.max(level(a + di, b + dj), v0), a + di, b + dj]);
    }
  }
  return null;
}

/**
 * Follow the steepest slope from node (i, j) to the sea. In a hollow, the water fills it and
 * spills over its lowest pass (a lake if the hollow is big enough); a hollow too big to fill
 * ends the river in a lake.
 */
function trace(i: number, j: number, used: Set<number>): { nodes: [number, number][]; lakes: [number, number, number][]; lake: boolean } {
  const nodes: [number, number][] = [[i, j]], lakes: [number, number, number][] = [];
  let v = level(i, j);
  for (let step = 0; step < MAX_STEPS; step++) {
    let bi = i, bj = j, bv = Infinity;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const slope = (level(i + di, j + dj) - v) / (di && dj ? Math.SQRT2 : 1); // no zigzag
      if (slope < bv) { bv = slope; bi = i + di; bj = j + dj; }
    }
    if (bv >= 0) {
      const out = spill(i, j);
      if (!out) return { nodes, lakes: [...lakes, [i, j, MAX_FLOOD]], lake: true };
      if (out.flooded >= LAKE_CELLS) lakes.push([i, j, out.flooded]);
      nodes.push(...out.way);
      [i, j] = out.way[out.way.length - 1];
      v = level(i, j);
    } else {
      i = bi; j = bj; v = level(i, j);
      nodes.push([i, j]);
    }
    if (altitude(i * G, j * G) < 0) return { nodes, lakes, lake: false }; // the sea
    if (used.has(nk(i, j))) return { nodes, lakes, lake: false }; // joins a river: a tributary
  }
  return { nodes, lakes, lake: false };
}

/**
 * Meanders: each point is pushed sideways by a smooth noise of its position (so two rivers
 * running through the same place bend the same way), less near the ends.
 */
function meander(pts: [number, number][]): [number, number][] {
  const n = pts.length, A = 22, S = 160;
  return pts.map(([x, y], k) => {
    if (k === 0 || k === n - 1) return [x, y];
    const [px, py] = pts[k - 1], [qx, qy] = pts[k + 1], dx = qx - px, dy = qy - py, L = Math.hypot(dx, dy) || 1;
    const o = (fbm(x / S, y / S, 3, CIRCUMFERENCE / S) - 0.5) * 2 * A * Math.min(1, k / 12, (n - 1 - k) / 6);
    return [x - (dy / L) * o, y + (dx / L) * o];
  });
}

/** Rounded corners (Chaikin), both ends kept. */
function smooth(pts: [number, number][], rounds: number): [number, number][] {
  let out = pts;
  for (let r = 0; r < rounds; r++) {
    const next: [number, number][] = [out[0]];
    for (let k = 0; k < out.length - 1; k++) {
      const [ax, ay] = out[k], [bx, by] = out[k + 1];
      next.push([ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25], [ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75]);
    }
    next.push(out[out.length - 1]);
    out = next;
  }
  return out;
}

/** The rivers springing in cell (ci, cj). */
export function riversOfCell(ci: number, cj: number): River[] {
  const rkey = ci + ',' + cj;
  const known = memo.get(rkey);
  if (known) return known;
  const out: River[] = [], used = new Set<number>();
  const per = RIVER_CELL / SOURCE_STEP, around = CIRCUMFERENCE / SOURCE_STEP;
  for (let sj = 0; sj < per; sj++) for (let si = 0; si < per; si++) {
    const gi = ci * per + si, gj = cj * per + sj, wg = wrapIndex(gi, around);
    if (hash2(wg * 61 + 7, gj * 67 - 3) > 0.85) continue;
    // the spring: a node in the square, in the hills or mountains
    const x = (gi + 0.2 + hash2(wg * 13, gj * 17) * 0.6) * SOURCE_STEP, y = (gj + 0.2 + hash2(wg * 19, gj * 23) * 0.6) * SOURCE_STEP;
    const i = Math.round(x / G), j = Math.round(y / G), v = altitude(i * G, j * G);
    if (v < 0.22 || v > 1.1 || used.has(nk(i, j))) continue;
    const { nodes, lakes, lake } = trace(i, j, used);
    if (nodes.length < MIN_STEPS) continue;
    for (const [a, b] of nodes) used.add(nk(a, b));
    const points = meander(smooth(nodes.map(([a, b]) => [a * G, b * G] as [number, number]), 3));
    const n = points.length;
    // slope between nodes: a torrent where the river drops fast, a waterfall where it plunges
    const alts = nodes.map(([a, b]) => altitude(a * G, b * G));
    const nodeSteep = nodes.map((_, k) => k + 1 < nodes.length ? Math.max(0, alts[k] - alts[k + 1]) : 0);
    const steep = points.map((_, k) => Math.min(1, nodeSteep[Math.min(nodes.length - 1, Math.floor(k / (n - 1) * (nodes.length - 1)))] / 0.08));
    const falls: [number, number, number, number][] = [];
    for (let k = 0, last = -99; k + 1 < nodes.length; k++) {
      if (nodeSteep[k] < 0.22 || alts[k + 1] < 0.05 || k - last < 12) continue;
      const pk = Math.min(n - 2, Math.round((k + 0.5) / (nodes.length - 1) * (n - 1)));
      const [x, y] = points[pk], [x2, y2] = points[pk + 1], L = Math.hypot(x2 - x, y2 - y) || 1;
      falls.push([x, y, (x2 - x) / L, (y2 - y) / L]);
      last = k;
    }
    const lengths = [0];
    for (let k = 1; k < n; k++) lengths.push(lengths[k - 1] + Math.hypot(points[k][0] - points[k - 1][0], points[k][1] - points[k - 1][1]));
    // width grows with the distance flowed: a brook at the spring, a broad river downstream
    const widths = points.map((_, k) => 1.2 + Math.min(9, lengths[k] / 380));
    const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
    out.push({ points, widths, lengths, steep, falls, lake, lakes: lakes.map(([a, b, n]) => makeLake(a * G, b * G, n)).filter((l): l is Lake => !!l), minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) });
  }
  memo.set(rkey, out);
  return out;
}

/** Lakes that may reach into the box [x0, x1] x [y0, y1]. */
export function lakesNear(x0: number, y0: number, x1: number, y1: number): Lake[] {
  const out: Lake[] = [];
  for (const r of riversNear(x0, y0, x1, y1)) for (const l of r.lakes) if (l.x + l.r * 1.4 > x0 && l.x - l.r * 1.4 < x1 && l.y + l.r > y0 && l.y - l.r < y1 && !out.includes(l)) out.push(l);
  return out;
}

/** Rivers that may cross the box [x0, x1] x [y0, y1]. */
export function riversNear(x0: number, y0: number, x1: number, y1: number): River[] {
  const out: River[] = [];
  for (let cj = Math.floor(y0 / RIVER_CELL) - 2; cj <= Math.floor(y1 / RIVER_CELL) + 2; cj++)
    for (let ci = Math.floor(x0 / RIVER_CELL) - 2; ci <= Math.floor(x1 / RIVER_CELL) + 2; ci++)
      for (const r of riversOfCell(ci, cj)) if (r.maxX + 6 > x0 && r.minX - 6 < x1 && r.maxY + 6 > y0 && r.minY - 6 < y1) out.push(r);
  return out;
}

/**
 * Compute, ahead of time, one not-yet-known cell of rivers around (x, y) (within R cells),
 * nearest first. Called now and then while walking so that new rivers are ready before the
 * explorer gets there. Returns false when everything around is known.
 */
export function prefetchRivers(x: number, y: number, R = 3): boolean {
  const ci = Math.floor(x / RIVER_CELL), cj = Math.floor(y / RIVER_CELL);
  for (let r = 0; r <= R; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
    if (Math.max(Math.abs(di), Math.abs(dj)) !== r || memo.has((ci + di) + ',' + (cj + dj))) continue;
    riversOfCell(ci + di, cj + dj);
    return true;
  }
  return false;
}
