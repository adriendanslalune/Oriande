import Phaser from 'phaser';
import { FONT_BODY, FONT_CAPS, FONT_TITLE } from '../ui/theme';

/** Waits for the web fonts so the first Phaser texts are not drawn in a fallback face. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    const faces = [
      `40px ${FONT_TITLE}`,
      `40px ${FONT_BODY}`,
      `italic 40px ${FONT_BODY}`,
      `40px ${FONT_CAPS}`,
      `700 40px ${FONT_CAPS}`,
    ];
    const timeout = new Promise((resolve) => setTimeout(resolve, 3000));
    Promise.race([Promise.all(faces.map((f) => document.fonts.load(f))), timeout])
      .catch(() => undefined)
      .then(() => this.scene.start('Map'));
  }
}
