// Minimal DOM HUD styled as an old atlas: header with counters, a cartouche for notes,
// and the zoom buttons. Same look as the proto. All text goes through i18n.
import { t } from '../i18n';
import type { WeatherKind } from '../world/weather';

const CSS = `
.hud-header { position: fixed; left: 0; right: 0; top: 0; padding: calc(8px + env(safe-area-inset-top, 0px)) 14px 6px;
  background: #ece3cb; color: #2a241d; border-bottom: 3px double #2a241d; display: flex; justify-content: space-between;
  align-items: flex-start; gap: 10px; pointer-events: none; z-index: 2; }
.hud-header .t { font: 19px/1.15 "IM Fell English SC", serif; letter-spacing: .04em; }
.hud-header .t .coords, .hud-header .t .sky { font: italic 13px "IM Fell English", serif; letter-spacing: 0; }
.hud-header .t .life { font: 700 12px "Old Standard TT", serif; letter-spacing: .04em; }
.hud-header .t .life b { color: #a83428; font-weight: 700; }
.hud-header .c { text-align: center; flex: none; }
.hud-header .c canvas { display: block; width: 92px; height: 46px; }
.hud-header .c .time { font: 700 13px/1.2 "Old Standard TT", serif; letter-spacing: .04em; }
.hud-header .c .time i { font: italic 400 12px "IM Fell English", serif; letter-spacing: 0; }
.hud-walk { position: fixed; left: 12px; right: 70px; bottom: calc(16px + env(safe-area-inset-bottom, 0px)); display: none; gap: 8px; z-index: 3; }
.hud-walk.on { display: flex; }
.hud-walk button { font: 700 15px/1.2 "Old Standard TT", serif; color: #2a241d; background: #ece3cb; border: 1.5px solid #2a241d;
  outline: 1px solid #2a241d; outline-offset: 2px; padding: 9px 10px; cursor: pointer; touch-action: manipulation; }
.hud-walk .go { flex: 1; text-transform: uppercase; letter-spacing: .05em; text-align: left; }
.hud-walk .go i { display: block; font: italic 400 13px "IM Fell English", serif; text-transform: none; letter-spacing: 0; color: #6a5f4f; }
.hud-walk .no { width: 46px; font-size: 20px; padding: 0; }
.hud-buttons button.word { font-size: 12px; letter-spacing: .04em; text-transform: uppercase; }
.hud-walk.pack { flex-direction: column; max-height: 66vh; overflow-y: auto; background: #ece3cb; border: 1.5px solid #2a241d; padding: 8px; gap: 6px; box-shadow: 0 2px 10px rgba(42,36,29,.25); }
.hud-walk.pack .info { font: 700 14px/1.2 "Old Standard TT", serif; color: #2a241d; padding: 2px 4px; text-transform: uppercase; letter-spacing: .05em; }
.hud-walk.pack .info i { display: block; font: italic 400 13px "IM Fell English", serif; text-transform: none; letter-spacing: 0; color: #6a5f4f; }
.hud-walk.two { flex-wrap: wrap; }
.hud-walk.two .alt { flex: 1 1 100%; order: -1; }
.hud-walk.pack .head { font: 13px "IM Fell English SC", serif; letter-spacing: .08em; color: #6a5f4f; padding: 4px 2px 0; }
.hud-walk.pack .row { display: flex; gap: 8px; }
.hud-walk.pack .title { font: 13px "IM Fell English SC", serif; letter-spacing: .08em; background: #ece3cb; border: 1.5px solid #2a241d; padding: 6px 10px; }
.hud-walk.pack button:disabled { color: #9a8f7f; border-color: #9a8f7f; }
.hud-walk button:focus-visible { outline: 2px dashed #2a241d; }
.hud-version { position: fixed; left: 14px; bottom: calc(3px + env(safe-area-inset-bottom, 0px)); font: italic 10px "IM Fell English", serif;
  color: #6a5f4f; opacity: .75; pointer-events: none; z-index: 2; }
.hud-buttons { position: fixed; right: 12px; bottom: calc(16px + env(safe-area-inset-bottom, 0px)); display: flex; flex-direction: column; gap: 8px; z-index: 2; }
.hud-buttons button { width: 46px; height: 46px; padding: 0; font: 700 20px "Old Standard TT", serif; color: #2a241d;
  background: #ece3cb; border: 1.5px solid #2a241d; cursor: pointer; touch-action: manipulation; }
.hud-buttons button:focus-visible { outline: 2px dashed #2a241d; outline-offset: 3px; }
.hud-note { position: fixed; left: 12px; right: 70px; bottom: calc(16px + env(safe-area-inset-bottom, 0px)); background: #ece3cb;
  color: #2a241d; border: 1px solid #2a241d; outline: 1px solid #2a241d; outline-offset: 3px; padding: 10px 12px;
  font: 15px/1.4 "IM Fell English", serif; display: none; z-index: 2; }
.hud-note.on { display: block; }
.hud-note b { display: block; font: 700 17px "Old Standard TT", serif; text-transform: uppercase; letter-spacing: .02em; }
.hud-note i { color: #6a5f4f; }
`;

