// Wild animals: herds laid out deterministically on a grid, by biome, and wandering on the
// shared world clock (everyone sees the same deer in the same clearing at the same moment).
// Small species are far more numerous than large ones (their weights in data/animals.json).
import data from '../data/animals.json';
import { hash2, noise } from './noise';
import { TILE, MOUNTAIN_ALTITUDE, altitude, humidity } from './terrain';
import { biome } from './climate';
import { settlement } from './settlements';
import { CIRCUMFERENCE, beyondIce, wrapIndex } from './planet';

export type Habitat = 'temperate' | 'savanna' | 'tundra' | 'jungle' | 'desert' | 'mountain' | 'sea' | 'ice';

/** How an animal is drawn (side view, drawing units; see render/animals.ts). */
export interface Look {
  kind: 'quad' | 'hopper' | 'whale' | 'seal' | 'bat' | 'owl' | 'hedgehog';
  /** body length, rump to chest */
  len: number;
  /** height at the shoulder, legs included */
  height?: number;
  /** share of the height that is leg */
  legs?: number;
  neck?: number; neckUp?: number;
  head?: number; headDepth?: number; headDown?: number;
  ears?: 'point' | 'round' | 'flap' | number;
  earSize?: number;
  tail?: 'thin' | 'tuft' | 'bush' | 'curl' | 'short';
  tailLen?: number;
  feet?: 'hoof' | 'paw' | 'pad' | 'column';
  hump?: number; humpAt?: 'withers' | 'back';
  antlers?: number; horns?: 'lyre' | 'curve'; hornLen?: number; tusks?: number; trunk?: number; beard?: number;
  mane?: 'lion' | 'short'; stripes?: boolean; spots?: boolean; bristles?: boolean; flank?: boolean;
  color: number[];
  /** secondary colours: tail tip, bib, face, saddle, scut */
  tip?: number[]; bib?: number[]; face?: number[]; saddle?: number[]; tailColor?: number[];
  /** sits up on its haunches when still (marmot) */
  sits?: boolean;
}

export interface Species {
  id: string;
  size: 'small' | 'medium' | 'large';
  biomes: Habitat[];
  /** frequency by day (0: asleep by day) */
  weight: number;
  /** frequency at night (0: asleep at night) */
  night: number;
  herd: number[];
  /** world units per second when moving */
  speed: number;
  /** how far the herd roams from home */
  range: number;
  food: number;
  danger: number;
  look: Look;
}

export const SPECIES = data.species as unknown as Species[];

/** Herds are laid out on this grid (it divides the circumference). */
export const FAUNA_CELL = 128;
const CELLS_AROUND = CIRCUMFERENCE / FAUNA_CELL;

/** Chance that a cell of land (or sea) holds a herd. */
const LAND_CHANCE = 0.32, SEA_CHANCE = 0.03, ICE_CHANCE = 0.12;

export interface Herd {
  /** identity on the planet (wrapped cell index) */
  key: string;
  species: Species;
  /** home, raw world position */
  x: number;
  y: number;
  /** how far it actually roams (shortened near water and towns) */
  range: number;
  count: number;
  seed: number;
}

export interface Animal {
  x: number;
  y: number;
  /** 1 = facing east, -1 = west */
  dir: number;
  /** 0 standing still … 1 at full pace */
  pace: number;
  /** an individual phase, for gaits and gestures */
  phase: number;
  /** height above the ground, world units (birds and bats) */
  alt?: number;
}

/** The habitat at a point, or null where nothing lives (shallow water, beyond the ice). */
export function habitat(x: number, y: number): Habitat | null {
  if (beyondIce(y)) return null;
  const v = altitude(x, y), b = biome(x, y, v, humidity(x, y));
  if (b === 'ice') return 'ice';
  if (b === 'sea') return v < -0.25 ? 'sea' : null;
  if (v >= MOUNTAIN_ALTITUDE) return 'mountain';
  return b;
}

