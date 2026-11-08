// A Canvas 2D look-alike that draws with the GPU (Phaser WebGL): the map's overlay keeps its
// drawing code (paths, text, images, glows) and every frame becomes a handful of Graphics
// batches, images and cached textures instead of a full-screen canvas painted by the processor
// and uploaded again (the cost that made big screens and Firefox slow).
//
// What it understands, as the overlay uses it: paths (lines, quadratic and Bézier curves,
// arcs, ellipses, rectangles) stroked or filled, dashes, transforms, global alpha, colours,
// radial gradients (drawn as a tinted soft glow), text (rendered once into a texture), and
// images (each source becomes a texture; a canvas marked dynamic is uploaded again when drawn).
// Not supported: clip and composite operations (the overlay uses them only on its own small
// canvases: the fog and the clouds' pictures).
import Phaser from 'phaser';

type M = [number, number, number, number, number, number];
interface RGBA { c: number; a: number }
interface Sub { pts: number[]; closed: boolean; circle?: [number, number, number] }

const colours = new Map<string, RGBA>();
/** A CSS colour as Phaser wants it: 0xRRGGBB and an alpha. */
function parse(css: string): RGBA {
  let v = colours.get(css);
  if (v) return v;
  const s = css.trim();
  if (s[0] === '#') {
    const h = s.length === 4 ? s.slice(1).split('').map((ch) => ch + ch).join('') : s.slice(1, 7);
    v = { c: parseInt(h, 16), a: s.length === 9 ? parseInt(s.slice(7, 9), 16) / 255 : 1 };
  } else {
    const m = s.match(/rgba?\(([^)]+)\)/);
    const n = m ? m[1].split(',').map((x) => parseFloat(x)) : [0, 0, 0, 1];
    v = { c: (Math.round(n[0]) << 16) | (Math.round(n[1]) << 8) | Math.round(n[2]), a: n.length > 3 ? n[3] : 1 };
  }
  if (colours.size > 4000) colours.clear();
  colours.set(css, v);
  return v;
}

/** A radial gradient: drawn as the soft glow texture, tinted with its first colour. */
export class GLGradient {
  readonly stops: [number, string][] = [];
  constructor(readonly x: number, readonly y: number, readonly r: number) {}
  addColorStop(o: number, c: string): void { this.stops.push([o, c]); }
}

