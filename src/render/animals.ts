// Wild animals drawn as small engraved figures: ink outline, a wash of colour, a soft shadow.
// Their legs walk when they move; the herd stands and grazes when it stops.
import type { Animal, Look } from '../world/fauna';
import { INK } from './palette';

const rgb = (c: number[], k = 1): string => `rgb(${Math.round(c[0] * k)},${Math.round(c[1] * k)},${Math.round(c[2] * k)})`;

/**
 * Draw one animal at screen (x, y) (its feet), `scale` CSS pixels per drawing unit, `time` in
 * seconds. Unit: the same as the explorer's drawing.
 */
export function drawAnimal(ctx: CanvasRenderingContext2D, look: Look, a: Animal, x: number, y: number, scale: number, time: number): void {
  ctx.save();
  ctx.translate(x, y); ctx.scale(scale * a.dir, scale);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = 0.9 / scale;
  switch (look.kind) {
    case 'whale': whale(ctx, look, a, time); break;
    case 'seal': seal(ctx, look, a, time); break;
    case 'hopper': hopper(ctx, look, a, time); break;
    default: quad(ctx, look, a, time);
  }
  ctx.restore();
}

function shadow(ctx: CanvasRenderingContext2D, w: number): void {
  ctx.globalAlpha = 0.2; ctx.fillStyle = INK;
  ctx.beginPath(); ctx.ellipse(0, 0.6, w, w * 0.22, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
}

/** Four legs, a body, a head: everything from the fox to the elephant. */
function quad(ctx: CanvasRenderingContext2D, L: Look, a: Animal, time: number): void {
  const len = L.len, h = L.height ?? len * 0.6, c = L.color;
  const legH = h * (L.trunk && len > 10 ? 0.45 : 0.5), bodyH = h - legH, bx = len / 2, by = -legH - bodyH * 0.45;
  // gait: legs swing when moving; when still, the head dips to graze now and then
  const g = a.pace > 0.15 ? Math.sin(time * (6 + 10 / len) + a.phase) * a.pace : 0;
  const graze = a.pace < 0.15 && !L.mane && Math.sin(time * 0.6 + a.phase) > 0.3 ? 1 : 0;
  shadow(ctx, len * 0.55);
  // legs: far pair darker, near pair over the body's colour
  const heavy = !!L.trunk && len > 10;
  ctx.lineWidth = heavy ? len * 0.16 : Math.max(0.6, len * 0.07 + h * 0.07);
  const leg = (lx: number, sw: number, dark: number): void => {
    ctx.strokeStyle = rgb(c, dark);
    ctx.beginPath(); ctx.moveTo(lx, by); ctx.lineTo(lx + sw * legH * 0.45, heavy ? -ctx.lineWidth / 2 : -0.2); ctx.stroke();
  };
  leg(-bx * 0.6, -g, 0.6); leg(bx * 0.6, g, 0.6);
  leg(-bx * 0.72, g, 0.85); leg(bx * 0.5, -g, 0.85);
  // tail
  if (L.tail) {
    ctx.strokeStyle = rgb(c, 0.75); ctx.lineWidth = Math.max(0.5, L.tail > 2.5 ? len * 0.09 : len * 0.05);
    const sw = Math.sin(time * 3 + a.phase) * 0.4;
    ctx.beginPath(); ctx.moveTo(-bx * 0.95, by - bodyH * 0.1);
    ctx.quadraticCurveTo(-bx - L.tail * 0.6, by + (L.tail > 2.5 ? -L.tail * 0.5 : 0.3), -bx - L.tail * 0.8, by + L.tail * (0.2 + sw));
    ctx.stroke();
  }
  ctx.strokeStyle = INK; ctx.lineWidth = Math.max(0.35, len * 0.04);
  // body
  ctx.fillStyle = rgb(c);
  ctx.beginPath(); ctx.ellipse(0, by, bx, bodyH * 0.62, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  if (L.hump) { ctx.beginPath(); ctx.ellipse(-bx * 0.05, by - bodyH * 0.5, bx * 0.4, L.hump * 0.6, 0, Math.PI, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  if (L.stripes) {
    ctx.strokeStyle = INK; ctx.lineWidth = len * 0.045;
    for (let k = -3; k <= 3; k++) { ctx.beginPath(); ctx.moveTo(k * bx * 0.25, by - bodyH * 0.55); ctx.lineTo(k * bx * 0.25 + 0.5, by + bodyH * 0.55); ctx.stroke(); }
    ctx.lineWidth = Math.max(0.35, len * 0.04);
  }
  if (L.spots) {
    ctx.fillStyle = rgb(c, 0.45);
    for (let k = 0; k < 7; k++) { ctx.beginPath(); ctx.arc(-bx * 0.7 + k * bx * 0.24, by + Math.sin(k * 2.3) * bodyH * 0.3, len * 0.04, 0, Math.PI * 2); ctx.fill(); }
  }
  // neck and head
  const neck = L.neck ?? 0, hr = Math.max(0.9, len * (heavy ? 0.2 : 0.13));
  const hx = bx * 0.95 + (neck ? neck * 0.35 : hr * 0.5), hy = graze ? -hr * 1.1 : by - (neck ? neck * 0.85 : bodyH * 0.3);
  ctx.fillStyle = rgb(c);
  if (neck || graze) {
    ctx.lineWidth = Math.max(hr * 0.9, len * 0.1); ctx.strokeStyle = rgb(c);
    ctx.beginPath(); ctx.moveTo(bx * 0.65, by - bodyH * 0.15); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.strokeStyle = INK; ctx.lineWidth = Math.max(0.35, len * 0.04);
  }
  if (L.mane) { ctx.fillStyle = rgb(c, 0.7); ctx.beginPath(); ctx.arc(hx - hr * 0.3, hy, hr * 1.7, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = rgb(c); }
  if (L.ears && L.ears > 2.5) { // the elephant's great ear, behind the head
    ctx.fillStyle = rgb(c, 0.85); ctx.beginPath(); ctx.ellipse(hx - hr * 0.8, hy + hr * 0.2, L.ears * 0.5, L.ears * 0.7, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = rgb(c);
  }
  ctx.beginPath(); ctx.ellipse(hx + hr * 0.3, hy, hr * 1.1, hr * 0.8, graze ? 0.6 : 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  if (L.trunk) {
    ctx.lineWidth = Math.max(0.6, hr * 0.5); ctx.strokeStyle = rgb(c, 0.9);
    ctx.beginPath(); ctx.moveTo(hx + hr * 1.2, hy); ctx.quadraticCurveTo(hx + hr * 1.6 + L.trunk * 0.3, hy + L.trunk * 0.5, hx + hr * 1.3, hy + L.trunk + Math.sin(time + a.phase) * 0.4); ctx.stroke();
    ctx.strokeStyle = INK; ctx.lineWidth = Math.max(0.35, len * 0.04);
  }
  if (L.tusks) { ctx.strokeStyle = 'rgb(240,232,210)'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(hx + hr * 1.1, hy + hr * 0.3); ctx.quadraticCurveTo(hx + hr * 1.6, hy + hr * 0.1, hx + hr * 1.5, hy - hr * 0.5); ctx.stroke(); ctx.strokeStyle = INK; }
  if (L.ears && L.ears <= 2.5) { ctx.fillStyle = rgb(c, 0.85); ctx.beginPath(); ctx.moveTo(hx - hr * 0.2, hy - hr * 0.5); ctx.lineTo(hx - hr * 0.1, hy - hr * 0.6 - L.ears); ctx.lineTo(hx + hr * 0.4, hy - hr * 0.5); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  if (L.antlers) {
    ctx.strokeStyle = 'rgb(110,84,58)'; ctx.lineWidth = 0.55; const A = L.antlers, ax = hx, ay = hy - hr * 0.6;
    ctx.beginPath();
    ctx.moveTo(ax, ay); ctx.lineTo(ax - A * 0.3, ay - A); ctx.moveTo(ax - A * 0.15, ay - A * 0.5); ctx.lineTo(ax + A * 0.3, ay - A * 0.75);
    ctx.moveTo(ax - A * 0.25, ay - A * 0.8); ctx.lineTo(ax - A * 0.65, ay - A * 1.05); ctx.stroke(); ctx.strokeStyle = INK;
  }
  if (L.horns) {
    ctx.strokeStyle = 'rgb(80,64,50)'; ctx.lineWidth = 0.6; const A = L.horns;
    ctx.beginPath(); ctx.moveTo(hx, hy - hr * 0.6); ctx.quadraticCurveTo(hx - A * 0.2, hy - A, hx - A * 0.7, hy - A * 0.9); ctx.stroke(); ctx.strokeStyle = INK;
  }
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(hx + hr * 0.6, hy - hr * 0.15, Math.max(0.25, hr * 0.14), 0, Math.PI * 2); ctx.fill(); // eye
}

/** Rabbits, hares, marmots: a round body that hops. */
function hopper(ctx: CanvasRenderingContext2D, L: Look, a: Animal, time: number): void {
  const len = L.len, c = L.color;
  const hop = a.pace > 0.15 ? Math.max(0, Math.sin(time * 9 + a.phase)) * len * 0.5 * a.pace : 0;
  shadow(ctx, len * 0.5);
  ctx.translate(0, -hop);
  ctx.lineWidth = Math.max(0.3, len * 0.07); ctx.fillStyle = rgb(c);
  ctx.beginPath(); ctx.ellipse(-len * 0.1, -len * 0.4, len * 0.5, len * 0.38, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); // body
  ctx.beginPath(); ctx.arc(len * 0.38, -len * 0.62, len * 0.22, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); // head
  if (L.ears) { ctx.beginPath(); ctx.ellipse(len * 0.3, -len * 0.75 - L.ears * 0.45, len * 0.08, L.ears * 0.45, -0.25, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  ctx.fillStyle = 'rgb(245,240,230)'; ctx.beginPath(); ctx.arc(-len * 0.58, -len * 0.42, len * 0.11, 0, Math.PI * 2); ctx.fill(); // tail tuft
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(len * 0.46, -len * 0.66, len * 0.045, 0, Math.PI * 2); ctx.fill();
}

/** A whale's back rolling out of the sea, its spout now and then, its flukes when it dives. */
function whale(ctx: CanvasRenderingContext2D, L: Look, a: Animal, time: number): void {
  const len = L.len, c = L.color, cyc = (time / 14 + a.phase) % 1; // surfaces, breathes, dives
  if (cyc > 0.7) return; // under water
  const up = Math.sin(Math.min(1, cyc / 0.6) * Math.PI), hb = len * 0.16 * up;
  ctx.globalAlpha = 0.3; ctx.strokeStyle = 'rgb(240,246,250)'; ctx.lineWidth = len * 0.04;
  ctx.beginPath(); ctx.ellipse(0, 0, len * 0.6, len * 0.08, 0, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; // foam ring
  ctx.strokeStyle = INK; ctx.lineWidth = Math.max(0.4, len * 0.02); ctx.fillStyle = rgb(c);
  ctx.beginPath(); ctx.moveTo(-len * 0.5, 0); ctx.quadraticCurveTo(0, -hb * 2, len * 0.5, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  if (cyc > 0.5) { // flukes as it dives
    const f = (cyc - 0.5) / 0.2, fy = -len * 0.25 * Math.sin(f * Math.PI);
    ctx.beginPath(); ctx.moveTo(-len * 0.55, 0); ctx.lineTo(-len * 0.6, fy); ctx.quadraticCurveTo(-len * 0.8, fy - len * 0.06, -len * 0.82, fy - len * 0.02);
    ctx.lineTo(-len * 0.6, fy + len * 0.02); ctx.lineTo(-len * 0.4, fy - len * 0.04); ctx.quadraticCurveTo(-len * 0.45, fy, -len * 0.6, fy); ctx.fill(); ctx.stroke();
  }
  if (cyc > 0.2 && cyc < 0.35) { // the spout
    const s = (cyc - 0.2) / 0.15;
    ctx.globalAlpha = 1 - s; ctx.strokeStyle = 'rgb(220,232,240)'; ctx.lineWidth = len * 0.03;
    const sx = len * 0.2, top = -hb - len * 0.35 * Math.min(1, s * 2);
    ctx.beginPath(); ctx.moveTo(sx, -hb); ctx.lineTo(sx, top); ctx.moveTo(sx, top); ctx.quadraticCurveTo(sx - len * 0.1, top - len * 0.05, sx - len * 0.15, top + len * 0.1);
    ctx.moveTo(sx, top); ctx.quadraticCurveTo(sx + len * 0.1, top - len * 0.05, sx + len * 0.15, top + len * 0.1); ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

/** A seal lying on the ice, raising its head now and then. */
function seal(ctx: CanvasRenderingContext2D, L: Look, a: Animal, time: number): void {
  const len = L.len, c = L.color, lift = Math.max(0, Math.sin(time * 0.5 + a.phase)) * len * 0.15;
  shadow(ctx, len * 0.5);
  ctx.lineWidth = Math.max(0.3, len * 0.05); ctx.fillStyle = rgb(c);
  ctx.beginPath(); ctx.moveTo(-len * 0.5, -len * 0.08);
  ctx.quadraticCurveTo(-len * 0.1, -len * 0.38, len * 0.3, -len * 0.25 - lift);
  ctx.quadraticCurveTo(len * 0.5, -len * 0.2 - lift, len * 0.45, -len * 0.08);
  ctx.quadraticCurveTo(0, 0, -len * 0.5, -len * 0.08); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-len * 0.5, -len * 0.08); ctx.lineTo(-len * 0.62, -len * 0.18); ctx.lineTo(-len * 0.62, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); // tail flippers
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(len * 0.36, -len * 0.24 - lift, len * 0.03, 0, Math.PI * 2); ctx.fill();
}
