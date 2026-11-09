# Bourgs d'Oriande — illustrations à faire avec ChatGPT

Les pages des villages et des villes ont des **cadres** qui attendent leurs illustrations. Tant qu'une
image manque, le jeu affiche un « ? » sur un ciel et une terre unis. Dès qu'un fichier est déposé dans
`src/assets/towns/<clé>.webp`, il prend sa place, sans autre changement.

Même méthode que pour les objets (`items.md`) : une conversation, le bloc de style d'abord, puis les
sujets un par un.

## Bloc de style (à coller en premier)

```
I am making illustrations for the town pages of an adventure game set in an 1870s world of
exploration, in the spirit of Jules Verne's illustrated Hetzel editions, with a clean, calm
"ligne claire" line and soft flat colours.
Style for EVERY picture:
- fine brown-black ink line of even weight, light engraved cross-hatching in the shadows;
- soft, slightly faded watercolour washes: ivory, ochre, sepia, pale sky blue, muted greens and reds;
- calm, wide, airy composition, no crowds, no text, no frame, no signature;
- a warm, slightly melancholic mood, a world of explorers and old maps;
- no 3D render, no glossy "mobile game" look.
Keep the same line, palette and light from one picture to the next.
```

## Les illustrations

| clé | Où | Format | Sujet à demander (anglais) |
|---|---|---|---|
| `village` | arrivée dans un village | paysage 3:2 | a small village seen from the dirt road leading to it: thatched cottages, a well, smoke from chimneys, fields, a few trees |
| `city` | arrivée dans une ville | paysage 3:2 | a walled town seen from its gates: stone ramparts, steeples, roofs climbing a hill, a road with a cart |
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
