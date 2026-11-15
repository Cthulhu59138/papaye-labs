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

Funnel activé par le propriétaire le 15 novembre 2026. Seul HTTPS 8443 est public et relaie l’API locale 5293 ; le Serve 443 reste privé. Vérifications HTTPS via le relais public Funnel : santé et état du compte à 200, projets anonymes refusés (401), ancien catalogue public absent (404), prévol CORS du domaine Papaye accepté (204), origine étrangère refusée (403). L’activation personnelle a été contrôlée à 200 sans créer le mot de passe utilisateur.

PR 5 fusionnée : `983c95375b7706008594e1bc96ab848c1e7fbcb0`. [Déploiement GitHub Pages réussi](https://github.com/Cthulhu59138/papaye-labs/actions/runs/43733862856). Accueil privé publié sur https://papaye-labs.fr/ ; Scoubi Club, Malomatix et Les Petits Explorateurs accessibles sans compte. Images Explorateurs chargées, progression de départ vide. L’ancien portail Sites est réservé à son propriétaire, avec zéro visiteur externe et aucun groupe.

Le navigateur habituel du propriétaire a confirmé que le tableau de bord joint l’API. Après transmission du lien personnel, l’API confirme le compte créé (`configured: true`, contrôle du 15 novembre à 18 h 15 UTC). Aucun identifiant ni mot de passe n’a été saisi par l’agent. Le navigateur intégré de recette a rencontré des délais sur les appels entre domaines, malgré des accès directs réussis : il n’a pas servi à valider le parcours authentifié de production. Les parcours complets de suivi sont validés sur la base locale de recette ; l’affichage du tableau réel reste à confirmer par le propriétaire.

## Reprise

`npm run check` lance les tests et le build. `node scripts/preview.mjs` fournit une recette locale isolée sur 127.0.0.1:4175, avec compte fictif documenté au démarrage. Ne pas utiliser ce serveur de recette pour héberger les données réelles. Le compte de production s’active par lien personnel à usage unique ; ne jamais enregistrer ce lien dans Git ou dans Notion.
