import { describe, expect, it } from 'vitest';
import { CITY, DISHES, RUMORS, VILLAGE, buy, eatDish, flavourOf, goods, regionOf, rumor, sell, sellPrice, sleep, townAt } from './town';
import { newGame } from './travel';
import { weaponOf } from './craft';
import { settlement } from '../world/settlements';
import { TILE } from '../world/terrain';
import { worldTime } from '../world/weather';
import { setLang, t } from '../i18n';
import type { Settlement } from '../world/settlements';

/** The first village and the first city found around the start. */
function towns(): { village: Settlement; city: Settlement } {
  const s = newGame(), ti0 = Math.floor(s.x / TILE), tj0 = Math.floor(s.y / TILE);
  let village: Settlement | null = null, city: Settlement | null = null;
  for (let r = 0; r < 60 && !(village && city); r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
    const b = settlement(ti0 + di, tj0 + dj);
    if (b && b.city && !city) city = b;
    if (b && !b.city && !village) village = b;
  }
  return { village: village!, city: city! };
}

describe('towns', () => {
  const { village, city } = towns();

  it('the explorer is in a town when standing at its heart, not beside it', () => {
    expect(townAt(village.x + 10, village.y)?.key).toBe(village.key);
    expect(townAt(city.x, city.y + 30)?.key).toBe(city.key);
    expect(townAt(village.x + 200, village.y)).toBeNull();
  });

  it('a village is small, a city has everything', () => {
    expect(VILLAGE.sells.length).toBeLessThan(CITY.sells.length);
    expect(VILLAGE.forge).toEqual([]);
    expect(CITY.forge.length).toBeGreaterThan(0);
    expect(VILLAGE.tavern).toBe(false);
    expect(rumor(village, worldTime())).toBeNull();
    expect(RUMORS).toContain(rumor(city, worldTime()));
    expect(sellPrice(city, 'viande')).toBeGreaterThanOrEqual(sellPrice(village, 'viande'));
  });

  it('a night at the inn: paid, life back in full', () => {
    const s = newGame(); s.hp = 5; s.gold = 0;
    expect(sleep(s, village)).toBe(false);
    s.gold = 10;
    expect(sleep(s, village)).toBe(true);
    expect(s.hp).toBe(s.maxHp);
    expect(s.gold).toBe(10 - VILLAGE.inn);
    expect(sleep(s, village)).toBe(false); // not needed
  });

  it('selling what was gathered and hunted, buying what is needed', () => {
    const s = newGame(); s.items = { bois: 3, viande: 1, baton: 1 };
    expect(sell(s, village, 'baton')).toBe(false); // tools are kept
    expect(sell(s, village, 'bois')).toBe(true);
    expect(s.items.bois).toBe(2);
    expect(s.gold).toBe(1);
    expect(buy(s, village, 'remede')).toBe(false); // too poor
    s.gold = 100;
    expect(buy(s, village, 'remede')).toBe(true);
    expect(s.items.remede).toBe(1);
    expect(buy(s, village, 'sabre')).toBe(false); // no smith in a village
    expect(buy(s, city, 'sabre')).toBe(true);
    expect(weaponOf(s).id).toBe('sabre');
    expect(goods(s, city).some((g) => g.id === 'sabre')).toBe(false); // bought once
  });

  it('the tavern serves dishes, paid and eaten at once; a village has none', () => {
    const s = newGame(); s.food = 30; s.hp = 10; s.gold = 10;
    const stew = DISHES.find((d) => d.id === 'ragout')!;
    expect(eatDish(s, village, 'ragout')).toBe(false); // no tavern in a village
    expect(eatDish(s, city, 'ragout')).toBe(true);
    expect(s.gold).toBe(10 - stew.price);
    expect(s.food).toBe(30 + stew.food);
    expect(s.hp).toBe(10 + stew.heal);
    s.gold = 0;
    expect(eatDish(s, city, 'pain')).toBe(false); // too poor
  });

  it('each town has its words of welcome, from the country it stands in', () => {
    for (const b of [village, city]) {
      const f = flavourOf(b);
      expect(f).toBeGreaterThanOrEqual(0); expect(f).toBeLessThan(5);
      for (const lang of ['fr', 'en'] as const) {
        setLang(lang);
        expect(t(`town.flavour.${b.city ? 'city' : 'village'}.${f}`)).not.toContain('town.');
        expect(t('town.region.' + regionOf(b))).not.toContain('town.');
        for (const k of ['inn-village', 'inn-city', 'shop-village', 'shop-city', 'smith', 'tavern']) { expect(t('town.place.' + k)).not.toContain('town.'); expect(t('town.say.' + k)).not.toContain('town.'); expect(t('town.pic.' + k)).not.toContain('town.'); }
        for (const d of DISHES) expect(t('dish.' + d.id)).not.toContain('dish.');
      }
      setLang('fr');
    }
  });

  it('every rumour and every name has its words in both languages', () => {
    for (const lang of ['fr', 'en'] as const) {
      setLang(lang);
      for (const r of RUMORS) expect(t('rumor.' + r)).not.toBe('rumor.' + r);
      for (const id of [...CITY.sells, ...CITY.forge, ...VILLAGE.sells]) expect(t('item.' + id + '.name')).not.toBe('item.' + id + '.name');
      for (const k of ['town.enter', 'town.inn', 'town.shop', 'town.smith', 'town.tavern', 'town.page.city', 'town.page.village']) expect(t(k)).not.toBe(k);
    }
    setLang('fr');
  });
});
