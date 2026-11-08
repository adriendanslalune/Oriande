// Walking and the fog of war. Pure rules, ported from the proto, no Phaser.
import { altitude, humidity, TILE } from '../world/terrain';
import { settlement, type Settlement } from '../world/settlements';
import { firstNeighbour } from '../world/roads';
import { landmark, type Landmark } from '../world/landmarks';
import { WONDER_SIGHT, wondersNear, type Wonder } from '../world/wonders';
import type { GameState } from './state';
import { alongPath, pathLength, planRoute } from './route';

/** Radius revealed around the explorer on open plains, world units. */
export const VIEW_RADIUS = 200;
/** Sight in a forest, where trees block the view. */
export const FOREST_SIGHT = 100;
/** Sight from the highest summits. */
export const MAX_SIGHT = 600;

/**
 * How far the explorer sees from (x, y): little under trees, normal on plains, further as the
 * ground rises (a hilltop or a summit shows the whole country around).
 */
export function sightRadius(x: number, y: number): number {
  const v = altitude(x, y), hu = humidity(x, y);
  if (v >= 0.02 && v < 0.45 && hu > 0.55) return FOREST_SIGHT; // the forests of the map
  const marsh = hu > 0.62 && v < 0.1;
  const base = marsh ? 150 : VIEW_RADIUS;
  return Math.min(MAX_SIGHT, base + Math.max(0, v - 0.3) * 1000);
}
/** Fog cell size, world units. */
export const CELL = 48;
/** Walking speed, world units per second (a league in a bit less than 6 s). */
export const SPEED = 7;
/** World units per league. */
export const LEAGUE = 40;
/** Map zoom of a new game. */
export const START_ZOOM = 1.3;
/** Distance between two footsteps (and fog reveals), world units. */
export const STEP_LENGTH = 10;
/** Footsteps kept in the trace. */
export const TRACE_MAX = 6000;

export const cellKey = (x: number, y: number): string => Math.round(x / CELL) + ',' + Math.round(y / CELL);
export const isSeen = (s: GameState, x: number, y: number): boolean => s.seen.has(cellKey(x, y));

/** Reveal every fog cell the explorer can see from (x, y). */
export function reveal(s: GameState, x: number, y: number): void {
  revealCircle(s, x, y, sightRadius(x, y));
}

/** Reveal every fog cell within `sight` of (x, y). */
export function revealCircle(s: GameState, x: number, y: number, sight: number): void {
  const ci = Math.round(x / CELL), cj = Math.round(y / CELL), R = Math.ceil(sight / CELL);
  for (let dj = -R; dj <= R; dj++) for (let di = -R; di <= R; di++) {
    if ((di * di + dj * dj) * CELL * CELL > sight * sight) continue;
    s.seen.add((ci + di) + ',' + (cj + dj));
  }
}

/** Where a new game starts: just outside a village that has a road, near the origin. */
export function startPosition(): { x: number; y: number } {
  let start: Settlement | null = null;
  for (let r = 0; r < 14 && !start; r++)
    for (let dj = -r; dj <= r && !start; dj++)
      for (let di = -r; di <= r && !start; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
        const b = settlement(di, dj);
        if (b && !b.city && firstNeighbour(b)) start = b;
      }
  if (start) {
    for (let a = 0; a < 6.28; a += 0.4) {
      const x = start.x + Math.cos(a) * 70, y = start.y + Math.sin(a) * 70, v = altitude(x, y);
      if (v > 0.05 && v < 0.45) return { x, y };
    }
  }
  return { x: 0, y: 0 };
}

export function newGame(): GameState {
  const { x, y } = startPosition();
  const s: GameState = {
    version: 2, x, y, leagues: 0,
    trace: [[Math.round(x) + 0, Math.round(y) + 0]],
    seen: new Set(), named: [], journey: null, zoom: START_ZOOM,
  };
  reveal(s, x, y);
  return s;
}

/** Fraction of the segment that can be walked before deep water (1 = all of it). */
/**
 * Start walking towards (x, y), around lakes and seas. A target in the water or on an island
 * brings the explorer to the nearest shore. Returns false when they cannot move at all.
 */
