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

/** A fight in progress (kept in the save: quitting mid-fight comes back to it). */
export interface Battle {
  /** the monster's id in data/monsters.json */
  monster: string;
  /** its life left */
  hp: number;
}

export interface GameState {
  version: 4;
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
  /** leagues walked when the last fight ended: a short calm follows */
  calmUntil: number;
  /** where the explorer wakes up after a lost fight: the last town found (or the start) */
  rest: [number, number];
  /** a fight in progress, if any */
  battle: Battle | null;
}
