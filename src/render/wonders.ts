// The wonders, drawn large in the engraved style: they must catch the eye from afar.
// Drawn around (x, y) in tile units; each one roughly 50-70 units across.
import { hash2 } from '../world/noise';
import type { Wonder } from '../world/wonders';
import { INK } from './palette';

const STONE = 'rgb(206,194,168)', STONE_DARK = 'rgb(150,136,112)', MOSS = 'rgba(120,150,90,.8)';

type G = CanvasRenderingContext2D;

function poly(g: G, pts: number[][], fill?: string, stroke = true): void {
  g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
  for (const p of pts.slice(1)) g.lineTo(p[0], p[1]);
  g.closePath();
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) g.stroke();
}

/** A colossal stone head, half sunk in the ground, eyes closed, facing west. */
function head(g: G): void {
  g.fillStyle = 'rgba(42,36,29,.18)'; g.beginPath(); g.ellipse(4, 3, 30, 7, 0, 0, 6.3); g.fill(); // ground shadow
  g.lineWidth = 1.2;
  poly(g, [[-20, 2], [-21, -10], [-24, -14], [-20, -17], [-22, -22], [-17, -30], [-8, -38], [6, -40], [18, -34], [24, -22], [25, -8], [22, 2]], STONE);
  // shading on the east half
  g.save(); g.clip(); g.fillStyle = STONE_DARK; g.globalAlpha = 0.5; g.fillRect(8, -42, 20, 46); g.restore();
  g.lineWidth = 0.7;
  g.beginPath(); g.moveTo(-17, -27); g.quadraticCurveTo(-12, -25, -8, -27); g.stroke(); // closed eye
  g.beginPath(); g.moveTo(-17, -31); g.quadraticCurveTo(-11, -34, -6, -31); g.stroke(); // brow
  g.beginPath(); g.moveTo(-21, -10); g.quadraticCurveTo(-17, -9, -14, -11); g.stroke(); // lips
  g.beginPath(); g.moveTo(10, -36); g.lineTo(6, -24); g.lineTo(12, -14); g.moveTo(-4, -2); g.lineTo(0, -10); g.stroke(); // cracks
  g.fillStyle = MOSS;
  for (const [mx, my, r] of [[14, -38, 4], [20, -30, 3], [-2, -1, 4]]) { g.beginPath(); g.arc(mx, my, r, 0, 6.3); g.fill(); }
  g.lineWidth = 1; g.beginPath(); g.moveTo(-30, 2); g.quadraticCurveTo(0, -1, 32, 2); g.stroke(); // the ground it sinks into
}

/** A rock floating above the valley, with a small ruined temple on top and a thread of water. */
function floatingRock(g: G): void {
  g.fillStyle = 'rgba(42,36,29,.22)'; g.beginPath(); g.ellipse(4, 10, 20, 5, 0, 0, 6.3); g.fill(); // shadow on the ground
  g.lineWidth = 1.1;
  poly(g, [[-22, -30], [22, -30], [16, -22], [10, -12], [4, -4], [0, 0], [-6, -8], [-14, -18]], STONE);
  g.save(); g.clip(); g.fillStyle = STONE_DARK; g.globalAlpha = 0.55;
  poly(g, [[4, -30], [22, -30], [0, 0]], STONE_DARK, false); g.restore();
  g.lineWidth = 0.5;
  for (let k = 0; k < 5; k++) { g.beginPath(); g.moveTo(-12 + k * 6, -27); g.lineTo(-8 + k * 4, -16 + k * 2); g.stroke(); }
  // grass and a little temple on the flat top
  g.fillStyle = MOSS; g.fillRect(-22, -32, 44, 2.5);
  g.lineWidth = 0.6; g.fillStyle = STONE;
  for (const cx of [-8, -3, 2, 7]) { g.fillRect(cx - 0.9, -40, 1.8, 8); g.strokeRect(cx - 0.9, -40, 1.8, 8); }
  poly(g, [[-11, -40], [10, -40], [0, -45]], STONE);
  // waterfall falling off the edge, and drifting pebbles
  g.strokeStyle = 'rgb(90,140,170)'; g.lineWidth = 0.8;
  g.beginPath(); g.moveTo(-21, -30); g.quadraticCurveTo(-25, -10, -24, 8); g.stroke();
  g.strokeStyle = INK; g.fillStyle = STONE;
  for (const [px, py, r] of [[8, 4, 1.4], [-3, 6, 1], [12, -6, 1.1]]) { g.beginPath(); g.arc(px, py, r, 0, 6.3); g.fill(); g.stroke(); }
}

