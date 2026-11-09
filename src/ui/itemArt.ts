// The picture of each thing the explorer carries or makes, for the pack and the almanac. The
// pictures will be drawn with ChatGPT (see docs/items.md) and dropped in src/assets/items/<id>.webp;
// until one is there, a placeholder pictogram in ink stands in.
import { icon } from './icons';

const urls = import.meta.glob('../assets/items/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const PICTURES = new Map(Object.entries(urls).map(([path, url]) => [path.split('/').pop()!.replace('.webp', ''), url]));

/** Placeholder pictograms, by item, until its picture is drawn. */
const STAND_IN: Record<string, string> = {
  remede: 'heart', biscuit: 'food', viande: 'food', viande_cuite: 'food', poisson: 'fish', poisson_cuit: 'fish',
  baies: 'fibre', champignon: 'fibre', champignon_grille: 'cook', bois: 'wood', pierre: 'stone', fibre: 'fibre',
  herbes: 'fibre', peau: 'bag', os: 'tools', baton: 'walk', torche: 'fire', canne: 'fish', lance: 'hunt',
  hachette: 'tools', pioche: 'tools', couteau: 'hunt', hamecon: 'fish', veste: 'bag', coutelas: 'hunt', sabre: 'hunt', feu: 'fire',
};

/** Whether this item has its real picture yet. */
export const hasPicture = (id: string): boolean => PICTURES.has(id);

/** The picture of an item, as markup for a slot (an <img>, or the placeholder pictogram). */
export function itemPicture(id: string, size = 40): string {
  const url = PICTURES.get(id);
  if (url) return `<img class="pic" src="${url}" width="${size}" height="${size}" alt="" draggable="false">`;
  return `<span class="pic stand-in">${icon(STAND_IN[id] ?? 'bag', Math.round(size * 0.7))}</span>`;
}
