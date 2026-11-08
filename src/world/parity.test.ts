// The port must produce exactly the proto's world: same seed, same terrain, same names.
import { beforeAll, describe, expect, it } from 'vitest';
import { loadProto, type ProtoWorld } from './proto';
import { hash2 } from './noise';
import { altitude, humidity, strangeness } from './terrain';
import { properName } from './names';
import { settlement } from './settlements';
import { neighbours, roadsAround, pointOnCurve, passable } from './roads';
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

  it('roads keep the proto shape unless it crosses mountains or water, and never do', () => {
    const protoCurves = new Map(proto.routesAutour(0, 0, 10).map(([p, q, c]) => [p.cle + '|' + q.cle, { p, q, c }]));
    let kept = 0, rerouted = 0;
    for (const r of roadsAround(0, 0, 8)) {
      // every road stays on passable ground
      for (let k = 1; k < r.points.length; k++) {
        const a = r.points[k - 1], b = r.points[k], n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 6);
        for (let m = 0; m <= n; m++) expect(passable(altitude(a.x + (b.x - a.x) * m / n, a.y + (b.y - a.y) * m / n))).toBe(true);
      }
      const pc = protoCurves.get(r.p.key + '|' + r.q.key);
      if (pc && r.points.length === 49) {
        // the proto's own curve, point for point
        kept++;
        for (const k of [0, 12, 24, 36, 48]) {
          const u = k / 48, e = pointOnCurve(pc.p, pc.q, pc.c, u);
          expect([r.points[k].x, r.points[k].y]).toEqual([e.x, e.y]);
        }
      } else rerouted++;
    }
    process.stdout.write(`roads near the start: ${kept} as in the proto, ${rerouted} rerouted or new\n`);
    expect(kept).toBeGreaterThan(rerouted);
  }, 60_000);

  it('links between towns are the proto ones, minus those with no reasonable road', () => {
    for (let tj = -6; tj <= 6; tj += 2) for (let ti = -6; ti <= 6; ti += 2) {
      const a = settlement(ti, tj), b = proto.bourg(ti, tj);
      if (!a || !b) continue;
      const ours = neighbours(a).map((n) => n.key), theirs = proto.voisins(b).map((n) => n.cle);
      // ours may differ only where a proto link was dropped and the next candidate taken
      expect(ours.filter((k) => theirs.includes(k)).length).toBeGreaterThanOrEqual(Math.min(theirs.length, ours.length) - 2);
    }
  }, 60_000);

  it('landmarks kept are identical to the proto ones, French names and texts included', () => {
    let count = 0, kept = 0;
    for (let tj = -8; tj <= 8; tj++) for (let ti = -8; ti <= 8; ti++) {
      proto.tuile(ti, tj);
      const theirs = proto.lieux.get(ti + ',' + tj), ours = landmark(ti, tj);
      if (!theirs) { expect(ours).toBeNull(); continue; }
      count++;
      if (!ours) continue; // rarefied: about three in four of the proto's places are left out
      kept++;
      expect([ours!.kind, ours!.x, ours!.y, ours!.water]).toEqual([theirs.k, theirs.x, theirs.y, theirs.sur === 'eau']);
      expect(t(`landmark.${ours!.kind}.name`, { n: ours!.name })).toBe(theirs.nom);
      expect(t(`landmark.${ours!.kind}.text`)).toBe(theirs.txt);
    }
    expect(count).toBeGreaterThan(60);
    // the share kept is about KEEP
    expect(kept / count).toBeGreaterThan(0.15);
    expect(kept / count).toBeLessThan(0.42);
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
      // waves: the proto's, minus those on frozen seas
      expect(theirs.vagues).toEqual(expect.arrayContaining(ours.waves));
      // trees: the proto's, minus those in the fields now cleared around towns
      expect(theirs.arbres).toEqual(expect.arrayContaining(ours.trees));
    }
  }, 30_000);
});
