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
0. **Rendu WebGL** (demande d'Adrien, pour tourner comme un vrai jeu) : Phaser en `AUTO` (WebGL, repli
   Canvas si absent ; `?renderer=canvas` force l'ancien rendu). Les tuiles sont des textures GPU ;
   l'overlay garde son code de dessin Canvas 2D mais le dessine via `render/glPainter.ts`, un faux
   contexte 2D qui envoie traits et formes à des `Graphics` WebGL, textes et images à des textures
   en cache, dégradés à un halo teinté. La brume et la nuit restent peintes en 2D au quart de
   résolution (petite texture remise à jour à chaque image) ; nuages et ombres sont des images
   dessinées une fois. Pas de `clip` ni de `globalCompositeOperation` sur le contexte de l'overlay
   (seulement sur ses propres petits canvas). Mesure sans GPU : le dessin de l'overlay passe de
   ~2 000 à ~36 ms sur 5 s.
1. Rendu par tuiles et brume. Les tuiles sont dessinées **hors du fil principal** par 1 à 3 Web
   Workers (`render/tileWorker.ts`, `render/tileSource.ts`, OffscreenCanvas ; repli sur le fil
   principal sinon), la plus proche d'abord, plus un anneau d'avance autour de la vue. Trois
   résolutions (0,5 / 1 / 2 px par unité) selon le zoom ; une tuile trop nette est réduite sur
   place, une tuile floue sert d'aperçu en attendant la bonne. Cache borné à **72 Mo** (LRU),
   textures Phaser via `addImage` (jamais `addCanvas`, qui copie les pixels). Fondu de 220 ms.
   Les fenêtres des maisons (nuit) reviennent du worker ; on lui dit quelles illustrations sont
   chargées (`setArtKinds`). Brume : un tampon de disque pré-dessiné par taille. **Robustesse** (tuile
   blanche vue sur Firefox Android) : une tuile qui échoue dans un worker est redemandée, puis
   dessinée sur le fil principal après 2 échecs ; un worker muet 12 s ou en erreur est relancé.
   Le worker renvoie une **copie** (`createImageBitmap`, jamais `transferToImageBitmap`) ; sur
   **Firefox**, des pixels bruts recopiés dans un canvas de la page (les ImageBitmap y donnaient des
   tuiles vides, décalées ou rayées sur Android). `?tiles=main` force le dessin sur le fil principal.
   **Résolution adaptative** (`ui/screen.ts`, `Map.adaptQuality`) : si deux mesures de 2 s d'affilée
   tombent sous ~33 images/s, le jeu passe de ×2 à ×1,5 puis ×1 (retenu par appareil,
   `oriande.dpr.gl`, remesuré depuis WebGL) ; `?dpr=` force une valeur. Grand écran sous Firefox : 22 → 56 images/s.
2. Ne pas « améliorer » le monde sans qu'Adrien le demande.
3. Dessin retravaillé à sa demande : montagnes en pics gravés, collines, aventurier à
   l'échelle, routes d'un seul style qui contournent les montagnes (A*, cols sous 0,7,
   liaison abandonnée au-delà de 1,8 × la ligne droite), villages et villes réalistes,
   noms détourés, vision selon le terrain (forêt 100, plaine 200, jusqu'à 600 en altitude),
   contournement de l'eau par l'explorateur. **Marche** : un tap montre l'itinéraire (pointillés,
   drapeau) et propose « Marcher vers » (distance en lieues ; le nom du lieu si on touche un bourg,
   un lieu, un monument ou une merveille déjà vus) ; rien ne part sans confirmation. Plus de trace
   des pas passés sur la carte : seuls les pointillés de l'explorateur à sa destination.
   **Obstacles** (`game/route.ts`, `walkable`/`obstacle`) : mer, lacs, banquise et montagnes
   (altitude ≥ 0,6), sauf le long d'une route ou d'une rivière qui les traverse (couloirs calculés
   par zone de 1 024, seulement là où une montagne est rencontrée).
4. Rareté : lieux étranges ~10 % des tuiles (KEEP = 0,28), pictogrammes gravés, **35 types**
   (`LANDMARK_KINDS`, demande d'Adrien : une vraie variété) tirés selon le climat, l'altitude et
   l'eau (oasis au désert, ziggourat et idole en jungle, cimetière des éléphants et termitières en
   savane, mammouth en toundra, navire pris dans les glaces sur la banquise, phare et clocher
   englouti près des côtes, tortue et maelström au large...), jamais en montagne, jamais sur un
   bourg (80 d’un village, 130 d’une ville : `TOWN_CLEARANCE`, `CITY_CLEARANCE`) ;
   **rien dans l’eau** : monuments, merveilles (sauf les arches, en mer) et lieux terrestres évitent
   rivières et lacs (`nearWater` de `world/rivers.ts`) ;
   pictogrammes dans `render/icons.ts` et `render/icons-more.ts`. **Monuments**
   (`world/monuments.ts`, 8 types : colosse, pyramide, temple, sphinx, sanctuaire, arc,
   amphithéâtre, aqueduc), au plus un par cellule de 4×4 tuiles (CHANCE = 0,3), selon le climat,
   vus à 350, **illustrés** (images ChatGPT reçues, `src/assets/monuments/*.webp`, dessinées par
   l'overlay ; la gravure de `render/monuments.ts` reste en repli) ;
   **merveilles** illustrées (`world/wonders.ts`, 6 types), au plus une par cellule de
   8×8 tuiles (CHANCE = 0,45), repérées à 500 unités, fiche prioritaire.
5. Pas de traversée d'eau en phase 1 : le **tour du monde** viendra avec bateau/montgolfière.
6. **Rivières** (`world/rivers.ts`) : sources dans les collines (altitude 0,22–1,1, une
   candidate par carré de 512), descente de plus grande pente sur une grille de 64 le long de
   `drainage` (relief de grande échelle) ; une cuvette se remplit et déborde par son col le
   plus bas (lac si ≥ 3 cases), trop grande → la rivière finit dans un lac. Un affluent
   s'arrête où il rejoint une rivière. Méandres par bruit, largeur croissante vers l'aval.
   Calculées par cellule de 8 192 (cache), préchauffées au Boot, puis une cellule d'avance
   toutes les 1,5 s pendant la marche. Les pics s'écartent le long des rivières (vallées).
   Elles ne bloquent pas la marche pour l'instant. Torrents (`steep`) et **cascades** (`falls`,
   chute d'altitude ≥ 0,22 entre deux nœuds) ; l'overlay anime le courant (écume qui
   descend, plus vite dans les torrents), les embruns des cascades et des **poissons qui
   sautent** (mer et lacs seulement, pas les rivières). Rendu : ruban à rives irrégulières,
   liseré de sable, roseaux ; largeur 1,2 → ~10 selon la distance parcourue. Les **lacs**
   sont dessinés par-dessus (une rivière qui traverse un lac y disparaît), évitent les
   bourgs (rétrécissent ou disparaissent), et les **routes contournent les lacs**
   (`roads.ts` charge les lacs du coin : les routes dépendent des rivières, jamais l'inverse).
   **Ponts** en pierre là où une route croise une rivière. **Réseau** (`network` dans `riversNear`) :
   deux rivières qui se rencontrent partagent leurs nœuds ; la plus petite (moins d'eau écoulée
   au nœud) devient affluent et s'arrête au milieu de la plus grande (`cut`, `join`), même entre
   cellules : jamais deux rivières dans le même lit. Au dessin, les berges de chacune sont
   découpées dans l'eau de l'autre (clip), l'embouchure s'ouvre. La rive d'un lac s'ouvre où une rivière
   entre. Rivières et lacs sont dessinés **avant** la végétation, qui les évite (`waterMask`)
   et déborde sur les berges. Animation du courant : reflets fins et lents qui scintillent. Les bourgs évitent les abords
   des montagnes (rien ≥ 0,55 à moins de 40).
8. **Météo et jour/nuit** (`world/weather.ts`, choix d'Adrien) : **partagés par tous**, calculés
   à partir de l'heure réelle (`worldTime`, figée dans les tests par `src/test-setup.ts`).
   Une journée dure `DAY_SECONDS` = 2 h réelles ; l'heure locale dépend de la longitude. **Nuit
   raccourcie** (demande d'Adrien) : 18 h → 6 h ne prend que `NIGHT_SHARE` = 25 % du temps réel
   (~28 min de nuit noire, ~5 min d'aube et de crépuscule, ~80 min de jour).
   Vents par latitude (alizés d'est, vents d'ouest tempérés, vents polaires d'est) ; nuages =
   bruit emporté par le vent (une averse passe en quelques minutes) dans de grands systèmes
   plus lents ; pluie, orage, neige (froid ou haute altitude), tempête de sable (désert venté),
   brouillard (bas-fonds humides à l'aube). Au départ : ~59 % clair, ~28 % couvert, ~13 % pluie.
   Effet : la vision (`visibilityAt`) baisse sous la pluie, la neige, le brouillard, le sable
   et la nuit (jusqu'à −40 %). Pas d'effet sur la marche pour l'instant. Rendu
   (`render/weather.ts`) : petits nuages dessinés « ligne claire » (Moebius) qui vivent dans
   l'air emporté par le vent (`airShift`), avec leur ombre au sol ; les nuages passent
   **au-dessus** de l'explorateur et s'effacent quand on zoome (absents au zoom ≥ 1,2, le
   zoom par défaut est 1,3 ; pleins à ≤ 0,8) ; les ombres restent visibles à tout zoom ; pluie/neige/sable en tracés
   groupés, éclairs, lueur de l'aube et du crépuscule. **Nuit** : voile bleu nuit (quart de
   résolution, peint dans le canvas de brume) percé par les lumières : la **torche** de
   l'explorateur et les **fenêtres** des maisons (`townWindows`, remplies au dessin des bourgs). HUD : météo et vent au lieu de l'explorateur ; à droite un **cadran** gravé (horizon, soleil à sa
   hauteur de 6 h à 18 h, lune et étoiles la nuit, nuages/pluie/neige/brume/sable du lieu) et
   l'**heure locale** (plus de compteurs de lieues ni de cases, demande d'Adrien).
9. **Animaux** (`world/fauna.ts`, `data/animals.json`, 22 espèces, dessin `render/animals.ts`) :
   un troupeau possible par case de 128 (32 % sur terre, 3 % en haute mer, 12 % sur la banquise),
   espèce tirée selon l'habitat (biome, `mountain` au-dessus de 0,6, `sea` en eau profonde, `ice`) ;
   les petits sont bien plus nombreux que les gros (poids). Ils errent autour de leur gîte sur
   l'**heure réelle partagée** (marche puis broutent), restent sur leur terrain, loin des bourgs
   et hors des lacs ; rayon raccourci près de l'eau. Dessin « planche de naturaliste » (refait à la demande
   d'Adrien) : un contour anatomique lisse par espèce (paramètres `look` dans le JSON), trait fin,
   lavis, hachures d'ombre qui s'effacent sur les petites figures, pattes articulées qui marchent,
   pâture où le cou descend, lièvres qui sautent, marmottes qui se dressent, baleines qui soufflent
   et plongent. Chaque pose est quantifiée et mise en cache (bitmap par pose et par taille) :
   < 1 ms par image. Invisibles quand ils feraient moins de 4 px. Champs `food` et `danger` prêts pour la chasse et le combat (plus tard).
   **Nuit** (demande d'Adrien) : chaque case a aussi un troupeau de nuit (`herd(ci, cj, true)`,
   tirage séparé, poids `night` dans le JSON) ; les animaux de jour s'effacent à la tombée de la
   nuit, ceux de la nuit (chauves-souris, chouettes, hérissons, renards, loups, sangliers...)
   sortent (pas de fondu : chaque troupeau change à son propre moment du crépuscule, en quelques
   secondes), dessinés **par-dessus** le voile de nuit dans des couleurs bleuies (plus d’yeux qui
   brillent : retirés à la demande d’Adrien). Chauves-souris et chouettes volent (`alt`, ombre au sol).
   La **brume** se lève en fondu (~0,9 s par case nouvellement vue). Le titre d'atlas et la rose
   des vents se placent sous l'en-tête (`View.top`).
7. **Réseau routier** : un bourg n'est relié qu'à ses voisins « relatifs » (aucun autre bourg
   plus proche des deux) : liaisons réciproques et planes, les routes se rejoignent dans les
   bourgs au lieu de se croiser. Les routes serpentent (bruit perpendiculaire, toujours sur
   terrain praticable).

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
- **Version** affichée en bas à gauche du jeu (`v<package> · <commit> · <date>`, posée au build par
  `vite.config.ts`) : pour savoir d’un coup d’œil si un téléphone a la dernière version.
