// Save and load the GameState in localStorage: small, versioned, robust.
// What is saved: position, leagues, zoom, discovered places, the walk in progress, revealed fog
// cells (run-length encoded) and footsteps (delta encoded). Never anything drawn.
import type { Battle, GameState, Journey } from './state';
import { CALM_LEAGUES, START_HP, START_ITEMS, monsterById } from './combat';

export const SAVE_KEY = 'oriande.save';
/** Where an unreadable save is moved, so a bug never silently destroys a player's game. */
export const BROKEN_KEY = 'oriande.save.broken';
export const SAVE_VERSION = 4;

/** The JSON stored under SAVE_KEY. */
export interface SaveFile {
  v: number;
  /** ISO date of the save */
  at: string;
  x: number;
  y: number;
  leagues: number;
  zoom: number;
  named: string[];
  journey: Journey | null;
  /** fog cells, see encodeCells */
  seen: string;
  /** footsteps, see encodeTrace */
  trace: number[];
  // v4: the explorer and the fight
  hp: number;
  maxHp: number;
  gold: number;
  items: Record<string, number>;
  seed: number;
  calmUntil: number;
  rest: [number, number];
  battle: Battle | null;
}

// ---- fog cells: run-length encoding by row ----
// Cells are "ci,cj" keys. Explored land is made of blobs, so each row is a few runs.
// Format: rows separated by ";", each "dj:runs" where dj is the row offset from the previous
// row and runs are "gap+len" pairs separated by "," (gap from the previous run's end).

export function encodeCells(cells: Iterable<string>): string {
  const rows = new Map<number, number[]>();
  for (const k of cells) {
    const [ci, cj] = k.split(',').map(Number);
    let r = rows.get(cj);
    if (!r) rows.set(cj, (r = []));
    r.push(ci);
  }
  const out: string[] = [];
  let prevJ = 0;
  for (const cj of [...rows.keys()].sort((a, b) => a - b)) {
    const cis = rows.get(cj)!.sort((a, b) => a - b);
    const runs: string[] = [];
    let prevEnd = 0, k = 0;
    while (k < cis.length) {
      const start = cis[k];
      let len = 1;
      while (k + len < cis.length && cis[k + len] === start + len) len++;
      runs.push(`${start - prevEnd}+${len}`);
      prevEnd = start + len;
      k += len;
    }
    out.push(`${cj - prevJ}:${runs.join(',')}`);
    prevJ = cj;
  }
  return out.join(';');
}

/** One row: signed row offset, then runs; only a row's first gap can be negative. */
const ROW = String.raw`-?\d+:-?\d+\+\d+(?:,\d+\+\d+)*`;
const CELLS_FORMAT = new RegExp(`^${ROW}(?:;${ROW})*$`);

export function decodeCells(s: string): Set<string> {
  const cells = new Set<string>();
  if (!s) return cells;
  if (!CELLS_FORMAT.test(s)) throw new Error('bad cell encoding');
  let cj = 0;
  for (const row of s.split(';')) {
    const [dj, runs] = row.split(':');
    cj += Number(dj);
    let end = 0;
    for (const run of runs.split(',')) {
      const [gap, len] = run.split('+').map(Number);
      const start = end + gap;
      for (let ci = start; ci < start + len; ci++) cells.add(ci + ',' + cj);
      end = start + len;
    }
  }
  return cells;
}

// ---- footsteps: delta encoding ----
// Steps are 10 world units apart, so deltas are small numbers: [x0, y0, dx1, dy1, ...].

export function encodeTrace(trace: [number, number][]): number[] {
  const out: number[] = [];
  let px = 0, py = 0;
  for (const [x, y] of trace) { out.push(x - px, y - py); px = x; py = y; }
  return out;
}

export function decodeTrace(d: number[]): [number, number][] {
  const out: [number, number][] = [];
  let x = 0, y = 0;
  for (let k = 0; k + 1 < d.length; k += 2) { x += d[k]; y += d[k + 1]; out.push([x, y]); }
  return out;
}

// ---- save file <-> state ----

export function toSaveFile(s: GameState, now = new Date()): SaveFile {
  return {
    v: SAVE_VERSION, at: now.toISOString(),
    x: s.x, y: s.y, leagues: s.leagues, zoom: s.zoom,
    named: [...s.named],
    journey: s.journey ? { ...s.journey, path: s.journey.path.map((p) => [...p] as [number, number]) } : null,
    seen: encodeCells(s.seen),
    trace: encodeTrace(s.trace),
    hp: s.hp, maxHp: s.maxHp, gold: s.gold, items: { ...s.items }, seed: s.seed,
    calmUntil: s.calmUntil, rest: [s.rest[0], s.rest[1]], battle: s.battle ? { ...s.battle } : null,
  };
}

const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

function validJourney(j: unknown): j is Journey {
  if (j === null) return true;
  if (typeof j !== 'object') return false;
  const o = j as Record<string, unknown>;
  const path = o.path;
  return Array.isArray(path) && path.length >= 2 && path.every((p) => Array.isArray(p) && p.length === 2 && p.every(isNum))
    && ['elapsed', 'duration', 'revealed'].every((k) => isNum(o[k])) && typeof o.shore === 'boolean';
}

