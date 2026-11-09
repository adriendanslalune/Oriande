# Bourgs d'Oriande — illustrations à faire avec ChatGPT

Les pages des villages et des villes (14 images) ont des **cadres** qui attendent leurs illustrations. Tant qu'une
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

Un **village** et une **ville** ne se ressemblent pas (demande d'Adrien) : au village tout est
rustique, un peu boueux et rafistolé ; en ville tout est plus propre, plus soigné. L'auberge et le
marchand ont donc chacun deux images et deux visages ; la forge et la taverne n'existent qu'en ville.

### Village (rustique)

| clé | Où | Format | Sujet à demander (anglais) |
|---|---|---|---|
| `village` | arrivée | paysage 3:2 | the central square of a small poor village, seen from inside it: a stone well, crooked thatched cottages, a little chapel, a muddy ground with puddles and straw, a bench under an old tree, chickens, a cart without its horse; quiet late-afternoon light, a big calm sky; nobody, or one distant figure |
| `inn-village` | l'auberge | paysage 3:2 | the common room of a humble village inn: a smoky fireplace with a pot, low crooked beams, rough tables and stools, straw on the floor, a ladder to a loft where travellers sleep on straw |
| `shop-village` | le marchand | paysage 3:2 | a pedlar's cart in a muddy village lane, used as a stall: sacks, a few jars, dried sausages, a basket of ship's biscuits, a tarpaulin propped on poles, a tired donkey nearby |
| `keeper-inn-village` | visage de l'aubergiste | carré, buste | a stout peasant innkeeper woman with a stained apron, rolled sleeves and red cheeks, a warm rough smile, plain ivory background |
| `keeper-shop-village` | visage du marchand | carré, buste | a weathered pedlar with a battered hat, a scarf and a missing tooth, a sly kind look, plain ivory background |

### Ville (plus soignée)

| clé | Où | Format | Sujet à demander (anglais) |
|---|---|---|---|
| `city` | arrivée | paysage 3:2 | the main square of a prosperous walled town, seen from inside it: clean cobblestones, a fountain with a weathered statue, tall stone houses with painted shop signs, a clock tower and steeples, gas lamps, folded market awnings; calm, a big sky; nobody, or one distant figure |
| `inn-city` | l'hôtel des voyageurs | paysage 3:2 | the lobby of a respectable travellers' hotel: a polished wooden counter with a bell and a key board, a carpeted staircase, brass lamps, a framed map on the wall, a potted palm |
| `shop-city` | la boutique | paysage 3:2 | the inside of a well-kept general store for explorers: shelves of tins and jars, coils of rope, lanterns, fishing rods, a glass counter, a brass scale, a shop window onto the street |
| `smith` | la forge | paysage 3:2 | a town blacksmith's forge: glowing hearth, anvil, hammers and tongs neatly hung, swords and cutlasses on a rack, a few sparks; dark interior lit by the fire |
| `tavern` | la taverne | paysage 3:2 | the inside of a harbour-town tavern: a long wooden counter, barrels, a ship's lantern, old sea charts pinned on the wall, a window showing masts outside |
| `keeper-inn-city` | visage du patron de l'hôtel | carré, buste | a neat hotel keeper with a waistcoat, a watch chain and well-combed moustache, polite smile, plain ivory background |
| `keeper-shop-city` | visage du boutiquier | carré, buste | a shopkeeper with small spectacles, sleeve garters and a pencil behind his ear, plain ivory background |
| `keeper-smith` | visage du forgeron | carré, buste | a broad-shouldered blacksmith with a leather apron, soot on his face and forearms, plain ivory background |
| `keeper-tavern` | visage du vieux marin | carré, buste | an old sailor with a white beard, a sailor's cap and a clay pipe, weathered face, plain ivory background |

Plus tard (pas encore branché) : une vue d'arrivée par climat (`village-desert`, `village-jungle`,
`village-tundra`...), pour que les villages du sud ne ressemblent pas à ceux du nord.
