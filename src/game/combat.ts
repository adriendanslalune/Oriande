// Fights on the map, in real time (asked by Adrien: no monsters, no battle window). Dangerous
// animals charge whoever comes near; the explorer can hunt the others for their meat. Blows are
// traded on their own, about one a second each, while the two are close; the player walks away
// to break off, or eats and drinks from the pack. Pure rules, no Phaser: the map scene calls
// `stepFight` every frame and shows what it reports. The dice are seeded and saved.
import { animalsOf, herdsNear, lifeOf, presence, SPECIES, type Herd, type Species } from '../world/fauna';
import { settlement } from '../world/settlements';
import { TILE } from '../world/terrain';
import { walkable } from './route';
import type { Fight, GameState } from './state';

import { ITEMS, has, itemById, weaponOf } from './craft';
import { CAMP_SAFE, nearCamp } from './camp';
import { HUNGRY, eat } from './survival';
import { between, roll } from './dice';
export { ITEMS, itemById, roll };
export const speciesById = (id: string): Species | undefined => SPECIES.find((s) => s.id === id);

/** The explorer at the start of a game: nothing in the pack, nothing in the hands (asked by Adrien). */
export const START_HP = 20;
export const START_ITEMS: Record<string, number> = {};
/** The explorer's blows: one every PLAYER_PACE seconds (how hard and how sure: their weapon, see craft.ts). */
export const PLAYER_PACE = 1.0;
/** An animal's blows. */
export const FOE_HIT = 0.7;
export const FOE_PACE = 1.25;
/** Close enough to strike, world units. */
export const CONTACT = 22;
/** A dangerous animal charges whoever comes this near (about 2.5 leagues). */
export const AGGRO = 100;
/** It gives up the chase this far from where it set off... */
export const LEASH = 320;
/** ...and a hunted animal is lost once this far ahead. */
export const ESCAPE = 260;
/** No animal attacks within this distance of a town, nor during the calm after a fight (s). */
export const TOWN_SAFE = 180;
export const CALM_SECONDS = 20;
/** How many carcasses are left lying on the map (the oldest goes when a new one falls). */
export const CARCASSES = 5;
/** How long a killed animal stays gone, and one that got away (world seconds). */
export const RESPAWN = 30 * 60;
export const REGROUP = 3 * 60;
/** The explorer's life comes back slowly out of a fight: one point every REGEN seconds. */
export const REGEN = 30;
/** A charging animal runs this much faster than it walks. */
export const CHARGE = 2;
/** A hunted prey goes on grazing until the explorer comes this near, then runs, at this share of its speed. */
export const STARTLE = 45;
export const PREY_RUN = 0.6;
/** The explorer runs after a prey: this much faster than walking. */
export const HUNT_RUN = 1.5;


/** An animal standing on the map at time t: its herd, its key, where it is. */
export interface Beast { herd: Herd; key: string; species: Species; x: number; y: number }

/** The animals out near (x, y) within r, at time t (resting herds, gone ones and the one in a fight left out). */
export function beastsNear(s: GameState, x: number, y: number, r: number, t: number): Beast[] {
  const out: Beast[] = [];
  for (const night of [false, true]) for (const h of herdsNear(x - r, y - r, x + r, y + r, 320, night)) {
    if (presence(h, night, t) < 0.5) continue;
    const look = h.species.look;
    if (look.kind === 'whale' || look.kind === 'bat' || look.kind === 'owl') continue; // out of reach
    animalsOf(h, t).forEach((a, k) => {
      const key = h.key + ':' + k;
      if ((s.gone[key] ?? 0) > t || s.fight?.key === key) return;
      if (Math.hypot(a.x - x, a.y - y) <= r) out.push({ herd: h, key, species: h.species, x: a.x, y: a.y });
    });
  }
  return out;
}

export const nearTown = (x: number, y: number): boolean => {
  const ti = Math.floor(x / TILE), tj = Math.floor(y / TILE);
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
    const b = settlement(ti + di, tj + dj);
    if (b && Math.hypot(b.x - x, b.y - y) < TOWN_SAFE) return true;
  }
  return false;
};

