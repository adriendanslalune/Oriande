import { hash2 } from './noise';
import { properName } from './names';
import { TILE, TILES_AROUND, altitude } from './terrain';
import { wrapIndex } from './planet';
import { wondersNear } from './wonders';
import { monumentsNear } from './monuments';
import { settlement } from './settlements';
import { nearWater } from './rivers';

/** A strange place keeps this far from a village (a city's walls and fields reach further). */
export const TOWN_CLEARANCE = 80, CITY_CLEARANCE = 130;

import { biome, type Biome } from './climate';
import { humidity } from './terrain';
import { placesShown } from './features';

export type LandmarkKind =
  | 'ruines' | 'squelette' | 'champignons' | 'cratere' | 'tour' | 'geyser' | 'epave' | 'tourbillon'
  | 'menhirs' | 'dolmen' | 'obelisque' | 'puits' | 'foretpetrifiee' | 'meteorite' | 'dirigeable' | 'observatoire'
  | 'pontbrise' | 'escalier' | 'porte' | 'labyrinthe' | 'stele' | 'ermitage' | 'mine' | 'automate' | 'cloche'
  | 'oasis' | 'ziggourat' | 'idole' | 'cimetiere' | 'termitiere' | 'navireglace' | 'mammouth'
  | 'clocher' | 'tortue' | 'phare';

const LAND: Biome[] = ['temperate', 'tundra', 'desert', 'savanna', 'jungle'];

/**
 * The kinds of strange places and where each may be found (asked by Adrien: a real variety,
 * so that a long journey keeps surprising): on land or in the water, in which climates, at
 * which altitudes, and how common. Some belong to one climate only (the oasis to the desert,
 * the overgrown ziggurat to the jungle, the mammoth in its ice to the tundra).
 */
const KINDS: { kind: LandmarkKind; water: boolean; biomes: Biome[]; w: number; min?: number; max?: number; wet?: boolean; deep?: boolean; coast?: boolean }[] = [
  { kind: 'ruines', water: false, biomes: LAND, w: 2 },
  { kind: 'squelette', water: false, biomes: ['temperate', 'tundra', 'desert', 'savanna'], w: 1.5 },
  { kind: 'champignons', water: false, biomes: ['temperate', 'jungle'], w: 1, wet: true },
  { kind: 'cratere', water: false, biomes: LAND, w: 1 },
  { kind: 'tour', water: false, biomes: ['temperate', 'tundra', 'desert', 'savanna'], w: 1 },
  { kind: 'geyser', water: false, biomes: ['temperate', 'tundra'], w: 1, min: 0.2 },
  { kind: 'menhirs', water: false, biomes: ['temperate', 'tundra', 'savanna'], w: 1.5 },
  { kind: 'dolmen', water: false, biomes: ['temperate'], w: 1.2 },
  { kind: 'obelisque', water: false, biomes: ['desert', 'savanna', 'temperate'], w: 1.2 },
  { kind: 'puits', water: false, biomes: LAND, w: 1 },
  { kind: 'foretpetrifiee', water: false, biomes: ['desert', 'savanna', 'tundra'], w: 1 },
  { kind: 'meteorite', water: false, biomes: LAND, w: 0.8 },
  { kind: 'dirigeable', water: false, biomes: LAND, w: 0.8 },
  { kind: 'observatoire', water: false, biomes: LAND, w: 1.2, min: 0.3 },
  { kind: 'pontbrise', water: false, biomes: LAND, w: 1 },
  { kind: 'escalier', water: false, biomes: LAND, w: 0.8 },
  { kind: 'porte', water: false, biomes: LAND, w: 1 },
  { kind: 'labyrinthe', water: false, biomes: ['temperate', 'desert', 'savanna'], w: 0.8 },
  { kind: 'stele', water: false, biomes: LAND, w: 1.2 },
  { kind: 'ermitage', water: false, biomes: ['temperate', 'tundra', 'savanna'], w: 1.2, min: 0.32 },
  { kind: 'mine', water: false, biomes: LAND, w: 1.2, min: 0.3 },
  { kind: 'automate', water: false, biomes: ['temperate', 'desert', 'savanna', 'tundra'], w: 0.8 },
  { kind: 'cloche', water: false, biomes: LAND, w: 0.8 },
  { kind: 'oasis', water: false, biomes: ['desert'], w: 3.5 },
  { kind: 'ziggourat', water: false, biomes: ['jungle'], w: 3 },
  { kind: 'idole', water: false, biomes: ['jungle'], w: 2.5 },
  { kind: 'cimetiere', water: false, biomes: ['savanna'], w: 2.5 },
  { kind: 'termitiere', water: false, biomes: ['savanna'], w: 2.5 },
  { kind: 'mammouth', water: false, biomes: ['tundra'], w: 3 },
  { kind: 'epave', water: true, biomes: ['sea'], w: 2 },
  { kind: 'tourbillon', water: true, biomes: ['sea'], w: 1, deep: true },
  { kind: 'clocher', water: true, biomes: ['sea'], w: 1.2, coast: true },
  { kind: 'tortue', water: true, biomes: ['sea'], w: 1, deep: true },
  { kind: 'phare', water: true, biomes: ['sea', 'ice'], w: 1.2, coast: true },
  { kind: 'navireglace', water: true, biomes: ['ice'], w: 4 },
];