export class Hud {
  private readonly dial: HTMLCanvasElement;
  private readonly time: HTMLElement;
  private readonly walk: HTMLElement;
  private readonly life: HTMLElement;
  private dialKey = '';
  private readonly coords: HTMLElement;
  private readonly header: HTMLElement;
  private readonly sky: HTMLElement;
  private readonly note: HTMLElement;
  private noteTimer = 0;
  private noteImportant = false;
  private readonly queue: [string, string, number][] = [];
  private readonly root: HTMLElement[] = [];

  constructor(handlers: { zoomIn(): void; zoomOut(): void; center(): void; pack(): void }) {
    const style = document.createElement('style');
    style.textContent = CSS;
    const header = document.createElement('header');
    header.className = 'hud-header';
    this.header = header;
    header.innerHTML = '<div class="t"><span></span><br><i class="coords"></i><br><i class="sky"></i><br><span class="life"></span></div><div class="c"><canvas role="img"></canvas><div class="time"></div></div>';
    header.querySelector('.t > span')!.textContent = t('title');
    this.coords = header.querySelector('.coords')!;
    this.sky = header.querySelector('.sky')!;
    this.life = header.querySelector('.life')!;
    this.dial = header.querySelector('canvas')!;
    this.dial.setAttribute('aria-label', t('ui.dial'));
    this.time = header.querySelector('.time')!;
    this.walk = document.createElement('div');
    this.walk.className = 'hud-walk';
    this.note = document.createElement('div');
    this.note.className = 'hud-note';
    this.note.setAttribute('role', 'status');
    const buttons = document.createElement('div');
    buttons.className = 'hud-buttons';
    for (const [label, aria, fn] of [[t('ui.packShort'), 'ui.pack', handlers.pack], ['+', 'ui.zoomIn', handlers.zoomIn], ['−', 'ui.zoomOut', handlers.zoomOut], ['⌖', 'ui.center', handlers.center]] as const) {
      const b = document.createElement('button');
      b.textContent = label;
      if (label.length > 2) b.className = 'word';
      b.setAttribute('aria-label', t(aria));
      b.addEventListener('click', fn);
      buttons.append(b);
    }
    const version = document.createElement('div');
    version.className = 'hud-version';
    version.textContent = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '';
    this.root.push(style, header, this.note, this.walk, buttons, version);
    document.body.append(...this.root);
  }

  /** Height of the header, CSS pixels: the map draws nothing beneath it. */
  headerHeight(): number {
    return this.header.getBoundingClientRect().height;
  }

  /** The weather and the hour, under the coordinates. */
  setSky(text: string): void {
    if (this.sky.textContent !== text) this.sky.textContent = text;
  }

  /** Latitude and longitude of the explorer, under the title. */
  setCoords(text: string): void {
    if (this.coords.textContent !== text) this.coords.textContent = text;
  }

  /** The explorer's life and purse, under the weather. */
  setLife(hp: number, max: number, gold: number): void {
    const key = hp + '/' + max + '/' + gold;
    if (this.life.dataset.v === key) return;
    this.life.dataset.v = key;
    const heart = document.createElement('b'); heart.textContent = '♥ ';
    this.life.replaceChildren(heart, t('hud.life', { hp, max, n: gold }));
  }

