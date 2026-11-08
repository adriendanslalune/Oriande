import { describe, expect, it } from 'vitest';
import { biome, temperature, COLD } from './climate';
import { altitude, humidity } from './terrain';

describe('climates', () => {
  it('the world has tundra, frozen seas, deserts, savannas and jungles, in sensible shares', () => {
    const n: Record<string, number> = {}; let land = 0;
    for (let y = -60000; y <= 60000; y += 1500) for (let x = -60000; x <= 60000; x += 1500) {
      const v = altitude(x, y), b = biome(x, y, v, humidity(x, y));
      n[b] = (n[b] || 0) + 1;
      if (v >= 0) land++;
    }
    expect(n.tundra / land).toBeGreaterThan(0.08);
    expect(n.tundra / land).toBeLessThan(0.3);
    // hot lands split into desert, savanna and jungle
    const hot = n.desert + n.savanna + n.jungle;
    expect(hot / land).toBeGreaterThan(0.08);
    expect(hot / land).toBeLessThan(0.3);
    for (const b of ['desert', 'savanna', 'jungle']) expect(n[b] / hot).toBeGreaterThan(0.15);
    expect(n.ice).toBeGreaterThan(50);
  });

  it('the start is temperate, and it is colder up high', () => {
    expect(biome(470, -60, altitude(470, -60), humidity(470, -60))).toBe('temperate');
    expect(temperature(100, 100, 1)).toBeLessThan(temperature(100, 100, 0.3));
    expect(temperature(100, 100, 0.2)).toBe(temperature(100, 100, 0.3)); // no change below 0.4
    expect(COLD).toBeLessThan(0.5);
  });
});
