// Draws map tiles off the main thread (OffscreenCanvas), so that walking or sliding the map
// never stutters while new country is drawn. Same drawing code as on the main thread.
import { drawTile } from './tiles';
import { townWindows } from './towns';
import { setArtKinds } from './wonderArt';

export interface TileRequest { id: number; ti: number; tj: number; res: number; raw?: boolean }
export interface TileReply {
  id: number; ti: number; tj: number; res: number;
  /** set when the tile could not be drawn here (the main thread then tries again or draws it) */
  error?: string;
  bitmap?: ImageBitmap;
  /** with `raw`: the picture as plain RGBA pixels (no ImageBitmap at all) */
  pixels?: ArrayBuffer; w?: number; h?: number;
  waves: [number, number, number][];
  trees: [number, number][];
  windows: [string, [number, number, number][]][];
}

const make = (): HTMLCanvasElement => new OffscreenCanvas(1, 1) as unknown as HTMLCanvasElement;

self.onmessage = async (e: MessageEvent<{ art: string[] } | TileRequest>): Promise<void> => {
  const m = e.data;
  if ('art' in m) { setArtKinds(m.art); return; }
  try {
    townWindows.clear();
    const art = drawTile(m.ti, m.tj, make, m.res);
    const base = { id: m.id, ti: m.ti, tj: m.tj, res: m.res, waves: art.waves, trees: art.trees, windows: [...townWindows] };
    const cv = art.canvas as unknown as OffscreenCanvas;
    if (m.raw) {
      // plain pixels: pictures handed over from a worker came out blank, shifted to another
      // tile, or striped on Firefox for Android; raw pixels are copied by the page itself
      const data = cv.getContext('2d')!.getImageData(0, 0, cv.width, cv.height).data;
      const reply: TileReply = { ...base, pixels: data.buffer as ArrayBuffer, w: cv.width, h: cv.height };
      (self as unknown as Worker).postMessage(reply, [data.buffer as ArrayBuffer]);
    } else {
      // an independent copy of the picture, not a hand-over of the canvas's own memory
      const bitmap = await createImageBitmap(cv);
      const reply: TileReply = { ...base, bitmap };
      (self as unknown as Worker).postMessage(reply, [bitmap]);
    }
  } catch (err) {
    // never leave the main thread waiting: say what went wrong (out of memory on a phone...)
    (self as unknown as Worker).postMessage({ id: m.id, ti: m.ti, tj: m.tj, res: m.res, error: String(err) });
  }
};
