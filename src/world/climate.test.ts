import { describe, expect, it } from 'vitest';
import { biome, temperature, COLD } from './climate';
import { altitude, humidity } from './terrain';
import { CIRCUMFERENCE, NORTH_POLE_Y, SOUTH_POLE_Y } from './planet';

describe('climates', () => {
  it('the world has tundra, frozen seas, deserts, savannas and jungles, in sensible shares', () => {
    const n: Record<string, number> = {}; let land = 0;
    for (let y = NORTH_POLE_Y; y < SOUTH_POLE_Y; y += 1500) for (let x = 0; x < CIRCUMFERENCE; x += 3000) {
      const v = altitude(x, y), b = biome(x, y, v, humidity(x, y));
      n[b] = (n[b] || 0) + 1;
      if (v >= 0) land++;
    }
    // the atlas projection shows the polar lands as wide as the equator: a third of the map
    expect(n.tundra / land).toBeGreaterThan(0.15);
    expect(n.tundra / land).toBeLessThan(0.5);
    // hot lands split into desert, savanna and jungle
    const hot = n.desert + n.savanna + n.jungle;
    expect(hot / land).toBeGreaterThan(0.08);
    expect(hot / land).toBeLessThan(0.3);
    for (const b of ['desert', 'savanna', 'jungle']) expect(n[b] / hot).toBeGreaterThan(0.15);
    expect(n.ice).toBeGreaterThan(50);
  });

  it('it is colder up high', () => {
    expect(temperature(100, 100, 1)).toBeLessThan(temperature(100, 100, 0.3));
    expect(temperature(100, 100, 0.2)).toBe(temperature(100, 100, 0.3)); // no change below 0.4
    expect(COLD).toBeLessThan(0.5);
    void biome; void altitude; void humidity;
  });
});
