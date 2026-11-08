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
