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
- Terrain (`world/terrain.ts`) : **trois continents** (demande d'Adrien : pas d'effet « gruyère », de grands
  océans entre eux), chacun quelques lobes (`CONTINENTS`, en degrés) aux côtes découpées par le bruit (baies, caps,
  péninsules) ; intérieur en plateau (`PLATEAU` = 0,22), quelques archipels au large. Le **Vieux Continent** est
  à cheval sur l'équateur à 0° (on y commence), l'Est et l'Ouest de part et d'autre. ~25 % de terres ; le relief
  local décide des montagnes (~12 %). `continent` est calculé sur une grille de 64 (cache) et interpolé. Climat (`world/climate.ts`) par **latitude** : tropiques
  chauds (désert/savane/jungle selon l'humidité), tempéré, toundra et banquise au-delà de ~60°.
- Départ (`startPosition`) : le même pour tous, un village avec une route au plus près de **0°, 0°** (au milieu de
  la carte, sur l'équateur, demande d'Adrien) : savane, ≈ 0,2° N, 0,2° E.
- Échelle des sauvegardes : **v11** (le monde refait en trois continents) : les sauvegardes v1 à v10 sont mises de
  côté, une nouvelle partie commence au nouveau départ.

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
   **Bords bloqués** : les tuiles font 128/256/512 px (puissances de 2), que Phaser met en `REPEAT` en WebGL ;
   lissées, elles mêlaient leur bord opposé (fins traits entre les cases) : `Map.clampEdges` les passe en
   `CLAMP_TO_EDGE`. Le worker renvoie une **copie** (`createImageBitmap`, jamais `transferToImageBitmap`) ; sur
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
   contournement de l'eau par l'explorateur. **Ordinateur** : clic droit = marcher (ou chasser) tout de suite,
   sans confirmation ; clavier : Échap ferme, I ou S ouvre le sac, + et − zooment, Espace recentre. **Menu d'actions au point touché** (demande d'Adrien, plus
   instinctif qu'un gros bouton en bas) : un tap ouvre un petit cartouche à côté de ce qui a été touché, qui suit
   la carte (`Hud.showActions`/`placeActions`, `Map.actions`) : « Chasser · Cerf » sur un animal, « Récolter ·
   Bois » puis « Marcher vers » sur la terre, « Pêcher » sur l'eau, « Entrer » sur le bourg où l'on est ;
   l'action probable en premier, en foncé. Un tap ailleurs pendant qu'un menu est ouvert le ferme seulement (le
   suivant en ouvre un). **Butin visible** : pendant le travail, ce qu'on récolte (« Bois », « Pêche… ») au-dessus
   de l'anneau ; chaque gain (récolte, poisson, viande) fait un billet papier « +3 viande » **à l'endroit même**
   (au-dessus de l'explorateur, du poisson, de l'animal abattu), qui monte doucement 2,6 s (`LOOT_MS`) ; le bouton
   Sac s'illumine un instant (`Hud.pulsePack`). Sac et pages des bourgs restent en panneau. **Marche** : un tap montre l'itinéraire (pointillés,
   drapeau) et propose « Marcher vers » (distance en lieues ; le nom du lieu si on touche un bourg,
   un lieu, un monument ou une merveille déjà vus) ; rien ne part sans confirmation. Plus de trace
   des pas passés sur la carte : seuls les pointillés de l'explorateur à sa destination.
   **Obstacles** (`game/route.ts`, `walkable`/`obstacle`) : mer, lacs, banquise et montagnes
   (altitude ≥ 0,6), sauf le long d'une route ou d'une rivière qui les traverse (couloirs calculés
   par zone de 1 024, seulement là où une montagne est rencontrée).
4. **Retirés de la carte pour l'instant** (demande d'Adrien : sans intérêt tant qu'ils ne servent à rien) :
   lieux étranges, monuments et merveilles. `world/features.ts` (`placesShown`, `showPlaces`) coupe
   `landmark`, `monumentsNear`, `wondersNear` (et le chargement de leurs images) ; tout leur code, leurs
   dessins et images restent, leurs tests les rallument. Ce qui suit décrit ce qui reviendra.
   Rareté : lieux étranges ~10 % des tuiles (KEEP = 0,28), pictogrammes gravés, **35 types**
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
4 bis. **Contrées fabuleuses** (demande d'Adrien : des lieux hors du commun, chacun **unique sur la planète**) :
   `world/realms.ts`, 15 contrées (champignons géants, forêt de cristal, désert de verre, mer de nuages, monts
   flottants, lac pétrifié, forêt d'os, marais aux lucioles, jardin des statues, arbres-colonnes, banquise aux aurores,
   cratère de l'étoile tombée, fleuve qui remonte, dunes chantantes, pierres levées), chacune sur son climat
   (`RULES`), de 9 à 15 lieues de rayon, à plus de 175 lieues l'une de l'autre. Leurs places sont **figées dans
   `PLACED`** (la recherche, `searchRealms`, prend des secondes ; un test vérifie qu'elle redonne les mêmes : à
   refaire si le monde change). Bord irrégulier (`realmDepth`). Dessin (`render/realms.ts`) : teinte du sol, leurs
   propres « plantes » à la place de la végétation (`drawRealmPlant`), et pour certaines un tracé d'ensemble (rebord
   et éjectas du cratère, spirale de menhirs, fleuve en spirale vers le sommet) ; nuages et fleuve par-dessus les
   montagnes. Pas de bourg dedans. Découverte en y entrant (`named` « r<kind> », note), nom en capitales espacées
   sur la carte, losange dans l'atlas (toutes visibles avec « Afficher toute la carte »). **Pas encore d'effet** sur
   le jeu (à décider avec Adrien : ressources rares, dangers, indices sur Oriande).
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
   **Embouchures** (`toCoast`) : une rivière s'arrête à son premier vrai contact avec la mer (deux points de
   suite sous 0 ; lissage et méandres l'emmenaient au large, parfois en travers d'une baie), dernier point posé
   sur le rivage, bout droit au dessin (pas de bout arrondi sablé dans la mer) ; nœuds, lacs et chutes au-delà
   retirés. **Lacs trouvés partout** : un lac déborde de l'emprise de la rivière qui l'a fait (jusqu'à ~100 de
   son centre) ; `lakesNear` cherche donc les rivières 200 plus loin (`LAKE_REACH`), les tuiles aussi (sinon ~11 %
   de l'eau des lacs n'était ni pêchable ni contournée). **Jamais dans la mer** (vu par Adrien) : `makeLake` rétrécit un lac dont la rive atteindrait la mer. **Ponts** en pierre là où une route croise une rivière. **Réseau** (`network` dans `riversNear`) :
   deux rivières qui se rencontrent partagent leurs nœuds ; la plus petite (moins d'eau écoulée
   au nœud) devient affluent et s'arrête au milieu de la plus grande (`cut`, `join`), même entre
   cellules : jamais deux rivières dans le même lit. **Croisements sans nœud commun** (`uncross`, vu par Adrien : un pas en diagonale
   par-dessus une autre rivière, ou des méandres qui la chevauchent) : là où l'eau d'une rivière touche celle d'une autre
   (nœuds voisins seulement, rivières nouvelles du lot seulement), celle qui finit là la rejoint, sinon la plus petite
   s'arrête ; la coupe s'arrête au milieu de l'autre, même si elle le franchit entre deux points. Une rivière déjà calculée n'est **jamais recoupée** par un lot suivant (sinon
   la pêche, la marche et le dessin dépendraient de l'ordre de visite) ; deux rivières qui finiraient l'une sur l'autre :
   la plus grande reprend son cours (`hangers`). Au dessin, les berges de chacune sont
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
9. **Animaux** (`world/fauna.ts`, `data/animals.json`, 38 espèces, dessin `render/animals.ts`) :
   un troupeau possible par case de 128 (32 % sur terre, 3 % en haute mer, 12 % sur la banquise),
   espèce tirée selon l'habitat (biome, `mountain` au-dessus de 0,6, `sea` en eau profonde, `ice`) ;
   les petits sont bien plus nombreux que les gros (poids). Ils errent autour de leur gîte sur
   l'**heure réelle partagée** (marche puis broutent), restent sur leur terrain, loin des bourgs
   et hors des lacs (une bête terrestre au-dessus d'un lac n'est ni dessinée ni chassable : `beastsNear`) ; rayon raccourci près de l'eau. Dessin « planche de naturaliste » (refait à la demande
   d'Adrien) : un contour anatomique lisse par espèce (paramètres `look` dans le JSON), trait fin,
   lavis, hachures d'ombre qui s'effacent sur les petites figures, pattes articulées qui marchent,
   pâture où le cou descend, lièvres qui sautent, marmottes qui se dressent, baleines qui soufflent
   et plongent. Chaque pose est quantifiée et mise en cache (bitmap par pose et par taille) :
   < 1 ms par image. Invisibles quand ils feraient moins de 4 px. Champs `food` (viande) et `danger` servent à la chasse et au combat (étape 4).
   **Selon les régions** (demande d'Adrien) : girafe, rhinocéros, hippopotame, crocodile, autruche, hyène (nuit),
   tigre, oryx, bison, élan, yack, manchot, morse. `water: true` (crocodile, hippopotame) : le gîte doit être
   à moins de 40 d'une rivière ou d'un lac, ou sur la côte. Dessins propres : `croc`, `ostrich`, `penguin`,
   corne nasale (`nosehorn`), cornes droites (`horns: straight`), défenses du morse.
   **Nuit** (demande d'Adrien) : chaque case a aussi un troupeau de nuit (`herd(ci, cj, true)`,
   tirage séparé, poids `night` dans le JSON) ; les animaux de jour s'effacent à la tombée de la
   nuit, ceux de la nuit (chauves-souris, chouettes, hérissons, renards, loups, sangliers...)
   sortent (pas de fondu : chaque troupeau change à son propre moment du crépuscule, en quelques
   secondes), dessinés **par-dessus** le voile de nuit dans des couleurs bleuies (plus d’yeux qui
   brillent : retirés à la demande d’Adrien). Chauves-souris et chouettes volent (`alt`, ombre au sol).
   La **brume** se lève en fondu (~0,9 s par case nouvellement vue). Le titre d'atlas et la rose
   des vents se placent sous l'en-tête (`View.top`).
7. **Réseau routier** (routes dessinées **avant** la végétation, demande d'Adrien : en forêt elles
   passent sous les arbres, qui évitent leur milieu, `roadMask`, et débordent sur leurs bords) :
   un bourg n'est relié qu'à ses voisins « relatifs » (aucun autre bourg
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
(images générées, style fixe). **Style des illustrations** (seulement les objets pour l'instant, choix d'Adrien) : **gravure à la
Jules Verne, dépouillée**, encre brune sur papier crème, hachures seulement dans les ombres, au plus un lavis sépia ; bloc de style dans `docs/items.md`. Prévoir des emplacements et des placeholders
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
   **Revu à la demande d’Adrien** : pas de monstres, pas de fenêtre de combat ni de rencontres
   surprises. Le combat se passe **sur la carte, en temps réel** (`game/combat.ts`, `stepFight` appelé
   à chaque image) : les animaux `danger` 2 (loup, ours, ours blanc, lion, jaguar) chargent quand on
   passe à moins de `AGGRO` = 100 (2,5 lieues), l’explorateur s’arrête, coups échangés seuls (~1/s,
   `PLAYER_PACE`/`FOE_PACE`) au contact ; ils renoncent à 320 de leur point de départ ; on fuit en
   marchant ailleurs. **Chasse** : un tap sur un animal propose « Chasser · Cerf » (ou « Attaquer »
   pour les dangereux) ; le gibier broute jusqu’à 45 puis fuit (×0,6 de sa vitesse), l’explorateur
   court (×1,5) ; `danger` 1 (sanglier, éléphant) se défend ; abattu = **viande** (`food`/2, 1 à 6),
   l’animal disparaît 30 min (`gone`), celui qui s’échappe 3 min. **Sac** (bouton « Sac ») : remède,
   biscuit, viande se mangent à tout moment ; la vie remonte seule hors combat (1 PV / 30 s).
   Défaite = réveil au **dernier bourg où l'on est entré** (`rest`, `settleAt` ; la place du bourg le dit : « Nouveau point de chute », demande d'Adrien), moitié de vie et d’écus. Pas d’attaque à moins de
   180 d’un bourg ni pendant 20 s après un combat. Jauges de vie et dégâts flottants sur la carte.
   **Animations** (demande d’Adrien) : l’explorateur lève son bâton et l’abat (`STRIKE_MS`), éclat
   d’encre à l’impact ; l’animal bondit en se cabrant (`LUNGE_MS`), griffures rouges sur l’explorateur ;
   recul de celui qui est touché ; poussière derrière un animal qui charge. **Sang** (demande d'Adrien) : gouttes
   qui giclent à chaque coup porté (animal ou explorateur), retombent en taches qui sèchent en 40 s.
   **Carcasses** : à la place de l'animal tué, son **squelette** couché sur le flanc (`drawSkeleton` : crâne,
   côtes, colonne, bassin, os des pattes épars, vertèbres de la queue, bois ou cornes), dans une flaque ; seules les
   `CARCASSES` = 5 dernières restent (`GameState.carcasses`, sauvegarde **v7**). **Attaque propre à chaque espèce**
   (`attack` dans le JSON, `attackMotion` dans l'overlay) : `bite` (bond bas, traces de dents : loup, lion,
   tigre, hyène, crocodile, hippo), `swipe` (se dresse puis frappe de la patte, griffures : ours), `ram` (recule
   puis charge tête basse, étoile de choc : sanglier, rhino, bison, yack, morse, éléphant), `kick` (se retourne
   et rue : girafe, élan, autruche). Contact à 22 (côte à côte).
   Combat en cours sauvegardé (sauvegarde **v5**, v4 migrée).
   **Départ démuni, récolte, fabrication, pêche** (demande d'Adrien : l'explorateur n'a RIEN au départ, tout se
   fabrique). Nouvelle partie : sac vide, **à mains nues** (coups de poing, 1-3), **pas de torche** (la nuit, vue
   réduite de moitié par l'obscurité, `NO_TORCH`, et pas de halo). **Récolte** (`world/resources.ts`,
   `resourceAt`, d'après le même terrain que le dessin) : bois (forêts, jungle, conifères de toundra), pierres
   (collines ≥ 0,45, désert, sables secs, toundra nue), fibres (herbe, savane) ; un tap sur la terre propose
   « Récolter · Bois » au-dessus de « Marcher vers » ; l'explorateur y va, se penche 4 s (anneau de progression),
   gagne 1 à 3. **Fabrication** dans le sac (`game/craft.ts`, `data/recipes.json`) : bâton (2 bois, coups 2-5),
   torche (1 bois, 2 fibres), canne à pêche (2 bois, 3 fibres), lance de silex (2 bois, 2 pierres, 2 fibres,
   coups 3-7) ; un outil se fabrique une fois et se garde. `items.json` : `kind` food / material / tool.
   **Pêche** : un tap sur la mer ou un lac propose « Pêcher » (sans canne, le bouton dit qu'il en faut une) ;
   l'explorateur va au **bord le plus proche sur le chemin** (`castFrom`, pas le rivage le plus proche du tap,
   qui peut être de l'autre côté du lac), lance
   la ligne (**lancer animé**, `CAST_MS` = 1,3 s : canne ramenée par-dessus l'épaule, fouettée en avant, bouchon
   qui part en cloche jusqu'à 26 du bord et tombe avec une éclaboussure et des ronds ; puis bouchon qui flotte), 7 s, 65 % de chances : un poisson saute au bout de la ligne, +1 poisson
   (rend 3). Le dessin de l'explorateur suit : mains vides / bâton / lance à pointe de silex, torche la nuit
   seulement s'il en a une. Travail en cours dans `GameState.work` (sauvegarde **v6**, v5 migrée en gardant
   le sac).
   **Survie** (demande d'Adrien, priorité avant donjons et lore ; climat — froid, chaleur, soif — plus tard) :
   **faim** (`game/survival.ts`) : `food` 0-100, ne baisse **qu'en se déplaçant** (demande d'Adrien ; −1 toutes
   les 12 s de marche : plein → vide en ~20 min de marche ; immobile, rien) ; sous 30, alerte et la vie ne remonte plus seule ; à 0, −1 PV de temps en temps, puis évanoui et
   ramené au dernier bourg (moitié des écus). En-tête en **pictogrammes** (`ui/icons.ts`, demande d'Adrien) : cœur 17/20, estomac 72 % (rouge quand
   on a faim), pièce 12 ; bouton Sac = un sac ; pictos aussi dans le menu d'actions (chasse, bois/pierre/herbe,
   poisson, pas, maison) et les sections du sac et des bourgs (flamme, marmite, lune, outils, lit, balance,
   enclume, chope). SVG inline au trait d'encre avec un lavis. Chaque
   nourriture a `food` (ventre), `heal`, et `sick` si crue (viande 25 %, poisson 15 %, champignons 20 % : −3 PV).
   **Feu de camp** (`game/camp.ts`, recette 3 bois + 2 pierres, posé là où l'on est, brûle 15 min, dessiné avec
   fumée, éclaire la nuit) : on y **cuit** (viande → grillée, poisson, champignons ; bien plus nourrissant et sans
   risque), on y **dort** (toute la vie, coûte 20 de ventre), aucune bête ne charge à moins de 140. **Outils** :
   hachette (bois), pioche (pierres), couteau de silex (fibres ; à la chasse +1 viande, peaux, os) : +2 et 40 % plus
   vite ; hameçon d'os (le poisson mord à 85 %) ; veste de cuir (4 peaux : −1 par coup reçu). **Ressources** :
   baies et herbes dans l'herbe, champignons sous les arbres humides (en plus de la récolte, par chance) ;
   remède à fabriquer (3 herbes + 1 baies). Un seul billet par récolte (« +3 bois · +1 champignons »).
   Sauvegarde **v8** (`food`, `camp`).
   **Sac et almanach** (`ui/sheet.ts`, demande d'Adrien : style Verne / Moebius, compartiments, cases). **Direction
   artistique** choisie par Adrien sur prototypes (mélange « planche gravée » Verne + « Verne × Moebius ») :
   cadre gravé à fleurons, papier taché ; en tête un petit paysage en aplats doux (ciel, dunes, montagnes,
   soleil) sous une banderole de titre ; portrait dans un médaillon ovale hachuré (« Fig. 1 — L'explorateur en
   tenue de route ») ; cases comme des boîtes à spécimens à clous de laiton, teintées par place ; titres ❦ ;
   almanach : **onglets sur la tranche** comme un livre (un par usage, à la couleur de l'usage, pastille verte du
   nombre de recettes prêtes ; s'ouvre sur le premier qui a quelque chose de prêt), bande de couleur par usage, ingrédients en pointillés
   (« Bois ………… 2 / 2 »), bouton « Fabriquer » vert en relief ; pas de numéros (l'almanach grossira). Le
   **sac** est une page d'atlas à **onglets** : « Porté » (portrait de l'explorateur, `ui/portrait.ts`, avec quatre
   places : main droite (arme), main gauche (torche), tenue (veste), pieds (bottes de cuir : 2 peaux + 2 fibres,
   marcher creuse 25 % moins le ventre) ; au départ tête nue, chemise de lin, pieds nus, aussi sur la carte ; on choisit en touchant ce qu'on a fabriqué, et l'objet apparaît sur le
   portrait et sur la carte), « Outils » (classés par usage : chasse, récolte, pêche), « Vivres », « Récoltes » ;
   cases avec illustration et nombre ; toucher une case ouvre sa fiche en bas (Manger, Cuire si un feu est là) ;
   près d'un feu, « Dormir au feu » en tête des vivres. **Équipement** (`GameState.equip`, sauvegarde **v9**,
   v8 migrée avec le meilleur du sac) : c'est l'arme **en main** qui frappe, la torche n'éclaire que **tenue**, la
   veste ne protège que **portée** ; ce qu'on fabrique ou achète est pris en main si la place est libre (ou si
   l'arme est meilleure). Le sac ne fabrique plus : c'est
   l'**almanach des recettes** (bouton livre, touche A), **par usage** (Soins, Combat, Chasse, Pêche, Récolte, Feu
   et lumière, Voyage ; champ `use` dans `recipes.json` et `items.json`) : chaque recette avec ce qu'il faut (ce qu'on a / ce
   qu'il faut, en rouge ce qui manque) ; celles qu'on peut faire sont en tête, en vert, « Fabriquer » d'un tap.
   **Illustrations des objets** : à faire avec ChatGPT (`docs/items.md` : bloc de style, liste des 27 objets) ;
   une image déposée dans `src/assets/items/<id>.webp` remplace d'elle-même le « ? » qui l'attend
   (`ui/itemArt.ts` ; pas de dessins provisoires, demande d'Adrien). Plus de pictos dans les titres de compartiments (sac, bourgs). **En-têtes** (demande d'Adrien) : la **Besace** (ex-« Sac de l'explorateur ») et le **Codex** (ex-« Almanach des recettes ») ont en tête un dessin d'un seul trait (paquetage ; table de naturaliste) et leur titre sur la banderole des bourgs (`headLine`, `ribbon` ; images ChatGPT reçues `src/assets/headers/<besace|codex>.webp` ; un titre court est espacé pour épouser la courbe de la banderole ; prompts dans `docs/emblems.md`). Les vies et coups des animaux
   combattants sont dans `data/animals.json` (`hp`, `damage`).)
5. **Ville-menu** : entrer dans un bourg ouvre une page d'atlas : auberge
   (soigner), marchand (3 objets), taverne (une rumeur tirée de `towns.json`).
   PAS de plan de ville à parcourir pour l'instant.
   **Fait** (`game/town.ts`, `data/towns.json`, `Map.openTown`) : une marche qui finit dans un bourg (à moins de
   40 du centre d'un village, 60 d'une ville, `townAt`) ouvre sa page ; un tap sur le bourg où l'on est propose
   « Entrer ». **Village ≠ ville** (demande d'Adrien) : le village a une auberge (**deux couchages**, demande d'Adrien : la paille du grenier 1 écu, la moitié de la vie ; un lit 3 écus, toute la vie ; `inn` dans `towns.json`)
   et un petit marchand (biscuit, remède, viande ; rachète la nourriture et les récoltes à 50 %) ; la ville a
   l'hôtel (une chambre 5 écus ; chambre et petit-déjeuner 8 écus, ventre plein aussi), un grand marchand (aussi poisson, torche, canne ; rachète à 75 %), un **forgeron**
   (coutelas 4-8, sabre 5-10 : mieux que ce qu'on fabrique) et une **taverne** (une rumeur sur Oriande parmi 12,
   `rumor.<id>` en i18n, qui change toutes les demi-heures). Les écus viennent de la vente de ce qu'on chasse,
   pêche et récolte.
   **Bourgs refaits** (demande d'Adrien : « arriver dans un village, pas dans un menu » ; prototype validé) : même
   planche que le sac (`Sheet.showTownSquare`, `showTownPlace`). **Arrivée** : la **silhouette du bourg d'un seul trait** (`ui/townSigns.ts`, `skyline`, propre à chaque bourg,
   demande d'Adrien : discret, laisse place à l'imagination ; silhouettes ChatGPT reçues, 3 par type,
   `src/assets/skylines/<village|city>-<n>.webp`, une tirée par bourg ; la silhouette codée en repli), nom sur une **banderole vintage** (`ribbon`, texte sur la courbe), « Village · des bois tempérés » (région d'après le biome, `regionOf`), une phrase d'ambiance parmi 5
   (`flavourOf`, la même à chaque retour), les **lieux** en cartes : un **gros emblème gravé** (lit, balance, enclume et marteau, chope : `emblem`) sur sa banderole en repli ; **panneaux d'enseigne** ChatGPT reçus (d'une seule encre, ornés, sans potence, demande d'Adrien ; `shopSign`,
   `docs/emblems.md`, `src/assets/signs/<inn-village|inn-city|shop-village|shop-city|smith|tavern>.webp`, nom écrit par
   le jeu, droit, au milieu du vide du panneau, pour l'i18n : `BLANK` donne ce vide sur chaque image ; noms sans article, demande d'Adrien : « Auberge », « Marchand ») (ce qu'un village n'a pas, forge et
   taverne, n'y apparaît pas du tout), « Reprendre la route ». **Chaque lieu** : son emblème et sa banderole, la réplique de
   celui qui le tient (pas de visage, demande d'Adrien : il en faudrait un par bourg), puis : auberge (dormir), marchand (onglets Acheter /
   Vendre, boîtes avec étiquette de prix rouge si trop cher, fiche avec le bouton), forge (lames), **taverne**
   (la rumeur sur un parchemin déroulé, et une **carte des plats** : ragoût, pain et fromage, bière, mangés sur
   place, `eatDish`, `dishes` dans `towns.json`). **Village ≠ ville aussi dans les mots** (demande d'Adrien :
   rustique et boueux au village, plus propre en ville) : auberge et marchand ont leur version de village (`inn-village`,
   `shop-village` : « Auberge », la carriole du marchand) et de ville (`inn-city` « Auberge » aussi, demande d'Adrien, `shop-city`
   « Boutique »), avec leur réplique. **Plus d'illustrations dans les bourgs** (essayées en Moebius puis en gravure : elles cassaient l'esprit du jeu, Adrien ne
   les garde que pour les objets).
6. **Reporté** (Adrien : les donjons viendront avec le lore, qui n'existe pas encore ; priorité à la survie).
   **Donjon** : une scène Dungeon de 3 salles (grille simple, vue du dessus),
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
- **Coin des développeurs** (demande d'Adrien, `ui/dev.ts`) : petit bouton ⚙ en bas à gauche, mot de passe
  (`djaaz1873`, seulement son SHA-256 dans le code ; retenu pour la session) : **Djaaz Bot** (bottes d'or ailées,
  objet `djaaz` aux pieds, marche ×5, `DJAAZ` dans `travel.ts`) **Afficher toute la carte** (`devView.all` dans `travel.ts`, retenu sur l'appareil, hors sauvegarde : plus de brume,
  `isSeen` toujours vrai ; l'atlas peint toute la planète par climat, `wholeMap`, et on peut dézoomer jusqu'à la voir
  en entier, `ZMIN_DEV`) et **Remise à zéro** (confirmée, nouvelle partie).
- **Version** affichée en bas à gauche du jeu (`v<package> · <commit> · <date>`, posée au build par
  `vite.config.ts`) : pour savoir d’un coup d’œil si un téléphone a la dernière version.
