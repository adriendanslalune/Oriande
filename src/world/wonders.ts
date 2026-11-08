// Wonders: rare, spectacular remains of the Oriandais, seen from afar. At most one per wonder
// cell (8 x 8 tiles), placed where the ground suits it, never in a town. Deterministic.
import { hash2 } from './noise';
import { properName } from './names';
import { TILE, altitude, humidity } from './terrain';
import { settlement } from './settlements';
import { CIRCUMFERENCE, wrapIndex } from './planet';
import { nearWater } from './rivers';

export type WonderKind = 'tete' | 'rocher' | 'cristal' | 'titan' | 'arches' | 'arbre';

/** Size of the grid cells that hold at most one wonder, world units (8 tiles, ~51 leagues). */
export const WONDER_CELL = 8 * TILE;
/** Chance that a cell holds a wonder (if a suitable spot is found). */
const CHANCE = 0.45;
/** A wonder is noticed from this far: it towers over the land. */
export const WONDER_SIGHT = 500;
/** Ground cleared around a wonder (no forest, no peaks drawn over it). */
export const WONDER_CLEARING = 45;

/** Where each kind may stand: altitude range, and optionally moist ground. */
const KINDS: { kind: WonderKind; min: number; max: number; wet?: boolean }[] = [
  { kind: 'tete', min: 0.08, max: 0.5 },
  { kind: 'rocher', min: 0.1, max: 0.55 },
  { kind: 'cristal', min: 0.05, max: 0.45, wet: true },
  { kind: 'titan', min: 0.06, max: 0.5 },
  { kind: 'arches', min: -0.25, max: -0.03 },
  { kind: 'arbre', min: 0.05, max: 0.4 },
];

export interface Wonder {
  kind: WonderKind;
  x: number;
  y: number;
  /** generated proper name; the label is i18n `wonder.<kind>.name` with {n} */
  name: string;
  /** "mi,mj" of its cell */
  key: string;
}

const memo = new Map<string, Wonder | null>();

/** The wonder of cell (mi, mj), if any. */
export function wonder(mi: number, mj: number): Wonder | null {
  const rkey = mi + ',' + mj, wm = wrapIndex(mi, CIRCUMFERENCE / WONDER_CELL), key = wm + ',' + mj;
  const known = memo.get(rkey);
  if (known !== undefined) return known;
  let out: Wonder | null = null;
  if (hash2(wm * 97 + 13, mj * 89 - 7) < CHANCE) {
    const K = KINDS[Math.floor(hash2(wm * 41 + 3, mj * 43 + 1) * KINDS.length)];
    // a few tries to find a suitable spot in the middle of the cell
    for (let t = 0; t < 6 && !out; t++) {
      const x = (mi + 0.15 + hash2(wm * 7 + t, mj * 11) * 0.7) * WONDER_CELL;
      const y = (mj + 0.15 + hash2(wm * 13, mj * 5 + t) * 0.7) * WONDER_CELL;
      const v = altitude(x, y);
      if (v < K.min || v > K.max || (K.wet && humidity(x, y) < 0.45)) continue;
      // keep clear of towns
      const ti = Math.floor(x / TILE), tj = Math.floor(y / TILE);
      let town = false;
      for (let dj = -1; dj <= 1 && !town; dj++) for (let di = -1; di <= 1; di++) {
        const b = settlement(ti + di, tj + dj);
        if (b && Math.hypot(b.x - x, b.y - y) < 160) { town = true; break; }
      }
      // the arches stand in the sea; the others never in a river or a lake
      if (!town && (K.kind === 'arches' || !nearWater(x, y, 40))) out = { kind: K.kind, x, y, name: properName(wm + 1200, mj - 1200), key };
    }
  }
  memo.set(rkey, out);
  return out;
}

/** Wonders whose ground reaches the box [x0, x1] x [y0, y1], with a margin. */
export function wondersNear(x0: number, y0: number, x1: number, y1: number, margin: number): Wonder[] {
  const out: Wonder[] = [];
  for (let mj = Math.floor((y0 - margin) / WONDER_CELL); mj <= Math.floor((y1 + margin) / WONDER_CELL); mj++)
    for (let mi = Math.floor((x0 - margin) / WONDER_CELL); mi <= Math.floor((x1 + margin) / WONDER_CELL); mi++) {
      const w = wonder(mi, mj);
      if (w && w.x > x0 - margin && w.x < x1 + margin && w.y > y0 - margin && w.y < y1 + margin) out.push(w);
    }
  return out;
}
