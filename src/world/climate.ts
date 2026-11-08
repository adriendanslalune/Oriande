// Climate of the planet: temperature follows latitude (hot at the equator, frozen at the poles),
// with irregular boundaries and colder air up high.
import { fbm } from './noise';
import { CIRCUMFERENCE, latitude } from './planet';

/** Below this the land is tundra and the sea is frozen (from about 60° of latitude). */
export const COLD = 0.333;
/** Above this the land is hot: desert, savanna or jungle by humidity (the tropics, below ~23°). */
export const HOT = 0.635;
/** Width of the transition between climates, in temperature units. */
const BAND = 0.03;

/** Temperature at (x, y) with altitude v. */
export function temperature(x: number, y: number, v: number): number {
  const lat = latitude(y) * Math.PI / 180;
  const base = 0.719 * Math.cos(lat) - 0.0265; // 0.635 at 23°, 0.333 at 60°
  const wobble = (fbm(x / 8_192 + 517, y / 8_192 - 311, 3, CIRCUMFERENCE / 8_192) - 0.5) * 0.22;
  return base + wobble - Math.max(0, v - 0.4) * 0.15;
}

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));
/** 0 in temperate lands, 1 in full cold, smoothly in between. */
export const coldness = (t: number): number => clamp01((COLD + BAND / 2 - t) / BAND);
/** 0 in temperate lands, 1 in full heat, smoothly in between. */
export const heat = (t: number): number => clamp01((t - HOT + BAND / 2) / BAND);

/** In hot lands, below this humidity: desert. */
export const DESERT_HUMIDITY = 0.5;
/** In hot lands, from this humidity up: jungle. In between: savanna. */
export const JUNGLE_HUMIDITY = 0.6;

export type Biome = 'ice' | 'sea' | 'tundra' | 'desert' | 'savanna' | 'jungle' | 'temperate';

/** The biome at (x, y) with altitude v and humidity hu. Hot lands split by humidity. */
export function biome(x: number, y: number, v: number, hu: number): Biome {
  const t = temperature(x, y, v);
  if (v < 0) return t < COLD ? 'ice' : 'sea';
  if (t < COLD) return 'tundra';
  if (t > HOT) return hu < DESERT_HUMIDITY ? 'desert' : hu < JUNGLE_HUMIDITY ? 'savanna' : 'jungle';
  return 'temperate';
}
