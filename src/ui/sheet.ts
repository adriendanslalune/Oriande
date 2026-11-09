// The explorer's pack and the almanac of recipes, as plates of an old atlas (asked by Adrien: a
// blend of an engraved Hetzel edition of Jules Verne and Moebius's calm "ligne claire"): an
// engraved frame with fleurons in the corners and foxed paper; at the head, a little landscape in
// flat soft colours under a ribbon banner; the explorer in an oval medallion ("Fig. 1"); slots as
// specimen boxes with brass pins, tinted; recipes numbered in Roman figures, their ingredients in
// dotted lines, a coloured band by use. Plain DOM, built from models the map scene gives.
import { t } from '../i18n';
import { itemPicture } from './itemArt';
import { portrait, type Carried } from './portrait';

const INK = '#2b2117';

const CSS = `
.sheet { position: fixed; inset: 0; display: none; z-index: 4; background: rgba(42,36,29,.22); }
.sheet.on { display: block; }
.sheet-page { position: absolute; left: 50%; transform: translateX(-50%); bottom: calc(10px + env(safe-area-inset-bottom, 0px));
  width: min(94vw, 540px); color: ${INK}; display: flex; flex-direction: column; box-shadow: 0 8px 28px rgba(42,36,29,.45);
  background: radial-gradient(circle at 16% 22%, rgba(150,110,60,.14) 0 14px, transparent 34px), radial-gradient(circle at 86% 64%, rgba(150,110,60,.12) 0 12px, transparent 30px),
    radial-gradient(circle at 70% 92%, rgba(150,110,60,.1) 0 10px, transparent 26px), radial-gradient(ellipse at 50% 45%, #f3e9cf 52%, #e2cfa4 100%);
  border: 2px solid ${INK}; padding: 7px; }
.sheet-page::before { content: ''; position: absolute; inset: 4px; border: 1px solid ${INK}; pointer-events: none; }
.sheet .fleuron { position: absolute; width: 26px; height: 26px; pointer-events: none; z-index: 2; }
.sheet-head { position: relative; flex: none; margin: 4px 4px 0; height: 104px; border: 1.5px solid ${INK}; overflow: hidden;
  background: linear-gradient(#b8d0d2 0%, #e9dcb7 64%, #d9b98a 64.5%, #e6c99a 100%); }
.sheet-head svg.land { position: absolute; left: 0; bottom: 0; width: 100%; height: 56px; }
.sheet-head .banner { position: absolute; left: 50%; top: 10px; transform: translateX(-50%); width: min(86%, 380px); height: 46px; }
.sheet-head .banner svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.sheet-head h2 { position: absolute; inset: 0; margin: 0; font: 20px/46px "IM Fell English SC", serif; letter-spacing: .05em; text-align: center; white-space: nowrap; }
.sheet-head .sub { position: absolute; left: 0; right: 0; top: 60px; font: italic 14px "IM Fell English", serif; text-align: center; }
.sheet-head .sub span { background: rgba(243,233,207,.85); padding: 1px 8px; border: 1px solid rgba(43,33,23,.5); }
.sheet-head .close { position: absolute; right: 2px; top: 2px; width: 34px; height: 34px; border: 0; background: none; font: 24px/34px serif; color: ${INK}; cursor: pointer; z-index: 3; }
.sheet-tabs { display: flex; margin: 8px 4px 0; border-bottom: 1.5px solid ${INK}; flex: none; }
.sheet-tabs button { flex: 1; font: 14px "IM Fell English SC", serif; letter-spacing: .05em; color: #6d5c46; background: #e4d4ae; border: 1.5px solid ${INK};
  border-bottom: 0; margin-right: -1.5px; padding: 7px 2px 5px; cursor: pointer; touch-action: manipulation; }
.sheet-tabs button.on { background: #f3e9cf; color: ${INK}; position: relative; top: 1.5px; padding-top: 8px; }
.sheet-body { flex: 1; overflow-y: auto; padding: 4px 10px 14px; margin: 0 4px; }
.sheet.tabbed .sheet-body { border: 1.5px solid ${INK}; border-top: 0; }
.sheet-body h3 { display: flex; align-items: center; gap: 8px; margin: 16px 2px 10px; font: 15px "IM Fell English SC", serif; letter-spacing: .08em; color: ${INK}; }
.sheet-body h3::before, .sheet-body h3::after { content: ''; flex: 1; border-top: 1px solid ${INK}; border-bottom: 1px solid ${INK}; height: 2px; }
.sheet-body h3 span::before { content: '❦ '; } .sheet-body h3 span::after { content: ' ❦'; }
.sheet .empty, .sheet .hint { font: italic 14px "IM Fell English", serif; color: #6a5a44; text-align: center; margin: 6px 0 8px; }
.sheet .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(76px, 1fr)); gap: 12px 10px; }
.sheet .slot { position: relative; display: flex; flex-direction: column; align-items: center; gap: 3px; background: none; border: 0; padding: 0; cursor: pointer; color: ${INK}; touch-action: manipulation; }
.sheet .box { position: relative; width: 100%; aspect-ratio: 1; max-width: 72px; border: 1.5px solid ${INK}; background: #eadcb6;
  box-shadow: inset 0 0 0 3px #f3e9cf, inset 0 0 0 4px rgba(43,33,23,.6); display: flex; align-items: center; justify-content: center; }
.sheet .box::before, .sheet .box::after { content: ''; position: absolute; top: -4px; left: -4px; width: 6px; height: 6px; border-radius: 50%; background: #b08a3e; border: 1px solid ${INK}; }
.sheet .box::after { left: auto; right: -4px; }
.sheet .slot.worn .box { background: #dfe2bd; }
.sheet .slot.sel .box { background: #d6c497; border-width: 2.5px; }
.sheet .box.void { background: transparent; border-style: dashed; box-shadow: none; }
.sheet .box.void::before, .sheet .box.void::after { display: none; }
.sheet .box .pic { display: flex; align-items: center; justify-content: center; }
.sheet .slot .nm { font: italic 13px/1.1 "IM Fell English", serif; text-align: center; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sheet .slot .n { position: absolute; right: 2px; bottom: 20px; font: 700 13px "Old Standard TT", serif; background: #f3e9cf; border: 1px solid ${INK}; padding: 0 4px; line-height: 16px; }
.sheet .slot.worn .box .pin { position: absolute; left: 6px; top: 6px; width: 7px; height: 7px; border-radius: 50%; background: #4d6b33; }
.sheet .figure { display: grid; grid-template-columns: 1fr auto 1fr; gap: 4px; align-items: center; justify-items: center; margin: 12px 0 2px; }
.sheet .figure .side { display: flex; flex-direction: column; gap: 14px; align-items: center; }
.sheet .figure .place { display: flex; flex-direction: column; align-items: center; gap: 2px; width: 80px; }
.sheet .figure .lbl { font: 12px "IM Fell English SC", serif; letter-spacing: .05em; text-align: center; }
.sheet .figure .box { width: 68px; }
.sheet .medal { width: 152px; height: 214px; border-radius: 50%; border: 2px solid ${INK}; outline: 1px solid ${INK}; outline-offset: 4px; overflow: hidden; position: relative;
  background: repeating-linear-gradient(135deg, rgba(43,33,23,.06) 0 1px, transparent 1px 5px), linear-gradient(#c6dadb 0%, #ede0bd 60%, #dcbf8f 60.5%, #e7cd9f 100%);
  display: flex; align-items: flex-end; justify-content: center; }
.sheet .medal svg { margin-bottom: -4px; }
.sheet .figcap { font: italic 13px "IM Fell English", serif; text-align: center; margin: 10px 0 2px; }
.sheet-detail { flex: none; margin: 8px 4px 4px; border: 1.5px solid ${INK}; outline: 1px solid ${INK}; outline-offset: -5px; padding: 12px 14px; display: none; gap: 12px; align-items: flex-start; background: #f6eed8; }
.sheet-detail.on { display: flex; }
.sheet-detail .box { width: 64px; flex: none; }
.sheet-detail .what { flex: 1; min-width: 0; }
.sheet-detail .what b { display: block; font: 17px "IM Fell English SC", serif; letter-spacing: .05em; }
.sheet-detail .what i { display: block; font: italic 14px/1.3 "IM Fell English", serif; color: #4f4232; }
.sheet .acts { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
.sheet .acts button, .sheet .make { font: 14px "IM Fell English SC", serif; letter-spacing: .08em; color: #f6eed8; background: #5f7d3c; border: 1.5px solid ${INK};
  box-shadow: 2px 2px 0 ${INK}; padding: 6px 13px; cursor: pointer; touch-action: manipulation; }
.sheet .acts button:active, .sheet .make:active { box-shadow: none; transform: translate(2px, 2px); }
.sheet .acts button:disabled { background: transparent; color: #9a8a70; border-color: #9a8a70; box-shadow: none; cursor: default; }
.sheet .cat { display: flex; align-items: center; gap: 8px; margin: 16px 2px 8px; font: 15px "IM Fell English SC", serif; letter-spacing: .08em; }
.sheet .cat i { width: 13px; height: 13px; border: 1.5px solid ${INK}; display: inline-block; flex: none; }
.sheet .cat::after { content: ''; flex: 1; border-top: 1px solid ${INK}; border-bottom: 1px solid ${INK}; height: 2px; }
.sheet .rec { display: flex; margin-bottom: 10px; border: 1.5px solid ${INK}; background: #f6eed8; }
.sheet .rec .band { width: 8px; flex: none; border-right: 1.5px solid ${INK}; }
.sheet .rec .in { flex: 1; display: flex; gap: 10px; padding: 9px 10px 10px; min-width: 0; }
.sheet .rec.ready { background: #eef0d2; }
.sheet .rec.done { opacity: .72; }
.sheet .rec .num { flex: none; width: 30px; font: 24px/1 "IM Fell English", serif; text-align: center; padding-top: 2px; }
.sheet .rec .box { width: 56px; flex: none; }
.sheet .rec .what { flex: 1; min-width: 0; }
.sheet .rec b { display: block; font: 16px "IM Fell English SC", serif; letter-spacing: .05em; }
.sheet .rec .what > i { display: block; font: italic 13px/1.3 "IM Fell English", serif; color: #5a4a36; margin-bottom: 3px; }
.sheet .ing { display: flex; font: 14px "IM Fell English", serif; line-height: 1.4; }
.sheet .ing .dots { flex: 1; border-bottom: 1px dotted ${INK}; margin: 0 4px 5px; }
.sheet .ing.short { color: #9c2e20; }
.sheet .rec .state { font: italic 13px "IM Fell English", serif; color: #7a6a52; margin-top: 3px; }
.sheet .make { margin-top: 8px; }
`;

