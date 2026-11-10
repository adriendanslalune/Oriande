// The fabulous lands drawn on the map tiles (see world/realms.ts): each one its own ground colour, its
// own "vegetation" in place of trees and grass (giant mushrooms, crystal shards, slabs of glass...),
// and for some a feature that spans the whole land (the crater's rim, the river that climbs, the
// spiral of standing stones). Same ink line and wash as the rest of the map.
import { hash2 } from '../world/noise';
import { CIRCUMFERENCE, nearestCopy, wrapIndex } from '../world/planet';
import { altitude } from '../world/terrain';
import { realmDepth, type Realm, type RealmKind } from '../world/realms';
import { INK } from './palette';

/** The colour of each land's ground (mixed into the wash with the depth); null keeps the ground as it is. */
const TINT: Record<RealmKind, number[] | null> = {
  mushrooms: [178, 152, 174], crystal: [200, 214, 232], glass: [204, 226, 216], clouds: null, floating: [218, 198, 142],
  stonelake: [178, 178, 170], bones: [228, 214, 184], fireflies: [98, 112, 86], statues: [202, 198, 172], pillars: [92, 122, 74],
  aurora: [160, 196, 222], crater: [168, 150, 128], upriver: null, singing: [242, 212, 148], menhirs: [190, 192, 172],
};

/** The wash colour c at (X, Y) once the fabulous lands around are mixed in. */
export function realmWash(c: number[], realms: Realm[], X: number, Y: number): number[] {
  for (const r of realms) {
    const t = TINT[r.kind];
    if (!t) continue;
    const k = realmDepth(r, X, Y);
    if (k > 0) return c.map((a, i) => a + (t[i] - a) * k * 0.85);
  }
  return c;
}

/** The fabulous land whose ground (X, Y) is on, past its blurred border (a few points stay plain there). */
export function realmHere(realms: Realm[], X: number, Y: number, r: number): Realm | null {
  for (const R of realms) { const k = realmDepth(R, X, Y); if (k > 0 && r < k * 1.2) return R; }
  return null;
}

/** Lands drawn over the mountains (above the clouds; the river that climbs a peak) or on the ice. */
export const OVER_RELIEF: RealmKind[] = ['clouds', 'upriver', 'aurora'];

const line = (g: CanvasRenderingContext2D, w: number): void => { g.lineWidth = w; g.strokeStyle = INK; };

/**
 * One "plant" of a fabulous land at (x, y) in the tile (r: a random draw in [0, 1) for this spot;
 * (cx, cy): the land's centre in the tile, for things that turn towards it).
 */
