// Fights, turn by turn, and the encounters on the map. Pure rules, no Phaser: the Battle scene
// only shows what happens here. The dice are a seeded generator kept in the GameState, so a
// fight can be replayed and tested, and a save taken mid-fight resumes as it was.
import monstersData from '../data/monsters.json';
import itemsData from '../data/items.json';
import { altitude, humidity, TILE } from '../world/terrain';
import { biome } from '../world/climate';
import { settlement } from '../world/settlements';
import { roadsAround } from '../world/roads';
import type { GameState } from './state';

export interface Monster {
  id: string;
  hp: number;
  damage: [number, number];
  hit: number;
  gold: [number, number];
  flee: number;
  weight: Record<string, number>;
}

export interface Item { id: string; heal: number; price: number }

export const MONSTERS = monstersData.monsters as unknown as Monster[];
export const ITEMS = itemsData.items as Item[];
export const monsterById = (id: string): Monster | undefined => MONSTERS.find((m) => m.id === id);
export const itemById = (id: string): Item | undefined => ITEMS.find((i) => i.id === id);

/** The explorer at the start of a game. */
export const START_HP = 20;
export const START_ITEMS: Record<string, number> = { remede: 2, biscuit: 2 };
/** The explorer's blows: chance to land one, and the damage it does. */
export const PLAYER_HIT = 0.85;
export const PLAYER_DAMAGE: [number, number] = [3, 6];
/** Leagues of calm after a fight (and at the start of a game) before the next encounter. */
export const CALM_LEAGUES = 4;

// ---- the dice ----

