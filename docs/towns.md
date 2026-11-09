# Bourgs d'Oriande — illustrations à faire avec ChatGPT

Les pages des villages et des villes ont des **cadres** qui attendent leurs illustrations. Tant qu'une
image manque, le jeu affiche un « ? » sur un ciel et une terre unis. Dès qu'un fichier est déposé dans
`src/assets/towns/<clé>.webp`, il prend sa place, sans autre changement.

Même méthode que pour les objets (`items.md`) : une conversation, le bloc de style d'abord, puis les
sujets un par un.

## Bloc de style (à coller en premier)

```
I am making illustrations for an adventure game: a world of 19th-century explorers, mostly in the
spirit of 1970s-80s French "ligne claire" science-fiction comics, with a touch of Jules Verne's
illustrated editions.
Style for EVERY picture:
- clean, precise ink outlines of even weight, no sketchy lines; very little hatching, only a few fine
  engraved strokes in the deepest shadows;
- large flat areas of luminous, slightly faded colour with soft gradients in the skies: sand, ochre,
  pale turquoise, dusty rose, lilac and violet shadows, warm ivory light;
- vast, open, silent spaces: low horizons, huge skies, a sense of calm wonder and solitude;
- strange, elegant, slightly dreamlike details in the architecture and the land, but believable
  1870s objects (lanterns, brass, canvas, wood, stone);
- calm composition, no crowds, no text, no frame, no signature;
- no 3D render, no photorealism, no glossy "mobile game" look.
Keep exactly the same line, palette and light from one picture to the next.
Reply "ready" and wait for the subjects.
```

Style choisi par Adrien : **surtout Moebius**, une touche de Jules Verne. Pas assez Moebius ? ajouter « in the spirit of Moebius » à la fin du bloc. Trop BD ? répondre « a little more like an old engraving, keep the flat colours ».


## Les illustrations

| clé | Où | Format | Sujet à demander (anglais) |
|---|---|---|---|
| `village` | arrivée dans un village | paysage 3:2 | the central square of a small village, seen from inside it: a stone well in the middle, thatched cottages and a little chapel around, a bench under an old tree, laundry drying, a cart without its horse; quiet late-afternoon light, a big calm sky above the roofs; nobody, or one distant figure |
| `city` | arrivée dans une ville | paysage 3:2 | the main square of a walled town, seen from inside it: cobblestones, a fountain with a weathered statue, tall stone houses with shop signs, a clock tower and steeples, folded market awnings, a gas lamp; calm, a big sky above the roofs; nobody, or one distant figure |
| `inn` | l'auberge | paysage 3:2 | the common room of a country inn: a fireplace with a pot, wooden beams, a staircase to the rooms, a lantern |
| `shop` | le marchand | paysage 3:2 | a merchant's stall in a village street: crates, sacks, hanging sausages, jars, a scale, an awning |
| `smith` | la forge | paysage 3:2 | a blacksmith's forge: glowing hearth, anvil, hammers and blades on the wall, sparks |
| `tavern` | la taverne | paysage 3:2 | the inside of a harbour-town tavern: a long counter, barrels, a ship's lantern, maps pinned on the wall |
| `keeper-inn` | visage de l'aubergiste | carré, portrait en buste | a round, kindly innkeeper with an apron, head and shoulders |
| `keeper-shop` | visage du marchand | carré, portrait en buste | a shrewd travelling merchant with a waistcoat and spectacles, head and shoulders |
| `keeper-smith` | visage du forgeron | carré, portrait en buste | a broad-shouldered blacksmith with a leather apron and soot on the face, head and shoulders |
| `keeper-tavern` | visage du vieux marin | carré, portrait en buste | an old sailor with a white beard, a cap and a pipe, head and shoulders |

Plus tard (pas encore branché) : une vue d'arrivée par climat (`village-desert`, `village-jungle`,
`village-tundra`...), pour que les villages du sud ne ressemblent pas à ceux du nord.
