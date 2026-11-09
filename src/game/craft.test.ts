import { describe, expect, it } from 'vitest';
import { FISH_SECONDS, HARVEST_SECONDS, RECIPES, canCraft, castFrom, craft, fishable, has, startWork, stepWork, weaponOf } from './craft';
import { ITEMS, useItem } from './combat';
import { NO_TORCH, newGame } from './travel';
import { fromSaveFile, toSaveFile } from './save';
import { resourceAt } from '../world/resources';
import { altitude } from '../world/terrain';
import { setLang, t } from '../i18n';
import type { GameState } from './state';

const game = (): GameState => { const s = newGame(); s.seed = 3; s.calmUntil = 1e9; return s; };

/** A point near (x, y) where `test` holds, searching outwards. */
function findNear(x: number, y: number, test: (x: number, y: number) => boolean): [number, number] {
  for (let r = 0; r < 20000; r += 20) for (let k = 0; k < 24; k++) {
    const a = k / 24 * Math.PI * 2, px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    if (test(px, py)) return [px, py];
  }
  throw new Error('nothing found');
}

/** Work for `seconds`, standing still. */
function work(s: GameState, seconds: number) {
  const out: ReturnType<typeof stepWork> = [];
  for (let k = 0; k < seconds / 0.1 && s.work; k++) out.push(...stepWork(s, 0.1));
  return out;
}

describe('starting with nothing', () => {
  it('a new game: empty pack, bare fists, no torch', () => {
    const s = game();
    expect(s.items).toEqual({});
    expect(weaponOf(s).id).toBe('poings');
    expect(has(s, 'torche')).toBe(false);
    expect(NO_TORCH).toBeGreaterThan(0);
  });
});

describe('gathering', () => {
  it('the land gives wood, stones and fibres, nothing in the water', () => {
    const s = game();
    for (const res of ['bois', 'pierre', 'fibre'] as const) findNear(s.x, s.y, (x, y) => resourceAt(x, y) === res);
    const [wx, wy] = findNear(s.x, s.y, (x, y) => altitude(x, y) < -0.1);
    expect(resourceAt(wx, wy)).toBeNull();
  });

  it('once there, a few seconds of work fill the pack', () => {
    const s = game();
    const [x, y] = findNear(s.x, s.y, (x, y) => resourceAt(x, y) === 'bois');
    s.x = x + 5; s.y = y;
    expect(startWork(s, 'harvest', x, y)).toBe(true);
    const ev = work(s, HARVEST_SECONDS + 1);
    expect(ev[0].kind).toBe('begin');
    const got = ev.find((e) => e.kind === 'gathered');
    expect(got && got.kind === 'gathered' && got.res).toBe('bois');
    expect(s.items.bois).toBeGreaterThanOrEqual(1);
    expect(s.work).toBeNull();
  });

  it('too far from the spot: nothing', () => {
    const s = game();
    const [x, y] = findNear(s.x, s.y, (x, y) => resourceAt(x, y) !== null);
    s.x = x + 200; s.y = y;
    startWork(s, 'harvest', x, y);
    expect(work(s, 1).some((e) => e.kind === 'tooFar')).toBe(true);
  });

  it('walking off gives the work up', () => {
    const s = game();
    const [x, y] = findNear(s.x, s.y, (x, y) => resourceAt(x, y) !== null);
    s.x = x; s.y = y;
    startWork(s, 'harvest', x, y);
    stepWork(s, 0.1); stepWork(s, 0.1);
    s.journey = { path: [[x, y], [x + 50, y]], elapsed: 0, duration: 1000, revealed: 0, shore: false };
    stepWork(s, 0.1);
    expect(s.work).toBeNull();
  });
});

