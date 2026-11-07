// Walking and the fog of war. Pure rules, ported from the proto, no Phaser.
import { altitude, TILE } from '../world/terrain';
import { settlement, type Settlement } from '../world/settlements';
import { firstNeighbour } from '../world/roads';
import { landmark, type Landmark } from '../world/landmarks';
import type { GameState } from './state';

/** Radius revealed around the explorer, world units. */
export const VIEW_RADIUS = 200;
/** Fog cell size, world units. */
export const CELL = 48;
/** Walking speed, world units per second (a league in a bit less than 6 s). */
export const SPEED = 7;
/** World units per league. */
export const LEAGUE = 40;
/** Footsteps kept in the trace. */
export const TRACE_MAX = 6000;

export const cellKey = (x: number, y: number): string => Math.round(x / CELL) + ',' + Math.round(y / CELL);
export const isSeen = (s: GameState, x: number, y: number): boolean => s.seen.has(cellKey(x, y));

/** Reveal every fog cell within VIEW_RADIUS of (x, y). */
export function reveal(s: GameState, x: number, y: number): void {
  const ci = Math.round(x / CELL), cj = Math.round(y / CELL), R = Math.ceil(VIEW_RADIUS / CELL);
  for (let dj = -R; dj <= R; dj++) for (let di = -R; di <= R; di++) {
    if ((di * di + dj * dj) * CELL * CELL > VIEW_RADIUS * VIEW_RADIUS) continue;
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
    version: 1, x, y, leagues: 0,
    trace: [[Math.round(x), Math.round(y)]],
    seen: new Set(), named: [], journey: null,
  };
  reveal(s, x, y);
  return s;
}

/** Fraction of the segment that can be walked before deep water (1 = all of it). */
export function walkableFraction(x0: number, y0: number, x1: number, y1: number): number {
  const d = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(d / 4));
  for (let k = 1; k <= n; k++) {
    const u = k / n;
    if (altitude(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u) < 0) return Math.max(0, (k - 1) / n);
  }
  return 1;
}

/** Start walking towards (x, y). Returns false when the explorer cannot move at all (water ahead). */
export function startJourney(s: GameState, x: number, y: number): boolean {
  const u = walkableFraction(s.x, s.y, x, y);
  const tx = s.x + (x - s.x) * u, ty = s.y + (y - s.y) * u, d = Math.hypot(tx - s.x, ty - s.y);
  if (d < 1) return false;
  s.journey = { x0: s.x, y0: s.y, x1: tx, y1: ty, elapsed: 0, duration: (d / SPEED) * 1000, revealed: 0, shore: u < 1 };
  return true;
}

export type TravelEvent =
  | { type: 'landmark'; landmark: Landmark }
  | { type: 'settlement'; settlement: Settlement }
  | { type: 'shore' };

/** Places newly discovered from (x, y). */
export function discover(s: GameState, x: number, y: number, out: TravelEvent[]): void {
  const ti = Math.floor(x / TILE), tj = Math.floor(y / TILE);
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
  const L = Math.hypot(v.x1 - v.x0, v.y1 - v.y0);
  while (v.revealed < u * L) {
    v.revealed = Math.min(u * L, v.revealed + 10);
    const w = v.revealed / L, x = v.x0 + (v.x1 - v.x0) * w, y = v.y0 + (v.y1 - v.y0) * w;
    reveal(s, x, y);
    s.trace.push([Math.round(x), Math.round(y)]);
    discover(s, x, y, out);
  }
  const ax = s.x, ay = s.y;
  s.x = v.x0 + (v.x1 - v.x0) * u;
  s.y = v.y0 + (v.y1 - v.y0) * u;
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
