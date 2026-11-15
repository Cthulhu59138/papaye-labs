# Papaye Labs — contrat de réalisation, 15 novembre 2026

Mission acceptée : accueil privé, suivi complet dans Papaye, applications publiques par URL simple. Pas de synchronisation Notion, pas de nouvelle marque. Les sources publiques ne contiennent aucune donnée privée. Le coordinateur gère import, configuration, publication et mémoire. Backend et frontend ont des propriétaires distincts.

## API

Base HTTPS fournie par `portal.config.json` (`apiBase` sans slash final). Développement même origine possible par configuration, aucune URL privée de développement au build production.
Auth existante : POST `/api/login` {login,password,remember}, POST `/api/setup/check` {token}, POST `/api/setup` {token,login,password,remember}, GET `/api/me`, POST `/api/logout`, POST `/api/password` {currentPassword,password,remember}. Les réponses login/setup/password contiennent {authenticated,configured,login,csrf,sessionToken,expiresAt}. Authorization Bearer pour toutes les routes privées, X-CSRF-Token pour les mutations. Erreurs JSON {error}, 401 session absente, 409 conflit de révision. Aucun catalogue anonyme.

Project : {id,name,description,url,source,sourcePrivate,revision,status,dueDate,notes,archived,accessStatus,updatedAt}. Dates `YYYY-MM-DD` ou null. `status` : À qualifier, Idée, En préparation, En cours, En pause, Terminé. `accessStatus` : public, protected, unknown. Trois URL publiques reconnues côté serveur : https://papaye-labs.fr/scoubi/, https://papaye-labs.fr/malomatix/, https://papaye-labs.fr/explorateurs/. Les autres URL restent unknown/protected ; ce champ ne modifie jamais un hébergement. Notes texte <= 8000 caractères, nom <=100, description <=600. URL facultative pour projets de suivi ; HTTPS sans identifiants si renseignée. Source facultative.

GET `/api/projects` => {projects}, GET `/api/projects/:id` => {project}. POST `/api/projects` {name,description,url,source,status,dueDate,notes} => 201 {project}. PATCH `/api/projects/:id` {revision,...champs modifiés} => {project}. Archivage/restauration via archived booléen ; pas de suppression de projets.

Task : {id,projectId,title,status,dueDate,revision,createdAt,updatedAt}. Statuts À faire, En cours, Terminé ; titre 1..200 caractères. GET `/api/tasks` => {tasks} (toutes pour calcul local, y compris archives), GET `/api/projects/:id/tasks` => {tasks}. POST `/api/projects/:id/tasks` {title,status,dueDate} =>201 {task}. PATCH `/api/tasks/:id` {revision,title?,status?,dueDate?} => {task}. DELETE `/api/tasks/:id` {revision} => {ok:true}. Refuser les mutations de tâches d'un projet archivé, conserver toutes les tâches lors archivage. API compte unique sans données utilisateur tierces.

## Interface

Avant session valide : connexion uniquement. sessionStorage 12h par défaut, localStorage uniquement si rester connecté 30j ; aucune mise en cache des données. Après 401, purge DOM et état suivi, conserver seulement le brouillon en mémoire pour reconnexion. Déconnexion explicite confirme abandon des modifications puis purge tout. Contrôle de session au retour onglet/bfcache ; ne pas faire réapparaître des données après déconnexion.
Navigation Vue d'ensemble / Projets / Tâches. Projets archivés dans filtre dédié ; tâches archives exclues vue active. Avancement tâches terminées/total, sans faux pourcentage si vide. Statut projet manuel. Dates sans heure, comparaison jour Europe/Paris. Création, édition, notes, archive/restauration, tâches, recherche/filtres, erreurs/réessai et 409 sans perte silencieuse. Boutons ouvrir et copier lien public distincts, copier seulement accessStatus public. Pas d'UI publication fictive.
Style : marque textuelle actuelle, fond clair chaud, texte sombre, orange accessible, police système ; pas de 3D/motifs abstraits. Mobile, clavier, focus, labels, erreurs, préférence mouvement réduit. /prive/ alias vers / préservant fragment activation.

## Livraisons et validation

Frontend propriétaire public/index.html, public/style.css, public/dashboard*.mjs, public/prive/index.html et test/dashboard*. Backend propriétaire server/{portal,http,database,password,schema} et server/test. Coordinateur : scripts build, configuration, import, install/service/backup docs, Explorateurs et publication. Pas d'écrasement du travail des autres. Tests réels auth, CRUD, concurrence, migration, persistance, archivage et texte malveillant ; recette UI par navigateur si disponible. Aucun profil ni sauvegarde réelle dans public/.