/** Species by habitat, by day and at night, with their frequencies. */
const byHabitat = [new Map<Habitat, { s: Species; w: number }[]>(), new Map<Habitat, { s: Species; w: number }[]>()];
for (const s of SPECIES) for (const h of s.biomes) for (const n of [0, 1]) {
  const w = n ? s.night : s.weight;
  if (!w) continue;
  const m = byHabitat[n];
  if (!m.has(h)) m.set(h, []);
  m.get(h)!.push({ s, w });
}

/** Where the herd may be: the right kind of ground, and away from towns. */
function fits(s: Species, h: Habitat, x: number, y: number): boolean {
  const v = altitude(x, y);
  if (h === 'sea') return v < -0.2;
  if (h === 'ice') return v < -0.02 || (s.id === 'polarbear' && v < 0.3);
  if (v < 0.03) return false;
  if (h === 'mountain' ? v < 0.45 : v > MOUNTAIN_ALTITUDE + 0.1) return false;
  const ti = Math.floor(x / TILE), tj = Math.floor(y / TILE);
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
    const b = settlement(ti + di, tj + dj);
    if (b && Math.hypot(b.x - x, b.y - y) < (b.city ? 110 : 60)) return false;
  }
  return true;
}

const memo = new Map<string, Herd | null>();

/**
 * The herd of fauna cell (ci, cj), if any: the day one, or with `night` the one that comes out
 * after dark (drawn separately: the night has its own creatures).
 */
export function herd(ci: number, cj: number, night = false): Herd | null {
  const rkey = ci + ',' + cj + (night ? 'n' : '');
  const known = memo.get(rkey);
  if (known !== undefined) return known;
  if (memo.size > 60_000) memo.clear();
  const wi = wrapIndex(ci, CELLS_AROUND); // draw lots with the wrapped index: the planet wraps
  const o = night ? 7919 : 0; // other lots at night
  let out: Herd | null = null;
  const x = (ci + 0.15 + hash2(wi * 31 + 5 + o, cj * 37 - 2) * 0.7) * FAUNA_CELL;
  const y = (cj + 0.15 + hash2(wi * 43 - 9 + o, cj * 29 + 4) * 0.7) * FAUNA_CELL;
  const h = habitat(x, y);
  const chance = h === 'sea' ? SEA_CHANCE : h === 'ice' ? ICE_CHANCE : LAND_CHANCE;
  if (h && hash2(wi * 17 + 3 + o, cj * 19 + 11) < chance) {
    const list = byHabitat[night ? 1 : 0].get(h) ?? [];
    const total = list.reduce((a, e) => a + e.w, 0);
    let r = hash2(wi * 7 - 13 + o, cj * 11 + 23) * total, s: Species | null = null;
    for (const e of list) { r -= e.w; if (r < 0) { s = e.s; break; } }
    if (s && fits(s, h, x, y)) {
      // roam as far as the species likes, but no farther than the ground allows
      let range = 0;
      for (const f of [1, 0.6, 0.35, 0.15]) {
        const R = s.range * f;
        let ok = true;
        for (let k = 0; k < 8 && ok; k++) {
          const a = k * Math.PI / 4;
          ok = fits(s, h, x + Math.cos(a) * R, y + Math.sin(a) * R) && fits(s, h, x + Math.cos(a + 0.4) * R / 2, y + Math.sin(a + 0.4) * R / 2);
        }
        if (ok) { range = R; break; }
      }
      if (range > 0) {
        const [lo, hi] = s.herd;
        const count = lo + Math.floor(hash2(wi * 3 + 1 + o, cj * 5 - 7) * (hi - lo + 1));
        out = { key: wi + ',' + cj + (night ? 'n' : ''), species: s, x, y, range, count, seed: hash2(wi * 53 + o, cj * 59) * 1000 };
      }
    }
  }
  memo.set(rkey, out);
  return out;
}

