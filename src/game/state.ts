/**
 * GameState: the whole game in one object. Scenes read and write it, never keep their own.
 * Everything here is plain data; `seen` is a Set for speed and save.ts serialises it.
 */
export interface Journey {
  /** the route, a polyline from where the walk started to where it ends (world units) */
  path: [number, number][];
  /** ms walked so far */
  elapsed: number;
  /** ms needed for the whole walk */
  duration: number;
  /** distance along the route already revealed (world units) */
  revealed: number;
  /** the target could not be reached (water): the walk ends on the shore */
  shore: boolean;
}

/**
 * A fight in progress, on the map: one animal has left its herd and is charging the explorer,
 * or is being hunted (and runs, or turns and fights). Its position is its own from then on.
 */
export interface Fight {
  /** the animal: its herd's key and its index in the herd ("wi,cj[n]:k") */
  key: string;
  /** its species' id in data/animals.json */
  species: string;
  hp: number;
  x: number;
  y: number;
  /** where it set off from: it does not follow the explorer forever */
  home: [number, number];
  /** the explorer went after it (a hunt) rather than the other way round */
  hunt: boolean;
  /** seconds until the next blow, the explorer's and the animal's */
  cdYou: number;
  cdFoe: number;
}

/** A piece of work: gathering wood, stones or fibres, or fishing, once the explorer is there. */
export interface Work {
  kind: 'harvest' | 'fish';
  /** what is gathered (harvest) */
  res: string | null;
  /** where: the tree, the rock, the grass; the water the line is cast into */
  x: number;
  y: number;
  /** seconds of work left; null while still walking there */
  left: number | null;
}

export interface GameState {
  version: 7;
  x: number;
  y: number;
  /** leagues walked */
  leagues: number;
  /** footsteps, world coords rounded to integers */
  trace: [number, number][];
  /** revealed fog cells, "ci,cj" */
  seen: Set<string>;
  /** discovered places: landmark keys "ti,tj" and settlements "b" + key */
  named: string[];
  journey: Journey | null;
  /** map zoom, CSS pixels per world unit (kept so the player comes back to the same view) */
  zoom: number;
  /** the explorer's life, and its most */
  hp: number;
  maxHp: number;
  /** écus */
  gold: number;
  /** what the explorer carries: item id -> how many */
  items: Record<string, number>;
  /** the dice: a random state, saved, so that every throw is reproducible */
  seed: number;
  /** world time (s) until which no animal attacks: the calm after a fight */
  calmUntil: number;
  /** where the explorer wakes up after losing a fight: the last town found (or the start) */
  rest: [number, number];
  /** the fight in progress, if any */
  fight: Fight | null;
  /** animals killed or lost from sight lately, by key: the world time (s) when they come back */
  gone: Record<string, number>;
  /** the work in hand, if any */
  work: Work | null;
  /** the last animals killed, lying where they fell (the most recent last; only a few are kept) */
  carcasses: Carcass[];
}

/** A killed animal left on the map. */
export interface Carcass { species: string; x: number; y: number; dir: number; t: number }
