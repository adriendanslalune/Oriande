# Bourgs d'Oriande — illustrations à faire avec ChatGPT

Les pages des villages et des villes (10 images) ont des **cadres** qui attendent leurs illustrations. Tant qu'une
image manque, le jeu affiche un « ? » sur un ciel et une terre unis. Dès qu'un fichier est déposé dans
`src/assets/towns/<clé>.webp`, il prend sa place, sans autre changement.

Même méthode que pour les objets (`items.md`) : une conversation, le bloc de style d'abord, puis les
sujets un par un.

## Bloc de style (à coller en premier)

```
I am making illustrations for an adventure game set in 1873, in the spirit of the engravings in
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

Style choisi par Adrien : **gravure à la Jules Verne, sépia, dépouillée** (les images Moebius en couleurs cassaient
l'esprit de la carte). En attendant leur version gravée, les anciennes images en couleurs sont virées au sépia.

## Les illustrations

Pas de portraits des gens (choix d'Adrien) : il en faudrait un par bourg, sinon on croiserait le même
aubergiste partout. Ce qu'ils disent reste, en citation sous l'image.

Un **village** et une **ville** ne se ressemblent pas (demande d'Adrien) : au village tout est
rustique, un peu boueux et rafistolé ; en ville tout est plus propre, plus soigné. L'auberge et le
marchand ont donc chacun deux images ; la forge et la taverne n'existent qu'en ville.

### Village (rustique)

| clé | Où | Format | Sujet à demander (anglais) |
|---|---|---|---|
| `village` | arrivée | paysage 3:2 | the central square of a small poor village, seen from inside it: a stone well, crooked thatched cottages, a little chapel, a muddy ground with puddles and straw, a bench under an old tree, chickens, a cart without its horse; quiet late-afternoon light, a big calm sky; nobody, or one distant figure |
| `inn-village` | l'auberge | paysage 3:2 | the common room of a humble village inn: a smoky fireplace with a pot, low crooked beams, rough tables and stools, straw on the floor, a ladder to a loft where travellers sleep on straw |
| `shop-village` | le marchand | paysage 3:2 | a pedlar's cart in a muddy village lane, used as a stall: sacks, a few jars, dried sausages, a basket of ship's biscuits, a tarpaulin propped on poles, a tired donkey nearby |

### Ville (plus soignée)

| clé | Où | Format | Sujet à demander (anglais) |
|---|---|---|---|
| `city` | arrivée | paysage 3:2 | the main square of a prosperous walled town, seen from inside it: clean cobblestones, a fountain with a weathered statue, tall stone houses with painted shop signs, a clock tower and steeples, gas lamps, folded market awnings; calm, a big sky; nobody, or one distant figure |
| `inn-city` | l'hôtel des voyageurs | paysage 3:2 | the lobby of a respectable travellers' hotel: a polished wooden counter with a bell and a key board, a carpeted staircase, brass lamps, a framed map on the wall, a potted palm |
| `shop-city` | la boutique | paysage 3:2 | the inside of a well-kept general store for explorers: shelves of tins and jars, coils of rope, lanterns, fishing rods, a glass counter, a brass scale, a shop window onto the street |
| `smith` | la forge | paysage 3:2 | a town blacksmith's forge: glowing hearth, anvil, hammers and tongs neatly hung, swords and cutlasses on a rack, a few sparks; dark interior lit by the fire |
| `tavern` | la taverne | paysage 3:2 | the inside of a harbour-town tavern: a long wooden counter, barrels, a ship's lantern, old sea charts pinned on the wall, a window showing masts outside |

Plus tard (pas encore branché) : une vue d'arrivée par climat (`village-desert`, `village-jungle`,
`village-tundra`...), pour que les villages du sud ne ressemblent pas à ceux du nord.
