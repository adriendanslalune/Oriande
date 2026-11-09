# Silhouettes des bourgs et emblèmes des lieux — à faire avec ChatGPT

Chaque lieu d'un bourg a un gros emblème au-dessus de son nom en banderole (demande d'Adrien : pas
d'illustration de scène, un symbole). En attendant, un petit dessin codé tient la place. Dès qu'un
fichier est déposé dans `src/assets/emblems/<clé>.webp`, il le remplace. Son fond blanc disparaît
dans le papier de la page (fusion « multiply »), pas besoin de le détourer.

Une conversation, le bloc de style d'abord, puis les sujets un par un.

## Bloc de style (à coller en premier)

```
I am making emblems for an adventure game set in 1873, like the small engraved vignettes in
Jules Verne's original illustrated editions.
Style for EVERY picture:
- one object alone, centred, seen slightly from the side, filling most of a square picture;
- brown-black ink line, like a pen drawing for an engraving, fine hatching only in the shadows;
- at most a very light sepia wash; no other colour;
- plain pure white background, no ground, no cast shadow, no frame, no text;
- no 3D, no photorealism, no cartoon, no icon look.
Keep exactly the same line and tone from one picture to the next.
Reply "ready" and wait for the subjects.
```

## Les emblèmes (carré)

| clé | Lieu | Sujet à demander (anglais) |
|---|---|---|
| `inn` | auberge, hôtel | an old wooden bed with a plump pillow and a folded blanket |
| `shop` | marchand, boutique | a merchant's brass balance scale with two hanging pans |
| `smith` | forge | a blacksmith's anvil with a heavy hammer resting on it |
| `tavern` | taverne | a wooden beer tankard with foam spilling over the rim |

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