/** A recorded path (the Path2D of this painter). Points are in the user space of when it is drawn. */
export class GLPath {
  subs: Sub[] = [];
  private cur: Sub | null = null;
  private lastX = 0;
  private lastY = 0;
  constructor(private readonly tf?: (x: number, y: number) => [number, number], private readonly px = () => 1) {}
  private put(x: number, y: number): void {
    const [X, Y] = this.tf ? this.tf(x, y) : [x, y];
    if (!this.cur) { this.cur = { pts: [], closed: false }; this.subs.push(this.cur); }
    this.cur.pts.push(X, Y);
    this.lastX = x; this.lastY = y;
  }
  moveTo(x: number, y: number): void { this.cur = { pts: [], closed: false }; this.subs.push(this.cur); this.put(x, y); }
  lineTo(x: number, y: number): void { this.put(x, y); }
  closePath(): void { if (this.cur) { this.cur.closed = true; this.cur = null; } }
  /** segments for a curve of this (user-space) length */
  private steps(len: number): number { return Math.max(4, Math.min(48, Math.ceil(len * this.px() / 3))); }
  quadraticCurveTo(cx: number, cy: number, x: number, y: number): void {
    const x0 = this.lastX, y0 = this.lastY, n = this.steps(Math.hypot(cx - x0, cy - y0) + Math.hypot(x - cx, y - cy));
    for (let k = 1; k <= n; k++) { const u = k / n, v = 1 - u; this.put(v * v * x0 + 2 * v * u * cx + u * u * x, v * v * y0 + 2 * v * u * cy + u * u * y); }
  }
  bezierCurveTo(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number): void {
    const x0 = this.lastX, y0 = this.lastY;
    const n = this.steps(Math.hypot(c1x - x0, c1y - y0) + Math.hypot(c2x - c1x, c2y - c1y) + Math.hypot(x - c2x, y - c2y));
    for (let k = 1; k <= n; k++) {
      const u = k / n, v = 1 - u;
      this.put(v * v * v * x0 + 3 * v * v * u * c1x + 3 * v * u * u * c2x + u * u * u * x, v * v * v * y0 + 3 * v * v * u * c1y + 3 * v * u * u * c2y + u * u * u * y);
    }
  }
  arc(x: number, y: number, r: number, a0: number, a1: number, ccw = false): void { this.ellipse(x, y, r, r, 0, a0, a1, ccw); }
  ellipse(x: number, y: number, rx: number, ry: number, rot: number, a0: number, a1: number, ccw = false): void {
    let sweep = a1 - a0;
    if (ccw && sweep > 0) sweep -= Math.PI * 2; else if (!ccw && sweep < 0) sweep += Math.PI * 2;
    const full = Math.abs(sweep) >= Math.PI * 2 - 1e-3;
    if (full) sweep = Math.sign(sweep || 1) * Math.PI * 2;
    // a full circle on its own is drawn as a circle (cheap, and round at any size)
    if (full && rx === ry && (!this.cur || this.cur.pts.length <= 2) && this.tf) {
      const [X, Y] = this.tf(x, y), [X2, Y2] = this.tf(x + rx, y);
      this.cur = { pts: [], closed: true, circle: [X, Y, Math.hypot(X2 - X, Y2 - Y)] };
      this.subs.push(this.cur); this.cur = null;
      this.lastX = x + rx; this.lastY = y;
      return;
    }
    const n = Math.max(6, Math.min(64, Math.ceil(Math.abs(sweep) * Math.max(rx, ry) * this.px() / 4)));
    const cr = Math.cos(rot), sr = Math.sin(rot);
    for (let k = 0; k <= n; k++) {
      const a = a0 + sweep * k / n, ex = Math.cos(a) * rx, ey = Math.sin(a) * ry;
      this.put(x + ex * cr - ey * sr, y + ex * sr + ey * cr);
    }
    if (full && this.cur) this.cur.closed = true;
  }
  rect(x: number, y: number, w: number, h: number): void { this.moveTo(x, y); this.lineTo(x + w, y); this.lineTo(x + w, y + h); this.lineTo(x, y + h); this.closePath(); }
}

interface State { m: M; alpha: number; fill: string | GLGradient; stroke: string; lw: number; dash: number[]; font: string; align: CanvasTextAlign }

/** How long an unused texture (an animal's pose, a label) is kept, in frames. */
const KEEP_FRAMES = 900;

export class GLPainter {
  private st: State = { m: [1, 0, 0, 1, 0, 0], alpha: 1, fill: '#000', stroke: '#000', lw: 1, dash: [], font: '10px serif', align: 'start' };
  private readonly stack: State[] = [];
  private path = new GLPath((x, y) => this.tf(x, y), () => this.px());
  private readonly graphics: Phaser.GameObjects.Graphics[] = [];
  private readonly images: Phaser.GameObjects.Image[] = [];
  private gUsed = 0;
  private iUsed = 0;
  private g: Phaser.GameObjects.Graphics | null = null;
  private depth = 0;
  private frame = 0;
  private readonly textureOf = new WeakMap<object, string>();
  private readonly lastUse = new Map<string, number>();
  private readonly dynamic = new WeakSet<object>();
  private readonly uploaded = new Map<string, number>();
  private serial = 0;
  private readonly text = document.createElement('canvas').getContext('2d')!;
  private readonly texts = new Map<string, { canvas: HTMLCanvasElement; ox: number; ascent: number; k: number }>();
  private readonly glow: HTMLCanvasElement;
  // Canvas 2D look-alike properties
  lineCap: CanvasLineCap = 'butt';
  lineJoin: CanvasLineJoin = 'miter';
  imageSmoothingEnabled = true;
  textBaseline: CanvasTextBaseline = 'alphabetic';

