// The monuments, engraved, while waiting for their illustrations (docs/illustrations.md): once
// a picture is in src/assets/monuments, the overlay draws it instead. Drawn around (x, y) in
// world units, ground at y; each one about 40-55 units across.
import type { Monument } from '../world/monuments';
import { INK } from './palette';

type G = CanvasRenderingContext2D;
type P = [number, number];

const STONE = 'rgb(214,202,176)', STONE_DARK = 'rgb(160,146,120)', SAND = 'rgba(214,190,140,.6)', MOSS = 'rgba(112,150,92,.85)';

function poly(g: G, pts: P[], fill?: string): void {
  g.beginPath(); g.moveTo(...pts[0]); for (const p of pts.slice(1)) g.lineTo(...p); g.closePath();
  if (fill) { g.fillStyle = fill; g.fill(); }
  g.stroke();
}

function hatchIn(g: G, pts: P[], x0: number, y0: number, x1: number, y1: number, d = 1.6): void {
  g.save(); g.beginPath(); g.moveTo(...pts[0]); for (const p of pts.slice(1)) g.lineTo(...p); g.closePath(); g.clip();
  g.lineWidth = 0.4; g.beginPath();
  for (let k = x0 - (y1 - y0); k < x1; k += d) { g.moveTo(k, y1); g.lineTo(k + (y1 - y0) * 0.8, y0); }
  g.stroke(); g.restore();
}

function shadow(g: G, w: number): void {
  g.fillStyle = 'rgba(42,36,29,.16)'; g.beginPath(); g.ellipse(w * 0.15, 1.5, w * 0.62, w * 0.11, 0, 0, Math.PI * 2); g.fill();
}

function colossus(g: G): void {
  shadow(g, 30);
  const base: P[] = [[-9, 0], [9, 0], [8, -7], [-8, -7]];
  poly(g, base, STONE); hatchIn(g, base, 2, -7, 9, 0);
  // the figure: legs, robe, torso, head, one arm raised with a broken spear, the other broken
  const body: P[] = [[-5, -7], [5, -7], [4.2, -24], [6, -36], [3, -42], [-3, -42], [-6, -36], [-4.2, -24]];
  poly(g, body, STONE); hatchIn(g, body, 1, -44, 7, -7);
  g.lineWidth = 0.6; g.beginPath(); g.moveTo(-1, -7); g.lineTo(-0.5, -24); g.moveTo(-4, -26); g.quadraticCurveTo(0, -23, 4, -26); g.stroke(); // folds
  g.lineWidth = 1;
  poly(g, [[-2.4, -42], [2.4, -42], [2.6, -46.5], [0, -48.5], [-2.6, -46.5]], STONE); // head
  poly(g, [[5, -38], [9, -46], [10.6, -45], [6.6, -36.6]], STONE); // raised arm
  g.lineWidth = 1.2; g.beginPath(); g.moveTo(10, -46); g.lineTo(11.5, -56); g.stroke(); // the broken spear
  g.lineWidth = 1; poly(g, [[-5.6, -37], [-8, -32], [-6.6, -31], [-4.6, -34]], STONE); // the other arm, broken at the elbow
  g.fillStyle = STONE; for (const [x, y] of [[-13, -1.2], [-11, -0.6]]) { g.beginPath(); g.ellipse(x, y, 2, 1.1, 0.3, 0, Math.PI * 2); g.fill(); g.stroke(); }
}

function pyramid(g: G): void {
  shadow(g, 52);
  g.fillStyle = SAND; g.beginPath(); g.ellipse(0, 0, 30, 4, 0, 0, Math.PI * 2); g.fill();
  const lit: P[] = [[-26, 0], [2, 3], [0, -40]], dark: P[] = [[2, 3], [26, -1], [0, -40]];
  poly(g, lit, STONE); poly(g, dark, STONE_DARK); hatchIn(g, dark, -2, -42, 27, 4, 1.4);
  g.lineWidth = 0.4; g.beginPath(); // the courses of stone
  for (let k = 1; k < 10; k++) { const f = k / 10, y = -40 + f * 40; g.moveTo(-26 * f, y + f * 0); g.lineTo(2 * f, y + 3 * f); g.lineTo(26 * f, y - f); }
  g.stroke();
  g.lineWidth = 1; g.fillStyle = INK; g.beginPath(); g.moveTo(-2, 1.7); g.lineTo(-2, -3.5); g.lineTo(0.6, -4.5); g.lineTo(0.6, 2.2); g.closePath(); g.fill(); // the door
  g.fillStyle = 'rgba(230,200,120,.9)'; g.beginPath(); g.moveTo(0, -40); g.lineTo(-2.4, -35.2); g.lineTo(2.6, -35.2); g.closePath(); g.fill(); g.stroke(); // a capstone of gold
}

