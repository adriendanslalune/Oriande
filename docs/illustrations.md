# Illustrations d'Oriande — prompts pour ChatGPT

Document de travail pour Adrien et Doudou. Les prompts sont en anglais (ChatGPT y est plus
fiable pour l'image) ; les explications sont en français.

## Ce qu'on illustre, et ce qu'on n'illustre pas

| Quoi | Illustration ? | Pourquoi |
|---|---|---|
| **Merveilles** (6) | **Oui**, en priorité | Rares et grandes à l'écran : c'est là qu'une belle image se voit et fait « waouh ». |
| **Lieux étranges** (8) | Oui | Pictogrammes moyens, une image par type suffit. |
| **Fiches** (merveilles, découvertes) | Oui | Grandes images plein cadre : c'est le meilleur endroit pour le mélange Moebius / Verne. |
| **Pages de ville** (étape 5) | Oui | Une vignette de village et une de ville pour la page d'atlas. |
| Villages et villes **sur la carte** | **Non** | Ils sont dessinés par le code le long de *leurs* routes, avec *leurs* champs : il y en a des centaines, tous différents. Une image fixe serait la même partout, mal orientée, et ferait bon marché. |
| Arbres, maisons, montagnes, vagues | Non | Trop petits (quelques pixels) et trop nombreux. |

## Pourquoi on ne nomme pas Moebius dans les prompts

On décrit son style au lieu de citer son nom :
- ChatGPT refuse parfois, ou édulcore, les demandes « à la manière de » d'un artiste précis ;
- décrire les traits (ligne claire, aplats doux, grands espaces calmes) donne des résultats
  **plus réguliers** d'une image à l'autre ;
- c'est plus correct envers l'artiste, et ça évite qu'un jeu public ait l'air d'un pastiche.

Vous pouvez essayer d'ajouter « in the spirit of Moebius », mais sans garantie.

## Méthode (important pour que tout se ressemble)

1. **Une seule conversation ChatGPT par famille** (pictogrammes de carte d'un côté, fiches de
   l'autre). Collez d'abord le **bloc de style**, puis les sujets un par un, en disant « same
   style as before ».
2. Commencez par une **planche d'essai** : 4 pictogrammes sur une même image. Quand elle vous
   plaît, gardez-la et dites « match this sheet exactly » pour la suite.
3. **Vérifiez la transparence** : ChatGPT dessine parfois un faux damier gris et blanc au lieu
   d'un vrai fond transparent. Ouvrez l'image sur un fond coloré pour vérifier.
4. Livrez des **PNG carrés 1024 × 1024**, sujet centré, aux noms de fichiers indiqués : je
   les branche dans le jeu, avec repli sur les dessins actuels tant qu'une image manque.

---

## A. Pictogrammes de carte (fond transparent)

### Bloc de style — à coller en premier

```
STYLE FOR ALL IMAGES IN THIS CONVERSATION:
A single pictogram for an antique explorer's map of an imaginary 1873 world. Blend two
styles: 19th-century etched book engravings from Jules Verne's "Extraordinary Voyages"
(Hetzel editions: fine cross-hatching, delicate etched sepia ink lines) and French 1970s-80s
"ligne claire" science-fantasy comics (clean, confident, even ink outlines, flat soft colour
areas, a calm sense of vastness and wonder). Colours: light watercolour washes in a muted
palette — ivory, sepia-brown ink, pale ochre, sage green, dusty rose, faded sky blue — never
saturated, never glossy. Light comes from the upper left; shadows fall to the lower right.
Viewpoint: high three-quarter bird's-eye view, like a pictogram drawn on an old map.
One subject only, centred, filling about 80% of the frame, standing on a small patch of
ground (or water) that fades out at the edges.
Transparent background (real PNG alpha channel). No paper texture, no frame, no border,
no text, no lettering, no signature, no drop shadow outside the subject.
Square, 1024 x 1024.
```

### Merveilles — ✅ reçues et branchées dans le jeu (`src/assets/wonders/`)

**wonder-tete.png — Tête colossale**
```
Subject: a colossal stone head the size of a hill, half sunk into the ground up to its
lips, eyes peacefully closed, ancient and serene, facing left. Moss and grass on its brow
and cheeks, long cracks, a few birds circling. Carved by a vanished civilisation.
```

**wonder-rocher.png — Rocher suspendu**
```
Subject: a huge block of rock floating in mid-air above a valley, shaped like an
upside-down cone, with no chains and no pillars. On its flat grassy top stands a small
ruined temple with columns. A thin waterfall pours from its edge and dissolves into mist
before reaching the ground. Its round shadow lies on the ground below. A few pebbles
drift around it.
```

**wonder-cristal.png — Forêt de cristal**
```
Subject: a cluster of giant crystal prisms rising from the earth like a forest, taller
than trees, pale blue and soft violet, translucent, hexagonal, catching the light with
thin white highlights. A faint glow around them. Some grass and small rocks at their feet.
```

**wonder-titan.png — Titan pétrifié**
```
Subject: a petrified giant lying on its back across the landscape, turned to grey stone,
one arm raised towards the sky as if holding back something falling. Grass, moss and
small bushes grow on its chest and limbs; cracks run through the stone. Melancholic,
peaceful.
```

**wonder-arches.png — Arches englouties**
```
Subject: the arches of a drowned ancient city rising from calm water: a row of four
stone arcades, one broken, aligned like a street. Under the clear surface, stairs going
down can be guessed. Gentle ripples around the pillars. The base of the image is water,
fading out at the edges.
```

**wonder-arbre.png — Arbre-lumière**
```
Subject: an immense ancient tree whose rounded crown glows softly with golden light by
itself, tiny luminous specks floating around it, gentle rays. Its roots grip the ground.
A few small animals sleep peacefully at its foot. Sacred and quiet.
```

### Lieux étranges — `public/assets/map/landmark-<nom>.png`

**landmark-ruines.png**
```
Subject: ancient ruins of a vanished civilisation: a stepped stone base, three standing
columns with a lintel, one broken column, a fallen column drum on the ground, grass
between the stones.
```

**landmark-squelette.png**
```
Subject: the bleached skeleton of a gigantic sea leviathan stranded on dry land far from
any sea: a long curved spine, huge arched ribs, an elongated skull, half buried in grass.
```

**landmark-champignons.png**
```
Subject: two or three giant mushrooms as tall as church steeples, with pale stems and
dusty-rose spotted caps, a faint cloud of floating spores around them.
```

**landmark-cratere.png**
```
Subject: a round impact crater seen from above at three-quarter view: a raised rocky rim,
a dark bowl with its upper-left inner wall in shadow, scattered debris radiating outwards,
a faint heat shimmer above it.
```

**landmark-tour.png**
```
Subject: a tall, slender stone tower with no door and no window at all, made of fitted
stone courses, topped with a pointed slate roof. Mysterious; at its foot a few gears or a
faint clockwork pattern carved in the stone.
```

**landmark-geyser.png**
```
Subject: a small group of geysers: a pool of rust-tinted water with mineral terraces, one
geyser erupting in a column of white steam that turns into soft round clouds.
```

**landmark-epave.png**
```
Subject: the wreck of a 19th-century paddle steamer lying capsized, keel up, in shallow
water: wooden hull, a broken paddle wheel showing, small waves around it. The base is
water fading out at the edges.
```

**landmark-tourbillon.png**
```
Subject: a maelstrom seen from above: the sea slowly turning on itself in a wide spiral of
waves and foam, darker at its centre. The whole image is water, fading out at the edges.
```

---

## B. Fiches de découverte (grandes images, avec décor)

Ici le mélange Moebius / Verne peut s'exprimer pleinement : de vraies scènes, avec un petit
explorateur pour donner l'échelle.

### Bloc de style — à coller en premier (nouvelle conversation)

```
STYLE FOR ALL IMAGES IN THIS CONVERSATION:
A full illustration for the discovery card of a 1873 exploration game. Blend 19th-century
etched book engravings from Jules Verne's "Extraordinary Voyages" (Hetzel editions: fine
cross-hatching, sepia ink, etched skies) with French 1970s-80s "ligne claire"
science-fantasy comics (clean even outlines, flat soft colours, immense calm landscapes,
tiny human figures facing gigantic wonders, a sense of silence and awe). Muted watercolour
palette: ivory, sepia, pale ochre, sage green, dusty rose, faded sky blue, soft dawn light.
In every image, a small lone explorer seen from behind gives the scale: wide-brimmed brown
hat, long travelling coat, backpack with a rolled blanket, a tall walking staff.
Mood: sacred, ancient, melancholic, like the remains of a lost paradise.
Landscape format 3:2, 1536 x 1024. The edges fade softly into ivory paper.
No text, no lettering, no frame, no signature.
```

**card-tete.png**
```
Scene: at dawn, the explorer stands in tall grass before a colossal stone face sunk into a
hillside up to its lips, eyes closed. Birds nest in the cracks of its brow. The explorer
is no taller than its eyelash.
```

**card-rocher.png**
```
Scene: a valley under a vast sky; above it hangs a floating mountain-block with a small
white temple on top. A waterfall pours from its edge and turns into mist halfway down. The
explorer looks up from a path far below, in the round shadow of the rock.
```

**card-cristal.png**
```
Scene: the explorer walks into a forest of giant pale-blue and violet crystal prisms,
taller than pines. Light refracts in soft rainbows on the ground. The wind seems to make
them sing: faint concentric lines in the air.
```

**card-titan.png**
```
Scene: a grassy plain where a petrified stone giant lies on its back, one arm raised to the
sky. Wildflowers grow on its chest. The explorer sits on its open palm, resting, looking at
the horizon.
```

**card-arches.png**
```
Scene: a calm lake at sunset; a line of ancient stone arches rises from the water, and
under the transparent surface, the streets and stairs of a drowned city go down into the
blue. The explorer stands on the shore, staff in hand.
```

**card-arbre.png**
```
Scene: at night, in a clearing, an immense tree glows with golden light; foxes, deer and
wolves sleep side by side at its roots. The explorer stops at the edge of the light,
hat in hand, as if entering a temple.
```

---

## C. Pages de ville (étape 5)

Même conversation que les fiches (même bloc de style), sans l'explorateur au premier plan.

**town-village.png**
```
Scene: a small village in a patchwork of strip fields: a dozen stone houses with red
roofs and smoking chimneys along a dirt road, a little chapel with a pointed bell-tower,
an inn sign. Peaceful morning, a few villagers.
```

**town-city.png**
```
Scene: a walled city seen from a hill: round stone towers on the ramparts, gates where the
roads enter, packed red roofs, a cathedral spire, a market square full of tiny stalls,
suburbs and fields outside the walls. A steam tram or a balloon in the sky hints at 1873.
```

---

## Récapitulatif des fichiers attendus

```
public/assets/map/wonder-{tete,rocher,cristal,titan,arches,arbre}.png        1024x1024, transparent
public/assets/map/landmark-{ruines,squelette,champignons,cratere,tour,geyser,epave,tourbillon}.png
public/assets/cards/card-{tete,rocher,cristal,titan,arches,arbre}.png       1536x1024
public/assets/towns/town-{village,city}.png                                  1536x1024
```
