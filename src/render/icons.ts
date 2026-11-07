// Engraved pictograms of strange places, drawn larger than in the proto and in a more
// legible way (a crater is a bowl, ruins are columns...). Drawn around (x, y), in tile units.
import type { LandmarkKind } from '../world/landmarks';
import { INK, PAPER } from './palette';

/** Icons are drawn on a 1x grid then scaled up by this factor. */
export const ICON_SCALE = 1.6;

const STONE = 'rgb(214,200,170)', STONE_DARK = 'rgb(160,140,110)', WATER = 'rgb(150,185,195)';

export function drawLandmarkIcon(g: CanvasRenderingContext2D, k: LandmarkKind, x: number, y: number): void {
  g.save();
  g.translate(x, y);
  g.scale(ICON_SCALE, ICON_SCALE);
  g.strokeStyle = INK; g.lineWidth = 0.8; g.lineJoin = 'round';
  const path = (pts: number[][], close = false): void => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) g.lineTo(p[0], p[1]); if (close) g.closePath(); };
  const ellipse = (cx: number, cy: number, rx: number, ry: number): void => { g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, 6.3); };

  switch (k) {
    case 'cratere': {
      // ejecta, raised rim, dark bowl with the shadow on the north-west inner wall
      g.lineWidth = 0.5;
      for (let a = 0; a < 6.28; a += 0.45) { g.beginPath(); g.moveTo(9.5 * Math.cos(a), 6 * Math.sin(a)); g.lineTo(12.5 * Math.cos(a), 8 * Math.sin(a)); g.stroke(); }
      g.lineWidth = 0.9;
      ellipse(0, 0, 9, 5.6); g.fillStyle = STONE; g.fill(); g.stroke();
      ellipse(0, 0.5, 6.4, 3.7); g.fillStyle = 'rgb(105,85,65)'; g.fill();
      ellipse(1.3, 1.3, 5.2, 2.9); g.fillStyle = STONE_DARK; g.fill();
      g.lineWidth = 0.5; ellipse(0, 0.5, 6.4, 3.7); g.stroke();
      break;
    }
    case 'ruines': {
      // a stepped base, three standing columns (one broken), a fallen drum
      g.fillStyle = STONE;
      path([[-9, 2], [9, 2], [9, 0], [-9, 0]], true); g.fill(); g.stroke();
      for (const [cx, hh, broken] of [[-6, 9, false], [-1.5, 9, false], [3, 5, true]] as const) {
        g.fillStyle = STONE;
        if (broken) path([[cx - 1.2, 0], [cx - 1.2, -hh], [cx, -hh - 1], [cx + 1.2, -hh + 0.6], [cx + 1.2, 0]], true);
        else path([[cx - 1.2, 0], [cx - 1.2, -hh], [cx + 1.2, -hh], [cx + 1.2, 0]], true);
        g.fill(); g.stroke();
        if (!broken) { path([[cx - 2, -hh], [cx + 2, -hh], [cx + 2, -hh - 1.2], [cx - 2, -hh - 1.2]], true); g.fill(); g.stroke(); }
      }
      path([[-9, -10.2], [-0.5, -10.2], [-0.5, -11.4], [-9, -11.4]], true); g.fillStyle = STONE; g.fill(); g.stroke(); // lintel
      ellipse(7, -0.8, 2.2, 1.1); g.fill(); g.stroke(); // fallen drum
      break;
    }
    case 'tour': {
      // a tall tower of stone courses, without door or window
      g.fillStyle = STONE;
      path([[-3.5, 2], [-2.6, -14], [2.6, -14], [3.5, 2]], true); g.fill(); g.stroke();
      g.lineWidth = 0.4;
      for (let yy = -11; yy < 2; yy += 3) { g.beginPath(); g.moveTo(-3.2 + (yy + 14) * 0.05, yy); g.lineTo(3.2 - (yy + 14) * 0.05, yy); g.stroke(); }
      g.lineWidth = 0.8; g.fillStyle = STONE_DARK;
      path([[-3.6, -14], [0, -19], [3.6, -14]], true); g.fill(); g.stroke();
      break;
    }
    case 'squelette': {
      // a long spine with curved ribs and a skull
      g.lineWidth = 1;
      g.beginPath(); g.moveTo(-11, 1); g.quadraticCurveTo(0, -4, 10, 0); g.stroke();
      g.lineWidth = 0.7;
      for (let i = -7; i <= 7; i += 2.5) {
        const sy = -1.6 + Math.abs(i) * 0.12;
        g.beginPath(); g.moveTo(i, sy); g.quadraticCurveTo(i + 1.5, sy - 4, i + 0.5, sy - 6 + Math.abs(i) * 0.25); g.stroke();
      }
      ellipse(12, -0.5, 2.6, 1.7); g.fillStyle = PAPER; g.fill(); g.stroke();
      g.beginPath(); g.arc(12.6, -0.8, 0.5, 0, 6.3); g.fillStyle = INK; g.fill();
      break;
    }
    case 'champignons': {
      for (const [dx, sc] of [[-4.5, 1], [3, 1.5]]) {
        g.fillStyle = PAPER;
        path([[dx - 0.8 * sc, 2], [dx - 0.6 * sc, -4 * sc], [dx + 0.6 * sc, -4 * sc], [dx + 0.8 * sc, 2]], true); g.fill(); g.stroke();
        g.beginPath(); g.ellipse(dx, -4 * sc, 4.5 * sc, 3 * sc, 0, Math.PI, 0); g.closePath(); g.fillStyle = 'rgb(190,140,190)'; g.fill(); g.stroke();
        g.fillStyle = PAPER;
        for (const [sx, sy] of [[-2, -1.2], [1, -2], [2.6, -0.8]]) { g.beginPath(); g.arc(dx + sx * sc, -4 * sc + sy * sc, 0.6 * sc, 0, 6.3); g.fill(); }
      }
      break;
    }
    case 'geyser': {
      ellipse(0, 2, 7, 2); g.fillStyle = WATER; g.fill(); g.stroke();
      g.lineWidth = 0.9;
      g.beginPath(); g.moveTo(-0.8, 1.5); g.lineTo(-1, -8); g.moveTo(0.8, 1.5); g.lineTo(1, -8); g.stroke();
      g.fillStyle = PAPER; g.lineWidth = 0.7;
      for (const [cx, cy, r] of [[0, -10, 3], [-3, -12.5, 2.4], [2.8, -13, 2.6], [0, -15.5, 2.4]]) { g.beginPath(); g.arc(cx, cy, r, 0, 6.3); g.fill(); g.stroke(); }
      break;
    }
    case 'epave': {
      // a paddle steamer, keel up
      g.fillStyle = 'rgb(140,105,75)';
      g.beginPath(); g.moveTo(-10, 0); g.quadraticCurveTo(0, -7, 10, 0); g.closePath(); g.fill(); g.stroke();
      g.lineWidth = 0.4; g.beginPath(); g.moveTo(-8, -1.6); g.quadraticCurveTo(0, -5.6, 8, -1.6); g.stroke();
      g.lineWidth = 0.8; g.fillStyle = PAPER;
      g.beginPath(); g.arc(-1, -1.5, 2.6, Math.PI, 0); g.fill(); g.stroke();
      for (let a = Math.PI; a <= 6.3; a += 0.6) { g.beginPath(); g.moveTo(-1, -1.5); g.lineTo(-1 + 2.6 * Math.cos(a), -1.5 + 2.6 * Math.sin(a)); g.stroke(); }
      g.beginPath(); g.moveTo(-12, 1.2); g.lineTo(12, 1.2); g.lineWidth = 0.5; g.stroke(); // water line
      break;
    }
    case 'tourbillon': {
      g.lineWidth = 0.9;
      g.beginPath();
      for (let a = 0; a < 16; a += 0.2) { const rr = a * 0.75; g.lineTo(rr * Math.cos(a), rr * 0.6 * Math.sin(a)); }
      g.stroke();
      g.beginPath(); g.arc(0, 0, 1, 0, 6.3); g.fillStyle = INK; g.fill();
      break;
    }
  }
  g.restore();
}
