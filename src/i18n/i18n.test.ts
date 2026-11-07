import { describe, expect, it } from 'vitest';
import fr from './fr.json';
import en from './en.json';
import { setLang, t } from './index';

describe('i18n', () => {
  it('fr and en define the same keys', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(fr).sort());
  });

  it('translates and falls back to the key', () => {
    setLang('en');
    expect(t('subtitle')).toBe('Map of the Strange Lands');
    setLang('fr');
    expect(t('subtitle')).toBe('Carte des Terres Étranges');
    expect(t('missing.key')).toBe('missing.key');
  });
});
