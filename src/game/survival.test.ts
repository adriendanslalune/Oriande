import { describe, expect, it } from 'vitest';
import { FOOD_MAX, HUNGRY, HUNGER_SECONDS, SLEEP_FOOD, canCook, cook, eat, sleepByFire, stepHunger } from './survival';
import { CAMP_SECONDS, campLit, layCamp } from './camp';
import { craft, has, startWork, stepWork, workSeconds } from './craft';
import { engage, stepFight, beastsNear } from './combat';
import { newGame } from './travel';
import { fromSaveFile, toSaveFile } from './save';
import { resourceAt } from '../world/resources';
import { worldTime } from '../world/weather';
import type { GameState } from './state';

const T = worldTime();
const game = (): GameState => { const s = newGame(); s.seed = 4; s.calmUntil = 1e12; return s; };

describe('hunger', () => {
  it('the belly empties on the move only: standing still, it does not move', () => {
    const a = game(), b = game();
    for (let k = 0; k < 600; k++) { stepHunger(a, 0.5, false); stepHunger(b, 0.5, true); }
    expect(a.food).toBe(FOOD_MAX);
    expect(b.food).toBeCloseTo(FOOD_MAX - 300 / HUNGER_SECONDS, 0);
  });

  it('boots: walking empties the belly more slowly', () => {
    const a = game(), b = game();
    b.items.bottes = 1; b.equip.feet = 'bottes';
    for (let k = 0; k < 200; k++) { stepHunger(a, 0.5, true); stepHunger(b, 0.5, true); }
    expect(b.food).toBeGreaterThan(a.food);
  });

  it('hungry: a warning, and life no longer comes back by itself', () => {
    const s = game(); s.food = HUNGRY + 0.01; s.hp = 10;
    expect(stepHunger(s, 1, true).some((e) => e.kind === 'hungry')).toBe(true);
    for (let k = 0; k < 400; k++) stepFight(s, 0.5, T + k * 0.5);
    expect(s.hp).toBe(10);
  });

  it('starving: life drains, and the explorer faints, carried to the last town', () => {
    const s = game(); s.food = 0; s.hp = 3; s.gold = 10; s.rest = [s.x + 500, s.y];
    let fainted = false;
    for (let k = 0; k < 2000 && !fainted; k++) fainted = stepHunger(s, 0.5, false).some((e) => e.kind === 'fainted');
    expect(fainted).toBe(true);
    expect([s.x, s.y]).toEqual(s.rest);
    expect(s.gold).toBe(5);
    expect(s.food).toBeGreaterThan(0);
  });
});

describe('eating and cooking', () => {
  it('cooked fills and heals more than raw; raw may make you ill', () => {
    const s = game(); s.food = 20; s.hp = 10; s.items = { viande: 30, viande_cuite: 1 };
    const cooked = eat(s, 'viande_cuite')!;
    expect(cooked.heal).toBeGreaterThan(0);
    let sick = 0;
    for (let k = 0; k < 30; k++) { s.food = 10; s.hp = 10; if (eat(s, 'viande')!.sick) sick++; }
    expect(sick).toBeGreaterThan(2);
    expect(sick).toBeLessThan(20);
  });

  it('a campfire: laid, it burns a while, cooks what is raw, then goes out', () => {
    const s = game(); s.items = { bois: 3, pierre: 2, viande: 2 };
    expect(canCook(s, 'viande', T)).toBe(false); // no fire yet
    expect(craft(s, 'feu', T)).toBe(true);
    expect(s.items.bois).toBeUndefined();
    expect(campLit(s, T)).toBe(true);
    expect(cook(s, 'viande', T)).toBe(true);
    expect(s.items.viande_cuite).toBe(1);
    expect(campLit(s, T + CAMP_SECONDS + 1)).toBe(false);
    expect(canCook(s, 'viande', T + CAMP_SECONDS + 1)).toBe(false);
    s.x += 300;
    expect(canCook(s, 'viande', T)).toBe(false); // too far from it
  });

  it('a night by the fire: life back, the belly pays', () => {
    const s = game(); layCamp(s, T); s.hp = 4; s.food = 60;
    expect(sleepByFire(s, T)).toBe(true);
    expect(s.hp).toBe(s.maxHp);
    expect(s.food).toBe(60 - SLEEP_FOOD);
  });

  it('no animal charges near a lit fire', () => {
    const s = game(); s.calmUntil = 0;
    let wolf = null;
    for (let r = 2000; r <= 40000 && !wolf; r += 2000) wolf = beastsNear(s, s.x, s.y, r, T).find((b) => b.species.danger >= 2);
    s.x = wolf!.x + 60; s.y = wolf!.y; layCamp(s, T);
    const ev = stepFight(s, 0.05, T);
    expect(ev.some((e) => e.kind === 'charge')).toBe(false);
    void engage;
  });
});

describe('tools and what the land gives', () => {
  it('a hatchet gathers more wood, faster', () => {
    let x = 0, y = 0;
    const s = game();
    for (let r = 0; r < 20000 && !x; r += 20) for (let k = 0; k < 24; k++) { const a = k / 24 * 6.28; if (resourceAt(s.x + Math.cos(a) * r, s.y + Math.sin(a) * r) === 'bois') { x = s.x + Math.cos(a) * r; y = s.y + Math.sin(a) * r; break; } }
    const plain = workSeconds(s, 'bois');
    s.items.hachette = 1;
    expect(workSeconds(s, 'bois')).toBeLessThan(plain);
    s.x = x; s.y = y;
    let wood = 0;
    for (let n = 0; n < 6; n++) {
      startWork(s, 'harvest', x, y);
      for (let k = 0; k < 100 && s.work; k++) stepWork(s, 0.1);
      wood = s.items.bois;
    }
    expect(wood).toBeGreaterThanOrEqual(6 * 3);
  });

  it('hunting with a knife gives hides and bones', () => {
    const s = game(); s.items.couteau = 1;
    let b = null;
    for (let r = 2000; r <= 40000 && !b; r += 2000) b = beastsNear(s, s.x, s.y, r, T).find((x) => x.species.size !== 'small' && x.species.danger === 0);
    engage(s, b!, true); s.fight!.hp = 1; s.x = s.fight!.x + 5; s.y = s.fight!.y; s.fight!.cdYou = 0;
    for (let k = 0; k < 200 && s.fight; k++) stepFight(s, 0.05, T + k * 0.05);
    expect(s.items.peau).toBeGreaterThan(0);
    expect(s.items.os).toBe(1);
    expect(has(s, 'couteau')).toBe(true);
  });

  it('a saved game keeps its belly and its fire', () => {
    const s = game(); s.food = 42; layCamp(s, T);
    const back = fromSaveFile(JSON.stringify(toSaveFile(s)));
    expect(back.food).toBe(42);
    expect(back.camp).toEqual(s.camp);
  });
});