  constructor(private readonly scene: Phaser.Scene, private readonly layer: Phaser.GameObjects.Layer, private base: number) {
    this.st.m = [base, 0, 0, base, 0, 0];
    this.glow = document.createElement('canvas');
    this.glow.width = this.glow.height = 128;
    const g = this.glow.getContext('2d')!, gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  }

  /** The device-pixel scale (the overlay draws in CSS pixels). */
  setBase(base: number): void { this.base = base; }

  /** Start a frame: every object drawn last frame is put back in the pool. */
  begin(): void {
    this.frame++;
    for (let k = 0; k < this.gUsed; k++) this.graphics[k].clear().setVisible(false);
    for (let k = 0; k < this.iUsed; k++) this.images[k].setVisible(false);
    this.gUsed = 0; this.iUsed = 0; this.g = null; this.depth = 0;
    this.stack.length = 0;
    this.st = { m: [this.base, 0, 0, this.base, 0, 0], alpha: 1, fill: '#000', stroke: '#000', lw: 1, dash: [], font: '10px serif', align: 'start' };
    this.path = new GLPath((x, y) => this.tf(x, y), () => this.px());
    // forget textures nobody has drawn for a while (animal poses, labels left behind)
    if (this.frame % 120 === 0) for (const [key, at] of this.lastUse) {
      if (this.frame - at < KEEP_FRAMES) continue;
      this.lastUse.delete(key); this.uploaded.delete(key);
      if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
    }
  }

  /** A canvas whose picture changes from frame to frame (the fog): uploaded again when drawn. */
  markDynamic(c: HTMLCanvasElement): void { this.dynamic.add(c); }

  // ---- state ----
  get globalAlpha(): number { return this.st.alpha; }
  set globalAlpha(a: number) { this.st.alpha = a; }
  get fillStyle(): string | GLGradient { return this.st.fill; }
  set fillStyle(f: string | GLGradient) { this.st.fill = f; }
  get strokeStyle(): string { return this.st.stroke; }
  set strokeStyle(s: string) { this.st.stroke = s; }
  get lineWidth(): number { return this.st.lw; }
  set lineWidth(w: number) { this.st.lw = w; }
  get font(): string { return this.st.font; }
  set font(f: string) { this.st.font = f; }
  get textAlign(): CanvasTextAlign { return this.st.align; }
  set textAlign(a: CanvasTextAlign) { this.st.align = a; }
  setLineDash(d: number[]): void { this.st.dash = d.slice(); }
  save(): void { this.stack.push({ ...this.st, m: [...this.st.m] as M, dash: this.st.dash.slice() }); }
  restore(): void { const s = this.stack.pop(); if (s) this.st = s; }
  translate(x: number, y: number): void { const m = this.st.m; m[4] += m[0] * x + m[2] * y; m[5] += m[1] * x + m[3] * y; }
  scale(x: number, y = x): void { const m = this.st.m; m[0] *= x; m[1] *= x; m[2] *= y; m[3] *= y; }
  /** device pixels per drawing unit, under the current transform */
  private px(): number { const m = this.st.m; return Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || 1; }
  rotate(a: number): void {
    const m = this.st.m, c = Math.cos(a), s = Math.sin(a), [a0, b0, c0, d0] = m;
    m[0] = a0 * c + c0 * s; m[1] = b0 * c + d0 * s; m[2] = c0 * c - a0 * s; m[3] = d0 * c - b0 * s;
  }
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void { this.st.m = [a, b, c, d, e, f]; }
  private tf(x: number, y: number): [number, number] { const m = this.st.m; return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; }

