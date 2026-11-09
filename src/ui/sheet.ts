// The explorer's pack and the almanac of recipes, as pages of an old atlas (asked by Adrien: Jules
// Verne / Moebius, clear compartments, things shown in slots with their picture and how many).
// Plain DOM, built from models the map scene gives; no game rules here.
import { t } from '../i18n';
import { itemPicture } from './itemArt';
import { portrait, type Carried } from './portrait';

const CSS = `
.sheet { position: fixed; inset: 0; display: none; z-index: 4; background: rgba(42,36,29,.18); }
.sheet.on { display: block; }
.sheet-page { position: absolute; left: 50%; transform: translateX(-50%); top: calc(env(safe-area-inset-top, 0px) + 96px); bottom: calc(10px + env(safe-area-inset-bottom, 0px));
  width: min(94vw, 540px); background: #ede4c9; color: #2a241d; border: 1.5px solid #2a241d; outline: 1px solid #2a241d; outline-offset: 3px;
  box-shadow: 0 6px 24px rgba(42,36,29,.35); display: flex; flex-direction: column; }
.sheet-head { padding: 12px 16px 8px; border-bottom: 3px double #2a241d; position: relative; }
.sheet-head h2 { margin: 0; font: 22px/1.1 "IM Fell English SC", serif; letter-spacing: .05em; text-align: center; }
.sheet-head .sub { font: italic 14px "IM Fell English", serif; color: #6a5f4f; text-align: center; margin-top: 2px; }
.sheet-head .close { position: absolute; right: 6px; top: 6px; width: 36px; height: 36px; border: 0; background: none; font: 24px/36px serif; color: #2a241d; cursor: pointer; }
.sheet-body { flex: 1; overflow-y: auto; padding: 4px 14px 14px; }
.sheet-body h3 { font: 15px "IM Fell English SC", serif; letter-spacing: .08em; margin: 14px 0 8px; display: flex; align-items: center; gap: 8px; color: #2a241d; }
.sheet-body h3::before, .sheet-body h3::after { content: ''; flex: 1; border-top: 1px solid #2a241d; opacity: .5; }
.sheet-body h3 span { flex: none; }
.sheet .empty { font: italic 14px "IM Fell English", serif; color: #6a5f4f; text-align: center; margin: 4px 0 8px; }
.sheet .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(74px, 1fr)); gap: 8px; }
.sheet .slot { position: relative; aspect-ratio: 1; border: 1.5px solid #2a241d; background: #e4d8b8; box-shadow: inset 0 0 0 3px #ede4c9, inset 0 0 0 4px rgba(42,36,29,.5);
  display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4px 2px 2px; cursor: pointer; color: #2a241d; touch-action: manipulation; }
.sheet .slot.sel { border-width: 2.5px; background: #d9c99c; }
.sheet .slot .pic { display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; }
.sheet .slot .nm { font: italic 11px/1.1 "IM Fell English", serif; text-align: center; margin-top: 2px; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sheet .slot .n { position: absolute; right: 5px; top: 3px; font: 700 13px "Old Standard TT", serif; }
.sheet .slot.worn::after { content: ''; position: absolute; left: 6px; top: 6px; width: 7px; height: 7px; border-radius: 50%; background: #46602f; }
.sheet-detail { border-top: 3px double #2a241d; padding: 10px 14px calc(10px + env(safe-area-inset-bottom, 0px)); display: none; gap: 12px; align-items: flex-start; background: #e9dfc2; }
.sheet-detail.on { display: flex; }
.sheet-detail .big { flex: none; width: 64px; height: 64px; border: 1.5px solid #2a241d; display: flex; align-items: center; justify-content: center; background: #e4d8b8; }
.sheet-detail .big .pic { width: 56px; height: 56px; display: flex; align-items: center; justify-content: center; }
.sheet-detail .what { flex: 1; min-width: 0; }
.sheet-detail .what b { display: block; font: 700 16px "Old Standard TT", serif; text-transform: uppercase; letter-spacing: .04em; }
.sheet-detail .what i { display: block; font: italic 14px/1.3 "IM Fell English", serif; color: #4f4537; }
.sheet .acts { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.sheet .acts button, .sheet .card .make { font: 700 13px "Old Standard TT", serif; text-transform: uppercase; letter-spacing: .05em; color: #ede4c9; background: #2a241d;
  border: 1.5px solid #2a241d; padding: 8px 12px; cursor: pointer; touch-action: manipulation; }
.sheet .acts button:disabled { background: none; color: #9a8f7f; border-color: #9a8f7f; cursor: default; }
.sheet .card { display: flex; gap: 12px; padding: 10px; margin-bottom: 8px; border: 1.5px solid #2a241d; background: #e8ddbf; align-items: flex-start; }
.sheet .card.ready { background: #e1e3bf; box-shadow: inset 5px 0 0 #6d8a45; }
.sheet .card.done, .sheet .card.missing { opacity: .8; }
.sheet .card .big { flex: none; width: 60px; height: 60px; border: 1.5px solid #2a241d; display: flex; align-items: center; justify-content: center; background: #e4d8b8; }
.sheet .card .what { flex: 1; min-width: 0; }
.sheet .card .what b { display: block; font: 700 15px "Old Standard TT", serif; text-transform: uppercase; letter-spacing: .04em; }
.sheet .card .what i { display: block; font: italic 13px/1.3 "IM Fell English", serif; color: #4f4537; }
.sheet .needs { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.sheet .need { display: flex; align-items: center; gap: 3px; font: 700 13px "Old Standard TT", serif; border: 1px solid rgba(42,36,29,.5); padding: 2px 6px 2px 2px; background: #ede4c9; }
.sheet .need .pic { width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; }
.sheet .need.short { color: #a83428; border-color: #a83428; }
.sheet .card .state { font: italic 13px "IM Fell English", serif; color: #6a5f4f; margin-top: 6px; }
.sheet .card .make { margin-top: 8px; background: #46602f; border-color: #2a241d; }
.sheet-tabs { display: flex; border-bottom: 1.5px solid #2a241d; padding: 0 10px; gap: 4px; margin-top: 6px; }
.sheet-tabs button { flex: 1; font: 14px "IM Fell English SC", serif; letter-spacing: .05em; color: #6a5f4f; background: #e2d6b4; border: 1.5px solid #2a241d;
  border-bottom: 0; padding: 7px 2px 5px; margin-bottom: -1.5px; cursor: pointer; touch-action: manipulation; }
.sheet-tabs button.on { background: #ede4c9; color: #2a241d; padding-top: 9px; }
.sheet .figure { display: grid; grid-template-columns: 1fr auto 1fr; gap: 6px; align-items: center; justify-items: center; margin: 8px 0 4px; }
.sheet .figure .side { display: flex; flex-direction: column; gap: 10px; align-items: center; }
.sheet .figure .lbl { font: 12px "IM Fell English SC", serif; letter-spacing: .05em; color: #6a5f4f; text-align: center; }
.sheet .figure .slot { width: 74px; }
.sheet .figure .slot.void { background: #ede4c9; border-style: dashed; cursor: default; }
.sheet .hint { font: italic 13px "IM Fell English", serif; color: #6a5f4f; text-align: center; margin: 2px 0 6px; }
`;