/** Colours of the uses of things: the band on a recipe, the swatch by its heading. */
const USE_COLOUR: Record<string, string> = { soin: '#c98a8a', combat: '#c9a06a', chasse: '#b07a5a', recolte: '#8fa36a', peche: '#7fa3b0', feu: '#d98c4a', voyage: '#a08cb0' };
/** Tints of the four places on the explorer: right hand, left hand, clothing, feet. */
const PLACE_TINT = ['#d8c9a4', '#f0cf8c', '#c79e78', '#bfae8c'];
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX'];

/** A fleuron for the corners of the engraved frame. */
const FLEURON = `<svg viewBox="0 0 26 26"><path d="M2 24 V2 H24" fill="none" stroke="${INK}" stroke-width="1.5"/><path d="M5 5 q9 1 11 11 q-9 -2 -11 -11z M5 5 l6 6" fill="${INK}"/><circle cx="19" cy="5" r="1.4" fill="${INK}"/><circle cx="5" cy="19" r="1.4" fill="${INK}"/></svg>`;
/** The ribbon banner the title sits in. */
const BANNER = `<svg viewBox="0 0 300 46" preserveAspectRatio="none"><path d="M2 12 H24 L18 23 L24 34 H2 L10 23 Z" fill="#dcc89c" stroke="${INK}" stroke-width="1.5"/>
  <path d="M298 12 H276 L282 23 L276 34 H298 L290 23 Z" fill="#dcc89c" stroke="${INK}" stroke-width="1.5"/><path d="M18 6 H282 L272 23 L282 40 H18 L28 23 Z" fill="#f3e9cf" stroke="${INK}" stroke-width="1.5"/>
  <path d="M30 10 H270" stroke="${INK}" stroke-width=".6"/><path d="M30 36 H270" stroke="${INK}" stroke-width=".6"/></svg>`;