  /** The local hour (and its moment of the day) under the dial. */
  setTime(text: string, moment: string): void {
    const html = text + ' <i>· ' + moment + '</i>';
    if (this.time.dataset.v !== html) { this.time.dataset.v = html; this.time.replaceChildren(text + ' ', Object.assign(document.createElement('i'), { textContent: '· ' + moment })); }
  }

  /**
   * The dial: the horizon, the sun at its height in the sky (the moon and stars at night), and
   * the weather where the explorer stands, engraved like the rest of the map.
   */
  setDial(hour: number, weather: WeatherKind, darkness: number, glow: number): void {
    const key = Math.round(hour * 12) + weather + Math.round(darkness * 10) + Math.round(glow * 10);
    if (key === this.dialKey) return;
    this.dialKey = key;
    drawDial(this.dial, hour, weather, darkness, glow);
  }

  /** Offer to walk to the spot tapped: a button to go, one to give up. */
  /**
   * Propose to walk (or hunt...) there: a button with the distance, and a cross. `alt`: a second
   * action offered above it (gather what grows there, fish in that water).
   */
  showWalk(detail: string, place: string | null, go: () => void, cancel: () => void, label?: string, alt?: { label: string; detail: string; go: () => void }): void {
    this.hideNote();
    const b = document.createElement('button'), no = document.createElement('button');
    b.className = 'go'; b.textContent = (label ?? t('walk.go') + (place ? ' ' + place : '')) + ' ›';
    const i = document.createElement('i'); i.textContent = detail; b.append(i);
    no.className = 'no'; no.textContent = '×'; no.setAttribute('aria-label', t('walk.cancel'));
    b.addEventListener('click', go); no.addEventListener('click', cancel);
    const row: HTMLElement[] = [b, no];
    if (alt) {
      const a = document.createElement('button');
      a.className = 'go alt'; a.textContent = alt.label + ' ›';
      const ai = document.createElement('i'); ai.textContent = alt.detail; a.append(ai);
      a.addEventListener('click', alt.go);
      row.unshift(a);
    }
    this.walk.replaceChildren(...row);
    this.walk.classList.toggle('two', !!alt);
    this.walk.classList.add('on');
  }

  hideWalk(): void { this.walk.classList.remove('on', 'pack', 'two'); }

  /** The pack: what the explorer carries, each a button to eat or drink it. */
  showPack(entries: { label: string; sub: string; use: (() => void) | null; head?: boolean; info?: boolean }[], title: string, empty: string): void {
    this.hideNote();
    const rows: HTMLElement[] = [];
    const head = document.createElement('div'); head.className = 'title'; head.textContent = title;
    rows.push(head);
    if (!entries.length) { const e = document.createElement('div'); e.className = 'title'; e.style.fontStyle = 'italic'; e.textContent = empty; rows.push(e); }
    for (const en of entries) {
      if (en.head) { const h = document.createElement('div'); h.className = 'head'; h.textContent = en.label; rows.push(h); continue; }
      if (en.info) { // something carried, nothing to do with it here
        const d = document.createElement('div'); d.className = 'info'; d.textContent = en.label;
        if (en.sub) { const i = document.createElement('i'); i.textContent = en.sub; d.append(i); }
        rows.push(d); continue;
      }
      const b = document.createElement('button');
      b.className = 'go'; b.textContent = en.label;
      const i = document.createElement('i'); i.textContent = en.sub; b.append(i);
      b.disabled = !en.use;
      if (en.use) b.addEventListener('click', en.use);
      rows.push(b);
    }
    const close = document.createElement('button');
    close.className = 'no'; close.textContent = '×'; close.setAttribute('aria-label', t('walk.cancel'));
    close.style.width = '100%'; close.style.padding = '8px';
    close.addEventListener('click', () => this.hideWalk());
    rows.push(close);
    this.walk.replaceChildren(...rows);
    this.walk.classList.remove('two'); this.walk.classList.add('on', 'pack');
  }

