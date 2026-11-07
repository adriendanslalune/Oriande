import { hash2 } from './noise';
import { altitude } from './terrain';
import { settlement, type Settlement } from './settlements';

export interface Point { x: number; y: number }

export interface Road {
  p: Settlement;
  q: Settlement;
  /** quadratic Bézier control point */
  c: Point;
  /** touches a city: drawn as a double line */
  major: boolean;
}

const memo = new Map<string, Settlement[]>();

/** The settlements a settlement is linked to by road: nearest first, never across the sea. */
export function neighbours(b: Settlement): Settlement[] {
  const known = memo.get(b.key);
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
  for (const [, o] of cands) {
    if (out.length >= (b.city ? 4 : 3)) break;
    let sea = false;
    for (let k = 1; k < 10; k++) {
      const u = k / 10;
      if (altitude(b.x + (o.x - b.x) * u, b.y + (o.y - b.y) * u) < 0) { sea = true; break; }
    }
    if (!sea) out.push(o);
  }
  memo.set(b.key, out);
  return out;
}

export const firstNeighbour = (b: Settlement): Settlement | null => neighbours(b)[0] || null;

/** The shape of the road between two settlements: a gentle curve, always the same. */
export function roadCurve(a: Settlement, b: Settlement): [Settlement, Settlement, Point] {
  const [p, q] = a.key < b.key ? [a, b] : [b, a];
  const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2, nx = -(q.y - p.y), ny = q.x - p.x;
  const k = (hash2(p.ti * 3 + q.ti, p.tj * 5 + q.tj) - 0.5) * 0.35;
  return [p, q, { x: mx + nx * k, y: my + ny * k }];
}

/** Point at parameter u in [0, 1] along a road. */
export const pointOnRoad = (p: Point, q: Point, c: Point, u: number): Point => ({
  x: (1 - u) * (1 - u) * p.x + 2 * (1 - u) * u * c.x + u * u * q.x,
  y: (1 - u) * (1 - u) * p.y + 2 * (1 - u) * u * c.y + u * u * q.y,
});

/** Every road starting from a settlement within R tiles of (ti, tj), each listed once. */
export function roadsAround(ti: number, tj: number, R: number): Road[] {
  const out: Road[] = [];
  const seen = new Set<string>();
  for (let dj = -R; dj <= R; dj++) for (let di = -R; di <= R; di++) {
    const b = settlement(ti + di, tj + dj);
    if (!b) continue;
    for (const v of neighbours(b)) {
      const key = b.key < v.key ? b.key + '|' + v.key : v.key + '|' + b.key;
      if (seen.has(key)) continue;
      seen.add(key);
      const [p, q, c] = roadCurve(b, v);
      out.push({ p, q, c, major: b.city || v.city });
    }
  }
  return out;
}
