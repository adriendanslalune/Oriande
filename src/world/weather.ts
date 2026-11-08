// Weather and the hour of the day: the same for every player at the same place and moment,
// computed from real time (asked by Adrien). Pure: no Phaser, no state.
//
// - The day lasts DAY_SECONDS of real time; the hour depends on longitude, as on Earth.
// - Winds blow by latitude: trade winds from the east in the tropics, westerlies in the
//   temperate belt, polar easterlies beyond 60°.
// - Clouds are a noise field carried by the wind: a rain cell passes over a place in a few
//   minutes; larger, slower systems decide how stormy a region is.
// - What falls depends on the climate: snow in the cold, storms in hot wet lands, sandstorms
//   in the deserts, fog in damp lowlands at dawn.
import { fbm } from './noise';
import { CIRCUMFERENCE, latitude, longitude } from './planet';
import { altitude, humidity } from './terrain';
import { biome, coldness, temperature } from './climate';

/** Real seconds in one day of the game. */
export const DAY_SECONDS = 2 * 3600;
/** Wind speed scale, world units per second (the explorer walks at 7). */
const WIND = 4;

/** Seconds of shared world time. Tests can freeze it. */
let frozen: number | null = null;
export const worldTime = (): number => frozen ?? Date.now() / 1000;
export const freezeTime = (t: number | null): void => { frozen = t; };

// ---- the hour ----

/** Local solar time at x, in hours [0, 24). */
export function localHour(x: number, t = worldTime()): number {
  const day = (t / DAY_SECONDS + longitude(x) / 360) % 1;
  return ((day + 1) % 1) * 24;
}

export type DayPhase = 'dawn' | 'day' | 'dusk' | 'night';

export interface Sky {
  hour: number;
  phase: DayPhase;
  /** 0 in full daylight, 1 in the darkest night */
  darkness: number;
  /** 0..1 strength of the warm light of dawn and dusk */
  glow: number;
}

/** The light at x: sunrise at 6, sunset at 18, half an hour of twilight on each side. */
export function sky(x: number, t = worldTime()): Sky {
  const hour = localHour(x, t);
  const sun = Math.sin(((hour - 6) / 24) * Math.PI * 2); // 1 at noon, -1 at midnight
  const darkness = Math.max(0, Math.min(1, (0.12 - sun) / 0.42));
  const glow = Math.max(0, 1 - Math.abs(sun - 0.02) / 0.22);
  const phase: DayPhase = sun > 0.15 ? 'day' : sun < -0.12 ? 'night' : hour < 12 ? 'dawn' : 'dusk';
  return { hour, phase, darkness, glow };
}

// ---- wind ----

/** The wind at (x, y): direction by latitude band, with slow gusts and veering. */
export function wind(x: number, y: number, t = worldTime()): { dx: number; dy: number; speed: number } {
  const lat = Math.abs(latitude(y));
  const base = lat < 30 ? Math.PI : lat < 60 ? 0 : Math.PI; // easterlies, westerlies, polar easterlies
  const veer = (fbm(x / 20_480 + t / 9000, y / 20_480, 2, CIRCUMFERENCE / 20_480) - 0.5) * 2.4;
  const gust = 0.5 + fbm(x / 10_240 - t / 5000, y / 10_240 + 31, 2, CIRCUMFERENCE / 10_240) * 1.2;
  const a = base + veer;
  return { dx: Math.cos(a), dy: Math.sin(a) * 0.5, speed: WIND * gust };
}

// ---- clouds and what falls from them ----

export type WeatherKind = 'clear' | 'cloudy' | 'rain' | 'storm' | 'snow' | 'sandstorm' | 'fog';

export interface Weather {
  kind: WeatherKind;
  /** cloud cover 0..1 */
  cloud: number;
  /** how hard it rains, snows or blows sand, 0..1 */
  intensity: number;
  /** fog thickness 0..1 */
  fog: number;
  wind: { dx: number; dy: number; speed: number };
  /** how far the explorer sees, as a share of a clear day (1) */
  visibility: number;
}

/**
 * Cloud cover at (x, y): small cells (~15 leagues) carried by the prevailing wind of the band,
 * inside slower, larger weather systems. Periodic around the planet.
 */
export function cloudCover(x: number, y: number, t = worldTime()): number {
  const lat = Math.abs(latitude(y)), dir = lat < 30 || lat >= 60 ? -1 : 1;
  const shift = (dir * WIND * t) % CIRCUMFERENCE; // the field drifts with the wind
  const cell = fbm((x - shift) / 640, y / 640 + t / 4000, 3, CIRCUMFERENCE / 640);
  const system = fbm((x - shift * 0.6) / 5_120, y / 5_120 - t / 30_000, 2, CIRCUMFERENCE / 5_120);
  return Math.max(0, Math.min(1, (cell - 0.5) * 1.6 + (system - 0.5) * 1.8 + 0.38));
}

/** The weather at (x, y). */
export function weatherAt(x: number, y: number, t = worldTime()): Weather {
  const v = altitude(x, y), hu = humidity(x, y), temp = temperature(x, y, Math.max(0, v));
  const b = biome(x, y, v, hu), w = wind(x, y, t);
  let cloud = cloudCover(x, y, t);
  // the climate shapes the sky: deserts are clear, jungles and coasts cloudier
  if (b === 'desert') cloud *= 0.45;
  else if (b === 'savanna') cloud *= 0.75;
  else if (b === 'jungle') cloud = Math.min(1, cloud * 1.15 + 0.05);
  const wetness = Math.max(0, cloud - (0.76 - (hu - 0.5) * 0.3)) / 0.24; // rain above a threshold
  let kind: WeatherKind = cloud > 0.45 ? 'cloudy' : 'clear', intensity = 0;
  if (b === 'desert' && w.speed > WIND * 1.25) { kind = 'sandstorm'; intensity = Math.min(1, (w.speed / WIND - 1.25) * 2.5); }
  else if (wetness > 0) {
    intensity = Math.min(1, wetness);
    kind = coldness(temp) > 0.3 || v > 1 ? 'snow' : (b === 'jungle' || b === 'savanna') && intensity > 0.55 ? 'storm' : intensity > 0.85 && w.speed > WIND * 1.2 ? 'storm' : 'rain';
  }
  // fog: damp lowlands, still air, around dawn
  const hour = localHour(x, t), dawn = Math.max(0, 1 - Math.abs(hour - 6.5) / 2.5);
  const fog = kind === 'clear' || kind === 'cloudy' ? Math.max(0, Math.min(1, dawn * (hu - 0.5) * 3 * (v < 0.3 ? 1 : 0) * (1.6 - w.speed / WIND))) : 0;
  if (fog > 0.35) kind = 'fog';
  const visibility = kind === 'storm' ? 0.55 : kind === 'sandstorm' ? 1 - intensity * 0.6 : kind === 'snow' ? 1 - intensity * 0.4 : kind === 'rain' ? 1 - intensity * 0.3 : 1 - fog * 0.55;
  return { kind, cloud, intensity, fog, wind: w, visibility };
}

/** How far the explorer sees at (x, y) now, as a share of a clear day: weather and night. */
export function visibilityAt(x: number, y: number, t = worldTime()): number {
  return weatherAt(x, y, t).visibility * (1 - sky(x, t).darkness * 0.4);
}
