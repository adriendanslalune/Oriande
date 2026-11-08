import { describe, expect, it } from 'vitest';
import { DAY_SECONDS, localHour, sky, visibilityAt, weatherAt, worldTime } from './weather';
import { CIRCUMFERENCE, EQUATOR_Y } from './planet';
import { startPosition } from '../game/travel';

const s = startPosition(), T = worldTime();

describe('weather and the hour', () => {
  it('is the same for everyone: a function of place and real time only', () => {
    expect(weatherAt(s.x, s.y, T)).toEqual(weatherAt(s.x, s.y, T));
    expect(weatherAt(s.x + CIRCUMFERENCE, s.y, T).kind).toBe(weatherAt(s.x, s.y, T).kind);
  });

  it('a day lasts two real hours; the hour follows longitude', () => {
    expect(localHour(s.x, T + DAY_SECONDS)).toBeCloseTo(localHour(s.x, T), 6);
    expect(localHour(s.x + CIRCUMFERENCE / 4, T)).toBeCloseTo((localHour(s.x, T) + 6) % 24, 6);
    expect(sky(s.x, T).phase).toBe('day');
    expect(sky(s.x, T + DAY_SECONDS / 2).phase).toBe('night');
    expect(sky(s.x, T + DAY_SECONDS / 2).darkness).toBeGreaterThan(0.9);
  });

  it('changes over minutes: rain comes and goes, about one tenth of the time at the start', () => {
    let rain = 0, changes = 0, last = '';
    for (let k = 0; k < 3000; k++) {
      const w = weatherAt(s.x, s.y, T + k * 20).kind;
      if (w === 'rain' || w === 'storm') rain++;
      if (w !== last) changes++;
      last = w;
    }
    expect(rain / 3000).toBeGreaterThan(0.04);
    expect(rain / 3000).toBeLessThan(0.3);
    expect(changes).toBeGreaterThan(30);
  });

  it('follows the climate: snow near the poles, sand in deserts, rain at the equator', () => {
    const kinds = new Set<string>();
    for (let k = 0; k < 3000; k++) {
      const lat = ((k % 7) - 3) * 25, x = (k * 7919) % CIRCUMFERENCE;
      kinds.add(weatherAt(x, EQUATOR_Y - (lat / 90) * (CIRCUMFERENCE / 4), T + k * 97).kind);
    }
    for (const k of ['clear', 'cloudy', 'rain', 'snow']) expect(kinds.has(k)).toBe(true);
  });

  it('night and bad weather shorten the view', () => {
    expect(visibilityAt(s.x, s.y, T)).toBe(1);
    expect(visibilityAt(s.x, s.y, T + DAY_SECONDS / 2)).toBeLessThan(0.7);
  });
});
