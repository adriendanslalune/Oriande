// Wild animals as small engravings, in the manner of a naturalist's plate: one smooth contour
// per animal (back, withers, neck, head, chest, belly, haunch) in fine ink, a light wash of
// colour, hatching in the shadows, and jointed legs that walk. Side view, facing east; the
// caller flips it for animals facing west.
import type { Animal, Look } from '../world/fauna';
import { INK } from './palette';

type P = [number, number];
const PAPER_RGB = [236, 227, 203];

/** A colour washed a little towards the paper, as watercolour on a plate. */
const NIGHT_RGB = [44, 52, 78];
const wash = (c: number[], k = 1, a = 1): string => {
  // at night the colours sink towards the blue of the dark
  const m = (i: number): number => { const v = (c[i] * 0.86 + PAPER_RGB[i] * 0.14) * k; return Math.round(v + (NIGHT_RGB[i] - v) * dim); };
  return `rgba(${m(0)},${m(1)},${m(2)},${a})`;
};
/** the current figure's hatching strength (set per animal) */
let shading = 1;
/** how far the current figure's colours sink into the night (0 by day) */
let dim = 0;
const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const add = (a: P, b: P, k = 1): P => [a[0] + b[0] * k, a[1] + b[1] * k];
const rad = (d: number): number => d * Math.PI / 180;

/** A smooth closed curve through the points (Catmull-Rom as Béziers). */
function smooth(ctx: CanvasRenderingContext2D, pts: P[], closed = true): void {
  const n = pts.length, at = (i: number): P => closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))];
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    ctx.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
  }
  if (closed) ctx.closePath();
}

