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

export interface GameState {
  version: 3;
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
}