describe('making things', () => {
  it('a staff from wood: it hits harder than fists; a tool is made once', () => {
    const s = game();
    expect(canCraft(s, 'baton')).toBe(false);
    s.items.bois = 3;
    expect(craft(s, 'baton')).toBe(true);
    expect(s.items.bois).toBe(1);
    expect(weaponOf(s).id).toBe('baton');
    expect(weaponOf(s).damage[1]).toBeGreaterThan(3);
    s.items.bois = 5;
    expect(canCraft(s, 'baton')).toBe(false);
  });

  it('every recipe asks for gathered things only, and has names; tools cannot be eaten', () => {
    for (const r of RECIPES) {
      expect(r.id === 'feu' || !!ITEMS.find((i) => i.id === r.id)).toBe(true); // a tool, a remedy, or the fire
      for (const k of Object.keys(r.needs)) expect(['material', 'food']).toContain(ITEMS.find((i) => i.id === k)?.kind);
    }
    for (const lang of ['fr', 'en'] as const) {
      setLang(lang);
      for (const it of ITEMS) expect(t('item.' + it.id + '.name')).not.toBe('item.' + it.id + '.name');
      for (const k of ['pack.make', 'pack.tools', 'pack.materials', 'pack.food', 'work.harvest', 'work.fish', 'work.needRod', 'item.feu.name', 'pack.fire', 'pack.cook', 'pack.sleep', 'hunger.title', 'sick.title', 'fire.title']) expect(t(k)).not.toBe(k);
    }
    setLang('fr');
    const s = game(); s.hp = 5; s.items.bois = 2;
    expect(useItem(s, 'bois')).toBe(0);
    expect(s.items.bois).toBe(2);
  });
});

describe('fishing', () => {
  it('needs a rod; from the shore, it sometimes brings a fish', () => {
    const s = game();
    const [wx, wy] = findNear(s.x, s.y, (x, y) => fishable(x, y) && altitude(x, y) > -0.05);
    s.x = wx + 30; s.y = wy;
    expect(startWork(s, 'fish', wx, wy)).toBe(false);
    s.items.canne = 1;
    let caught = 0;
    for (let k = 0; k < 10; k++) {
      expect(startWork(s, 'fish', wx, wy)).toBe(true);
      if (work(s, FISH_SECONDS + 1).some((e) => e.kind === 'caught')) caught++;
    }
    expect(caught).toBeGreaterThan(2);
    expect(s.items.poisson).toBe(caught);
  });
});

describe('every lake can be fished', () => {
  it('every point of a lake is water to fish in (a lake reaches past the river that made it)', async () => {
    const { lakesNear, inLake } = await import('../world/rivers');
    const s = game();
    let n = 0;
    for (const l of lakesNear(s.x - 6000, s.y - 6000, s.x + 6000, s.y + 6000)) for (let k = 0; k < 30; k++) {
      const a = k * 2.4, rr = l.r * ((k % 6) / 6), px = l.x + Math.cos(a) * rr, py = l.y + Math.sin(a) * rr * 0.75;
      if (!inLake(l, px, py)) continue;
      n++;
      expect(fishable(px, py)).toBe(true);
    }
    expect(n).toBeGreaterThan(100);
  });
});

describe('fishing from the near side', () => {
  it('the line goes to the first water on the way, the explorer stands just before it', () => {
    const s = game();
    const [wx, wy] = findNear(s.x, s.y, (x, y) => fishable(x, y) && !fishable(x + 60, y) && altitude(x + 60, y) > 0.05);
    const c = castFrom(wx + 60, wy, wx - 200, wy)!;
    expect(c).not.toBeNull();
    expect(fishable(c.water[0], c.water[1])).toBe(true);
    expect(fishable(c.shore[0], c.shore[1])).toBe(false);
    expect(Math.hypot(c.shore[0] - c.water[0], c.shore[1] - c.water[1])).toBeLessThan(40);
    expect(castFrom(wx + 60, wy, wx + 61, wy)).toBeNull();
  });
});

describe('saving', () => {
  it('a game saved mid-work comes back mid-work', () => {
    const s = game();
    s.work = { kind: 'harvest', res: 'bois', x: s.x, y: s.y, left: 2.5 };
    s.items = { bois: 2, baton: 1 };
    const back = fromSaveFile(JSON.stringify(toSaveFile(s)));
    expect(back.work).toEqual(s.work);
    expect(back.items).toEqual(s.items);
  });
});