/** The little landscape at the head of the page: dunes, far mountains, the sun. */
const LAND = `<svg class="land" viewBox="0 0 380 56" preserveAspectRatio="none"><path d="M248 32 l14 -20 l10 14 l9 -9 l13 15" fill="#cfd8d4" stroke="${INK}" stroke-width="1.2"/>
  <circle cx="330" cy="20" r="8" fill="#f6d77e" stroke="${INK}" stroke-width="1.2"/><path d="M0 40 Q60 22 110 34 T220 30 T380 36 V56 H0Z" fill="#d6b07a" stroke="${INK}" stroke-width="1.2"/>
  <path d="M0 48 Q80 38 170 46 T380 44" fill="none" stroke="${INK}" stroke-width=".7" stroke-dasharray="3 4"/></svg>`;

/** A slot in the pack: a thing, how many, its picture; tapping it shows its card below. */
export interface Slot { id: string; name: string; count: number; worn?: boolean }
export interface SacModel {
  title: string; sub: string;
  /** the tabs, and the one shown */
  tabs: { key: string; label: string }[]; tab: string; setTab: (key: string) => void;
  /** the "Carried" tab: the explorer drawn with his equipment, its places, what can be taken up */
  carried?: { gear: Carried; places: { label: string; id: string | null; name: string }[]; choices: Slot[]; pick: (id: string) => void; hint: string; empty: string; caption: string };
  sections: { title: string; slots: Slot[]; empty?: string }[];
  /** actions that are not about one thing (sleeping by the fire) */
  top?: { title: string; actions: { label: string; use: (() => void) | null }[] } | null;
  selected: string | null;
  detail: { id: string; name: string; lines: string[]; actions: { label: string; use: (() => void) | null }[] } | null;
  select: (id: string) => void;
}
export interface RecipeCard {
  id: string; name: string; text: string;
  needs: { id: string; name: string; have: number; need: number }[];
  state: 'ready' | 'missing' | 'done'; make: () => void;
}