  // ---- paths ----
  beginPath(): void { this.path = new GLPath((x, y) => this.tf(x, y), () => this.px()); }
  moveTo(x: number, y: number): void { this.path.moveTo(x, y); }
  lineTo(x: number, y: number): void { this.path.lineTo(x, y); }
  closePath(): void { this.path.closePath(); }
  quadraticCurveTo(a: number, b: number, c: number, d: number): void { this.path.quadraticCurveTo(a, b, c, d); }
  bezierCurveTo(a: number, b: number, c: number, d: number, e: number, f: number): void { this.path.bezierCurveTo(a, b, c, d, e, f); }
  arc(x: number, y: number, r: number, a0: number, a1: number, ccw?: boolean): void { this.path.arc(x, y, r, a0, a1, ccw); }
  ellipse(x: number, y: number, rx: number, ry: number, rot: number, a0: number, a1: number, ccw?: boolean): void { this.path.ellipse(x, y, rx, ry, rot, a0, a1, ccw); }
  rect(x: number, y: number, w: number, h: number): void { this.path.rect(x, y, w, h); }
  /** a path to fill or stroke later, like `new Path2D()` (its points are taken as they are drawn) */
  newPath(): GLPath { return new GLPath((x, y) => [x, y], () => this.px()); }

  private subsOf(p?: GLPath): Sub[] {
    if (!p) return this.path.subs;
    // a stand-alone path: its points go through the transform now
    return p.subs.map((s) => {
      if (s.circle) { const [X, Y] = this.tf(s.circle[0], s.circle[1]); return { pts: [], closed: true, circle: [X, Y, s.circle[2] * this.px()] as [number, number, number] }; }
      const pts: number[] = [];
      for (let k = 0; k < s.pts.length; k += 2) { const [X, Y] = this.tf(s.pts[k], s.pts[k + 1]); pts.push(X, Y); }
      return { pts, closed: s.closed };
    });
  }

  /** The Graphics batch to draw vectors into (a new one after an image, to keep the order). */
  private gfx(): Phaser.GameObjects.Graphics {
    if (this.g) return this.g;
    let g = this.graphics[this.gUsed];
    if (!g) { g = this.scene.add.graphics(); this.layer.add(g); this.graphics.push(g); }
    this.gUsed++;
    g.setVisible(true).setDepth(this.depth++);
    this.g = g;
    return g;
  }

  stroke(p?: GLPath): void {
    const col = parse(this.st.stroke);
    let w = this.st.lw * this.px(), a = col.a * this.st.alpha;
    if (a <= 0.003) return;
    if (w < 1) { a *= w; w = 1; } // a hairline: thinner looks fainter, as on a canvas
    const g = this.gfx();
    g.lineStyle(w, col.c, a);
    for (const s of this.subsOf(p)) {
      if (s.circle) { g.strokeCircle(s.circle[0], s.circle[1], s.circle[2]); continue; }
      const pts = s.closed ? [...s.pts, s.pts[0], s.pts[1]] : s.pts;
      if (pts.length < 4) continue;
      if (this.st.dash.length) { this.dashed(g, pts); continue; }
      g.beginPath(); g.moveTo(pts[0], pts[1]);
      for (let k = 2; k < pts.length; k += 2) g.lineTo(pts[k], pts[k + 1]);
      g.strokePath();
    }
  }

  private dashed(g: Phaser.GameObjects.Graphics, pts: number[]): void {
    const d = this.st.dash.map((x) => Math.max(0.5, x * this.px()));
    let di = 0, left = d[0], on = true;
    g.beginPath(); g.moveTo(pts[0], pts[1]);
    for (let k = 2; k < pts.length; k += 2) {
      let x0 = pts[k - 2], y0 = pts[k - 1];
      const x1 = pts[k], y1 = pts[k + 1];
      let seg = Math.hypot(x1 - x0, y1 - y0);
      while (seg > 0) {
        const step = Math.min(seg, left), u = step / seg, x = x0 + (x1 - x0) * u, y = y0 + (y1 - y0) * u;
        if (on) g.lineTo(x, y); else g.moveTo(x, y);
        x0 = x; y0 = y; seg -= step; left -= step;
        if (left <= 1e-6) { if (on) { g.strokePath(); g.beginPath(); g.moveTo(x, y); } on = !on; di = (di + 1) % d.length; left = d[di]; }
      }
    }
    if (on) g.strokePath();
  }

