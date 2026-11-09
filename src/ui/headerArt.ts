// The pictures at the head of the pack and the almanac (asked by Adrien). To be drawn with ChatGPT
// (see docs/headers.md) and dropped in src/assets/headers/<key>.webp; until one is there, the
// little painted landscape stays.
const urls = import.meta.glob('../assets/headers/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const PICTURES = new Map(Object.entries(urls).map(([path, url]) => [path.split('/').pop()!.replace('.webp', ''), url]));

/** The url of a page's head picture (sac, almanac), or null. */
export const headerPicture = (key: string): string | null => PICTURES.get(key) ?? null;
