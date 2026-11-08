import { hash2 } from './noise';
import { properName } from './names';
import { TILE, TILES_AROUND, altitude } from './terrain';
import { wrapIndex } from './planet';

export interface Settlement {
  x: number;
  y: number;
  /** a city (walls, steeple) rather than a village */
  city: boolean;
  name: string;
  /** identity on the planet, "wi,tj": the same for every copy around the world */
  key: string;
  /** "ti,tj" with the raw tile index: identifies this copy (memos of positions) */
  rkey: string;
  /** raw tile index (position) and its index brought back around the planet (identity) */
  ti: number;
  wi: number;
  tj: number;
}

const memo = new Map<string, Settlement | null>();

/** The settlement of tile (ti, tj), if any (about one tile in four, on low dry land). */
export function settlement(ti: number, tj: number): Settlement | null {
  const rkey = ti + ',' + tj;
  const known = memo.get(rkey);
  if (known !== undefined) return known;
  let b: Settlement | null = null;
  const wi = wrapIndex(ti, TILES_AROUND); // the planet wraps: draw lots with the wrapped index
  const r = hash2(wi * 41 + 7, tj * 17 - 3);
  if (r < 0.26) {
    const x = ti * TILE + 40 + hash2(wi * 9, tj * 4) * (TILE - 80);
    const y = tj * TILE + 40 + hash2(wi * 4, tj * 9) * (TILE - 80);
    const v = altitude(x, y);
    // on low dry land, and not in the shadow of the mountains (peaks are drawn around v >= 0.6)
    const clear = (): boolean => { for (let a = 0; a < 6.28; a += 0.785) if (altitude(x + Math.cos(a) * 40, y + Math.sin(a) * 40) >= 0.55) return false; return true; };
    if (v > 0.04 && v < 0.45 && clear()) {
      const city = r < 0.035;
      const name = properName(wi + 500, tj - 300) + (city ? '' : hash2(wi, tj * 2) < 0.3 ? '-les-Bains' : '');
      b = { x, y, city, name, key: wi + ',' + tj, rkey, ti, wi, tj };
    }
  }
  memo.set(rkey, b);
  return b;
}

/** Only what has already been computed (the atlas view must not generate the world). */
export function knownSettlement(ti: number, tj: number): Settlement | null | undefined {
  return memo.get(ti + ',' + tj);
}