/** Engraver's hatching: parallel diagonal strokes over the box, inside the current clip. */
function hatch(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, gap: number, width: number, alpha = 0.55): void {
  if (shading <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha * shading; ctx.strokeStyle = INK; ctx.lineWidth = width;
  ctx.beginPath();
  const h = y1 - y0;
  for (let x = x0 - h; x < x1; x += gap) { ctx.moveTo(x, y1); ctx.lineTo(x + h * 0.7, y0); }
  ctx.stroke();
  ctx.restore();
}

/**
 * A pose: everything that moves, quantized so that each pose can be drawn once and kept.
 * gait: the walking cycle [0, 1); graze: how low the head is (0..1); look: head turned
 * up or down (-1..1); sway: tail and trunk (-1..1); cycle: a whale's dive [0, 1); up: a
 * marmot sitting up, a seal raising its head (0..1).
 */
interface Pose { moving: boolean; gait: number; graze: number; look: number; sway: number; cycle: number; up: number }

const GAIT_FRAMES = 8, LEVELS = 4, WHALE_FRAMES = 48;
const q = (v: number, n: number): number => Math.round(v * n) / n;

function poseOf(L: Look, a: Animal, time: number): Pose {
  const moving = a.pace > 0.12;
  const len = L.len;
  let gait = 0, graze = 0, look = 0, up = 0, cycle = 0;
  const sway = q(Math.sin(time * (moving ? 4 : 1.5)), 2);
  if (L.kind === 'quad') {
    if (moving) gait = Math.floor(((time * (5 + 14 / len)) / (Math.PI * 2) % 1) * GAIT_FRAMES) / GAIT_FRAMES;
    const eater = L.mane !== 'lion' && L.tail !== 'bush' && !L.spots && L.feet !== 'column';
    if (!moving && eater) graze = q(clamp01((Math.sin(time * 0.45) - 0.15) * 2.5), LEVELS);
    if (!moving && !eater) look = q(Math.sin(time * 0.5), 2);
  } else if (L.kind === 'hopper') {
    if (moving) gait = Math.floor(((time * 2.2) % 1) * GAIT_FRAMES) / GAIT_FRAMES;
    else if (L.sits) up = q(clamp01((Math.sin(time * 0.35) - 0.2) * 3), LEVELS);
  } else if (L.kind === 'bat') {
    gait = Math.floor(((time * 9) % 1) * GAIT_FRAMES) / GAIT_FRAMES; // quick wingbeats
  } else if (L.kind === 'owl') {
    const beat = Math.sin(time * 0.9) > 0.55; // glides, beats its wings now and then
    gait = beat ? Math.floor(((time * 3) % 1) * GAIT_FRAMES) / GAIT_FRAMES : 0.25;
  } else if (L.kind === 'hedgehog') {
    if (moving) gait = Math.floor(((time * 3) % 1) * GAIT_FRAMES) / GAIT_FRAMES;
    else up = q(clamp01(Math.sin(time * 0.8)), 2); // sniffing
  } else if (L.kind === 'whale') {
    cycle = Math.floor((((time / 14) % 1 + 1) % 1) * WHALE_FRAMES) / WHALE_FRAMES;
  } else {
    up = q(clamp01((Math.sin(time * 0.5) - 0.2) * 2), LEVELS);
  }
  return { moving, gait, graze, look, sway, cycle, up };
}

/** Drawn poses, by look, pose and size. */
const cache = new Map<string, { img: HTMLCanvasElement; ox: number; oy: number; k: number }>();
const looks = new Map<Look, number>();

/**
 * Draw one animal at screen (x, y) (its feet), `scale` CSS pixels per drawing unit, `time` in
 * seconds (with the animal's own phase already added), `dpr` the device pixel ratio.
 */
export function drawAnimal(ctx: CanvasRenderingContext2D, look: Look, a: Animal, x: number, y: number, scale: number, time: number, dpr = 1, night = false): void {
  const pose = poseOf(look, a, time);
  const flying = look.kind === 'bat' || look.kind === 'owl';
  if (look.kind === 'whale' && pose.cycle > 0.75) return; // under water
  // sizes snap to steps of ~8 %, so a zoom does not fill the cache with near-copies
  const s = Math.pow(1.08, Math.round(Math.log(scale) / Math.log(1.08)));
  if (!looks.has(look)) looks.set(look, looks.size);
  const key = looks.get(look) + (night ? 'n|' : '|') + s.toFixed(3) + '|' + dpr + '|' + (pose.moving ? 1 : 0) + pose.gait + ',' + pose.graze + ',' + pose.look + ',' + pose.sway + ',' + pose.cycle + ',' + pose.up;
  let c = cache.get(key);
  if (!c) {
    if (cache.size > 600) cache.clear();
    const size = Math.max(look.len, look.height ?? 0) * (flying ? 2.2 : 1) + (look.tailLen ?? 0) + (look.trunk ?? 0);
    const half = size * 0.95 + 3, above = Math.max(look.len, look.height ?? 0) * (flying ? 1.6 : 1) + (look.antlers ?? 0) * 1.2 + (look.hornLen ?? 0) + (look.ears === 'flap' ? 0 : look.earSize ?? 0) + 3 + (look.kind === 'whale' ? look.len * 0.5 : 0);
    const k = s * dpr, img = document.createElement('canvas');
    img.width = Math.ceil(half * 2 * k); img.height = Math.ceil((above + 2) * k);
    const g = img.getContext('2d')!;
    g.setTransform(k, 0, 0, k, half * k, above * k);
    dim = night ? 0.55 : 0;
    render(g, look, pose, s);
    dim = 0;
    c = { img, ox: half, oy: above, k };
    cache.set(key, c);
  }
  ctx.save();
  ctx.translate(x, y);
  if (a.alt) { // in flight: its shadow on the ground, the creature above
    ctx.globalAlpha *= 0.18; ctx.fillStyle = INK;
    ctx.beginPath(); ctx.ellipse(0, 0, look.len * scale * 0.7, look.len * scale * 0.15, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha /= 0.18;
    ctx.translate(0, -a.alt * scale);
  }
  if (a.dir < 0) ctx.scale(-1, 1);
  const r = c.k / dpr;
  ctx.drawImage(c.img, -c.ox * r, -c.oy * r, c.img.width / dpr, c.img.height / dpr);
  ctx.restore();
}

/** Where its eyes are (drawing units from its feet, facing east), for the eyeshine at night. */
export function eyesOf(look: Look): [number, number] {
  if (look.kind === 'owl') return [look.len * 0.25, -look.len * 0.35];
  if (look.kind !== 'quad') return [look.len * 0.45, -look.len * 0.45];
  const H = look.height ?? look.len * 0.7, up = (look.neckUp ?? 30) * Math.PI / 180, nk = (look.neck ?? 1) + H * (1 - (look.legs ?? 0.55)) * 0.15;
  return [look.len * 0.4 + Math.cos(up) * nk + (look.head ?? 2) * 0.3, -H * 0.9 - Math.sin(up) * nk + (look.headDepth ?? 1) * 0.2];
}

/** Draw a pose at the origin (feet), facing east, in drawing units already scaled by `scale`. */
function render(ctx: CanvasRenderingContext2D, look: Look, p: Pose, scale: number): void {
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // ink and hatching keep a fixed width on screen, whatever the size of the animal;
  // hatching fades out on small figures, where it would only grey them
  shading = clamp01((look.len * scale - 14) / 50);
  const pen = { line: 0.65 / scale, fine: 0.4 / scale, gap: Math.max(1.8 / scale, 0.25), shade: shading };
  switch (look.kind) {
    case 'whale': whale(ctx, look, p, pen); break;
    case 'seal': seal(ctx, look, p, pen); break;
    case 'hopper': hopper(ctx, look, p, pen); break;
    case 'bat': bat(ctx, look, p, pen); break;
    case 'owl': owl(ctx, look, p, pen); break;
    case 'hedgehog': hedgehog(ctx, look, p, pen); break;
    default: quad(ctx, look, p, pen);
  }
}

interface Pen { line: number; fine: number; gap: number; shade: number }

function shadow(ctx: CanvasRenderingContext2D, x: number, w: number): void {
  ctx.save(); ctx.globalAlpha = 0.16; ctx.fillStyle = INK;
  ctx.beginPath(); ctx.ellipse(x, 0.3, w, w * 0.16, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/** Fill and ink a path built by `path`. */
function inked(ctx: CanvasRenderingContext2D, pen: Pen, fill: string, path: () => void): void {
  ctx.beginPath(); path(); ctx.fillStyle = fill; ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = pen.line; ctx.stroke();
}

// ---- four-legged animals ----

function quad(ctx: CanvasRenderingContext2D, L: Look, p: Pose, pen: Pen): void {
  const len = L.len, H = L.height ?? len * 0.7, legH = H * (L.legs ?? 0.55), depth = H - legH;
  const c = L.color, column = L.feet === 'column';
  const top = -legH - depth; // the line of the back
  const moving = p.moving, g = p.graze, look = p.look * 6;

  // the skeleton of the silhouette
  const hump = L.hump ?? 0, humpBack = L.humpAt === 'back';
  const R: P = [-len * 0.5, top + depth * 0.1]; // top of the rump
  const W: P = [len * 0.3, top - (humpBack ? 0 : hump) - depth * 0.04]; // withers
  const neckUp = rad(lerp(L.neckUp ?? 30, -55, g) + look);
  const neckLen = (L.neck ?? 1) * (1 + g * 0.25);
  const base: P = [len * 0.4, top + depth * 0.18];
  const poll: P = add(base, [Math.cos(neckUp), -Math.sin(neckUp)], neckLen + depth * 0.15);
  const hd = L.headDepth ?? 1, hl = L.head ?? 2;
  const down = rad(lerp(L.headDown ?? 20, 80, g));
  const d: P = [Math.cos(down), Math.sin(down)], nrm: P = [-Math.sin(down), Math.cos(down)]; // along the head; across it, towards the throat
  const nose = add(poll, d, hl);
  const brow = add(add(poll, d, hl * 0.35), nrm, -hd * 0.12);
  const muzzleTop = add(add(nose, d, -hl * 0.12), nrm, hd * 0.05);
  const chin = add(add(nose, d, -hl * 0.18), nrm, hd * (column ? 0.5 : 0.62));
  const jaw = add(add(poll, d, hl * 0.3), nrm, hd * 1.0);
  const throat = add(add(poll, d, -hl * 0.02), nrm, hd * 0.9);
  const chest: P = [len * 0.52, top + depth * 0.62];
  const brisket: P = [len * 0.4, -legH + depth * 0.02];
  const belly: P = [0, -legH + depth * (column ? 0.1 : 0.05)];
  const flank: P = [-len * 0.36, -legH + depth * 0.12];
  const haunch: P = [-len * 0.54, top + depth * 0.5];
  const back: P[] = humpBack
    ? [R, [-len * 0.25, top - hump * 0.3], [-len * 0.05, top - hump], [len * 0.15, top - hump * 0.25], W]
    : [R, [-len * 0.1, top + depth * (hump ? 0.06 : 0.02)], W];
  const outline: P[] = [...back, add(poll, nrm, -hd * 0.25), brow, muzzleTop, nose, chin, jaw, throat, chest, brisket, belly, flank, haunch];
  const body = (): void => smooth(ctx, outline);

  shadow(ctx, len * 0.05, len * 0.6);

  // legs: diagonal pairs swing together; the far pair is drawn first, darker
  const stride = legH * 0.32, ph = p.gait * Math.PI * 2;
  const legW = column ? len * 0.13 : Math.max(depth * 0.3, len * 0.07);
  const legs: { x: number; front: boolean; far: boolean; off: number }[] = [
    { x: len * 0.3, front: true, far: true, off: Math.PI }, { x: -len * 0.32, front: false, far: true, off: 0 },
    { x: len * 0.36, front: true, far: false, off: 0 }, { x: -len * 0.26, front: false, far: false, off: Math.PI },
  ];
  const legPaths: (() => void)[] = [];
  for (const l of legs) {
    const s = moving ? Math.sin(ph + l.off) : 0, lift = moving ? Math.max(0, Math.cos(ph + l.off)) * legH * 0.14 : 0;
    const foot: P = [l.x + s * stride, -lift];
    const hip: P = [l.x - (l.front ? 0 : len * 0.04), -legH - depth * 0.35];
    // the front knee bends back when the foot lifts; the hind leg has its hock behind
    const joint: P = l.front
      ? [lerp(hip[0], foot[0], 0.55) - lift * 0.6, -legH * 0.45]
      : [lerp(hip[0], foot[0], 0.6) - (column ? 0 : legH * 0.14) - lift * 0.3, -legH * (column ? 0.45 : 0.36)];
    const wTop = legW * (l.front ? 1 : 1.35), wMid = column ? legW * 0.95 : legW * 0.5, wFoot = column ? legW * 0.95 : legW * 0.36;
    const side = (p: P, q: P, w: number): P => { const dx = q[0] - p[0], dy = q[1] - p[1], m = Math.hypot(dx, dy) || 1; return [-dy / m * w / 2, dx / m * w / 2]; };
    const n1 = side(hip, joint, wTop), n2 = side(hip, foot, wMid), n3 = side(joint, foot, wFoot);
    const path = (): void => {
      ctx.moveTo(hip[0] + n1[0], hip[1] + n1[1]);
      ctx.lineTo(joint[0] + n2[0], joint[1] + n2[1]);
      ctx.lineTo(foot[0] + n3[0], foot[1] + n3[1]);
      ctx.lineTo(foot[0] - n3[0], foot[1] - n3[1]);
      ctx.lineTo(joint[0] - n2[0], joint[1] - n2[1]);
      ctx.lineTo(hip[0] - n1[0], hip[1] - n1[1]);
      ctx.closePath();
    };
    inked(ctx, pen, wash(c, l.far ? 0.72 : 0.95), path);
    if (l.far) { ctx.save(); ctx.beginPath(); path(); ctx.clip(); hatch(ctx, foot[0] - legW * 2, -legH - depth * 0.4, foot[0] + legW * 2, 0, pen.gap * 0.8, pen.fine); ctx.restore(); }
    // hooves, pads, paws
    ctx.fillStyle = L.feet === 'hoof' ? INK : wash(c, 0.6);
    ctx.beginPath(); ctx.ellipse(foot[0] + (column ? 0 : wFoot * 0.4), foot[1] - wFoot * 0.4, wFoot * (column ? 0.55 : 0.75), wFoot * 0.45, 0, 0, Math.PI * 2); ctx.fill();
    legPaths.push(path);
  }

  // the tail, behind the haunch
  tail(ctx, L, haunch, p.sway, pen, depth);
  // a lion's mane lies behind the head
  if (L.mane === 'lion') {
    const m = add(poll, d, hl * 0.12), r = hd * 1.25;
    const pts: P[] = [];
    for (let k = 0; k < 18; k++) { const an = k / 18 * Math.PI * 2, rr = r * (k % 2 ? 0.82 : 1.08); pts.push([m[0] + Math.cos(an) * rr - r * 0.2, m[1] + Math.sin(an) * rr * 1.05]); }
    inked(ctx, pen, wash([150, 96, 44]), () => smooth(ctx, pts));
    ctx.save(); ctx.beginPath(); smooth(ctx, pts); ctx.clip(); hatch(ctx, m[0] - r * 2, m[1] - r * 1.2, m[0] + r, m[1] + r * 1.2, pen.gap, pen.fine, 0.6); ctx.restore();
  }

  // the body: wash, markings, shading, contour
  ctx.beginPath(); body(); ctx.fillStyle = wash(c); ctx.fill();
  ctx.save(); ctx.beginPath(); body(); ctx.clip();
  if (L.saddle) { ctx.fillStyle = wash(L.saddle); ctx.beginPath(); ctx.ellipse(-len * 0.1, top + depth * 0.4, len * 0.33, depth * 0.75, 0, 0, Math.PI * 2); ctx.fill(); }
  if (L.bib) { ctx.fillStyle = wash(L.bib); ctx.beginPath(); ctx.ellipse(chest[0], (chest[1] + throat[1]) / 2, depth * 0.4, Math.abs(throat[1] - chest[1]) * 0.7 + depth * 0.2, -0.4, 0, Math.PI * 2); ctx.fill(); }
  if (L.flank) { ctx.strokeStyle = wash([90, 60, 40]); ctx.lineWidth = depth * 0.12; ctx.beginPath(); ctx.moveTo(-len * 0.42, top + depth * 0.6); ctx.quadraticCurveTo(0, top + depth * 0.75, len * 0.38, top + depth * 0.62); ctx.stroke(); ctx.fillStyle = wash([248, 244, 236]); ctx.beginPath(); ctx.ellipse(0, -legH + depth * 0.05, len * 0.42, depth * 0.22, 0, 0, Math.PI * 2); ctx.fill(); }
  if (L.face) { ctx.fillStyle = wash(L.face); ctx.beginPath(); ctx.ellipse(...add(poll, d, hl * 0.62), hl * 0.42, hd * 0.42, down, 0, Math.PI * 2); ctx.fill(); }
  if (L.stripes) {
    ctx.strokeStyle = INK; ctx.lineWidth = len * 0.04;
    ctx.beginPath();
    for (let k = 0; k < 11; k++) { const sx = -len * 0.55 + k * len * 0.095; ctx.moveTo(sx, top - 2); ctx.quadraticCurveTo(sx + len * 0.06 * (k > 6 ? 1 : -1), top + depth * 0.5, sx - len * 0.02, -legH + depth * 0.15); }
    for (let k = 1; k < 6; k++) { const p = add(base, [Math.cos(neckUp), -Math.sin(neckUp)], (neckLen + depth * 0.15) * k / 6), q: P = [Math.sin(neckUp), Math.cos(neckUp)]; ctx.moveTo(...add(p, q, -depth * 0.5)); ctx.lineTo(...add(p, q, depth * 0.6)); }
    for (let k = 1; k < 4; k++) { const p = add(poll, d, hl * k * 0.18); ctx.moveTo(...add(p, nrm, -hd * 0.5)); ctx.lineTo(...add(p, nrm, hd)); }
    ctx.stroke();
  }
  if (L.spots) {
    ctx.strokeStyle = wash([60, 40, 26]); ctx.lineWidth = len * 0.022; ctx.fillStyle = wash([150, 100, 50]);
    for (let k = 0; k < 26; k++) {
      const sx = -len * 0.5 + (k * 0.618 % 1) * len * 1.0, sy = top + depth * (0.1 + (Math.sin(k * 12.9898) * 43758.5453 % 1 + 1) % 1 * 0.7), r = len * 0.022;
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
  }
  // shading: the belly, the underside of the neck, the haunch
  hatch(ctx, -len, top + depth * 0.62, len, -legH + depth * 0.3, pen.gap, pen.fine);
  hatch(ctx, -len * 0.62, top, -len * 0.38, -legH + depth * 0.3, pen.gap * 1.2, pen.fine, 0.35);
  if (L.bristles) { ctx.strokeStyle = INK; ctx.lineWidth = pen.fine; ctx.beginPath(); for (let k = 0; k < 9; k++) { const sx = -len * 0.1 + k * len * 0.06; ctx.moveTo(sx, top + 0.1); ctx.lineTo(sx - 0.25, top - 0.45 - (k > 2 && k < 7 ? 0.25 : 0)); } ctx.stroke(); }
  ctx.restore();
  ctx.beginPath(); body(); ctx.strokeStyle = INK; ctx.lineWidth = pen.line; ctx.stroke();
  // a fold of the shoulder and the haunch, as engravers draw them
  ctx.lineWidth = pen.fine; ctx.beginPath();
  ctx.moveTo(len * 0.22, top + depth * 0.25); ctx.quadraticCurveTo(len * 0.3, top + depth * 0.6, len * 0.24, -legH + depth * 0.1);
  ctx.moveTo(-len * 0.2, top + depth * 0.2); ctx.quadraticCurveTo(-len * 0.4, top + depth * 0.5, -len * 0.3, -legH + depth * 0.15);
  ctx.stroke();

  if (L.mane === 'short') { // a zebra's brush of a mane along the neck
    ctx.strokeStyle = INK; ctx.lineWidth = len * 0.05; ctx.beginPath();
    const mTop = add(poll, nrm, -hd * 0.3);
    ctx.moveTo(W[0] - len * 0.02, W[1] - 0.2); ctx.lineTo(mTop[0], mTop[1]); ctx.stroke();
  }
  // the head's details
  const eye = add(add(poll, d, hl * 0.32), nrm, hd * 0.22);
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(eye[0], eye[1], Math.max(0.16, hd * 0.09), 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = pen.fine; ctx.beginPath();
  const mouth = add(add(nose, d, -hl * 0.2), nrm, hd * 0.42);
  ctx.moveTo(...mouth); ctx.lineTo(...add(mouth, d, -hl * 0.15)); ctx.stroke();
  if (L.feet === 'hoof' || L.feet === 'pad') { ctx.beginPath(); ctx.arc(...add(add(nose, d, -hl * 0.06), nrm, hd * 0.12), hd * 0.06, 0, Math.PI * 2); ctx.fill(); }
  if (L.beard) { inked(ctx, pen, wash(c, 0.6), () => { const b0 = add(chin, d, -hl * 0.15); ctx.moveTo(...b0); ctx.lineTo(...add(b0, nrm, L.beard!)); ctx.lineTo(...add(b0, d, -hl * 0.18)); ctx.closePath(); }); }
  if (L.trunk) {
    const t0 = add(nose, nrm, hd * 0.2), sw = p.sway * 0.25;
    const t1 = add(t0, [Math.cos(down + 0.5 + sw), Math.sin(down + 0.5 + sw)], L.trunk * 0.55), t2 = add(t1, [Math.cos(down + 0.2 - sw), Math.sin(down + 0.2 - sw)], L.trunk * 0.5);
    const w = column ? hd * 0.3 : hd * 0.32;
    ctx.save(); ctx.lineCap = 'round';
    ctx.strokeStyle = INK; ctx.lineWidth = w + pen.line * 2;
    ctx.beginPath(); ctx.moveTo(...t0); ctx.quadraticCurveTo(...t1, ...t2); ctx.stroke();
    ctx.strokeStyle = wash(c); ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(...add(t0, d, -w * 0.6)); ctx.quadraticCurveTo(...t1, ...t2); ctx.stroke();
    ctx.restore();
    if (column && shading > 0.3) { // rings on the trunk
      ctx.strokeStyle = INK; ctx.lineWidth = pen.fine; ctx.beginPath();
      for (let k = 1; k < 7; k++) { const f = k / 7, p = add(add(t0, [t1[0] - t0[0], t1[1] - t0[1]], 2 * f * (1 - f)), [t2[0] - t0[0], t2[1] - t0[1]], f * f); ctx.moveTo(p[0] - w * 0.4, p[1]); ctx.lineTo(p[0] + w * 0.4, p[1]); }
      ctx.stroke();
    }
  }
  if (L.tusks) {
    const t0 = add(add(nose, d, -hl * (column ? 0.15 : 0.1)), nrm, hd * 0.45), T = L.tusks;
    ctx.save(); ctx.lineCap = 'round';
    ctx.strokeStyle = INK; ctx.lineWidth = (column ? 0.55 : 0.32) + pen.line * 2; ctx.beginPath(); ctx.moveTo(...t0); ctx.quadraticCurveTo(t0[0] + T * 0.7, t0[1] + T * 0.3, t0[0] + T * 0.9, t0[1] - T * (column ? 0.15 : 0.5)); ctx.stroke();
    ctx.strokeStyle = 'rgb(244,236,214)'; ctx.lineWidth = column ? 0.55 : 0.32; ctx.stroke();
    ctx.restore();
  }
  // ears
  const ear0 = add(add(poll, d, hl * 0.08), nrm, -hd * 0.05), es = L.earSize ?? 1;
  if (L.ears === 'flap') {
    const e0 = add(poll, d, hl * 0.18);
    const pts: P[] = [e0, [e0[0] - es * 0.6, e0[1] - es * 0.15], [e0[0] - es * 0.85, e0[1] + es * 0.5], [e0[0] - es * 0.5, e0[1] + es * 1.05], [e0[0] - es * 0.05, e0[1] + es * 0.9], [e0[0] + es * 0.12, e0[1] + es * 0.35]];
    inked(ctx, pen, wash(c, 0.92), () => smooth(ctx, pts));
    ctx.save(); ctx.beginPath(); smooth(ctx, pts); ctx.clip(); hatch(ctx, e0[0] - es, e0[1] + es * 0.4, e0[0] + es * 0.2, e0[1] + es * 1.1, pen.gap, pen.fine); ctx.restore();
  } else if (L.ears === 'round') {
    inked(ctx, pen, wash(c, 0.85), () => ctx.arc(ear0[0] - es * 0.2, ear0[1] - es * 0.2, es * 0.5, 0, Math.PI * 2));
  } else if (L.ears === 'point') {
    const tipA = add(ear0, [Math.cos(down - 2.1), Math.sin(down - 2.1)], es * 1.3);
    inked(ctx, pen, wash(c, 0.85), () => { ctx.moveTo(...add(ear0, d, es * 0.3)); ctx.quadraticCurveTo(...add(tipA, d, es * 0.25), ...tipA); ctx.quadraticCurveTo(...add(ear0, d, -es * 0.2), ...add(ear0, d, -es * 0.35)); ctx.closePath(); });
  }
  if (L.antlers) antlers(ctx, add(add(poll, d, hl * 0.12), nrm, -hd * 0.2), L.antlers, pen);
  if (L.horns) horns(ctx, L.horns, add(add(poll, d, hl * 0.18), nrm, -hd * 0.25), L.hornLen ?? 2, down, pen);
}

function tail(ctx: CanvasRenderingContext2D, L: Look, at: P, sway: number, pen: Pen, depth: number): void {
  const T = L.tailLen ?? 1, c = L.color, sw = sway * 0.15;
  const root: P = [at[0] + 0.15, at[1] - depth * 0.25];
  switch (L.tail) {
    case 'bush': { // a fox's or a wolf's brush, carried low
      const a1 = 2.75 + sw, tip = add(root, [Math.cos(a1), Math.sin(a1)], T);
      const mid = add(root, [Math.cos(a1 - 0.25), Math.sin(a1 - 0.25)], T * 0.55), w = T * 0.2;
      const pts: P[] = [root, add(mid, [0, -w]), add(tip, [0, -w * 0.3]), tip, add(tip, [w * 0.2, w * 0.3]), add(mid, [0, w]), [root[0], root[1] + w * 0.8]];
      inked(ctx, pen, wash(c, 0.9), () => smooth(ctx, pts));
      ctx.save(); ctx.beginPath(); smooth(ctx, pts); ctx.clip();
      hatch(ctx, tip[0] - 1, mid[1], root[0], mid[1] + w * 1.5, pen.gap, pen.fine);
      if (L.tip) { ctx.fillStyle = wash(L.tip); ctx.beginPath(); ctx.arc(tip[0], tip[1], T * 0.18, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
      break;
    }
    case 'curl': { // a monkey's tail, raised in a question mark
      ctx.strokeStyle = INK; ctx.lineWidth = 0.35 + pen.line;
      ctx.beginPath(); ctx.moveTo(...root);
      ctx.bezierCurveTo(root[0] - T * 0.5, root[1] - T * 0.1, root[0] - T * 0.55, root[1] - T * 0.9, root[0] - T * 0.2 + sw, root[1] - T * 0.85);
      ctx.quadraticCurveTo(root[0] - T * 0.05, root[1] - T * 0.7, root[0] - T * 0.2, root[1] - T * 0.6);
      ctx.stroke(); ctx.strokeStyle = wash(c); ctx.lineWidth = 0.35; ctx.stroke();
      break;
    }
    case 'short': {
      inked(ctx, pen, wash(c, 0.9), () => { ctx.moveTo(root[0], root[1] - 0.2); ctx.quadraticCurveTo(root[0] - T, root[1] - T * 0.6 + sw, root[0] - T * 0.6, root[1] + T * 0.3); ctx.lineTo(root[0], root[1] + 0.3); ctx.closePath(); });
      break;
    }
    default: { // thin, with or without a tuft
      const a1 = 1.9 + sw, k = L.tail === 'tuft' ? 0.85 : 1;
      const end = add(root, [Math.cos(a1) * 0.8, Math.sin(a1)], T * k);
      ctx.strokeStyle = INK; ctx.lineWidth = 0.28 + pen.line * 2;
      ctx.beginPath(); ctx.moveTo(...root); ctx.quadraticCurveTo(root[0] - T * 0.45, root[1] + T * 0.05, end[0], end[1]); ctx.stroke();
      ctx.strokeStyle = wash(c, 0.9); ctx.lineWidth = 0.28; ctx.stroke();
      if (L.tail === 'tuft') { ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(end[0], end[1] + T * 0.08, T * 0.07 + 0.15, T * 0.13 + 0.2, 0.3, 0, Math.PI * 2); ctx.fill(); }
    }
  }
}

function antlers(ctx: CanvasRenderingContext2D, at: P, A: number, pen: Pen): void {
  // two beams sweeping up and back from the brow, tines rising forward and up from each
  const draw = (w: number, style: string, dx: number): void => {
    ctx.strokeStyle = style; ctx.lineWidth = w;
    const b0: P = [at[0] + dx, at[1]], b1: P = [b0[0] - A * 0.6, b0[1] - A * 0.45], b2: P = [b0[0] - A * 0.55, b0[1] - A * 1.0];
    ctx.beginPath(); ctx.moveTo(...b0); ctx.quadraticCurveTo(...b1, ...b2);
    for (const [f, l] of [[0.18, 0.38], [0.45, 0.42], [0.72, 0.32]]) {
      const p: P = [lerp(lerp(b0[0], b1[0], f), lerp(b1[0], b2[0], f), f), lerp(lerp(b0[1], b1[1], f), lerp(b1[1], b2[1], f), f)];
      ctx.moveTo(...p); ctx.quadraticCurveTo(p[0] + A * l * 0.75, p[1] - A * l * 0.1, p[0] + A * l * 0.95, p[1] - A * l * 0.6);
    }
    ctx.stroke();
  };
  for (const [dx, k] of [[-A * 0.12, 0.8], [0, 1]]) {
    draw(A * 0.08 + pen.line * 2, INK, dx);
    draw(A * 0.08, k < 1 ? 'rgb(176,156,120)' : 'rgb(214,196,160)', dx);
  }
}

function horns(ctx: CanvasRenderingContext2D, kind: 'lyre' | 'curve', at: P, H: number, down: number, pen: Pen): void {
  ctx.save(); ctx.lineCap = 'round';
  const path = (): void => {
    ctx.beginPath(); ctx.moveTo(...at);
    if (kind === 'curve') ctx.bezierCurveTo(at[0] - H * 0.1, at[1] - H * 0.6, at[0] - H * 0.7, at[1] - H * 0.8, at[0] - H * 0.85, at[1] - H * 0.2); // the ibex's great scimitar
    else ctx.bezierCurveTo(at[0] - H * 0.35, at[1] - H * 0.45, at[0] + H * 0.05, at[1] - H * 0.75, at[0] - H * 0.1 + Math.cos(down) * 0, at[1] - H); // the gazelle's lyre
  };
  const w = kind === 'curve' ? H * 0.13 : H * 0.07;
  path(); ctx.strokeStyle = INK; ctx.lineWidth = w + pen.line * 2; ctx.stroke();
  path(); ctx.strokeStyle = 'rgb(176,160,130)'; ctx.lineWidth = w; ctx.stroke();
  // the ridges of the horn
  ctx.strokeStyle = INK; ctx.lineWidth = pen.fine; ctx.setLineDash([pen.fine * 1.5, H * 0.08]); path(); ctx.stroke(); ctx.setLineDash([]);
  ctx.restore();
}

// ---- rabbits, hares and marmots ----

function hopper(ctx: CanvasRenderingContext2D, L: Look, p: Pose, pen: Pen): void {
  const len = L.len, c = L.color, moving = p.moving;
  const hopT = p.gait, hop = moving ? Math.sin(hopT * Math.PI) * len * 0.45 : 0, stretch = moving ? Math.sin(hopT * Math.PI) * 0.25 : 0;
  // a marmot stands up on its haunches to watch, now and then
  const up = p.up;
  shadow(ctx, 0, len * 0.5);
  ctx.save();
  ctx.translate(0, -hop);
  ctx.rotate(-up * 1.05);
  ctx.translate(up * len * 0.35, 0);
  const h = len * 0.62, sx = 1 + stretch;
  const pts: P[] = [
    [-len * 0.5 * sx, -h * 0.35], [-len * 0.38 * sx, -h * 0.85], [-len * 0.05, -h * 0.98], [len * 0.25 * sx, -h * 0.8],
    [len * 0.42 * sx, -h * 1.05], [len * 0.62 * sx, -h * 0.95], [len * 0.66 * sx, -h * 0.72], [len * 0.45 * sx, -h * 0.55],
    [len * 0.3 * sx, -h * 0.1], [len * 0.05, -h * 0.05], [-len * 0.3 * sx, -0.05], [-len * 0.48 * sx, -h * 0.08],
  ];
  // the ears behind the head
  const E = typeof L.ears === 'number' ? L.ears : 1;
  const ear = (dx: number, dark: number, tilt: number): void => {
    const e0: P = [len * (0.42 + dx) * sx, -h * 1.0];
    inked(ctx, pen, wash(c, dark), () => ctx.ellipse(e0[0] - E * 0.3 * Math.sin(tilt), e0[1] - E * 0.45, Math.max(0.25, len * 0.07), E * 0.5, -tilt, 0, Math.PI * 2));
  };
  if (E > 1) ear(-0.06, 0.75, 0.5 + (moving ? 0.3 : p.sway * 0.1));
  // the hind foot, long and flat
  inked(ctx, pen, wash(c, 0.85), () => ctx.ellipse(-len * 0.2, -0.2, len * 0.28 * (1 + stretch * 1.4), len * 0.07, 0, 0, Math.PI * 2));
  ctx.beginPath(); smooth(ctx, pts); ctx.fillStyle = wash(c); ctx.fill();
  ctx.save(); ctx.clip(); hatch(ctx, -len, -h * 0.45, len, 0, pen.gap, pen.fine); ctx.restore();
  ctx.beginPath(); smooth(ctx, pts); ctx.strokeStyle = INK; ctx.lineWidth = pen.line; ctx.stroke();
  // the haunch fold, the front paw, the scut, the eye, the ear
  ctx.lineWidth = pen.fine; ctx.beginPath(); ctx.arc(-len * 0.18, -h * 0.4, h * 0.38, Math.PI * 0.6, Math.PI * 1.5); ctx.stroke();
  inked(ctx, pen, wash(c, 0.9), () => ctx.ellipse(len * 0.36 * sx + stretch * len * 0.3, -0.25, len * 0.1, len * 0.06, 0, 0, Math.PI * 2));
  if (L.tailColor) inked(ctx, pen, wash(L.tailColor), () => ctx.arc(-len * 0.5 * sx, -h * 0.5, len * (L.sits ? 0.09 : 0.12), 0, Math.PI * 2));
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(len * 0.52 * sx, -h * 0.88, Math.max(0.15, len * 0.045), 0, Math.PI * 2); ctx.fill();
  if (E > 1) ear(0.02, 0.95, 0.3 + (moving ? 0.35 : -p.sway * 0.12));
  else inked(ctx, pen, wash(c, 0.8), () => ctx.arc(len * 0.36 * sx, -h * 1.0, E * 0.6 + 0.15, 0, Math.PI * 2));
  ctx.restore();
}

// ---- the sea and the ice ----

/** A whale's back rolling out of the sea, its spout now and then, its flukes when it dives. */
function whale(ctx: CanvasRenderingContext2D, L: Look, p: Pose, pen: Pen): void {
  const len = L.len, c = L.color, cyc = p.cycle; // surfaces, breathes, dives
  if (cyc > 0.75) return; // under water
  const up = Math.sin(Math.min(1, cyc / 0.55) * Math.PI) * (cyc < 0.55 ? 1 : 0), hb = len * 0.14 * up;
  // ripples: engraved horizontal strokes around the back
  ctx.strokeStyle = 'rgba(40,70,90,.7)'; ctx.lineWidth = pen.fine; ctx.beginPath();
  for (const [dx, dy, w] of [[-0.7, 0.05, 0.25], [0.55, 0.06, 0.3], [-0.2, 0.12, 0.45], [0.1, -0.04, 0.2]] as [number, number, number][]) { ctx.moveTo((dx - w / 2) * len, dy * len); ctx.lineTo((dx + w / 2) * len, dy * len); }
  ctx.stroke();
  if (hb > 0.2) {
    const pts: P[] = [[-len * 0.5, 0], [-len * 0.2, -hb * 0.8], [len * 0.05, -hb * 0.9], [len * 0.12, -hb * 1.35], [len * 0.17, -hb * 0.95], [len * 0.42, -hb * 0.6], [len * 0.5, 0]];
    ctx.beginPath(); smooth(ctx, pts, false); ctx.closePath(); ctx.fillStyle = wash(c); ctx.fill();
    ctx.save(); ctx.clip(); hatch(ctx, -len * 0.6, -hb * 0.45, len * 0.6, 0, pen.gap, pen.fine, 0.6); ctx.restore();
    ctx.beginPath(); smooth(ctx, pts, false); ctx.strokeStyle = INK; ctx.lineWidth = pen.line; ctx.stroke();
    ctx.strokeStyle = 'rgba(250,252,255,.8)'; ctx.lineWidth = pen.line * 1.5; ctx.beginPath(); ctx.moveTo(-len * 0.55, 0); ctx.lineTo(len * 0.55, 0); ctx.stroke();
  }
  if (cyc > 0.55) { // the flukes as it dives
    const f = (cyc - 0.55) / 0.2, fy = -len * 0.28 * Math.sin(f * Math.PI), x = -len * 0.1;
    const pts: P[] = [[x - len * 0.03, 0], [x - len * 0.02, fy * 0.55], [x - len * 0.2, fy - len * 0.04], [x - len * 0.17, fy + len * 0.02], [x, fy * 0.95], [x + len * 0.17, fy + len * 0.02], [x + len * 0.2, fy - len * 0.04], [x + len * 0.02, fy * 0.55], [x + len * 0.03, 0]];
    inked(ctx, pen, wash(c, 0.9), () => { ctx.moveTo(...pts[0]); for (const p of pts.slice(1)) ctx.lineTo(...p); ctx.closePath(); });
  }
  if (cyc > 0.18 && cyc < 0.34) { // the spout, a fan of spray
    const s = (cyc - 0.18) / 0.16, sx = len * 0.25, top = -hb - len * 0.4 * Math.min(1, s * 2.5);
    ctx.save(); ctx.globalAlpha = 1 - s; ctx.strokeStyle = 'rgba(70,100,120,.8)'; ctx.lineWidth = pen.fine;
    ctx.beginPath();
    for (const k of [-1, -0.5, 0, 0.5, 1]) { ctx.moveTo(sx, -hb); ctx.quadraticCurveTo(sx + k * len * 0.03, top, sx + k * len * 0.14, top + len * 0.14 * Math.abs(k) + len * 0.04); }
    ctx.stroke(); ctx.restore();
  }
}

/** A seal lying on the ice, raising its head now and then. */
function seal(ctx: CanvasRenderingContext2D, L: Look, p: Pose, pen: Pen): void {
  const len = L.len, c = L.color, lift = p.up * len * 0.18;
  shadow(ctx, 0, len * 0.55);
  const pts: P[] = [
    [-len * 0.5, -len * 0.06], [-len * 0.3, -len * 0.2], [len * 0.05, -len * 0.25], [len * 0.28, -len * 0.25 - lift * 0.6],
    [len * 0.42, -len * 0.27 - lift], [len * 0.52, -len * 0.21 - lift], [len * 0.46, -len * 0.15 - lift * 0.7], [len * 0.3, -len * 0.08], [0, -len * 0.01], [-len * 0.4, -len * 0.01],
  ];
  // hind flippers
  inked(ctx, pen, wash(c, 0.75), () => { ctx.moveTo(-len * 0.46, -len * 0.05); ctx.lineTo(-len * 0.66, -len * 0.16); ctx.quadraticCurveTo(-len * 0.62, -len * 0.05, -len * 0.68, len * 0.01); ctx.closePath(); });
  ctx.beginPath(); smooth(ctx, pts); ctx.fillStyle = wash(c); ctx.fill();
  ctx.save(); ctx.clip();
  ctx.fillStyle = wash(c, 0.62); for (let k = 0; k < 9; k++) { ctx.beginPath(); ctx.arc(-len * 0.35 + k * len * 0.08, -len * (0.12 + (k * 0.37 % 1) * 0.08), len * 0.018, 0, Math.PI * 2); ctx.fill(); }
  hatch(ctx, -len * 0.6, -len * 0.08, len * 0.6, 0, pen.gap, pen.fine);
  ctx.restore();
  ctx.beginPath(); smooth(ctx, pts); ctx.strokeStyle = INK; ctx.lineWidth = pen.line; ctx.stroke();
  // fore flipper, eye, whiskers
  inked(ctx, pen, wash(c, 0.8), () => ctx.ellipse(len * 0.18, -len * 0.04, len * 0.09, len * 0.035, 0.5, 0, Math.PI * 2));
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(len * 0.43, -len * 0.23 - lift, len * 0.022, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = pen.fine; ctx.beginPath(); ctx.moveTo(len * 0.5, -len * 0.18 - lift); ctx.lineTo(len * 0.6, -len * 0.2 - lift); ctx.moveTo(len * 0.5, -len * 0.17 - lift); ctx.lineTo(len * 0.59, -len * 0.14 - lift); ctx.stroke();
}

// ---- creatures of the night ----

/** A bat, seen from below-side: jagged membrane wings that beat fast. */
function bat(ctx: CanvasRenderingContext2D, L: Look, p: Pose, pen: Pen): void {
  const s = L.len, c = L.color, f = Math.sin(p.gait * Math.PI * 2); // wings up (1) … down (-1)
  const wing = (side: number): void => {
    const tipY = -f * s * 0.9, span = s * 1.6 * (0.75 + 0.25 * Math.abs(f));
    inked(ctx, pen, wash(c, 0.9), () => {
      ctx.moveTo(0, -s * 0.15);
      ctx.lineTo(side * span * 0.45, tipY * 0.7 - s * 0.2);
      ctx.lineTo(side * span, tipY);
      // the scalloped trailing edge, between the finger bones
      ctx.quadraticCurveTo(side * span * 0.85, tipY * 0.5 + s * 0.15, side * span * 0.7, tipY * 0.45 + s * 0.25);
      ctx.quadraticCurveTo(side * span * 0.55, tipY * 0.35 + s * 0.05, side * span * 0.4, tipY * 0.3 + s * 0.3);
      ctx.quadraticCurveTo(side * span * 0.25, s * 0.1, 0, s * 0.15);
      ctx.closePath();
    });
  };
  wing(-1); wing(1);
  inked(ctx, pen, wash(c, 0.7), () => ctx.ellipse(0, 0, s * 0.18, s * 0.32, 0, 0, Math.PI * 2));
  inked(ctx, pen, wash(c, 0.7), () => { ctx.moveTo(-s * 0.12, -s * 0.3); ctx.lineTo(-s * 0.16, -s * 0.52); ctx.lineTo(0, -s * 0.36); ctx.lineTo(s * 0.16, -s * 0.52); ctx.lineTo(s * 0.12, -s * 0.3); ctx.closePath(); });
}

/** An owl in flight: broad rounded wings, a round head, gliding mostly. */
function owl(ctx: CanvasRenderingContext2D, L: Look, p: Pose, pen: Pen): void {
  const s = L.len, c = L.color, f = Math.sin(p.gait * Math.PI * 2);
  const wing = (side: number, k: number): void => {
    const tipY = -f * s * 0.6 - s * 0.1, span = s * 1.5;
    const pts: [number, number][] = [[side * s * 0.15, -s * 0.2], [side * span * 0.5, tipY * 0.8 - s * 0.25], [side * span, tipY], [side * span * 0.95, tipY + s * 0.25], [side * span * 0.5, tipY * 0.4 + s * 0.2], [side * s * 0.15, s * 0.1]];
    inked(ctx, pen, wash(c, k), () => smooth(ctx, pts));
    ctx.save(); ctx.beginPath(); smooth(ctx, pts); ctx.clip();
    ctx.strokeStyle = INK; ctx.lineWidth = pen.fine; ctx.beginPath(); // the bars on the feathers
    for (let j = 1; j < 5; j++) { const x = side * span * j / 5; ctx.moveTo(x, tipY * j / 5 - s * 0.4); ctx.lineTo(x + side * s * 0.1, tipY * j / 5 + s * 0.3); }
    ctx.stroke(); ctx.restore();
  };
  wing(-1, 0.75);
  inked(ctx, pen, wash(c), () => ctx.ellipse(0, 0, s * 0.42, s * 0.24, 0, 0, Math.PI * 2)); // body
  inked(ctx, pen, wash(c, 0.6), () => { ctx.moveTo(-s * 0.4, -s * 0.05); ctx.lineTo(-s * 0.7, -s * 0.12); ctx.lineTo(-s * 0.7, s * 0.1); ctx.closePath(); }); // tail
  inked(ctx, pen, wash(c, 1.05), () => ctx.arc(s * 0.38, -s * 0.18, s * 0.2, 0, Math.PI * 2)); // head
  inked(ctx, pen, wash([236, 226, 200]), () => ctx.arc(s * 0.44, -s * 0.17, s * 0.12, 0, Math.PI * 2)); // the pale face disc
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(s * 0.48, -s * 0.19, s * 0.035, 0, Math.PI * 2); ctx.fill();
  wing(1, 1);
}

/** A hedgehog trotting on tiny legs, all prickles, its snout up to sniff. */
function hedgehog(ctx: CanvasRenderingContext2D, L: Look, p: Pose, pen: Pen): void {
  const s = L.len, c = L.color, step = p.moving ? Math.sin(p.gait * Math.PI * 2) * s * 0.06 : 0;
  shadow(ctx, 0, s * 0.5);
  ctx.strokeStyle = INK; ctx.lineWidth = s * 0.07;
  ctx.beginPath(); for (const [x, d] of [[-0.25, 1], [0.2, -1]] as [number, number][]) { ctx.moveTo(s * x, -s * 0.15); ctx.lineTo(s * x + step * d, 0); } ctx.stroke();
  const back: [number, number][] = [[-s * 0.5, -s * 0.12], [-s * 0.42, -s * 0.42], [-s * 0.1, -s * 0.58], [s * 0.25, -s * 0.48], [s * 0.4, -s * 0.25], [s * 0.3, -s * 0.12], [-s * 0.1, -s * 0.1]];
  inked(ctx, pen, wash(c), () => smooth(ctx, back));
  // the spines: short strokes all over the back, pointing back
  ctx.strokeStyle = INK; ctx.lineWidth = pen.fine * 1.2; ctx.beginPath();
  for (let k = 0; k < 26; k++) {
    const u = (k * 0.618) % 1, v = (k * 0.381) % 1, x = -s * 0.42 + u * s * 0.75, y = -s * (0.18 + v * 0.36) - Math.sin(u * Math.PI) * s * 0.06;
    ctx.moveTo(x, y); ctx.lineTo(x - s * 0.12, y - s * 0.05);
  }
  ctx.stroke();
  const lift = p.up * s * 0.06;
  inked(ctx, pen, wash([196, 170, 140]), () => { ctx.moveTo(s * 0.28, -s * 0.38); ctx.quadraticCurveTo(s * 0.5, -s * 0.32 - lift, s * 0.62, -s * 0.22 - lift); ctx.quadraticCurveTo(s * 0.45, -s * 0.1, s * 0.25, -s * 0.12); ctx.closePath(); });
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.arc(s * 0.62, -s * 0.22 - lift, s * 0.04, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(s * 0.42, -s * 0.28 - lift * 0.5, s * 0.03, 0, Math.PI * 2); ctx.fill();
}
