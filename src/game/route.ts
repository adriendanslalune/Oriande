// The explorer's route to where the player tapped: straight when nothing is in the way,
// otherwise around the obstacles (A* on a grid, then straightened). Pure, no Phaser.
import { MOUNTAIN_ALTITUDE, TILE, altitude } from '../world/terrain';
import { beyondIce } from '../world/planet';
import { inLake, lakesNear, riversNear, type Lake } from '../world/rivers';
import { roadsAround } from '../world/roads';

/**
 * What the explorer can cross, by zones of the map: the lakes, and the ways through the
 * mountains (roads, and the valleys the rivers have cut). The ways are only worked out where
 * a mountain is actually met, so a walk across the plains costs nothing more.
 */
const ZONE = 1024, BUCKET = 64;
interface Zone { lakes: Lake[]; ways: Map<number, number[]> | null; mountains?: boolean }
const zones = new Map<number, Zone>();

function zoneOf(x: number, y: number): Zone {
  const zi = Math.floor(x / ZONE), zj = Math.floor(y / ZONE), key = zi * 1_000_003 + zj;
  let z = zones.get(key);
  if (!z) {
    if (zones.size > 400) zones.clear();
    z = { lakes: lakesNear(zi * ZONE - 8, zj * ZONE - 8, (zi + 1) * ZONE + 8, (zj + 1) * ZONE + 8), ways: null };
    zones.set(key, z);
  }
  return z;
}

/** Segments [ax, ay, bx, by, radius] of roads and rivers, bucketed over the zone. */
function waysOf(x: number, y: number): Map<number, number[]> {
  const z = zoneOf(x, y);
  if (z.ways) return z.ways;
  const zi = Math.floor(x / ZONE), zj = Math.floor(y / ZONE), x0 = zi * ZONE, y0 = zj * ZONE, per = ZONE / BUCKET;
  const ways = new Map<number, number[]>();
  const add = (ax: number, ay: number, bx: number, by: number, r: number): void => {
    const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - r - x0) / BUCKET)), i1 = Math.min(per - 1, Math.floor((Math.max(ax, bx) + r - x0) / BUCKET));
    const j0 = Math.max(0, Math.floor((Math.min(ay, by) - r - y0) / BUCKET)), j1 = Math.min(per - 1, Math.floor((Math.max(ay, by) + r - y0) / BUCKET));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const k = j * per + i;
      let list = ways.get(k);
      if (!list) ways.set(k, list = []);
      list.push(ax, ay, bx, by, r);
    }
  };
  const R = ZONE / TILE / 2 + 3;
  for (const road of roadsAround(Math.floor((x0 + ZONE / 2) / TILE), Math.floor((y0 + ZONE / 2) / TILE), R)) {
    if (road.maxX < x0 - 20 || road.minX > x0 + ZONE + 20 || road.maxY < y0 - 20 || road.minY > y0 + ZONE + 20) continue;
    const P = road.points;
    for (let k = 1; k < P.length; k++) add(P[k - 1].x, P[k - 1].y, P[k].x, P[k].y, 10);
  }
  for (const river of riversNear(x0, y0, x0 + ZONE, y0 + ZONE)) {
    const P = river.points, end = river.join >= 0 ? river.join : P.length - 1;
    for (let k = 1; k <= end; k++) add(P[k - 1][0], P[k - 1][1], P[k][0], P[k][1], river.widths[k] / 2 + 8);
  }
  z.ways = ways;
  return ways;
}

/** Whether (x, y) is on a road or along a river (a way through the mountains). */
function onWay(x: number, y: number): boolean {
  const ways = waysOf(x, y), zi = Math.floor(x / ZONE), zj = Math.floor(y / ZONE);
  const list = ways.get(Math.floor((y - zj * ZONE) / BUCKET) * (ZONE / BUCKET) + Math.floor((x - zi * ZONE) / BUCKET));
  if (!list) return false;
  for (let k = 0; k < list.length; k += 5) {
    const ax = list[k], ay = list[k + 1], bx = list[k + 2], by = list[k + 3], r = list[k + 4];
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1, u = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L2));
    if (Math.hypot(ax + dx * u - x, ay + dy * u - y) < r) return true;
  }
  return false;
}

/** Why the explorer cannot stand somewhere: water (sea, lake), the mountains, or the polar ice. */
export function obstacle(x: number, y: number, v = altitude(x, y)): 'water' | 'mountain' | 'ice' | null {
  if (beyondIce(y)) return 'ice';
  if (v < 0) return 'water';
  if (zoneOf(x, y).lakes.some((l) => inLake(l, x, y))) return 'water';
  if (v >= MOUNTAIN_ALTITUDE && !onWay(x, y)) return 'mountain';
  return null;
}

