# ORIANDE — brief du projet

Jeu d'aventure 2D, vue du dessus, dans un monde fantastique façon Jules Verne (1873).
Un aventurier à pied explore une carte infinie dessinée comme une carte ancienne
(aquarelle + gravure à l'encre). But du jeu : retrouver **Oriande**, la Grande Cité
perdue, paradis d'une civilisation disparue (ton : le temple des Anciens de FF7 —
sacré, ancien, mélancolique). Les ruines, la tour sans porte, le squelette de
léviathan sont des vestiges des Oriandais.

Joué sur téléphone, dans le navigateur, depuis GitLab Pages, installé comme PWA.
Public français ET anglais : tout texte passe par i18n dès le premier jour.

## Stack (non négociable)

- Phaser 3 (dernière version stable) + TypeScript + Vite
- Déploiement : GitLab Pages via GitLab CI (`.gitlab-ci.yml`), dépôt
  `gitlab.com/audebrand.adrien/oriande`. Base Vite relative (`./`) : le même build
  marche à la racine d'un domaine ou sous un sous-chemin.
- PWA : manifest + service worker (vite-plugin-pwa), icône sur l'écran d'accueil,
  jouable hors ligne
- Aucun backend pour l'instant. Le multijoueur viendra plus tard sur un serveur
  séparé : on le PRÉPARE (état sérialisable, monde déterministe), on ne le code pas.
- Pas de framework UI. Les menus sont faits en Phaser ou en DOM minimal stylé
  « papier ancien ».

## Point de départ : le prototype

`proto/index.html` est le prototype existant (canvas vanilla, 295 lignes).
Il contient TOUTE la génération du monde : bruit, altitude, humidité, étrangeté,
bourgs, routes, lieux étranges, noms, rendu aquarelle/hachures, animations, brume,
trace de pas, cache de tuiles, vue atlas.

Règles :
1. Porter cette génération dans `src/world/` **à l'identique** : même graine (1873),
   mêmes formules, mêmes hash. Une case donnée doit donner exactement le même
   terrain qu'avant. Écrire un test qui compare quelques valeurs d'altitude et de
   noms de bourgs avec le proto.
2. Garder le rendu par tuiles (textures Phaser générées à la volée, cache limité à
   ~90 tuiles) et la brume de guerre.
3. Ne pas « améliorer » le monde sans qu'on le demande. D'abord un jeu dedans.

## Architecture

```
src/
  main.ts               config Phaser, enregistrement des scènes
  world/                génération déterministe (portée du proto), AUCUNE dépendance Phaser
    noise.ts  terrain.ts  settlements.ts  roads.ts  landmarks.ts  names.ts
  render/               dessin des tuiles (aquarelle, hachures, forêts, côtes, animations)
  scenes/
    Boot.ts  Map.ts  Town.ts  Dungeon.ts  Battle.ts  Discovery.ts  Menu.ts
  game/                 règles pures, sans Phaser, testables
    state.ts            GameState : UN objet sérialisable = toute la partie
    save.ts             sauvegarde/chargement (localStorage, versionné, migrations)
    combat.ts  inventory.ts  travel.ts  discoveries.ts
  data/                 contenu en JSON : monsters.json items.json discoveries.json towns.json
  i18n/                 fr.json en.json ; helper t(key)
  ui/                   composants papier : boîte de dialogue, inventaire, boutons
public/
  assets/               illustrations (découvertes, monstres), icônes, polices
proto/index.html        le prototype, lecture seule, référence
```

Principes :
- `world/` et `game/` ne connaissent pas Phaser → testables avec vitest.
- Toute donnée de jeu (monstre, objet, découverte) est du JSON dans `data/`,
  jamais en dur dans une scène.
- `GameState` est la seule source de vérité. Les scènes lisent/écrivent dedans
  et se redessinent. Pas d'état caché dans les scènes.
