import { describe, expect, it } from 'vitest';
import { DJAAZ, newGame, startJourney } from './travel';

describe('the Djaaz Bot', () => {
  it('walks five times as fast', () => {
    const a = newGame(), b = newGame();
    b.items.djaaz = 1; b.equip.feet = 'djaaz';
    expect(startJourney(a, a.x + 60, a.y)).toBe(true);
    expect(startJourney(b, b.x + 60, b.y)).toBe(true);
    expect(a.journey!.duration / b.journey!.duration).toBeCloseTo(DJAAZ, 5);
  });
});