export function drawRealmPlant(g: CanvasRenderingContext2D, kind: RealmKind, x: number, y: number, r: number, cx: number, cy: number): void {
  switch (kind) {
    case 'mushrooms': { // giant mushrooms: a pale stem, a broad cap with spots, its shadow
      if (r > 0.55) return;
      const R = 3 + r * 7, cap = ['rgba(170,82,74,.92)', 'rgba(150,106,170,.92)', 'rgba(200,140,70,.92)'][Math.floor(r * 30) % 3];
      g.fillStyle = 'rgba(42,36,29,.22)'; g.beginPath(); g.ellipse(x + R * 0.5, y + R * 0.35, R, R * 0.55, 0, 0, 6.3); g.fill();
      g.fillStyle = 'rgb(236,226,204)'; line(g, 0.5); g.beginPath(); g.rect(x - R * 0.18, y - R * 0.2, R * 0.36, R * 0.55); g.fill(); g.stroke();
      g.fillStyle = cap; line(g, 0.6); g.beginPath(); g.ellipse(x, y - R * 0.3, R, R * 0.62, 0, Math.PI, 0); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = 'rgba(250,244,230,.9)';
      for (const [dx, dy] of [[-0.45, -0.55], [0.1, -0.75], [0.5, -0.45]]) { g.beginPath(); g.arc(x + dx * R, y + dy * R * 0.62 - R * 0.05, R * 0.1, 0, 6.3); g.fill(); }
      return;
    }
    case 'crystal': { // shards of crystal standing in clusters, a lit face and a shaded one
      if (r > 0.5) return;
      const n = 2 + Math.floor(r * 6) % 3;
      for (let k = 0; k < n; k++) {
        const h = 4 + ((r * 97 + k * 0.37) % 1) * 7, w = h * 0.28, ox = (k - (n - 1) / 2) * w * 1.3, lean = (k - (n - 1) / 2) * 0.25;
        const tx = x + ox + lean * h, ty = y - h;
        g.fillStyle = 'rgba(206,222,246,.95)'; line(g, 0.5);
        g.beginPath(); g.moveTo(x + ox - w, y); g.lineTo(tx, ty); g.lineTo(x + ox + w, y); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = 'rgba(150,160,214,.8)'; g.beginPath(); g.moveTo(tx, ty); g.lineTo(x + ox + w, y); g.lineTo(x + ox, y); g.closePath(); g.fill();
      }
      return;
    }
    case 'glass': { // slabs of sand turned to glass: flat polygons with a glint
      if (r > 0.6) return;
      const R = 3 + r * 5, a = r * 40;
      g.fillStyle = 'rgba(176,222,214,.75)'; line(g, 0.45); g.beginPath();
      for (let k = 0; k < 5; k++) { const t = a + k * 1.26, q = R * (0.7 + ((r * 13 + k * 0.29) % 1) * 0.5); g.lineTo(x + Math.cos(t) * q, y + Math.sin(t) * q * 0.6); }
      g.closePath(); g.fill(); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(x - R * 0.4, y - R * 0.1); g.lineTo(x + R * 0.1, y - R * 0.35); g.stroke();
      return;
    }
    case 'floating': { // rocks hanging in the air: a crag with grass on top, its shadow far below
      if (r > 0.12) return;
      const R = 6 + r * 60, lift = 8 + r * 70;
      g.fillStyle = 'rgba(42,36,29,.22)'; g.beginPath(); g.ellipse(x, y, R, R * 0.4, 0, 0, 6.3); g.fill();
      const by = y - lift;
      g.fillStyle = 'rgb(176,152,118)'; line(g, 0.6); g.beginPath(); g.moveTo(x - R, by); g.lineTo(x + R, by); g.lineTo(x + R * 0.3, by + R * 0.9); g.lineTo(x - R * 0.15, by + R * 1.3); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = 'rgb(150,172,108)'; g.beginPath(); g.ellipse(x, by, R, R * 0.35, 0, 0, 6.3); g.fill(); g.stroke();
      g.strokeStyle = 'rgba(120,160,190,.7)'; g.lineWidth = 0.6; // a thread of water falling off the edge
      if (r < 0.05) { g.beginPath(); g.moveTo(x + R * 0.7, by + R * 0.2); g.lineTo(x + R * 0.75, y - 1); g.stroke(); }
      return;
    }
    case 'stonelake': { // a lake turned to stone: its waves frozen in grey crests
      if (r > 0.55) return;
      g.strokeStyle = 'rgba(90,90,86,.8)'; g.lineWidth = 0.7; g.beginPath();
      g.moveTo(x - 4, y); g.quadraticCurveTo(x - 2, y - 2.4, x, y); g.quadraticCurveTo(x + 2, y - 2.4, x + 4, y); g.stroke();
      return;
    }
    case 'bones': { // the bones of colossal beasts: ribs arching out of the sand, a skull now and then
      if (r > 0.3) return;
      line(g, 0.6); g.strokeStyle = 'rgb(120,104,84)'; g.fillStyle = 'rgb(240,232,210)';
      if (r < 0.04) { g.beginPath(); g.ellipse(x, y - 2, 5, 3.4, 0, 0, 6.3); g.fill(); g.stroke(); g.fillStyle = INK; g.beginPath(); g.arc(x - 1.8, y - 2.4, 0.9, 0, 6.3); g.arc(x + 1.8, y - 2.4, 0.9, 0, 6.3); g.fill(); return; }
      g.lineWidth = 1.4; g.strokeStyle = 'rgb(236,228,204)';
      const B = 1 + r * 4;
      for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(x + (k * 2.6 - 5) * B, y, (4 + k * 0.3) * B, Math.PI * 1.05, Math.PI * 1.85); g.stroke(); }
      g.lineWidth = 0.4; g.strokeStyle = INK;
      for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(x + (k * 2.6 - 5) * B, y, (4 + k * 0.3) * B + 0.7, Math.PI * 1.05, Math.PI * 1.85); g.stroke(); }
      return;
    }
    case 'fireflies': { // black waters under the trees, a swarm of lights over them
      g.fillStyle = 'rgba(30,40,40,.55)';
      if (r < 0.3) { g.beginPath(); g.ellipse(x, y, 4 + r * 8, 2 + r * 3, 0, 0, 6.3); g.fill(); }
      g.fillStyle = 'rgba(250,230,120,.95)';
      for (let k = 0; k < 3; k++) { const a = r * 50 + k * 2.1; g.beginPath(); g.arc(x + Math.cos(a) * 4, y - 3 + Math.sin(a) * 3, 0.55, 0, 6.3); g.fill(); }
      return;
    }
    case 'statues': { // giants of stone kneeling, all turned towards the same point
      if (r > 0.14) return;
      const a = Math.atan2(cy - y, cx - x), s = 5 + r * 40;
      g.fillStyle = 'rgba(42,36,29,.2)'; g.beginPath(); g.ellipse(x + 2, y + 1, s * 0.9, s * 0.4, 0, 0, 6.3); g.fill();
      g.fillStyle = 'rgb(196,190,176)'; line(g, 0.6);
      g.beginPath(); g.ellipse(x, y - s * 0.6, s * 0.55, s * 0.7, 0, 0, 6.3); g.fill(); g.stroke(); // the bowed back
      g.beginPath(); g.arc(x + Math.cos(a) * s * 0.45, y - s * 0.75 + Math.sin(a) * s * 0.3, s * 0.28, 0, 6.3); g.fill(); g.stroke(); // the head, towards the centre
      return;
    }
    case 'pillars': { // trees a thousand feet high: from above, a vast crown and its long shadow
      if (r > 0.18) return;
      const R = 9 + r * 40;
      g.fillStyle = 'rgba(30,40,25,.28)'; g.beginPath(); g.ellipse(x + R * 0.9, y + R * 0.6, R, R * 0.7, 0, 0, 6.3); g.fill();
      g.fillStyle = 'rgba(70,110,60,.92)'; line(g, 0.7);
      for (const [dx, dy, k] of [[-0.5, 0.2, 0.7], [0.5, 0.15, 0.72], [0, -0.45, 0.8], [0, 0.1, 0.85]]) { g.beginPath(); g.arc(x + dx * R, y + dy * R, R * k, 0, 6.3); g.fill(); g.stroke(); }
      g.lineWidth = 0.5;
      for (let q = 0; q < 3; q++) { g.beginPath(); g.arc(x + R * 0.2, y + R * 0.1, R * (0.3 + q * 0.2), -0.2, 1.6); g.stroke(); }
      return;
    }
    case 'singing': { // dunes that sing: their crests, and the sound rising from them in arcs
      if (r > 0.35) return;
      g.fillStyle = 'rgb(232,196,128)'; line(g, 0.6);
      g.beginPath(); g.moveTo(x - 8, y); g.quadraticCurveTo(x - 1, y - 6, x + 2, y - 5); g.lineTo(x + 2, y); g.closePath(); g.fill(); g.stroke();
      if (r < 0.12) { g.strokeStyle = 'rgba(120,80,50,.7)'; g.lineWidth = 0.5; for (let k = 1; k <= 3; k++) { g.beginPath(); g.arc(x + 2, y - 7, k * 1.8, -2.3, -0.8); g.stroke(); } }
      return;
    }
    case 'menhirs': case 'crater': { // a few loose stones (the stones of the spiral and the crater's rim come with the land)
      if (r > 0.08) return;
      g.fillStyle = 'rgb(160,150,134)'; line(g, 0.5); g.beginPath(); g.ellipse(x, y, 1.6, 1.1, 0, 0, 6.3); g.fill(); g.stroke();
      return;
    }
    case 'aurora': { // clear blue ice, cracked, with shapes caught inside it
      if (r > 0.35) return;
      g.strokeStyle = 'rgba(40,90,140,.6)'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(x - 5, y - 1); g.lineTo(x - 1, y + 1); g.lineTo(x + 3, y - 2); g.lineTo(x + 6, y); g.stroke();
      if (r < 0.04) { g.strokeStyle = 'rgba(30,50,80,.55)'; g.lineWidth = 0.7; g.beginPath(); g.ellipse(x, y + 4, 6, 2.2, 0.3, 0, 6.3); g.stroke(); }
      return;
    }
    case 'clouds': { // a sea of clouds over the peaks
      if (r > 0.7) return;
      const s = 2.2 + r * 1.6;
      g.fillStyle = 'rgba(250,250,246,.97)'; line(g, 0.55);
      for (const [dx, dy, k] of [[-5, 1, 3.6], [-1, -1.5, 4.6], [4, 0, 4], [8, 1.5, 3]]) { g.beginPath(); g.arc(x + dx * s * 0.5, y + dy * s * 0.5, k * s * 0.6, Math.PI, 0); g.fill(); g.stroke(); }
      return;
    }
    case 'upriver': return; // the river is drawn as a whole (see drawRealmFeature)
  }
}

