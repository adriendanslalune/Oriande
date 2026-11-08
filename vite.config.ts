/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Relative base: the same build works at a domain root (GitLab Pages unique domain) and
// under a sub-path (<user>.gitlab.io/<project>/). Override with BASE_PATH if needed.
const base = process.env.BASE_PATH ?? './';

export default defineConfig({
  base,
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000, // Phaser alone is ~1.2 MB
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['icons/*.png', 'icons/*.svg'],
      manifest: {
        name: 'Oriande',
        short_name: 'Oriande',
        description: 'Explore an endless old map in search of Oriande, the lost Great City.',
        lang: 'fr',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#ece3cb',
        theme_color: '#ece3cb',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Must be explicit: vite-plugin-pwa only sets these for autoUpdate when it injects the
        // registration itself, and we register in main.ts. Without them a new version installs
        // but waits forever, and players keep the old game.
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,png,svg,webp,woff2,json}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts'],
  },
});
