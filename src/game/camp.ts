// The campfire: laid where the explorer stands, it burns a quarter of an hour. Near it, meat and
// fish are cooked, the explorer can sleep, and no animal dares come (asked by Adrien: survival).
import type { GameState } from './state';

/** How long a campfire burns (world seconds). */
export const CAMP_SECONDS = 15 * 60;
/** How near the fire one must be to cook or sleep by it (world units). */
export const CAMP_REACH = 40;
/** No animal charges within this distance of a lit fire. */
export const CAMP_SAFE = 140;

/** The campfire, if it still burns at world time t. */
export const campLit = (s: GameState, t: number): boolean => !!s.camp && s.camp.until > t;

/** Whether (x, y) is within `r` of the lit campfire. */
export const nearCamp = (s: GameState, x: number, y: number, t: number, r = CAMP_REACH): boolean =>
  campLit(s, t) && Math.hypot(s.camp!.x - x, s.camp!.y - y) <= r;

/** Lay a campfire where the explorer stands (the last one goes out). */
export function layCamp(s: GameState, t: number): void {
  s.camp = { x: s.x, y: s.y + 6, until: t + CAMP_SECONDS };
}