/** Every kind, in a fixed order (for tests and tools). */
export const LANDMARK_KINDS: LandmarkKind[] = KINDS.map((k) => k.kind);

/** Share of the candidate spots that hold a strange place (about one tile in ten). */
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
  if (!placesShown()) return null; // off the map for now (see features.ts)
  const rkey = ti + ',' + tj, wi = wrapIndex(ti, TILES_AROUND), key = wi + ',' + tj;
  const known = memo.get(rkey);
  if (known !== undefined) return known;
  let out: Landmark | null = null;
  const r = hash2(wi * 13, tj * 29);
  if (r < 0.55) {
    const lx = 40 + hash2(wi, tj * 5) * (TILE - 80), ly = 40 + hash2(wi * 5, tj) * (TILE - 80);
    const x = ti * TILE + lx, y = tj * TILE + ly, v = altitude(x, y), onWater = v < 0;
    // which kinds suit this spot: its climate, its altitude (never up in the mountains, where
    // the explorer cannot go), water depth for the sea's places
    const b = biome(x, y, v, humidity(x, y)), hu = humidity(x, y);
    const choices = onWater && v > -0.03 ? [] : KINDS.filter((L) => L.water === onWater && L.biomes.includes(b)
      && (L.min === undefined || v >= L.min) && v <= (L.max ?? 0.56) && (!L.wet || hu > 0.5)
      && (!L.deep || v < -0.15) && (!L.coast || v > -0.12));
    // rare enough to stay an event (asked by Adrien)
    if (choices.length && hash2(wi * 71 + 5, tj * 53 - 9) < KEEP) {
      const total = choices.reduce((a, c) => a + c.w, 0);
      let pick = hash2(wi * 3, tj * 7) * total, L = choices[0];
      for (const c of choices) { pick -= c.w; if (pick < 0) { L = c; break; } }
      // a wonder stands alone in its corner of the map
      // and never on a village or a city, nor in its fields (asked by Adrien)
      let town = false;
      for (let dj = -1; dj <= 1 && !town; dj++) for (let di = -1; di <= 1; di++) {
        const b = settlement(ti + di, tj + dj);
        if (b && Math.hypot(b.x - x, b.y - y) < (b.city ? CITY_CLEARANCE : TOWN_CLEARANCE)) { town = true; break; }
      }
      // a place on land never stands in a river or a lake
      if (!town && !(!L.water && nearWater(x, y, 20)) && !wondersNear(x, y, x, y, 120).some((w) => Math.hypot(w.x - x, w.y - y) < 120)
        && !monumentsNear(x, y, x, y, 100).some((m) => Math.hypot(m.x - x, m.y - y) < 100)) {
        out = { kind: L.kind, water: L.water, x, y, name: properName(wi, tj), key };
      }
    }
  }
  memo.set(rkey, out);
  return out;
}
