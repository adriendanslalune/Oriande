// What stands for a town and its places, instead of pictures (asked by Adrien: illustrations broke
// the spirit of the game). A town: its outline in one single ink line, without any detail, its own
// for each town (drawn from its key), quiet enough to leave room for the player's imagination.
// A place: a big engraved emblem (a bed, a balance, an anvil and hammer, a mug) over its name on
// a vintage ribbon.

const INK = '#2b2117';

/** A small deterministic random generator, from a string. */
function rng(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

// the outlines of towns drawn with ChatGPT, in src/assets/skylines/<village|city>-<n>.webp
const lineUrls = import.meta.glob('../assets/skylines/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const LINES = new Map(Object.entries(lineUrls).map(([path, url]) => [path.split('/').pop()!.replace('.webp', ''), url]));

const f = (n: number): string => (Math.round(n * 10) / 10).toString();

/**
 * The outline of a town in one line: the ground, and on it the shapes of its houses, trees and
 * chapel (a village), or of its tall houses, walls, towers and steeples (a city).
 */
export function skyline(seed: string, city: boolean, w = 360, h = 96): string {
  // drawn with ChatGPT (docs/emblems.md): village-1, village-2... city-1...; each town takes one by its key
  const kind = city ? 'city' : 'village', own = [...LINES.keys()].filter((k) => k.startsWith(kind + '-')).sort();
  if (own.length) {
    const url = LINES.get(own[Math.floor(rng(seed)() * own.length)]);
    return `<img class="skyline art" src="${url}" alt="">`; // transparent around its line
  }
  const r = rng(seed + (city ? ':city' : ':village')), base = h - 6, pts: string[] = [`M0 ${base}`];
  const to = (x: number, y: number): void => { pts.push(`L${f(x)} ${f(y)}`); };
  const between = (lo: number, hi: number): number => lo + r() * (hi - lo);
  const cross = (x: number, y: number): void => { to(x, y - 6); to(x, y - 4.5); to(x - 2, y - 4.5); to(x + 2, y - 4.5); to(x, y - 4.5); to(x, y); };
  // a pitched roof from (x, top) to (x + ww, top), peak rh above, with maybe a chimney on its right slope
  const roof = (x: number, ww: number, top: number, rh: number, chimney: boolean): void => {
    to(x - 2, top); to(x + ww / 2, top - rh);
    if (chimney) {
      const c = x + ww * 0.7, s = rh / (ww / 2 + 2), y0 = top - rh + (c - x - ww / 2) * s;
      to(c, y0); to(c, y0 - 7); to(c + 5, y0 - 7); to(c + 5, y0 + 5 * s);
    }
    to(x + ww + 2, top);
  };
  const house = (x: number, ww: number, wh: number, rh: number, chimney: boolean): void => {
    to(x, base); to(x, base - wh); roof(x, ww, base - wh, rh, chimney); to(x + ww, base - wh); to(x + ww, base);
  };
  const tree = (x: number, rr: number): void => {
    const cx = x + rr, th = between(4, 8), y = base - th, a = between(0.8, 1.15), b = between(0.8, 1.15);
    to(cx - 1.2, base); to(cx - 1.2, y);
    pts.push(`Q${f(cx - rr * 1.25 * a)} ${f(y - rr * 0.2)} ${f(cx - rr * 0.55)} ${f(y - rr * 1.1 * a)}`);
    pts.push(`Q${f(cx)} ${f(y - rr * 2.1)} ${f(cx + rr * 0.55)} ${f(y - rr * 1.1 * b)}`);
    pts.push(`Q${f(cx + rr * 1.25 * b)} ${f(y - rr * 0.2)} ${f(cx + 1.2)} ${f(y)}`);
    to(cx + 1.2, base);
  };
  const chapel = (x: number): number => {
    const th = between(30, 36), nave = between(26, 32);
    to(x, base); to(x, base - th); to(x + 5, base - th - 16); cross(x + 5, base - th - 16); to(x + 10, base - th);
    to(x + 10, base - 18); roof(x + 10, nave, base - 18, 12, false); to(x + 10 + nave, base - 18); to(x + 10 + nave, base);
    return 10 + nave;
  };
  const block = (x: number, ww: number, hh: number): void => {
    to(x, base); to(x, base - hh);
    if (r() < 0.5) roof(x, ww, base - hh, between(8, 13), r() < 0.6);
    else { // a flat roof with a cornice and chimneys
      to(x - 1.5, base - hh); to(x - 1.5, base - hh - 2.5);
      for (let c = x + 4; c < x + ww - 6; c += between(9, 15)) { to(c, base - hh - 2.5); to(c, base - hh - 9); to(c + 4, base - hh - 9); to(c + 4, base - hh - 2.5); }
      to(x + ww + 1.5, base - hh - 2.5); to(x + ww + 1.5, base - hh);
    }
    to(x + ww, base - hh); to(x + ww, base);
  };
  const wall = (x: number, ww: number): void => {
    const hh = 22; to(x, base); to(x, base - hh);
    for (let c = x; c < x + ww - 4; c += 7) { to(c, base - hh - 4); to(c + 3.5, base - hh - 4); to(c + 3.5, base - hh); to(Math.min(c + 7, x + ww), base - hh); }
    to(x + ww, base - hh); to(x + ww, base);
  };
  const tower = (x: number, ww: number, hh: number): void => {
    to(x, base); to(x, base - hh); to(x - 2, base - hh); to(x + ww / 2, base - hh - ww * 1.2);
    if (r() < 0.5) { const y = base - hh - ww * 1.2; to(x + ww / 2, y - 9); to(x + ww / 2 + 6, y - 7); to(x + ww / 2, y - 5); to(x + ww / 2, y); }
    to(x + ww + 2, base - hh); to(x + ww, base - hh); to(x + ww, base);
  };
  const steeple = (x: number): number => {
    const hh = between(46, 56);
    to(x, base); to(x, base - hh); to(x + 7, base - hh - 26); cross(x + 7, base - hh - 26); to(x + 14, base - hh); to(x + 14, base);
    return 14;
  };
  const clock = (x: number): number => {
    const hh = between(50, 58);
    to(x, base); to(x, base - hh); to(x - 1.5, base - hh); to(x - 1.5, base - hh - 3);
    pts.push(`A10 9 0 0 1 ${f(x + 19.5)} ${f(base - hh - 3)}`);
    to(x + 19.5, base - hh); to(x + 18, base - hh); to(x + 18, base);
    return 18;
  };

  let x = between(4, 14);
  if (!city) {
    const church = Math.floor(between(1, 4)); // which element is the chapel
    for (let k = 0; x < w - 30; k++) {
      if (k === church) x += chapel(x);
      else if (r() < 0.3) { const rr = between(6, 10); tree(x, rr); x += rr * 2; }
      else { const ww = between(18, 38); house(x, ww, between(9, 17), between(7, 15), r() < 0.45); x += ww; }
      x += r() < 0.25 ? between(22, 40) : between(4, 12); // a gap now and then: a field, a lane
    }
  } else {
    const church = Math.floor(between(2, 5)), belfry = church + Math.floor(between(2, 4));
    for (let k = 0; x < w - 24; k++) {
      if (k === church) x += steeple(x);
      else if (k === belfry) x += clock(x);
      else {
        const p = r();
        if (p < 0.18) { const ww = between(24, 40); wall(x, ww); x += ww; }
        else if (p < 0.32) { const ww = between(12, 16); tower(x, ww, between(34, 44)); x += ww; }
        else { const ww = between(18, 30); block(x, ww, between(22, 40)); x += ww; }
      }
      x += between(0, 4);
    }
  }
  to(w, base);
  return `<svg class="skyline" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMax meet" aria-hidden="true"><path d="${pts.join('')}" fill="none" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}

const LINE = `stroke="${INK}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"`;
const HATCH = `stroke="${INK}" stroke-width=".8" stroke-linecap="round" opacity=".55"`;

/** The big engraved emblem of a place: a bed, a balance, an anvil and hammer, a mug of beer. */
export const EMBLEMS: Record<string, string> = {
  inn: `<path ${LINE} fill="none" d="M9 50V22a6 6 0 0 1 12 0v16M55 50V34"/><path ${LINE} fill="#d9c49a" d="M9 38h46v8H9z"/>
    <path ${LINE} fill="#b9c3cf" d="M25 31h26q4 0 4 4v3H25z"/><path ${LINE} fill="#f3e9cf" d="M12 36c0-4 3-6 7-6s6 2 6 4-2 2-6 2z"/>
    <path ${HATCH} d="M13 42h40M15 44h36M29 34h22M27 36.5h26"/><path ${LINE} d="M9 50v4M55 50v4M9 46h46"/>`,
  shop: `<circle ${LINE} fill="#c9a24a" cx="32" cy="10" r="3"/><path ${LINE} fill="none" d="M32 13v37M12 18h40M12 18l-6 16M12 18l6 16M52 18l-6 16M52 18l6 16"/>
    <path ${LINE} fill="#d8b866" d="M5 34h14a7 4 0 0 1-14 0zM45 34h14a7 4 0 0 1-14 0z"/>
    <path ${LINE} fill="#b89a5a" d="M24 56h16l-2-6H26z"/><path ${HATCH} d="M8 37h8M48 37h8M27 53h10"/>`,
  smith: `<path ${LINE} fill="#a9a59c" d="M8 30h34c0 4 6 7 16 7v4H44l-3 5h4v6H21v-6h4l-3-5h-7c-5 0-7-5-7-11z"/>
    <path ${HATCH} d="M12 35h28M14 38h26M25 49h14"/>
    <path ${LINE} fill="#8a6a46" d="M36 22 56 6l2 2.4-20 16.2z"/><path ${LINE} fill="#7d7a74" d="M27 14l8-6 8 10-8 6z"/>`,
  tavern: `<path ${LINE} fill="#d9a441" d="M15 22h26v28a4 4 0 0 1-4 4H19a4 4 0 0 1-4-4z"/>
    <path ${LINE} fill="none" d="M41 27h5a6 6 0 0 1 6 6v7a6 6 0 0 1-6 6h-5"/>
    <path ${LINE} fill="#fbf6e6" d="M13 23c-1-5 3-8 7-7 1-4 7-5 10-2 3-3 9-2 10 2 4 0 6 4 4 7z"/>
    <path ${HATCH} d="M21 28v22M28 28v23M35 28v22"/>`,
};

// The shop signs drawn with ChatGPT (asked by Adrien: a hanging sign, like a shop's, not a ribbon):
// see docs/emblems.md, src/assets/signs/<key>.webp (inn-village, inn-city, shop-village, shop-city,
// smith, tavern). The board has an empty band where the name is written, in the player's language.
// Until a sign is there, the little emblem over a ribbon stands in.
const urls = import.meta.glob('../assets/signs/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const SIGNS = new Map(Object.entries(urls).map(([path, url]) => [path.split('/').pop()!.replace('.webp', ''), url]));

/** A place's emblem as SVG markup (the stand-in for its sign). */
export const emblem = (key: string, size = 64): string =>
  `<svg class="emblem" viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true">${EMBLEMS[key] ?? ''}</svg>`;

let ribbons = 0;

/**
 * The empty space on each board, measured on the pictures (shares of their size): its left and right
 * inner edges, and the top and bottom of the blank space above the shop's symbol. The name is written
 * straight in its middle, in the player's language.
 */
const BLANK: Record<string, [number, number, number, number]> = {
  'inn-village': [0.044, 0.956, 0.219, 0.734], 'inn-city': [0.057, 0.942, 0.248, 0.736],
  'shop-village': [0.031, 0.968, 0.199, 0.624], 'shop-city': [0.060, 0.938, 0.266, 0.625],
  smith: [0.051, 0.946, 0.266, 0.633], tavern: [0.047, 0.950, 0.251, 0.610],
};
/** The pictures' shape (height / width). */
const RATIO = 0.68;

/** A place's sign with its name: the board if drawn, else the emblem over a ribbon. */
export function shopSign(sign: string, key: string, title: string, size: number): string {
  const url = SIGNS.get(sign);
  if (!url) return emblem(key, size) + ribbon(title);
  const W = 720, H = Math.round(W * RATIO), [x0, x1, y0, y1] = BLANK[sign] ?? [0.05, 0.95, 0.25, 0.65];
  const room = (x1 - x0) * W * 0.8, px = Math.min(H * (y1 - y0) * 0.5, Math.floor(room / (title.length * 0.6))); // a long name, smaller
  return `<div class="shopsign" style="width:${Math.round(size * 3.1)}px"><img src="${url}" alt="">
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><text x="${W * (x0 + x1) / 2}" y="${H * (y0 + y1) / 2}" text-anchor="middle" dominant-baseline="central"
    font-family="'IM Fell English SC', serif" font-size="${Math.round(px)}" letter-spacing="2" fill="#2b2117">${esc(title)}</text></svg></div>`;
}

// The heads of the satchel and the codex (asked by Adrien: like the towns' outlines): a one-line drawing
// from ChatGPT in src/assets/headers/<besace|codex>.webp (see docs/emblems.md); until then, a coded one.
const headUrls = import.meta.glob('../assets/headers/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const HEADS = new Map(Object.entries(headUrls).map(([path, url]) => [path.split('/').pop()!.replace('.webp', ''), url]));
const LINE_G = `fill="none" stroke="${INK}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"`;
const HEAD_LINES: Record<string, string> = {
  besace: `<svg viewBox="0 0 360 96" class="line"><g ${LINE_G}>
  <path d="M0 88 Q40 86 70 88 H360"/>
  <path d="M70 88 V22 M66 22 h8"/>
  <path d="M92 88 V50 Q92 38 104 38 H126 Q138 38 138 50 V88"/><path d="M93 54 Q115 66 137 54"/><path d="M102 68 h26 v14 h-26 z"/><path d="M108 38 q7 -9 14 0"/>
  <path d="M152 61 H180 a13.5 13.5 0 0 1 0 27 H152 a13.5 13.5 0 0 1 0 -27 z"/><circle cx="152" cy="74.5" r="6"/><path d="M164 61 v27 M174 61 v27"/>
  <ellipse cx="222" cy="84" rx="20" ry="4"/><ellipse cx="222" cy="80" rx="17" ry="3.5"/><ellipse cx="222" cy="76" rx="14" ry="3"/>
  <path d="M256 88 h20 M258 88 V66 h16 v22 M258 66 L274 88 M274 66 L258 88 M256 66 l10 -8 l10 8"/><circle cx="266" cy="55" r="3"/>
  <path d="M288 88 V76 h12 v12 M300 79 q5 0 5 4 q0 4 -5 4"/>
  <path d="M312 88 L330 56 L348 88 M330 56 V88"/>
</g></svg>`,
  codex: `<svg viewBox="0 0 360 96" class="line"><g ${LINE_G}>
  <path d="M0 88 H360"/>
  <path d="M58 88 V58 h10 v30 M63 58 q-4 -6 0 -12 q4 6 0 12"/>
  <path d="M86 86 Q108 79 130 86 Q152 79 174 86 V60 Q152 53 130 60 Q108 53 86 60 Z M130 60 V86"/>
  <path d="M188 70 h36 q-2 18 -18 18 q-16 0 -18 -18 M198 88 h16 M212 70 L228 44"/>
  <path d="M240 88 V68 h18 v20 M249 68 L242 38 M249 68 L249 34 M249 68 L256 40 M244 48 l-5 -2 M249 44 l5 -3 M253 52 l5 -1"/>
  <path d="M270 88 l8 -10 l7 10 M286 88 l6 -7 l6 7"/>
  <circle cx="318" cy="80" r="8"/><path d="M318 74 L320 80 L318 86 L316 80 Z M318 72 v-3"/>
</g></svg>`,
};

/** The one-line drawing at the head of the satchel or the codex. */
export const headLine = (key: string): string => {
  const url = HEADS.get(key);
  return url ? `<img class="line" src="${url}" alt="">` : HEAD_LINES[key] ?? '';
};

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * A vintage ribbon with a title written along its curve: a slightly arched band, its two tails
 * folded behind with a notch.
 */
export function ribbon(title: string): string {
  // a long name is pressed a little rather than shrunk too small to read
  const id = 'rib' + ++ribbons, size = Math.min(23, Math.round(420 / Math.max(10, title.length)));
  const fit = title.length * (size * 0.58 + 1) > 206 ? ' textLength="206" lengthAdjust="spacingAndGlyphs"' : '';
  return `<svg class="ribbon" viewBox="0 0 300 66" aria-hidden="true">
    <path d="M6 28H50V56H6L18 42Z" fill="#dcc89c" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M294 28H250V56H294L282 42Z" fill="#dcc89c" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M38 46L50 56V44ZM262 46L250 56V44Z" fill="#b89f70" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M38 18Q150 2 262 18V46Q150 30 38 46Z" fill="#f6eed8" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M46 22Q150 7 254 22M46 42Q150 27 254 42" fill="none" stroke="${INK}" stroke-width=".6"/>
    <path id="${id}" d="M44 37Q150 21 256 37" fill="none"/>
    <text font-family="'IM Fell English SC', serif" font-size="${size}" letter-spacing="1" fill="${INK}"><textPath href="#${id}" startOffset="50%" text-anchor="middle"${fit}>${esc(title)}</textPath></text>
  </svg>`;
}
