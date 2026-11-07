import { hash2 } from './noise';

const SYLLABLES = ['ker', 'vor', 'ma', 'lun', 'tha', 'ber', 'sol', 'ny', 'ar', 'gal', 'mo', 'ré', 'zan', 'quil', 'dor', 'pha', 'ul', 'ost', 'vé', 'rak', 'nem', 'sil'];

/** A proper name built from 2–3 syllables, seeded by (i, j). */
export function properName(i: number, j: number): string {
  const n = 2 + Math.floor(hash2(i * 7, j * 3) * 2);
  let s = '';
  for (let k = 0; k < n; k++) s += SYLLABLES[Math.floor(hash2(i + k * 31, j - k * 17) * SYLLABLES.length)];
  return s[0].toUpperCase() + s.slice(1);
}

/** Size of the cells that hold one sea name, in world units. */
export const SEA_CELL = 2600;

export interface SeaLabel {
  x: number;
  y: number;
  /** i18n key, e.g. "sea.ocean.des" */
  key: string;
  name: string;
  /** rotation in radians */
  angle: number;
}

/** Candidate position and name of the sea label of cell (mi, mj). The caller checks it lies at sea. */
export function seaLabel(mi: number, mj: number): SeaLabel {
  const x = (mi + 0.5) * SEA_CELL + (hash2(mi, mj) - 0.5) * 900;
  const y = (mj + 0.5) * SEA_CELL + (hash2(mj, mi) - 0.5) * 900;
  const kind = hash2(mi * 3, mj * 5) < 0.5 ? 'sea' : 'ocean';
  const article = hash2(mi, mj * 7) < 0.5 ? 'de' : 'des';
  return { x, y, key: `sea.${kind}.${article}`, name: properName(mi + 900, mj - 900), angle: (hash2(mi * 11, mj) - 0.5) * 0.4 };
}
