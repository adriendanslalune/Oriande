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
  /** a tributary: from this point on it runs inside the river it joins (no banks); -1 if none */
  join: number;
  /** the grid nodes it flows through (keys, wrapped around the planet), and their point index */
  nodes: number[];
  at: number[];
  /** identity of the spring, to break ties */
  spring: number;
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
function trace(i: number, j: number, used: Set<number>): { nodes: [number, number][]; lakes: [number, number, number][]; lake: boolean; joins?: number } {
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
    if (used.has(nk(i, j))) return { nodes, lakes, lake: false, joins: nk(i, j) }; // joins a river: a tributary
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

/**
 * A river ends where it first reaches the sea. Its course is traced on a 64-unit grid, and
 * smoothing and meanders can carry it out over the water: along a low coast it may even cross a
 * bay. It is cut at its first real contact with the sea (two points in a row below sea level),
 * the last point put on the shoreline, a little past it so the water covers the coast's ink.
 */
function toCoast(pts: [number, number][]): [number, number][] {
  const sea = (k: number): boolean => altitude(pts[k][0], pts[k][1]) < 0;
  let c = -1;
  for (let k = 1; k < pts.length; k++) if (sea(k) && (k === pts.length - 1 || sea(k + 1))) { c = k; break; }
  if (c < 0) return pts; // ends in a lake, or on land
  const out = pts.slice(0, c + 1);
  const [ax, ay] = out[c - 1], [bx, by] = out[c];
  if (altitude(ax, ay) < 0) return out;
  // the shoreline between the last point on land and the first at sea
  let lo = 0, hi = 1;
  for (let k = 0; k < 14; k++) { const m = (lo + hi) / 2; if (altitude(ax + (bx - ax) * m, ay + (by - ay) * m) >= 0) lo = m; else hi = m; }
  const L = Math.hypot(bx - ax, by - ay) || 1, u = Math.min(1, hi + 1.5 / L);
  out[c] = [ax + (bx - ax) * u, ay + (by - ay) * u];
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
    const traced = trace(i, j, used), lake = traced.lake;
    if (traced.nodes.length < MIN_STEPS) continue;
    for (const [a, b] of traced.nodes) used.add(nk(a, b));
    const full = meander(smooth(traced.nodes.map(([a, b]) => [a * G, b * G] as [number, number]), 3));
    const points = toCoast(full);
    const n = points.length;
    // cut at the sea: the nodes (and the lakes, the falls) beyond the mouth go too
    const atFull = traced.nodes.map((_, k) => Math.round(k / Math.max(1, traced.nodes.length - 1) * (full.length - 1)));
    const last = atFull.findIndex((a) => a >= n - 1);
    const nodes = last < 0 ? traced.nodes : traced.nodes.slice(0, last + 1);
    if (nodes.length < 3) continue;
    const kept = new Set(nodes.map(([a, b]) => nk(a, b)));
    const lakes = traced.lakes.filter(([a, b]) => kept.has(nk(a, b)));
    const join = -1; // set by the network (see riversNear) when this river joins a bigger one
    // slope between nodes: a torrent where the river drops fast, a waterfall where it plunges
    const alts = nodes.map(([a, b]) => altitude(a * G, b * G));
    const nodeSteep = nodes.map((_, k) => k + 1 < nodes.length ? Math.max(0, alts[k] - alts[k + 1]) : 0);
    const steep = points.map((_, k) => Math.min(1, nodeSteep[Math.min(nodes.length - 1, Math.floor(k / Math.max(1, full.length - 1) * (traced.nodes.length - 1)))] / 0.08));
    const falls: [number, number, number, number][] = [];
    for (let k = 0, last = -99; k + 1 < nodes.length; k++) {
      if (nodeSteep[k] < 0.22 || alts[k + 1] < 0.05 || k - last < 12) continue;
      const pk = Math.round((k + 0.5) / (traced.nodes.length - 1) * (full.length - 1));
      if (pk > n - 2) break;
      const [x, y] = points[pk], [x2, y2] = points[pk + 1], L = Math.hypot(x2 - x, y2 - y) || 1;
      falls.push([x, y, (x2 - x) / L, (y2 - y) / L]);
      last = k;
    }
    const lengths = [0];
    for (let k = 1; k < n; k++) lengths.push(lengths[k - 1] + Math.hypot(points[k][0] - points[k - 1][0], points[k][1] - points[k - 1][1]));
    // width grows with the distance flowed: a brook at the spring, a broad river downstream
    const widths = points.map((_, k) => 1.2 + Math.min(9, lengths[k] / 380));
    const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
    const keys = nodes.map(([a, b]) => nk(wrapIndex(a, CIRCUMFERENCE / G), b));
    const at = nodes.map((_, k) => Math.min(n - 1, atFull[k])); // node -> point
    out.push({ points, widths, lengths, steep, falls, join, nodes: keys, at, spring: wrapIndex(gi, around) * 1e6 + gj, lake, lakes: lakes.map(([a, b, n]) => makeLake(a * G, b * G, n)).filter((l): l is Lake => !!l), minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) });
  }
  memo.set(rkey, out);
  return out;
}

