// The other strange places (asked by Adrien: a real variety), as engraved pictograms in the
// same manner as icons.ts: fine ink, sepia wash, hatched shadows to the south-east, a short
// hatched ground. Drawn around the origin on the icon grid (ground at y = 0, up is negative).
import type { LandmarkKind } from '../world/landmarks';
import { INK } from './palette';
import { WASH, WASH_DARK, WATER, ground, hatch, path, shape, type G, type P } from './icons';

const STONE = 'rgba(196,186,166,.9)', DARK = 'rgba(70,60,52,.9)', IVORY = 'rgba(240,232,212,.95)', ICE = 'rgba(214,232,240,.9)';
const OCHRE = 'rgba(200,150,96,.85)', BRONZE = 'rgba(176,138,84,.9)', LEAF = 'rgba(112,150,92,.85)', BROWN = 'rgba(120,88,58,.9)';

/** Hatch the part of the current path's shape inside a box (shadow side). */
function shade(g: G, pts: P[], x0: number, y0: number, x1: number, y1: number, d = 1, a = 0.9): void {
  g.save(); path(g, pts, true); g.clip(); g.beginPath(); g.rect(x0, y0, x1 - x0, y1 - y0); g.clip(); hatch(g, x0, y0, x1, y1, d, a); g.restore();
}

function ellipse(g: G, x: number, y: number, rx: number, ry: number, fill?: string, stroke = true, a0 = 0, a1 = Math.PI * 2): void {
  g.beginPath(); g.ellipse(x, y, rx, ry, 0, a0, a1);
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) g.stroke();
}

function lines(g: G, w: number, segs: number[][]): void {
  g.save(); g.lineWidth = w; g.beginPath();
  for (const s of segs) { g.moveTo(s[0], s[1]); for (let k = 2; k < s.length; k += 2) g.lineTo(s[k], s[k + 1]); }
  g.stroke(); g.restore();
}

function ripples(g: G, w: number): void {
  lines(g, 0.3, [[-w, 0.6, -w * 0.4, 0.6], [w * 0.3, 0.8, w, 0.8], [-w * 0.6, 2, w * 0.5, 2]]);
}

/** A palm: a leaning trunk and a crown of drooping fronds. */
function palm(g: G, x: number, h: number, lean: number): void {
  const tx = x + lean, ty = -h;
  g.save(); g.lineWidth = 0.7; g.strokeStyle = 'rgb(120,92,60)';
  g.beginPath(); g.moveTo(x, 0); g.quadraticCurveTo(x + lean * 0.2, -h * 0.6, tx, ty); g.stroke(); g.restore();
  g.fillStyle = LEAF;
  for (const a of [-2.6, -1.9, -1.2, -0.5, 0.2]) {
    g.beginPath(); g.moveTo(tx, ty);
    g.quadraticCurveTo(tx + Math.cos(a) * 3, ty + Math.sin(a) * 3 - 1, tx + Math.cos(a) * 4.5, ty + Math.sin(a) * 2 + 2);
    g.quadraticCurveTo(tx + Math.cos(a) * 2, ty + Math.sin(a) * 1.5, tx, ty); g.fill(); g.stroke();
  }
}

