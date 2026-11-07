// Test helper: runs the world code of proto/index.html, untouched, so the port can be
// compared against the original. Node only (reads the file); never imported by the game.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export interface ProtoWorld {
  altitude(x: number, y: number): number;
  humidite(x: number, y: number): number;
  etrangete(x: number, y: number): number;
  nomPropre(i: number, j: number): string;
  bourg(ti: number, tj: number): { x: number; y: number; ville: boolean; nom: string; cle: string } | null;
  voisins(b: unknown): { cle: string }[];
  routesAutour(ti: number, tj: number, R: number): [{ cle: string }, { cle: string }, { x: number; y: number }][];
  /** draws a tile on a fake canvas; returns the tile canvas with its animation points */
  tuile(ti: number, tj: number): { vagues: number[][]; arbres: number[][] };
  lieux: Map<string, { k: string; x: number; y: number; nom: string; txt: string; sur: string }>;
  depart: { x: number; y: number };
}

/** A 2D context that accepts every call and draws nothing. */
function fakeContext(): unknown {
  const target: Record<string | symbol, unknown> = {
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
  };
  return new Proxy(target, {
    get: (t, p) => (p in t ? t[p] : () => undefined),
    set: (t, p, v) => { t[p] = v; return true; },
  });
}

export function loadProto(): ProtoWorld {
  const html = readFileSync(fileURLToPath(new URL('../../proto/index.html', import.meta.url)), 'utf8');
  const start = html.indexOf('const GRAINE');
  const end = html.indexOf('// ============ L’exploration');
  const startPos = html.match(/let depart = null;[\s\S]*?(?=E\.trace = )/);
  if (start < 0 || end < 0 || !startPos) throw new Error('proto layout changed');
  const body = html.slice(start, end) +
    '\nconst E = { x: 0, y: 0 };\n' + startPos[0] +
    '\nreturn { altitude, humidite, etrangete, nomPropre, bourg, voisins, routesAutour, tuile, lieux, depart: { x: E.x, y: E.y } };';
  const document = { createElement: () => ({ width: 0, height: 0, getContext: fakeContext }) };
  return new Function('document', body)(document) as ProtoWorld;
}
