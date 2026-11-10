// Fabulous lands (asked by Adrien): fifteen extraordinary landscapes, each one unique on the whole
// planet, the same for every player — a forest of giant mushrooms, a forest of crystal, a desert of
// glass... Each spreads over a few leagues and is drawn on the map as a landscape of its own (see
// render/realms.ts), not as an icon. Where each one lies is worked out once, deterministically: the
// planet is searched, in a fixed pseudo-random order, for a spot of the right climate, far from the
// other fabulous lands.
import { hash2, fbm } from './noise';
import { altitude, humidity, MOUNTAIN_ALTITUDE } from './terrain';
import { biome, type Biome } from './climate';
import { CIRCUMFERENCE, EQUATOR_Y, nearestCopy } from './planet';

export type RealmKind =
  | 'mushrooms' | 'crystal' | 'glass' | 'clouds' | 'floating' | 'stonelake' | 'bones' | 'fireflies'
  | 'statues' | 'pillars' | 'aurora' | 'crater' | 'upriver' | 'singing' | 'menhirs';

/** What each fabulous land needs: its climates (or 'mountain', or 'ice'), and its size in world units. */
interface RealmRule { kind: RealmKind; where: (Biome | 'mountain')[]; radius: number }
const RULES: RealmRule[] = [
  { kind: 'mushrooms', where: ['jungle'], radius: 520 },
  { kind: 'crystal', where: ['tundra'], radius: 460 },
  { kind: 'glass', where: ['desert'], radius: 620 },
  { kind: 'clouds', where: ['mountain'], radius: 420 },
  { kind: 'floating', where: ['savanna', 'desert'], radius: 480 },
  { kind: 'stonelake', where: ['temperate'], radius: 360 },
  { kind: 'bones', where: ['desert', 'savanna'], radius: 440 },
  { kind: 'fireflies', where: ['jungle'], radius: 420 },
  { kind: 'statues', where: ['temperate'], radius: 400 },
  { kind: 'pillars', where: ['jungle'], radius: 480 },
  { kind: 'aurora', where: ['ice'], radius: 600 },
  { kind: 'crater', where: ['temperate', 'savanna', 'desert', 'tundra'], radius: 380 },
  { kind: 'upriver', where: ['mountain'], radius: 360 },
  { kind: 'singing', where: ['desert'], radius: 560 },
  { kind: 'menhirs', where: ['tundra', 'temperate'], radius: 380 },
];
export const REALM_KINDS = RULES.map((r) => r.kind);

export interface Realm { kind: RealmKind; x: number; y: number; radius: number; key: string }

/** The ground at (x, y) as the rules see it. */
function groundAt(x: number, y: number): Biome | 'mountain' {
  const v = altitude(x, y);
  if (v >= MOUNTAIN_ALTITUDE) return 'mountain';
  return biome(x, y, v, humidity(x, y));
}

/** Whether a fabulous land of this rule fits at (x, y): the right ground at its heart and most of the way round. */
function fits(rule: RealmRule, x: number, y: number): boolean {
  if (!rule.where.includes(groundAt(x, y))) return false;
  let good = 0;
  for (let k = 0; k < 12; k++) {
    const a = k * Math.PI / 6;
    for (const f of [0.45, 0.85]) if (rule.where.includes(groundAt(x + Math.cos(a) * rule.radius * f, y + Math.sin(a) * rule.radius * f * 0.8))) good++;
  }
  return good >= 17; // 17 of the 24 points around
}

/** How far apart two fabulous lands must be, at least (about 175 leagues). */
const APART = 7_000;
/** And how far from the start (the first one is found by walking, not given). */
const FROM_START = 2_500;

/**
 * Where the search put them (it takes seconds, too long for every start of the game): kept here, and
 * checked by the tests against a new search (searchRealms) whenever the world changes.
 */
