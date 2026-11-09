# Enseignes des lieux et silhouettes des bourgs — à faire avec ChatGPT

## Enseignes des lieux

Chaque lieu d'un bourg a son **enseigne suspendue** (demande d'Adrien : comme une enseigne de boutique,
pas une banderole) : une potence de fer forgé, une planche de bois qui pend à deux anneaux, le symbole
du lieu gravé dessus, et un **bandeau vide** où le jeu écrit le nom dans la langue du joueur (pas de
texte dans l'image : le jeu est en français et en anglais). Au village l'enseigne est rustique, en ville
plus soignée. Fichiers : `src/assets/signs/<clé>.webp` ; en attendant, un petit emblème sur une banderole.
Le fond blanc disparaît dans la page, pas besoin de détourer. Je règle la place du nom quand je reçois les images.

Une conversation, ce bloc d'abord :

```
I am making hanging shop signs for an adventure game set in 1873, drawn like the engravings in
Jules Verne's original illustrated editions.
Every picture shows the same thing, square format:
- a small wrought-iron bracket at the top left, from which a wooden signboard hangs by two rings;
- the board is shaped like a shield or a cartouche, with a carved border;
- across the UPPER third of the board, an EMPTY smooth band, left blank for lettering;
- below it, the symbol of the shop, carved into the wood;
- brown-black ink line, fine hatching only in the shadows, at most a very light sepia wash,
  no other colour;
- plain pure white background, no wall, no ground, no cast shadow;
- absolutely no text, no letters, no numbers anywhere.
Keep exactly the same line, size and layout from one picture to the next.
Reply "ready" and wait for the subjects.
```

| clé | Lieu | Sujet à demander (anglais) |
|---|---|---|
| `inn-village` | l'auberge du village | a rough, slightly crooked plank, nails and a crack; symbol: a simple bed with a pillow |
| `inn-city` | l'hôtel des voyageurs | a neat carved board with scrolls and a crown-like crest; symbol: a fine bed with a pillow and a blanket |
| `shop-village` | le marchand du village | a rough plank hanging a little askew; symbol: a simple balance scale |
| `shop-city` | la boutique | a neat carved board with scrolls; symbol: a brass balance scale with two pans |
| `smith` | la forge (ville) | a sturdy board with iron studs; symbol: an anvil with a hammer resting on it |
| `tavern` | la taverne (ville) | a carved board with a rope border; symbol: a wooden beer tankard with foam |

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