  fill(p?: GLPath): void {
    if (this.st.fill instanceof GLGradient) return; // gradients only through fillRect (glows)
    const col = parse(this.st.fill), a = col.a * this.st.alpha;
    if (a <= 0.003) return;
    const g = this.gfx();
    g.fillStyle(col.c, a);
    for (const s of this.subsOf(p)) {
      if (s.circle) { g.fillCircle(s.circle[0], s.circle[1], s.circle[2]); continue; }
      if (s.pts.length < 6) continue;
      const pts: { x: number; y: number }[] = [];
      for (let k = 0; k < s.pts.length; k += 2) pts.push({ x: s.pts[k], y: s.pts[k + 1] });
      g.fillPoints(pts, true, true);
    }
  }

  fillRect(x: number, y: number, w: number, h: number): void {
    const f = this.st.fill;
    if (f instanceof GLGradient) { this.glowAt(f); return; }
    const col = parse(f), a = col.a * this.st.alpha;
    if (a <= 0.003) return;
    const m = this.st.m, g = this.gfx();
    g.fillStyle(col.c, a);
    if (m[1] === 0 && m[2] === 0) {
      const [X, Y] = this.tf(x, y);
      g.fillRect(Math.min(X, X + w * m[0]), Math.min(Y, Y + h * m[3]), Math.abs(w * m[0]), Math.abs(h * m[3]));
    } else {
      const p = [this.tf(x, y), this.tf(x + w, y), this.tf(x + w, y + h), this.tf(x, y + h)].map(([px, py]) => ({ x: px, y: py }));
      g.fillPoints(p, true, true);
    }
  }
  strokeRect(x: number, y: number, w: number, h: number): void { const keep = this.path; this.beginPath(); this.rect(x, y, w, h); this.stroke(); this.path = keep; }
  clearRect(): void { /* each frame starts empty (begin) */ }

  createRadialGradient(_x0: number, _y0: number, _r0: number, x1: number, y1: number, r1: number): GLGradient { return new GLGradient(x1, y1, r1); }
  createLinearGradient(): GLGradient { return new GLGradient(0, 0, 0); }

  /** A radial gradient laid down as the soft glow texture, tinted and faded like its first stop. */
  private glowAt(gr: GLGradient): void {
    if (!gr.r || !gr.stops.length) return;
    const col = parse(gr.stops[0][1]), a = col.a * this.st.alpha;
    if (a <= 0.003) return;
    const img = this.image(this.glow, false);
    const [X, Y] = this.tf(gr.x, gr.y), R = gr.r * this.px();
    img.setOrigin(0.5, 0.5).setPosition(X, Y).setDisplaySize(R * 2, R * 2).setRotation(0).setAlpha(a).setTint(col.c);
  }

  // ---- images ----
  /** The texture for a picture (made once; a dynamic canvas is uploaded again each time). */
  private textureFor(src: CanvasImageSource): string {
    let key = this.textureOf.get(src as object);
    if (!key || !this.scene.textures.exists(key)) {
      key = 'gl:' + (this.serial++);
      this.scene.textures.addImage(key, src as HTMLImageElement);
      this.textureOf.set(src as object, key);
    } else if (this.dynamic.has(src as object) && this.uploaded.get(key) !== this.frame) {
      this.scene.textures.get(key).source[0].update();
    }
    this.uploaded.set(key, this.frame);
    if (!(src instanceof HTMLImageElement)) this.lastUse.set(key, this.frame); // pictures from files stay
    return key;
  }

  /** An image object from the pool, showing src, in drawing order. */
  private image(src: CanvasImageSource, track = true): Phaser.GameObjects.Image {
    const key = track ? this.textureFor(src) : this.glowKey();
    let img = this.images[this.iUsed];
    if (!img) { img = this.scene.add.image(0, 0, key); this.layer.add(img); this.images.push(img); }
    this.iUsed++;
    if (img.texture.key !== key) img.setTexture(key);
    img.setVisible(true).setDepth(this.depth++).clearTint().setAlpha(1).setRotation(0).setOrigin(0, 0);
    this.g = null; // vectors drawn after this go above it
    return img;
  }

