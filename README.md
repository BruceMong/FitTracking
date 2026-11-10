# FitTracking

Carnet de musculation personnel (anciennement « carnet ») : une PWA sans framework ni build (une page, un script, un
service worker) pour noter ses séries au téléphone, à la salle, même sans réseau.

- **Données** : une base Supabase, fermée. Des fonctions SQL (`carnet_lire`, `carnet_ecrire`,
  `carnet_depuis`, `carnet_contexte`, `carnet_photo_deposer`, `carnet_photos_prendre`,
  `carnet_photos_effacer`, `carnet_montre_publier`, `carnet_montre_appuis`) vérifient une clé secrète
  dont la base ne garde que l'empreinte. La clé publiable inscrite dans `app.js` ne donne accès à rien
  sans elle. Deux autres fonctions (`carnet_montre_plan`, `carnet_montre_appui`) sont réservées à
  l'appli de la montre, qui a sa propre clé, distincte de celle du carnet : elle ne lit que le plan du
  jour et n'écrit que ses appuis (tests : `supabase/tests/lancer.sh`).
- **Clé** : posée une fois sur le téléphone par un lien `…/#cle=…` (QR code affiché par
  `carnet-sync --lien` sur le PC), gardée dans le `localStorage`, retirée de l'adresse.
- **Hors ligne** : chaque série est enregistrée sur le téléphone d'abord, envoyée ensuite,
  renvoyée au retour du réseau.
- **Le PC** (`carnet-sync`, dépôt arch-config) récupère les séances pour son suivi et pousse le
  « contexte » : séance du jour selon la rotation push / pull / legs, dernière fois et cible de
  chaque exercice (double progression), conseil d'intensité tiré de la montre.

- **Santé** (en sections repliables : Aujourd'hui avec le ressenti, la douleur à l'épaule, le poids, les photos et le repas, puis rapport, objectifs et courbes, repliées par défaut) : les données de la montre et les calculs du panneau Santé du PC — alertes, dernière nuit
  (durée, horaires, phases, score), VFC, FC au repos, Body Battery, stress, SpO2, respiration, semaine en
  cours (pas, séances, minutes intensives), dette et régularité du sommeil, ressenti noté, objectifs, et
  les courbes sur 30 ou 90 jours (poids, sommeil, VFC, FC, Body Battery, stress, pas, coucher).
- **Ce que le panneau Santé permet de noter, au téléphone aussi** (onglet Santé) : ressenti du jour
  (énergie, humeur, peau), note du jour, routine du jour, objectifs sportifs. Chaque geste part daté avec
  la séance du jour ; le PC l'écrit dans journal.md ou objectifs.md comme le panneau, une seule fois, et
  un geste plus ancien que le dernier appliqué pour la même case est ignoré.
- **Repas** (onglet Santé) : « Photo du repas », avec une précision facultative. La photo part au PC comme les photos
  de suivi ; `carnet-sync` la fait estimer par Claude (calories, protéines, glucides, lipides, plat par plat) et renvoie
  le total du jour face aux cibles d'objectifs.md, le détail de chaque repas et les 7 derniers jours. ±20-30 %.
- **Fiches d'exercice** : « Fiche de l'exercice » (menu ⋯ de la vue Exercice) ouvre la machine en photo (départ, arrivée), son nom
  anglais, les muscles, trois consignes, l'erreur à éviter et le mémo de réglage. Textes dans `fiches.js`
  (clé = nom exact de `sante/sport/exercices.md`), photos de free-exercise-db (domaine public) dans
  `fiches/`, mises en cache à l'installation pour marcher sans réseau.
- **Fiches de soin** : le « i » à côté des cases de peau de la routine du jour (soin du matin, du soir, exfoliant)
  ouvre le geste en détail : étapes, quantités, temps, astuces, à éviter. Textes dans `fiches.js` (`SOINS`, clé = clé de
  la case envoyée par `carnet-sync`), tirés de `sante/peau/README.md`. Tant que le gel nettoyant est à acheter, l'étape 1
  dit eau tiède.
