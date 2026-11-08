// Illustrations of the wonders (generated pictures, see docs/illustrations.md). They are drawn
// over the tiles at full resolution by the overlay; a wonder without a loaded picture keeps its
// engraved drawing in the tiles.
import type { WonderKind } from '../world/wonders';

const urls = import.meta.glob('../assets/wonders/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const images = new Map<WonderKind, HTMLImageElement>();

/** Width of each picture on the map, world units, and where its ground line sits (0 = top, 1 = bottom). */
export const WONDER_ART: Record<WonderKind, { width: number; ground: number }> = {
  tete: { width: 86, ground: 0.9 },
  rocher: { width: 74, ground: 1.0 },
  cristal: { width: 70, ground: 0.92 },
  titan: { width: 92, ground: 0.9 },
  arches: { width: 84, ground: 0.8 },
  arbre: { width: 84, ground: 0.93 },
};

/** Load every picture; resolves when all have loaded or failed (never rejects). */
export function loadWonderArt(): Promise<void> {
  if (typeof Image === 'undefined') return Promise.resolve();
  return Promise.all(Object.entries(urls).map(([path, url]) => new Promise<void>((done) => {
    const kind = path.split('/').pop()!.replace('.webp', '') as WonderKind;
    const img = new Image();
    img.onload = () => { images.set(kind, img); done(); };
    img.onerror = () => done();
    img.src = url;
  }))).then(() => undefined);
}

/** The loaded picture of a kind of wonder, if any. */
export const wonderImage = (kind: WonderKind): HTMLImageElement | undefined => images.get(kind);
