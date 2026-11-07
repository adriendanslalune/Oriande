import Phaser from 'phaser';
import { registerSW } from 'virtual:pwa-register';

import '@fontsource/im-fell-english/400.css';
import '@fontsource/im-fell-english/400-italic.css';
import '@fontsource/im-fell-english-sc/400.css';
import '@fontsource/old-standard-tt/400.css';
import '@fontsource/old-standard-tt/700.css';
import '@fontsource/old-standard-tt/400-italic.css';

import { BootScene } from './scenes/Boot';
import { MapScene } from './scenes/Map';
import { PAPER } from './ui/theme';
import { getLang, setLang } from './i18n';
import { DPR } from './ui/screen';

setLang(getLang());

// The canvas is rendered at device-pixel resolution and shown at CSS size (zoom = 1/DPR),
// so ink lines and text stay crisp on phone screens.
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: PAPER,
  width: window.innerWidth * DPR,
  height: window.innerHeight * DPR,
  zoom: 1 / DPR,
  scale: { mode: Phaser.Scale.NONE },
  render: { antialias: true, roundPixels: false },
  input: { activePointers: 3 },
  scene: [BootScene, MapScene],
});

window.addEventListener('resize', () => {
  game.scale.resize(window.innerWidth * DPR, window.innerHeight * DPR);
  game.scale.setZoom(1 / DPR);
});

registerSW({ immediate: true });
