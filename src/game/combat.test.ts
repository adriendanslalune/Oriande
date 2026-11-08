import { describe, expect, it } from 'vitest';
import { MONSTERS, encounterRate, monsterById, playTurn, roll, startBattle, CALM_LEAGUES, START_HP } from './combat';
import { advance, newGame, startJourney } from './travel';
import { fromSaveFile, migrate, toSaveFile } from './save';
import { settlement } from '../world/settlements';
import { TILE } from '../world/terrain';
import { setLang, t } from '../i18n';
import type { GameState } from './state';

const game = (seed = 42): GameState => { const s = newGame(); s.seed = seed; return s; };

describe('the dice', () => {
  it('are reproducible from the saved seed', () => {
    const a = game(7), b = game(7);
    const ra = Array.from({ length: 20 }, () => roll(a)), rb = Array.from({ length: 20 }, () => roll(b));
    expect(ra).toEqual(rb);
    expect(new Set(ra).size).toBe(20);
    for (const r of ra) { expect(r).toBeGreaterThanOrEqual(0); expect(r).toBeLessThan(1); }
  });
});

describe('a fight', () => {
  it('two monsters, each named in both languages', () => {
    expect(MONSTERS.length).toBe(2);
    for (const lang of ['fr', 'en'] as const) {
      setLang(lang);
      for (const m of MONSTERS) for (const f of ['name', 'text']) expect(t(`monster.${m.id}.${f}`)).not.toBe(`monster.${m.id}.${f}`);
    }
    setLang('fr');
  });

  it('attacking wins in the end: the monster falls, écus are found, the calm follows', () => {
    const s = game(), gold = s.gold;
    startBattle(s, 'rodeur');
    let beats: ReturnType<typeof playTurn> = [];
    for (let k = 0; k < 40 && s.battle; k++) { s.hp = s.maxHp; beats = playTurn(s, { kind: 'attack' }); }
    expect(s.battle).toBeNull();
    const won = beats.find((b) => b.kind === 'won');
    expect(won).toBeTruthy();
    expect(s.gold).toBeGreaterThan(gold);
    expect(s.calmUntil).toBe(s.leagues + CALM_LEAGUES);
  });

  it('an item heals and is used up; an empty pack does not spend the turn', () => {
    const s = game();
    startBattle(s, 'gardien');
    s.hp = 5; s.items = { remede: 1 };
    const beats = playTurn(s, { kind: 'item', item: 'remede' });
    expect(beats[0]).toEqual({ who: 'you', kind: 'heal', item: 'remede', amount: 8 });
    expect(s.items.remede).toBeUndefined();
    expect(playTurn(s, { kind: 'item', item: 'remede' })).toEqual([]);
  });

  it('fleeing works sometimes, and ends the fight when it does', () => {
    let fled = 0, stayed = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const s = game(seed);
      startBattle(s, 'rodeur');
      const b = playTurn(s, { kind: 'flee' });
      if (b.some((x) => x.kind === 'fled')) { fled++; expect(s.battle).toBeNull(); } else { stayed++; expect(s.battle).not.toBeNull(); }
    }
    expect(fled).toBeGreaterThan(120); // 80 % for the prowler
    expect(stayed).toBeGreaterThan(10);
  });

  it('a lost fight: the explorer wakes up at the last town found, with half their life and écus', () => {
    let lost = 0;
    for (let seed = 1; seed < 200; seed++) {
      const g = game(seed);
      g.gold = 30; g.rest = [g.x + 500, g.y - 300];
      startBattle(g, 'gardien'); g.hp = 1;
      const beats = playTurn(g, { kind: 'attack' });
      if (!beats.some((b) => b.kind === 'lost')) continue;
      lost++;
      expect(g.hp).toBe(Math.ceil(START_HP / 2));
      expect(g.gold).toBe(15);
      expect([g.x, g.y]).toEqual(g.rest);
      expect(g.battle).toBeNull();
    }
    expect(lost).toBeGreaterThan(0);
  });
});

describe('encounters on the map', () => {
  it('never near a town', () => {
    for (let tj = -30; tj < -10; tj++) for (let ti = -30; ti < -10; ti++) {
      const b = settlement(ti, tj);
      if (b) expect(encounterRate(b.x + 30, b.y)).toBe(0);
    }
  });

  it('a long walk meets a monster now and then, then the walk stops', () => {
    const s = game(3);
    s.calmUntil = 0;
    let met = 0, leagues = 0;
    for (let k = 0; k < 60 && met < 3; k++) {
      const a = (k * 2.4) % 6.28;
      if (!startJourney(s, s.x + Math.cos(a) * 400, s.y + Math.sin(a) * 400)) continue;
      const before = s.leagues;
      const out: Parameters<typeof advance>[2] = [];
      while (advance(s, 0.1, out));
      leagues += s.leagues - before;
      const e = out.find((x) => x.type === 'encounter');
      if (e) { met++; expect(s.battle?.monster).toBe((e as { monster: string }).monster); expect(s.journey).toBeNull(); s.battle = null; }
    }
    expect(met).toBeGreaterThan(0);
    expect(leagues / Math.max(1, met)).toBeGreaterThan(4); // not at every step
  });

  it('every encounter rate stays in a sane range', () => {
    for (let y = -6000; y < -4000; y += 97) for (let x = -6000; x < -4000; x += 97) {
      const r = encounterRate(x, y);
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThan(0.2);
    }
  });
});

describe('saving a fight', () => {
  it('a game saved mid-fight comes back mid-fight, with its dice', () => {
    const s = game(9);
    startBattle(s, 'gardien');
    playTurn(s, { kind: 'attack' });
    s.items = { remede: 3 };
    const back = fromSaveFile(JSON.stringify(toSaveFile(s)));
    expect(back.battle).toEqual(s.battle);
    expect([back.hp, back.gold, back.seed, back.items, back.rest]).toEqual([s.hp, s.gold, s.seed, s.items, s.rest]);
    expect(roll(back)).toBe(roll(s));
  });

  it('a v3 save is carried over: the explorer gets life, a pack and fresh dice', () => {
    const v3 = { v: 3, at: '', x: 10, y: 20, leagues: 5, zoom: 1, named: [], journey: null, seen: '', trace: [10, 20] };
    const m = migrate(v3)!;
    expect(m.v).toBe(4);
    const s = fromSaveFile(JSON.stringify(v3));
    expect(s.hp).toBe(START_HP);
    expect(s.items.remede).toBeGreaterThan(0);
    expect(s.rest).toEqual([10, 20]);
    expect(s.battle).toBeNull();
    expect(monsterById('rodeur')).toBeTruthy();
    void TILE;
  });
});
