// Engraved pictograms of the strange places, in the manner of 19th-century map symbols: fine
// ink lines, shadows in hatching on the south-east side (light from the north-west), a light
// sepia wash, a short hatched ground line. Drawn around (x, y), in tile units.
import type { LandmarkKind } from '../world/landmarks';
import { INK } from './palette';
import { drawMoreIcon } from './icons-more';

/** Icons are drawn on a 1x grid then scaled up by this factor. */
export const ICON_SCALE = 2.05;

export const WASH = 'rgba(214,196,160,.85)', WASH_DARK = 'rgba(170,148,112,.8)', WATER = 'rgba(150,180,192,.7)';

export type G = CanvasRenderingContext2D;
export type P = [number, number];

export function path(g: G, pts: P[], close = false): void {
  g.beginPath(); g.moveTo(...pts[0]);
  for (const p of pts.slice(1)) g.lineTo(...p);
  if (close) g.closePath();
}

/** Parallel hatching inside the current clip region: strokes at angle a, spaced d apart. */
export function hatch(g: G, x0: number, y0: number, x1: number, y1: number, d = 1.1, a = 0.9): void {
  g.save(); g.lineWidth = 0.28;
  const c = Math.cos(a), s = Math.sin(a), L = Math.hypot(x1 - x0, y1 - y0) + 4, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  g.beginPath();
  for (let k = -L; k <= L; k += d) { g.moveTo(cx + k * s - c * L, cy - k * c - s * L); g.lineTo(cx + k * s + c * L, cy - k * c + s * L); }
  g.stroke(); g.restore();
}

/** Fill a shape with a wash, hatch its shaded part, ink its outline. */
export function shape(g: G, pts: P[], wash: string, shade?: [number, number, number, number]): void {
  path(g, pts, true); g.fillStyle = wash; g.fill();
  if (shade) { g.save(); path(g, pts, true); g.clip(); g.beginPath(); g.rect(shade[0], shade[1], shade[2] - shade[0], shade[3] - shade[1]); g.clip(); hatch(g, ...shade); g.restore(); }
  path(g, pts, true); g.stroke();
}

/** A short ground line with a hatched cast shadow to the south-east and a few tufts. */
export function ground(g: G, w: number, shadowW = w * 0.7): void {
  g.save(); g.beginPath(); g.ellipse(shadowW * 0.25, 0.6, shadowW * 0.6, 1.4, 0, 0, 6.3); g.clip(); hatch(g, -w, -2, w, 3, 0.9, 0.2); g.restore();
  g.lineWidth = 0.45; g.beginPath(); g.moveTo(-w / 2, 0); g.lineTo(w / 2, 0); g.stroke();
  g.lineWidth = 0.3; g.beginPath();
  for (const tx of [-w / 2 - 1.5, w / 2 + 1]) { g.moveTo(tx, 0); g.lineTo(tx - 0.5, -1.4); g.moveTo(tx + 0.5, 0); g.lineTo(tx + 0.6, -1.6); }
  g.stroke();
}