/** Herds whose roaming area may reach into the box [x0, x1] x [y0, y1]. */
export function herdsNear(x0: number, y0: number, x1: number, y1: number, margin = 300, night = false): Herd[] {
  const out: Herd[] = [];
  for (let cj = Math.floor((y0 - margin) / FAUNA_CELL); cj <= Math.floor((y1 + margin) / FAUNA_CELL); cj++)
    for (let ci = Math.floor((x0 - margin) / FAUNA_CELL); ci <= Math.floor((x1 + margin) / FAUNA_CELL); ci++) {
      const h = herd(ci, cj, night);
      if (h && h.x + h.range + 30 > x0 && h.x - h.range - 30 < x1 && h.y + h.range + 30 > y0 && h.y - h.range - 30 < y1) out.push(h);
    }
  return out;
}

/** Progress along the herd's path: they move for a while, then stop to graze. */
function progress(t: number): number {
  const k = Math.floor(t), f = t - k;
  const m = Math.max(0, Math.min(1, (f - 0.45) / 0.55)); // still for 45 % of the time
  return k + m * m * (3 - 2 * m);
}

/** Smooth wandering offset in [-1, 1]. */
const wander = (s: number, seed: number): number => (noise(s, seed) - 0.5) * 2.4;

/** Where each animal of the herd is at world time t (seconds). */
export function animalsOf(hd: Herd, t: number): Animal[] {
  const s = hd.species, out: Animal[] = [];
  if (s.look.kind === 'bat' || s.look.kind === 'owl') return flyers(hd, t);
  // one "step" of the path is about range / speed seconds of walking
  const period = Math.max(8, (hd.range / s.speed) * 1.2);
  const spread = Math.sqrt(hd.count) * s.look.len * 1.6;
  for (let k = 0; k < hd.count; k++) {
    // each animal trails the leader a little: a herd strings out on the move
    const lag = k * 0.04, seed = hd.seed + k * 7.31;
    const pos = (tt: number): [number, number] => {
      const p = progress(tt / period + hd.seed - lag), q = tt / (period * 1.7) + seed; // the own small fidget
      return [
        hd.x + wander(p, hd.seed) * hd.range + (k ? Math.cos(seed) * spread + wander(q, seed + 3) * spread * 0.5 : 0),
        hd.y + wander(p, hd.seed + 50) * hd.range * 0.8 + (k ? Math.sin(seed) * spread * 0.6 + wander(q, seed + 9) * spread * 0.3 : 0),
      ];
    };
    const [x, y] = pos(t), [x2, y2] = pos(t + 0.5);
    const v = Math.hypot(x2 - x, y2 - y) * 2;
    // facing: the way it walks, or for a grazing animal a fixed whim of its own
    const dir = Math.abs(x2 - x) > 0.02 ? Math.sign(x2 - x) : (hash2(Math.floor(t / period + hd.seed - lag), Math.floor(seed)) < 0.5 ? -1 : 1);
    out.push({ x, y, dir, pace: Math.min(1, v / s.speed), phase: seed });
  }
  return out;
}

/**
 * Bats flit in quick, jerky loops around their roost; an owl glides in wide slow circles,
 * hunting. Both fly some way above the ground.
 */
function flyers(hd: Herd, t: number): Animal[] {
  const out: Animal[] = [], bat = hd.species.look.kind === 'bat';
  for (let k = 0; k < hd.count; k++) {
    const seed = hd.seed + k * 13.7, r = hd.range * (bat ? 0.25 + (k * 0.37 % 1) * 0.35 : 0.6);
    const w = hd.species.speed / Math.max(10, r) * (k % 2 ? 1 : -1); // angular speed
    const pos = (tt: number): [number, number] => {
      const a = tt * w + seed, j = bat ? (noise(tt * 0.8, seed) - 0.5) * r * 0.9 : 0;
      const cx = hd.x + wander(tt / 60, seed) * hd.range * 0.5, cy = hd.y + wander(tt / 60, seed + 5) * hd.range * 0.4;
      return [cx + Math.cos(a) * r + j, cy + Math.sin(a * (bat ? 1.7 : 1)) * r * 0.6 + j * 0.5];
    };
    const [x, y] = pos(t), [x2] = pos(t + 0.2);
    out.push({ x, y, dir: x2 >= x ? 1 : -1, pace: 1, phase: seed, alt: bat ? 14 + Math.sin(t * 3 + seed) * 4 : 22 });
  }
  return out;
}