export class Sheet {
  private readonly root: HTMLElement;
  private readonly style: HTMLStyleElement;
  /** what the sheet shows now, to refresh it in place */
  shown: 'sac' | 'almanac' | null = null;

  constructor(private readonly onClose: () => void) {
    this.style = document.createElement('style'); this.style.textContent = CSS;
    this.root = document.createElement('div'); this.root.className = 'sheet';
    this.root.addEventListener('click', (e) => { if (e.target === this.root) this.hide(); });
    document.body.append(this.style, this.root);
  }

  destroy(): void { this.root.remove(); this.style.remove(); }

  hide(): void { if (!this.shown) return; this.root.classList.remove('on'); this.shown = null; this.onClose(); }

  /** A new page: the engraved frame, the landscape with the title in its banner, the body. */
  private page(title: string, sub: string): { page: HTMLElement; body: HTMLElement } {
    const page = document.createElement('div'); page.className = 'sheet-page';
    const header = document.querySelector('.hud-header') as HTMLElement | null; // the page starts under the header
    page.style.top = (header ? header.offsetHeight : 90) + 8 + 'px';
    for (const [pos, tf] of [['left:-1px;top:-1px', ''], ['right:-1px;top:-1px', 'scaleX(-1)'], ['left:-1px;bottom:-1px', 'scaleY(-1)'], ['right:-1px;bottom:-1px', 'scale(-1)']]) {
      const f = document.createElement('span'); f.className = 'fleuron'; f.style.cssText = pos + (tf ? ';transform:' + tf : ''); f.innerHTML = FLEURON; page.append(f);
    }
    const head = document.createElement('div'); head.className = 'sheet-head';
    head.innerHTML = LAND;
    const banner = document.createElement('div'); banner.className = 'banner'; banner.innerHTML = BANNER;
    const h = document.createElement('h2'); h.textContent = title; banner.append(h);
    const p = document.createElement('div'); p.className = 'sub'; const ps = document.createElement('span'); ps.textContent = sub; p.append(ps);
    const x = document.createElement('button'); x.className = 'close'; x.textContent = '×'; x.setAttribute('aria-label', t('walk.cancel'));
    x.addEventListener('click', () => this.hide());
    head.append(banner, p, x);
    const body = document.createElement('div'); body.className = 'sheet-body';
    page.append(head, body);
    this.root.replaceChildren(page);
    this.root.classList.add('on');
    return { page, body };
  }