/** How far a lake reaches from its centre at most (its radius is at most 70, its shore up to ×1.36). */
const LAKE_REACH = 100;

/** Lakes that may reach into the box [x0, x1] x [y0, y1]. */
export function lakesNear(x0: number, y0: number, x1: number, y1: number): Lake[] {
  const out: Lake[] = [];
  // a lake reaches past the river that made it (one at a river's end lies beyond its last points):
  // look for rivers as far around as the largest lake reaches
  const R = LAKE_REACH;
  for (const r of riversNear(x0 - R, y0 - R, x1 + R, y1 + R)) for (const l of r.lakes) if (l.x + l.r * 1.4 > x0 && l.x - l.r * 1.4 < x1 && l.y + l.r > y0 && l.y - l.r < y1 && !out.includes(l)) out.push(l);
  return out;
}

/** Rivers that may cross the box [x0, x1] x [y0, y1]. */
export function riversNear(x0: number, y0: number, x1: number, y1: number): River[] {
  const all: River[] = [];
  for (let cj = Math.floor(y0 / RIVER_CELL) - 2; cj <= Math.floor(y1 / RIVER_CELL) + 2; cj++)
    for (let ci = Math.floor(x0 / RIVER_CELL) - 2; ci <= Math.floor(x1 / RIVER_CELL) + 2; ci++)
      all.push(...riversOfCell(ci, cj));
  const net = network(all);
  return net.filter((r) => r.maxX + 6 > x0 && r.minX - 6 < x1 && r.maxY + 6 > y0 && r.minY - 6 < y1);
}

/** Rivers as drawn: each one cut where it joins a bigger river (cached per river). */
const joined = new WeakMap<River, River>();

/**
 * Where two rivers meet they share grid nodes from there on. The smaller one (less water flowed
 * so far at the meeting node) becomes a tributary: it ends on the bigger one. Rivers springing in
 * different cells are joined the same way, so no river is ever drawn twice in the same bed.
 */
function network(all: River[]): River[] {
  const owners = new Map<number, [River, number][]>();
  for (const r of all) {
    if (joined.has(r)) continue;
    r.nodes.forEach((key, k) => { const o = owners.get(key); if (o) o.push([r, k]); else owners.set(key, [[r, k]]); });
  }
  // 1. where does each river stop? at its first node shared with a bigger river
  const stop = new Map<River, number>();
  for (const a of all) {
    if (joined.has(a)) continue;
    let at = a.nodes.length;
    outer: for (let k = 0; k < a.nodes.length; k++) {
      for (const [b, kb] of owners.get(a.nodes[k]) ?? []) {
        if (b === a) continue;
        const aEnds = k === a.nodes.length - 1, bEnds = kb === b.nodes.length - 1;
        if (bEnds && !aEnds) continue; // b is the tributary there
        const upA = a.lengths[a.at[k]], upB = b.lengths[b.at[kb]];
        if (aEnds || upA < upB || (upA === upB && a.spring > b.spring)) { at = k; break outer; }
      }
    }
    stop.set(a, at);
  }
  // 2. cut it on the river that actually flows on at that node (the one not stopped there)
  const fresh: River[] = [];
  const res = all.map((a) => {
    const known = joined.get(a);
    if (known) return known;
    const k = stop.get(a)!;
    let r = a;
    if (k < a.nodes.length) {
      const flows = (owners.get(a.nodes[k]) ?? []).filter(([b, kb]) => b !== a && kb < (stop.get(b) ?? b.nodes.length));
      const top = flows.sort((p, q) => q[0].lengths[q[0].at[q[1]]] - p[0].lengths[p[0].at[p[1]]])[0];
      if (top) r = cut(a, a.at[k], top[0], top[0].at[top[1]]);
    }
    joined.set(a, r);
    fresh.push(a);
    return r;
  });
  // 3. two rivers whose beds cross without sharing a node (a diagonal step across another one, or
  // meanders pushing one over the other): the smaller one ends there, on the bigger one
  if (fresh.length) uncross(all, res, new Set(fresh));
  return all.map((a) => joined.get(a)!);
}

