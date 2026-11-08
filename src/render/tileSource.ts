// Where map tiles come from: a small pool of workers drawing them in the background, nearest
// first; or, where workers cannot draw (no OffscreenCanvas), the main thread, one per frame.
import { drawTile, type TileArt } from './tiles';
import { townWindows } from './towns';
import { loadedArtKinds } from './wonderArt';
import type { TileReply } from './tileWorker';

export interface ReadyTile {
  ti: number; tj: number; res: number;
  image: HTMLCanvasElement | ImageBitmap;
  art: Omit<TileArt, 'canvas'>;
}

interface Job { ti: number; tj: number; res: number; key: string }

const canWork = typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined' && (() => {
  try { return !!new OffscreenCanvas(1, 1).getContext('2d'); } catch { return false; }
})();

/** A tile that takes longer than this in a worker is given up on (the worker is restarted). */
const STALL_MS = 12_000;
/** Attempts in a worker before a tile is drawn on the main thread instead. */
const TRIES = 2;
/** Marks a tile that could not be drawn anywhere. */
const GIVE_UP = 99;

interface Slot { w: Worker; busy: string | null; since: number }

export class TileSource {
  private readonly workers: Slot[] = [];
  /** wanted this frame, in order of priority */
  private queue: Job[] = [];
  private readonly pending = new Set<string>();
  /** failed attempts per tile; past TRIES the tile is drawn here */
  private readonly failures = new Map<string, number>();
  private nextId = 1;

  constructor(private readonly ready: (t: ReadyTile) => void) {
    if (!canWork) return;
    const n = Math.max(1, Math.min(3, ((navigator.hardwareConcurrency || 2) >> 1)));
    for (let k = 0; k < n; k++) this.workers.push(this.spawn());
  }

  /**
   * A worker, and what to do when it answers, fails, or dies. Whatever happens, the tile it
   * was drawing is released so that it is asked for again: a tile is never lost (a blank square
   * on the map, seen once on Firefox for Android).
   */
  private spawn(): Slot {
    const w = new Worker(new URL('./tileWorker.ts', import.meta.url), { type: 'module' });
    const slot: Slot = { w, busy: null, since: 0 };
    const release = (failed: boolean): void => {
      if (slot.busy) {
        this.pending.delete(slot.busy);
        if (failed) this.failures.set(slot.busy, (this.failures.get(slot.busy) ?? 0) + 1);
      }
      slot.busy = null;
    };
    w.onmessage = (e: MessageEvent<TileReply>): void => {
      const r = e.data;
      if (r.error) {
        console.error('tile ' + r.ti + ',' + r.tj + ' failed in a worker: ' + r.error);
        release(true);
      } else {
        for (const [key, win] of r.windows) townWindows.set(key, win);
        release(false);
        this.ready({ ti: r.ti, tj: r.tj, res: r.res, image: r.bitmap, art: { waves: r.waves, trees: r.trees } });
      }
      this.pump();
    };
    // the worker itself broke down: replace it
    w.onerror = (e): void => { e.preventDefault?.(); console.error('tile worker error', e.message); release(true); this.replace(slot); };
    w.onmessageerror = (): void => { release(true); this.pump(); };
    w.postMessage({ art: loadedArtKinds() });
    return slot;
  }

  private replace(slot: Slot): void {
    const k = this.workers.indexOf(slot);
    if (k < 0) return;
    slot.w.terminate();
    this.workers[k] = this.spawn();
    this.pump();
  }

  /** Tell the workers which pictures are loaded (the tiles leave room for them). */
  refreshArt(): void { for (const s of this.workers) s.w.postMessage({ art: loadedArtKinds() }); }

  /** The tiles wanted now, most urgent first (replaces the previous wishes). */
  want(jobs: { ti: number; tj: number; res: number }[]): void {
    const now = performance.now();
    // a worker stuck on a tile for too long is restarted, and the tile asked for again
    for (const s of [...this.workers]) {
      if (s.busy && now - s.since > STALL_MS) {
        this.pending.delete(s.busy);
        this.failures.set(s.busy, (this.failures.get(s.busy) ?? 0) + 1);
        s.busy = null;
        this.replace(s);
      }
    }
    this.queue = jobs.map((j) => ({ ...j, key: j.ti + ',' + j.tj + '@' + j.res })).filter((j) => !this.pending.has(j.key));
    // no workers, or a tile they could not draw: draw one on this thread, now
    const here = this.workers.length ? this.queue.find((j) => { const f = this.failures.get(j.key) ?? 0; return f >= TRIES && f < GIVE_UP; }) : this.queue.find((j) => (this.failures.get(j.key) ?? 0) < GIVE_UP);
    if (here) {
      this.queue = this.queue.filter((j) => j !== here);
      try {
        const art = drawTile(here.ti, here.tj, undefined, here.res);
        this.failures.delete(here.key);
        this.ready({ ti: here.ti, tj: here.tj, res: here.res, image: art.canvas, art: { waves: art.waves, trees: art.trees } });
      } catch (err) {
        console.error('tile ' + here.key + ' could not be drawn', err);
        this.failures.set(here.key, GIVE_UP); // not every frame: let it go
      }
    }
    if (this.workers.length) this.pump();
  }

  private pump(): void {
    for (const s of this.workers) {
      if (s.busy) continue;
      const j = this.queue.find((q) => (this.failures.get(q.key) ?? 0) < TRIES);
      if (!j) return;
      this.queue = this.queue.filter((q) => q !== j);
      s.busy = j.key; s.since = performance.now(); this.pending.add(j.key);
      s.w.postMessage({ id: this.nextId++, ti: j.ti, tj: j.tj, res: j.res });
    }
  }
}