/** A forest of tall crystal prisms, pale blue and violet. */
function crystals(g: G, seed: number): void {
  g.fillStyle = 'rgba(42,36,29,.15)'; g.beginPath(); g.ellipse(0, 3, 30, 7, 0, 0, 6.3); g.fill();
  const prisms: [number, number, number, number][] = [];
  for (let k = 0; k < 15; k++) {
    const h = (a: number): number => hash2(seed * 1000 + k * 7 + a, k * 3 - a);
    prisms.push([(h(1) - 0.5) * 50, (h(2) - 0.5) * 10, 10 + h(3) * 26, (h(4) - 0.5) * 0.5]);
  }
  prisms.sort((a, b) => a[1] - b[1]);
  g.lineWidth = 0.7;
  for (const [px, py, ph, lean] of prisms) {
    const w = 2.2 + ph * 0.09, tx = px + lean * ph;
    const tint = (px + 30) / 60;
    // lit face then shaded face of a hexagonal prism, with a pointed tip
    poly(g, [[px - w, py], [tx - w * 0.8, py - ph], [tx, py - ph - w * 1.6], [tx, py - ph + 1], [px, py + 1]], `rgba(${200 - tint * 30},${225 - tint * 20},${245},.95)`);
    poly(g, [[px, py + 1], [tx, py - ph + 1], [tx, py - ph - w * 1.6], [tx + w * 0.8, py - ph], [px + w, py]], `rgba(${150 - tint * 10},${150 + tint * 10},${215},.95)`);
    g.save(); g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 0.5;
    g.beginPath(); g.moveTo(px - w * 0.5, py - 1); g.lineTo(tx - w * 0.45, py - ph + 1); g.stroke(); g.restore();
  }
}

/** A petrified titan lying on its back, grass growing on it. */
function titan(g: G): void {
  g.fillStyle = 'rgba(42,36,29,.18)'; g.beginPath(); g.ellipse(0, 4, 38, 8, 0, 0, 6.3); g.fill();
  g.lineWidth = 1.1; g.fillStyle = STONE;
  // legs, body, arms, head: west to east
  poly(g, [[-36, -2], [-34, -6], [-16, -7], [-16, 1], [-34, 2]], STONE); // legs
  poly(g, [[-36, -7], [-35, -11], [-30, -9], [-31, -5]], STONE); // a foot up
  poly(g, [[-17, -9], [-6, -12], [12, -12], [18, -8], [18, 2], [-17, 3]], STONE); // torso
  g.beginPath(); g.ellipse(26, -5, 7, 6.5, 0, 0, 6.3); g.fill(); g.stroke(); // head
  poly(g, [[-4, -12], [2, -20], [8, -26], [11, -24], [5, -17], [2, -11]], STONE); // a raised arm
  poly(g, [[-2, 3], [6, 8], [14, 10], [15, 7], [7, 4]], STONE); // the other arm on the ground
  g.lineWidth = 0.5;
  g.beginPath(); g.moveTo(-6, -11); g.lineTo(-4, -2); g.moveTo(6, -12); g.lineTo(4, -4); g.lineTo(9, 1); g.moveTo(-25, -6); g.lineTo(-26, 1); g.stroke(); // cracks
  g.beginPath(); g.moveTo(24, -7); g.lineTo(27, -6); g.moveTo(29, -6); g.lineTo(31, -7); g.stroke(); // closed eyes
  g.fillStyle = MOSS;
  for (const [mx, my, r] of [[0, -12, 3], [10, -12, 2.5], [-28, -6, 2.5], [26, -11, 2.2]]) { g.beginPath(); g.arc(mx, my, r, 0, 6.3); g.fill(); }
}

