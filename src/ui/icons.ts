// Small pictograms for the menus and the header, drawn like the rest of the map: an ink line on
// paper, a touch of watercolour (asked by Adrien: a heart for life, a stomach for the belly, a bag
// for the pack...). Inline SVG, 24×24, the line in currentColor.

const S = 'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';
const wash = (c: string): string => `fill="${c}" fill-opacity=".55"`;

const PATHS: Record<string, string> = {
  heart: `<path ${wash('#b8402f')} d="M12 20s-7-4.3-7-10a3.8 3.8 0 0 1 7-2.3A3.8 3.8 0 0 1 19 10c0 5.7-7 10-7 10z"/>`,
  belly: `<path ${wash('#c98a6a')} d="M9 3v3.5c-2.2.8-3.6 3-3.6 6.1A6 6 0 0 0 16.6 16c.6-1.4 2.6-1.7 2.6-4.3 0-1.9-1.7-3.1-3.5-2.4-1.2.5-2 1.2-3.6.6C10.8 9.3 11 7.6 11 6V3"/>`,
  coin: `<circle ${wash('#c9a24a')} cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="4.6"/>`,
  bag: `<path ${wash('#8a6a46')} d="M5.5 10h13l-1.3 10h-10.4z"/><path d="M8.6 10V8a3.4 3.4 0 0 1 6.8 0v2M9 14h6"/>`,
  food: `<path ${wash('#b5703f')} d="M13.6 4.2a5 5 0 0 1 4.6 7.7c-1.2 1.6-3.3 1.8-4.6 1.7l-4.1 4.1"/><path d="M13.6 4.2c-2.4.4-4.3 2.6-3.9 5.3l.2 1.4M9.5 17.7a1.6 1.6 0 1 1-2.3 2.3 1.6 1.6 0 1 1-2-2 1.6 1.6 0 1 1 2.3-2.3z"/>`,
  wood: `<path ${wash('#9a7046')} d="M4 15.5 15.5 4l4.5 4.5L8.5 20z"/><ellipse cx="17.75" cy="6.25" rx="1.4" ry="3.1" transform="rotate(45 17.75 6.25)"/>`,
  stone: `<path ${wash('#9a958c')} d="M4 17.5 6.5 10l5-4 6 2 2.5 6.5-3.5 4H7z"/><path d="m11.5 6 1 5 4 1"/>`,
  fibre: `<path ${wash('#7c9450')} d="M12 20c0-6-1-10-4-14M12 20c0-6 1-11 5-15M12 20c-1-4-4-7-8-8M12 20c1-4 4-6 8-7"/>`,
  tools: `<path d="M5 19 15 9"/><path ${wash('#9a958c')} d="M13 5.5 15.5 3l5.5 5.5-2.5 2.5-2-.6-2.4-2.4z"/>`,
  make: `<path ${wash('#9a958c')} d="M4 15h11l1.5-3H20v3l-3 2v3H7v-3l-3-2z"/><path d="m7 9 4-4M9 11l4-4"/>`,
  fire: `<path ${wash('#e0782d')} d="M12 21c-3.6 0-6-2.3-6-5.4 0-3.3 2.6-4.6 3.2-8.1 1.9 1.2 2.6 3 2.6 4.6 1-.9 1.6-2.4 1.5-4C16.4 9.9 18 12.7 18 15.6 18 18.7 15.6 21 12 21z"/>`,
  hunt: `<path d="M4 20 18 6"/><path ${wash('#9a958c')} d="m15 5 5-1-1 5-3 .5-1.5-1.5z"/><path d="m6.5 15.5 2 2M4.5 17.5l2 2"/>`,
  fish: `<path ${wash('#8fa8ad')} d="M3.5 12c2.5-3.6 7-5 11-3l3.5-2.5V17.5L14.5 15c-4 2-8.5.6-11-3z"/><circle cx="7.6" cy="11" r=".9" fill="currentColor"/>`,
  walk: `<path ${wash('#8a6a46')} d="M8 4.5c1.8 0 2.4 2 2.4 4.2S9.4 13 8 13s-2.4-2-2.4-4.3S6.2 4.5 8 4.5zM16 10c1.6 0 2.3 1.8 2.3 3.9S17.4 18 16 18s-2.3-1.9-2.3-4.1S14.4 10 16 10z"/><path d="M7 15.5h2M15 20h2"/>`,
  enter: `<path ${wash('#c7b48d')} d="M4.5 11 12 4.5l7.5 6.5V20h-15z"/><path d="M10 20v-5.5h4V20"/>`,
  inn: `<path d="M3.5 18V7M3.5 14h17v4M20.5 14v-2.5a2.5 2.5 0 0 0-2.5-2.5h-7v5"/><path ${wash('#c7b48d')} d="M5.5 12a1.8 1.8 0 1 1 3.6 0 1.8 1.8 0 1 1-3.6 0z"/>`,
  shop: `<path d="M12 4v15M7 19h10M5 7h14"/><path ${wash('#c9a24a')} d="M5 7 2.8 12.5a2.4 2.4 0 0 0 4.4 0zM19 7l-2.2 5.5a2.4 2.4 0 0 0 4.4 0z"/>`,
  smith: `<path ${wash('#7d7a74')} d="M3 8h13c0 2.5 2 3.5 5 3.5V13h-6l-1 3h2v3H7v-3h2l-1-3H6c-2 0-3-2-3-5z"/>`,
  tavern: `<path ${wash('#c9a24a')} d="M6 8h9v11.5H6z"/><path d="M15 10.5h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2M5.5 8c0-2 1.6-3 3-2.5C9.8 4 12.5 4 13.5 5.7c1.6-.4 2.5.9 2 2.3"/>`,
  sleep: `<path ${wash('#7f8fb0')} d="M15.5 4.5a7.5 7.5 0 1 0 4 12 6.4 6.4 0 0 1-4-12z"/>`,
  cook: `<path ${wash('#7d7a74')} d="M4 10h12v2a6 6 0 0 1-12 0z"/><path d="M16 11h4.5M7.5 6.5c0-1 1-1.5 1-2.5M11.5 6.5c0-1 1-1.5 1-2.5"/>`,
  sell: `<circle ${wash('#c9a24a')} cx="9" cy="14" r="5"/><path d="m14 5 5 0 0 5M19 5l-6 6"/>`,
  book: `<path ${wash('#a8754a')} d="M5 4.5h11.5a2 2 0 0 1 2 2V20H7a2 2 0 0 1-2-2z"/><path d="M5 18a2 2 0 0 1 2-2h11.5M9 8h6M9 11h4"/>`,
  rumor: `<path ${wash('#ece3cb')} d="M4 6.5h16v9h-9l-4.5 3.5v-3.5H4z"/><path d="M8 10h8M8 12.5h5"/>`,
};

/** A pictogram as inline SVG markup ('' if unknown). */
export function icon(name: string, size = 18): string {
  const p = PATHS[name];
  return p ? `<svg class="ico" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" ${S}>${p}</svg>` : '';
}

/** The pictogram of what is gathered (wood, stones, fibres...), or a basket. */
export const iconOfResource = (res: string): string => ({ bois: 'wood', pierre: 'stone', fibre: 'fibre' } as Record<string, string>)[res] ?? 'fibre';
