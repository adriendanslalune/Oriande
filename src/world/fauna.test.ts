import { describe, expect, it } from 'vitest';
import { FAUNA_CELL, SPECIES, animalsOf, habitat, herd, herdsNear } from './fauna';
import { altitude } from './terrain';
import { CIRCUMFERENCE, EQUATOR_Y } from './planet';
import { nearWater } from './rivers';
import { startPosition } from '../game/travel';
import { worldTime } from './weather';
import { setLang, t } from '../i18n';

const AROUND = CIRCUMFERENCE / FAUNA_CELL;
const { x: sx, y: sy } = startPosition();
const sample = () => herdsNear(sx - 6000, sy - 6000, sx + 6000, sy + 6000, 0);

describe('fauna', () => {
  it('is deterministic and wraps around the planet', () => {
    const ci = Math.floor(sx / FAUNA_CELL), cj = Math.floor(sy / FAUNA_CELL);
    for (let k = 0; k < 200; k++) {
      const a = herd(ci + k, cj), b = herd(ci + k + AROUND, cj);
      expect(a?.species.id).toEqual(b?.species.id);
      expect(a?.count).toEqual(b?.count);
      if (a && b) expect(b.x - a.x).toBeCloseTo(CIRCUMFERENCE, 3);
    }
  });

  it('lives around the start, small animals more numerous than large ones', () => {
    const hs = sample();
    expect(hs.length).toBeGreaterThan(300);
    const n = { small: 0, medium: 0, large: 0 };
    for (const h of hs) n[h.species.size] += h.count;
    expect(n.small).toBeGreaterThan(n.medium);
    expect(n.medium).toBeGreaterThan(n.large);
    expect(n.small).toBeGreaterThan(n.large * 3);
  });

  it('every herd lives in one of its habitats, land animals on land', () => {
    for (const h of sample()) {
      expect(h.species.biomes).toContain(habitat(h.x, h.y));
      const land = !h.species.biomes.includes('sea') && h.species.look.kind !== 'seal' && h.species.id !== 'penguin';
      const t0 = worldTime();
      for (let k = 0; k < 6; k++) for (const a of animalsOf(h, t0 + k * 997)) {
        if (land) expect(altitude(a.x, a.y)).toBeGreaterThan(-0.08);
        else expect(altitude(a.x, a.y)).toBeLessThan(0.35);
        expect(Math.hypot(a.x - h.x, a.y - h.y)).toBeLessThan(h.range * 1.3 + 75); // the herd strings out around its leader
      }
    }
  });

  it('crocodiles and hippos live by the water', () => {
    let n = 0;
    for (const h of herdsNear(sx - 8000, EQUATOR_Y - 6000, sx + 8000, EQUATOR_Y + 6000, 0)) {
      if (!h.species.water) continue;
      n++;
      expect(altitude(h.x, h.y) < 0.12 || nearWater(h.x, h.y, 40)).toBe(true);
    }
    expect(n).toBeGreaterThan(0);
  });

  it('they move: walking at most at their own pace', () => {
    const h = sample().find((x) => x.count > 1)!;
    const t0 = worldTime(), a = animalsOf(h, t0), b = animalsOf(h, t0 + 1);
    for (let k = 0; k < a.length; k++) expect(Math.hypot(b[k].x - a[k].x, b[k].y - a[k].y)).toBeLessThan(h.species.speed * 3);
    let moved = 0;
    for (let s = 0; s < 40; s++) moved += Math.hypot(animalsOf(h, t0 + s * 30)[0].x - h.x, 0);
    expect(moved).toBeGreaterThan(0);
  });

  it('the night has its own creatures: bats and owls come out, day animals sleep', () => {
    const night = herdsNear(sx - 6000, sy - 6000, sx + 6000, sy + 6000, 0, true);
    const ids = new Set(night.map((h) => h.species.id));
    expect(ids.has('bat')).toBe(true);
    for (const h of night) expect(h.species.night).toBeGreaterThan(0);
    for (const h of sample()) expect(h.species.weight).toBeGreaterThan(0);
    expect(sample().some((h) => h.species.id === 'bat')).toBe(false);
    const bats = night.find((h) => h.species.id === 'bat')!;
    for (const a of animalsOf(bats, worldTime())) expect(a.alt).toBeGreaterThan(0);
  });

  it('every species has a name in both languages', () => {
    for (const lang of ['fr', 'en'] as const) {
      setLang(lang);
      for (const s of SPECIES) expect(t(`animal.${s.id}`)).not.toBe(`animal.${s.id}`);
    }
    setLang('fr');
  });
});
