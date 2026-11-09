// The pictures of towns: the view on arrival and the places. To be drawn
// with ChatGPT (see docs/towns.md) and dropped in src/assets/towns/<key>.webp; until one is there,
// a "?" stands in, over a plain sky and ground.
const urls = import.meta.glob('../assets/towns/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const PICTURES = new Map(Object.entries(urls).map(([path, url]) => [path.split('/').pop()!.replace('.webp', ''), url]));

/** The url of a town picture (village, city, inn-village, shop-city, smith, tavern...), or null. */
export const townPicture = (key: string): string | null => PICTURES.get(key) ?? null;
