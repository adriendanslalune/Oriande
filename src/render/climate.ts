// Climate features drawn on tiles: dune fields in the deserts, ice floes on the frozen seas.
// Both sit on a world grid so neighbouring tiles agree.
import { hash2 } from '../world/noise';
import { altitude, humidity } from '../world/terrain';
import { biome, coldness, temperature } from '../world/climate';

const T = 256;

/**
 * Dunes drawn in profile, like the mountains: rows of sand hills over a stippled sand sea, each
 * with a long gentle windward slope (the wind blows from the west), a sharp crest and a steep
 * shaded lee slope. Back to front.
 */
export function drawDunes(g: CanvasRenderingContext2D, x0: number, y0: number, skip: (x: number, y: number) => boolean): void {
  const S = 15, M = 24;
  const isDesert = (X: number, Y: number): boolean => {
    const v = altitude(X, Y);
    return v >= 0.02 && v <= 0.55 && !skip(X, Y) && biome(X, Y, v, humidity(X, Y)) === 'desert';
  };
  // stippling: the texture of the sand
  g.fillStyle = 'rgba(150,115,70,.45)';
  for (let gy = Math.floor(y0 / 5); gy * 5 < y0 + T; gy++) for (let gx = Math.floor(x0 / 5); gx * 5 < x0 + T; gx++) {
    if (hash2(gx * 7 + 3, gy * 5 + 1) > 0.35) continue;
    const X = gx * 5 + hash2(gx, gy * 3) * 5, Y = gy * 5 + hash2(gx * 3, gy) * 5;
    if (isDesert(X, Y)) g.fillRect(X - x0, Y - y0, 0.6, 0.6);
  }
  const dunes: { x: number; y: number; s: number }[] = [];
  const SX = S * 1.3; // dunes are wider than tall: a wider grid across
  for (let gy = Math.floor((y0 - M) / S); gy * S < y0 + T + M; gy++) for (let gx = Math.floor((x0 - M) / SX) - 1; gx * SX < x0 + T + M; gx++) {
    const X = gx * SX + (gy % 2 ? SX / 2 : 0) + (hash2(gx * 5 + 2, gy * 7) - 0.5) * 8, Y = gy * S + (hash2(gx * 3, gy * 11 + 4) - 0.5) * 6;
    if (hash2(gx * 17, gy * 19) < 0.3 || !isDesert(X, Y)) continue;
    dunes.push({ x: X, y: Y, s: 0.75 + hash2(gx, gy * 3) * 0.6 });
  }
  dunes.sort((a, b) => a.y - b.y || a.x - b.x);
  for (const d of dunes) {
    const w = 18 * d.s, h = 5.5 * d.s, x = d.x - x0, y = d.y - y0;
    const cx = x + w * 0.16, cy = y - h; // the crest, pushed downwind
    // windward slope, lit
    g.fillStyle = 'rgb(242,220,164)';
    g.beginPath(); g.moveTo(x - w / 2, y); g.quadraticCurveTo(x - w * 0.12, y - h * 1.15, cx, cy); g.lineTo(cx, y); g.closePath(); g.fill();
    // lee slope, steep and in shadow
    g.fillStyle = 'rgb(200,160,104)';
    g.beginPath(); g.moveTo(cx, cy); g.quadraticCurveTo(x + w * 0.3, y - h * 0.55, x + w / 2, y); g.lineTo(cx, y); g.closePath(); g.fill();
    // a few hatches in the shadow, and the ink profile
    g.strokeStyle = 'rgba(42,36,29,.6)'; g.lineWidth = 0.3;
    for (let k = 1; k <= 3; k++) { const u = k / 4; g.beginPath(); g.moveTo(cx + w * 0.3 * u, cy + h * u * 0.75); g.lineTo(cx + w * 0.3 * u - 0.4, y - 0.3); g.stroke(); }
    g.strokeStyle = 'rgba(42,36,29,.85)'; g.lineWidth = 0.6;
    g.beginPath(); g.moveTo(x - w / 2, y); g.quadraticCurveTo(x - w * 0.12, y - h * 1.15, cx, cy); g.quadraticCurveTo(x + w * 0.3, y - h * 0.55, x + w / 2, y); g.stroke();
  }
}

