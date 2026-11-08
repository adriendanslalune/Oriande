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

## Le monde : une planète (choix d'Adrien)

Au départ, `proto/index.html` (canvas vanilla, gardé en lecture seule comme référence
historique) générait un monde plat et infini, porté à l'identique en phase 1, étapes 2-3.
Adrien a ensuite décidé d'en faire **une vraie planète ronde, immense, une épopée** :
le monde a été régénéré, il n'est **plus** identique au proto (plus de test de parité).

- `world/planet.ts` : circonférence **10 240 lieues** (409 600 unités, la Terre de Verne),
  méridien = moitié. La carte boucle d'est en ouest ; projection cylindrique d'atlas ancien.
  Pôles nord et sud : banquise, **infranchissable au-delà de 84°** (`beyondIce`).
  y = 0 vers 45° N ; l'équateur est à `EQUATOR_Y`. La couture est à **180°** (antiméridien),
  loin du départ : `wrapPosition` y ramène l'explorateur, la vue suit.
- **Tout doit boucler** : le bruit est périodique en x (`fbm(..., px)`), chaque échelle et chaque
  grille de décor a un pas qui **divise la circonférence**, et tout tirage au sort (`hash2`)
  utilise l'index **ramené sur la planète** (`wrapIndex`). Bourgs/lieux/merveilles ont une
  identité `key` (ramenée, pour les découvertes) et une position brute (`rkey`, pour les
  mémos et le dessin). La brume est indexée par cases ramenées (`cellKey`, CELL = 50).
  Ne jamais ajouter de `hash2(gx, ...)` sur un index brut.
- Terrain (`world/terrain.ts`) : une échelle continentale (~1 300 lieues) décide terre/mer
  (~39 % de terres, une douzaine de grandes masses, la plus grande ≈ 40 % des terres,
  intérieurs pleins sans essaim de lacs), le relief local décide des montagnes (~12 %). Climat (`world/climate.ts`) par **latitude** : tropiques
  chauds (désert/savane/jungle selon l'humidité), tempéré, toundra et banquise au-delà de ~60°.
- Départ (`startPosition`) : le même pour tous, un village tempéré au cœur du grand
  continent, au plus près de 0° de longitude vers 45-55° N (≈ 49,7° N, 4,3° O).
  Le continent de départ : ~5 000 × 4 800 lieues, ~1 250 h de marche pour tout voir.
- Échelle des sauvegardes : v3 ; les sauvegardes v1/v2 (monde plat) sont mises de côté.

Règles qui restent :
1. Rendu par tuiles (textures Phaser générées à la volée, cache ≥ 90 tuiles) et brume.
2. Ne pas « améliorer » le monde sans qu'Adrien le demande.
3. Dessin retravaillé à sa demande : montagnes en pics gravés, collines, aventurier à
   l'échelle, routes d'un seul style qui contournent les montagnes (A*, cols sous 0,7,
   liaison abandonnée au-delà de 1,8 × la ligne droite), villages et villes réalistes,
   noms détourés, vision selon le terrain (forêt 100, plaine 200, jusqu'à 600 en altitude),
   contournement de l'eau par l'explorateur.
4. Rareté : lieux étranges ~10 % des tuiles (KEEP = 0,28), pictogrammes gravés ;
   **merveilles** illustrées (`world/wonders.ts`, 6 types), au plus une par cellule de
   8×8 tuiles (CHANCE = 0,45), repérées à 500 unités, fiche prioritaire.
5. Pas de traversée d'eau en phase 1 : le **tour du monde** viendra avec bateau/montgolfière.

## Architecture

```
src/
  main.ts               config Phaser, enregistrement des scènes
  world/                génération déterministe de la planète, AUCUNE dépendance Phaser
    planet.ts  noise.ts  terrain.ts  climate.ts  settlements.ts  roads.ts  landmarks.ts
    wonders.ts  names.ts
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
proto/index.html        le prototype (monde plat), lecture seule, référence historique
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
   zoom, brume, trace, atlas. Test de parité avec le proto. Déployé. (Fait ; le monde a
   depuis été remplacé par la planète, voir plus haut.)
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

## Plus tard (décidé, pas encore fait)

Notés à la demande d'Adrien ; à reprendre après la tranche jouable ou quand il le dit.
- **Météo** : nuages, pluie, soleil, neige, vent. S'appuyer sur les climats
  (`world/climate.ts`) : neige en toundra, orages en jungle, vent de sable au désert.
  Penser à son effet sur la vision (brume, pluie) et sur la marche.
- **Règles de déplacement** : montagnes infranchissables sans équipement (le calcul
  d'itinéraire `game/route.ts` a un seul prédicat `walkable` à étendre), marche plus
  rapide sur les routes, terrain plus ou moins lent.
- **Légende de la carte** : un cartouche ouvrable d'un tap.
- **Illustrations** générées (voir `docs/illustrations.md`) : les 6 merveilles sont
  branchées (`src/assets/wonders/*.webp`, `render/wonderArt.ts`, dessinées par l'overlay).
  Les 8 lieux étranges restent des **pictogrammes gravés** sur la carte (choix d'Adrien :
  ils sont fréquents, une illustration riche serait répétitive) ; leurs illustrations
  (`src/assets/landmarks/*.webp`, non chargées) serviront à la fiche de découverte.
  Restent les fiches de merveilles et les vignettes de ville. Traitement d'une
  image reçue : alpha nettoyé, bord érodé de 3 px (liserés), saturation × 0,85, recadrée,
  512 px, WebP qualité 86.

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