- **Barre d'onglets** : Séance, Santé, Progrès, Musique, fixe en bas de l'écran (56 px, cible tactile pleine).
- **Séance, deux vues** : l'onglet s'ouvre sur la vue **Exercice** (voir plus bas), ☰ bascule sur la **Liste** (une carte
  allégée par exercice : nom, dernière fois, mémo, cible, pastilles de séries ; un toucher sur la carte ouvre l'exercice).
  « Ajouter un exercice » est en bas de la Liste.
- **Pastilles et feuille de série** : chaque série est une pastille (faite, prévue, échauffement). La toucher ouvre une
  feuille collée en bas : charge et répétitions en − / + (ou tapées), réserve 0 à 4+, « Retirer la série ». Une série
  faite se corrige donc en place, même pendant le repos (la pastille passe sur une ligne sous le titre).
- **Menu ⋯ de l'exercice** : fiche, remplacer, + une série, + échauffement, superset avec le partenaire, compter en
  secondes ou en répétitions (sans charge), hors progression (sauf si toute la séance l'est), mémo, note. Pendant le repos,
  le ⋯ porte sur l'exercice annoncé ensuite (sur celui qui vient de finir en fin de séance).
- **Échauffement** : « + échauffement » ajoute une ligne `é` (la moitié de la charge × 10, puis les trois quarts × 5),
  repos d'une minute. Gardé à part (`ech`), écrit entre parenthèses dans seances.md : hors volume, récupération et cible.
- **Hors progression** : un exercice, ou toute la séance, un jour de douleur ou sans forme. Compté pour le volume et la
  récupération, pas pour la cible, les records ni les courbes (`(hors progression)` dans seances.md, lu par le panneau).
- **Superset** : désactivé par défaut. Pour un exercice qui a un partenaire dans `programme.md`, « Superset avec X » (menu ⋯,
  aussi pendant le repos) l'active pour la journée : une série de chacun, puis 120 s de repos.
  « Sans superset » pendant l'enchaînement, ou la même case décochée, coupe la paire. Gardé par jour sur le téléphone.
- **Remplacer** (machine prise) : les exercices du même muscle d'abord ; le remplaçant prend la place dans la séance.
- **Bilan de la séance** (sous les exercices) : chaque exercice face à la dernière fois (↑ = ↓), la cible de la
  prochaine séance tirée de la même règle, les records battus, séries et durée.
- **Jour excusé** : sans séance, « malade · voyage · blessure · fatigue · autre » et un mot ; `carnet-sync` l'écrit dans
  `sante/sport/excuses.md`. Le jour ne compte pas comme manqué (jambes il y a N jours, série de semaines), hachuré au calendrier.
- **Pendant la séance** : avancement (séries faites sur prévues, durée), séries restantes en pointillé à la
  charge prévue ; le muscle et le record sont dans la vue Exercice. Sous le minuteur de repos, « Combien tu aurais
  pu en faire de plus ? » (0 à 4+, facultatif) : la réserve est écrite `@N` dans seances.md. L'écran clignote à la fin du
  repos ; carnet en arrière-plan, une notification la signale (service worker, sans serveur, repos de 5 min au plus).
  Dans la Liste, le repos tient sur une ligne (exercice, chrono, Passer) au-dessus de la barre d'onglets. Glisser une série
  vers la gauche la retire (Annuler), vers la droite la recopie. Changer le type du jour (Push, Pull, Legs) après des
  séries notées demande un second toucher (3 s).
- **Cible** : double progression, comme le panneau ; deux crans si tout est tenu avec 3 en réserve ; trois
  séances sans progrès : décharge à −10 % signalée par le PC, puis on remonte.
- **Récupération par muscle** : 8 séries difficiles font une dose, effacée de moitié en 24 h (bras, épaules),
  30 h (pecs, dos) ou 48 h (jambes) ; sous 25 % prêt, sous 50 % presque. Même calcul que le panneau
  (`herdr-sante`, `recuperation`), d'après le modèle d'openGym. Le PC envoie les doses des 7 derniers jours,
  le téléphone y ajoute sa séance du jour.
- **Silhouette** (Progrès) : séries de la semaine par muscle ou récupération, sur les tracés de
  [MuscleMap](https://github.com/melihcolpan/MuscleMap) (licence MIT, reproduite en tête de `corps.js`). Et
  l'équilibre tirer / pousser sur 4 semaines (posture, épaule droite).
- **Progrès** : calendrier des séances sur 26 semaines et série de semaines tenues (3 séances, un jour excusé compte),
  séries par semaine, courbes de chaque exercice (1RM estimé, charge, et série par série : une ligne par numéro de série,
  pour voir celle où l'on décroche), douleur à l'épaule, allure de course. Silhouette en trois modes : volume,
  récupération, muscles négligés (jours depuis la dernière série). Santé : le poids en moyenne par semaine.
- Les courbes sont en SVG écrit à la main, sans bibliothèque, pour marcher hors ligne.
- **Vue Exercice** (vue d'ouverture de la Séance ; c'était le « grand format » facultatif du 2026-11-06) : tout le menu de série en plein écran, pour le lire et le toucher dans
  une fenêtre réduite, à côté d'une autre appli. Reste active de repos en repos ; ☰ passe à la Liste, un toucher sur une carte
  en revient (pendant un repos, sur l'écran du repos), comme la ligne de repos des autres onglets. Quatre états : `repos` (toute la fenêtre
  sert de jauge, verte dans les 10 dernières secondes), `fini` (clignote en vert à 1 Hz, fixe après 90 s ou si l'animation est
  réduite), `serie` (− / + et « Série faite »), `fin` (dernier exercice de la séance). Entre deux exercices, pas d'arrêt : à la dernière série, le
  repos de transition (2:00) part tout seul et l'écran annonce déjà le suivant, dans l'ordre du programme ; « + une série » reste sur
  l'exercice, et ‹ › en choisit un autre si la machine est prise. Une série
  notée ici est une série comme une autre. Les tailles suivent la fenêtre, et les paliers de hauteur (620, 430, 340, 300, 240 px)
  retirent le secondaire. Tester : jamais sur le port 9333 (ZapZap) ni 9222 (Chrome de Bruce).
- **Montre** (réglage « Valider depuis la montre », onglet Séance, depuis le 2026-11-07) : à la fin de chaque repos, la
  notification devient « Go · exercice », la série prévue et un bouton **Série faite**, envoyée même carnet à l'écran. La
  montre (Garmin, Android) la relaie ; le bouton passe par le service worker (`notificationclick`), qui prévient la page
  (`depuisMontre`) ou la rouvre (`#montre=`). Une série déjà notée au téléphone n'est pas notée deux fois (`idSerie`). En
  superset, la notification part tout de suite pour le partenaire ; la dernière série d'un exercice enchaîne sur le suivant.
  Le carnet endormi (téléphone en veille) ne reçoit le message qu'au réveil : l'appui est gardé en file (cache `carnet-montre`), relu
  à chaque retour au premier plan ; sans accusé de réception sous 2 s, le service worker ramène le carnet au premier plan. Une
  notification « ✓ Série notée » confirme sur la montre, et le journal des échanges s'affiche sous le réglage.
- **Appli montre** (Connect IQ, Venu 3) : le carnet calcule le plan restant du jour (exercices, charges, séries, repos,
  supersets) et le publie (`carnet_montre_publier`, republié à chaque changement, échauffement compris). L'appli le déroule
  seule, lance le repos, vibre à la fin, et envoie chaque appui (`carnet_montre_appui`, avec sa propre clé). Au réveil, le
  carnet intègre les appuis (`carnet_montre_appuis`, curseur `carnet:montre-appui`) : garde `m` = id de l'appui (jamais deux
  fois), garde de rang (« déjà noté » si la série existe), heure de la série = heure de l'appui. Le repos du téléphone
  s'aligne sur celui de la montre, sans notification de fin. La saisie du jour est gardée par jour (`carnet:saisie:<jour>`),
  pour survivre au rechargement. Le chemin par notification ci-dessus reste valable.
- **Dans l'APK : la montre en direct** (Chrome inchangé : tout passe par le plugin `Montre`, `pont.js`, refusé hors de
  l'APK ; sans pont ni montre présente, rien ne part). **Envoyé** par le Bluetooth, un message par clé (le plus récent
  remplace l'ancien) : le `repos` avec son heure de fin **absolue** (la montre compte seule, rien à renvoyer à chaque
  seconde) et le `plan` **compact** (≈ 950 o pour 30 étapes contre 6 Ko au format verbeux : le Bluetooth Garmin passe ~450
  o/s ; la montre rebâtit `id`, `quoi` et le texte), republiés à chaque changement et, forcés, quand la montre dit
  « bonjour » ou se reconnecte. **Reçu** : les gestes de la montre (appui, annuler, ±15 s, pause, passer, réglage de
  charge ou de reps, réserve, + une série, changement d'exercice), gardés dans une file que le carnet relit à chaque
  message et au retour à l'écran, puis acquitte. Garde par numéro de geste (`carnet:montre-dg`) : jamais deux fois ; un
  geste s'applique **à l'heure du geste** (`ts`), pas à celle de la lecture. **Fin de repos** : le pont programme la
  notification native (`programmerFin`) seulement si la montre est absente (aucun message depuis 75 s) et la page cachée ;
  montre présente, c'est elle qui vibre. **Coller la clé** : sans lien `#cle=` à scanner, l'accueil de l'APK a un champ
  « Clé du carnet » (`collerCle`, 16 caractères au moins, le serveur juge). La route v1 (`carnet_montre_publier` au
  format verbeux, `carnet_montre_appuis`) reste : c'est elle qui sert hors APK et quand le pont est absent.
- Tests : `TZ=Europe/Paris node --test test/*.test.mjs`
- **Série ratée** : sous la cible, la question de la réserve dit « 4 sur 6 » et 0 devient « échec ». Sous la cible, la charge
  reste et la série la plus faible vise +1, quelle que soit la raison ; la réserve dit si c'était l'échec ou un arrêt avant.
- **Rapport sport** (onglet Santé, depuis le 2026-11-05) : le rapport que Claude écrit chaque dimanche sur le PC
  (`sante-rapport`), poussé dans le contexte (`ctx.rapports`, les 12 derniers, en markdown). La carte montre « En bref »
  et les indicateurs face au rapport d'avant ; « Lire le rapport » déplie le reste ; les dates ouvrent les précédents.
  Rendu markdown restreint, fait main (`md()`), tout échappé.
- **Base** : schéma dans `supabase/schema.sql` (tables, fonctions, comment recréer le projet). Sauvegarde hebdomadaire
  sur le PC par `carnet-sauvegarde` (dépôt arch-config).
- **Photos de suivi** : redimensionnées sur le téléphone (1280 px, JPEG), déposées dans une table de
  transit ; le PC les range dans son dossier puis les efface de la base.

Publié par GitHub Pages depuis `main` : https://brucemong.github.io/FitTracking/ (le dépôt s'appelait `carnet`
jusqu'au 2026-10-16). Les noms internes gardent « carnet », pour ne rien perdre : clés du `localStorage`
(`carnet:*`), fonctions et base Supabase (`carnet_*`), `carnet-sync` côté PC.
