import { hash2 } from './noise';
import { properName } from './names';
import { TILE, TILES_AROUND, altitude } from './terrain';
import { wrapIndex } from './planet';
import { wondersNear } from './wonders';

export type LandmarkKind = 'ruines' | 'squelette' | 'champignons' | 'cratere' | 'tour' | 'geyser' | 'epave' | 'tourbillon';

/** Order matters: it is the proto's order, used to pick a kind from a hash. */
const KINDS: { kind: LandmarkKind; water: boolean }[] = [
  { kind: 'ruines', water: false },
  { kind: 'squelette', water: false },
  { kind: 'champignons', water: false },
  { kind: 'cratere', water: false },
  { kind: 'tour', water: false },
  { kind: 'geyser', water: false },
  { kind: 'epave', water: true },
  { kind: 'tourbillon', water: true },
];

/** Share of the proto's strange places kept on the map. */
export const KEEP = 0.28;

export interface Landmark {
  kind: LandmarkKind;
  water: boolean;
  /** world position */
  x: number;
  y: number;
  /** generated proper name; the full label is i18n `landmark.<kind>.name` with {n} */
  name: string;
  /** "ti,tj" */
  key: string;
}

const memo = new Map<string, Landmark | null>();

/** The strange place of tile (ti, tj), if any: at most one per tile, about one tile in ten. */
export function landmark(ti: number, tj: number): Landmark | null {
  const rkey = ti + ',' + tj, wi = wrapIndex(ti, TILES_AROUND), key = wi + ',' + tj;
  const known = memo.get(rkey);
  if (known !== undefined) return known;
  let out: Landmark | null = null;
  const r = hash2(wi * 13, tj * 29);
  if (r < 0.55) {
    const lx = 40 + hash2(wi, tj * 5) * (TILE - 80), ly = 40 + hash2(wi * 5, tj) * (TILE - 80);
    const x = ti * TILE + lx, y = tj * TILE + ly, v = altitude(x, y), onWater = v < 0;
    const choices = KINDS.filter((L) => L.water === onWater && !(onWater && v > -0.03));
    // Only about one in four of the proto's places is kept, so they stay rare enough to be
    // an event (asked by Adrien); those kept are exactly the proto's.
    if (choices.length && !(v > 0.7) && hash2(wi * 71 + 5, tj * 53 - 9) < KEEP) {
      const L = choices[Math.floor(hash2(wi * 3, tj * 7) * choices.length)];
      // a wonder stands alone in its corner of the map
      if (!wondersNear(x, y, x, y, 120).some((w) => Math.hypot(w.x - x, w.y - y) < 120)) {
        out = { kind: L.kind, water: L.water, x, y, name: properName(wi, tj), key };
      }
    }
  }
  memo.set(rkey, out);
  return out;
}
