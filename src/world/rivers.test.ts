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
    const { inLake } = await import('./rivers');
    const { settlement } = await import('./settlements');
    const { roadsAround } = await import('./roads');
    const { TILE, MOUNTAIN_ALTITUDE } = await import('./terrain');
    const lakes = [];
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) for (const r of riversOfCell(ci + di, cj + dj)) lakes.push(...r.lakes);
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