/** A slot in the pack: a thing, how many, its picture; tapping it shows its card below. */
export interface Slot { id: string; name: string; count: number; worn?: boolean }
export interface SacModel {
  title: string; sub: string;
  /** the tabs, and the one shown */
  tabs: { key: string; label: string }[]; tab: string; setTab: (key: string) => void;
  /** the "Carried" tab: the explorer drawn with his equipment, its places, what can be taken up */
  carried?: { gear: Carried; places: { label: string; id: string | null; name: string }[]; choices: Slot[]; pick: (id: string) => void; hint: string; empty: string };
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

  private page(title: string, sub: string): { page: HTMLElement; body: HTMLElement } {
    const page = document.createElement('div'); page.className = 'sheet-page';
    const header = document.querySelector('.hud-header') as HTMLElement | null; // the page starts under the header
    if (header) page.style.top = header.offsetHeight + 8 + 'px';
    const head = document.createElement('div'); head.className = 'sheet-head';
    const h = document.createElement('h2'); h.textContent = title;
    const p = document.createElement('div'); p.className = 'sub'; p.textContent = sub;
    const x = document.createElement('button'); x.className = 'close'; x.textContent = '×'; x.setAttribute('aria-label', t('walk.cancel'));
    x.addEventListener('click', () => this.hide());
    head.append(h, p, x);
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

  /** A slot button: the picture, the name, how many. */
  private slot(s: Slot, sel: boolean, onClick: (() => void) | null): HTMLElement {
    const b = document.createElement('button');
    b.className = 'slot' + (sel ? ' sel' : '') + (s.worn ? ' worn' : '');
    b.setAttribute('aria-label', s.name + (s.count > 1 ? ' × ' + s.count : ''));
    b.innerHTML = itemPicture(s.id, 40);
    const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = s.name;
    b.append(nm);
    if (s.count > 1) { const n = document.createElement('span'); n.className = 'n'; n.textContent = String(s.count); b.append(n); }
    if (onClick) b.addEventListener('click', onClick);
    return b;
  }

  /** The pack: tabs (what is carried, tools, food, materials), slots, and the card of the thing tapped. */
  showSac(m: SacModel): void {
    const scroll = this.shown === 'sac' ? this.root.querySelector('.sheet-body')?.scrollTop ?? 0 : 0;
    const sameTab = this.shown === 'sac' && this.root.dataset.tab === m.tab;
    this.shown = 'sac'; this.root.dataset.tab = m.tab;
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
      // the explorer, with a place on each side for what he holds and wears
      const c = m.carried, fig = document.createElement('div'); fig.className = 'figure';
      const place = (k: number): HTMLElement => {
        const p = c.places[k], box = document.createElement('div'); box.className = 'side';
        const lbl = document.createElement('div'); lbl.className = 'lbl'; lbl.textContent = p.label;
        const sl = p.id ? this.slot({ id: p.id, name: p.name, count: 1, worn: true }, false, () => c.pick(p.id!)) : document.createElement('div');
        if (!p.id) { sl.className = 'slot void'; }
        box.append(lbl, sl);
        return box;
      };
      const left = document.createElement('div'); left.className = 'side'; left.append(place(1), place(2));
      const mid = document.createElement('div'); mid.innerHTML = portrait(c.gear, 128);
      const right = document.createElement('div'); right.className = 'side'; right.append(place(0));
      fig.append(left, mid, right);
      body.append(fig);
      const hint = document.createElement('p'); hint.className = 'hint'; hint.textContent = c.choices.length ? c.hint : c.empty;
      body.append(hint);
      const grid = document.createElement('div'); grid.className = 'grid';
      for (const s of c.choices) grid.append(this.slot(s, false, () => c.pick(s.id)));
      body.append(grid);
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
      const big = document.createElement('div'); big.className = 'big'; big.innerHTML = itemPicture(m.detail.id, 56);
      const what = document.createElement('div'); what.className = 'what';
      const b = document.createElement('b'); b.textContent = m.detail.name; what.append(b);
      for (const l of m.detail.lines) { const i = document.createElement('i'); i.textContent = l; what.append(i); }
      if (m.detail.actions.length) what.append(this.buttons(m.detail.actions));
      d.append(big, what);
    }
    page.append(d);
  }