/**
 * Bring an older save up to the current version. Each step migrates one version to the next;
 * add a case here whenever SAVE_VERSION goes up. Returns null for unknown (newer) versions.
 */
export function migrate(raw: Record<string, unknown>): Record<string, unknown> | null {
  const save = { ...raw };
  if (!isNum(save.v) || save.v > SAVE_VERSION || save.v < 1) return null;
  // v1 and v2 were saved in the proto's flat world, which is gone: they cannot be carried over
  // to the planet (v3), so they are left aside and a new game starts.
  if ((save.v as number) < 3) return null;
  if (save.v === 1) {
    // v1 walked in straight lines: the journey becomes a two-point route
    const j = save.journey as Record<string, number> | null;
    if (j && typeof j === 'object') {
      const { x0, y0, x1, y1, ...rest } = j;
      save.journey = { ...rest, path: [[x0, y0], [x1, y1]] };
    }
    save.v = 2;
  }
  if (save.v === 3) {
    // v4 brings the explorer's life, purse and pack, the dice and the fights
    Object.assign(save, {
      hp: START_HP, maxHp: START_HP, gold: 0, items: { ...START_ITEMS },
      seed: (Math.random() * 4294967296) >>> 0,
      calmUntil: (save.leagues as number) + CALM_LEAGUES, rest: [save.x, save.y], battle: null,
    });
    save.v = 4;
  }
  // next: if (save.v === 4) { ...; save.v = 5; }
  return save;
}

/** Parse and validate a save. Throws on anything malformed. */
export function fromSaveFile(json: string): GameState {
  const raw = JSON.parse(json) as unknown;
  if (!raw || typeof raw !== 'object') throw new Error('save is not an object');
  const f = migrate(raw as Record<string, unknown>);
  if (!f) throw new Error('unsupported save version ' + String((raw as { v?: unknown }).v));
  if (![f.x, f.y, f.leagues, f.zoom].every(isNum)) throw new Error('bad numbers');
  if (!Array.isArray(f.named) || !f.named.every((n) => typeof n === 'string')) throw new Error('bad named');
  if (!validJourney(f.journey)) throw new Error('bad journey');
  if (typeof f.seen !== 'string') throw new Error('bad seen');
  if (!Array.isArray(f.trace) || !f.trace.every(isNum)) throw new Error('bad trace');
  const seen = decodeCells(f.seen);
  if ([...seen].some((k) => !/^-?\d+,-?\d+$/.test(k))) throw new Error('bad cells');
  const trace = decodeTrace(f.trace as number[]);
  if (![f.hp, f.maxHp, f.gold, f.seed, f.calmUntil].every(isNum)) throw new Error('bad explorer');
  const items = f.items as Record<string, unknown>;
  if (!items || typeof items !== 'object' || !Object.values(items).every(isNum)) throw new Error('bad items');
  const rest = f.rest as unknown[];
  if (!Array.isArray(rest) || rest.length !== 2 || !rest.every(isNum)) throw new Error('bad rest');
  const battle = f.battle as Battle | null;
  if (battle !== null && (typeof battle !== 'object' || !isNum(battle.hp) || !monsterById(battle.monster))) throw new Error('bad battle');
  return {
    version: 4,
    hp: Math.max(1, f.hp as number), maxHp: f.maxHp as number, gold: f.gold as number,
    items: items as Record<string, number>, seed: (f.seed as number) >>> 0, calmUntil: f.calmUntil as number,
    rest: [rest[0] as number, rest[1] as number], battle: battle ? { ...battle } : null,
    x: f.x as number, y: f.y as number, leagues: f.leagues as number, zoom: f.zoom as number,
    named: f.named as string[],
    journey: f.journey as Journey | null,
    seen,
    trace: trace.length ? trace : [[Math.round(f.x as number), Math.round(f.y as number)]],
  };
}

/** Minimal storage interface (localStorage, or a fake in tests). */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const defaultStore = (): KeyValueStore | null => {
  try { return globalThis.localStorage ?? null; } catch { return null; }
};

/** Write the game. Returns false if storage is unavailable or full; the game goes on. */
export function saveGame(s: GameState, store = defaultStore()): boolean {
  if (!store) return false;
  try {
    store.setItem(SAVE_KEY, JSON.stringify(toSaveFile(s)));
    return true;
  } catch {
    return false;
  }
}

/**
 * Read the saved game, or null if there is none. An unreadable save is moved to BROKEN_KEY
 * (never deleted) and null is returned, so the player gets a new game instead of a crash.
 */
export function loadGame(store = defaultStore()): GameState | null {
  if (!store) return null;
  let json: string | null = null;
  try {
    json = store.getItem(SAVE_KEY);
    if (!json) return null; // none yet, or emptied after being moved to BROKEN_KEY
    return fromSaveFile(json);
  } catch (e) {
    console.warn('Oriande: unreadable save, starting a new game', e);
    try {
      if (json !== null) {
        store.setItem(BROKEN_KEY, json);
        store.setItem(SAVE_KEY, '');
      }
    } catch { /* storage unavailable */ }
    return null;
  }
}
