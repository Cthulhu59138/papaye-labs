# Papaye Labs — sélection publique

Accueil sur https://papaye-labs.fr/. Le tutoriel Scoubi Club est intégré à `/scoubi/`, sans compte ni connexion ChatGPT. Les animations, couleurs et sauvegardes de progression fonctionnent dans le navigateur. Les sauvegardes de l’ancienne adresse Sites ne sont pas transférées entre origines. La version publique emploie un texte générique, sans prénom personnel.

## Catalogue public et espace privé

La page charge seulement les projets sélectionnés par le propriétaire depuis le service déclaré dans `catalog.config.json`. Aucun inventaire GitHub n’est envoyé à un visiteur anonyme. La sélection est stockée côté serveur ; `projects.json` conserve les deux fiches publiques de référence mais n’est plus injecté comme catalogue de secours.

Dans **Espace privé**, un compte Papaye indépendant (identifiant et mot de passe) donne accès aux projets et aux boutons **Afficher publiquement / Retirer du public**, sans connexion GitHub ni ChatGPT. Les dépôts publics GitHub sont repérés sans jeton à l’ouverture de l’espace connecté ou avec **Actualiser les projets** ; les nouveaux projets restent privés par défaut. Les liens des autres projets s’ajoutent manuellement. On peut modifier leur nom, leur adresse et leur description. Les dépôts sans site restent accessibles depuis cette vue par leur lien GitHub. La connexion peut être conservée 30 jours sur un appareil choisi.

La connexion ne change pas les droits des applications lancées. Un lien privé ne rend pas son application publique. Scoubi Club est la copie autonome expressément demandée ; l’ancienne version Sites reste inchangée.

Le navigateur public ne garde pas de cache de projets : un retrait ne doit pas être annulé par une ancienne copie. Si le service est indisponible, la page affiche un message et propose de réessayer. Le service distingue l’API publique des routes authentifiées. Les sources du serveur et sa configuration de secrets sont gérées séparément du dépôt public.

## Développement et publication

Node.js 22, sans dépendance : `npm run check` exécute les tests et construit `dist/`. Aperçu : `python -m http.server 4191 --bind 127.0.0.1 --directory dist`.

Le workflow GitHub Actions publie `dist/` après chaque push de main et vérifie les PR sans déployer. Avant publication, vérifier aussi l’API publique et les écrans public/privé ; le frontend dépend de la disponibilité de ce service. Retour arrière par `git revert`.

Le domaine canonique est papaye-labs.fr. Conserver le TXT de vérification de propriété, les A/CNAME GitHub Pages et la messagerie. Le certificat du domaine fait l’objet d’un suivi distinct ; ne pas contourner les contrôles TLS.

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