function temple(g: G): void {
  shadow(g, 48);
  for (const [w, y] of [[24, 0], [22, -2], [20, -4]] as const) poly(g, [[-w, y], [w, y], [w, y - 2], [-w, y - 2]], STONE);
  for (let k = 0; k < 7; k++) {
    if (k === 5) continue; // a fallen column
    const x = -17 + k * 5.6, c: P[] = [[x - 1.5, -6], [x + 1.5, -6], [x + 1.2, -24], [x - 1.2, -24]];
    poly(g, c, STONE); hatchIn(g, c, x, -24, x + 1.6, -6, 1.2);
  }
  g.fillStyle = STONE; g.beginPath(); g.ellipse(14, -1, 4.5, 1.6, 0.1, 0, Math.PI * 2); g.fill(); g.stroke(); // its drums on the steps
  poly(g, [[-20, -24], [20, -24], [20, -28], [-20, -28]], STONE);
  const ped: P[] = [[-21, -28], [8, -28], [4, -32.5], [0, -36]]; // the pediment, broken on the right
  poly(g, ped, STONE); hatchIn(g, ped, -21, -36, 8, -28, 2.2);
  g.beginPath(); g.moveTo(8, -28); g.lineTo(12, -29.5); g.lineTo(10.5, -28); g.stroke();
}

function sphinx(g: G): void {
  shadow(g, 50);
  const base: P[] = [[-24, 0], [22, 0], [22, -4], [-24, -4]];
  poly(g, base, STONE); hatchIn(g, base, 0, -4, 22, 0);
  const body: P[] = [[-22, -4], [8, -4], [20, -4], [20, -7], [8, -7], [6, -14], [-6, -16], [-18, -14], [-23, -9]];
  poly(g, body, STONE); hatchIn(g, body, -24, -12, 21, -4, 1.4);
  g.lineWidth = 0.6; g.beginPath(); g.moveTo(-14, -4); g.quadraticCurveTo(-12, -9, -16, -13); g.stroke(); g.lineWidth = 1; // the haunch
  const head: P[] = [[4, -14], [5.4, -27], [8, -31], [12, -31], [14, -27], [13.4, -20], [12, -14]];
  poly(g, head, STONE);
  const cloth: P[] = [[5.4, -27], [3, -20], [4, -14], [6.4, -14], [7, -26]]; // the headdress falling to the shoulders
  poly(g, cloth, STONE_DARK);
  g.lineWidth = 0.6; g.beginPath();
  g.moveTo(9.5, -25); g.lineTo(12, -25); // the eye
  g.moveTo(13.6, -22); g.lineTo(12.6, -21.2); g.moveTo(11, -18); g.lineTo(13, -18); // nose, mouth
  for (let y = -26; y < -15; y += 2.5) { g.moveTo(3.6, y); g.lineTo(6.6, y + 0.5); } // stripes of the cloth
  g.stroke(); g.lineWidth = 1;
}

function sanctuary(g: G): void {
  shadow(g, 50);
  poly(g, [[-25, 0], [25, 0], [24, -6], [-24, -6]], STONE); // the gallery
  g.fillStyle = INK; for (let x = -20; x <= 20; x += 5) { g.beginPath(); g.moveTo(x - 1, -0.4); g.lineTo(x - 1, -3.6); g.arc(x, -3.6, 1, Math.PI, 0); g.lineTo(x + 1, -0.4); g.fill(); }
  const tower = (x: number, h: number, w: number): void => { // a lotus tower: tiers narrowing to a bud
    const pts: P[] = [[x - w, -6], [x + w, -6], [x + w * 0.8, -6 - h * 0.45], [x + w * 0.55, -6 - h * 0.8], [x, -6 - h], [x - w * 0.55, -6 - h * 0.8], [x - w * 0.8, -6 - h * 0.45]];
    poly(g, pts, STONE); hatchIn(g, pts, x, -6 - h, x + w, -6, 1.3);
    g.lineWidth = 0.5; g.beginPath(); for (let k = 1; k < 5; k++) { const y = -6 - h * k / 5, ww = w * (1 - k * 0.17); g.moveTo(x - ww, y); g.lineTo(x + ww, y); } g.stroke(); g.lineWidth = 1;
  };
  tower(-15, 22, 5); tower(15, 22, 5); tower(0, 38, 8);
  g.fillStyle = MOSS; // the jungle, taking it back
  for (const [x, y, r] of [[-24, -5, 4], [22, -3, 3.5], [-8, -16, 2], [9, -24, 2.2], [-17, -26, 1.8], [26, -8, 3]]) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.stroke(); }
}

