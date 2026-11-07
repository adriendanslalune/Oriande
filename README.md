# Oriande

2D top-down adventure on an endless old map, in search of Oriande, the lost Great City.
Phaser 3 + TypeScript + Vite, installable PWA, deployed on GitHub Pages.

Play: https://adriendanslalune.github.io/Oriande/

```sh
npm install
npm run dev      # local dev server
npm test         # vitest (world/ and game/ logic)
npm run build    # type-check + production build in dist/
npm run icons    # re-render PWA icons from public/icons/icon.svg
```

`proto/index.html` is the original vanilla-canvas prototype, kept read-only as the
reference for the world generation port. See `CLAUDE.md` for the project brief.