/** Start a fight with this animal (it charges, or it is hunted). */
export function engage(s: GameState, b: Beast, hunt: boolean): void {
  s.fight = { key: b.key, species: b.species.id, hp: lifeOf(b.species), x: b.x, y: b.y, home: [b.x, b.y], hunt, cdYou: 0.4, cdFoe: 0.8 };
}

/** What happened during a step, for the map to show (floating numbers, a note). */
export type FightEvent =
  | { kind: 'charge'; species: string }
  | { kind: 'hit'; who: 'you' | 'foe'; damage: number; x: number; y: number }
  | { kind: 'miss'; who: 'you' | 'foe'; x: number; y: number }
  | { kind: 'killed'; species: string; meat: number; hide: number; bone: number; x: number; y: number }
  | { kind: 'escaped'; species: string }
  | { kind: 'gaveUp'; species: string }
  | { kind: 'lost'; goldLost: number };

/** Whether an animal of this species fights back: always the dangerous ones, the defensive ones when hunted. */
const fightsBack = (sp: Species, f: Fight): boolean => sp.danger >= 2 || (sp.danger === 1 && f.hunt);

/** Move (x, y) towards (tx, ty) by d, staying on ground an animal can tread. */
function moveTowards(f: Fight, tx: number, ty: number, d: number, away = false): void {
  let dx = tx - f.x, dy = ty - f.y;
  const L = Math.hypot(dx, dy) || 1;
  dx /= L; dy /= L;
  if (away) { dx = -dx; dy = -dy; }
  // straight, or veering a little to get round water
  for (const a of [0, 0.5, -0.5, 1, -1]) {
    const c = Math.cos(a), sn = Math.sin(a), nx = f.x + (dx * c - dy * sn) * d, ny = f.y + (dx * sn + dy * c) * d;
    if (walkable(nx, ny)) { f.x = nx; f.y = ny; return; }
  }
}

/** The explorer falls: they wake up at the last town found, with half their life, lighter of half their écus. */
function defeat(s: GameState, t: number, out: FightEvent[]): void {
  const lost = Math.floor(s.gold / 2);
  s.gold -= lost;
  s.hp = Math.ceil(s.maxHp / 2);
  [s.x, s.y] = s.rest;
  s.journey = null;
  if (s.fight) s.gone[s.fight.key] = t + REGROUP;
  s.fight = null;
  s.calmUntil = t + CALM_SECONDS * 3;
  out.push({ kind: 'lost', goldLost: lost });
}

/** The fight is over (won, fled, given up, a hunt abandoned): the calm that follows. */
export function end(s: GameState, t: number, back: number): void {
  if (s.fight) s.gone[s.fight.key] = t + back;
  s.fight = null;
  s.calmUntil = t + CALM_SECONDS;
}

/**
 * Play dt seconds of the world's dangers at world time t: an animal may charge, the fight in
 * progress goes on (moves, blows, the end of it), and out of a fight the explorer's life comes
 * back slowly. Returns what happened.
 */
