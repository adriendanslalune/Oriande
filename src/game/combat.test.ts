import { describe, expect, it } from 'vitest';
import {
  AGGRO, CARCASSES, CONTACT, LEASH, RESPAWN, START_HP, beastsNear, nearTown, engage, hunt, roll, speciesById, stepFight, useItem, type Beast,
} from './combat';
import { newGame } from './travel';
import { fromSaveFile, migrate, toSaveFile } from './save';
import { herdsNear, animalsOf, SPECIES } from '../world/fauna';
import { worldTime } from '../world/weather';
import { setLang, t } from '../i18n';
import type { GameState } from './state';

const game = (seed = 42): GameState => { const s = newGame(); s.seed = seed; return s; };
const T = worldTime();

/** A real animal of this species near the start (or anywhere around), standing at time T. */
function findBeast(s: GameState, test: (id: string, danger: number) => boolean, R = 40000, wild = false): Beast {
  for (let r = 2000; r <= R; r += 2000) {
    const found = beastsNear(s, s.x, s.y, r, T).find((b) => test(b.species.id, b.species.danger) && !(wild && nearTown(b.x + AGGRO * 0.6, b.y)));
    if (found) return found;
  }
  throw new Error('no such animal found');
}

/** Play `seconds` of the fight in small steps; returns all the events. */
function play(s: GameState, seconds: number, dt = 0.05) {
  const out: ReturnType<typeof stepFight> = [];
  for (let k = 0; k * dt < seconds && (k === 0 || s.fight); k++) out.push(...stepFight(s, dt, T + k * dt));
  return out;
}

describe('the dice', () => {
  it('are reproducible from the saved seed', () => {
    const a = game(7), b = game(7);
    expect(Array.from({ length: 20 }, () => roll(a))).toEqual(Array.from({ length: 20 }, () => roll(b)));
  });
});