/** Arches of a drowned Oriandais city rising from the water. */
function arches(g: G): void {
  g.lineWidth = 1;
  const base = 4;
  for (const [ax, w, h, broken] of [[-26, 12, 20, false], [-12, 14, 26, false], [4, 14, 24, true], [19, 11, 17, false]] as const) {
    g.fillStyle = STONE;
    // two piers and the arch between them, as one stone outline
    g.beginPath();
    g.moveTo(ax - w / 2, base); g.lineTo(ax - w / 2, base - h); g.lineTo(ax + w / 2, base - h); g.lineTo(ax + w / 2, base);
    g.lineTo(ax + w / 2 - 3, base); g.lineTo(ax + w / 2 - 3, base - h * 0.55);
    g.quadraticCurveTo(ax, base - h * 0.95, ax - w / 2 + 3, base - h * 0.55); g.lineTo(ax - w / 2 + 3, base); g.closePath();
    g.fill(); g.stroke();
    if (broken) { g.fillStyle = 'rgb(160,198,214)'; poly(g, [[ax - 1, base - h - 1], [ax + 3, base - h * 0.7], [ax + w / 2 + 1, base - h * 0.8], [ax + w / 2 + 1, base - h - 1]], 'rgb(160,198,214)', false); }
    g.lineWidth = 0.4; g.beginPath(); g.moveTo(ax - w / 2, base - h + 3); g.lineTo(ax + w / 2, base - h + 3); g.stroke(); g.lineWidth = 1;
  }
  // the water line and ripples at the feet of the arches
  g.strokeStyle = 'rgb(40,70,90)'; g.lineWidth = 0.7;
  for (const [rx, ry, rw] of [[-30, 5, 10], [-16, 6, 12], [0, 5, 10], [16, 6, 12], [-8, 9, 16], [10, 10, 14]]) {
    g.beginPath(); g.moveTo(rx - rw / 2, ry); g.quadraticCurveTo(rx, ry - 1.5, rx + rw / 2, ry); g.stroke();
  }
  g.strokeStyle = INK;
}

/** The tree of light: an immense tree whose crown glows (the glow pulses in the overlay). */
function tree(g: G, seed: number): void {
  g.fillStyle = 'rgba(42,36,29,.18)'; g.beginPath(); g.ellipse(2, 2, 22, 5, 0, 0, 6.3); g.fill();
  // rays
  g.strokeStyle = 'rgba(220,180,60,.55)'; g.lineWidth = 0.8;
  for (let a = 0; a < 6.28; a += 0.4) { g.beginPath(); g.moveTo(Math.cos(a) * 24, -34 + Math.sin(a) * 20); g.lineTo(Math.cos(a) * 32, -34 + Math.sin(a) * 27); g.stroke(); }
  g.strokeStyle = INK;
  // trunk and roots
  g.lineWidth = 1; g.fillStyle = 'rgb(120,96,72)';
  poly(g, [[-5, 0], [-3, -18], [-9, -26], [-6, -27], [0, -21], [5, -28], [8, -26], [3, -18], [5, 0], [10, 3], [-10, 3]], 'rgb(120,96,72)');
  // crown: overlapping golden lobes
  for (const [cx, cy, r] of [[-12, -34, 10], [12, -34, 10], [0, -42, 12], [-6, -30, 9], [7, -29, 9], [0, -34, 11]]) {
    g.fillStyle = 'rgb(236,206,120)'; g.beginPath(); g.arc(cx, cy, r, 0, 6.3); g.fill(); g.stroke();
  }
  g.fillStyle = 'rgba(255,248,210,.95)';
  for (let k = 0; k < 18; k++) { const a = hash2(seed * 100 + k, 3) * 6.28, r = hash2(seed * 100 + k, 5) * 16; g.beginPath(); g.arc(Math.cos(a) * r, -36 + Math.sin(a) * r * 0.7, 1, 0, 6.3); g.fill(); }
}

export function drawWonder(g: G, w: Wonder, x: number, y: number): void {
  const seed = hash2(Math.round(w.x), Math.round(w.y));
  g.save();
  g.translate(x, y);
  g.strokeStyle = INK; g.lineJoin = 'round'; g.lineCap = 'round';
  switch (w.kind) {
    case 'tete': head(g); break;
    case 'rocher': floatingRock(g); break;
    case 'cristal': crystals(g, seed); break;
    case 'titan': titan(g); break;
    case 'arches': arches(g); break;
    case 'arbre': tree(g, seed); break;
  }
  g.restore();
}
