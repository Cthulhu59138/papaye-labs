# API privée Papaye

Node.js 22.19+ avec `node:sqlite`, sans dépendances externes. Le frontend et les applications sont servis par GitHub Pages ; seuls l’authentification et les données privées résident ici.

## Exploitation sur l’ASUS

- Compte système : `papaye-api`, sans shell. Écoute : `127.0.0.1:5293`.
- Code et runtime : `/opt/papaye-api/`. Configuration : `/etc/papaye-api/config.json`, groupe du service, mode 640.
- SQLite : `/var/lib/papaye-api/catalogue.sqlite`, dossier mode 700 ; sauvegardes dans `backups/`.
- Exposition choisie : HTTPS Tailscale Funnel sur 8443. Ne jamais réinitialiser Tailscale Serve ou modifier le port 443 dans ce chantier.
- `GET /health` ne renvoie aucune donnée privée. `/api/me` indique uniquement l’état d’authentification/configuration. Toutes les données projets et tâches exigent un bearer valide ; les mutations exigent aussi Origin exact et CSRF.

`install-asus.sh RUNTIME PRIVATE_IMPORT PRIVATE_RESULT` réalise une première installation et refuse toute base/configuration existante. Le résultat privé contient le lien d’activation à usage unique si aucun compte n’est importé. `verify-install-asus.sh` vérifie permissions du runtime, démarrage, accès refusés, sauvegarde/restauration, puis demande l’activation du listener Funnel 8443.

## Sauvegarde, migration et retour arrière

Avant toute mise à jour, sauvegarder la base avec le runtime installé et `backup.mjs backup SOURCE NEW_TARGET`. La commande utilise l’API SQLite, y compris les données du WAL, et refuse d’écraser une destination. `backup.mjs verify SOURCE` contrôle intégrité et clés étrangères.

Pour restaurer : arrêter le service, employer `backup.mjs restore BACKUP NEW_DATABASE`, vérifier ce nouveau fichier, puis mettre à jour `database` dans la configuration protégée. Conserver l’ancienne base ; ne jamais remplacer seulement son fichier principal pendant que le service fonctionne. Redémarrer et contrôler santé, authentification et données. Une restauration revient aussi à l’état des comptes/sessions de la sauvegarde : révoquer les sessions si nécessaire.

`database.mjs` migre automatiquement le schéma à l’ouverture, de façon versionnée et transactionnelle. Ne pas ouvrir une base de production avec une nouvelle version avant sauvegarde. Une version de schéma plus récente est refusée. Pour un rollback de code, utiliser le code correspondant à la sauvegarde restaurée ; conserver le portail privé (aucun retour vers un catalogue public).

## Import

`admin.mjs initialize CONFIG DATABASE PRIVATE_IMPORT` importe les projets avec leurs identifiants/révisions, sans remplacer une ligne divergente. Les champs de visibilité legacy ne deviennent jamais des permissions de l’application. Le catalogue et le compte doivent être exportés depuis leur source la plus récente ; les sessions existantes ne sont pas transférées entre services.

Le statut public est reconnu seulement pour les trois applications validées sous papaye-labs.fr. Une nouvelle adresse reste « À vérifier » tant qu’elle ne fait pas partie des applications contrôlées. Modifier ce statut ne saurait désactiver l’authentification d’une application externe.

## Tests

`node --test server/test/*.test.mjs test/admin-cli.test.mjs test/backup-cli.test.mjs`. Les tests HTTP nécessitent une écoute sur loopback. Aucune base de production n’est utilisée par les tests. Les jeux de données fictifs de `scripts/preview.mjs` ne sont jamais inclus dans le build.
