// Deterministic value noise. Ported verbatim from proto/index.html: same seed, same
// constants, same (float) arithmetic — do not "fix" with Math.imul, it would change the world.

/** The year of Around the World in Eighty Days. */
export const SEED = 1873;

/** Hash of an integer-ish lattice point to [0, 1). */
export function hash2(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263 + SEED * 982451653) | 0;
  h = ((h ^ (h >>> 13)) * 1274126177) | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const smooth = (t: number): number => t * t * (3 - 2 * t);

/** Bilinear value noise with smoothstep interpolation, in [0, 1). */
export function noise(x: number, y: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), fx = smooth(x - xi), fy = smooth(y - yi);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fy;
}

/** Fractal Brownian motion: `octaves` layers of noise, normalised to [0, 1). */
export function fbm(x: number, y: number, octaves = 5): number {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let k = 0; k < octaves; k++) {
    s += a * noise(x * f + k * 17.3, y * f - k * 9.1);
    n += a;
    a *= 0.5;
    f *= 2.03;
  }
  return s / n;
}
