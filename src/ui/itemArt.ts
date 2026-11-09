// The picture of each thing the explorer carries or makes, for the pack and the almanac. The
// pictures will be drawn with ChatGPT (see docs/items.md) and dropped in src/assets/items/<id>.webp;
// until one is there, a question mark stands in.

const urls = import.meta.glob('../assets/items/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const PICTURES = new Map(Object.entries(urls).map(([path, url]) => [path.split('/').pop()!.replace('.webp', ''), url]));

/** Whether this item has its real picture yet. */
export const hasPicture = (id: string): boolean => PICTURES.has(id);

/** The picture of an item, as markup for a slot: its <img>, or a "?" until it is drawn (asked by Adrien). */
export function itemPicture(id: string, size = 40): string {
  const url = PICTURES.get(id);
  if (url) return `<img class="pic" src="${url}" width="${size}" height="${size}" alt="" draggable="false">`;
  return `<span class="pic stand-in" style="font: ${Math.round(size * 0.6)}px/1 'IM Fell English', serif; color: #9a8f7f">?</span>`;
}
