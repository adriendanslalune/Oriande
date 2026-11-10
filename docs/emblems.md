# Enseignes des lieux et silhouettes des bourgs — à faire avec ChatGPT

## Enseignes des lieux

Chaque lieu d'un bourg a son **panneau d'enseigne** (demande d'Adrien : d'une seule encre comme la silhouette
du bourg, orné, sans potence ni chaînes) : le symbole du lieu en bas, et un **grand vide** au milieu où le jeu
écrit le nom dans la langue du joueur. Fichiers : `src/assets/signs/<clé>.webp` (PNG transparent reçu,
recadré). Si une image change, remesurer son vide (`BLANK` dans `ui/townSigns.ts`).

```
I am making shop signboards for an adventure game set in 1873. The game's look is dark-brown ink
on cream paper, like a 19th-century shop-sign engraving printed in one colour.
Every picture shows the same thing, landscape format 3:2:
- ONLY the signboard, seen straight from the front, filling the picture: no bracket, no chains,
  no pole, no wall;
- an ornate Victorian cartouche board: notched corners, a double border with a fine inner line,
  small decorative scrolls and curls at the four corners, a carved crest or pediment of
  wrought-iron-like scrollwork on top, a smaller matching flourish under the bottom edge;
- a few light wood-grain strokes along the board's edges only;
- the centre of the board is completely EMPTY and flat, a wide blank space left for lettering
  (about the middle half of the board's height, no ornament there);
- under that empty space, a small symbol of the shop in solid ink, flanked by two short
  flourished lines;
- ONE colour only: dark brown ink (#2b2117), crisp outlines and solid flat fills, like a
  woodcut stamp or a vector illustration; no gradient, no grey, no shading, no 3D;
- plain pure white background;
- absolutely no text, no letters, no numbers anywhere.
Keep exactly the same style and level of detail from one picture to the next.
Reply "ready" and wait for the subjects.
```

| clé | Sujet |
|---|---|
| `inn-village` | rustic version: a slightly irregular board with simpler scrolls and a few nail heads; symbol: a small bed |
| `inn-city` | elegant version: rich symmetrical scrollwork and a tall crest; symbol: a small bed |
| `shop-village` | rustic version: a slightly irregular board with simpler scrolls and a few nail heads; symbol: a small balance scale |
| `shop-city` | elegant version: rich symmetrical scrollwork and a tall crest; symbol: a small balance scale |
| `smith` | sturdy version: square corners with iron studs and heavy scrolls; symbol: a small anvil with a hammer |
| `tavern` | a board with a rope-twist border and scrolls; symbol: a small beer tankard |

## Silhouettes des bourgs

En tête de la place : la silhouette du bourg, **d'un seul trait**, sans aucun détail (demande d'Adrien :
discret, ça laisse place à l'imagination). Plusieurs versions par type, chaque bourg en prend une
(toujours la même) : `src/assets/skylines/village-1.webp`, `village-2.webp`... et `city-1.webp`...
En attendant, une silhouette codée. Fond blanc pur, il disparaît dans la page.

Nouvelle conversation, ce bloc d'abord :

```
I am making very discreet title vignettes for an adventure game set in 1873.
Style for EVERY picture:
- a very wide, flat panoramic strip (about 4 times wider than tall);
- the outline of a small town seen from afar, drawn as ONE single continuous thin ink line, like
  a pen that never leaves the paper: the ground line and, rising from it, the outline of roofs,
  chimneys, trees and towers;
- no detail inside the shapes: no windows, no doors, no hatching, no shading, no colour;
- brown-black ink on plain pure white background, lots of empty white space above;
- no text, no frame, no signature.
Keep exactly the same line from one picture to the next.
Reply "ready" and wait for the subjects.
```

| clé | Sujet à demander (anglais) |
|---|---|
| `village-1` | a small poor village: a few low cottages with chimneys, a little chapel with a bell tower, two trees |
| `village-2` | a hamlet: a farm, a barn, a few cottages, a windmill, a large tree |
| `village-3` | a village on a gentle slope: cottages, a church steeple, a few trees, a well |
| `city-1` | a walled town: ramparts with battlements, round towers, tall houses, a cathedral spire |
| `city-2` | a prosperous town: tall houses with chimneys, a clock tower with a dome, two steeples |
| `city-3` | a harbour town: houses, a church tower, a lighthouse, the masts of a few ships |

## En-têtes de la besace et du codex

En haut de la besace et du codex : un dessin **d'un seul trait**, comme les silhouettes des bourgs, puis le
titre sur la banderole (demande d'Adrien). Fichiers : `src/assets/headers/besace.webp`, `codex.webp` ; en
attendant, un dessin codé. Même conversation que les silhouettes (même bloc de style), puis :

| clé | Sujet à demander (anglais) |
|---|---|
| `besace` | an explorer's kit laid on the ground, seen from the side: a walking staff planted upright, a leather satchel with its flap and strap, a rolled blanket, a coil of rope, a small lantern, a tin cup, a little tent at the end |
| `codex` | a naturalist's work table seen from the side, its top as the ground line: a candle, an open book, a mortar with its pestle, a bunch of herbs in a jar, a few flint stones, a pocket compass |
