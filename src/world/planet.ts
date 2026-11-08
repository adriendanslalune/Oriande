// The planet (asked by Adrien): a round world the size of Jules Verne's Earth (10,000 leagues
// around), shown as an old atlas does, in a cylindrical projection. The map wraps east-west;
// north and south it ends at the poles, beyond an ice barrier that cannot be crossed.

/** World units per league. */
export const LEAGUE_UNITS = 40;
/** Circumference at the equator: 10,240 leagues. Everything in x repeats with this period. */
export const CIRCUMFERENCE = 409_600;
/** From pole to pole: half the circumference, as on a sphere. */
export const MERIDIAN = CIRCUMFERENCE / 2;
/** y of the equator. y grows southwards; the start of the game (y near 0) lies around 45°N. */
export const EQUATOR_Y = MERIDIAN / 4;
/** y of the north and south poles. */
export const NORTH_POLE_Y = EQUATOR_Y - MERIDIAN / 2;
export const SOUTH_POLE_Y = EQUATOR_Y + MERIDIAN / 2;
/** Beyond this latitude (degrees) the polar ice cannot be crossed. */
export const ICE_BARRIER = 84;

/** Latitude in degrees at y: +90 at the north pole, -90 at the south pole. */
export const latitude = (y: number): number => ((EQUATOR_Y - y) / (MERIDIAN / 2)) * 90;
/** Longitude in degrees at x, in [-180, 180): 0 at the start of the game. */
export const longitude = (x: number): number => {
  const l = (wrapX(x) / CIRCUMFERENCE) * 360;
  return l >= 180 ? l - 360 : l;
};

/** x brought back into [0, CIRCUMFERENCE). */
export const wrapX = (x: number): number => ((x % CIRCUMFERENCE) + CIRCUMFERENCE) % CIRCUMFERENCE;
/** An integer index brought back into [0, n). */
export const wrapIndex = (i: number, n: number): number => ((i % n) + n) % n;
/** The copy of x (x + k * CIRCUMFERENCE) nearest to `near`. */
export const nearestCopy = (x: number, near: number): number => x + Math.round((near - x) / CIRCUMFERENCE) * CIRCUMFERENCE;

/** Whether y lies beyond the polar ice barrier. */
export const beyondIce = (y: number): boolean => Math.abs(latitude(y)) > ICE_BARRIER;