/** The part of a river drawn with its own banks (a tributary's last points run inside the other). */
const own = (r: River): number => (r.join >= 0 ? r.join : r.points.length - 1);

/**
 * Rivers drawn over one another without sharing a node (a diagonal step across another one, or
 * meanders pushing one onto the other): where the water of a river first touches the water of a
 * river carrying more (longer from its spring), it ends there, on it. Meanders move a river less
 * than half a grid step, so only rivers passing through neighbouring nodes can touch; and only
 * pairs with a river new in this batch are looked at (the others were settled before).
 */
function uncross(all: River[], current: River[], fresh: Set<River>): void {
  const at = new Map<number, number[]>(); // node -> [river index, node index, ...]
  all.forEach((r, ri) => r.nodes.forEach((key, k) => { const c = at.get(key); if (c) c.push(ri, k); else at.set(key, [ri, k]); }));
  let fx0 = Infinity, fy0 = Infinity, fx1 = -Infinity, fy1 = -Infinity; // where the new rivers lie
  for (const r of fresh) { fx0 = Math.min(fx0, r.minX); fy0 = Math.min(fy0, r.minY); fx1 = Math.max(fx1, r.maxX); fy1 = Math.max(fy1, r.maxY); }
  const NEXT = [-2_097_152 - 1, -2_097_152, -2_097_152 + 1, -1, 1, 2_097_152 - 1, 2_097_152, 2_097_152 + 1]; // the 8 neighbours (see nk)
  for (let pass = 0; pass < 2; pass++) {
    let changed = false;
    current.forEach((a, ai) => {
      const A = all[ai], aNew = fresh.has(A);
      if (!aNew && (a.maxX < fx0 - 80 || a.minX > fx1 + 80 || a.maxY < fy0 - 80 || a.minY > fy1 + 80)) return; // far from all the new ones
      const last = a.join >= 0 ? own(a) - 8 : own(a); // a tributary's mouth, on the river it joins, is fine
      let best = -1, bestN = -1, onto: River | null = null;
      for (let k = 0; k < A.nodes.length && best < 0; k++) {
        const m0 = Math.max(1, A.at[Math.max(0, k - 1)]), m1 = Math.min(last - 1, A.at[Math.min(A.nodes.length - 1, k + 1)]);
        if (m0 > m1) { if (A.at[k] > last) break; continue; }
        for (const d of NEXT) {
          const c = at.get(A.nodes[k] + d);
          if (!c) continue;
          for (let e = 0; e < c.length; e += 2) {
            const bi = c[e], kb = c[e + 1], B = all[bi], b = current[bi];
            if (bi === ai || (!aNew && !fresh.has(B))) continue;
            // the mouth of a tributary, where it already flows into a, is not a crossing either
            const n0 = B.at[Math.max(0, kb - 1)], n1 = Math.min(b.join >= 0 ? own(b) - 10 : own(b), B.at[Math.min(B.nodes.length - 1, kb + 1)]);
            for (let m = m0; m <= m1 && (best < 0 || m < best); m++) {
              const [x, y] = a.points[m];
              for (let n = n0; n <= n1; n++) {
                const [bx, by] = b.points[n];
                if (Math.hypot(bx - x, by - y) > (a.widths[m] + b.widths[n]) / 2) continue;
                if (n > own(b) - 10) continue; // b ends here, flowing into a: b is the one to stop
                // a ends here, flowing into b: it joins it, whatever their size; elsewhere the smaller one stops
                const upA = a.lengths[m], upB = b.lengths[n], aEnds = a.join < 0 && m > own(a) - 10;
                if (!aEnds && !(upA < upB || (upA === upB && a.spring > b.spring))) continue;
                if ([...a.lakes, ...b.lakes].some((l) => inLake(l, x, y))) continue; // they meet in a lake: nothing shows
                best = m; bestN = n; onto = b; break;
              }
            }
          }
        }
      }
      if (onto) { const r = cut(a, best, onto, bestN); current[ai] = r; joined.set(A, r); changed = true; }
    });
    if (!changed) return;
  }
}

