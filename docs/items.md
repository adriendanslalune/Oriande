# Objets d'Oriande — illustrations à faire avec ChatGPT

Chaque objet du sac et de l'almanach a une **case** qui attend son illustration. Tant qu'une image
manque, le jeu affiche un « ? ». Dès qu'un fichier est déposé dans
`src/assets/items/<id>.webp`, il remplace le pictogramme, sans autre changement.

Même méthode que pour les merveilles (voir `illustrations.md`) : une seule conversation pour tous les
objets, le bloc de style d'abord, une planche d'essai de 4 objets, puis « same style as before ».

## Bloc de style (à coller en premier)

```
I am making illustrations of objects for an adventure game set in 1873, in the spirit of the engravings in
Jules Verne's original illustrated editions, but much simpler.
Style for EVERY picture:
- brown-black ink line on warm cream paper, like a pen drawing for an engraving;
- few elements, a clear simple composition, lots of empty paper;
- fine hatching only in the shadows, no dense cross-hatching;
- at most a very light sepia wash; no other colour;
- calm, no crowds, no text, no frame, no signature;
- no 3D, no photorealism, no comic-book look.
Keep exactly the same line and tone from one picture to the next.
Reply "ready" and wait for the subjects.
```

Style choisi par Adrien : **gravure à la Jules Verne, sépia, dépouillée**, dans l'esprit de la carte. Pour un objet seul : « one object alone, centred, on plain cream paper ».


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
| `bottes` | Bottes de cuir | a pair of rough leather boots laced with fibre |
| `coutelas` | Coutelas | a short heavy cutlass with a brass guard |
| `sabre` | Sabre | an officer's curved sabre in its scabbard |
| `feu` | Feu de camp | a small campfire in a ring of stones, with flames |

Ajouter un objet au jeu = ajouter une ligne ici.
