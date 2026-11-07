import Phaser from 'phaser';
import { t } from '../i18n';
import { FONT_BODY, FONT_CAPS, FONT_TITLE, INK, INK_CSS, INK_SOFT_CSS, PAPER } from '../ui/theme';
import { px } from '../ui/screen';

/**
 * The world map. Phase 1 step 1: an empty sheet of paper with the title cartouche.
 * The ported world rendering arrives in step 2.
 */
export class MapScene extends Phaser.Scene {
  private frame!: Phaser.GameObjects.Graphics;
  private title!: Phaser.GameObjects.Text;
  private subtitle!: Phaser.GameObjects.Text;
  private tagline!: Phaser.GameObjects.Text;
  private year!: Phaser.GameObjects.Text;

  constructor() {
    super('Map');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(PAPER);
    this.frame = this.add.graphics();
    this.title = this.add.text(0, 0, t('title'), { fontFamily: FONT_TITLE, color: INK_CSS }).setOrigin(0.5);
    this.subtitle = this.add.text(0, 0, t('subtitle').toUpperCase(), {
      fontFamily: FONT_CAPS, fontStyle: 'bold', color: INK_CSS,
    }).setOrigin(0.5);
    this.tagline = this.add.text(0, 0, t('tagline'), {
      fontFamily: FONT_BODY, fontStyle: 'italic', color: INK_SOFT_CSS, align: 'center',
    }).setOrigin(0.5);
    this.year = this.add.text(0, 0, t('year'), { fontFamily: FONT_BODY, color: INK_SOFT_CSS }).setOrigin(0.5);

    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this));
  }

  private layout(): void {
    const { width: w, height: h } = this.scale;
    const cx = w / 2;
    const cy = h / 2;
    const m = px(14);

    // Double ink border around the sheet, like the proto's header rule.
    const g = this.frame.clear();
    g.lineStyle(px(1.5), INK, 1).strokeRect(m, m, w - 2 * m, h - 2 * m);
    g.lineStyle(px(0.75), INK, 1).strokeRect(m + px(5), m + px(5), w - 2 * m - px(10), h - 2 * m - px(10));

    // Title cartouche: size the title from the narrow side so it fits a portrait phone.
    const titleSize = Math.min(px(64), w * 0.16);
    this.title.setFontSize(titleSize).setPosition(cx, cy);
    this.subtitle.setFontSize(Math.max(px(12), titleSize * 0.22)).setLetterSpacing(px(1.5))
      .setPosition(cx, cy - titleSize * 0.95);
    this.tagline.setFontSize(Math.max(px(15), titleSize * 0.3)).setWordWrapWidth(w * 0.8)
      .setPosition(cx, cy + titleSize * 0.9);
    this.year.setFontSize(Math.max(px(13), titleSize * 0.24)).setPosition(cx, cy + titleSize * 1.5);

    const cw = Math.min(w - 2 * m - px(30), titleSize * 6);
    const top = cy - titleSize * 1.4;
    const bottom = cy + titleSize * 1.95;
    g.lineStyle(px(1), INK, 1).strokeRect(cx - cw / 2, top, cw, bottom - top);
    g.lineStyle(px(1), INK, 1).strokeRect(cx - cw / 2 - px(4), top - px(4), cw + px(8), bottom - top + px(8));
    // Rules under the subtitle and above the year.
    const r = cw * 0.25;
    g.lineStyle(px(0.75), INK, 1)
      .lineBetween(cx - r, cy - titleSize * 0.65, cx + r, cy - titleSize * 0.65)
      .lineBetween(cx - r * 0.6, cy + titleSize * 1.25, cx + r * 0.6, cy + titleSize * 1.25);
  }
}
