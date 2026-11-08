// Draws map tiles off the main thread (OffscreenCanvas), so that walking or sliding the map
// never stutters while new country is drawn. Same drawing code as on the main thread.
import { drawTile } from './tiles';
import { townWindows } from './towns';
import { setArtKinds } from './wonderArt';

export interface TileRequest { id: number; ti: number; tj: number; res: number }
export interface TileReply {
  id: number; ti: number; tj: number; res: number;
  /** set when the tile could not be drawn here (the main thread then tries again or draws it) */
  error?: string;
  bitmap: ImageBitmap;
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
    // an independent copy of the picture, not a hand-over of the canvas's own memory: on
    // Firefox for Android a handed-over picture could come out blank, or showing another tile
    const bitmap = await createImageBitmap(art.canvas as unknown as OffscreenCanvas);
    const reply: TileReply = { id: m.id, ti: m.ti, tj: m.tj, res: m.res, bitmap, waves: art.waves, trees: art.trees, windows: [...townWindows] };
    (self as unknown as Worker).postMessage(reply, [bitmap]);
  } catch (err) {
    // never leave the main thread waiting: say what went wrong (out of memory on a phone...)
    (self as unknown as Worker).postMessage({ id: m.id, ti: m.ti, tj: m.tj, res: m.res, error: String(err) });
  }
};
