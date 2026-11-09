// Towns (phase 1, step 5): arriving in a village or a city opens its page. A village is small:
// an inn and a modest merchant. A city has everything: an inn, a bigger merchant who pays better,
// a smith selling weapons, a tavern where rumours go round (asked by Adrien). Pure rules, no
// Phaser: the map scene shows the page and calls these.
import townsData from '../data/towns.json';
import { hash2 } from '../world/noise';
import { TILE, altitude, humidity } from '../world/terrain';
import { biome, type Biome } from '../world/climate';
import { settlement, type Settlement } from '../world/settlements';
import { ITEMS, has, itemById, takeUp, WEAPONS } from './craft';
import type { GameState } from './state';
import { FOOD_MAX } from './survival';

export interface TownKind { inn: number; sells: string[]; buys: number; forge: string[]; tavern: boolean }
export const VILLAGE = townsData.village as TownKind;
export const CITY = townsData.city as TownKind;
export const RUMORS = townsData.rumors as string[];
export interface Dish { id: string; food: number; heal: number; price: number }
export const DISHES = townsData.dishes as Dish[];
const FLAVOURS = townsData.flavour as number;
export const kindOf = (b: Settlement): TownKind => (b.city ? CITY : VILLAGE);

/** How near its centre the explorer must stand to be in a town (world units). */
export const IN_VILLAGE = 40, IN_CITY = 60;

/** The town the explorer stands in at (x, y), if any. */
export function townAt(x: number, y: number): Settlement | null {
  const ti = Math.floor(x / TILE), tj = Math.floor(y / TILE);
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
    const b = settlement(ti + di, tj + dj);
    if (b && Math.hypot(b.x - x, b.y - y) < (b.city ? IN_CITY : IN_VILLAGE)) return b;
  }
  return null;
}

/** A night at the inn: life back in full, for its price. Returns false if it cannot be paid (or is not needed). */
export function sleep(s: GameState, b: Settlement): boolean {
  const cost = kindOf(b).inn;
  if (s.gold < cost || s.hp >= s.maxHp) return false;
  s.gold -= cost;
  s.hp = s.maxHp;
  return true;
}

/** What the merchant pays for one of this (food and gathered things only), or 0. */
export function sellPrice(b: Settlement, id: string): number {
  const it = itemById(id);
  if (!it || it.kind === 'tool') return 0;
  return Math.max(1, Math.floor(it.price * kindOf(b).buys));
}

/** Sell one of this to the merchant. */
export function sell(s: GameState, b: Settlement, id: string): boolean {
  const p = sellPrice(b, id);
  if (!p || !(s.items[id] > 0)) return false;
  s.items[id] -= 1;
  if (s.items[id] <= 0) delete s.items[id];
  s.gold += p;
  return true;
}

/** What can be bought here: the merchant's goods, and the smith's (a tool or weapon already owned is not sold again). */
export function goods(s: GameState, b: Settlement): { id: string; price: number; smith: boolean }[] {
  const k = kindOf(b), out: { id: string; price: number; smith: boolean }[] = [];
  for (const id of k.sells) { const it = itemById(id); if (it && !(it.kind === 'tool' && has(s, id))) out.push({ id, price: it.price, smith: false }); }
  for (const id of k.forge) { const it = itemById(id); if (it && !has(s, id)) out.push({ id, price: it.price, smith: true }); }
  return out;
}

/** Buy one of this here. */
export function buy(s: GameState, b: Settlement, id: string): boolean {
  const g = goods(s, b).find((x) => x.id === id);
  if (!g || s.gold < g.price) return false;
  s.gold -= g.price;
  s.items[id] = (s.items[id] ?? 0) + 1;
  takeUp(s, id); // a new weapon or torch goes in hand if it is free, or better
  return true;
}

/** The rumour going round this town's tavern at world time t (seconds): a new one every half hour. Null in a village. */
export function rumor(b: Settlement, t: number): string | null {
  if (!kindOf(b).tavern) return null;
  const k = Math.floor(hash2(b.wi * 31 + Math.floor(t / 1800), b.tj * 17 + 5) * RUMORS.length);
  return RUMORS[Math.min(RUMORS.length - 1, k)];
}

/** The damage of a weapon, for the smith's stall. */
export const weaponDamage = (id: string): [number, number] | null => WEAPONS.find((w) => w.id === id)?.damage ?? null;

/** Everything the explorer could sell, with its price here. */
export const sellable = (s: GameState, b: Settlement): { id: string; n: number; price: number }[] =>
  ITEMS.filter((it) => it.kind !== 'tool' && (s.items[it.id] ?? 0) > 0).map((it) => ({ id: it.id, n: s.items[it.id], price: sellPrice(b, it.id) }));

/** A dish at the tavern (a city's): paid, eaten at once. False if too poor, or it would do nothing. */
export function eatDish(s: GameState, b: Settlement, id: string): boolean {
  const d = DISHES.find((x) => x.id === id);
  if (!d || !kindOf(b).tavern || s.gold < d.price) return false;
  if ((d.food === 0 || s.food >= FOOD_MAX - 1) && (d.heal === 0 || s.hp >= s.maxHp)) return false;
  s.gold -= d.price;
  s.food = Math.min(FOOD_MAX, s.food + d.food);
  s.hp = Math.min(s.maxHp, s.hp + d.heal);
  return true;
}

/** The country a town stands in (forest, savanna, desert...), for its welcome. */
export const regionOf = (b: Settlement): Biome => { const v = altitude(b.x, b.y); return biome(b.x, b.y, v, humidity(b.x, b.y)); };

/** Which line of welcome this town has (the same each time one comes back to it). */
export const flavourOf = (b: Settlement): number => Math.floor(hash2(b.wi * 7 + 3, b.tj * 11 - 5) * FLAVOURS) % FLAVOURS;
