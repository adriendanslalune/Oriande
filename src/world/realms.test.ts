import { describe, expect, it } from 'vitest';
import { REALM_KINDS, realmAt, realms, searchRealms } from './realms';
import { nearestCopy } from './planet';
import { settlement } from './settlements';
import { TILE } from './terrain';
import { setLang, t } from '../i18n';
import { discover, newGame, type TravelEvent } from '../game/travel';

describe('fabulous lands', () => {
  it('each of the fifteen is on the planet once, far from the others', () => {
    const rs = realms();
    expect(rs.map((r) => r.kind).sort()).toEqual([...REALM_KINDS].sort());
    for (const a of rs) for (const b of rs) if (a !== b) expect(Math.hypot(nearestCopy(a.x, b.x) - b.x, a.y - b.y)).toBeGreaterThan(6_000);
  });

  it('their places are where a new search of the planet puts them', () => {
    expect(searchRealms().map((r) => [r.kind, r.x, r.y])).toEqual(realms().map((r) => [r.kind, r.x, r.y]));
  }, 120000);

  it('no town stands in one, and they are found at their heart', () => {
    for (const R of realms()) {
      expect(realmAt(R.x, R.y)?.realm.kind).toBe(R.kind);
      const ti = Math.floor(R.x / TILE), tj = Math.floor(R.y / TILE);
      for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) {
        const b = settlement(ti + di, tj + dj);
        if (b) expect(realmAt(b.x, b.y)).toBeNull();
      }
    }
  });

  it('setting foot in one discovers it, once', () => {
    const s = newGame(), R = realms()[0], out: TravelEvent[] = [];
    discover(s, R.x, R.y, out);
    expect(out.filter((e) => e.type === 'realm')).toHaveLength(1);
    discover(s, R.x + 5, R.y, out);
    expect(out.filter((e) => e.type === 'realm')).toHaveLength(1);
  });

  it('every one has a name and a text, in French and in English', () => {
    for (const lang of ['fr', 'en'] as const) {
      setLang(lang);
      for (const k of REALM_KINDS) for (const f of ['name', 'text']) expect(t(`realm.${k}.${f}`)).not.toBe(`realm.${k}.${f}`);
    }
    setLang('fr');
  });
});
