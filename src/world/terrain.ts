// Terrain of the planet: altitude and humidity, periodic east-west (see planet.ts). Inspired by
// the proto's formulas, rebuilt for a round world: every scale divides the circumference, and
// continents are separated from relief.
import { fbm } from './noise';
import { CIRCUMFERENCE } from './planet';

/** Size of a map tile in world units. Settlements and landmarks are laid out per tile. */
export const TILE = 256;
/** Tiles around the planet. */
export const TILES_AROUND = CIRCUMFERENCE / TILE;

/** From this altitude up the land is mountains, drawn as peaks. */
export const MOUNTAIN_ALTITUDE = 0.6;
/** Roads cross a low ridge through a pass (the peaks along it are not drawn), never higher. */
export const ROAD_MAX_ALTITUDE = 0.7;

/** Periodic fractal noise at a scale that divides the circumference. */
const field = (x: number, y: number, scale: number, octaves: number, ox: number, oy: number): number =>
  fbm(x / scale + ox, y / scale + oy, octaves, CIRCUMFERENCE / scale);

/**
 * Continentality: above 0 the land, below the sea. A continental scale (~1,300 leagues) makes
 * continents and oceans, a regional one (~130 leagues) seas, gulfs and great islands.
 * About 39% of the planet is land, in a dozen great masses; the largest holds 40% of it.
 */
export const continent = (x: number, y: number): number =>
  (field(x, y, 51_200, 3, 11, -5) * 0.7 + field(x, y, 5_120, 4, 91, -37) * 0.3 - 0.5) * 3.5 - 0.28;

/**
 * Altitude, 0 at sea level. The continent decides where the land is; local relief and ridges
 * decide where the hills and mountains are (about 12% of the land): continents are solid (no
 * swarm of inland lakes) and their interior is not one endless plateau.
 */
export function altitude(x: number, y: number): number {
  const s = continent(x, y);
  const c = field(x, y, 1_024, 4, 0, 0), d = field(x, y, 256, 5, 0, 0);
  const r = 1 - Math.abs(field(x, y, 640, 4, 40, 0) * 2 - 1);
  return 0.9 * s + 0.45 * (c - 0.5) + 0.25 * (d - 0.5) + Math.pow(r, 5) * 4.5 * Math.max(0, Math.min(1, s + 0.2)) * Math.max(0, c - 0.42) * 2;
}

/**
 * The broad slope of the land, without the small bumps: water drains along it (rivers follow
 * it), so they run over long distances to the sea instead of getting stuck in every hollow.
 */
export function drainage(x: number, y: number): number {
  return 0.9 * continent(x, y) + 0.1 * (field(x, y, 1_024, 4, 0, 0) - 0.5);
}

export const humidity = (x: number, y: number): number => field(x, y, 400, 4, 300, -200) * 0.9 + 0.12;
