# Recette du tableau de bord — 15 novembre 2026

## Vérifié sur cette réalisation

- Tests Node : authentification (activation, mot de passe, sessions, CSRF, origine, limites), validation des projets/tâches, conflits de révision et archivage ; migration SQLite, intégrité, persistance et restauration. Test HTTP réel exécuté hors bac à sable pour permettre l’écoute locale.
- Tests frontend : 9 règles métier, 3 cas de gel de formulaire/snapshot et 5 cas de confirmation accessible, dont un événement de fermeture ancien reçu après ouverture d’une nouvelle confirmation. Les modules et le build passent ; `git diff --check` sans erreur.
- Tests CLI ajoutés après revue indépendante : restauration d’un WAL non checkpointé sans perte ; refus d’imports divergents sans écrasement. Ces défauts ont été corrigés avant installation.
- Régressions Explorateurs et Malomatix vérifiées par les suites existantes. Les assets Explorateurs sont copiés depuis la livraison existante, sans données de joueur.
- Import privé de préparation : 8 projets conservés après sauvegarde/restauration et contrôle d’intégrité. Aucun compte existant dans la source au contrôle initial ; aucun mot de passe utilisateur créé par l’agent.
- Navigateur local avec base et compte fictifs : connexion, nouveau projet, statut, notes contenant du texte HTML affiché sans exécution, tâche datée, tâche terminée et avancement 1/1, copie exacte de l’URL publique, archivage/restauration avec conservation des notes et tâches, déconnexion puis rechargement sans donnée privée dans le DOM.
- Affichages examinés à 1280 × 900 et 390 × 844 ; largeur du document mobile égale à la largeur disponible (390 px). Compte et déconnexion accessibles sur mobile. Confirmation HTML avec focus initial Annuler.

## Installation

Service dédié `papaye-api`, données hors dépôt et hors GitHub Pages. L’API répond après redémarrage ; routes privées anonymes refusées (401), ancien catalogue anonyme absent (404). Une sauvegarde, une restauration dans un nouveau fichier et leur intégrité ont été contrôlées sur l’installation réelle.

Au stade de cette note : activation Tailscale Funnel par le propriétaire et publication GitHub Pages encore en cours. Les contrôles de production seront ajoutés au bilan après résultat observé. L’application locale de recette ne démontre pas à elle seule la disponibilité du domaine public.

## Reprise

`npm run check` lance les tests et le build. `node scripts/preview.mjs` fournit une recette locale isolée sur 127.0.0.1:4175, avec compte fictif documenté au démarrage. Ne pas utiliser ce serveur de recette pour héberger les données réelles. Le compte de production s’active par lien personnel à usage unique ; ne jamais enregistrer ce lien dans Git ou dans Notion.