export function drawLandmarkIcon(g: G, k: LandmarkKind, x: number, y: number): void {
  g.save();
  g.translate(x, y);
  g.scale(ICON_SCALE, ICON_SCALE);
  g.strokeStyle = INK; g.fillStyle = INK; g.lineWidth = 0.55; g.lineJoin = 'round'; g.lineCap = 'round';

  switch (k) {
    case 'ruines': {
      ground(g, 18);
      shape(g, [[-8, 0], [8, 0], [8, -1.6], [-8, -1.6]], WASH, [0, -2, 9, 1]); // base
      for (const [cx, h, broken] of [[-5.5, 9, false], [-1.5, 9, false], [2.5, 5.5, true]] as const) {
        const top: P[] = broken ? [[cx + 0.9, -1.6 - h + 0.8], [cx, -1.6 - h - 0.4], [cx - 0.9, -1.6 - h + 0.2]] : [[cx + 0.9, -1.6 - h], [cx - 0.9, -1.6 - h]];
        shape(g, [[cx - 0.9, -1.6], [cx + 0.9, -1.6], ...top], WASH, [cx, -12, cx + 1, 0]);
        g.lineWidth = 0.25; g.beginPath(); g.moveTo(cx - 0.3, -1.8); g.lineTo(cx - 0.3, -1.4 - h + (broken ? 1 : 0.2)); g.stroke(); g.lineWidth = 0.55; // flute
      }
      shape(g, [[-7.4, -10.6], [0, -10.6], [0, -12], [-7.4, -12]], WASH, [-7.4, -11.2, 0, -10.6]); // lintel
      g.beginPath(); g.ellipse(6.3, -0.9, 1.7, 0.9, 0, 0, 6.3); g.fillStyle = WASH; g.fill(); g.stroke(); // fallen drum
      break;
    }
    case 'squelette': {
      ground(g, 22, 18);
      g.lineWidth = 0.75; g.beginPath(); g.moveTo(-11, -0.5); g.quadraticCurveTo(-1, -5, 9, -2); g.stroke(); // spine
      g.lineWidth = 0.45;
      for (let i = -8; i <= 6; i += 2) { // ribs, arching up then down to the ground
        const sy = -2.8 + Math.abs(i + 1) * 0.12, h = 6 - Math.abs(i + 1) * 0.35;
        g.beginPath(); g.moveTo(i, sy); g.quadraticCurveTo(i + 2.6, sy - h, i + 1.6, 0); g.stroke();
      }
      path(g, [[9, -2], [12.5, -3.4], [14.5, -2.2], [12, -0.6]], true); g.fillStyle = WASH; g.fill(); g.stroke(); // skull
      g.beginPath(); g.arc(12.2, -2.3, 0.45, 0, 6.3); g.fillStyle = INK; g.fill();
      g.lineWidth = 0.3; g.beginPath(); g.moveTo(12.4, -0.9); g.lineTo(14.2, -1.9); g.stroke(); // jaw
      break;
    }
    case 'champignons': {
      ground(g, 16);
      for (const [dx, sc] of [[-4, 0.9], [2.6, 1.35]] as const) {
        const top = -4.5 * sc;
        shape(g, [[dx - 0.7 * sc, 0], [dx + 0.7 * sc, 0], [dx + 0.5 * sc, top], [dx - 0.5 * sc, top]], WASH, [dx, top, dx + sc, 0]);
        g.beginPath(); g.ellipse(dx, top, 4.2 * sc, 2.6 * sc, 0, Math.PI, 0); g.closePath();
        g.fillStyle = 'rgba(200,150,140,.75)'; g.fill();
        g.save(); g.clip(); g.beginPath(); g.rect(dx, top - 3 * sc, 5 * sc, 3 * sc); g.clip(); hatch(g, dx, top - 3 * sc, dx + 5 * sc, top, 1, 0.9); g.restore();
        g.beginPath(); g.ellipse(dx, top, 4.2 * sc, 2.6 * sc, 0, Math.PI, 0); g.closePath(); g.stroke();
        g.fillStyle = 'rgba(240,232,214,.95)'; // spots
        for (const [sx, sy] of [[-2, -1.1], [0.6, -1.9], [2.4, -0.8]]) { g.beginPath(); g.arc(dx + sx * sc, top + sy * sc, 0.45 * sc, 0, 6.3); g.fill(); }
      }
      g.fillStyle = INK; for (const [px, py] of [[6.5, -9], [-1, -11], [7.8, -6.5]]) { g.beginPath(); g.arc(px, py, 0.25, 0, 6.3); g.fill(); } // spores
      break;
    }
    case 'cratere': {
      // radiating ejecta strokes, raised rim, a bowl hatched on its north-west inner wall
      g.lineWidth = 0.3;
      for (let a = 0; a < 6.28; a += 0.32) { const r0 = 8.6 + (a * 7 % 1), r1 = r0 + 1.5 + (a * 13 % 1.5); g.beginPath(); g.moveTo(r0 * Math.cos(a), r0 * 0.6 * Math.sin(a)); g.lineTo(r1 * Math.cos(a), r1 * 0.6 * Math.sin(a)); g.stroke(); }
      g.lineWidth = 0.6;
      g.beginPath(); g.ellipse(0, 0, 8.4, 5, 0, 0, 6.3); g.fillStyle = WASH; g.fill(); g.stroke();
      g.beginPath(); g.ellipse(0, 0.4, 6, 3.4, 0, 0, 6.3); g.fillStyle = WASH_DARK; g.fill();
      g.save(); g.beginPath(); g.ellipse(0, 0.4, 6, 3.4, 0, 0, 6.3); g.clip();
      g.beginPath(); g.ellipse(1.4, 1.3, 5.4, 3, 0, 0, 6.3); g.rect(-8, -5, 16, 10); g.clip('evenodd'); hatch(g, -7, -4, 7, 4, 0.8, 0.5); g.restore();
      g.lineWidth = 0.45; g.beginPath(); g.ellipse(0, 0.4, 6, 3.4, 0, 0, 6.3); g.stroke();
      break;
    }
    case 'tour': {
      ground(g, 10, 12);
      shape(g, [[-3, 0], [3, 0], [2.2, -15], [-2.2, -15]], WASH, [0.4, -15, 3.2, 0]);
      g.lineWidth = 0.25;
      for (let yy = -12.5; yy < 0; yy += 2.5) { const w = 2.2 + (yy + 15) * 0.053; g.beginPath(); g.moveTo(-w, yy); g.lineTo(w, yy); g.stroke(); }
      g.lineWidth = 0.55;
      shape(g, [[-2.8, -15], [2.8, -15], [0, -20.5]], WASH_DARK, [0, -21, 3, -15]);
      g.beginPath(); g.moveTo(0, -20.5); g.lineTo(0, -22); g.stroke();
      break;
    }
    case 'geyser': {
      ground(g, 16, 14);
      g.beginPath(); g.ellipse(0, -0.4, 6, 1.6, 0, 0, 6.3); g.fillStyle = WATER; g.fill(); g.stroke(); // pool
      g.lineWidth = 0.5; g.beginPath(); g.moveTo(-0.6, -1); g.quadraticCurveTo(-1, -5, -0.4, -8); g.moveTo(0.6, -1); g.quadraticCurveTo(1, -5, 0.5, -8); g.stroke(); // jet
      for (const [cx, cy, r] of [[0, -9.5, 2.3], [-2.4, -11.6, 1.9], [2.2, -12, 2.1], [0.2, -14.2, 2]] as const) { // steam puffs, shaded below-right
        g.beginPath(); g.arc(cx, cy, r, 0, 6.3); g.fillStyle = 'rgba(244,238,226,.95)'; g.fill();
        g.save(); g.clip(); g.beginPath(); g.rect(cx, cy, r, r); g.clip(); hatch(g, cx, cy, cx + r, cy + r, 0.8, 0.9); g.restore();
        g.beginPath(); g.arc(cx, cy, r, 0, 6.3); g.stroke();
      }
      break;
    }
    case 'epave': {
      // a paddle steamer keel up, half sunk; ripples along the water line
      g.beginPath(); g.moveTo(-10, 0); g.quadraticCurveTo(-1, -7, 10, -0.5); g.closePath(); g.fillStyle = WASH_DARK; g.fill();
      g.save(); g.clip(); g.beginPath(); g.rect(0, -7, 11, 7); g.clip(); hatch(g, 0, -7, 11, 0, 1, 0.9); g.restore();
      g.beginPath(); g.moveTo(-10, 0); g.quadraticCurveTo(-1, -7, 10, -0.5); g.stroke();
      g.lineWidth = 0.25; for (const k of [0.35, 0.6]) { g.beginPath(); g.moveTo(-10 * k, -0.2); g.quadraticCurveTo(-1, -7 * k - 0.5, 10 * k, -0.3); g.stroke(); } // planks
      g.lineWidth = 0.5; g.beginPath(); g.arc(-2, -0.2, 2.6, Math.PI, 0); g.fillStyle = WASH; g.fill(); g.stroke(); // paddle wheel
      g.lineWidth = 0.3; for (let a = Math.PI; a <= 6.3; a += 0.52) { g.beginPath(); g.moveTo(-2, -0.2); g.lineTo(-2 + 2.6 * Math.cos(a), -0.2 + 2.6 * Math.sin(a)); g.stroke(); }
      g.lineWidth = 0.5; g.beginPath(); g.moveTo(-12, 0.2); g.lineTo(12, 0.2); g.stroke();
      g.lineWidth = 0.3; for (const [rx, ry, rw] of [[-8, 1.6, 5], [3, 1.5, 6], [-2, 2.8, 7]]) { g.beginPath(); g.moveTo(rx - rw / 2, ry); g.lineTo(rx + rw / 2, ry); g.stroke(); }
      break;
    }
    case 'tourbillon': {
      // a spiral of fine lines, tightening to a dark eye
      for (let arm = 0; arm < 3; arm++) {
        g.lineWidth = 0.5 - arm * 0.1;
        g.beginPath();
        for (let a = 0.6; a < 13; a += 0.15) { const rr = a * 0.78, b = a + arm * 2.09; g.lineTo(rr * Math.cos(b), rr * 0.58 * Math.sin(b)); }
        g.stroke();
      }
      g.beginPath(); g.ellipse(0, 0, 1.4, 0.8, 0, 0, 6.3); g.fillStyle = INK; g.fill();
      break;
    }
    default: drawMoreIcon(g, k);
  }
  g.restore();
}