/** Whole-land features: the crater's rim and basin, the river climbing to the summit, the spiral of standing stones. */
export function drawRealmFeature(g: CanvasRenderingContext2D, R: Realm, x0: number, y0: number, T: number): void {
  const cx = nearestCopy(R.x, x0 + T / 2) - x0, cy = R.y - y0, rad = R.radius;
  if (cx + rad < -20 || cx - rad > T + 20 || cy + rad < -20 || cy - rad > T + 20) return;
  if (R.kind === 'crater') {
    const rim = rad * 0.55;
    g.fillStyle = 'rgba(90,72,56,.28)'; g.beginPath(); g.ellipse(cx, cy, rim, rim * 0.8, 0, 0, 6.3); g.fill();
    g.strokeStyle = INK; g.lineWidth = 2.2; g.beginPath(); g.ellipse(cx, cy, rim, rim * 0.8, 0, 0, 6.3); g.stroke();
    g.strokeStyle = 'rgba(42,36,29,.45)'; g.lineWidth = 0.7; // the ejecta, thrown out all round
    for (let k = 0; k < 72; k++) { const a = k * 0.0873 * 1.0, l = rim * (1.05 + hash2(k, 7) * 0.5); g.beginPath(); g.moveTo(cx + Math.cos(a) * rim * 1.04, cy + Math.sin(a) * rim * 0.83); g.lineTo(cx + Math.cos(a) * l, cy + Math.sin(a) * l * 0.8); g.stroke(); }
    // the fallen star at the bottom: a lump of dark metal that catches the light
    g.fillStyle = 'rgb(70,74,88)'; g.lineWidth = 1; g.strokeStyle = INK; g.beginPath(); g.ellipse(cx, cy, 9, 6, 0.3, 0, 6.3); g.fill(); g.stroke();
    g.strokeStyle = 'rgba(230,236,255,.9)'; g.beginPath(); g.moveTo(cx - 4, cy - 2); g.lineTo(cx + 1, cy - 3.5); g.stroke();
  } else if (R.kind === 'menhirs') {
    // three arms of standing stones turning about the centre
    for (let arm = 0; arm < 3; arm++) for (let k = 4; k < 60; k++) {
      const a = arm * 2.094 + k * 0.16, d = k * rad / 62, x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.8;
      if (x < -10 || x > T + 10 || y < -10 || y > T + 10) continue;
      const h = 4 + hash2(arm * 100 + k, 3) * 3;
      g.fillStyle = 'rgba(42,36,29,.2)'; g.beginPath(); g.ellipse(x + 1.5, y + 0.5, 2.2, 1, 0, 0, 6.3); g.fill();
      g.fillStyle = 'rgb(170,166,152)'; g.strokeStyle = INK; g.lineWidth = 0.6; g.beginPath(); g.moveTo(x - 1.3, y); g.lineTo(x - 1, y - h); g.quadraticCurveTo(x, y - h - 1.4, x + 1, y - h); g.lineTo(x + 1.3, y); g.closePath(); g.fill(); g.stroke();
    }
  } else if (R.kind === 'upriver') {
    // a river spiralling up to the summit, against the slope: little chevrons point the way it flows
    const pts: [number, number][] = [];
    for (let k = 0; k <= 240; k++) { const t = k / 240, a = t * 9.4, d = (1 - t) * rad * 0.95; pts.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.8]); }
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = INK; g.lineWidth = 6; g.beginPath(); pts.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
    g.strokeStyle = 'rgb(150,190,206)'; g.lineWidth = 4.2; g.beginPath(); pts.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 0.7;
    for (let k = 6; k < pts.length - 1; k += 8) {
      const [x, y] = pts[k], [nx, ny] = pts[k + 1], a = Math.atan2(ny - y, nx - x);
      g.beginPath(); g.moveTo(x - Math.cos(a - 0.7) * 2, y - Math.sin(a - 0.7) * 2); g.lineTo(x, y); g.lineTo(x - Math.cos(a + 0.7) * 2, y - Math.sin(a + 0.7) * 2); g.stroke();
    }
    g.lineCap = 'round';
  }
}

