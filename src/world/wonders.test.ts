import { describe, expect, it } from 'vitest';
import { wonder, wondersNear, WONDER_CELL, WONDER_SIGHT } from './wonders';
import { altitude, TILE } from './terrain';
import { settlement } from './settlements';
import { landmark } from './landmarks';
import { newGame, discover, cellKey, type TravelEvent } from '../game/travel';
import { setLang, t } from '../i18n';

const all = () => { const out = []; for (let mj = -10; mj < 10; mj++) for (let mi = -10; mi < 10; mi++) { const w = wonder(mi, mj); if (w) out.push(w); } return out; };

describe('wonders', () => {
  it('are rare: about one wonder cell in three holds one', () => {
    const n = all().length;
    expect(n / 400).toBeGreaterThan(0.2);
    expect(n / 400).toBeLessThan(0.5);
  });

  it('all six kinds exist, each on suitable ground and away from towns', () => {
    const ws = all(), kinds = new Set(ws.map((w) => w.kind));
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
  });

  it('are deterministic and found by area queries', () => {
    const w = all()[0];
    expect(wonder(Math.floor(w.x / WONDER_CELL), Math.floor(w.y / WONDER_CELL))).toEqual(w);
    expect(wondersNear(w.x - 1, w.y - 1, w.x + 1, w.y + 1, 0)).toContainEqual(w);
  });

  it('are spotted from afar, once, and the ground around them is revealed', () => {
    const w = all().find((x) => x.kind !== 'arches')!;
    const s = newGame(), out: TravelEvent[] = [];
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
