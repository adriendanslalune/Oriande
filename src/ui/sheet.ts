// The explorer's pack and the almanac of recipes, as plates of an old atlas (asked by Adrien: a
// blend of an engraved Hetzel edition of Jules Verne and Moebius's calm "ligne claire"): an
// engraved frame with fleurons in the corners and foxed paper; at the head, a little landscape in
// flat soft colours under a ribbon banner; the explorer in an oval medallion ("Fig. 1"); slots as
// specimen boxes with brass pins, tinted; recipes with their ingredients in dotted lines, a
// coloured band by use. Plain DOM, built from models the map scene gives.
import { t } from '../i18n';
import { itemPicture } from './itemArt';
import { portrait, type Carried } from './portrait';
import { emblem, ribbon, skyline } from './townSigns';

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
.sheet-detail .box { width: 64px; height: 64px; flex: none; }
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
body.sheet-open .hud-buttons { display: none; }
.sheet .kind { text-align: center; font: 14px "IM Fell English SC", serif; letter-spacing: .1em; }
.sheet .flav { margin: 6px 8px 0; font: italic 15px/1.35 "IM Fell English", serif; text-align: center; }
.sheet .purse { text-align: center; font: italic 13px "IM Fell English", serif; color: #5a4a36; margin-top: 6px; }
.sheet .townhead { position: relative; flex: none; margin: 4px 4px 0; padding: 14px 0 0; display: flex; flex-direction: column; align-items: center; }
.sheet .townhead .skyline { display: block; width: 100%; height: 96px; -webkit-mask-image: linear-gradient(90deg, transparent, #000 14%, #000 86%, transparent); mask-image: linear-gradient(90deg, transparent, #000 14%, #000 86%, transparent); }
.sheet .townhead .emblem { margin-top: 18px; }
.sheet .emblem.art { mix-blend-mode: multiply; object-fit: contain; }
.sheet .townhead .ribbon { width: min(86%, 330px); height: auto; margin-top: -6px; }
.sheet .townhead .close, .sheet .townhead .back { position: absolute; top: 6px; z-index: 3; font: 14px "IM Fell English SC", serif; letter-spacing: .05em; color: ${INK}; background: #f3e9cf; border: 1.5px solid ${INK}; padding: 3px 9px; cursor: pointer; }
.sheet .townhead .close { right: 6px; font: 18px/1 serif; padding: 3px 8px; }
.sheet .townhead .back { left: 6px; }
.sheet .vh { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
.sheet .placecard .sign { display: flex; flex-direction: column; align-items: center; padding: 10px 4px 0; }
.sheet .placecard .sign .ribbon { width: 100%; height: auto; margin-top: -4px; }
.sheet .places { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.sheet .placecard { display: block; text-align: left; padding: 0; border: 1.5px solid ${INK}; background: #f6eed8; box-shadow: 2px 2px 0 ${INK}; cursor: pointer; color: ${INK}; touch-action: manipulation; }
.sheet .placecard i { display: block; font: italic 13px/1.25 "IM Fell English", serif; color: #5a4a36; padding: 0 8px 9px; text-align: center; }
.sheet .placecard:disabled { opacity: .45; box-shadow: none; cursor: default; }
.sheet .leave { display: block; margin: 14px auto 6px; width: 72%; padding: 8px; border: 1.5px solid ${INK}; font: 15px "IM Fell English SC", serif; letter-spacing: .08em; color: ${INK}; background: #e4d4ae; box-shadow: 2px 2px 0 ${INK}; cursor: pointer; }
.sheet .say { margin: 2px 8px 0; padding: 4px 6px; font: italic 15px/1.35 "IM Fell English", serif; text-align: center; color: #3a3024; }
.sheet .stabs { display: flex; margin: 12px 0 0; border-bottom: 1.5px solid ${INK}; }
.sheet .stabs button { flex: 1; padding: 6px 0 4px; font: 15px "IM Fell English SC", serif; letter-spacing: .05em; color: #6d5c46; border: 1.5px solid ${INK}; border-bottom: 0; margin-right: -1.5px; background: #e4d4ae; cursor: pointer; }
.sheet .stabs button.on { background: #f3e9cf; color: ${INK}; position: relative; top: 1.5px; }
.sheet .stall { border: 1.5px solid ${INK}; border-top: 0; padding: 14px 8px 10px; }
.sheet .stall .grid { grid-template-columns: repeat(auto-fill, minmax(84px, 1fr)); gap: 16px 8px; }
.sheet .tag { display: inline-block; position: relative; margin-top: -9px; z-index: 1; font: 700 13px "Old Standard TT", serif; background: #f6e7b5; border: 1px solid ${INK}; padding: 0 6px 0 11px;
  clip-path: polygon(8px 0, 100% 0, 100% 100%, 8px 100%, 0 50%); white-space: nowrap; }
.sheet .slot.poor .tag { background: #e8c8bd; color: #8a2a1e; }
.sheet .scroll { margin: 16px 12px 4px; padding: 14px 18px; position: relative; background: #fbf3dc; border-left: 1.5px solid ${INK}; border-right: 1.5px solid ${INK}; font: italic 16px/1.4 "IM Fell English", serif; text-align: center; }
.sheet .scroll::before, .sheet .scroll::after { content: ''; position: absolute; left: -10px; right: -10px; height: 12px; border: 1.5px solid ${INK}; border-radius: 6px; background: #e8d6a8; }
.sheet .scroll::before { top: -7px; } .sheet .scroll::after { bottom: -7px; }
.sheet .dish { display: flex; align-items: center; gap: 10px; width: 100%; padding: 8px 4px; border: 0; border-bottom: 1px dotted ${INK}; background: none; font: 15px "IM Fell English", serif; color: ${INK}; text-align: left; cursor: pointer; }
.sheet .dish .box { width: 48px; height: 48px; flex: none; }
.sheet .dish .txt { flex: 1; }
.sheet .dish .txt i { display: block; font-size: 13px; color: #5a4a36; }
.sheet .dish:disabled { opacity: .5; cursor: default; }
.sheet .innbed { display: flex; flex-direction: column; align-items: center; gap: 6px; margin-top: 14px; }
.sheet .innbed .acts { flex-direction: column; align-items: stretch; width: 78%; gap: 10px; }
.sheet .acts button small { display: block; font: italic 13px "IM Fell English", serif; letter-spacing: 0; text-transform: none; opacity: .9; margin-top: 1px; }
.sheet .rest { margin: 8px 10px 0; padding: 5px 8px; border: 1px dashed ${INK}; font: italic 13px/1.3 "IM Fell English", serif; text-align: center; color: #3a3024; background: #f6edd2; }
.sheet .rest.new { background: #e7efd2; border-style: solid; }
.sheet .rec .box { width: 56px; height: 56px; flex: none; align-self: flex-start; }
.sheet .rec .what { flex: 1; min-width: 0; }
.sheet .rec b { display: block; font: 16px "IM Fell English SC", serif; letter-spacing: .05em; }
.sheet .rec .what > i { display: block; font: italic 13px/1.3 "IM Fell English", serif; color: #5a4a36; margin-bottom: 3px; }
.sheet .ing { display: flex; font: 14px "IM Fell English", serif; line-height: 1.4; }
.sheet .ing .dots { flex: 1; border-bottom: 1px dotted ${INK}; margin: 0 4px 5px; }
.sheet .ing.short { color: #9c2e20; }
.sheet .rec .state { font: italic 13px "IM Fell English", serif; color: #7a6a52; margin-top: 3px; }
.sheet .make { margin-top: 8px; }
.sheet.book .sheet-page { width: min(calc(94vw - 30px), 510px); margin-left: -15px; }
.sheet .thumbs { position: absolute; right: -31px; top: 120px; display: flex; flex-direction: column; gap: 4px; z-index: 1; }
.sheet .thumbs button { position: relative; width: 30px; min-height: 64px; padding: 8px 0; border: 1.5px solid ${INK}; border-left: 0; border-radius: 0 7px 7px 0;
  writing-mode: vertical-rl; font: 13px "IM Fell English SC", serif; letter-spacing: .06em; color: ${INK}; cursor: pointer; touch-action: manipulation;
  box-shadow: 2px 1px 0 rgba(43,33,23,.35); filter: saturate(.7) brightness(.95); }
.sheet .thumbs button.on { width: 34px; margin-left: -4px; filter: none; box-shadow: 3px 1px 0 rgba(43,33,23,.45); }
.sheet .thumbs button .ready { position: absolute; right: -9px; top: -6px; writing-mode: horizontal-tb; min-width: 16px; height: 16px; border-radius: 8px;
  background: #5f7d3c; color: #f6eed8; border: 1px solid ${INK}; font: 700 11px/14px "Old Standard TT", serif; text-align: center; }
`;

/** Colours of the uses of things: the band on a recipe, the swatch by its heading. */
const USE_COLOUR: Record<string, string> = { soin: '#c98a8a', combat: '#c9a06a', chasse: '#b07a5a', recolte: '#8fa36a', peche: '#7fa3b0', feu: '#d98c4a', voyage: '#a08cb0' };
/** Tints of the four places on the explorer: right hand, left hand, clothing, feet. */
const PLACE_TINT = ['#d8c9a4', '#f0cf8c', '#c79e78', '#bfae8c'];

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
  shown: 'sac' | 'almanac' | 'town' | null = null;

  constructor(private readonly onClose: () => void) {
    this.style = document.createElement('style'); this.style.textContent = CSS;
    this.root = document.createElement('div'); this.root.className = 'sheet';
    this.root.addEventListener('click', (e) => { if (e.target === this.root) this.hide(); });
    document.body.append(this.style, this.root);
  }

  destroy(): void { this.root.remove(); this.style.remove(); document.body.classList.remove('sheet-open'); }

  hide(): void { if (!this.shown) return; this.root.classList.remove('on'); document.body.classList.remove('sheet-open'); this.shown = null; this.onClose(); }

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
    document.body.classList.add('sheet-open'); // the map's buttons step aside
    return { page, body };
  }

  private section(body: HTMLElement, title: string): void {
    const h = document.createElement('h3'); const sp = document.createElement('span'); sp.textContent = title; h.append(sp); body.append(h);
  }

  private buttons(actions: { label: string; sub?: string; use: (() => void) | null }[]): HTMLElement {
    const acts = document.createElement('div'); acts.className = 'acts';
    for (const a of actions) {
      const b = document.createElement('button'); b.textContent = a.label; b.disabled = !a.use;
      if (a.sub) { const sm = document.createElement('small'); sm.textContent = a.sub; b.append(sm); }
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
    this.root.classList.add('tabbed'); this.root.classList.remove('book', 'town');
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
  showAlmanac(title: string, sub: string, groups: { key: string; title: string; cards: RecipeCard[] }[], open: string, setOpen: (key: string) => void): void {
    const same = this.shown === 'almanac' && this.root.dataset.tab === open;
    const scroll = same ? this.root.querySelector('.sheet-body')?.scrollTop ?? 0 : 0;
    this.shown = 'almanac'; this.root.dataset.tab = open;
    this.root.classList.remove('tabbed', 'town'); this.root.classList.add('book');
    const { page, body } = this.page(title, sub);
    // thumb tabs on the edge of the book, one by use, with how many recipes are ready there
    const thumbs = document.createElement('div'); thumbs.className = 'thumbs'; thumbs.setAttribute('role', 'tablist');
    for (const g of groups) {
      if (!g.cards.length) continue;
      const b = document.createElement('button'); b.setAttribute('role', 'tab'); b.textContent = g.title;
      b.style.background = USE_COLOUR[g.key] ?? '#c9b48a';
      if (g.key === open) { b.className = 'on'; b.setAttribute('aria-selected', 'true'); }
      const ready = g.cards.filter((c) => c.state === 'ready').length;
      if (ready) { const r = document.createElement('span'); r.className = 'ready'; r.textContent = String(ready); b.append(r); }
      b.addEventListener('click', () => setOpen(g.key));
      thumbs.append(b);
    }
    page.append(thumbs);
    for (const g of groups) {
      if (!g.cards.length) continue;
      if (g.key !== open) continue;
      const colour = USE_COLOUR[g.key] ?? '#c9b48a';
      const cat = document.createElement('div'); cat.className = 'cat';
      const sw = document.createElement('i'); sw.style.background = colour;
      cat.append(sw, g.title);
      body.append(cat);
      for (const c of g.cards) {
        const rec = document.createElement('div'); rec.className = 'rec ' + c.state;
        const band = document.createElement('div'); band.className = 'band'; band.style.background = colour;
        const inner = document.createElement('div'); inner.className = 'in';
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
        inner.append(what, this.box(c.id));
        rec.append(band, inner);
        body.append(rec);
      }
    }
    if (same) body.scrollTop = scroll;
  }

  // ---- towns ----

  /**
   * A town page. At its head, for the square: the town's outline in one line, its name on a ribbon;
   * for a place: its big emblem over its name on a ribbon. Back (to the square) or close.
   */
  private townPage(head: string, title: string, back: { label: string; go: () => void } | null): HTMLElement {
    const page = document.createElement('div'); page.className = 'sheet-page';
    const header = document.querySelector('.hud-header') as HTMLElement | null;
    page.style.top = (header ? header.offsetHeight : 90) + 8 + 'px';
    for (const [pos, tf] of [['left:-1px;top:-1px', ''], ['right:-1px;top:-1px', 'scaleX(-1)'], ['left:-1px;bottom:-1px', 'scaleY(-1)'], ['right:-1px;bottom:-1px', 'scale(-1)']]) {
      const f = document.createElement('span'); f.className = 'fleuron'; f.style.cssText = pos + (tf ? ';transform:' + tf : ''); f.innerHTML = FLEURON; page.append(f);
    }
    const top = document.createElement('div'); top.className = 'townhead';
    top.innerHTML = head + ribbon(title);
    const h = document.createElement('h2'); h.className = 'vh'; h.textContent = title; top.append(h); // for screen readers
    if (back) { const b = document.createElement('button'); b.className = 'back'; b.textContent = '‹ ' + back.label; b.addEventListener('click', back.go); top.append(b); }
    const x = document.createElement('button'); x.className = 'close'; x.textContent = '×'; x.setAttribute('aria-label', t('walk.cancel'));
    x.addEventListener('click', () => this.hide()); top.append(x);
    const body = document.createElement('div'); body.className = 'sheet-body';
    page.append(top, body);
    this.root.replaceChildren(page);
    this.root.classList.remove('tabbed', 'book'); this.root.classList.add('on', 'town');
    document.body.classList.add('sheet-open');
    return body;
  }

  /** What the keeper of a place says (no face: one would have to be drawn for every town). */
  private keeper(body: HTMLElement, say: string): void {
    const sy = document.createElement('div'); sy.className = 'say'; sy.textContent = say; body.append(sy);
  }

  /** Arriving in a town: its view, its name, a word of welcome, its places, the road on. */
  showTownSquare(m: TownSquare): void {
    this.shown = 'town';
    const body = this.townPage(skyline(m.seed, m.city), m.name, null);
    const k = document.createElement('div'); k.className = 'kind'; k.textContent = m.kind;
    const f = document.createElement('div'); f.className = 'flav'; f.textContent = m.flavour;
    const p = document.createElement('div'); p.className = 'purse'; p.textContent = m.purse;
    const r = document.createElement('div'); r.className = 'rest' + (m.restNew ? ' new' : ''); r.textContent = '⚑ ' + m.rest;
    body.append(k, f, p, r);
    this.section(body, m.placesTitle);
    const grid = document.createElement('div'); grid.className = 'places';
    for (const pl of m.places) {
      const b = document.createElement('button'); b.className = 'placecard'; b.disabled = !pl.open;
      const sign = document.createElement('div'); sign.className = 'sign'; sign.innerHTML = emblem(pl.key, 52) + ribbon(pl.title);
      const ln = document.createElement('i'); ln.textContent = pl.line;
      b.setAttribute('aria-label', pl.title); b.append(sign, ln);
      if (pl.open) b.addEventListener('click', pl.go);
      grid.append(b);
    }
    body.append(grid);
    const leave = document.createElement('button'); leave.className = 'leave'; leave.textContent = m.leave + ' ›';
    leave.addEventListener('click', () => this.hide());
    body.append(leave);
  }

  /** A place in town: its picture, what its keeper says, and what is done there. */
  showTownPlace(m: TownPlace): void {
    const same = this.shown === 'town' && this.root.dataset.tab === m.key + (m.tab ?? '');
    const scroll = same ? this.root.querySelector('.sheet-body')?.scrollTop ?? 0 : 0;
    this.shown = 'town'; this.root.dataset.tab = m.key + (m.tab ?? '');
    const body = this.townPage(emblem(m.key, 76), m.title, m.back);
    this.keeper(body, m.say);
    if (m.rumor) { const sc = document.createElement('div'); sc.className = 'scroll'; sc.textContent = m.rumor; body.append(sc); }
    if (m.actions) { const w = document.createElement('div'); w.className = 'innbed'; w.append(this.buttons(m.actions)); body.append(w); if (m.note) { const n = document.createElement('p'); n.className = 'hint'; n.textContent = m.note; body.append(n); } }
    if (m.tabs) {
      const tabs = document.createElement('div'); tabs.className = 'stabs';
      for (const tb of m.tabs) { const b = document.createElement('button'); b.textContent = tb.label; if (tb.key === m.tab) b.className = 'on'; b.addEventListener('click', () => m.setTab!(tb.key)); tabs.append(b); }
      body.append(tabs);
    }
    if (m.wares) {
      const stall = document.createElement('div'); stall.className = 'stall';
      if (!m.tabs) stall.style.borderTop = '1.5px solid ' + INK;
      if (!m.wares.length) { const p = document.createElement('p'); p.className = 'empty'; p.textContent = m.empty ?? ''; stall.append(p); }
      const grid = document.createElement('div'); grid.className = 'grid';
      for (const w of m.wares) {
        const sl = this.slot({ id: w.id, name: w.name, count: w.count ?? 1 }, m.selected === w.id, () => m.select!(w.id));
        if (w.poor) sl.classList.add('poor');
        const tag = document.createElement('span'); tag.className = 'tag'; tag.textContent = w.price;
        sl.insertBefore(tag, sl.querySelector('.nm'));
        grid.append(sl);
      }
      stall.append(grid);
      body.append(stall);
    }
    if (m.dishes) {
      this.section(body, m.dishesTitle ?? '');
      for (const d of m.dishes) {
        const b = document.createElement('button'); b.className = 'dish'; b.disabled = !d.use;
        const txt = document.createElement('span'); txt.className = 'txt'; txt.textContent = d.name;
        const i = document.createElement('i'); i.textContent = d.sub; txt.append(i);
        const tag = document.createElement('span'); tag.className = 'tag'; tag.style.marginTop = '0'; tag.textContent = d.price;
        b.append(this.box(null), txt, tag);
        (b.firstChild as HTMLElement).className = 'box'; (b.firstChild as HTMLElement).textContent = '?';
        if (d.use) b.addEventListener('click', d.use);
        body.append(b);
      }
    }
    if (m.purse) { const p = document.createElement('div'); p.className = 'purse'; p.textContent = m.purse; body.append(p); }
    if (same) body.scrollTop = scroll;
    const d = document.createElement('div'); d.className = 'sheet-detail' + (m.detail ? ' on' : '');
    if (m.detail) {
      const what = document.createElement('div'); what.className = 'what';
      const b = document.createElement('b'); b.textContent = m.detail.name; what.append(b);
      for (const l of m.detail.lines) { const i = document.createElement('i'); i.textContent = l; what.append(i); }
      what.append(this.buttons(m.detail.actions));
      d.append(this.box(m.detail.id), what);
    }
    body.parentElement!.append(d);
  }
}

/** The square of a town, on arrival. */
export interface TownSquare {
  name: string; seed: string; city: boolean; kind: string; flavour: string; purse: string;
  placesTitle: string; leave: string; rest: string; restNew: boolean;
  places: { key: string; title: string; line: string; open: boolean; go: () => void }[];
}
/** A place in a town (inn, merchant, smith, tavern). */
export interface TownPlace {
  key: string; title: string; say: string;
  back: { label: string; go: () => void };
  rumor?: string;
  actions?: { label: string; sub?: string; use: (() => void) | null }[]; note?: string;
  tabs?: { key: string; label: string }[]; tab?: string; setTab?: (key: string) => void;
  wares?: { id: string; name: string; price: string; count?: number; poor?: boolean }[]; empty?: string;
  selected?: string | null; select?: (id: string) => void;
  detail?: { id: string; name: string; lines: string[]; actions: { label: string; use: (() => void) | null }[] } | null;
  dishes?: { id: string; name: string; sub: string; price: string; use: (() => void) | null }[]; dishesTitle?: string;
  purse?: string;
}
