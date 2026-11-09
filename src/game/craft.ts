// Gathering, making, fishing (asked by Adrien: the explorer starts with nothing at all, and
// everything is made along the way). Pure rules, no Phaser: the map scene starts a piece of
// work and calls `stepWork` every frame; what it reports is shown on the map.
import itemsData from '../data/items.json';
import recipesData from '../data/recipes.json';
import { resourceAt, type Resource } from '../world/resources';
import { altitude } from '../world/terrain';
import { lakesNear, inLake } from '../world/rivers';
import { between, roll } from './dice';
import type { GameState, Work } from './state';

export interface Item { id: string; kind: 'food' | 'material' | 'tool'; heal: number; price: number }
export const ITEMS = itemsData.items as Item[];
export const itemById = (id: string): Item | undefined => ITEMS.find((i) => i.id === id);

export interface Recipe { id: string; needs: Record<string, number> }
export const RECIPES = recipesData.recipes as Recipe[];

/** Whether the explorer has made this tool. */
export const has = (s: GameState, id: string): boolean => (s.items[id] ?? 0) > 0;

/** The explorer's blows with what they hold: bare fists, a staff, a spear. */
export interface Weapon { id: 'poings' | 'baton' | 'lance'; damage: [number, number]; hit: number }
export const WEAPONS: Weapon[] = [
  { id: 'lance', damage: [3, 7], hit: 0.88 },
  { id: 'baton', damage: [2, 5], hit: 0.85 },
  { id: 'poings', damage: [1, 3], hit: 0.8 },
];
export const weaponOf = (s: GameState): Weapon => WEAPONS.find((w) => w.id === 'poings' || has(s, w.id))!;

/** Whether this can be made now: a tool not yet made, and everything it needs in the pack. */
export function canCraft(s: GameState, id: string): boolean {
  const r = RECIPES.find((x) => x.id === id);
  if (!r || has(s, id)) return false;
  return Object.entries(r.needs).every(([k, n]) => (s.items[k] ?? 0) >= n);
}

/** Make it: what it needs leaves the pack, the tool goes in. */
export function craft(s: GameState, id: string): boolean {
  if (!canCraft(s, id)) return false;
  for (const [k, n] of Object.entries(RECIPES.find((x) => x.id === id)!.needs)) {
    s.items[k] -= n;
    if (s.items[k] <= 0) delete s.items[k];
  }
  s.items[id] = 1;
  return true;
}

/** Seconds of work: gathering a handful, waiting for a bite. */
export const HARVEST_SECONDS = 4;
export const FISH_SECONDS = 7;
/** How near the explorer must be to gather (world units), and to cast a line over the water. */
export const HARVEST_REACH = 30;
export const FISH_REACH = 70;
/** The chance that a fish bites, each cast. */
export const BITE = 0.65;

/** Water a line can be cast into: the sea along the shore, or a lake. */
export function fishable(x: number, y: number): boolean {
  if (altitude(x, y) < 0) return true;
  return lakesNear(x - 1, y - 1, x + 1, y + 1).some((l) => inLake(l, x, y));
}

/** Set to work: gather what grows at (x, y), or fish in the water there. The walk is the map's. */
export function startWork(s: GameState, kind: Work['kind'], x: number, y: number): boolean {
  if (kind === 'fish' && !has(s, 'canne')) return false;
  const res = kind === 'harvest' ? resourceAt(x, y) : null;
  if (kind === 'harvest' && !res) return false;
  s.work = { kind, res, x, y, left: null };
  return true;
}

export type WorkEvent =
  | { kind: 'begin'; work: 'harvest' | 'fish' }
  | { kind: 'gathered'; res: Resource; n: number; x: number; y: number }
  | { kind: 'caught'; x: number; y: number }
  | { kind: 'nothing' }
  | { kind: 'tooFar' };

/**
 * dt seconds of work: once the explorer has arrived (no walk left), the work starts, and after
 * its time it gives what it gives. A fight or a new walk interrupts it. Returns what happened.
 */
export function stepWork(s: GameState, dt: number): WorkEvent[] {
  const w = s.work, out: WorkEvent[] = [];
  if (!w) return out;
  if (s.fight) { s.work = null; return out; }
  if (s.journey) { if (w.left !== null) s.work = null; return out; } // walked off: work given up
  if (w.left === null) {
    const d = Math.hypot(w.x - s.x, w.y - s.y);
    if (d > (w.kind === 'fish' ? FISH_REACH : HARVEST_REACH)) { s.work = null; out.push({ kind: 'tooFar' }); return out; }
    w.left = w.kind === 'fish' ? FISH_SECONDS : HARVEST_SECONDS;
    out.push({ kind: 'begin', work: w.kind });
    return out;
  }
  w.left -= dt;
  if (w.left > 0) return out;
  s.work = null;
  if (w.kind === 'harvest' && w.res) {
    const n = between(s, [1, 3]);
    s.items[w.res] = (s.items[w.res] ?? 0) + n;
    out.push({ kind: 'gathered', res: w.res as Resource, n, x: s.x, y: s.y });
  } else if (w.kind === 'fish') {
    if (roll(s) < BITE) { s.items.poisson = (s.items.poisson ?? 0) + 1; out.push({ kind: 'caught', x: w.x, y: w.y }); }
    else out.push({ kind: 'nothing' });
  }
  return out;
}
