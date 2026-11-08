// Deterministic value noise, periodic east-west so the planet wraps without a seam.

/** The year of Around the World in Eighty Days. */
export const SEED = 1873;

/** Hash of an integer lattice point to [0, 1). (As in the proto.) */
export function hash2(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263 + SEED * 982451653) | 0;
  h = ((h ^ (h >>> 13)) * 1274126177) | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const smooth = (t: number): number => t * t * (3 - 2 * t);
const wrap = (i: number, p: number): number => (p > 0 ? ((i % p) + p) % p : i);

/** Bilinear value noise in [0, 1), periodic in x with integer period `px` (0 = not periodic). */
export function noise(x: number, y: number, px = 0): number {
  const xi = Math.floor(x), yi = Math.floor(y), fx = smooth(x - xi), fy = smooth(y - yi);
  const x0 = wrap(xi, px), x1 = wrap(xi + 1, px);
  const a = hash2(x0, yi), b = hash2(x1, yi), c = hash2(x0, yi + 1), d = hash2(x1, yi + 1);
  return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fy;
}

/**
 * Fractal noise, normalised to [0, 1). With `px` (the x period of the first octave, an
 * integer), every octave doubles its frequency and its period, so the sum stays periodic.
 */
export function fbm(x: number, y: number, octaves = 5, px = 0): number {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let k = 0; k < octaves; k++) {
    s += a * noise(x * f + k * 17.3, y * f - k * 9.1, px * f);
    n += a;
    a *= 0.5;
    f *= px ? 2 : 2.03;
  }
  return s / n;
}