describe('fights on the map', () => {
  it('a dangerous animal charges whoever comes near, and the explorer stops', () => {
    const s = game();
    const wolf = findBeast(s, (_, d) => d >= 2, 40000, true); // away from towns, where none attacks
    s.x = wolf.x + AGGRO * 0.6; s.y = wolf.y; s.rest = [s.x + 2000, s.y];
    s.journey = { path: [[s.x, s.y], [s.x + 100, s.y]], elapsed: 0, duration: 10000, revealed: 0, shore: false };
    const ev = stepFight(s, 0.05, T);
    expect(ev.some((e) => e.kind === 'charge')).toBe(true);
    expect(s.fight?.hunt).toBe(false);
    expect(s.journey).toBeNull();
    // it runs at the explorer and blows are traded
    const all = play(s, 20);
    expect(all.some((e) => e.kind === 'hit' || e.kind === 'miss')).toBe(true);
  });

  it('a harmless animal never charges', () => {
    const s = game();
    const rabbit = findBeast(s, (_, d) => d === 0);
    s.x = rabbit.x + 20; s.y = rabbit.y;
    // nothing dangerous right there (the test keeps to what it found)
    const ev = stepFight(s, 0.05, T);
    if (ev.some((e) => e.kind === 'charge')) expect(speciesById(s.fight!.species)!.danger).toBe(2);
  });

  it('hunting a prey: it runs, and it is either caught (meat) or lost', () => {
    let caught = 0, lost = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const s = game(seed);
      const prey = findBeast(s, (_, d) => d === 0);
      s.x = prey.x - CONTACT * 0.5; s.y = prey.y;
      hunt(s, prey);
      const meatBefore = s.items.viande ?? 0;
      // the explorer keeps on its heels, as the map does
      for (let k = 0; k < 600 && s.fight; k++) {
        const f = s.fight;
        const d = Math.hypot(f.x - s.x, f.y - s.y);
        if (d > CONTACT * 0.7) { const step = Math.min(d - CONTACT * 0.6, 7 * 1.5 * 0.05); s.x += (f.x - s.x) / d * step; s.y += (f.y - s.y) / d * step; }
        const ev = stepFight(s, 0.05, T + k * 0.05);
        if (ev.some((e) => e.kind === 'killed')) { caught++; expect(s.items.viande).toBeGreaterThan(meatBefore); expect(s.gone[prey.key]).toBeGreaterThan(T + RESPAWN * 0.9); }
        if (ev.some((e) => e.kind === 'escaped')) lost++;
      }
    }
    expect(caught + lost).toBeGreaterThan(0);
    expect(caught).toBeGreaterThan(0);
  });

  it('a killed animal leaves a carcass; only the last few are kept', () => {
    const s = game();
    for (let k = 0; k < CARCASSES + 2; k++) {
      const b = findBeast(s, (_, d) => d === 0);
      engage(s, b, true);
      s.fight!.hp = 1; s.x = s.fight!.x + 5; s.y = s.fight!.y; s.fight!.cdYou = 0;
      for (let n = 0; n < 200 && s.fight; n++) stepFight(s, 0.05, T + k * 100 + n * 0.05);
      expect(s.fight).toBeNull();
      expect(s.carcasses.at(-1)!.species).toBe(b.species.id);
    }
    expect(s.carcasses.length).toBe(CARCASSES);
    expect(fromSaveFile(JSON.stringify(toSaveFile(s))).carcasses).toEqual(s.carcasses);
  });

  it('a killed animal is gone from the map until it comes back', () => {
    const s = game();
    const b = findBeast(s, () => true);
    s.gone[b.key] = T + 100;
    expect(beastsNear(s, b.x, b.y, 5, T).some((x) => x.key === b.key)).toBe(false);
    expect(beastsNear(s, b.x, b.y, 600, T + 200).some((x) => x.key === b.key)).toBe(true); // it has wandered meanwhile
  });

  it('a charging animal gives up far from its home', () => {
    const s = game();
    const wolf = findBeast(s, (_, d) => d >= 2);
    engage(s, wolf, false);
    s.fight!.x = s.fight!.home[0] + LEASH + 50; s.fight!.y = s.fight!.home[1];
    s.x = s.fight!.x + 60; s.y = s.fight!.y;
    const ev = stepFight(s, 0.05, T);
    expect(ev.some((e) => e.kind === 'gaveUp')).toBe(true);
    expect(s.fight).toBeNull();
  });

  it('losing: the explorer wakes up at the last town found, with half their life and écus', () => {
    let lost = 0;
    for (let seed = 1; seed <= 30 && !lost; seed++) {
      const s = game(seed);
      const bear = findBeast(s, (_, d) => d >= 2);
      s.gold = 30; s.rest = [s.x + 3000, s.y - 3000];
      engage(s, bear, false);
      s.x = bear.x + 2; s.y = bear.y; s.hp = 2;
      const ev = play(s, 30);
      if (!ev.some((e) => e.kind === 'lost')) continue;
      lost++;
      expect(s.hp).toBe(Math.ceil(START_HP / 2));
      expect(s.gold).toBe(15);
      expect([s.x, s.y]).toEqual(s.rest);
      expect(s.fight).toBeNull();
    }
    expect(lost).toBe(1);
  });

  it('eating heals and uses up what was eaten; life comes back slowly out of a fight', () => {
    const s = game();
    s.hp = 5; s.items = { remede: 1, viande: 2 };
    expect(useItem(s, 'remede')).toBe(8);
    expect(s.items.remede).toBeUndefined();
    s.items.viande_cuite = 2; delete s.items.viande;
    expect(useItem(s, 'viande_cuite')).toBe(4);
    expect(s.items.viande_cuite).toBe(1);
    s.hp = 10; s.calmUntil = 1e12; // no charge in this test
    for (let k = 0; k < 1200; k++) stepFight(s, 0.5, T + k * 0.5);
    expect(s.hp).toBeGreaterThan(10);
  });

  it('every animal that fights has a blow; names in both languages', () => {
    for (const sp of SPECIES) if (sp.danger >= 1) { expect(sp.damage).toBeTruthy(); expect(['bite', 'swipe', 'ram', 'kick']).toContain(sp.attack); }
    for (const lang of ['fr', 'en'] as const) {
      setLang(lang);
      for (const k of ['hunt.go', 'hunt.attack', 'fight.charge.title', 'item.viande.name', 'pack.title']) expect(t(k)).not.toBe(k);
    }
    setLang('fr');
    void herdsNear; void animalsOf;
  });
});

describe('saving', () => {
  it('a game saved mid-fight comes back mid-fight, with its dice', () => {
    const s = game(9);
    const b = findBeast(s, () => true);
    engage(s, b, true);
    s.gone['x:1'] = T + 50;
    const back = fromSaveFile(JSON.stringify(toSaveFile(s)));
    expect(back.fight).toEqual(s.fight);
    expect(back.gone).toEqual(s.gone);
    expect(roll(back)).toBe(roll(s));
  });

  it('saves from before the three continents are left aside: a new game starts', () => {
    // the planet was remade (v11): an older game's places are gone, whatever its version
    const v3 = { v: 3, at: '', x: 10, y: 20, leagues: 5, zoom: 1, named: [], journey: null, seen: '', trace: [10, 20] };
    expect(migrate(v3)).toBeNull();
    expect(migrate({ ...v3, v: 10 })).toBeNull();
    expect(() => fromSaveFile(JSON.stringify(v3))).toThrow();
    void START_HP;
  });
});
