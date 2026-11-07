// The port must produce exactly the proto's world: same seed, same terrain, same names.
import { beforeAll, describe, expect, it } from 'vitest';
import { loadProto, type ProtoWorld } from './proto';
import { hash2 } from './noise';
import { altitude, humidity, strangeness } from './terrain';
import { properName } from './names';
import { settlement } from './settlements';
import { neighbours, roadsAround } from './roads';
import { landmark } from './landmarks';
import { startPosition } from '../game/travel';
import { setLang, t } from '../i18n';

let proto: ProtoWorld;
beforeAll(() => {
  proto = loadProto();
  setLang('fr');
});

/** Deterministic sample points, near the origin and far away, integer and fractional. */
function samples(n: number): [number, number][] {
  const out: [number, number][] = [[0, 0], [1, 1], [-1, -1], [255.5, -0.25], [1e5, -7.3e4], [-123456.78, 98765.4]];
  for (let k = 0; out.length < n; k++) {
    const r = 10 ** (1 + Math.floor(hash2(k, 1) * 5));
    out.push([(hash2(k, 2) - 0.5) * r, (hash2(k, 3) - 0.5) * r]);
  }
  return out;
}

describe('world parity with proto/index.html', () => {
  it('altitude, humidity and strangeness are identical', () => {
    for (const [x, y] of samples(400)) {
      expect(altitude(x, y)).toBe(proto.altitude(x, y));
      expect(humidity(x, y)).toBe(proto.humidite(x, y));
      expect(strangeness(x, y)).toBe(proto.etrangete(x, y));
    }
  });

  it('pins a few altitudes (guards against the proto itself changing)', () => {
    expect(altitude(0, 0)).toBeCloseTo(proto.altitude(0, 0), 15);
    expect(altitude(0, 0)).toMatchInlineSnapshot(`0.6850293744260109`);
    expect(altitude(1000, -2000)).toMatchInlineSnapshot(`0.6259393363596273`);
  });

  it('proper names are identical', () => {
    for (let i = -30; i <= 30; i += 3) for (let j = -30; j <= 30; j += 7) expect(properName(i, j)).toBe(proto.nomPropre(i, j));
  });

  it('settlements (towns) are identical: position, size and name', () => {
    let count = 0;
    for (let tj = -25; tj <= 25; tj++) for (let ti = -25; ti <= 25; ti++) {
      const a = settlement(ti, tj), b = proto.bourg(ti, tj);
      if (!b) { expect(a).toBeNull(); continue; }
      count++;
      expect(a).not.toBeNull();
      expect([a!.x, a!.y, a!.city, a!.name, a!.key]).toEqual([b.x, b.y, b.ville, b.nom, b.cle]);
    }
    expect(count).toBeGreaterThan(50);
  });

  it('names a few towns near the origin', () => {
    const names = [];
    for (let ti = -4; ti <= 4; ti++) { const b = settlement(ti, 0); if (b) names.push(b.name); }
    expect(names).toMatchInlineSnapshot(`
      [
        "Kerthaul",
        "Phamaré",
        "Lunthama",
        "Quilzan",
      ]
    `);
  });

  it('roads are identical', () => {
    for (let tj = -10; tj <= 10; tj += 2) for (let ti = -10; ti <= 10; ti += 2) {
      const a = settlement(ti, tj), b = proto.bourg(ti, tj);
      if (a && b) expect(neighbours(a).map((n) => n.key)).toEqual(proto.voisins(b).map((n) => n.cle));
    }
    const ours = roadsAround(3, -2, 5).map((r) => [r.p.key, r.q.key, r.c.x, r.c.y]);
    const theirs = proto.routesAutour(3, -2, 5).map(([p, q, c]) => [p.cle, q.cle, c.x, c.y]);
    expect(ours).toEqual(theirs);
  });

  it('landmarks are identical, French names and texts included', () => {
    let count = 0;
    for (let tj = -8; tj <= 8; tj++) for (let ti = -8; ti <= 8; ti++) {
      proto.tuile(ti, tj);
      const theirs = proto.lieux.get(ti + ',' + tj), ours = landmark(ti, tj);
      if (!theirs) { expect(ours).toBeNull(); continue; }
      count++;
      expect(ours).not.toBeNull();
      expect([ours!.kind, ours!.x, ours!.y, ours!.water]).toEqual([theirs.k, theirs.x, theirs.y, theirs.sur === 'eau']);
      expect(t(`landmark.${ours!.kind}.name`, { n: ours!.name })).toBe(theirs.nom);
      expect(t(`landmark.${ours!.kind}.text`)).toBe(theirs.txt);
    }
    expect(count).toBeGreaterThan(60);
  }, 60_000);

  it('the explorer starts at the same place', () => {
    expect(startPosition()).toEqual(proto.depart);
  });
});

describe('tile animation points parity', () => {
  it('waves and trees match the proto', async () => {
    const { drawTile } = await import('../render/tiles');
    const fake = () => ({ width: 0, height: 0, getContext: () => new Proxy({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) } as Record<string | symbol, unknown>, { get: (t, p) => (p in t ? t[p] : () => undefined), set: (t, p, v) => { t[p] = v; return true; } }) }) as unknown as HTMLCanvasElement;
    for (const [ti, tj] of [[0, 0], [-3, 2], [5, -7], [12, 12]]) {
      const ours = drawTile(ti, tj, fake), theirs = proto.tuile(ti, tj);
      expect(ours.waves).toEqual(theirs.vagues);
      expect(ours.trees).toEqual(theirs.arbres);
    }
  }, 30_000);
});
