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

export class TileSource {
  private readonly workers: { w: Worker; busy: string | null }[] = [];
  /** wanted this frame, in order of priority */
  private queue: Job[] = [];
  private readonly pending = new Set<string>();
  private nextId = 1;

  constructor(private readonly ready: (t: ReadyTile) => void) {
    if (!canWork) return;
    const n = Math.max(1, Math.min(3, ((navigator.hardwareConcurrency || 2) >> 1)));
    for (let k = 0; k < n; k++) {
      const w = new Worker(new URL('./tileWorker.ts', import.meta.url), { type: 'module' });
      const slot = { w, busy: null as string | null };
      w.onmessage = (e: MessageEvent<TileReply>): void => {
        const r = e.data;
        for (const [key, win] of r.windows) townWindows.set(key, win);
        if (slot.busy) this.pending.delete(slot.busy);
        slot.busy = null;
        this.ready({ ti: r.ti, tj: r.tj, res: r.res, image: r.bitmap, art: { waves: r.waves, trees: r.trees } });
        this.pump();
      };
      w.postMessage({ art: loadedArtKinds() });
      this.workers.push(slot);
    }
  }

  /** Tell the workers which pictures are loaded (the tiles leave room for them). */
  refreshArt(): void { for (const s of this.workers) s.w.postMessage({ art: loadedArtKinds() }); }

  /** The tiles wanted now, most urgent first (replaces the previous wishes). */
  want(jobs: { ti: number; tj: number; res: number }[]): void {
    this.queue = jobs.map((j) => ({ ...j, key: j.ti + ',' + j.tj + '@' + j.res })).filter((j) => !this.pending.has(j.key));
    if (this.workers.length) this.pump();
    else { // no workers: draw one on this thread, now
      const j = this.queue.shift();
      if (j) {
        const art = drawTile(j.ti, j.tj, undefined, j.res);
        this.ready({ ti: j.ti, tj: j.tj, res: j.res, image: art.canvas, art: { waves: art.waves, trees: art.trees } });
      }
    }
  }

  private pump(): void {
    for (const s of this.workers) {
      if (s.busy) continue;
      const j = this.queue.shift();
      if (!j) return;
      s.busy = j.key; this.pending.add(j.key);
      s.w.postMessage({ id: this.nextId++, ti: j.ti, tj: j.tj, res: j.res });
    }
  }
}
