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
import { BattleScene } from './scenes/Battle';
import { getLang, setLang } from './i18n';
import { DPR } from './ui/screen';

setLang(getLang());

// The canvas is rendered at device-pixel resolution and shown at CSS size (zoom = 1/DPR),
// so ink lines and text stay crisp on phone screens.
const game = new Phaser.Game({
  // WebGL: the GPU lays down the tiles and draws the overlay (render/glPainter.ts), so big
  // screens and slower browsers stay fluid. Without WebGL (or with ?renderer=canvas), the
  // canvas renderer and the same drawing code on a 2D overlay.
  type: /[?&]renderer=canvas\b/.test(location.search) ? Phaser.CANVAS : Phaser.AUTO,
  parent: 'game',
  transparent: true, // the page's paper grain shows through (index.html)
  width: window.innerWidth * DPR,
  height: window.innerHeight * DPR,
  zoom: 1 / DPR,
  scale: { mode: Phaser.Scale.NONE },
  // pixelArt must be explicit: Phaser turns it on whenever zoom !== 1, which would make the
  // canvas `image-rendering: pixelated` and draw scaled tiles without smoothing.
  render: { antialias: true, pixelArt: false, roundPixels: false },
  input: { activePointers: 3 },
  scene: [BootScene, MapScene, BattleScene],
});

window.addEventListener('resize', () => {
  game.scale.resize(window.innerWidth * DPR, window.innerHeight * DPR);
  game.scale.setZoom(1 / DPR);
});

registerSW({ immediate: true });
