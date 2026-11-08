/**
 * Device pixel ratio used for the canvas backing store. Capped at 2: beyond that the
 * fill-rate cost on mid-range phones is not worth the extra sharpness. Lowered at run time
 * (setDPR) when the device cannot keep up: a big tablet screen in Firefox has four times the
 * pixels of a phone, and the cost of the map is in the pixels.
 */
// measured again with the WebGL renderer (the old canvas measure no longer says anything)
const KEY = 'oriande.dpr.gl';
const forced = Number(new URLSearchParams(location.search).get('dpr'));
/** The device's own ratio, capped. */
export const DEVICE_DPR = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
const remembered = (): number => { try { return Number(localStorage.getItem(KEY)) || 0; } catch { return 0; } };

/** True when the address forces a ratio (`?dpr=1.5`): nothing is then adapted. */
export const DPR_FORCED = forced > 0;
// a live binding: modules that import it see the new value after setDPR
export let DPR = DPR_FORCED ? forced : Math.min(DEVICE_DPR, remembered() || DEVICE_DPR);

/** Use another ratio from now on, and remember it for this device. */
export function setDPR(v: number): void {
  DPR = v;
  try { localStorage.setItem(KEY, String(v)); } catch { /* storage unavailable */ }
}

/** Convert CSS pixels (what a designer thinks in) to game pixels. */
export const px = (cssPx: number): number => cssPx * DPR;