  private section(body: HTMLElement, title: string): void {
    const h = document.createElement('h3'); const sp = document.createElement('span'); sp.textContent = title; h.append(sp); body.append(h);
  }

  private buttons(actions: { label: string; use: (() => void) | null }[]): HTMLElement {
    const acts = document.createElement('div'); acts.className = 'acts';
    for (const a of actions) {
      const b = document.createElement('button'); b.textContent = a.label; b.disabled = !a.use;
      if (a.use) b.addEventListener('click', a.use);
      acts.append(b);
    }
    return acts;
  }

  /** A specimen box with the thing's picture (or its "?"), tinted if given. */
  private box(id: string | null, tint?: string): HTMLElement {
    const box = document.createElement('div'); box.className = 'box' + (id ? '' : ' void');
    if (id) box.innerHTML = itemPicture(id, 42);
    if (id && tint) box.style.background = tint;
    return box;
  }

  /** A slot: the box, the name under it, how many. */
  private slot(s: Slot, sel: boolean, onClick: (() => void) | null): HTMLElement {
    const b = document.createElement('button');
    b.className = 'slot' + (sel ? ' sel' : '') + (s.worn ? ' worn' : '');
    b.setAttribute('aria-label', s.name + (s.count > 1 ? ' × ' + s.count : ''));
    const box = this.box(s.id);
    if (s.worn) { const pin = document.createElement('span'); pin.className = 'pin'; box.append(pin); }
    const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = s.name;
    b.append(box, nm);
    if (s.count > 1) { const n = document.createElement('span'); n.className = 'n'; n.textContent = String(s.count); b.append(n); }
    if (onClick) b.addEventListener('click', onClick);
    return b;
  }

  /** The pack: tabs (what is carried, tools, food, materials), slots, and the card of the thing tapped. */
  showSac(m: SacModel): void {
    const scroll = this.shown === 'sac' ? this.root.querySelector('.sheet-body')?.scrollTop ?? 0 : 0;
    const sameTab = this.shown === 'sac' && this.root.dataset.tab === m.tab;
    this.shown = 'sac'; this.root.dataset.tab = m.tab;
    this.root.classList.add('tabbed');
    const { page, body } = this.page(m.title, m.sub);
    const tabs = document.createElement('div'); tabs.className = 'sheet-tabs'; tabs.setAttribute('role', 'tablist');
    for (const tb of m.tabs) {
      const b = document.createElement('button'); b.textContent = tb.label; b.setAttribute('role', 'tab');
      if (tb.key === m.tab) { b.className = 'on'; b.setAttribute('aria-selected', 'true'); }
      b.addEventListener('click', () => m.setTab(tb.key));
      tabs.append(b);
    }
    page.insertBefore(tabs, body);
    if (m.top) { this.section(body, m.top.title); body.append(this.buttons(m.top.actions)); }
    if (m.carried) {
      // the explorer in his medallion, a place on each side for what he holds and wears
      const c = m.carried, fig = document.createElement('div'); fig.className = 'figure';
      const place = (k: number): HTMLElement => {
        const p = c.places[k], el = document.createElement(p.id ? 'button' : 'div'); el.className = 'place slot';
        const lbl = document.createElement('div'); lbl.className = 'lbl'; lbl.textContent = p.label;
        const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = p.id ? p.name : '—';
        el.append(lbl, this.box(p.id, PLACE_TINT[k]), nm);
        if (p.id) el.addEventListener('click', () => c.pick(p.id!));
        return el;
      };
      const left = document.createElement('div'); left.className = 'side'; left.append(place(1), place(3)); // left hand, feet
      const mid = document.createElement('div'); mid.className = 'medal'; mid.innerHTML = portrait(c.gear, 118);
      const right = document.createElement('div'); right.className = 'side'; right.append(place(0), place(2)); // right hand, clothing
      fig.append(left, mid, right);
      const cap = document.createElement('p'); cap.className = 'figcap'; cap.textContent = c.caption;
      body.append(fig, cap);
      this.section(body, t('sac.inPack'));
      const grid = document.createElement('div'); grid.className = 'grid';
      for (const s of c.choices) grid.append(this.slot(s, false, () => c.pick(s.id)));
      body.append(grid);
      const hint = document.createElement('p'); hint.className = 'hint'; hint.textContent = c.choices.length ? c.hint : c.empty;
      body.append(hint);
    }
    for (const sec of m.sections) {
      this.section(body, sec.title);
      if (!sec.slots.length) { const p = document.createElement('p'); p.className = 'empty'; p.textContent = sec.empty ?? ''; body.append(p); continue; }
      const grid = document.createElement('div'); grid.className = 'grid';
      for (const s of sec.slots) grid.append(this.slot(s, m.selected === s.id, () => m.select(s.id)));
      body.append(grid);
    }
    if (sameTab) body.scrollTop = scroll;
    const d = document.createElement('div'); d.className = 'sheet-detail' + (m.detail ? ' on' : '');
    if (m.detail) {
      const what = document.createElement('div'); what.className = 'what';
      const b = document.createElement('b'); b.textContent = m.detail.name; what.append(b);
      for (const l of m.detail.lines) { const i = document.createElement('i'); i.textContent = l; what.append(i); }
      if (m.detail.actions.length) what.append(this.buttons(m.detail.actions));
      d.append(this.box(m.detail.id), what);
    }
    page.append(d);
  }