/** Ice floes on cold water, packed near the coast and over shallow seas. */
export function drawIce(g: CanvasRenderingContext2D, x0: number, y0: number): void {
  const S = 9, M = 10;
  for (let gy = Math.floor((y0 - M) / S); gy * S < y0 + T + M; gy++) for (let gx = Math.floor((x0 - M) / S); gx * S < x0 + T + M; gx++) {
    const X = gx * S + (hash2(gx * 7 + 1, gy * 5) - 0.5) * 5, Y = gy * S + (hash2(gx * 11, gy * 3 + 2) - 0.5) * 5;
    const v = altitude(X, Y);
    if (v >= 0) continue;
    const c = coldness(temperature(X, Y, v));
    // more ice where it is colder and the sea shallower
    if (c <= 0 || hash2(gx * 13 + 5, gy * 17) > c * (0.95 - Math.min(0.5, -v)) ) continue;
    const r = 2.8 + hash2(gx, gy * 7) * 3.6, n = 4 + Math.floor(hash2(gx * 9, gy * 2) * 3), x = X - x0, y = Y - y0, rot = hash2(gx * 3, gy) * 6.28;
    g.fillStyle = 'rgba(250,252,252,.96)'; g.strokeStyle = 'rgba(70,100,120,.75)'; g.lineWidth = 0.45;
    g.beginPath();
    for (let k = 0; k < n; k++) {
      const a = rot + (k + (hash2(gx * 5 + k, gy * 7) - 0.5) * 0.6) / n * 6.283, rr = r * (0.55 + hash2(gx * 31 + k, gy * 37 - k) * 0.6);
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr * 0.8;
      if (k) g.lineTo(px, py); else g.moveTo(px, py);
    }
    g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = 'rgba(150,185,205,.8)'; g.lineWidth = 0.35; // the bluish underwater edge
    g.beginPath(); g.moveTo(x - r * 0.5, y + r * 0.45); g.lineTo(x + r * 0.45, y + r * 0.5); g.stroke();
  }
}

/** Savanna: a lone flat-topped acacia now and then, and tall dry grass. */
export function drawSavanna(g: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  if (r < 0.1) {
    const w = 4.5 + r * 22, hgt = 4 + r * 14;
    g.fillStyle = 'rgba(42,36,29,.22)'; g.beginPath(); g.ellipse(x + 2, y + 0.6, w * 0.8, 1.2, 0, 0, 6.3); g.fill(); // shadow
    g.strokeStyle = 'rgb(90,70,50)'; g.lineWidth = 0.7;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x - 0.4, y - hgt * 0.6); g.lineTo(x - 1.8, y - hgt); g.moveTo(x - 0.4, y - hgt * 0.6); g.lineTo(x + 1.6, y - hgt); g.stroke();
    g.fillStyle = 'rgba(128,140,74,.95)'; g.strokeStyle = 'rgba(42,36,29,.8)'; g.lineWidth = 0.5;
    g.beginPath(); g.ellipse(x, y - hgt - 0.6, w, 1.6, 0, 0, 6.3); g.fill(); g.stroke(); // the umbrella crown
  } else if (r < 0.5) {
    g.strokeStyle = 'rgba(150,120,60,.85)'; g.lineWidth = 0.4; g.beginPath();
    for (const [dx, h] of [[-1, 2.6], [-0.3, 3.4], [0.4, 2.9], [1.1, 2.2]]) { g.moveTo(x + dx * 0.5, y); g.quadraticCurveTo(x + dx, y - h * 0.6, x + dx * 1.6, y - h); }
    g.stroke();
  }
}

/** Jungle: a dense canopy of big dark crowns, with palms here and there. */
export function drawJungle(g: CanvasRenderingContext2D, x: number, y: number, r: number, v: number): void {
  if (r > 0.97) return;
  if (r > 0.86 && v < 0.25) { // a palm
    g.strokeStyle = 'rgb(100,78,52)'; g.lineWidth = 0.8;
    g.beginPath(); g.moveTo(x, y + 1); g.quadraticCurveTo(x + 1.5, y - 3, x + 0.8, y - 6); g.stroke();
    g.strokeStyle = 'rgba(52,96,52,.95)'; g.lineWidth = 0.9;
    for (let a = 0; a < 5; a++) {
      const ang = -Math.PI / 2 + (a - 2) * 0.7, ex = x + 0.8 + Math.cos(ang) * 3.6, ey = y - 6 + Math.sin(ang) * 2 + 1.2;
      g.beginPath(); g.moveTo(x + 0.8, y - 6); g.quadraticCurveTo((x + 0.8 + ex) / 2, y - 7.6, ex, ey); g.stroke();
    }
    return;
  }
  const R = 3 + r * 1.8;
  g.fillStyle = 'rgba(30,40,24,.28)'; g.beginPath(); g.ellipse(x + 1.6, y + 1.5, R * 1.1, R * 0.75, 0, 0, 6.3); g.fill(); // shadow
  g.strokeStyle = 'rgba(30,40,24,.85)'; g.lineWidth = 0.5;
  const shades = ['rgba(70,120,62,.95)', 'rgba(58,104,56,.95)', 'rgba(86,134,70,.95)'];
  for (const [dx, dy, k, c] of [[-0.8, 0.3, 0.75, 0], [0.9, 0.4, 0.7, 1], [0, -0.6, 0.85, 2]] as const) {
    g.fillStyle = shades[c]; g.beginPath(); g.arc(x + dx * R * 0.7, y + dy * R * 0.7, R * k, 0, 6.3); g.fill(); g.stroke();
  }
  g.strokeStyle = 'rgba(200,230,170,.5)'; g.lineWidth = 0.4; // a glint of sun on the leaves
  g.beginPath(); g.arc(x - R * 0.25, y - R * 0.55, R * 0.35, 3.6, 5.2); g.stroke();
}
