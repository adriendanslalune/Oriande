// Minimal DOM HUD styled as an old atlas: header with counters, a cartouche for notes,
// and the zoom buttons. Same look as the proto. All text goes through i18n.
import { t } from '../i18n';

const CSS = `
.hud-header { position: fixed; left: 0; right: 0; top: 0; padding: calc(8px + env(safe-area-inset-top, 0px)) 14px 6px;
  background: #ece3cb; color: #2a241d; border-bottom: 3px double #2a241d; display: flex; justify-content: space-between;
  align-items: baseline; gap: 10px; pointer-events: none; z-index: 2; }
.hud-header .t { font: 19px/1.15 "IM Fell English SC", serif; letter-spacing: .04em; }
.hud-header .t .coords { font: italic 13px "IM Fell English", serif; letter-spacing: 0; }
.hud-header .c { font: 700 11px/1.3 "Old Standard TT", serif; text-align: right; letter-spacing: .06em; text-transform: uppercase; }
.hud-header .c i { font: italic 400 12px "IM Fell English", serif; text-transform: none; letter-spacing: 0; }
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
  private readonly leagues: HTMLElement;
  private readonly places: HTMLElement;
  private readonly eta: HTMLElement;
  private readonly coords: HTMLElement;
  private readonly note: HTMLElement;
  private noteTimer = 0;
  private noteImportant = false;
  private readonly queue: [string, string, number][] = [];
  private readonly root: HTMLElement[] = [];

  constructor(handlers: { zoomIn(): void; zoomOut(): void; center(): void }) {
    const style = document.createElement('style');
    style.textContent = CSS;
    const header = document.createElement('header');
    header.className = 'hud-header';
    header.innerHTML = '<div class="t"><span></span><br><i class="coords"></i></div><div class="c"><span></span><br><i></i><br><i></i></div>';
    header.querySelector('.t > span')!.textContent = t('title');
    this.coords = header.querySelector('.coords')!;
    [this.leagues, this.places, this.eta] = Array.from(header.querySelectorAll<HTMLElement>('.c > *:not(br)'));
    this.note = document.createElement('div');
    this.note.className = 'hud-note';
    this.note.setAttribute('role', 'status');
    const buttons = document.createElement('div');
    buttons.className = 'hud-buttons';
    for (const [label, aria, fn] of [['+', 'ui.zoomIn', handlers.zoomIn], ['−', 'ui.zoomOut', handlers.zoomOut], ['⌖', 'ui.center', handlers.center]] as const) {
      const b = document.createElement('button');
      b.textContent = label;
      b.setAttribute('aria-label', t(aria));
      b.addEventListener('click', fn);
      buttons.append(b);
    }
    this.root.push(style, header, this.note, buttons);
    document.body.append(...this.root);
  }

  /** Latitude and longitude of the explorer, under the title. */
  setCoords(text: string): void {
    if (this.coords.textContent !== text) this.coords.textContent = text;
  }

  setCounters(leagues: string, places: string, eta: string): void {
    if (this.leagues.textContent !== leagues) this.leagues.textContent = leagues;
    if (this.places.textContent !== places) this.places.textContent = places;
    if (this.eta.textContent !== eta) this.eta.textContent = eta;
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
