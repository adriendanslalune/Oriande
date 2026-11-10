// The planet: round east-west, poles north and south, climates by latitude, one start for all.
import { describe, expect, it } from 'vitest';
import { CIRCUMFERENCE, EQUATOR_Y, NORTH_POLE_Y, SOUTH_POLE_Y, latitude, longitude, nearestCopy, wrapX } from './planet';
import { altitude, humidity, TILE } from './terrain';
import { biome, temperature } from './climate';
import { settlement } from './settlements';
import { landmark } from './landmarks';
import { wonder, WONDER_CELL } from './wonders';
import { roadsAround } from './roads';
import { properName } from './names';
import { startPosition, cellKey } from '../game/travel';
import { walkable } from '../game/route';

const N = CIRCUMFERENCE / TILE;

describe('a round planet', () => {
  it('has no seam: everything repeats exactly once around the world', () => {
    for (let k = 0; k < 200; k++) {
      const x = (k * 7919) % CIRCUMFERENCE + 0.37, y = ((k * 104729) % 100000) - 50000;
      expect(altitude(x + CIRCUMFERENCE, y)).toBeCloseTo(altitude(x, y), 10);
      expect(humidity(x - CIRCUMFERENCE, y)).toBeCloseTo(humidity(x, y), 10);
      expect(temperature(x + CIRCUMFERENCE, y, 0.2)).toBeCloseTo(temperature(x, y, 0.2), 10);
    }
    // across longitude 180°: the two sides of x = 0 / x = C meet smoothly
    for (let y = -3000; y < 3000; y += 101) expect(Math.abs(altitude(CIRCUMFERENCE - 0.01, y) - altitude(0.01, y))).toBeLessThan(0.01);
  });

  it('towns, places, wonders, roads and names are the same on every lap', () => {
    for (let tj = -6; tj <= 6; tj++) for (const ti of [0, 1, 2, N - 1, N - 2]) {
      const a = settlement(ti, tj), b = settlement(ti + N, tj);
      expect(b?.name).toBe(a?.name);
      expect(b?.key).toBe(a?.key);
      if (a && b) expect(b.x - a.x).toBeCloseTo(CIRCUMFERENCE, 6);
      expect(landmark(ti + N, tj)?.key).toBe(landmark(ti, tj)?.key);
    }
    const M = CIRCUMFERENCE / WONDER_CELL;
    for (let mj = -3; mj <= 3; mj++) for (const mi of [0, M - 1]) expect(wonder(mi + M, mj)?.name).toBe(wonder(mi, mj)?.name);
    const keys = (rs: ReturnType<typeof roadsAround>) => rs.map((r) => r.p.key + '|' + r.q.key).sort();
    expect(keys(roadsAround(N - 1, 0, 3))).toEqual(keys(roadsAround(-1, 0, 3)));
    expect(properName(3, 4)).toBe(properName(3, 4));
    expect(cellKey(10, 20)).toBe(cellKey(10 + CIRCUMFERENCE, 20));
  }, 60_000);

  it('has coordinates: latitude from pole to pole, longitude around', () => {
    expect(latitude(NORTH_POLE_Y)).toBeCloseTo(90);
    expect(latitude(SOUTH_POLE_Y)).toBeCloseTo(-90);
    expect(latitude(EQUATOR_Y)).toBeCloseTo(0);
    expect(longitude(0)).toBe(0);
    expect(longitude(CIRCUMFERENCE / 2)).toBe(-180);
    expect(longitude(-CIRCUMFERENCE / 4)).toBe(-90);
    expect(wrapX(-1)).toBe(CIRCUMFERENCE - 1);
    expect(nearestCopy(CIRCUMFERENCE - 5, 3)).toBe(-5);
  });

  it('is frozen at the poles, hot at the equator, and the ice barrier cannot be crossed', () => {
    const at = (lat: number) => EQUATOR_Y - (lat / 90) * (CIRCUMFERENCE / 4);
    let cold = 0, hot = 0;
    for (let x = 0; x < CIRCUMFERENCE; x += 4096) {
      if (temperature(x, at(75), 0) < 0.333) cold++;
      if (temperature(x, at(5), 0) > 0.635) hot++;
    }
    expect(cold / 100).toBeGreaterThan(0.9);
    expect(hot / 100).toBeGreaterThan(0.9);
    expect(walkable(1000, at(86))).toBe(false);
    expect(walkable(1000, at(-86))).toBe(false);
  });

  it('is about a quarter land, in three continents with wide oceans between them', () => {
    let land = 0, n = 0;
    for (let y = NORTH_POLE_Y; y < SOUTH_POLE_Y; y += 2048) for (let x = 0; x < CIRCUMFERENCE; x += 2048) { n++; if (altitude(x, y) >= 0) land++; }
    expect(land / n).toBeGreaterThan(0.18);
    expect(land / n).toBeLessThan(0.35);
    // along the equator: land at the three continents, open sea in the oceans between them
    const at = (lon: number): number => altitude(lon * CIRCUMFERENCE / 360, EQUATOR_Y);
    for (const lon of [0, 130, -110]) expect(at(lon)).toBeGreaterThan(0);
    for (const lon of [70, -55, 180]) expect(at(lon)).toBeLessThan(0);
  });

  it('everyone starts at the same place: in the middle of the map, on the equator, near longitude 0', () => {
    const p = startPosition();
    expect(startPosition()).toEqual(p);
    const v = altitude(p.x, p.y);
    expect(v).toBeGreaterThan(0);
    expect(v).toBeLessThan(0.6);
    expect(Math.abs(latitude(p.y))).toBeLessThan(5);
    expect(Math.abs(longitude(p.x))).toBeLessThan(10);
    void biome; void humidity;
  });
});

