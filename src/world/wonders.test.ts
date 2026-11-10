import { describe, expect, it } from 'vitest';
import { wonder, wondersNear, WONDER_CELL, WONDER_SIGHT } from './wonders';
import { altitude, TILE } from './terrain';
import { EQUATOR_Y } from './planet';
import { settlement } from './settlements';
import { landmark } from './landmarks';
import { newGame, discover, cellKey, type TravelEvent } from '../game/travel';
import { setLang, t } from '../i18n';
import { showPlaces } from './features';

showPlaces(true); // their generation is tested, though they are off the map for now

// the wonder cells about the equator, on the Old Continent and the seas around it
const EQ = Math.round(EQUATOR_Y / WONDER_CELL);
const all = () => { const out = []; for (let mj = EQ - 10; mj < EQ + 10; mj++) for (let mi = -20; mi < 20; mi++) { const w = wonder(mi, mj); if (w) out.push(w); } return out; };

describe('wonders', () => {
  it('are rare: about one wonder cell in three holds one', () => {
    const n = all().length;
    expect(n / 800).toBeGreaterThan(0.15);
    expect(n / 800).toBeLessThan(0.5);
  });

  it('all six kinds exist, each on suitable ground and away from towns', () => {
    // over a wide stretch of the planet (the arches stand in shallow seas, off the coasts)
    const ws = []; for (let mj = EQ - 24; mj < EQ + 24; mj += 4) for (let mi = -90; mi < 90; mi += 6) { const w = wonder(mi, mj); if (w) ws.push(w); }
    const kinds = new Set(ws.map((w) => w.kind));
    expect([...kinds].sort()).toEqual(['arbre', 'arches', 'cristal', 'rocher', 'tete', 'titan']);
    for (const w of ws) {
      const v = altitude(w.x, w.y);
      if (w.kind === 'arches') expect(v).toBeLessThan(0); else expect(v).toBeGreaterThan(0);
      const ti = Math.floor(w.x / TILE), tj = Math.floor(w.y / TILE);
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const b = settlement(ti + di, tj + dj);
        if (b) expect(Math.hypot(b.x - w.x, b.y - w.y)).toBeGreaterThanOrEqual(160);
      }
    }
  }, 240000);

  it('are deterministic and found by area queries', () => {
    const w = all()[0];
    expect(wonder(Math.floor(w.x / WONDER_CELL), Math.floor(w.y / WONDER_CELL))).toEqual(w);
    expect(wondersNear(w.x - 1, w.y - 1, w.x + 1, w.y + 1, 0)).toContainEqual(w);
  });

  it('are spotted from afar, once, and the ground around them is revealed', () => {
    const w = all().find((x) => x.kind !== 'arches')!;
    const s = newGame(), out: TravelEvent[] = [];
    s.calmUntil = 1e9; // no monsters on this walk
    discover(s, w.x + WONDER_SIGHT * 0.9, w.y, out);
    expect(out.filter((e) => e.type === 'wonder')).toHaveLength(1);
    expect(s.seen.has(cellKey(w.x, w.y))).toBe(true);
    discover(s, w.x + WONDER_SIGHT * 0.8, w.y, out);
    expect(out.filter((e) => e.type === 'wonder')).toHaveLength(1);
  });

  it('have names and texts in both languages', () => {
    for (const lang of ['fr', 'en'] as const) {
      setLang(lang);
      for (const k of ['tete', 'rocher', 'cristal', 'titan', 'arches', 'arbre']) {
        expect(t(`wonder.${k}.name`, { n: 'X' })).toContain('X');
        expect(t(`wonder.${k}.text`).length).toBeGreaterThan(60);
      }
    }
    setLang('fr');
  });
});

describe('strange places are rarer', () => {
  it('about one tile in ten', () => {
    let n = 0;
    for (let tj = -30; tj < 30; tj++) for (let ti = -30; ti < 30; ti++) if (landmark(ti, tj)) n++;
    expect(n / 3600).toBeGreaterThan(0.06);
    expect(n / 3600).toBeLessThan(0.15);
  });
});

describe('off the map for now', () => {
  it('no strange place, monument or wonder is shown or found', async () => {
    const { landmark } = await import('./landmarks');
    const { monumentsNear } = await import('./monuments');
    showPlaces(false);
    expect(wondersNear(-50000, -50000, 50000, 50000, 0)).toEqual([]);
    expect(monumentsNear(-50000, -50000, 50000, 50000, 0)).toEqual([]);
    for (let k = 0; k < 400; k++) expect(landmark(k - 200, (k * 7) % 50 - 25)).toBeNull();
    showPlaces(true);
  });
});
