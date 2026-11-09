# Papaye Labs — sélection publique

Accueil sur https://papaye-labs.fr/. Le tutoriel Scoubi Club est intégré à `/scoubi/`, sans compte ni connexion ChatGPT. Les animations, couleurs et sauvegardes de progression fonctionnent dans le navigateur. Les sauvegardes de l’ancienne adresse Sites ne sont pas transférées entre origines. La version publique emploie un texte générique, sans prénom personnel.

## Catalogue public et espace privé

La page charge seulement les projets sélectionnés par le propriétaire depuis le service déclaré dans `catalog.config.json`. Aucun inventaire GitHub n’est envoyé à un visiteur anonyme. La sélection est stockée côté serveur ; `projects.json` conserve les deux fiches publiques de référence mais n’est plus injecté comme catalogue de secours.

Dans **Espace privé**, la connexion GitHub du propriétaire donne accès aux projets, à la synchronisation GitHub et aux boutons **Afficher publiquement / Retirer du public**. Les nouveaux projets sont privés par défaut. On peut ajouter un lien et modifier son nom, son adresse et sa description. Les dépôts sans site restent accessibles depuis cette vue par leur lien GitHub.

La connexion ne change pas les droits des applications lancées. Un lien privé ne rend pas son application publique. Scoubi Club est la copie autonome expressément demandée ; l’ancienne version Sites reste inchangée.

Le navigateur public ne garde pas de cache de projets : un retrait ne doit pas être annulé par une ancienne copie. Si le service est indisponible, la page affiche un message et propose de réessayer. Le service distingue l’API publique des routes authentifiées. Les sources du serveur et sa configuration de secrets sont gérées séparément du dépôt public.

## Développement et publication

Node.js 22, sans dépendance : `npm run check` exécute les tests et construit `dist/`. Aperçu : `python -m http.server 4191 --bind 127.0.0.1 --directory dist`.

Le workflow GitHub Actions publie `dist/` après chaque push de main et vérifie les PR sans déployer. Avant publication, vérifier aussi l’API publique et les écrans public/privé ; le frontend dépend de la disponibilité de ce service. Retour arrière par `git revert`.

Le domaine canonique est papaye-labs.fr. Conserver le TXT de vérification de propriété, les A/CNAME GitHub Pages et la messagerie. Le certificat du domaine fait l’objet d’un suivi distinct ; ne pas contourner les contrôles TLS.

## Scoubi Club

Textes, dessins SVG et animations propres au projet. Maillage rond à quatre brins, méthode séquentielle inspirée de [la méthode du carton](https://lartdesscoubidous.com/techniques-de-base/technique-du-carton-4-fils/) et du [maillage rond](https://lartdesscoubidous.com/techniques-de-base/maillage-rond-4fils/). Le coin des grands explique les limites des schémas. Accompagnement adulte pour les nœuds et les ciseaux ; voix facultative selon l’appareil.
