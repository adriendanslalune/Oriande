// The little engraved pictograms of strange places. Verbatim port of the proto's icone().
import type { LandmarkKind } from '../world/landmarks';
import { INK, PAPER } from './palette';

export function drawLandmarkIcon(g: CanvasRenderingContext2D, k: LandmarkKind, x: number, y: number): void {
  g.lineWidth = 1; g.fillStyle = PAPER;
  if (k === 'ruines') {
    for (const dx of [-6, -2, 2, 6]) { const hh = 4 + (dx === 2 ? 2 : 0); g.fillRect(x + dx - 1, y - hh, 2, hh); g.strokeRect(x + dx - 1, y - hh, 2, hh); }
    g.beginPath(); g.moveTo(x - 8, y); g.lineTo(x + 8, y); g.stroke();
  }
  if (k === 'squelette') {
    g.beginPath(); g.moveTo(x - 10, y + 2); g.quadraticCurveTo(x, y - 4, x + 10, y + 1); g.stroke();
    for (let i = -8; i <= 8; i += 3) { g.beginPath(); g.moveTo(x + i, y - 1 + Math.abs(i) * 0.2); g.lineTo(x + i, y - 5 + Math.abs(i) * 0.3); g.stroke(); }
  }
  if (k === 'champignons') {
    for (const [dx, s] of [[-4, 1], [3, 1.4]]) {
      g.beginPath(); g.moveTo(x + dx, y + 2); g.lineTo(x + dx, y - 4 * s); g.stroke();
      g.beginPath(); g.ellipse(x + dx, y - 4 * s, 4 * s, 2.2 * s, 0, Math.PI, 0); g.fill(); g.stroke();
    }
  }
  if (k === 'cratere') {
    g.beginPath(); g.ellipse(x, y, 8, 5, 0, 0, 6.3); g.stroke();
    g.beginPath(); g.ellipse(x, y + 1, 4.5, 2.5, 0, 0, 6.3); g.stroke();
    for (let a = 0; a < 6.3; a += 0.5) { g.beginPath(); g.moveTo(x + 8 * Math.cos(a), y + 5 * Math.sin(a)); g.lineTo(x + 11 * Math.cos(a), y + 7 * Math.sin(a)); g.stroke(); }
  }
  if (k === 'tour') {
    g.beginPath(); g.moveTo(x - 3, y + 2); g.lineTo(x - 2, y - 11); g.lineTo(x + 2, y - 11); g.lineTo(x + 3, y + 2); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(x - 3, y - 11); g.lineTo(x, y - 15); g.lineTo(x + 3, y - 11); g.stroke();
  }
  if (k === 'geyser') {
    for (const dx of [-4, 0, 4]) { g.beginPath(); g.moveTo(x + dx, y + 2); g.quadraticCurveTo(x + dx - 2, y - 4, x + dx + 1, y - 9); g.stroke(); }
    g.beginPath(); g.ellipse(x, y + 2, 7, 2, 0, 0, 6.3); g.stroke();
  }
  if (k === 'epave') {
    g.beginPath(); g.moveTo(x - 8, y); g.quadraticCurveTo(x, y + 6, x + 8, y); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.arc(x - 1, y + 1, 2.5, 0, 6.3); g.stroke();
    g.beginPath(); g.moveTo(x + 4, y); g.lineTo(x + 6, y - 7); g.stroke();
  }
  if (k === 'tourbillon') {
    g.beginPath();
    for (let a = 0; a < 14; a += 0.2) { const rr = a * 0.8; g.lineTo(x + rr * Math.cos(a), y + rr * 0.6 * Math.sin(a)); }
    g.stroke();
  }
  g.beginPath(); g.arc(x, y, 1.2, 0, 6.3); g.fillStyle = INK; g.fill();
}
