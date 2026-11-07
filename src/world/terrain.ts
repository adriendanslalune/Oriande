import { fbm } from './noise';

/** Size of a map tile in world units. Settlements and landmarks are laid out per tile. */
export const TILE = 256;

/** Continental-scale bias: pushes whole regions under or above the sea. */
export const ocean = (x: number, y: number): number => (fbm(x / 5200 + 91, y / 5200 - 37, 4) - 0.5) * 3.2;

/** Altitude: continents, ridges, hollows. 0 is sea level. */
export function altitude(x: number, y: number): number {
  const c = fbm(x / 1100, y / 1100, 4) + ocean(x, y) * 0.5;
  const d = fbm(x / 260, y / 260, 5);
  const r = 1 - Math.abs(fbm(x / 600 + 40, y / 600, 4) * 2 - 1);
  return (c - 0.48) * 2.2 + (d - 0.5) * 0.9 + Math.pow(r, 6) * 0.9 * Math.max(0, c - 0.4) * 2.5;
}

export const humidity = (x: number, y: number): number => fbm(x / 380 + 300, y / 380 - 200, 4) * 0.9 + 0.12;

/** "Strangeness": where giant mushrooms and violet meadows grow. */
export const strangeness = (x: number, y: number): number => fbm(x / 700 - 700, y / 700 + 900, 3);
