// Terrain of the planet: altitude and humidity, periodic east-west (see planet.ts). Inspired by
// the proto's formulas, rebuilt for a round world: every scale divides the circumference, and
// continents are separated from relief.
import { fbm } from './noise';
import { CIRCUMFERENCE, EQUATOR_Y } from './planet';

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

/** Degrees of longitude (and latitude) in world units. */
const DEG = CIRCUMFERENCE / 360;

/**
 * The three continents (asked by Adrien: three great lands, distinct, wide oceans between them, no
 * "Swiss cheese" of land): each is a few overlapping lobes, [longitude, latitude, half-width,
 * half-height] in degrees. The Old Continent lies across the equator at longitude 0, where every
 * game starts; the East and the West lie on either side, past an ocean.
 */
const CONTINENTS: [number, number, number, number][][] = [
  [[-5, 16, 34, 24], [20, -6, 22, 28], [-16, -22, 14, 20], [36, 28, 24, 14]], // the Old Continent
  [[125, -18, 26, 28], [150, 6, 20, 18], [104, -40, 18, 13]], // the East
  [[-115, 8, 24, 28], [-96, -28, 16, 24], [-134, 30, 20, 12]], // the West
];

/** How far inside a continent (x, y) lies: 1 at a lobe's heart, 0 on its rim, below 0 at sea. */
function lobes(x: number, y: number): number {
  // the coast wanders: the point is moved by slow noises before it is measured
  const wx = x + (field(x, y, 25_600, 3, 7, 3) - 0.5) * 26 * DEG + (field(x, y, 6_400, 3, 2, 8) - 0.5) * 6 * DEG;
  const wy = y + (field(x, y, 25_600, 3, 51, -17) - 0.5) * 20 * DEG + (field(x, y, 6_400, 3, 12, -4) - 0.5) * 5 * DEG;
  let best = -9;
  for (const land of CONTINENTS) for (const [lon, lat, rx, ry] of land) {
    let dx = wx - lon * DEG;
    dx -= Math.round(dx / CIRCUMFERENCE) * CIRCUMFERENCE; // around the planet
    const dy = wy - (EQUATOR_Y - lat * DEG);
    best = Math.max(best, 1 - Math.hypot(dx / (rx * DEG), dy / (ry * DEG)));
  }
  return best;
}

/** The height of a continent's inland plateau (the relief does the rest: ~12% of the land is mountains). */
const PLATEAU = 0.22;

/**
 * Continentality: above 0 the land, below the sea. The three continents, their coasts cut into bays,
 * capes and peninsulas; inland a plateau (solid land, no swarm of lakes), offshore the sea deepens.
 * A few archipelagos rise in the oceans where a slow noise allows them. About 31% of the planet is land.
 */
export function continent(x: number, y: number): number {
  // the continents change slowly: worked out on a grid of 64 units (cached) and blended between
  const gx = x / CGRID, gy = y / CGRID, i = Math.floor(gx), j = Math.floor(gy), fx = gx - i, fy = gy - j;
  const a = continentAt(i, j), b = continentAt(i + 1, j), c = continentAt(i, j + 1), d = continentAt(i + 1, j + 1);
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
}

/** The grid the continents are worked out on (divides the circumference). */
const CGRID = 64;
const AROUND = CIRCUMFERENCE / CGRID;
const cgrid = new Map<number, number>();
function continentAt(i: number, j: number): number {
  const wi = ((i % AROUND) + AROUND) % AROUND, key = wi * 16_384 + (j + 8_192);
  let v = cgrid.get(key);
  if (v === undefined) {
    if (cgrid.size > 400_000) cgrid.clear();
    v = continentRaw(wi * CGRID, j * CGRID);
    cgrid.set(key, v);
  }
  return v;
}

function continentRaw(x: number, y: number): number {
  const coast = (field(x, y, 5_120, 4, 91, -37) - 0.5) * 0.55 + (field(x, y, 1_280, 3, 5, 9) - 0.5) * 0.12;
  const v = (lobes(x, y) + coast) * 4;
  let s = v > 0 ? PLATEAU * Math.tanh(v * 1.4) : v * 0.6;
  const arch = field(x, y, 20_480, 3, -71, 13), gate = Math.max(0, Math.min(1, (arch - 0.6) / 0.1));
  if (gate > 0) s = Math.max(s, gate * (field(x, y, 2_560, 4, 33, 77) - 0.6) * 4 - 0.35 * (1 - gate) - 0.12);
  return s;
}

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
