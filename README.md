# Papaye Labs — tableau de bord privé

https://papaye-labs.fr/ est l’entrée du tableau de bord personnel, avec un compte Papaye indépendant. Avant connexion, aucun catalogue, compteur, projet, tâche ou note n’est chargé. `/prive/` reste un alias de l’accueil.

## Suivi et partage

Vue d’ensemble, Projets et Tâches : recherche, statuts, échéances facultatives, notes privées, avancement calculé et archivage réversible. Les données résident dans SQLite sur l’ASUS ; aucune synchronisation de suivi avec Notion. Les synthèses d’intervention restent gérées séparément.

L’application d’un projet peut être ouverte séparément. Le bouton Copier le lien public n’est disponible que pour les adresses vérifiées sans compte : `/scoubi/`, `/malomatix/`, `/explorateurs/`. Une fiche de projet ou son archivage ne change jamais les permissions du site cible. Les autres applications conservent leurs protections.

Les Petits Explorateurs est une copie autonome de la livraison familiale, avec 40 cartes et 90 photographies locales créditées. Son ancien site privé reste distinct. Les progrès sont propres au navigateur et à l’origine ; utiliser l’export/import du jeu pour les transférer. Aucune sauvegarde personnelle n’est publiée.

## Architecture et développement

Frontend statique sans dépendances, backend Node.js/SQLite isolé sur l’ASUS. `portal.config.json` contient seulement l’origine HTTPS de l’API, jamais un secret. Les réponses privées ne sont pas mises en cache ; l’interface est purgée après déconnexion ou expiration. Sessions de 12 heures par défaut, 30 jours si Rester connecté est choisi explicitement.

`npm run check` teste puis construit un `dist/` neuf. Le workflow GitHub Actions vérifie les PR et publie après mise à jour de main. `node scripts/preview.mjs` sert une recette locale isolée avec compte fictif. Ne pas le confondre avec le service de production.

Le domaine canonique et les chemins des jeux existants sont conservés. Voir [contrat](docs/DASHBOARD-CONTRACT.md), [recette](docs/RECETTE-DASHBOARD.md) et [exploitation API](server/README.md). L’ancien catalogue public Sites est remplacé ; aucun inventaire ni secret ne doit être ajouté aux fichiers statiques.

## Scoubi Club

Textes, dessins SVG et animations propres au projet. Maillage rond à quatre brins, méthode séquentielle inspirée de [la méthode du carton](https://lartdesscoubidous.com/techniques-de-base/technique-du-carton-4-fils/) et du [maillage rond](https://lartdesscoubidous.com/techniques-de-base/maillage-rond-4fils/). Le coin des grands explique les limites des schémas. Accompagnement adulte pour les nœuds et les ciseaux ; voix facultative selon l’appareil.

## Malomatix — bêta web jouable

`/malomatix/` est une application web statique : huit mini-jeux adaptés des
règles Android J8, jouables au clavier et au toucher. Aucun APK ni installation
n'est nécessaire. La fiche de référence est conservée dans `projects.json` ;
son affichage sur l'accueil se règle dans la sélection publique du service.

- Comparer (plus, moins, autant), Flash, Calcul (addition ou soustraction),
  Suites, Puzzles, Fabrique des dizaines, Petit marché et Robot jardinier.
- Cinq manches par partie, aide facultative, correction et carnet de souvenirs.
- Deux profils anonymes, trois ambiances et reprise des parties locales.
- Aucun compte, publicité, outil de suivi ou appel à une API dans le jeu.

Les données restent dans `localStorage`, clé `papaye.malomatix.web.v1`.
Le schéma est validé à la lecture ; un stockage indisponible est signalé.
Les sauvegardes web et Android sont distinctes. Le code parent et les variantes
Android avancées ne sont pas reproduits : le profil adulte web est accessible
librement. Une connexion est nécessaire au chargement ; pas de garantie hors ligne.
Cette bêta web 0.1 n'est pas une conversion binaire de l'APK.

`engine.mjs` porte la génération et les transitions pures ; `storage.mjs` valide
et sauvegarde les profils ; `views.mjs` et `art.mjs` rendent l'interface et les
illustrations SVG ; `app.mjs` orchestre les interactions, focus et animations.
Flash est interrompu proprement si l'onglet devient invisible. Les animations
Robot ne décident pas du résultat et respectent la préférence de mouvement réduit.

`npm run check` inclut 800 sessions générées des huit jeux, les échanges de
quantités, les paiements alternatifs, collisions/chemins du robot, rechargement,
récompense unique et rejet d'états invalides, en plus des tests du catalogue.
Les essais sur émulateur Android ne remplacent pas les contrôles de cette version web.

Le code JavaScript web de ce dépôt est public ; le projet Android reste distinct.
La publication APK initialement envisagée a été remplacée par le jeu en ligne
à la demande d'Adrien le 9 novembre 2026. Les liens APK ne sont pas affichés.