/**
 * Ground the explorer can walk on: not water (sea or lake), not the polar ice barrier, not the
 * mountains, except along a road or a river that runs through them.
 */
export const walkable = (x: number, y: number): boolean => obstacle(x, y) === null;

/** Whether the straight walk a-b stays on walkable ground (sampled every 4 units). */
export function clearWalk(ax: number, ay: number, bx: number, by: number): boolean {
  const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 4));
  for (let k = 1; k <= n; k++) if (!walkable(ax + (bx - ax) * k / n, ay + (by - ay) * k / n)) return false;
  return true;
}

export interface Route {
  /** polyline from the start to the end, world units */
  path: [number, number][];
  /** false when the target could not be reached (water, island, mountains): the route ends as near as it can */
  reached: boolean;
  /** what stopped it, when it was not reached */
  blocked?: 'water' | 'mountain' | 'ice';
}

const G = 12;
/** Search effort cap: a few tens of milliseconds on a phone. */
const MAX_EXPANDED = 40000;

/**
 * Work out, ahead of time, the ways through the mountains of one zone near (x, y) (within R
 * zones), nearest first, so that a tap there answers at once. Returns false when all are known.
 */
export function prefetchWays(x: number, y: number, R = 1): boolean {
  const zi = Math.floor(x / ZONE), zj = Math.floor(y / ZONE);
  for (let r = 0; r <= R; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
    if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
    const cx = (zi + di + 0.5) * ZONE, cy = (zj + dj + 0.5) * ZONE, z = zoneOf(cx, cy);
    if (z.ways) continue;
    // only where there are mountains to get through: elsewhere the ways are never asked for
    if (z.mountains === undefined) {
      z.mountains = false;
      for (let j = 0; j < 16 && !z.mountains; j++) for (let i = 0; i < 16; i++) if (altitude((zi + di) * ZONE + (i + 0.5) * ZONE / 16, (zj + dj) * ZONE + (j + 0.5) * ZONE / 16) >= MOUNTAIN_ALTITUDE) { z.mountains = true; break; }
    }
    if (!z.mountains) continue;
    waysOf(cx, cy);
    return true;
  }
  return false;
}

/** The walkable spot nearest to (x, y), looked for within r (null if none). */
function nearestWalkable(x: number, y: number, r: number): [number, number] | null {
  for (let d = 12; d <= r; d += 12) {
    const n = Math.max(8, Math.round(d / 6));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2, px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
      if (walkable(px, py)) return [px, py];
    }
  }
  return null;
}