describe('crossing longitude 180°', () => {
  it('the explorer walks across and comes back around, walk, fog and trace intact', async () => {
    const { newGame, startJourney, advance, wrapPosition } = await import('../game/travel');
    const s = newGame();
  s.calmUntil = 1e9; // no monsters on this walk
    s.calmUntil = 1e9; // no monsters on this walk
    // find walkable land on both sides of the antimeridian
    let y = 0;
    for (let yy = -40000; yy < 40000; yy += 50) if (walkable(CIRCUMFERENCE / 2 - 60, yy) && walkable(CIRCUMFERENCE / 2 + 60, yy) && walkable(CIRCUMFERENCE / 2, yy)) { y = yy; break; }
    expect(y).not.toBe(0);
    s.x = CIRCUMFERENCE / 2 - 60; s.y = y; s.journey = null;
    expect(startJourney(s, CIRCUMFERENCE / 2 + 60, y)).toBe(true);
    let shifted = 0;
    while (advance(s, 0.05)) shifted += wrapPosition(s);
    shifted += wrapPosition(s);
    expect(shifted).toBe(-CIRCUMFERENCE);
    expect(s.x).toBeCloseTo(-CIRCUMFERENCE / 2 + 60, 6);
    expect(longitude(s.x)).toBeCloseTo(-180 + 60 / CIRCUMFERENCE * 360, 6);
    expect(s.seen.has(cellKey(CIRCUMFERENCE / 2, y))).toBe(true);
  });
});

describe('road network', () => {
  const crosses = (a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }, d: { x: number; y: number }) => {
    const o = (p: typeof a, q: typeof a, r: typeof a) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
    return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
  };
  it('links are mutual, and roads meet in towns instead of crossing', async () => {
    const { neighbours } = await import('./roads');
    const s = startPosition(), ti = Math.floor(s.x / TILE), tj = Math.floor(s.y / TILE);
    const rs = roadsAround(ti, tj, 6);
    expect(rs.length).toBeGreaterThan(20);
    for (const r of rs) expect(neighbours(r.q).map((n) => n.key)).toContain(r.p.key);
    // crossings between the straight links (town to town): none for a relative neighbourhood graph
    let crossings = 0;
    for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
      const A = rs[i], B = rs[j];
      if ([A.p, A.q].some((t) => t === B.p || t === B.q)) continue;
      if (crosses(A.p, A.q, B.p, B.q)) crossings++;
    }
    expect(crossings).toBe(0);
  });
  it('roads wind instead of running straight', () => {
    const s = startPosition();
    let winding = 0, straight = 0;
    for (const r of roadsAround(Math.floor(s.x / TILE), Math.floor(s.y / TILE), 4)) {
      const L = r.lengths[r.lengths.length - 1], d = Math.hypot(r.q.x - r.p.x, r.q.y - r.p.y);
      expect(L).toBeGreaterThan(d);
      if (L > d * 1.01) winding++; else straight++;
    }
    expect(winding).toBeGreaterThan(straight * 8);
  });
});
