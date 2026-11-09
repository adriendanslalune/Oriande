// The game's dice: seeded and saved with the game, so every throw can be replayed.
import type { GameState } from './state';

/** A number in [0, 1), and the dice move on (mulberry32 on the saved seed). */
export function roll(s: GameState): number {
  let t = (s.seed = (s.seed + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** A whole number in [a, b]. */
export const between = (s: GameState, [a, b]: [number, number]): number => a + Math.floor(roll(s) * (b - a + 1));