  /** The almanac: every recipe, what it needs and what the pack holds; those ready can be made. */
  showAlmanac(title: string, sub: string, groups: { title: string; cards: RecipeCard[] }[]): void {
    const scroll = this.shown === 'almanac' ? this.root.querySelector('.sheet-body')?.scrollTop ?? 0 : 0;
    this.shown = 'almanac';
    const { body } = this.page(title, sub);
    for (const g of groups) {
    if (!g.cards.length) continue;
    this.section(body, g.title);
    for (const c of g.cards) {
      const card = document.createElement('div'); card.className = 'card ' + c.state;
      const big = document.createElement('div'); big.className = 'big'; big.innerHTML = itemPicture(c.id, 50);
      const what = document.createElement('div'); what.className = 'what';
      const b = document.createElement('b'); b.textContent = c.name;
      const i = document.createElement('i'); i.textContent = c.text;
      what.append(b, i);
      const needs = document.createElement('div'); needs.className = 'needs';
      for (const n of c.needs) {
        const el = document.createElement('span'); el.className = 'need' + (n.have < n.need ? ' short' : '');
        el.title = n.name; el.innerHTML = itemPicture(n.id, 22); el.append(`${Math.min(n.have, n.need)}/${n.need} ${n.name.toLowerCase()}`);
        needs.append(el);
      }
      if (c.state !== 'done') what.append(needs); // what it took no longer matters once made
      if (c.state === 'ready') {
        const mk = document.createElement('button'); mk.className = 'make'; mk.textContent = t('almanac.make') + ' ›';
        mk.addEventListener('click', c.make);
        what.append(mk);
      } else {
        const st = document.createElement('div'); st.className = 'state'; st.textContent = t(c.state === 'done' ? 'almanac.done' : 'almanac.missing');
        what.append(st);
      }
      card.append(big, what);
      body.append(card);
    }
    }
    body.scrollTop = scroll;
  }
}
