// Placeholders for the monsters' illustrations, engraved in ink like the rest of the map, until
// Doudou's pictures arrive. Drawn into a canvas of the battle page, centred, `w` x `h` CSS pixels.
import { INK } from './palette';

type G = CanvasRenderingContext2D;

function hatch(g: G, x0: number, y0: number, x1: number, y1: number, gap: number, alpha = 0.5): void {
  g.save(); g.globalAlpha *= alpha; g.lineWidth = 0.7; g.beginPath();
  for (let x = x0 - (y1 - y0); x < x1; x += gap) { g.moveTo(x, y1); g.lineTo(x + (y1 - y0) * 0.8, y0); }
  g.stroke(); g.restore();
}

/** The prowler of the mists: a tall hooded shape of fog, long-armed, its face a darkness. */
function rodeur(g: G, w: number, h: number, t: number): void {
  const cx = w / 2, base = h * 0.9, H = h * 0.75, sway = Math.sin(t * 1.2) * 4;
  g.fillStyle = 'rgba(42,36,29,.15)'; g.beginPath(); g.ellipse(cx, base, w * 0.22, 8, 0, 0, 6.3); g.fill();
  const body = new Path2D();
  body.moveTo(cx - w * 0.2, base);
  body.bezierCurveTo(cx - w * 0.24, base - H * 0.4, cx - w * 0.16 + sway, base - H * 0.85, cx + sway, base - H);
  body.bezierCurveTo(cx + w * 0.16 + sway, base - H * 0.85, cx + w * 0.24, base - H * 0.4, cx + w * 0.2, base);
  // a ragged hem of mist
  for (let k = 0; k <= 8; k++) { const x = cx + w * 0.2 - k * w * 0.05; body.lineTo(x, base - (k % 2 ? 10 : 0) - Math.sin(t * 2 + k) * 3); }
  body.closePath();
  g.fillStyle = 'rgba(176,180,186,.85)'; g.fill(body);
  g.save(); g.clip(body); hatch(g, cx, base - H, cx + w * 0.3, base, 5, 0.55); hatch(g, cx - w * 0.3, base - H * 0.5, cx + w * 0.3, base, 9, 0.3); g.restore();
  g.strokeStyle = INK; g.lineWidth = 1.4; g.stroke(body);
  // the hood's opening: a darkness, two faint pale points
  const fx = cx + sway * 0.9, fy = base - H * 0.78;
  g.fillStyle = 'rgb(40,36,40)'; g.beginPath(); g.ellipse(fx, fy, w * 0.07, H * 0.09, 0, 0, 6.3); g.fill(); g.stroke();
  g.fillStyle = 'rgba(230,226,214,.8)'; for (const d of [-1, 1]) { g.beginPath(); g.arc(fx + d * w * 0.025, fy - 2, 1.6, 0, 6.3); g.fill(); }
  // long thin arms, fingers like twigs
  g.lineWidth = 1.2;
  for (const d of [-1, 1]) {
    const sx = cx + d * w * 0.12 + sway * 0.6, sy = base - H * 0.6, ex = cx + d * w * 0.36, ey = base - H * 0.25 + Math.sin(t * 1.5 + d) * 6;
    g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo(cx + d * w * 0.3, sy - 10, ex, ey); g.stroke();
    for (const a of [-0.5, 0, 0.5]) { g.beginPath(); g.moveTo(ex, ey); g.lineTo(ex + d * 10 * Math.cos(a), ey + 12 + 6 * Math.sin(a)); g.stroke(); }
  }
}

