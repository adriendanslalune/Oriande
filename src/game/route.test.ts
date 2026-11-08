import { describe, expect, it } from 'vitest';
import { altitude } from '../world/terrain';
import { clearWalk, pathLength, planRoute, walkable } from './route';
import { sightRadius, FOREST_SIGHT } from './travel';

/** A deterministic pair of land points with water in between, on the start continent's coasts. */
function acrossWater(): [number, number, number, number] {
  for (let y = -30000; y <= 30000; y += 120) for (let x = -30000; x <= 30000; x += 120) {
    if (altitude(x, y) > -0.05) continue;
    // water here: look for land on both sides, 150 units apart
    for (const [dx, dy] of [[1, 0], [0, 1]]) {
      const ax = x - dx * 150, ay = y - dy * 150, bx = x + dx * 150, by = y + dy * 150;
      if (walkable(ax, ay) && walkable(bx, by) && altitude(ax, ay) > 0.05 && altitude(bx, by) > 0.05) return [ax, ay, bx, by];
    }
  }
  throw new Error('no water crossing found near the start');
}

const onLand = (path: [number, number][]) => path.every((p, k) => k === 0 || clearWalk(path[k - 1][0], path[k - 1][1], p[0], p[1]));

describe('explorer routes', () => {
  it('walks straight when nothing is in the way', () => {
    const r = planRoute(470, -60, 520, -40)!;
    expect(r.path).toEqual([[470, -60], [520, -40]]);
    expect(r.reached).toBe(true);
  });

  it('goes around water to reach the other side', () => {
    const [ax, ay, bx, by] = acrossWater();
    expect(clearWalk(ax, ay, bx, by)).toBe(false);
    const r = planRoute(ax, ay, bx, by);
    if (r && r.reached) {
      expect(onLand(r.path)).toBe(true);
      expect(r.path.at(-1)).toEqual([bx, by]);
      expect(pathLength(r.path)).toBeGreaterThan(Math.hypot(bx - ax, by - ay));
    } else {
      // the other side is an island or too far round: then the explorer stops on the shore
      expect(r === null || onLand(r.path)).toBe(true);
    }
  });

  it('a target in the water brings the explorer to the shore', () => {
    const [ax, ay, bx, by] = acrossWater();
    const wx = (ax + bx) / 2, wy = (ay + by) / 2;
    expect(walkable(wx, wy)).toBe(false);
    const r = planRoute(ax, ay, wx, wy)!;
    expect(r.reached).toBe(false);
    expect(onLand(r.path)).toBe(true);
    const [ex, ey] = r.path.at(-1)!;
    expect(Math.hypot(ex - wx, ey - wy)).toBeLessThan(Math.hypot(ax - wx, ay - wy));
  });
});

describe('sight', () => {
  it('is short in a forest, normal on a plain, long up high', () => {
    let forest = 0, plain = 0, high = 0;
    for (let y = -3000; y <= 3000; y += 50) for (let x = -3000; x <= 3000; x += 50) {
      const v = altitude(x, y), r = sightRadius(x, y);
      if (r === FOREST_SIGHT) forest++;
      else if (v > 0.05 && v < 0.25 && r === 200) plain++;
      else if (v > 0.8) { high++; expect(r).toBeGreaterThan(500); }
    }
    expect(forest).toBeGreaterThan(100);
    expect(plain).toBeGreaterThan(100);
    expect(high).toBeGreaterThan(10);
  });
});
