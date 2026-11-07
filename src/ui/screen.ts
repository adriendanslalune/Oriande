/**
 * Device pixel ratio used for the canvas backing store. Capped at 2: beyond that the
 * fill-rate cost on mid-range phones is not worth the extra sharpness.
 */
export const DPR = Math.min(2, Math.max(1, window.devicePixelRatio || 1));

/** Convert CSS pixels (what a designer thinks in) to game pixels. */
export const px = (cssPx: number): number => cssPx * DPR;