  /**
   * Show a cartouche. An important one (a wonder) stays up for its whole time: ordinary notes
   * that arrive meanwhile wait their turn instead of replacing it.
   */
  showNote(title: string, text: string, ms = 6000, important = false): void {
    if (this.noteImportant && this.note.classList.contains('on') && !important) {
      if (this.queue.length < 3) this.queue.push([title, text, ms]);
      return;
    }
    this.noteImportant = important;
    this.hideWalk();
    this.note.replaceChildren();
    const b = document.createElement('b'), i = document.createElement('i');
    b.textContent = title;
    i.textContent = text;
    this.note.append(b, i);
    this.note.classList.add('on');
    clearTimeout(this.noteTimer);
    this.noteTimer = window.setTimeout(() => this.hideNote(), ms);
  }

  /** Close the current cartouche; the next waiting one, if any, shows. */
  hideNote(): void {
    this.note.classList.remove('on');
    this.noteImportant = false;
    const next = this.queue.shift();
    if (next) this.showNote(...next);
  }

  destroy(): void {
    clearTimeout(this.noteTimer);
    for (const el of this.root) el.remove();
  }
}

const INK = '#2a241d';

function drawDial(cv: HTMLCanvasElement, hour: number, weather: WeatherKind, darkness: number, glow: number): void {
  const W = 92, H = 46, dpr = Math.min(2, window.devicePixelRatio || 1);
  if (cv.width !== W * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
  const g = cv.getContext('2d')!;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, W, H);
  const cx = W / 2, hy = 37, R = 31; // centre of the arc on the horizon, its radius
  const dome = (): void => { g.beginPath(); g.moveTo(cx - R - 8, hy); g.ellipse(cx, hy, R + 8, R + 2, 0, Math.PI, 0); g.closePath(); };
  // the sky: pale by day, warm at dawn and dusk, deep blue at night
  const mix = (a: number[], b: number[], k: number): string => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(',')})`;
  const day = [226, 230, 222], dusk = [238, 196, 150], night = [52, 60, 92];
  const base = mix(day, night, darkness);
  const grad = g.createLinearGradient(0, hy - R, 0, hy);
  grad.addColorStop(0, base); grad.addColorStop(1, glow > 0.05 ? mix(base.match(/\d+/g)!.map(Number), dusk, glow) : base);
  dome(); g.fillStyle = grad; g.fill();
  g.save(); dome(); g.clip();
  // the hours' path, dotted
  g.strokeStyle = darkness > 0.5 ? 'rgba(236,227,203,.45)' : 'rgba(42,36,29,.35)'; g.setLineDash([1, 3]); g.lineWidth = 0.8;
  g.beginPath(); g.arc(cx, hy, R - 4, Math.PI, 0); g.stroke(); g.setLineDash([]);
  // stars at night
  if (darkness > 0.3) {
    g.fillStyle = `rgba(250,244,220,${Math.min(1, (darkness - 0.3) * 2)})`;
    for (const [x, y] of [[14, 14], [30, 8], [52, 12], [70, 7], [80, 20], [22, 26], [62, 24], [42, 22]]) g.fillRect(x, y, 1.2, 1.2);
  }
  // the sun from 6 h (east, left) to 18 h (west, right); the moon the other half of the day
  const body = (h: number): [number, number] => { const a = ((h - 6) / 12) * Math.PI; return [cx - Math.cos(a) * (R - 4), hy - Math.sin(a) * (R - 4)]; };
  const [sx, sy] = body(hour);
  if (sy < hy + 6) {
    g.strokeStyle = INK; g.lineWidth = 0.8; g.fillStyle = 'rgb(242,200,96)';
    g.beginPath(); for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6; g.moveTo(sx + Math.cos(a) * 6.5, sy + Math.sin(a) * 6.5); g.lineTo(sx + Math.cos(a) * 8.5, sy + Math.sin(a) * 8.5); } g.stroke();
    g.beginPath(); g.arc(sx, sy, 5, 0, Math.PI * 2); g.fill(); g.stroke();
  }
  const [mx, my] = body((hour + 12) % 24);
  if (my < hy + 6) {
    g.fillStyle = 'rgb(244,238,214)'; g.strokeStyle = INK; g.lineWidth = 0.8;
    g.beginPath(); g.arc(mx, my, 5, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = mix(day, night, darkness); g.beginPath(); g.arc(mx + 2.5, my - 1.5, 4.2, 0, Math.PI * 2); g.fill(); // the crescent
  }
  // the weather where the explorer stands
  const cloud = (x: number, y: number, k: number, dark: boolean): void => {
    g.fillStyle = dark ? 'rgb(150,150,156)' : 'rgb(246,244,236)'; g.strokeStyle = INK; g.lineWidth = 0.8;
    g.beginPath();
    g.moveTo(x - 9 * k, y + 3 * k);
    g.arc(x - 5 * k, y, 4 * k, Math.PI * 0.7, Math.PI * 1.6); g.arc(x + 1 * k, y - 2 * k, 5 * k, Math.PI * 1.1, Math.PI * 1.95); g.arc(x + 7 * k, y + 0.5 * k, 3.5 * k, Math.PI * 1.4, Math.PI * 0.4);
    g.closePath(); g.fill(); g.stroke();
  };
  g.strokeStyle = INK; g.lineWidth = 0.8;
  if (weather === 'cloudy') { cloud(cx - 14, 20, 1, false); cloud(cx + 16, 15, 0.8, false); }
  if (weather === 'rain' || weather === 'storm') {
    g.strokeStyle = 'rgb(60,90,120)'; g.beginPath();
    for (let k = 0; k < 9; k++) { const x = cx - 20 + k * 5; g.moveTo(x, 22 + (k % 2) * 3); g.lineTo(x - 2, 30 + (k % 2) * 3); }
    g.stroke();
    cloud(cx - 8, 18, 1.15, true); cloud(cx + 14, 15, 0.9, true);
    if (weather === 'storm') { g.fillStyle = 'rgb(250,226,110)'; g.strokeStyle = INK; g.beginPath(); g.moveTo(cx + 2, 20); g.lineTo(cx - 3, 28); g.lineTo(cx + 1, 28); g.lineTo(cx - 3, 35); g.lineTo(cx + 5, 26); g.lineTo(cx + 1, 26); g.lineTo(cx + 5, 20); g.closePath(); g.fill(); g.stroke(); }
  }
  if (weather === 'snow') {
    cloud(cx - 6, 17, 1.1, false);
    g.strokeStyle = INK; g.lineWidth = 0.6; g.beginPath();
    for (const [x, y] of [[cx - 16, 27], [cx - 6, 31], [cx + 4, 26], [cx + 14, 30], [cx + 22, 24]]) for (let k = 0; k < 3; k++) { const a = k * Math.PI / 3; g.moveTo(x - Math.cos(a) * 2, y - Math.sin(a) * 2); g.lineTo(x + Math.cos(a) * 2, y + Math.sin(a) * 2); }
    g.stroke();
  }
  if (weather === 'fog') {
    g.strokeStyle = 'rgba(42,36,29,.6)'; g.beginPath();
    for (let k = 0; k < 4; k++) { const y = 18 + k * 5; g.moveTo(cx - 30 + (k % 2) * 6, y); g.lineTo(cx + 26 + (k % 2) * 4, y); }
    g.stroke();
  }
  if (weather === 'sandstorm') {
    g.fillStyle = 'rgb(176,136,80)';
    for (let k = 0; k < 40; k++) g.fillRect(cx - 34 + (k * 37 % 68), 8 + (k * 13 % 28), 1.2, 1.2);
    g.strokeStyle = 'rgba(150,110,60,.8)'; g.beginPath(); for (let k = 0; k < 3; k++) { g.moveTo(cx - 28, 16 + k * 7); g.quadraticCurveTo(cx, 12 + k * 7, cx + 28, 18 + k * 7); } g.stroke();
  }
  g.restore();
  // the outline of the dial and the horizon, with the ground hatched beneath
  g.strokeStyle = INK; g.lineWidth = 1;
  dome(); g.stroke();
  g.lineWidth = 1.2; g.beginPath(); g.moveTo(2, hy); g.lineTo(W - 2, hy); g.stroke();
  g.lineWidth = 0.6; g.beginPath();
  for (let x = 6; x < W - 4; x += 4) { g.moveTo(x, hy + 2); g.lineTo(x - 3, hy + 6); }
  g.stroke();
}
