import { describe, expect, it } from 'vitest';
import { riversOfCell, riversNear, RIVER_CELL } from './rivers';
import { altitude, drainage } from './terrain';
import { CIRCUMFERENCE } from './planet';
import { startPosition } from '../game/travel';

const s = startPosition(), ci = Math.floor(s.x / RIVER_CELL), cj = Math.floor(s.y / RIVER_CELL);

describe('rivers', () => {
  it('there are many of them around the start, from springs in the hills', () => {
    const rs = riversOfCell(ci, cj);
    expect(rs.length).toBeGreaterThan(20);
    for (const r of rs) expect(altitude(r.points[0][0], r.points[0][1])).toBeGreaterThan(0.2);
  });

  it('they go down to the sea, join another river, or end in a lake; never stop halfway', () => {
    let sea = 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) for (const r of riversOfCell(ci + di, cj + dj)) {
      const [x, y] = r.points[r.points.length - 1];
      if (altitude(x, y) < 0) sea++;
      // the broad slope never rises much along a river (lakes spill over low passes only)
      const d0 = drainage(r.points[0][0], r.points[0][1]), d1 = drainage(x, y);
      expect(d1).toBeLessThan(d0 + 0.05);
    }
    expect(sea).toBeGreaterThan(5);
  });

  it('never run out over the sea: they end on the shore', () => {
    const { x, y } = startPosition();
    let mouths = 0;
    for (const r of riversNear(x - 6000, y - 6000, x + 6000, y + 6000)) {
      for (let k = 1; k < r.points.length - 1; k++) expect(altitude(r.points[k][0], r.points[k][1]) < 0 && altitude(r.points[k + 1][0], r.points[k + 1][1]) < 0).toBe(false);
      const [ex, ey] = r.points[r.points.length - 1], [px, py] = r.points[r.points.length - 2];
      if (altitude(ex, ey) < 0) { mouths++; expect(altitude(px, py)).toBeGreaterThanOrEqual(0); expect(altitude(ex, ey)).toBeGreaterThan(-0.05); }
    }
    expect(mouths).toBeGreaterThan(5);
  });

  it('are smooth: no long straight stretch', () => {
    for (const r of riversOfCell(ci, cj)) for (let k = 1; k < r.points.length; k++) {
      expect(Math.hypot(r.points[k][0] - r.points[k - 1][0], r.points[k][1] - r.points[k - 1][1])).toBeLessThan(30);
    }
  });

  it('widen downstream', () => {
    for (const r of riversOfCell(ci, cj)) expect(r.widths[r.widths.length - 1]).toBeGreaterThanOrEqual(r.widths[0]);
  });

  it('are the same on every lap around the planet', () => {
    const N = CIRCUMFERENCE / RIVER_CELL;
    const a = riversOfCell(ci, cj), b = riversOfCell(ci + N, cj);
    expect(b.length).toBe(a.length);
    for (let k = 0; k < a.length; k++) {
      expect(b[k].points.length).toBe(a[k].points.length);
      expect(b[k].points[5][0] - a[k].points[5][0]).toBeCloseTo(CIRCUMFERENCE, 4);
      expect(b[k].points[5][1]).toBeCloseTo(a[k].points[5][1], 4);
    }
    expect(riversNear(s.x - 10, s.y - 10, s.x + 10, s.y + 10)).toBeInstanceOf(Array);
  });
});

describe('lakes and towns', () => {
  it('no town stands in a lake, no lake covers a road, no town in the mountains', async () => {
    const { inLake, lakesNear } = await import('./rivers');
    const { settlement } = await import('./settlements');
    const { roadsAround } = await import('./roads');
    const { TILE, MOUNTAIN_ALTITUDE } = await import('./terrain');
    // the lakes as drawn (a lake on a stretch of river cut off at a confluence is gone)
    const lakes = lakesNear((ci - 1) * RIVER_CELL, (cj - 1) * RIVER_CELL, (ci + 2) * RIVER_CELL, (cj + 2) * RIVER_CELL);
    expect(lakes.length).toBeGreaterThan(10);
    const ti0 = Math.floor(s.x / TILE), tj0 = Math.floor(s.y / TILE);
    let towns = 0;
    for (let tj = tj0 - 40; tj <= tj0 + 40; tj++) for (let ti = ti0 - 40; ti <= ti0 + 40; ti++) {
      const b = settlement(ti, tj);
      if (!b) continue;
      towns++;
      expect(lakes.some((l) => inLake(l, b.x, b.y))).toBe(false);
      expect(altitude(b.x, b.y)).toBeLessThan(MOUNTAIN_ALTITUDE);
    }
    expect(towns).toBeGreaterThan(50);
    for (const road of roadsAround(ti0, tj0, 12)) for (const p of road.points) expect(lakes.some((l) => inLake(l, p.x, p.y))).toBe(false);
  }, 120000);
});

describe('confluences', () => {
  it('no two rivers share a bed: past a meeting, only the bigger one goes on', () => {
    const rs = riversNear(s.x - 3000, s.y - 3000, s.x + 3000, s.y + 3000);
    const seen = new Map<string, number>();
    let tribs = 0;
    rs.forEach((r, ri) => {
      if (r.join >= 0) tribs++;
      // sample points well before the end: no other river runs through the same spot
      for (let k = 0; k < r.points.length - 12; k += 6) {
        const key = Math.round(r.points[k][0] / 6) + ',' + Math.round(r.points[k][1] / 6);
        const o = seen.get(key);
        if (o !== undefined && o !== ri) throw new Error(`rivers ${o} and ${ri} overlap at ${r.points[k]}`);
        seen.set(key, ri);
      }
    });
    expect(tribs).toBeGreaterThan(5);
  }, 120000);

  it('a tributary ends in the middle of the river it joins', () => {
    const rs = riversNear(s.x - 3000, s.y - 3000, s.x + 3000, s.y + 3000);
    let checked = 0;
    for (const r of rs) {
      if (r.join < 0) continue;
      const [x, y] = r.points[r.points.length - 1];
      if (Math.abs(x - s.x) > 2000 || Math.abs(y - s.y) > 2000) continue; // its river may lie outside the box
      checked++;
      const d = Math.min(...rs.filter((o) => o !== r).flatMap((o) => o.points.map(([a, b]) => Math.hypot(a - x, b - y))));
      expect(d).toBeLessThan(1);
    }
    expect(checked).toBeGreaterThan(3);
  }, 120000);
});
