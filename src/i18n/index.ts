import fr from './fr.json';
import en from './en.json';

export type Lang = 'fr' | 'en';
type Dict = Record<string, string>;

const dicts: Record<Lang, Dict> = { fr, en };
const STORAGE_KEY = 'oriande.lang';

function detect(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'fr' || saved === 'en') return saved;
  } catch { /* storage unavailable */ }
  const nav = typeof navigator !== 'undefined' ? navigator.language : 'fr';
  return nav.toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

let current: Lang = detect();

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang): void {
  current = lang;
  try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* ignore */ }
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
}

/** Translate a key, with optional {name} interpolation. Falls back to French, then the key. */
export function t(key: string, params?: Record<string, string | number>): string {
  let s = dicts[current][key] ?? dicts.fr[key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}
