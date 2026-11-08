// Monuments: the great works of the Oriandais — pyramids, colossi, temples, sphinxes, jungle
// sanctuaries, arches, amphitheatres, aqueducts (asked by Adrien). Rarer than the strange
// places, more common than the wonders: at most one per monument cell (4 x 4 tiles), on
// ground that suits it, away from towns and wonders. Seen from afar. Deterministic.
import { hash2 } from './noise';
import { properName } from './names';
import { TILE, altitude, humidity } from './terrain';
import { biome, type Biome } from './climate';
import { settlement } from './settlements';
import { CIRCUMFERENCE, wrapIndex } from './planet';
import { wondersNear } from './wonders';

export type MonumentKind = 'colosse' | 'pyramide' | 'temple' | 'sphinx' | 'sanctuaire' | 'arc' | 'amphitheatre' | 'aqueduc';

/** Size of the grid cells that hold at most one monument, world units (4 tiles, ~26 leagues). */
export const MONUMENT_CELL = 4 * TILE;
/** Chance that a cell holds a monument (if a suitable spot is found). */
const CHANCE = 0.3;
/** A monument is noticed from this far. */
export const MONUMENT_SIGHT = 350;
/** Ground cleared around a monument (no forest, no peaks drawn over it). */
export const MONUMENT_CLEARING = 44;

const KINDS: { kind: MonumentKind; biomes: Biome[]; min: number; max: number }[] = [
  { kind: 'colosse', biomes: ['temperate', 'desert', 'savanna', 'tundra', 'jungle'], min: 0.05, max: 0.5 },
  { kind: 'pyramide', biomes: ['desert', 'savanna'], min: 0.03, max: 0.4 },
  { kind: 'temple', biomes: ['temperate', 'savanna', 'desert'], min: 0.05, max: 0.5 },
  { kind: 'sphinx', biomes: ['desert', 'savanna'], min: 0.03, max: 0.4 },
  { kind: 'sanctuaire', biomes: ['jungle'], min: 0.03, max: 0.5 },
  { kind: 'arc', biomes: ['temperate', 'desert', 'savanna', 'tundra'], min: 0.05, max: 0.45 },
  { kind: 'amphitheatre', biomes: ['temperate', 'savanna'], min: 0.05, max: 0.45 },
  { kind: 'aqueduc', biomes: ['temperate', 'savanna', 'jungle'], min: 0.1, max: 0.5 },
];

/** Every kind, in a fixed order. */
export const MONUMENT_KINDS: MonumentKind[] = KINDS.map((k) => k.kind);

export interface Monument {
  kind: MonumentKind;
  x: number;
  y: number;
  /** generated proper name; the label is i18n `monument.<kind>.name` with {n} */
  name: string;
  /** "mi,mj" of its cell, wrapped around the planet */
  key: string;
}

const memo = new Map<string, Monument | null>();

/** The monument of cell (mi, mj), if any. */
export function monument(mi: number, mj: number): Monument | null {
  const rkey = mi + ',' + mj, wm = wrapIndex(mi, CIRCUMFERENCE / MONUMENT_CELL), key = wm + ',' + mj;
  const known = memo.get(rkey);
  if (known !== undefined) return known;
  let out: Monument | null = null;
  if (hash2(wm * 59 + 17, mj * 61 - 23) < CHANCE) {
    for (let t = 0; t < 5 && !out; t++) {
      const x = (mi + 0.2 + hash2(wm * 17 + t, mj * 19) * 0.6) * MONUMENT_CELL;
      const y = (mj + 0.2 + hash2(wm * 23, mj * 29 + t) * 0.6) * MONUMENT_CELL;
      const v = altitude(x, y), b = biome(x, y, v, humidity(x, y));
      const fit = KINDS.filter((K) => K.biomes.includes(b) && v >= K.min && v <= K.max);
      if (!fit.length) continue;
      const K = fit[Math.floor(hash2(wm * 31 + 7, mj * 37 + t) * fit.length)];
      const ti = Math.floor(x / TILE), tj = Math.floor(y / TILE);
      let clear = !wondersNear(x, y, x, y, 300).some((w) => Math.hypot(w.x - x, w.y - y) < 300);
      for (let dj = -1; dj <= 1 && clear; dj++) for (let di = -1; di <= 1; di++) {
        const s = settlement(ti + di, tj + dj);
        if (s && Math.hypot(s.x - x, s.y - y) < 140) { clear = false; break; }
      }
      if (clear) out = { kind: K.kind, x, y, name: properName(wm + 2600, mj + 900), key };
    }
  }
  memo.set(rkey, out);
  return out;
}

/** Monuments whose ground reaches the box [x0, x1] x [y0, y1], with a margin. */
export function monumentsNear(x0: number, y0: number, x1: number, y1: number, margin: number): Monument[] {
  const out: Monument[] = [];
  for (let mj = Math.floor((y0 - margin) / MONUMENT_CELL); mj <= Math.floor((y1 + margin) / MONUMENT_CELL); mj++)
    for (let mi = Math.floor((x0 - margin) / MONUMENT_CELL); mi <= Math.floor((x1 + margin) / MONUMENT_CELL); mi++) {
      const m = monument(mi, mj);
      if (m && m.x > x0 - margin && m.x < x1 + margin && m.y > y0 - margin && m.y < y1 + margin) out.push(m);
    }
  return out;
}
