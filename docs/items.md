# Objets d'Oriande — illustrations à faire avec ChatGPT

Chaque objet du sac et de l'almanach a une **case** qui attend son illustration. Tant qu'une image
manque, le jeu affiche un petit pictogramme provisoire à l'encre. Dès qu'un fichier est déposé dans
`src/assets/items/<id>.webp`, il remplace le pictogramme, sans autre changement.

Même méthode que pour les merveilles (voir `illustrations.md`) : une seule conversation pour tous les
objets, le bloc de style d'abord, une planche d'essai de 4 objets, puis « same style as before ».

## Bloc de style (à coller en premier)

```
I am making small item icons for an adventure game set in an 1870s world of exploration, in the
spirit of Jules Verne's illustrated editions, with a clean, calm "ligne claire" line.
Style for EVERY icon:
- a single object, centred, seen slightly from above at a three-quarter angle, filling ~80% of the frame;
- fine brown-black ink outline of even weight, a little engraved cross-hatching in the shadows;
- soft, slightly faded watercolour washes (ivory, ochre, sepia, muted greens, muted reds, slate blue);
- no background at all: TRUE transparent background (not a grey and white checkerboard);
- no text, no frame, no drop shadow, no glow, no 3D render, no glossy "mobile game" look;
- square image, 1024 x 1024.
Keep exactly the same line weight, palette and angle from one icon to the next.
```

## Les objets

Nom du fichier = `id.webp` (je convertis les PNG reçus : fond nettoyé, recadrés, 256 px, WebP).

| id | Objet | Sujet à demander (anglais) |
|---|---|---|
| `bois` | Bois | a small bundle of three cut branches tied together |
| `pierre` | Pierres | two or three rough grey stones |
| `fibre` | Fibres | a twisted handful of dry grass fibres, loosely knotted |
| `herbes` | Herbes médicinales | a small bunch of green medicinal herbs with tiny flowers |
| `peau` | Peaux | a folded animal hide, fur on one side |
| `os` | Os | two pale animal bones crossed |
| `baies` | Baies | a little heap of red and dark blue wild berries on a leaf |
| `champignon` | Champignons | two brown forest mushrooms |
| `champignon_grille` | Champignons grillés | two mushrooms grilled on a wooden skewer, slightly charred |
| `viande` | Viande crue | a piece of raw red meat on the bone |
| `viande_cuite` | Viande grillée | a roasted joint of meat on the bone, browned |
| `poisson` | Poisson cru | a fresh silver river fish |
| `poisson_cuit` | Poisson grillé | a fish grilled on a stick, golden brown |
| `biscuit` | Biscuit de mer | two square hard ship's biscuits |
| `remede` | Fiole de remède | a small corked glass vial of green remedy with a paper label |
| `baton` | Bâton | a sturdy walking staff of rough wood |
| `torche` | Torche | a wooden torch wrapped in fibre, burning |
| `canne` | Canne à pêche | a simple wooden fishing rod with a line and a red and white float |
| `hamecon` | Hameçon d'os | a fishing hook carved from bone, with a bit of line |
| `couteau` | Couteau de silex | a flint knife with a knapped blade and a bound wooden handle |
| `hachette` | Hachette | a stone hatchet: a shaped stone head lashed to a wooden haft |
| `pioche` | Pioche | a stone pick lashed to a wooden handle |
| `lance` | Lance de silex | a long wooden spear with a flint point bound with fibre |
| `veste` | Veste de cuir | a rugged leather explorer's jacket, folded |
| `coutelas` | Coutelas | a short heavy cutlass with a brass guard |
| `sabre` | Sabre | an officer's curved sabre in its scabbard |
| `feu` | Feu de camp | a small campfire in a ring of stones, with flames |

Ajouter un objet au jeu = ajouter une ligne ici.
