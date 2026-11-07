import { hash2 } from './noise';
import { properName } from './names';
import { TILE, altitude } from './terrain';

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

/** The strange place of tile (ti, tj), if any: at most one per tile. */
export function landmark(ti: number, tj: number): Landmark | null {
  const key = ti + ',' + tj;
  const known = memo.get(key);
  if (known !== undefined) return known;
  let out: Landmark | null = null;
  const r = hash2(ti * 13, tj * 29);
  if (r < 0.55) {
    const lx = 40 + hash2(ti, tj * 5) * (TILE - 80), ly = 40 + hash2(ti * 5, tj) * (TILE - 80);
    const x = ti * TILE + lx, y = tj * TILE + ly, v = altitude(x, y), onWater = v < 0;
    const choices = KINDS.filter((L) => L.water === onWater && !(onWater && v > -0.03));
    if (choices.length && !(v > 0.7)) {
      const L = choices[Math.floor(hash2(ti * 3, tj * 7) * choices.length)];
      out = { kind: L.kind, water: L.water, x, y, name: properName(ti, tj), key };
    }
  }
  memo.set(key, out);
  return out;
}