const PLACED: [RealmKind, number, number][] = [["mushrooms", -21504, 70656], ["crystal", -46080, -25600], ["glass", -7168, 50176], ["clouds", -162816, 15360], ["floating", -91136, 80896], ["stonelake", -134144, 11264], ["bones", 173056, 52224], ["fireflies", -5120, 19456], ["statues", 5120, 29696], ["pillars", 132096, 50176], ["aurora", 177152, 132096], ["crater", 5120, 17408], ["upriver", 41984, 76800], ["singing", -148480, 39936], ["menhirs", 13312, 23552]];

let placed: Realm[] | null = null;

/** Every fabulous land of the planet. */
export function realms(): Realm[] {
  if (placed) return placed;
  placed = PLACED.map(([kind, x, y]) => ({ kind, x, y, radius: RULES.find((r) => r.kind === kind)!.radius, key: 'r' + kind }));
  return placed;
}

/** Search the planet for the fabulous lands' places (slow: for the tests and for remaking PLACED). */
export function searchRealms(): Realm[] {
  const out: Realm[] = [];
  // candidates on a grid of 2,048 units (about 50 leagues) between 72°N and 72°S, their ground worked
  // out once for all the rules, then tried in a fixed shuffled order for each one
  const G = 2048, NI = CIRCUMFERENCE / G, lat = (d: number): number => EQUATOR_Y - d * CIRCUMFERENCE / 360;
  const j0 = Math.floor(lat(72) / G), j1 = Math.ceil(lat(-72) / G), NJ = j1 - j0 + 1;
  const ground: (Biome | 'mountain')[] = new Array(NI * NJ);
  for (let j = 0; j < NJ; j++) for (let i = 0; i < NI; i++) ground[j * NI + i] = groundAt((i + 0.5) * G - CIRCUMFERENCE / 2, (j + j0 + 0.5) * G);
  for (const [n, rule] of RULES.entries()) {
    let best: { x: number; y: number; r: number } | null = null;
    for (let j = 0; j < NJ; j++) for (let i = 0; i < NI; i++) {
      if (!rule.where.includes(ground[j * NI + i])) continue;
      const r = hash2(i * 31 + n * 977, j * 17 - n * 131);
      if (best && r >= best.r) continue; // keep the candidate first in the shuffled order
      const x = (i + 0.5) * G - CIRCUMFERENCE / 2, y = (j + j0 + 0.5) * G;
      if (Math.hypot(x, y - lat(0)) < FROM_START) continue;
      if (out.some((o) => Math.hypot(nearestCopy(o.x, x) - x, o.y - y) < APART)) continue;
      if (!fits(rule, x, y)) continue;
      best = { x, y, r };
    }
    if (best) out.push({ kind: rule.kind, x: best.x, y: best.y, radius: rule.radius, key: 'r' + rule.kind });
  }
  return out;
}

/** Fabulous lands whose grounds may reach the box [x0, x1] × [y0, y1] (with their copies around the planet). */
export function realmsNear(x0: number, y0: number, x1: number, y1: number): Realm[] {
  const out: Realm[] = [];
  for (const r of realms()) {
    const x = nearestCopy(r.x, (x0 + x1) / 2), R = r.radius * 1.25;
    if (x + R > x0 && x - R < x1 && r.y + R > y0 && r.y - R < y1) out.push(x === r.x ? r : { ...r, x });
  }
  return out;
}

/**
 * How deep inside a fabulous land (x, y) lies: 0 outside, rising to 1 well inside. The border
 * wanders a little (noise), so the land does not look like a drawn circle.
 */
export function realmDepth(r: Realm, x: number, y: number): number {
  const dx = x - nearestCopy(r.x, x), dy = (y - r.y) / 0.8, d = Math.hypot(dx, dy) / r.radius;
  if (d > 1.3) return 0;
  const edge = 1 + (fbm(x / 140 + 7, y / 140 - 3, 3, CIRCUMFERENCE / 140) - 0.5) * 0.5;
  return Math.max(0, Math.min(1, (edge - d) / 0.18));
}

/** The fabulous land at (x, y), if any, and how deep inside it. */
export function realmAt(x: number, y: number): { realm: Realm; depth: number } | null {
  for (const r of realmsNear(x, y, x, y)) {
    const depth = realmDepth(r, x, y);
    if (depth > 0) return { realm: r, depth };
  }
  return null;
}
