import { describe, expect, it } from 'vitest';
import {
  BROKEN_KEY, SAVE_KEY, decodeCells, decodeTrace, encodeCells, encodeTrace, fromSaveFile,
  loadGame, saveGame, toSaveFile, type KeyValueStore,
} from './save';
import { advance, newGame, startJourney } from './travel';
import { pathLength } from './route';
import type { GameState } from './state';

class MemoryStore implements KeyValueStore {
  data = new Map<string, string>();
  failWrites = false;
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { if (this.failWrites) throw new Error('QuotaExceededError'); this.data.set(k, v); }
}

/** A game that has walked a while: several journeys, fog revealed, a place or two found. */
function playedGame(): GameState {
  const s = newGame();
  s.calmUntil = 1e9; // no monsters on this walk
  for (const [dx, dy] of [[300, 0], [0, 400], [-500, 120], [200, -700]]) {
    if (startJourney(s, s.x + dx, s.y + dy)) while (advance(s, 0.05));
  }
  startJourney(s, s.x + 250, s.y + 250);
  for (let k = 0; k < 40; k++) advance(s, 0.05); // leave a walk in progress
  s.zoom = 0.8;
  return s;
}

const sameGame = (a: GameState, b: GameState) => {
  expect(b.x).toBe(a.x);
  expect(b.y).toBe(a.y);
  expect(b.leagues).toBe(a.leagues);
  expect(b.zoom).toBe(a.zoom);
  expect(b.named).toEqual(a.named);
  expect(b.journey).toEqual(a.journey);
  expect(b.trace).toEqual(a.trace);
  expect([...b.seen].sort()).toEqual([...a.seen].sort());
};

describe('fog cell encoding', () => {
  it('round-trips any set of cells, negatives and gaps included', () => {
    const cells = new Set(['0,0', '1,0', '2,0', '5,0', '-3,-2', '-2,-2', '7,9', '-100,40', '8,9']);
    expect(decodeCells(encodeCells(cells))).toEqual(cells);
    expect(decodeCells(encodeCells([]))).toEqual(new Set());
  });

  it('is much smaller than the raw list for explored land', () => {
    const s = playedGame();
    const raw = JSON.stringify([...s.seen]).length, packed = encodeCells(s.seen).length;
    expect(s.seen.size).toBeGreaterThan(200);
    expect(packed * 4).toBeLessThan(raw);
  });
});

describe('trace encoding', () => {
  it('round-trips', () => {
    const t: [number, number][] = [[10, -4], [20, -4], [25, 6], [-300, 1200]];
    expect(decodeTrace(encodeTrace(t))).toEqual(t);
    expect(decodeTrace([])).toEqual([]);
  });
});

describe('save and load', () => {
  it('quit and come back: the very same game, walk in progress included', () => {
    const store = new MemoryStore(), s = playedGame();
    expect(s.journey).not.toBeNull();
    expect(s.named.length).toBeGreaterThan(0);
    expect(saveGame(s, store)).toBe(true);
    const back = loadGame(store)!;
    sameGame(s, back);
    // and the walk goes on from where it stopped
    while (advance(back, 0.05));
    expect(back.journey).toBeNull();
  });

  it('a new player has no save', () => {
    expect(loadGame(new MemoryStore())).toBeNull();
  });

  it('a corrupt save is kept aside, not lost, and the game starts fresh', () => {
    const store = new MemoryStore();
    store.setItem(SAVE_KEY, '{"v":1,"x":"oops"');
    expect(loadGame(store)).toBeNull();
    expect(store.getItem(BROKEN_KEY)).toBe('{"v":1,"x":"oops"');
    // the next launch must not overwrite the kept copy
    expect(loadGame(store)).toBeNull();
    expect(store.getItem(BROKEN_KEY)).toBe('{"v":1,"x":"oops"');
  });

  it('rejects malformed fields and unknown future versions', () => {
    const good = toSaveFile(newGame());
    const bad = [
      { ...good, v: 99 }, { ...good, x: null }, { ...good, named: [1] }, { ...good, trace: ['a'] },
      { ...good, seen: 'x:y' }, { ...good, journey: { x0: 1 } }, { ...good, journey: { path: [[1, 2]], elapsed: 0, duration: 1, revealed: 0, shore: false } },
    ];
    for (const b of bad) expect(() => fromSaveFile(JSON.stringify(b))).toThrow();
    expect(() => fromSaveFile(JSON.stringify(good))).not.toThrow();
  });

  it('a full storage does not crash the game', () => {
    const store = new MemoryStore();
    store.failWrites = true;
    expect(saveGame(newGame(), store)).toBe(false);
  });

  it('stays small after a long walk', () => {
    const json = JSON.stringify(toSaveFile(playedGame()));
    expect(json.length).toBeLessThan(10_000);
  });
});

describe('footsteps', () => {
  it('one footstep every 10 units, whatever the frame rate', () => {
    for (const dt of [1 / 120, 1 / 30, 0.05]) {
      const s = newGame(), before = s.trace.length;
      s.calmUntil = 1e9; // no monsters on this walk
      startJourney(s, s.x + 300, s.y);
      const L = pathLength(s.journey!.path);
      while (advance(s, dt));
      expect(s.trace.length - before).toBe(Math.ceil(L / 10));
    }
  });
});

describe('migrations', () => {
  it('saves of the old flat world (v1, v2) are left aside: a new game starts on the planet', () => {
    const store = new MemoryStore();
    const v2 = { ...toSaveFile(newGame()), v: 2 };
    store.setItem(SAVE_KEY, JSON.stringify(v2));
    expect(loadGame(store)).toBeNull();
    expect(store.getItem(BROKEN_KEY)).toBe(JSON.stringify(v2)); // kept, not destroyed
  });
});