function arch(g: G): void {
  shadow(g, 40);
  g.beginPath(); g.moveTo(-17, 0); g.lineTo(-6, 0); g.lineTo(-6, -14); g.arc(0, -14, 6, Math.PI, 0); g.lineTo(6, 0); g.lineTo(17, 0); g.lineTo(17, -30); g.lineTo(-17, -30); g.closePath();
  g.fillStyle = STONE; g.fill(); g.stroke();
  hatchIn(g, [[6, 0], [17, 0], [17, -30], [6, -30]], 6, -30, 17, 0);
  poly(g, [[-18, -30], [18, -30], [18, -36], [-18, -36]], STONE); // the attic
  g.lineWidth = 0.5; g.beginPath();
  for (const x of [-12, 12]) { g.moveTo(x - 2, -2); g.lineTo(x - 2, -26); g.moveTo(x + 2, -2); g.lineTo(x + 2, -26); } // pilasters
  g.rect(-14, -25, 5, 5); g.rect(9, -25, 5, 5); // reliefs
  for (let x = -15; x < 15; x += 2.2) { g.moveTo(x, -34); g.lineTo(x + 1, -32); } // an inscription
  g.stroke(); g.lineWidth = 1;
  g.strokeStyle = 'rgba(42,36,29,.5)'; g.beginPath(); g.moveTo(17, -36); g.lineTo(14, -31); g.lineTo(16, -26); g.stroke(); g.strokeStyle = INK; // a crack
}

function amphitheatre(g: G): void {
  shadow(g, 54);
  // the oval, seen from above at an angle: the far wall, the arena, the near wall (half fallen)
  g.fillStyle = STONE_DARK; g.beginPath(); g.ellipse(0, -8, 26, 11, 0, Math.PI, 0); g.lineTo(26, -8); g.lineTo(26, -14); g.ellipse(0, -14, 26, 11, 0, 0, Math.PI, true); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = SAND; g.beginPath(); g.ellipse(0, -5, 15, 5.5, 0, 0, Math.PI * 2); g.fill(); g.stroke(); // the arena
  g.lineWidth = 0.4; g.beginPath(); for (const r of [18, 21, 24]) g.ellipse(0, -6, r, r * 0.42, 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke(); g.lineWidth = 1; // tiers
  // the near wall, two rows of arches, broken down on the right
  const wall: P[] = [[-27, -8], [-27, 0], [6, 2], [10, -2], [14, 0.6], [27, -1], [27, -8], [14, -6], [0, -5.4]];
  poly(g, wall, STONE); hatchIn(g, wall, 8, -8, 28, 2);
  g.fillStyle = INK;
  for (let x = -24; x < 6; x += 4.2) { const y = 0.3 + (x + 27) * 0.05; g.beginPath(); g.moveTo(x, y - 0.6); g.lineTo(x, y - 3); g.arc(x + 1.2, y - 3, 1.2, Math.PI, 0); g.lineTo(x + 2.4, y - 0.6); g.fill(); }
}

function aqueduct(g: G): void {
  shadow(g, 56);
  // two tiers of arches marching across, the last ones fallen
  g.fillStyle = STONE;
  const row = (y0: number, h: number, n: number, x0: number, w: number): void => {
    g.beginPath(); g.moveTo(x0, y0);
    for (let k = 0; k < n; k++) { const x = x0 + k * w; g.lineTo(x + w * 0.18, y0); g.lineTo(x + w * 0.18, y0 - h * 0.55); g.arc(x + w * 0.59, y0 - h * 0.55, w * 0.41, Math.PI, 0); g.lineTo(x + w, y0); }
    g.lineTo(x0 + n * w + w * 0.18, y0); g.lineTo(x0 + n * w + w * 0.18, y0 - h); g.lineTo(x0, y0 - h); g.closePath();
    g.fill(); g.stroke();
  };
  row(0, 16, 5, -27, 9);
  row(-16, 12, 4, -27, 9);
  g.beginPath(); g.rect(-27, -30, 38, 2.4); g.fillStyle = STONE; g.fill(); g.stroke(); // the water channel on top
  g.fillStyle = 'rgba(150,180,192,.8)'; g.fillRect(-26, -29.6, 35, 1);
  g.fillStyle = STONE; for (const [x, y, r] of [[24, -1, 2.4], [28, -0.6, 1.6], [21, -0.4, 1.4]]) { g.beginPath(); g.ellipse(x, y, r, r * 0.6, 0, 0, Math.PI * 2); g.fill(); g.stroke(); }
}

export function drawMonument(g: G, m: Monument, x: number, y: number): void {
  g.save();
  g.translate(x, y); g.scale(1.3, 1.3); // they must hold their own beside the wonders
  g.strokeStyle = INK; g.lineWidth = 1; g.lineJoin = 'round'; g.lineCap = 'round';
  switch (m.kind) {
    case 'colosse': colossus(g); break;
    case 'pyramide': pyramid(g); break;
    case 'temple': temple(g); break;
    case 'sphinx': sphinx(g); break;
    case 'sanctuaire': sanctuary(g); break;
    case 'arc': arch(g); break;
    case 'amphitheatre': amphitheatre(g); break;
    case 'aqueduc': aqueduct(g); break;
  }
  g.restore();
}
