// Climate: a temperature field laid over the proto's world (asked by Adrien) to make room for
// tundra, pack ice and dune deserts. Large climate zones, a little colder up high.
import { fbm } from './noise';

/** Below this the land is tundra and the sea is frozen. About 15% of the land. */
export const COLD = 0.333;
/** Above this, dry land is desert. About 15% of the land is this hot. */
export const HOT = 0.635;
/** Width of the transition between climates, in temperature units. */
const BAND = 0.03;

/** Temperature at (x, y) with altitude v: climate zones ~50 leagues wide, colder up high. */
export const temperature = (x: number, y: number, v: number): number =>
  fbm(x / 9000 + 517, y / 9000 - 311, 3) - Math.max(0, v - 0.4) * 0.15;

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));
/** 0 in temperate lands, 1 in full cold, smoothly in between. */
export const coldness = (t: number): number => clamp01((COLD + BAND / 2 - t) / BAND);
/** 0 in temperate lands, 1 in full heat, smoothly in between. */
export const heat = (t: number): number => clamp01((t - HOT + BAND / 2) / BAND);

export type Biome = 'ice' | 'sea' | 'tundra' | 'desert' | 'temperate';

/** The biome at (x, y) with altitude v and humidity hu. Deserts need dry ground too. */
export function biome(x: number, y: number, v: number, hu: number): Biome {
  const t = temperature(x, y, v);
  if (v < 0) return t < COLD ? 'ice' : 'sea';
  if (t < COLD) return 'tundra';
  if (t > HOT && hu < 0.55) return 'desert';
  return 'temperate';
}
