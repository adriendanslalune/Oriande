/**
 * GameState: the whole game in one object. Scenes read and write it, never keep their own.
 * Everything here is plain data; `seen` is a Set for speed and save.ts serialises it.
 */
export interface Journey {
  x0: number; y0: number;
  x1: number; y1: number;
  /** ms walked so far */
  elapsed: number;
  /** ms needed for the whole walk */
  duration: number;
  /** distance along the journey already revealed (world units) */
  revealed: number;
  /** stopped short by deep water */
  shore: boolean;
}

export interface GameState {
  version: 1;
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