  /** The almanac: every recipe by use, numbered, what it needs and what the pack holds; those ready can be made. */
  showAlmanac(title: string, sub: string, groups: { key: string; title: string; cards: RecipeCard[] }[]): void {
    const scroll = this.shown === 'almanac' ? this.root.querySelector('.sheet-body')?.scrollTop ?? 0 : 0;
    this.shown = 'almanac';
    this.root.classList.remove('tabbed');
    const { body } = this.page(title, sub);
    let n = 0;
    for (const g of groups) {
      if (!g.cards.length) continue;
      const colour = USE_COLOUR[g.key] ?? '#c9b48a';
      const cat = document.createElement('div'); cat.className = 'cat';
      const sw = document.createElement('i'); sw.style.background = colour;
      cat.append(sw, g.title);
      body.append(cat);
      for (const c of g.cards) {
        const rec = document.createElement('div'); rec.className = 'rec ' + c.state;
        const band = document.createElement('div'); band.className = 'band'; band.style.background = colour;
        const inner = document.createElement('div'); inner.className = 'in';
        const num = document.createElement('div'); num.className = 'num'; num.textContent = ROMAN[n++] ?? String(n);
        const what = document.createElement('div'); what.className = 'what';
        const b = document.createElement('b'); b.textContent = c.name;
        const i = document.createElement('i'); i.textContent = c.text;
        what.append(b, i);
        if (c.state !== 'done') for (const need of c.needs) { // the ingredients, in dotted lines: what the pack holds / what it takes
          const row = document.createElement('div'); row.className = 'ing' + (need.have < need.need ? ' short' : '');
          const a = document.createElement('span'); a.textContent = need.name;
          const dots = document.createElement('span'); dots.className = 'dots';
          const q = document.createElement('span'); q.textContent = `${Math.min(need.have, need.need)} / ${need.need}`;
          row.append(a, dots, q); what.append(row);
        }
        if (c.state === 'ready') {
          const mk = document.createElement('button'); mk.className = 'make'; mk.textContent = t('almanac.make') + ' ›';
          mk.addEventListener('click', c.make);
          what.append(mk);
        } else {
          const st = document.createElement('div'); st.className = 'state'; st.textContent = t(c.state === 'done' ? 'almanac.done' : 'almanac.missing');
          what.append(st);
        }
        inner.append(num, what, this.box(c.id));
        rec.append(band, inner);
        body.append(rec);
      }
    }
    body.scrollTop = scroll;
  }
}