/** The brass guardian: a walking automaton of the Oriandais, a great gear in its chest. */
function gardien(g: G, w: number, h: number, t: number): void {
  const cx = w / 2, base = h * 0.9, s = h / 260, bob = Math.sin(t * 2) * 2;
  const BRASS = 'rgb(190,150,88)', DARK = 'rgb(130,98,54)';
  g.fillStyle = 'rgba(42,36,29,.15)'; g.beginPath(); g.ellipse(cx, base, 70 * s, 8, 0, 0, 6.3); g.fill();
  g.strokeStyle = INK; g.lineWidth = 1.3; g.lineJoin = 'round';
  const box = (x: number, y: number, bw: number, bh: number, fill: string): void => { g.fillStyle = fill; g.fillRect(x, y, bw, bh); g.strokeRect(x, y, bw, bh); };
  // legs
  for (const d of [-1, 1]) { box(cx + d * 22 * s - 9 * s, base - 70 * s, 18 * s, 70 * s, DARK); box(cx + d * 22 * s - 13 * s, base - 8 * s, 26 * s, 8 * s, BRASS); }
  // body
  const by = base - 170 * s + bob;
  g.fillStyle = BRASS; g.beginPath(); g.moveTo(cx - 50 * s, by); g.lineTo(cx + 50 * s, by); g.lineTo(cx + 40 * s, by + 105 * s); g.lineTo(cx - 40 * s, by + 105 * s); g.closePath(); g.fill(); g.stroke();
  g.save(); g.clip(); hatch(g, cx + 10 * s, by, cx + 60 * s, by + 110 * s, 5, 0.5); g.restore();
  for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(cx - 48 * s + k * 2, by + k * 26 * s); g.lineTo(cx + 48 * s - k * 2, by + k * 26 * s); g.stroke(); } // plates
  // the gear, turning
  const gx = cx, gy = by + 48 * s, R = 24 * s;
  g.save(); g.translate(gx, gy); g.rotate(t * 0.8);
  g.fillStyle = 'rgb(214,182,112)'; g.beginPath();
  for (let k = 0; k < 24; k++) { const a = k * Math.PI / 12, r = k % 2 ? R * 0.82 : R; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  g.closePath(); g.fill(); g.stroke();
  g.beginPath(); g.arc(0, 0, R * 0.3, 0, 6.3); g.fillStyle = DARK; g.fill(); g.stroke();
  for (let k = 0; k < 3; k++) { const a = k * 2.09; g.beginPath(); g.moveTo(Math.cos(a) * R * 0.3, Math.sin(a) * R * 0.3); g.lineTo(Math.cos(a) * R * 0.75, Math.sin(a) * R * 0.75); g.stroke(); }
  g.restore();
  // arms, heavy, ending in mallets
  for (const d of [-1, 1]) {
    const sx = cx + d * 52 * s, sy = by + 10 * s, ex = cx + d * 70 * s, ey = by + 95 * s + Math.sin(t * 2 + d) * 4;
    g.lineWidth = 12 * s; g.strokeStyle = INK; g.beginPath(); g.moveTo(sx, sy); g.lineTo(ex, ey); g.stroke();
    g.lineWidth = 9 * s; g.strokeStyle = DARK; g.stroke();
    g.lineWidth = 1.3; g.strokeStyle = INK; box(ex - 13 * s, ey, 26 * s, 20 * s, BRASS);
  }
  // head: a domed helm with one round window, a dim light inside
  const hy = by - 34 * s;
  g.fillStyle = BRASS; g.beginPath(); g.moveTo(cx - 24 * s, by); g.lineTo(cx - 24 * s, hy + 12 * s); g.arc(cx, hy + 12 * s, 24 * s, Math.PI, 0); g.lineTo(cx + 24 * s, by); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = 'rgb(60,52,44)'; g.beginPath(); g.arc(cx, hy + 14 * s, 10 * s, 0, 6.3); g.fill(); g.stroke();
  g.fillStyle = `rgba(240,200,120,${0.55 + 0.25 * Math.sin(t * 3)})`; g.beginPath(); g.arc(cx, hy + 14 * s, 4 * s, 0, 6.3); g.fill();
  g.beginPath(); g.moveTo(cx, hy - 12 * s); g.lineTo(cx, hy - 24 * s); g.stroke(); g.beginPath(); g.arc(cx, hy - 26 * s, 3 * s, 0, 6.3); g.fillStyle = BRASS; g.fill(); g.stroke();
  // rivets
  g.fillStyle = INK; for (const [x, y] of [[-40, 12], [40, 12], [-34, 92], [34, 92]]) { g.beginPath(); g.arc(cx + x * s, by + y * s, 1.6, 0, 6.3); g.fill(); }
}

/** Draw the monster `id` in a canvas of w x h CSS pixels, at time t (seconds). */
export function drawMonster(g: G, id: string, w: number, h: number, t: number): void {
  g.clearRect(0, 0, w, h);
  if (id === 'gardien') gardien(g, w, h, t); else rodeur(g, w, h, t);
}