/** A number in [0, 1), and the dice move on (mulberry32 on the saved seed). */
export function roll(s: GameState): number {
  let t = (s.seed = (s.seed + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const between = (s: GameState, [a, b]: [number, number]): number => a + Math.floor(roll(s) * (b - a + 1));

// ---- encounters ----

/** The kind of ground at (x, y), as the monsters see it. */
export function ground(x: number, y: number): string {
  const v = altitude(x, y), hu = humidity(x, y), b = biome(x, y, v, hu);
  if (v > 0.42) return 'hills';
  if (b === 'jungle') return 'jungle';
  if (b === 'desert' || b === 'savanna' || b === 'tundra') return b;
  if (b === 'temperate') return hu > 0.55 ? 'forest' : 'plain';
  return 'other';
}

/** Encounters per league walked, by ground: the woods are the least safe. */
const RATE: Record<string, number> = { forest: 0.1, jungle: 0.11, hills: 0.09, tundra: 0.07, desert: 0.06, savanna: 0.07, plain: 0.05, other: 0.05 };
/** On a road the traffic keeps them away; near a town, none at all. */
const ROAD_FACTOR = 0.2, TOWN_SAFE = 180;

/** Chance of an encounter per league walked at (x, y). */
export function encounterRate(x: number, y: number): number {
  const ti = Math.floor(x / TILE), tj = Math.floor(y / TILE);
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
    const b = settlement(ti + di, tj + dj);
    if (b && Math.hypot(b.x - x, b.y - y) < TOWN_SAFE) return 0;
  }
  let rate = RATE[ground(x, y)] ?? 0.05;
  for (const r of roadsAround(ti, tj, 2)) {
    if (r.maxX + 12 < x || r.minX - 12 > x || r.maxY + 12 < y || r.minY - 12 > y) continue;
    if (r.points.some((p) => Math.abs(p.x - x) < 12 && Math.abs(p.y - y) < 12)) { rate *= ROAD_FACTOR; break; }
  }
  return rate;
}

/** Which monster shows up at (x, y). */
export function pickMonster(s: GameState, x: number, y: number): Monster {
  const g = ground(x, y), w = MONSTERS.map((m) => m.weight[g] ?? m.weight.default ?? 1);
  let r = roll(s) * w.reduce((a, b) => a + b, 0);
  for (let k = 0; k < MONSTERS.length; k++) { r -= w[k]; if (r < 0) return MONSTERS[k]; }
  return MONSTERS[0];
}

/**
 * Whether a monster turns up as the explorer takes `step` world units at (x, y). Returns it, or
 * null. Never during the calm after a fight.
 */
export function maybeEncounter(s: GameState, x: number, y: number, stepLeagues: number): Monster | null {
  if (s.battle || s.leagues < s.calmUntil) return null;
  const p = encounterRate(x, y) * stepLeagues;
  if (p <= 0 || roll(s) >= p) return null;
  return pickMonster(s, x, y);
}

// ---- the fight ----

export type Action = { kind: 'attack' } | { kind: 'item'; item: string } | { kind: 'flee' };

/** What happened in a turn, in order, for the scene to show. */
export type Beat =
  | { who: 'you' | 'foe'; kind: 'hit'; damage: number }
  | { who: 'you' | 'foe'; kind: 'miss' }
  | { who: 'you'; kind: 'heal'; item: string; amount: number }
  | { who: 'you'; kind: 'flee'; ok: boolean }
  | { kind: 'won'; gold: number }
  | { kind: 'fled' }
  | { kind: 'lost'; goldLost: number };

export function startBattle(s: GameState, monster: string): void {
  const m = monsterById(monster);
  if (!m) throw new Error('unknown monster ' + monster);
  s.battle = { monster, hp: m.hp };
  s.journey = null; // the walk stops
}

/** The monster's blow. */
function foeTurn(s: GameState, m: Monster, out: Beat[]): void {
  if (roll(s) < m.hit) {
    const d = between(s, m.damage);
    s.hp = Math.max(0, s.hp - d);
    out.push({ who: 'foe', kind: 'hit', damage: d });
  } else out.push({ who: 'foe', kind: 'miss' });
}

/** The fight is over: the calm that follows. */
function end(s: GameState): void {
  s.battle = null;
  s.calmUntil = s.leagues + CALM_LEAGUES;
}

/** The explorer falls: they wake up at the last town found, with half their life, lighter of half their écus. */
function defeat(s: GameState, out: Beat[]): void {
  const lost = Math.floor(s.gold / 2);
  s.gold -= lost;
  s.hp = Math.ceil(s.maxHp / 2);
  [s.x, s.y] = s.rest;
  s.journey = null;
  end(s);
  out.push({ kind: 'lost', goldLost: lost });
}

/** Play one turn: the explorer acts, then the monster if it still stands. */
export function playTurn(s: GameState, action: Action): Beat[] {
  const b = s.battle, out: Beat[] = [];
  if (!b) return out;
  const m = monsterById(b.monster)!;
  if (action.kind === 'attack') {
    if (roll(s) < PLAYER_HIT) {
      const d = between(s, PLAYER_DAMAGE);
      b.hp = Math.max(0, b.hp - d);
      out.push({ who: 'you', kind: 'hit', damage: d });
    } else out.push({ who: 'you', kind: 'miss' });
    if (b.hp <= 0) {
      const gold = between(s, m.gold);
      s.gold += gold;
      end(s);
      out.push({ kind: 'won', gold });
      return out;
    }
  } else if (action.kind === 'item') {
    const it = itemById(action.item);
    if (!it || !(s.items[it.id] > 0)) return out; // nothing to use: the turn is not spent
    s.items[it.id] -= 1;
    if (s.items[it.id] <= 0) delete s.items[it.id];
    const amount = Math.min(it.heal, s.maxHp - s.hp);
    s.hp += amount;
    out.push({ who: 'you', kind: 'heal', item: it.id, amount });
  } else {
    const ok = roll(s) < m.flee;
    out.push({ who: 'you', kind: 'flee', ok });
    if (ok) { end(s); out.push({ kind: 'fled' }); return out; }
  }
  foeTurn(s, m, out);
  if (s.hp <= 0) defeat(s, out);
  return out;
}
