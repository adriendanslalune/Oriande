// Illustrations of the wonders (generated pictures, see docs/illustrations.md). They are drawn
// over the tiles at full resolution by the overlay; a wonder without a loaded picture keeps its
// engraved drawing in the tiles.
import type { WonderKind } from '../world/wonders';
import type { LandmarkKind } from '../world/landmarks';

const wonderUrls = import.meta.glob('../assets/wonders/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
// The strange places stay pictograms on the map (asked by Adrien: they are frequent, a rich
// picture each time would be too repetitive). Their illustrations in src/assets/landmarks are
// kept for the discovery card, and not loaded here.
const landmarkUrls: Record<string, string> = {};
const images = new Map<WonderKind, HTMLImageElement>();
const landmarkImages = new Map<LandmarkKind, HTMLImageElement>();

/** Width of each picture on the map, world units, and where its ground line sits (0 = top, 1 = bottom). */
export const WONDER_ART: Record<WonderKind, { width: number; ground: number }> = {
  tete: { width: 86, ground: 0.9 },
  rocher: { width: 74, ground: 1.0 },
  cristal: { width: 70, ground: 0.92 },
  titan: { width: 92, ground: 0.9 },
  arches: { width: 84, ground: 0.8 },
  arbre: { width: 84, ground: 0.93 },
};

/** Same for the strange places: width on the map (world units) and ground line. */
export const LANDMARK_ART: Record<LandmarkKind, { width: number; ground: number }> = {
  ruines: { width: 40, ground: 0.92 },
  squelette: { width: 46, ground: 0.85 },
  champignons: { width: 36, ground: 0.93 },
  cratere: { width: 42, ground: 0.6 },
  tour: { width: 25, ground: 0.95 },
  geyser: { width: 40, ground: 0.85 },
  epave: { width: 44, ground: 0.7 },
  tourbillon: { width: 46, ground: 0.5 },
};

function loadAll<K extends string>(urls: Record<string, string>, into: Map<K, HTMLImageElement>): Promise<void>[] {
  return Object.entries(urls).map(([path, url]) => new Promise<void>((done) => {
    const kind = path.split('/').pop()!.replace('.webp', '') as K;
    const img = new Image();
    img.onload = () => { into.set(kind, img); done(); };
    img.onerror = () => done();
    img.src = url;
  }));
}

/** Load every picture; resolves when all have loaded or failed (never rejects). */
export function loadWonderArt(): Promise<void> {
  if (typeof Image === 'undefined') return Promise.resolve();
  return Promise.all([...loadAll(wonderUrls, images), ...loadAll(landmarkUrls, landmarkImages)]).then(() => undefined);
}

/** The loaded picture of a kind of strange place, if any. */
export const landmarkImage = (kind: LandmarkKind): HTMLImageElement | undefined => landmarkImages.get(kind);

/** The loaded picture of a kind of wonder, if any. */
export const wonderImage = (kind: WonderKind): HTMLImageElement | undefined => images.get(kind);

/**
 * Kinds whose pictures exist, as told to a tile worker (it cannot load images itself): the
 * tiles leave room for those pictures instead of drawing the engraved version.
 */
const artKinds = new Set<string>();
export const setArtKinds = (kinds: string[]): void => { artKinds.clear(); for (const k of kinds) artKinds.add(k); };
/** The kinds whose pictures are loaded here, to pass to a tile worker. */
export const loadedArtKinds = (): string[] => [...images.keys(), ...[...landmarkImages.keys()].map((k) => 'landmark:' + k)];
export const hasWonderArt = (kind: WonderKind): boolean => images.has(kind) || artKinds.has(kind);
export const hasLandmarkArt = (kind: LandmarkKind): boolean => landmarkImages.has(kind) || artKinds.has('landmark:' + kind);