- Sauvegarde = JSON de `GameState` avec un numéro de version. Petite et robuste :
  cases découvertes (ensemble compressé), trace de pas, position, inventaire,
  découvertes faites, quêtes. Jamais les tuiles dessinées.
- Mobile d'abord : tactile, écran étroit, 60 fps sur un téléphone moyen,
  pas de texte minuscule. Tester en portrait.

## Direction artistique

Carte ancienne, papier ivoire, encre brune, aquarelle. Polices : IM Fell English,
Old Standard TT (déjà dans le proto). Les menus sont des pages d'atlas, les
boîtes de dialogue des cartouches. Pas de UI « jeu mobile » brillante.
Les illustrations (découvertes, monstres, lieux) seront fournies par Doudou
(images générées, style fixe). Prévoir des emplacements et des placeholders
dessinés à l'encre en attendant.

## Boucle de jeu visée

marcher sur la carte → tomber sur un lieu / une découverte / un monstre →
combattre, ramasser, apprendre un indice → rentrer en ville pour se soigner,
s'équiper, entendre une rumeur → repartir plus loin vers Oriande.
Les indices sur Oriande sont la colonne vertébrale : chaque donjon, chaque
découverte majeure en livre un.

## Tranche jouable — objectif de la phase 1

Ordre impératif. On ne passe à l'étape suivante que quand la précédente tourne
sur le téléphone de Doudou via GitLab Pages.

1. **Squelette** : Vite + Phaser + TS + PWA + déploiement. Une scène Map vide
   qui affiche « Oriande ». Déployé.
2. **Portage du monde** : la carte du proto dans Phaser, déplacement tactile,
   zoom, brume, trace, atlas. Test de parité avec le proto. Déployé.
3. **GameState + sauvegarde** : on quitte, on revient, on est au même endroit.
4. **Combat** : une scène Battle au tour par tour, simple et lisible
   (attaquer / objet / fuir), 2 monstres dans `monsters.json`. Rencontres
   aléatoires sur la carte, fréquence dépendant du terrain.
5. **Ville-menu** : entrer dans un bourg ouvre une page d'atlas : auberge
   (soigner), marchand (3 objets), taverne (une rumeur tirée de `towns.json`).
   PAS de plan de ville à parcourir pour l'instant.
6. **Donjon** : une scène Dungeon de 3 salles (grille simple, vue du dessus),
   un monstre par salle, un coffre, un indice sur Oriande à la fin.
7. **Découvertes** : 5 découvertes illustrées (placeholders), fiche avec texte
   fr/en, ajoutées au carnet de l'explorateur.
8. **Région de départ** : s'assurer que les 2 premières heures de jeu autour du
   point de départ contiennent : 2 bourgs, 1 donjon, 3 découvertes, des
   monstres faibles. Si la génération ne le garantit pas, forcer ces éléments
   près de l'origine, de façon déterministe.

À la fin de la phase 1, Doudou fait tester le jeu à des gens. Rien d'autre
n'est ajouté avant ces retours.

## Ce qu'on ne fait PAS en phase 1

- Pas de multijoueur, pas de serveur, pas de compte.
- Pas de montgolfière, pas de traversée d'eau.
- Pas de plan de ville détaillé.
- Pas de centaine d'illustrations : 5 placeholders suffisent.
- Pas d'optimisation prématurée du rendu tant que ça tient 60 fps.

## Conventions

- Code et commentaires en anglais (projet ouvert, joueurs anglais).
  Textes joueur uniquement via i18n.
- Commits petits, messages en anglais, conventionnels (`feat:`, `fix:`…).
- Chaque étape de la tranche jouable = une merge request ou un commit tagué `phase1-stepN`.
- Claude merge lui-même ses merge requests dès que le pipeline est vert, sans attendre
  d'approbation (accord donné par Adrien).
- Avant de proposer une fonctionnalité hors liste : demander.
- Toujours terminer une session en vérifiant que `npm run build` passe et que
  le pipeline GitLab Pages est vert.