  private glowKey(): string {
    const key = 'gl:glow';
    if (!this.scene.textures.exists(key)) this.scene.textures.addImage(key, this.glow as unknown as HTMLImageElement);
    return key;
  }

  drawImage(src: CanvasImageSource, dx: number, dy: number, dw?: number, dh?: number): void {
    const sw = (src as HTMLCanvasElement).width, sh = (src as HTMLCanvasElement).height;
    if (!sw || !sh || this.st.alpha <= 0.003) return;
    const w = dw ?? sw, h = dh ?? sh, m = this.st.m;
    const img = this.image(src);
    const [X, Y] = this.tf(dx, dy);
    img.setPosition(X, Y).setAlpha(this.st.alpha);
    if (m[1] === 0 && m[2] === 0) img.setRotation(0).setScale(m[0] * w / sw, m[3] * h / sh); // also flipped (negative scale)
    else { const sx = Math.hypot(m[0], m[1]), sy = (m[0] * m[3] - m[1] * m[2]) / sx; img.setRotation(Math.atan2(m[1], m[0])).setScale(sx * w / sw, sy * h / sh); }
  }

  // ---- text ----
  /** Text is drawn once into a small canvas (sharp at this scale), then reused as a texture. */
  private textImage(text: string, stroke: boolean): void {
    const k = this.px(), colour = stroke ? this.st.stroke : (typeof this.st.fill === 'string' ? this.st.fill : '#000');
    const key = this.st.font + '|' + colour + '|' + (stroke ? this.st.lw : 0) + '|' + k.toFixed(2) + '|' + text;
    let t = this.texts.get(key);
    if (!t) {
      if (this.texts.size > 600) this.texts.clear();
      const g = this.text;
      g.font = this.st.font;
      const mt = g.measureText(text), pad = Math.ceil((stroke ? this.st.lw : 0) + 2);
      const ascent = Math.ceil(mt.actualBoundingBoxAscent || parseFloat(this.st.font.match(/(\d+)px/)?.[1] ?? '12')) + pad;
      const descent = Math.ceil(mt.actualBoundingBoxDescent || 4) + pad;
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.ceil((mt.width + pad * 2) * k)); canvas.height = Math.max(1, Math.ceil((ascent + descent) * k));
      const c = canvas.getContext('2d')!;
      c.scale(k, k); c.font = this.st.font; c.textBaseline = 'alphabetic'; c.lineJoin = 'round';
      if (stroke) { c.strokeStyle = colour; c.lineWidth = this.st.lw; c.strokeText(text, pad, ascent); } else { c.fillStyle = colour; c.fillText(text, pad, ascent); }
      t = { canvas, ox: pad, ascent, k };
      this.texts.set(key, t);
    }
    const width = (t.canvas.width / t.k) - t.ox * 2, align = this.st.align;
    const shift = align === 'center' ? width / 2 : align === 'right' || align === 'end' ? width : 0;
    this.pendingText = [t.canvas, -shift - t.ox, -t.ascent, t.canvas.width / t.k, t.canvas.height / t.k];
  }
  private pendingText: [HTMLCanvasElement, number, number, number, number] | null = null;
  fillText(text: string, x: number, y: number): void { this.textAt(text, x, y, false); }
  strokeText(text: string, x: number, y: number): void { this.textAt(text, x, y, true); }
  private textAt(text: string, x: number, y: number, stroke: boolean): void {
    if (!text) return;
    this.textImage(text, stroke);
    const [c, ox, oy, w, h] = this.pendingText!;
    this.drawImage(c, x + ox, y + oy, w, h);
  }
  measureText(text: string): TextMetrics { this.text.font = this.st.font; return this.text.measureText(text); }
}

/** Whether a drawing context is the GPU painter (rather than a real canvas). */
export const isGL = (ctx: unknown): ctx is GLPainter => ctx instanceof GLPainter;
