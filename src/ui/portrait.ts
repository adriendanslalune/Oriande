// The explorer as drawn in the pack's "Carried" tab, full length, facing us, with what he carries
// and wears (asked by Adrien: the equipment appears on him). Ink line and watercolour, like the map.

const INK = '#2a241d';
const L = `stroke="${INK}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;

/** What the explorer has in hand, in the other hand, and on him (item ids, or null). */
export interface Carried { hand: string | null; off: string | null; body: string | null }

/** The weapon in his hand (drawn on the right of the picture, for clarity). */
function weapon(id: string | null): string {
  const hx = 92, hy = 116;
  switch (id) {
    case 'baton': return `<path stroke="#5a3e26" stroke-width="3.5" stroke-linecap="round" d="M${hx + 2} 44 L${hx - 2} 192"/>`;
    case 'lance': return `<path stroke="#5a3e26" stroke-width="3.5" stroke-linecap="round" d="M${hx + 2} 40 L${hx - 2} 192"/>
      <path ${L} fill="#8d867c" d="M${hx + 2} 22 L${hx + 7} 42 L${hx - 3} 42 Z"/><path ${L} d="M${hx - 2} 44 l8 4 M${hx - 2} 48 l8 4"/>`;
    case 'coutelas': return `<path ${L} fill="#c3c8cc" d="M${hx} ${hy + 6} l6 30 q-4 6 -9 2 l-2 -31 z"/><path stroke="#9a7a30" stroke-width="4" stroke-linecap="round" d="M${hx - 7} ${hy + 6} h15"/>`;
    case 'sabre': return `<path ${L} fill="#c3c8cc" d="M${hx} ${hy + 6} q12 26 2 52 q-4 2 -6 -2 q8 -24 -2 -48 z"/><path stroke="#9a7a30" stroke-width="4" stroke-linecap="round" d="M${hx - 7} ${hy + 6} h15"/>`;
    default: return '';
  }
}

/** The torch in his other hand, burning. */
const torch = (on: boolean): string => on ? `<path stroke="#5a3e26" stroke-width="3.5" stroke-linecap="round" d="M28 120 L18 72"/>
  <path fill="#e8782a" fill-opacity=".9" d="M17 74c-6-4-6-12-2-20 2 5 4 6 5 3 4 6 5 13-3 17z"/><path fill="#ffd66e" d="M17.5 72c-2-2-2-6 0-9 1 3 3 4 3 2 1 3 0 6-3 7z"/>` : '';

/** The explorer, full length, as SVG markup. */
export function portrait(c: Carried, size = 150): string {
  const coat = c.body === 'veste' ? '#7c5230' : '#968056', coatShade = c.body === 'veste' ? '#5e3c22' : '#7a6644';
  const jacket = c.body === 'veste'
    ? `<path ${L} fill="none" stroke-dasharray="2 3" d="M50 84 L46 150 M70 84 L74 150"/><path ${L} fill="${coatShade}" d="M52 70 l8 14 l8 -14"/>` // stitches, the collar
    : '';
  const hand = c.hand ? '' : `<circle ${L} fill="#e6c8a5" cx="92" cy="118" r="5"/>`; // a bare fist
  return `<svg viewBox="0 0 120 200" width="${size}" height="${Math.round(size * 200 / 120)}" aria-hidden="true">
  <ellipse cx="60" cy="193" rx="34" ry="6" fill="${INK}" fill-opacity=".18"/>
  <path ${L} fill="#8a6a46" d="M30 70 h60 v70 h-60 z" opacity=".95"/><ellipse ${L} fill="#c8af82" cx="60" cy="68" rx="32" ry="8"/>
  <path ${L} fill="#4a3c2e" d="M47 150 l-2 36 h11 l2 -36 z M73 150 l2 36 h-11 l-2 -36 z"/>
  <path ${L} fill="${INK}" d="M42 186 h15 v6 h-17 z M78 186 h-15 v6 h17 z"/>
  <path ${L} fill="${coat}" d="M44 76 q16 -8 32 0 l6 80 h-44 z"/>${jacket}
  <path ${L} fill="none" d="M44 112 h32"/>
  <path ${L} fill="${coat}" d="M44 80 q-12 16 -16 40 l6 2 q6 -18 12 -28"/><path ${L} fill="${coat}" d="M76 80 q12 16 16 36 l-6 3 q-6 -16 -12 -26"/>
  <circle ${L} fill="#e6c8a5" cx="31" cy="122" r="5"/>${hand}
  <circle ${L} fill="#e6c8a5" cx="60" cy="56" r="12"/>
  <path ${L} fill="#54402c" d="M34 46 q26 -8 52 0 q-2 5 -26 5 q-24 0 -26 -5 z"/><path ${L} fill="#54402c" d="M46 45 q2 -14 14 -15 q12 1 14 15 z"/>
  <path ${L} fill="none" d="M55 58 h0.1 M65 58 h0.1"/><path ${L} fill="none" stroke-width="1.5" d="M56 63 q4 2 8 0"/>
  ${torch(c.off === 'torche')}${weapon(c.hand)}
</svg>`;
}