/** Every plant of the fabulous lands over a tile, on a 10-unit grid (like the vegetation). */
export function drawRealmPlants(g: CanvasRenderingContext2D, realms: Realm[], kinds: (k: RealmKind) => boolean, x0: number, y0: number, T: number, skip: (x: number, y: number) => boolean): void {
  if (!realms.some((r) => kinds(r.kind))) return;
  for (let gy = Math.floor((y0 - 12) / 10); gy * 10 < y0 + T + 12; gy++) for (let gx = Math.floor((x0 - 12) / 10); gx * 10 < x0 + T + 12; gx++) {
    const wg = wrapIndex(gx, CIRCUMFERENCE / 10);
    const X = gx * 10 + 5 + (hash2(wg * 3 + 11, gy) - 0.5) * 7, Y = gy * 10 + 5 + (hash2(wg, gy * 3 - 7) - 0.5) * 7;
    const r = hash2(wg * 7 + 1, gy * 13 + 2), R = realmHere(realms, X, Y, hash2(wg * 5 + 3, gy * 9 + 1));
    if (!R || !kinds(R.kind) || skip(X, Y)) continue;
    const v = altitude(X, Y);
    if (R.kind === 'aurora' ? v > 0 : v < 0.02) continue;
    drawRealmPlant(g, R.kind, X - x0, Y - y0, r, nearestCopy(R.x, X) - x0, R.y - y0);
  }
}