/** Route from (x0, y0) to (x1, y1), or null if the explorer cannot get any closer. */
export function planRoute(x0: number, y0: number, x1: number, y1: number): Route | null {
  if (walkable(x1, y1) && clearWalk(x0, y0, x1, y1)) return { path: [[x0, y0], [x1, y1]], reached: true };
  // a tap on a mountain or in the water: aim for the foot of the mountain, or the shore, nearest
  // to that spot (much quicker to find than searching everything for the closest approach)
  const blocked = obstacle(x1, y1);
  if (blocked) {
    const near = nearestWalkable(x1, y1, 600);
    if (near && Math.hypot(near[0] - x0, near[1] - y0) > 4) {
      const r = planRoute(x0, y0, near[0], near[1]);
      if (r) return { path: r.path, reached: false, blocked };
    }
  }

  const d = Math.hypot(x1 - x0, y1 - y0), M = Math.min(900, Math.max(240, d * 0.6));
  const i0 = Math.floor((Math.min(x0, x1) - M) / G), i1 = Math.ceil((Math.max(x0, x1) + M) / G);
  const j0 = Math.floor((Math.min(y0, y1) - M) / G), j1 = Math.ceil((Math.max(y0, y1) + M) / G);
  const W = i1 - i0 + 1, H = j1 - j0 + 1, N = W * H;
  const alt = new Float32Array(N).fill(NaN);
  const land = (n: number): boolean => {
    if (Number.isNaN(alt[n])) alt[n] = altitude((n % W + i0) * G, (Math.floor(n / W) + j0) * G);
    // a small margin from the shore, so that two neighbouring nodes are never split by a thin
    // channel of water (the grid is coarser than the coast)
    if (alt[n] < 0.02) return false;
    const x = (n % W + i0) * G, y = (Math.floor(n / W) + j0) * G;
    // an explorer who stands in the mountains (an old save) may always climb down from there
    const o = obstacle(x, y, alt[n]);
    return o === null || (o === 'mountain' && Math.hypot(x - x0, y - y0) < 80);
  };
  const node = (x: number, y: number): number => (Math.round(y / G) - j0) * W + (Math.round(x / G) - i0);
  // start from the nearest walkable node the explorer can step to
  let start = -1;
  const si = Math.round(x0 / G), sj = Math.round(y0 / G);
  for (let r = 0; r <= 3 && start < 0; r++) for (let dj = -r; dj <= r && start < 0; dj++) for (let di = -r; di <= r; di++) {
    const n = (sj + dj - j0) * W + (si + di - i0);
    if (land(n) && (clearWalk(x0, y0, (si + di) * G, (sj + dj) * G) || obstacle(x0, y0) === 'mountain')) { start = n; break; }
  }
  if (start < 0) return null;
  const goal = node(x1, y1), gx = x1 / G, gy = y1 / G;
  const cost = new Float64Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), done = new Uint8Array(N);
  const heap: [number, number][] = [];
  const push = (f: number, n: number): void => {
    heap.push([f, n]);
    for (let k = heap.length - 1; k > 0;) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; }
  };
  const pop = (): [number, number] => {
    const top = heap[0], last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      for (let k = 0; ;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; }
    }
    return top;
  };
  // the closest node to the target found so far, in case the target cannot be reached
  let best = start, bestD = Infinity;
  cost[start] = 0;
  push(0, start);
  for (let expanded = 0; heap.length && expanded < MAX_EXPANDED;) {
    const [, n] = pop();
    if (done[n]) continue;
    done[n] = 1; expanded++;
    const ni = n % W + i0, nj = Math.floor(n / W) + j0, dg = Math.hypot(ni - gx, nj - gy);
    if (dg < bestD) { bestD = dg; best = n; }
    if (n === goal) break;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const mi = ni + di, mj = nj + dj;
      if (mi < i0 || mi > i1 || mj < j0 || mj > j1) continue;
      const m = (mj - j0) * W + (mi - i0);
      if (done[m] || !land(m)) continue;
      const c = cost[n] + (di && dj ? Math.SQRT2 : 1);
      if (c < cost[m]) { cost[m] = c; from[m] = n; push(c + 1.5 * Math.hypot(mi - gx, mj - gy), m); } // weighted: a near-shortest way, found much faster
    }
  }
  const reached = done[goal] === 1 && walkable(x1, y1);
  const end = reached ? goal : best;
  const grid: [number, number][] = [];
  for (let n = end; n >= 0; n = from[n]) grid.push([(n % W + i0) * G, (Math.floor(n / W) + j0) * G]);
  grid.reverse();
  const pts: [number, number][] = [[x0, y0], ...grid];
  if (reached && clearWalk(grid[grid.length - 1][0], grid[grid.length - 1][1], x1, y1)) pts.push([x1, y1]);
  // straighten: keep only the turns needed to stay on land
  const path: [number, number][] = [pts[0]];
  for (let i = 0; i < pts.length - 1;) {
    let j = pts.length - 1;
    while (j > i + 1 && !clearWalk(pts[i][0], pts[i][1], pts[j][0], pts[j][1])) j--;
    path.push(pts[j]);
    i = j;
  }
  const last = path[path.length - 1];
  if (Math.hypot(last[0] - x0, last[1] - y0) < 1) return null;
  return reached ? { path, reached } : { path, reached, blocked: obstacle(x1, y1) ?? 'water' };
}

/** Length of a polyline. */
export const pathLength = (path: [number, number][]): number =>
  path.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - path[i - 1][0], p[1] - path[i - 1][1]) : 0), 0);

/** Position at distance d along a polyline, and the direction of travel there. */
export function alongPath(path: [number, number][], d: number): { x: number; y: number; dx: number; dy: number } {
  for (let k = 1; k < path.length; k++) {
    const [ax, ay] = path[k - 1], [bx, by] = path[k], seg = Math.hypot(bx - ax, by - ay);
    if (d <= seg || k === path.length - 1) {
      const w = seg ? Math.min(1, Math.max(0, d / seg)) : 1;
      return { x: ax + (bx - ax) * w, y: ay + (by - ay) * w, dx: bx - ax, dy: by - ay };
    }
    d -= seg;
  }
  const [x, y] = path[path.length - 1];
  return { x, y, dx: 0, dy: 0 };
}