export function stepFight(s: GameState, dt: number, t: number): FightEvent[] {
  const out: FightEvent[] = [];
  // forget the animals that are back
  for (const k in s.gone) if (s.gone[k] <= t) delete s.gone[k];
  if (!s.fight) {
    // life comes back, little by little
    if (s.hp < s.maxHp && s.food >= HUNGRY && roll(s) < dt / REGEN) s.hp += 1; // not on an empty belly
    // a dangerous animal near, and the explorer not in the safety of a town: it charges
    if (t >= s.calmUntil && !nearTown(s.x, s.y) && !nearCamp(s, s.x, s.y, t, CAMP_SAFE)) { // none comes near a fire
      const threats = beastsNear(s, s.x, s.y, AGGRO, t).filter((b) => b.species.danger >= 2);
      if (threats.length) {
        threats.sort((a, b) => Math.hypot(a.x - s.x, a.y - s.y) - Math.hypot(b.x - s.x, b.y - s.y));
        engage(s, threats[0], false);
        s.journey = null; // the explorer stops and faces it: walking away is the player's choice
        out.push({ kind: 'charge', species: threats[0].species.id });
      }
    }
    if (!s.fight) return out;
  }
  const f = s.fight!, sp = speciesById(f.species)!;
  const d = Math.hypot(s.x - f.x, s.y - f.y), back = fightsBack(sp, f);
  // the animal moves: at the explorer (it fights), or away from them (a hunted prey runs)
  if (back) {
    if (Math.hypot(f.x - f.home[0], f.y - f.home[1]) > LEASH && !f.hunt) { out.push({ kind: 'gaveUp', species: f.species }); end(s, t, REGROUP); return out; }
    if (d > CONTACT * 0.8) moveTowards(f, s.x, s.y, Math.min(d - CONTACT * 0.8, sp.speed * CHARGE * dt));
  } else {
    if (d > ESCAPE) { out.push({ kind: 'escaped', species: f.species }); end(s, t, REGROUP); return out; }
    if (d < STARTLE) moveTowards(f, s.x, s.y, sp.speed * PREY_RUN * dt, true);
  }
  // a fighting animal that the explorer outran for good
  if (back && d > ESCAPE * 1.5) { out.push({ kind: 'gaveUp', species: f.species }); end(s, t, REGROUP); return out; }
  // blows, while the two are close
  const close = Math.hypot(s.x - f.x, s.y - f.y) <= CONTACT;
  f.cdYou = Math.max(0, f.cdYou - dt); f.cdFoe = Math.max(0, f.cdFoe - dt);
  if (close && f.cdYou === 0) {
    f.cdYou = PLAYER_PACE;
    const wp = weaponOf(s);
    if (roll(s) < wp.hit) {
      const dmg = between(s, wp.damage);
      f.hp = Math.max(0, f.hp - dmg);
      out.push({ kind: 'hit', who: 'you', damage: dmg, x: f.x, y: f.y });
      if (f.hp <= 0) {
        // with a knife, the explorer cuts more meat, and takes the hide and a bone
        const knife = has(s, 'couteau');
        const meat = Math.max(1, Math.min(6, Math.round(sp.food / 2))) + (knife ? 1 : 0);
        s.items.viande = (s.items.viande ?? 0) + meat;
        const hide = knife && sp.size !== 'small' ? (sp.size === 'large' ? 2 : 1) : 0, bone = knife ? 1 : 0;
        if (hide) s.items.peau = (s.items.peau ?? 0) + hide;
        if (bone) s.items.os = (s.items.os ?? 0) + bone;
        // it lies where it fell, facing away from the explorer
        s.carcasses.push({ species: f.species, x: f.x, y: f.y, dir: f.x >= s.x ? 1 : -1, t });
        if (s.carcasses.length > CARCASSES) s.carcasses.splice(0, s.carcasses.length - CARCASSES);
        out.push({ kind: 'killed', species: f.species, meat, hide, bone, x: f.x, y: f.y });
        end(s, t, RESPAWN);
        return out;
      }
    } else out.push({ kind: 'miss', who: 'you', x: f.x, y: f.y });
  }
  if (close && back && f.cdFoe === 0) {
    f.cdFoe = FOE_PACE;
    if (roll(s) < FOE_HIT) {
      const dmg = Math.max(1, between(s, sp.damage ?? [1, 2]) - (s.equip.body === 'veste' ? 1 : 0)); // a leather jacket, worn, takes the edge off
      s.hp = Math.max(0, s.hp - dmg);
      out.push({ kind: 'hit', who: 'foe', damage: dmg, x: s.x, y: s.y });
      if (s.hp <= 0) defeat(s, t, out);
    } else out.push({ kind: 'miss', who: 'foe', x: s.x, y: s.y });
  }
  return out;
}

/** Eat or drink something from the pack: life back (see survival.ts). Returns the life it gave (0 if nothing). */
export function useItem(s: GameState, id: string): number {
  return eat(s, id)?.heal ?? 0;
}

/** Go after this animal (a tap and "Hunt"): the fight starts, the explorer walks to it. */
export function hunt(s: GameState, b: Beast): void {
  engage(s, b, true);
}