export function startJourney(s: GameState, x: number, y: number): boolean {
  const route = planRoute(s.x, s.y, x, y);
  if (!route) return false;
  const L = pathLength(route.path);
  if (L < 1) return false;
  s.journey = { path: route.path, elapsed: 0, duration: (L / SPEED) * 1000, revealed: 0, shore: !route.reached };
  return true;
}

export type TravelEvent =
  | { type: 'wonder'; wonder: Wonder }
  | { type: 'landmark'; landmark: Landmark }
  | { type: 'settlement'; settlement: Settlement }
  | { type: 'shore' };

/** Places newly discovered from (x, y). */
export function discover(s: GameState, x: number, y: number, out: TravelEvent[]): void {
  const ti = Math.floor(x / TILE), tj = Math.floor(y / TILE);
  // Wonders tower over the land: they are noticed from afar, and the ground around them shows.
  for (const w of wondersNear(x - WONDER_SIGHT, y - WONDER_SIGHT, x + WONDER_SIGHT, y + WONDER_SIGHT, 0)) {
    if (s.named.includes('w' + w.key) || Math.hypot(w.x - x, w.y - y) > WONDER_SIGHT) continue;
    s.named.push('w' + w.key);
    revealCircle(s, w.x, w.y, 130);
    out.push({ type: 'wonder', wonder: w });
  }
  // A landmark is noticed within 90 units, so only this tile and its neighbours matter.
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
    const L = landmark(ti + di, tj + dj);
    if (L && !s.named.includes(L.key) && Math.hypot(L.x - x, L.y - y) < 90) {
      s.named.push(L.key);
      out.push({ type: 'landmark', landmark: L });
    }
  }
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
    const b = settlement(ti + di, tj + dj);
    if (b && !s.named.includes('b' + b.key) && Math.hypot(b.x - x, b.y - y) < 110) {
      s.named.push('b' + b.key);
      out.push({ type: 'settlement', settlement: b });
    }
  }
}

/**
 * Walk for dt seconds. Reveals everything crossed (in 10-unit steps) and reports discoveries.
 * Returns true while walking.
 */
export function advance(s: GameState, dt: number, out: TravelEvent[] = []): boolean {
  const v = s.journey;
  if (!v) return false;
  v.elapsed += dt * 1000;
  const u = Math.min(1, v.elapsed / v.duration);
  const L = pathLength(v.path);
  // One footstep every STEP_LENGTH units, plus the arrival. (The proto advanced this by the
  // distance of one frame, which left a footstep per frame and only ~100 s of trace.)
  const step = (d: number): void => {
    v.revealed = d;
    const { x, y } = alongPath(v.path, d);
    reveal(s, x, y);
    s.trace.push([Math.round(x) + 0, Math.round(y) + 0]); // + 0 turns -0 into 0
    discover(s, x, y, out);
  };
  while (v.revealed + STEP_LENGTH <= u * L) step(v.revealed + STEP_LENGTH);
  if (u >= 1 && v.revealed < L) step(L);
  const ax = s.x, ay = s.y, at = alongPath(v.path, u * L);
  s.x = at.x;
  s.y = at.y;
  s.leagues += Math.hypot(s.x - ax, s.y - ay) / LEAGUE;
  if (u >= 1) {
    s.journey = null;
    if (v.shore) out.push({ type: 'shore' });
    if (s.trace.length > TRACE_MAX) s.trace.splice(0, s.trace.length - TRACE_MAX);
  }
  return true;
}

/** Leagues left on the current journey. */
export const leaguesLeft = (s: GameState): number =>
  s.journey ? ((s.journey.duration - s.journey.elapsed) / 1000) * SPEED / LEAGUE : 0;

/** Where the explorer is heading and the rest of the route, for drawing. */
export function routeAhead(s: GameState): { path: [number, number][]; dx: number } | null {
  const v = s.journey;
  if (!v) return null;
  const L = pathLength(v.path), d = Math.min(1, v.elapsed / v.duration) * L;
  const here = alongPath(v.path, d);
  let acc = 0;
  const rest: [number, number][] = [[here.x, here.y]];
  for (let k = 1; k < v.path.length; k++) {
    acc += Math.hypot(v.path[k][0] - v.path[k - 1][0], v.path[k][1] - v.path[k - 1][1]);
    if (acc > d) rest.push(v.path[k]);
  }
  return { path: rest, dx: here.dx };
}
