// What the land gives to whoever stops and gathers: wood where trees grow, stones on the hills,
// in the dry lands and the tundra, fibres (grass, reeds) in the plains and savannas. Read from
// the same terrain as the map's drawing (render/tiles.ts), so a tap on a forest gives wood.
import { altitude, humidity } from './terrain';
import { biome, coldness, heat, temperature, DESERT_HUMIDITY, JUNGLE_HUMIDITY } from './climate';
import { MOUNTAIN_ALTITUDE } from './terrain';
import { beyondIce } from './planet';

export type Resource = 'bois' | 'pierre' | 'fibre';
export const RESOURCES: Resource[] = ['bois', 'pierre', 'fibre'];

/** What can be gathered at (x, y), or null (water, ice, the high mountains). */
export function resourceAt(x: number, y: number): Resource | null {
  if (beyondIce(y)) return null;
  const v = altitude(x, y);
  if (v < 0.02 || v >= MOUNTAIN_ALTITUDE) return null;
  const hu = humidity(x, y);
  if (biome(x, y, v, hu) === 'ice') return null;
  if (v > 0.45) return 'pierre'; // the stony hills under the peaks
  const t = temperature(x, y, v);
  if (heat(t) > 0.5) { // hot lands
    if (hu < DESERT_HUMIDITY) return 'pierre';
    return hu < JUNGLE_HUMIDITY ? 'fibre' : 'bois';
  }
  if (coldness(t) > 0.5) return hu > 0.55 ? 'bois' : 'pierre'; // stunted conifers, or bare stones
  if (hu > 0.55) return 'bois'; // forests (as drawn: humid ground under 0.45)
  if (hu < 0.32) return 'pierre'; // dry sands and gravels
  return 'fibre'; // grass
}

/**
 * What else may come with a handful of this at (x, y), and the chance of it: berries and herbs
 * in the grass (not in the cold), mushrooms under damp trees.
 */
export function extrasAt(x: number, y: number, res: Resource): [string, number][] {
  const v = altitude(x, y), t = temperature(x, y, v), hu = humidity(x, y), cold = coldness(t) > 0.5;
  if (res === 'fibre') return cold ? [['herbes', 0.2]] : [['baies', 0.35], ['herbes', 0.25]];
  if (res === 'bois') return hu > 0.6 && !cold ? [['champignon', 0.35]] : [['baies', 0.15]];
  return [];
}
