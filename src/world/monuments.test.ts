import { describe, expect, it } from 'vitest';
import { MONUMENT_KINDS, monument } from './monuments';
import { LANDMARK_KINDS, landmark } from './landmarks';
import { settlement } from './settlements';
import { altitude, TILE } from './terrain';
import { setLang, t } from '../i18n';
import { showPlaces } from './features';

showPlaces(true); // their generation is tested, though they are off the map for now

describe('monuments and strange places', () => {
  it('monuments: every kind exists somewhere, on land, away from towns', () => {
    const kinds = new Set<string>();
    let n = 0, cells = 0;
    for (let mj = -40; mj < 40; mj++) for (let mi = -60; mi < 60; mi += 1) {
      cells++;
      const m = monument(mi, mj);
      if (!m) continue;
      n++; kinds.add(m.kind);
      expect(altitude(m.x, m.y)).toBeGreaterThan(0);
      const ti = Math.floor(m.x / TILE), tj = Math.floor(m.y / TILE);
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const b = settlement(ti + di, tj + dj);
        if (b) expect(Math.hypot(b.x - m.x, b.y - m.y)).toBeGreaterThanOrEqual(140);
      }
    }
    expect([...kinds].sort()).toEqual([...MONUMENT_KINDS].sort());
    expect(n / cells).toBeGreaterThan(0.05);
  }, 120000);

  it('strange places: a real variety (most kinds met over a large region), none up in the mountains', () => {
    const count = new Map<string, number>();
    for (let tj = -150; tj < 150; tj++) for (let ti = -200; ti < 200; ti += 1) {
      const L = landmark(ti, tj);
      if (!L) continue;
      count.set(L.kind, (count.get(L.kind) ?? 0) + 1);
      if (!L.water) expect(altitude(L.x, L.y)).toBeLessThan(0.6);
    }
    expect(count.size).toBeGreaterThanOrEqual(LANDMARK_KINDS.length - 4);
    const max = Math.max(...count.values()), total = [...count.values()].reduce((a, b) => a + b, 0);
    expect(max / total).toBeLessThan(0.15); // no single kind dominates
  });

  it('a strange place is never on a village or a city', async () => {
    const { TOWN_CLEARANCE, CITY_CLEARANCE } = await import('./landmarks');
    let n = 0;
    for (let tj = -120; tj < 120; tj++) for (let ti = -150; ti < 150; ti++) {
      const L = landmark(ti, tj);
      if (!L) continue;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const b = settlement(ti + di, tj + dj);
        if (!b) continue;
        n++;
        expect(Math.hypot(b.x - L.x, b.y - L.y)).toBeGreaterThanOrEqual(b.city ? CITY_CLEARANCE : TOWN_CLEARANCE);
      }
    }
    expect(n).toBeGreaterThan(100);
  });

  it('nothing stands in a river or a lake: monuments, wonders, strange places on land', async () => {
    const { nearWater } = await import('./rivers');
    const { wonder } = await import('./wonders');
    for (let mj = -12; mj < 12; mj++) for (let mi = -16; mi < 16; mi++) { const m = monument(mi, mj); if (m) expect(nearWater(m.x, m.y, 30)).toBe(false); }
    for (let mj = -6; mj < 6; mj++) for (let mi = -8; mi < 8; mi++) { const w = wonder(mi, mj); if (w && w.kind !== 'arches') expect(nearWater(w.x, w.y, 30)).toBe(false); }
    for (let tj = -60; tj < 60; tj++) for (let ti = -60; ti < 60; ti++) { const L = landmark(ti, tj); if (L && !L.water) expect(nearWater(L.x, L.y, 15)).toBe(false); }
  }, 60000);

  it('every kind has a name and a text in both languages', () => {
    for (const lang of ['fr', 'en'] as const) {
      setLang(lang);
      for (const k of LANDMARK_KINDS) for (const f of ['name', 'text']) expect(t(`landmark.${k}.${f}`)).not.toBe(`landmark.${k}.${f}`);
      for (const k of MONUMENT_KINDS) for (const f of ['name', 'text']) expect(t(`monument.${k}.${f}`)).not.toBe(`monument.${k}.${f}`);
    }
    setLang('fr');
  });
});