export function drawMoreIcon(g: G, k: LandmarkKind): void {
  switch (k) {
    case 'menhirs': { // a stone circle seen from above at an angle: the far stones first
      ground(g, 22, 20);
      ellipse(g, 0, -0.5, 9.5, 3.4, 'rgba(160,170,120,.25)', false);
      const stones = Array.from({ length: 8 }, (_, i) => i * Math.PI * 2 / 8 + 0.2).sort((a, b) => Math.sin(a) - Math.sin(b));
      for (const a of stones) {
        const cx = Math.cos(a) * 9, cy = Math.sin(a) * 3.2 - 0.5, h = 5 + Math.sin(a) * 0.8 + (a * 7 % 1.5), w = 1.2;
        const pts: P[] = [[cx - w, cy], [cx + w, cy], [cx + w * 0.8, cy - h], [cx - w * 0.5, cy - h - 0.5]];
        shape(g, pts, STONE); shade(g, pts, cx, cy - h - 1, cx + w + 1, cy);
      }
      break;
    }
    case 'dolmen': {
      ground(g, 18, 18);
      g.fillStyle = DARK; g.fillRect(-3.6, -6.2, 7.2, 6.2);
      for (const x of [-6, 3.6]) { const pts: P[] = [[x, 0], [x + 2.4, 0], [x + 2.2, -6.4], [x + 0.2, -6.2]]; shape(g, pts, STONE); shade(g, pts, x + 1.2, -7, x + 3, 0); }
      const cap: P[] = [[-8.5, -6], [8, -6.6], [7.2, -9], [-1, -9.8], [-7.6, -8.4]];
      shape(g, cap, STONE); shade(g, cap, -9, -7.4, 9, -6);
      break;
    }
    case 'obelisque': {
      ground(g, 10, 14);
      const shaft: P[] = [[-1.9, 0], [1.9, 0], [1.25, -17], [-1.25, -17]];
      shape(g, shaft, STONE); shade(g, shaft, 0.2, -17, 2, 0, 0.8);
      shape(g, [[-1.25, -17], [1.25, -17], [0, -19.6]], 'rgba(214,180,110,.9)');
      for (let y = -15; y < -2; y += 2.2) lines(g, 0.3, [[-0.9, y, -0.2, y], [-0.6, y - 0.8, -0.6, y + 0.4]]); // glyphs
      break;
    }
    case 'puits': { // a well with no bottom
      ground(g, 14, 14);
      const wall: P[] = [[-5, -4], [5, -4], [5, 0.2], [-5, 0.2]];
      shape(g, wall, STONE); shade(g, wall, 1.5, -4, 5, 0.2);
      lines(g, 0.25, [[-5, -2, 5, -2], [-2.5, -4, -2.5, -2], [1.5, -4, 1.5, -2], [-0.5, -2, -0.5, 0.2], [3.5, -2, 3.5, 0.2]]);
      ellipse(g, 0, -4, 5, 1.9, STONE);
      ellipse(g, 0, -4, 3.8, 1.3, INK, false);
      lines(g, 0.5, [[-4.5, -4, -4.5, -10, 4.5, -10, 4.5, -4], [0, -10, 0, -6]]); // the frame and its rope
      break;
    }
    case 'foretpetrifiee': {
      ground(g, 22, 20);
      for (const [x, h, w] of [[-7, 9, 1.6], [-1.5, 12, 2], [4.5, 7, 1.5]] as const) {
        const pts: P[] = [[x - w, 0], [x + w, 0], [x + w * 0.8, -h + 1], [x + 0.3, -h], [x - w * 0.6, -h + 1.5]];
        shape(g, pts, 'rgba(176,168,150,.9)'); shade(g, pts, x, -h, x + w + 1, 0, 0.8);
        lines(g, 0.25, [[x - w * 0.6, -h * 0.3, x + w * 0.7, -h * 0.35], [x - w * 0.6, -h * 0.65, x + w * 0.6, -h * 0.6]]); // rings of the stone
      }
      g.save(); g.translate(7, -1); g.rotate(-0.15); ellipse(g, 0, 0, 3.5, 1.1, 'rgba(176,168,150,.9)'); g.restore(); // a fallen trunk
      break;
    }
    case 'meteorite': {
      lines(g, 0.3, Array.from({ length: 14 }, (_, i) => { const a = i * 0.45, r0 = 6, r1 = 8 + (i * 7 % 3); return [Math.cos(a) * r0, Math.sin(a) * r0 * 0.5, Math.cos(a) * r1, Math.sin(a) * r1 * 0.5]; }));
      ellipse(g, 0, 0, 6, 3, WASH_DARK);
      const rock: P[] = [[-3, 0.5], [-3.4, -3], [-1, -6], [2.4, -5.2], [3.6, -1.8], [2.6, 0.8]];
      shape(g, rock, 'rgb(64,56,52)');
      g.strokeStyle = 'rgba(240,200,120,.9)'; lines(g, 0.35, [[-1.4, -3.6, 0.2, -2.4, 1.6, -4], [0, -1, 1.2, -1.6]]); g.strokeStyle = INK; // glowing veins
      break;
    }
    case 'dirigeable': { // a crashed airship, nose in the ground, its fabric torn over the ribs
      ground(g, 26, 22);
      g.save(); g.translate(1, -4.5); g.rotate(0.22);
      ellipse(g, 0, 0, 12, 4.2, 'rgba(222,212,190,.92)');
      g.save(); g.beginPath(); g.ellipse(0, 0, 12, 4.2, 0, 0, 6.3); g.clip(); g.beginPath(); g.rect(-12, 0.5, 24, 4); g.clip(); hatch(g, -12, 0, 12, 4.5, 1, 0.9); g.restore();
      for (let x = -9; x <= 9; x += 3) { const h = 4.2 * Math.sqrt(1 - (x / 12) ** 2); lines(g, 0.3, [[x, -h, x, h]]); }
      g.fillStyle = 'rgba(236,227,203,1)'; g.beginPath(); g.moveTo(-10, -2); g.lineTo(-6, -3.8); g.lineTo(-4, 0); g.lineTo(-8, 1.5); g.closePath(); g.fill(); // a tear: the bare ribs show
      lines(g, 0.3, [[-9, -2.6, -9, 1.2], [-7, -3.4, -7, 1.6], [-5, -2, -9.5, -0.5]]);
      g.restore();
      const gondola: P[] = [[-3, -0.2], [3.5, 0.4], [3, -2], [-2.6, -2.4]];
      shape(g, gondola, BROWN);
      lines(g, 0.3, [[-2, -2.3, -1, -4.5], [2.5, -1.9, 3, -3.6]]);
      break;
    }
    case 'observatoire': {
      ground(g, 16, 16);
      const wall: P[] = [[-6, 0], [6, 0], [6, -6], [-6, -6]];
      shape(g, wall, STONE); shade(g, wall, 2, -6, 6, 0);
      g.fillStyle = DARK; g.fillRect(-1, -3.6, 2, 3.6);
      ellipse(g, 0, -6, 6, 5.4, 'rgba(160,170,176,.9)', true, Math.PI, Math.PI * 2);
      g.save(); g.beginPath(); g.ellipse(0, -6, 6, 5.4, 0, Math.PI, 0); g.clip(); g.fillStyle = DARK; g.fillRect(-0.8, -12, 1.8, 6); g.restore(); // the slit
      g.save(); g.translate(0.2, -9); g.rotate(-0.7); shape(g, [[-0.6, 0], [0.6, 0], [0.6, -6], [-0.6, -6]], BRONZE); g.restore(); // the telescope
      break;
    }
    case 'pontbrise': { // a stone bridge over nothing, broken in the middle
      ground(g, 26, 20);
      for (const side of [-1, 1]) {
        const x0 = side * 11, x1 = side * 2.5;
        const deck: P[] = [[x0, -8], [x1, -8 + (side > 0 ? 0.6 : 0)], [x1 - side * 0.8, -10], [x0, -10]];
        shape(g, deck, STONE);
        const pier: P[] = [[x0, 0], [x0 + side * -3, 0], [x0 + side * -3, -8], [x0, -8]];
        shape(g, pier.map(([x, y]) => [x, y] as P), STONE); shade(g, pier, Math.min(x0, x0 - side * 3), -8, Math.max(x0, x0 - side * 3), 0);
        g.beginPath(); g.moveTo(x0 - side * 3, -1); g.quadraticCurveTo(x0 - side * 6, -8.6, x1, -8); g.stroke(); // the arch
      }
      for (const [x, y, r] of [[-1, -0.6, 1.1], [1.6, -0.4, 0.8], [0.4, -1.4, 0.6]]) ellipse(g, x, y, r, r * 0.7, STONE); // fallen stones
      break;
    }
    case 'escalier': { // a great stair climbing to nowhere
      ground(g, 22, 22);
      const steps: P[] = [[-11, 0]];
      for (let i = 0; i < 8; i++) { steps.push([-11 + i * 2.3, -i * 2.1 - 2.1]); steps.push([-11 + (i + 1) * 2.3, -i * 2.1 - 2.1]); }
      steps.push([7.4, -16.8], [7.4, 0]);
      const side: P[] = [[7.4, 0], [9.4, 0.8], [9.4, -16], [7.4, -16.8]];
      shape(g, side, WASH_DARK); shade(g, side, 7.4, -17, 9.4, 1, 0.8);
      shape(g, steps, STONE);
      lines(g, 0.25, Array.from({ length: 8 }, (_, i) => [-11 + i * 2.3, -i * 2.1 - 2.1, -11 + i * 2.3, 0]));
      break;
    }
    case 'porte': { // a gate standing alone in the open, its door shut
      ground(g, 16, 16);
      g.fillStyle = 'rgba(150,128,96,.95)'; g.fillRect(-3.4, -12, 6.8, 12);
      g.save(); g.beginPath(); g.rect(-3.4, -12, 6.8, 12); g.clip(); hatch(g, -3.4, -12, 3.4, 0, 1.4, 1.57); g.restore();
      ellipse(g, 0, -7, 1.6, 1.6, undefined); lines(g, 0.3, [[0, -8.6, 0, -5.4], [-1.6, -7, 1.6, -7]]); // the sign on the door
      for (const x of [-5.6, 3.4]) { const p: P[] = [[x, 0], [x + 2.2, 0], [x + 2.2, -13], [x, -13]]; shape(g, p, STONE); shade(g, p, x + 1.1, -13, x + 2.2, 0); }
      shape(g, [[-7, -13], [7, -13], [6, -15.4], [-6, -15.4]], STONE);
      break;
    }
    case 'labyrinthe': { // a stone maze, seen from above at an angle
      ellipse(g, 0, 0, 12, 6, 'rgba(160,170,120,.25)', false);
      g.save(); g.scale(1, 0.5); g.lineWidth = 0.7;
      for (const [r, gap] of [[10, 0.3], [7, 2.2], [4, 4.1]] as const) {
        g.beginPath(); g.rect(-r, -r, r * 2, r * 2); g.stroke();
        g.save(); g.strokeStyle = 'rgba(236,227,203,1)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-r + gap * 2 + 1, -r); g.lineTo(-r + gap * 2 + 2.6, -r); g.stroke(); g.restore();
      }
      lines(g, 0.7, [[-7, 0, -4, 0], [4, -3, 7, -3], [0, 4, 0, 7], [0, -10, 0, -7]]);
      g.fillStyle = INK; g.beginPath(); g.arc(0, 0, 1, 0, 6.3); g.fill();
      g.restore();
      break;
    }
    case 'stele': {
      ground(g, 10, 12);
      const st: P[] = [[-3, 0], [3, 0], [3, -10], [2, -12], [0, -12.8], [-2, -12], [-3, -10]];
      shape(g, st, STONE); shade(g, st, 1, -13, 3.2, 0, 0.8);
      for (let y = -10.5; y < -1.5; y += 1.6) lines(g, 0.28, [[-2, y, -1.2, y, -1.2, y + 0.7], [-0.6, y + 0.3, 0.4, y + 0.3], [0.9, y, 1.9, y + 0.6]]); // a writing nobody reads
      break;
    }
    case 'ermitage': { // a hermit's hut on a knoll, smoke from the chimney
      g.beginPath(); g.moveTo(-12, 0); g.quadraticCurveTo(0, -7, 12, 0); g.closePath(); g.fillStyle = 'rgba(170,176,130,.6)'; g.fill(); g.stroke();
      const wall: P[] = [[-3.5, -4.5], [3.5, -4.5], [3.5, -9], [-3.5, -9]];
      shape(g, wall, STONE); shade(g, wall, 1, -9, 3.5, -4.5);
      shape(g, [[-4.6, -9], [4.6, -9], [0, -13.4]], BROWN);
      g.fillStyle = DARK; g.fillRect(-1, -7.2, 1.8, 2.7);
      shape(g, [[2, -11], [3.2, -11], [3.2, -13.4], [2, -13.4]], STONE);
      lines(g, 0.35, [[2.6, -13.6, 3.4, -15, 2.4, -16.4, 3.4, -18]]);
      break;
    }
    case 'mine': { // an abandoned mine in a hillside: timbered mouth, a rail, an overturned cart
      g.beginPath(); g.moveTo(-12, 0); g.quadraticCurveTo(-4, -12, 10, -6); g.lineTo(12, 0); g.closePath(); g.fillStyle = 'rgba(176,160,128,.7)'; g.fill(); g.stroke();
      g.save(); g.beginPath(); g.moveTo(-12, 0); g.quadraticCurveTo(-4, -12, 10, -6); g.lineTo(12, 0); g.closePath(); g.clip(); hatch(g, 0, -10, 12, 0, 1.1, 0.9); g.restore();
      g.fillStyle = INK; g.beginPath(); g.moveTo(-5, 0); g.lineTo(-5, -4.6); g.quadraticCurveTo(-2.5, -7, 0, -4.6); g.lineTo(0, 0); g.fill();
      g.strokeStyle = 'rgb(120,88,58)'; lines(g, 0.9, [[-5.6, 0, -5.6, -5.6, 0.6, -5.6, 0.6, 0]]); g.strokeStyle = INK;
      lines(g, 0.35, [[-2.5, 0, 9, 2], [-2.5, 1, 9, 3]]);
      for (let x = -1; x < 9; x += 2) lines(g, 0.3, [[x, 0.2 + (x + 2.5) * 0.17, x, 1.2 + (x + 2.5) * 0.17]]);
      g.save(); g.translate(6, 0.4); g.rotate(0.5); shape(g, [[-2, 0], [2, 0], [2.6, -2.6], [-2.6, -2.6]], BROWN); g.restore();
      break;
    }
    case 'automate': { // a giant clockwork automaton lying in the grass, a great wheel beside it
      ground(g, 24, 22);
      g.save(); g.translate(-2, -2.6); g.rotate(-0.05);
      shape(g, [[-9, 1.5], [3, 2], [3.4, -2.6], [-9, -2.8]], BRONZE); // the body
      lines(g, 0.3, [[-6, -2.7, -6, 1.6], [-3, -2.6, -3, 1.7], [0, -2.6, 0, 1.8]]);
      ellipse(g, 5.6, -0.6, 2.6, 2.6, BRONZE); // the head
      g.fillStyle = 'rgba(250,220,140,1)'; g.beginPath(); g.arc(6.4, -1, 0.6, 0, 6.3); g.fill(); g.stroke(); // a glass eye
      lines(g, 0.9, [[-9, -1, -12, -3.6, -13, -1]]); // an arm, bent
      g.restore();
      g.save(); g.translate(7, -6);
      g.beginPath(); for (let i = 0; i < 24; i++) { const a = i * Math.PI / 12, r = i % 2 ? 4 : 4.8; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fillStyle = BRONZE; g.fill(); g.stroke();
      ellipse(g, 0, 0, 1.4, 1.4, WASH);
      lines(g, 0.3, [[0, -1.4, 0, -3.6], [1.2, 0.7, 3, 1.8], [-1.2, 0.7, -3, 1.8]]);
      g.restore();
      break;
    }
    case 'cloche': { // a great bronze bell, half sunk and tilted, cracked
      ground(g, 18, 18);
      g.save(); g.translate(0, -0.5); g.rotate(-0.25);
      const bell = (): void => { g.beginPath(); g.moveTo(-7, 0); g.bezierCurveTo(-6.4, -3, -4, -4, -4, -8); g.bezierCurveTo(-4, -11.5, 4, -11.5, 4, -8); g.bezierCurveTo(4, -4, 6.4, -3, 7, 0); g.closePath(); };
      bell(); g.fillStyle = BRONZE; g.fill();
      g.save(); bell(); g.clip(); g.beginPath(); g.rect(1, -12, 7, 12); g.clip(); hatch(g, 1, -12, 8, 0, 0.9, 0.9); g.restore();
      bell(); g.stroke();
      lines(g, 0.3, [[-5.4, -2.5, 5.4, -2.5], [-4.6, -3.6, 4.6, -3.6]]);
      lines(g, 0.4, [[1, -10.5, 0.2, -7.5, 1.4, -5.2]]); // the crack
      shape(g, [[-1.6, -10.8], [1.6, -10.8], [1.2, -12.6], [-1.2, -12.6]], BRONZE);
      g.restore();
      g.fillStyle = 'rgba(236,227,203,1)'; g.fillRect(-10, 0.1, 20, 3); lines(g, 0.45, [[-9, 0.2, 9, 0.2]]); // the ground over its lip
      break;
    }
    case 'oasis': {
      ellipse(g, 0, 0, 12, 4.5, 'rgba(160,170,110,.4)', false);
      ellipse(g, -1, 0.4, 6.5, 2.4, WATER);
      palm(g, -7, 10, -1.5); palm(g, 5, 12, 2); palm(g, 8, 8, 1.2);
      const col: P[] = [[-11.4, 0.6], [-9.6, 0.6], [-9.8, -5], [-11.2, -5.6]];
      shape(g, col, STONE); shade(g, col, -10.6, -6, -9.4, 1);
      break;
    }
    case 'ziggourat': { // a stepped temple swallowed by the jungle
      ground(g, 22, 22);
      for (const [w, y0, y1] of [[10, 0, -4], [7.4, -4, -8], [4.8, -8, -12], [2.6, -12, -15]] as const) {
        const p: P[] = [[-w, y0], [w, y0], [w - 0.8, y1], [-w + 0.8, y1]];
        shape(g, p, STONE); shade(g, p, w * 0.3, y1, w, y0, 0.9);
      }
      g.fillStyle = WASH_DARK; g.fillRect(-1.3, -14.8, 2.6, 14.8);
      lines(g, 0.25, Array.from({ length: 13 }, (_, i) => [-1.3, -i * 1.15, 1.3, -i * 1.15]));
      g.fillStyle = LEAF; // vines and the trees growing out of it
      for (const [x, y, r] of [[-8, -4, 1.6], [7, -7, 1.4], [-4.6, -11, 1.2], [3.6, -13, 1.3], [9.4, -1.4, 2], [-10, -1, 1.8]]) { g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fill(); g.stroke(); }
      break;
    }
    case 'idole': { // a carved stone idol, a face with round eyes, crowned with feathers of stone
      ground(g, 12, 14);
      const b: P[] = [[-4, 0], [4, 0], [4, -11], [-4, -11]];
      shape(g, b, 'rgba(160,166,140,.9)'); shade(g, b, 1.5, -11, 4, 0);
      ellipse(g, -1.8, -7.6, 1.2, 1.2, IVORY); ellipse(g, 1.8, -7.6, 1.2, 1.2, IVORY);
      g.fillStyle = INK; for (const x of [-1.8, 1.8]) { g.beginPath(); g.arc(x, -7.6, 0.45, 0, 6.3); g.fill(); }
      shape(g, [[-2.4, -3.4], [2.4, -3.4], [1.8, -2], [-1.8, -2]], DARK); // the mouth
      for (let i = -3; i <= 3; i++) shape(g, [[i * 1.3 - 0.6, -11], [i * 1.3 + 0.6, -11], [i * 1.5, -14.5 + Math.abs(i) * 0.6]], STONE); // feathers
      g.fillStyle = LEAF; for (const [x, y] of [[-4.4, -2], [4.2, -6], [-3.6, -10]]) { g.beginPath(); g.ellipse(x, y, 1.4, 0.8, 0.6, 0, 6.3); g.fill(); g.stroke(); }
      break;
    }
    case 'cimetiere': { // where the elephants go to die: tusks, skulls, bones in the grass
      ground(g, 24, 20);
      for (const [x, s] of [[-6, 1], [5, -1], [0.5, 1]] as const) {
        g.save(); g.lineWidth = 1.2; g.strokeStyle = INK; g.beginPath(); g.moveTo(x, 0); g.quadraticCurveTo(x + s * 5, -1, x + s * 4, -9); g.stroke();
        g.lineWidth = 0.7; g.strokeStyle = 'rgb(240,232,212)'; g.stroke(); g.restore();
      }
      shape(g, [[-3, 0], [3, 0], [3.4, -3.2], [1, -4.6], [-2.4, -4], [-3.6, -2]], IVORY); // a great skull
      g.fillStyle = INK; g.beginPath(); g.ellipse(-0.6, -2.4, 0.9, 0.7, 0, 0, 6.3); g.fill();
      for (const [x, y] of [[-9, -0.4], [8.6, -0.2], [-4, 0.8]]) { g.save(); g.translate(x, y); g.rotate(x * 0.1); ellipse(g, 0, 0, 2.2, 0.5, IVORY); g.restore(); }
      break;
    }
    case 'termitiere': { // the termites' cathedral: tall fluted spires of red earth
      ground(g, 18, 18);
      for (const [x, h, w] of [[-5, 10, 2.6], [1, 16, 3.4], [6, 8, 2.2]] as const) {
        const p: P[] = [[x - w, 0], [x + w, 0], [x + w * 0.5, -h * 0.6], [x + 0.4, -h], [x - 0.6, -h * 0.9], [x - w * 0.6, -h * 0.5]];
        shape(g, p, OCHRE); shade(g, p, x, -h, x + w + 1, 0, 0.9);
        lines(g, 0.25, [[x - w * 0.3, -1, x - 0.2, -h * 0.8], [x + w * 0.4, -1, x + 0.3, -h * 0.75]]);
      }
      break;
    }
    case 'navireglace': { // a three-masted ship caught in the pack ice, listing
      g.save(); g.translate(0, -1.5); g.rotate(-0.12);
      const hull: P[] = [[-10, -2], [10, -3], [8, 1.5], [-8, 2]];
      shape(g, hull, BROWN); shade(g, hull, -10, -1, 10, 2.2);
      lines(g, 0.3, [[-9.4, -0.6, 9.4, -1.6]]);
      for (const [x, h] of [[-5, 10], [0.5, 13], [5.5, 9]] as const) {
        lines(g, 0.55, [[x, -2.5, x, -2.5 - h]]);
        lines(g, 0.35, [[x - 2.6, -2.5 - h * 0.7, x + 2.6, -2.5 - h * 0.7], [x - 2, -2.5 - h * 0.4, x + 2, -2.5 - h * 0.4]]);
      }
      lines(g, 0.25, [[-5, -12.5, -10, -2], [0.5, -15.5, 10, -3], [5.5, -11.5, 9.6, -5]]); // rigging
      g.restore();
      for (const [x, y, w, h] of [[-12, 1, 7, 3.6], [-4, 2.4, 9, 3], [6, 1.4, 8, 3.4], [-1, -1, 5, 2]]) {
        const p: P[] = [[x, y], [x + w, y + 0.4], [x + w - 1.2, y - h], [x + 1, y - h + 0.6]];
        shape(g, p, ICE); shade(g, p, x + w * 0.5, y - h, x + w, y + 0.5, 1.2);
      }
      break;
    }
    case 'mammouth': { // a mammoth frozen in a block of ice
      ground(g, 22, 22);
      const block: P[] = [[-11, 0], [11, 0.6], [10, -13], [-9.6, -14]];
      g.save(); path(g, block, true); g.fillStyle = ICE; g.fill(); g.clip();
      g.fillStyle = 'rgba(110,76,52,.75)'; // the shape inside
      g.beginPath(); g.ellipse(-0.5, -7, 6.2, 4, 0, 0, 6.3); g.fill();
      g.beginPath(); g.arc(5.6, -8.6, 2.6, 0, 6.3); g.fill();
      g.fillRect(-5, -4, 2, 4); g.fillRect(1.6, -4, 2, 4);
      g.lineWidth = 1.1; g.strokeStyle = 'rgba(110,76,52,.75)'; g.beginPath(); g.moveTo(7.6, -8); g.quadraticCurveTo(9, -4, 7.6, -1.6); g.stroke();
      g.lineWidth = 0.8; g.strokeStyle = 'rgb(240,232,212)'; g.beginPath(); g.moveTo(6.6, -7); g.quadraticCurveTo(10.6, -6, 9.4, -10.4); g.stroke();
      g.strokeStyle = INK; hatch(g, 3, -14, 11, 0, 1.5, 0.9);
      g.restore();
      path(g, block, true); g.stroke();
      lines(g, 0.3, [[-9, -12, -6, -9], [8, -11, 6, -6]]); // glints
      break;
    }
    case 'clocher': { // a belfry rising from the water: the village drowned below
      ripples(g, 10);
      const tower: P[] = [[-2.8, 0], [2.8, 0], [2.8, -9], [-2.8, -9]];
      shape(g, tower, STONE); shade(g, tower, 0.8, -9, 2.8, 0);
      g.fillStyle = DARK; g.beginPath(); g.moveTo(-1.2, -4); g.lineTo(-1.2, -6.6); g.arc(0, -6.6, 1.2, Math.PI, 0); g.lineTo(1.2, -4); g.fill();
      shape(g, [[-3.4, -9], [3.4, -9], [0, -16]], 'rgba(120,130,140,.9)');
      lines(g, 0.4, [[0, -16, 0, -18], [-0.8, -17.2, 0.8, -17.2]]);
      lines(g, 0.45, [[-6, 0.1, 6, 0.1]]);
      break;
    }
    case 'tortue': { // a turtle as big as an island, trees on its shell
      ripples(g, 13);
      ellipse(g, 0, 0, 11, 5.5, 'rgba(150,150,110,.9)', true, Math.PI, Math.PI * 2);
      g.save(); g.beginPath(); g.ellipse(0, 0, 11, 5.5, 0, Math.PI, 0); g.clip(); hatch(g, 2, -6, 11, 0, 1, 0.9);
      g.lineWidth = 0.3; for (const [x, y] of [[-6, -2], [-2, -4], [2.5, -4], [6.5, -2], [0, -1.2], [-4, -0.6], [4.5, -0.6]]) { g.beginPath(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; g.lineTo(x + Math.cos(a) * 1.8, y + Math.sin(a) * 1.1); } g.closePath(); g.stroke(); }
      g.restore();
      shape(g, [[10, -0.6], [14.2, -2.6], [15, -1], [11, 0.4]], 'rgba(150,150,110,.9)');
      g.fillStyle = INK; g.beginPath(); g.arc(13.8, -1.9, 0.35, 0, 6.3); g.fill();
      g.fillStyle = LEAF; for (const [x, y, r] of [[-3, -6, 2], [1.4, -6.6, 2.4], [5, -5, 1.6]]) { lines(g, 0.5, [[x, y + 1, x, y + 3]]); g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fill(); g.stroke(); }
      lines(g, 0.45, [[-13, 0.1, 13, 0.1]]);
      break;
    }
    case 'phare': { // an extinguished lighthouse on its rock
      ripples(g, 11);
      const rock: P[] = [[-7, 0.2], [-5, -2.6], [-1, -3.4], [4, -2.8], [7, 0.2]];
      shape(g, rock, 'rgba(120,112,100,.9)'); shade(g, rock, 0, -3.5, 7, 0.3);
      const tower: P[] = [[-2.2, -3], [2.2, -3], [1.4, -15], [-1.4, -15]];
      shape(g, tower, IVORY);
      g.save(); path(g, tower, true); g.clip(); g.fillStyle = 'rgba(168,52,40,.7)'; g.fillRect(-3, -8, 6, 2); g.fillRect(-3, -12.4, 6, 2); g.restore();
      path(g, tower, true); g.stroke();
      shape(g, [[-1.8, -15], [1.8, -15], [1.8, -17.4], [-1.8, -17.4]], 'rgba(170,190,196,.9)'); // the lantern, dark now
      lines(g, 0.3, [[0, -15, 0, -17.4]]);
      shape(g, [[-2.2, -17.4], [2.2, -17.4], [0, -19.4]], DARK);
      lines(g, 0.45, [[-10, 0.1, 10, 0.1]]);
      break;
    }
    default: break;
  }
}
