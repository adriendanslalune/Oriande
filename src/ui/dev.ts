// The developers' corner (asked by Adrien): a small button by the version, a password, then the
// Djaaz Bot (golden winged boots, five times as fast) and a reset of the whole game, confirmed first.
// The password only keeps players out of it by accident: anyone reading the code could get round it.
import { t } from '../i18n';

const INK = '#2a241d';
/** SHA-256 of the password, so that it is not written out in the game's code. */
const HASH = '840307c8914d18b0cb01c3fa731d53a4962c1fdf1e4178e6af9150c016499ba8';
const UNLOCKED = 'oriande.dev';

const CSS = `
.dev-btn { position: fixed; left: 4px; bottom: calc(1px + env(safe-area-inset-bottom, 0px)); width: 18px; height: 18px; padding: 0; border: 0;
  background: none; color: #6a5f4f; opacity: .6; font: 12px/18px serif; cursor: pointer; z-index: 3; }
.dev-veil { position: fixed; inset: 0; background: rgba(42,36,29,.45); display: none; align-items: center; justify-content: center; z-index: 50; }
.dev-veil.on { display: flex; }
.dev-box { width: min(86vw, 320px); background: #f3e9cf; color: ${INK}; border: 2px solid ${INK}; outline: 1px solid ${INK}; outline-offset: -6px;
  padding: 18px 16px 14px; font: 15px/1.35 "IM Fell English", serif; text-align: center; }
.dev-box h3 { margin: 0 0 10px; font: 20px "IM Fell English SC", serif; letter-spacing: .05em; }
.dev-box input { width: 100%; box-sizing: border-box; padding: 7px 8px; font: 16px "Old Standard TT", serif; border: 1.5px solid ${INK}; background: #fbf6e6; color: ${INK}; }
.dev-box p { margin: 8px 0; }
.dev-box .err { color: #a83428; font-style: italic; min-height: 1.2em; }
.dev-box button { display: block; width: 100%; margin-top: 8px; padding: 8px; font: 15px "IM Fell English SC", serif; letter-spacing: .05em; color: ${INK};
  background: #e4d4ae; border: 1.5px solid ${INK}; box-shadow: 2px 2px 0 ${INK}; cursor: pointer; }
.dev-box button.gold { background: #e8c25e; }
.dev-box button.danger { background: #b8402f; color: #f6eed8; }
.dev-box button.plain { background: none; box-shadow: none; border-color: transparent; text-decoration: underline; }
`;

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const unlocked = (): boolean => { try { return sessionStorage.getItem(UNLOCKED) === '1'; } catch { return false; } };

/** The little button and the panel it opens. */
export class DevPanel {
  private readonly root: HTMLElement[];
  private readonly veil: HTMLElement;
  private readonly box: HTMLElement;

  constructor(private readonly act: { boots(): void; reset(): void }) {
    const style = document.createElement('style'); style.textContent = CSS;
    const btn = document.createElement('button'); btn.className = 'dev-btn'; btn.textContent = '⚙';
    btn.setAttribute('aria-label', t('dev.button'));
    btn.addEventListener('click', () => this.open());
    this.veil = document.createElement('div'); this.veil.className = 'dev-veil';
    this.box = document.createElement('div'); this.box.className = 'dev-box'; this.box.setAttribute('role', 'dialog');
    this.veil.append(this.box);
    this.veil.addEventListener('click', (e) => { if (e.target === this.veil) this.close(); });
    this.root = [style, btn, this.veil];
    document.body.append(...this.root);
  }

  private open(): void { this.veil.classList.add('on'); if (unlocked()) this.tools(); else this.ask(); }
  private close(): void { this.veil.classList.remove('on'); }

  private button(label: string, cls: string, fn: () => void): HTMLButtonElement {
    const b = document.createElement('button'); b.textContent = label; if (cls) b.className = cls;
    b.addEventListener('click', fn); return b;
  }

  /** The password. */
  private ask(): void {
    const h = document.createElement('h3'); h.textContent = t('dev.title');
    const input = document.createElement('input'); input.type = 'password'; input.placeholder = t('dev.password'); input.autocomplete = 'off';
    const err = document.createElement('p'); err.className = 'err';
    const go = async (): Promise<void> => {
      let ok = false;
      try { ok = (await sha256(input.value.trim())) === HASH; } catch { ok = false; }
      if (!ok) { err.textContent = t('dev.wrong'); input.select(); return; }
      try { sessionStorage.setItem(UNLOCKED, '1'); } catch { /* private mode */ }
      this.tools();
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') void go(); });
    this.box.replaceChildren(h, input, err, this.button(t('dev.open'), '', () => void go()), this.button(t('dev.close'), 'plain', () => this.close()));
    setTimeout(() => input.focus(), 50);
  }

  /** The tools: the boots, the reset. */
  private tools(): void {
    const h = document.createElement('h3'); h.textContent = t('dev.title');
    this.box.replaceChildren(h,
      this.button(t('dev.boots'), 'gold', () => { this.act.boots(); this.close(); }),
      this.button(t('dev.reset'), 'danger', () => this.confirmReset()),
      this.button(t('dev.close'), 'plain', () => this.close()));
  }

  /** Asked before anything is erased. */
  private confirmReset(): void {
    const h = document.createElement('h3'); h.textContent = t('dev.reset');
    const p = document.createElement('p'); p.textContent = t('dev.resetAsk');
    this.box.replaceChildren(h, p,
      this.button(t('dev.resetYes'), 'danger', () => this.act.reset()),
      this.button(t('dev.cancel'), '', () => this.tools()));
  }

  destroy(): void { for (const e of this.root) e.remove(); }
}