/**
 * River a, cut where it reaches river b near its point pk (and b's point nb, if known): it ends on
 * b's middle, banks end at b's bank.
 */
function cut(a: River, pk: number, b: River, nb = -1): River {
  const n0 = nb < 0 ? 0 : Math.max(0, nb - 90), n1 = nb < 0 ? b.points.length : Math.min(b.points.length, nb + 90);
  // the nearest point of b: distance, position, width, and which side of b's course (x, y) lies on
  const near = (x: number, y: number): [number, number, number, number, number] => {
    let best: [number, number, number, number, number] = [Infinity, 0, 0, 1, 0], bm = n0;
    for (let m = n0; m < n1; m++) {
      const d = Math.hypot(b.points[m][0] - x, b.points[m][1] - y);
      if (d < best[0]) { best = [d, b.points[m][0], b.points[m][1], b.widths[m], 0]; bm = m; }
    }
    const P = b.points, p = P[Math.max(0, bm - 1)], q = P[Math.min(P.length - 1, bm + 1)];
    best[4] = Math.sign((q[0] - p[0]) * (y - best[2]) - (q[1] - p[1]) * (x - best[1]));
    return best;
  };
  let join = -1, end = -1, bestD = Infinity, bestI = pk, side = 0, lastD = Infinity;
  for (let i = Math.max(1, pk - 60); i < a.points.length && i <= pk + 60; i++) {
    const [d, , , w, sd] = near(a.points[i][0], a.points[i][1]);
    // it went over b's middle between two points (a slanting crossing): stop at the nearer one
    if (side && sd && sd !== side && Math.min(d, lastD) < w) { end = d < lastD ? i : i - 1; if (join < 0 || join > end) join = end; break; }
    side = sd || side; lastD = d;
    if (join < 0 && d < w / 2) { join = i; bestD = Infinity; } // from the bank on, look for the middle
    if (d < bestD) { bestD = d; bestI = i; }
    if (join >= 0 && d < w * 0.2) { end = i; break; }
    if (join >= 0 && i > join + 12) { end = bestI; break; } // it crossed between two points: the nearest one
  }
  if (end < 0) end = bestI;
  if (join < 0 || join > end) join = end;
  const [, mx, my] = near(a.points[end][0], a.points[end][1]);
  const points: [number, number][] = [...a.points.slice(0, end), [mx, my]];
  const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
  return {
    ...a, points, join,
    widths: a.widths.slice(0, end + 1), lengths: a.lengths.slice(0, end + 1), steep: a.steep.slice(0, end + 1),
    falls: a.falls.filter(([fx, fy]) => points.slice(0, join + 1).some(([x, y]) => Math.hypot(x - fx, y - fy) < 2)),
    lake: false,
    lakes: a.lakes.filter((l) => points.some(([x, y]) => Math.hypot(x - l.x, y - l.y) < l.r * 1.4)),
    minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys),
  };
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

/**
 * Whether (x, y) is within `margin` of a river's water or of a lake: monuments, wonders and
 * strange places keep off the water (a colossus once stood in a river). Uses the rivers of
 * the cells around, as they spring (cached), with the lakes along them.
 */
export function nearWater(x: number, y: number, margin: number): boolean {
  const ci = Math.floor(x / RIVER_CELL), cj = Math.floor(y / RIVER_CELL);
  for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) for (const r of riversOfCell(ci + di, cj + dj)) {
    const m = margin + 12;
    if (r.maxX + m < x || r.minX - m > x || r.maxY + m < y || r.minY - m > y) continue;
    for (const l of r.lakes) if (Math.hypot(l.x - x, l.y - y) < l.r * 1.4 + margin) return true;
    const P = r.points;
    for (let k = 1; k < P.length; k++) {
      const [ax, ay] = P[k - 1], [bx, by] = P[k];
      if (Math.min(ax, bx) - m > x || Math.max(ax, bx) + m < x || Math.min(ay, by) - m > y || Math.max(ay, by) + m < y) continue;
      const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1, u = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L2));
      if (Math.hypot(ax + dx * u - x, ay + dy * u - y) < r.widths[k] / 2 + margin) return true;
    }
  }
  return false;
}
