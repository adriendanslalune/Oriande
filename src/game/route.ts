// The explorer's route to where the player tapped: straight when nothing is in the way,
// otherwise around the obstacles (A* on a grid, then straightened). Pure, no Phaser.
import { altitude } from '../world/terrain';

/** Ground the explorer can walk on. Only water stops them for now. */
export const walkable = (x: number, y: number): boolean => altitude(x, y) >= 0;

/** Whether the straight walk a-b stays on walkable ground (sampled every 4 units). */
export function clearWalk(ax: number, ay: number, bx: number, by: number): boolean {
  const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 4));
  for (let k = 1; k <= n; k++) if (!walkable(ax + (bx - ax) * k / n, ay + (by - ay) * k / n)) return false;
  return true;
}

export interface Route {
  /** polyline from the start to the end, world units */
  path: [number, number][];
  /** false when the target could not be reached (water, island): the route ends at the nearest shore */
  reached: boolean;
}

const G = 12;
/** Search effort cap: a few tens of milliseconds on a phone. */
const MAX_EXPANDED = 40000;

/** Route from (x0, y0) to (x1, y1), or null if the explorer cannot get any closer. */
export function planRoute(x0: number, y0: number, x1: number, y1: number): Route | null {
  if (walkable(x1, y1) && clearWalk(x0, y0, x1, y1)) return { path: [[x0, y0], [x1, y1]], reached: true };

  const d = Math.hypot(x1 - x0, y1 - y0), M = Math.min(900, Math.max(240, d * 0.6));
  const i0 = Math.floor((Math.min(x0, x1) - M) / G), i1 = Math.ceil((Math.max(x0, x1) + M) / G);
  const j0 = Math.floor((Math.min(y0, y1) - M) / G), j1 = Math.ceil((Math.max(y0, y1) + M) / G);
  const W = i1 - i0 + 1, H = j1 - j0 + 1, N = W * H;
  const alt = new Float32Array(N).fill(NaN);
  const land = (n: number): boolean => {
    if (Number.isNaN(alt[n])) alt[n] = altitude((n % W + i0) * G, (Math.floor(n / W) + j0) * G);
    return alt[n] >= 0;
  };
  const node = (x: number, y: number): number => (Math.round(y / G) - j0) * W + (Math.round(x / G) - i0);
  // start from the nearest walkable node the explorer can step to
  let start = -1;
  const si = Math.round(x0 / G), sj = Math.round(y0 / G);
  for (let r = 0; r <= 3 && start < 0; r++) for (let dj = -r; dj <= r && start < 0; dj++) for (let di = -r; di <= r; di++) {
    const n = (sj + dj - j0) * W + (si + di - i0);
    if (land(n) && clearWalk(x0, y0, (si + di) * G, (sj + dj) * G)) { start = n; break; }
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
      if (c < cost[m]) { cost[m] = c; from[m] = n; push(c + Math.hypot(mi - gx, mj - gy), m); }
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
  return { path, reached };
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
