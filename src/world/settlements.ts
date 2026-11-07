import { hash2 } from './noise';
import { properName } from './names';
import { TILE, altitude } from './terrain';

export interface Settlement {
  x: number;
  y: number;
  /** a city (walls, steeple) rather than a village */
  city: boolean;
  name: string;
  /** "ti,tj" */
  key: string;
  ti: number;
  tj: number;
}

const memo = new Map<string, Settlement | null>();

/** The settlement of tile (ti, tj), if any (about one tile in four, on low dry land). */
export function settlement(ti: number, tj: number): Settlement | null {
  const key = ti + ',' + tj;
  const known = memo.get(key);
  if (known !== undefined) return known;
  let b: Settlement | null = null;
  const r = hash2(ti * 41 + 7, tj * 17 - 3);
  if (r < 0.26) {
    const x = ti * TILE + 40 + hash2(ti * 9, tj * 4) * (TILE - 80);
    const y = tj * TILE + 40 + hash2(ti * 4, tj * 9) * (TILE - 80);
    const v = altitude(x, y);
    if (v > 0.04 && v < 0.45) {
      const city = r < 0.035;
      const name = properName(ti + 500, tj - 300) + (city ? '' : hash2(ti, tj * 2) < 0.3 ? '-les-Bains' : '');
      b = { x, y, city, name, key, ti, tj };
    }
  }
  memo.set(key, b);
  return b;
}

/** Only what has already been computed (the atlas view must not generate the world). */
export function knownSettlement(ti: number, tj: number): Settlement | null | undefined {
  return memo.get(ti + ',' + tj);
}
