// Survival (asked by Adrien): a belly that empties as time goes, faster on the move; food that
// fills it, better cooked than raw; a campfire to cook by and to sleep by. Pure rules, no Phaser:
// the map scene calls `stepHunger` every frame and shows what it reports.
import { itemById } from './craft';
import { CAMP_REACH, campLit, nearCamp } from './camp';
import { roll } from './dice';
import type { GameState } from './state';

export const FOOD_MAX = 100;
/** Seconds for the belly to lose a point at rest: full to empty in about half an hour. */
export const HUNGER_SECONDS = 18;
/** Walking (or running after game) empties it faster. */
export const WALK_HUNGER = 1.6;
/** Under this, the explorer is hungry: life no longer comes back by itself. */
export const HUNGRY = 30;
/** Starving (an empty belly): a point of life lost every so often (seconds). */
export const STARVE_SECONDS = 20;
/** A bad belly (something eaten raw): life lost. */
export const SICK_DAMAGE = 3;
/** A night by the fire: life back in full, for this much of the belly. */
export const SLEEP_FOOD = 20;

export type HungerEvent = { kind: 'hungry' } | { kind: 'starving' } | { kind: 'fainted'; goldLost: number };

/** dt seconds of hunger (walking or not). Returns what happened. */
export function stepHunger(s: GameState, dt: number, walking: boolean): HungerEvent[] {
  const out: HungerEvent[] = [];
  const before = s.food;
  s.food = Math.max(0, s.food - (dt / HUNGER_SECONDS) * (walking ? WALK_HUNGER : 1));
  if (before >= HUNGRY && s.food < HUNGRY) out.push({ kind: 'hungry' });
  if (s.food <= 0 && roll(s) < dt / STARVE_SECONDS) {
    s.hp -= 1;
    out.push({ kind: 'starving' });
    if (s.hp <= 0) {
      // fainted from hunger: found and carried to the last town, like after a lost fight
      const lost = Math.floor(s.gold / 2);
      s.gold -= lost; s.hp = Math.ceil(s.maxHp / 2); s.food = 40;
      [s.x, s.y] = s.rest; s.journey = null; s.work = null; s.fight = null;
      out.push({ kind: 'fainted', goldLost: lost });
    }
  }
  return out;
}

/** What eating this did: life given, belly filled, a bad belly. Null if it cannot be eaten now. */
export interface Meal { heal: number; food: number; sick: boolean }

/** Eat (or drink) one of this from the pack. */
export function eat(s: GameState, id: string): Meal | null {
  const it = itemById(id);
  if (!it || it.kind !== 'food' || !(s.items[id] > 0)) return null;
  const fills = it.food ?? 0;
  if (s.hp >= s.maxHp && (fills === 0 || s.food >= FOOD_MAX - 1)) return null; // nothing it would do
  s.items[id] -= 1;
  if (s.items[id] <= 0) delete s.items[id];
  const heal = Math.min(it.heal, s.maxHp - s.hp);
  s.hp += heal;
  s.food = Math.min(FOOD_MAX, s.food + fills);
  const sick = !!it.sick && roll(s) < it.sick;
  if (sick) s.hp = Math.max(1, s.hp - SICK_DAMAGE);
  return { heal, food: fills, sick };
}

/** Whether this can be cooked (raw meat, fish, mushrooms) and the fire is near. */
export const canCook = (s: GameState, id: string, t: number): boolean =>
  !!itemById(id)?.cooks && (s.items[id] ?? 0) > 0 && nearCamp(s, s.x, s.y, t, CAMP_REACH);

/** Cook one of this on the fire. */
export function cook(s: GameState, id: string, t: number): boolean {
  if (!canCook(s, id, t)) return false;
  const to = itemById(id)!.cooks!;
  s.items[id] -= 1;
  if (s.items[id] <= 0) delete s.items[id];
  s.items[to] = (s.items[to] ?? 0) + 1;
  return true;
}

/** Whether the explorer could sleep by the fire now (near it, tired, not starving). */
export const canSleepByFire = (s: GameState, t: number): boolean =>
  nearCamp(s, s.x, s.y, t) && s.hp < s.maxHp && s.food >= SLEEP_FOOD && !s.fight;

/** A night by the fire: life back in full; the belly pays for it. */
export function sleepByFire(s: GameState, t: number): boolean {
  if (!canSleepByFire(s, t)) return false;
  s.hp = s.maxHp;
  s.food -= SLEEP_FOOD;
  s.calmUntil = Math.max(s.calmUntil, t + 60);
  return true;
}

export { campLit };
