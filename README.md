# Papaye Labs

Accueil public des projets Papaye Labs, prévu sur https://papaye-labs.fr/.
HTML et CSS statiques, sans dépendance à installer ni données utilisateur.
Un module JavaScript facultatif actualise le catalogue depuis GitHub.

L’accueil est un tableau de lancement compact : applications et boutons d’accès
direct avant les ressources techniques. Les raccourcis permanents restent utilisables
sans JavaScript, y compris MémoQuest et Scoubi Club.

## Construire

Avec Node.js 22 :

```sh
npm run build
```

Les fichiers publiables se trouvent dans `dist/`. Pour les prévisualiser avec
Python : `python -m http.server 4174 --bind 127.0.0.1 --directory dist`.

## Ajouter un projet

Modifier `projects.json` : identifiant unique, nom, catégorie, description,
adresse HTTPS, dépôt source et étiquettes. Puis exécuter `npm run check`.
Ces raccourcis sont insérés dans le HTML pendant la compilation. Leurs titres,
descriptions et adresses sont publics. Une application privée peut être référencée
sur demande explicite, avec une mention claire : son propre contrôle d’accès demeure.
Scoubi Club est hébergé sur Sites et demande la connexion ChatGPT autorisée ; son
contenu et ses droits n’ont pas été modifiés par l’ajout du raccourci.

Champs facultatifs : `shortName` (1 à 3 caractères pour l’icône), `status`
(plateforme ou stade de diffusion) et `ctaLabel` (action du bouton).
`source` peut être omis si le code d’une application n’est pas public.
Le nombre d’applications est calculé à la compilation. Les grandes illustrations
et textes de présentation ne font pas partie de l’accueil opérationnel.

## Catalogue qui suit GitHub

À l’ouverture, `public/catalog-ui.mjs` consulte l’API publique GitHub du compte
défini dans `catalog.config.json`. Un dépôt est ajouté s’il appartient à ce compte,
est public, actif, non archivé, non forké, et dispose soit de GitHub Pages, soit
d’une adresse HTTPS dans **About → Website**. Les dépôts qui ne sont que du code
n’ont pas de bouton de lancement et restent exclus. Le portail lui-même est exclu.

Pour un nouveau projet : migrer le dépôt public et publier son site ; activer Pages
ou renseigner **Website** suffit. Le catalogue se met à jour à la prochaine ouverture
après expiration du cache de 15 minutes ; **Actualiser** force une vérification.
Aucune nouvelle publication du launchboard, tâche planifiée, clé API ou connexion
GitHub n’est nécessaire. Les Pages sans Website utilisent leur URL github.io,
qui redirige vers leur domaine personnalisé le cas échéant.

Les raccourcis permanents ont priorité sur les métadonnées GitHub. La déduplication
utilise l’adresse du site ou du dépôt : lors de la migration d’un raccourci Sites,
renseigner aussi son champ `source` et actualiser son URL dans `projects.json`.
Pour masquer un dépôt automatique : ajouter le topic `papaye-hidden`, ou l’inscrire
dans `catalog.config.json` → `exclude` (ce dernier changement nécessite publication).

Le cache ne contient que les fiches publiques découvertes. Les requêtes n’envoient
ni authentification ni référent. En cas de réseau indisponible ou de quota GitHub,
les liens statiques restent affichés, complétés par le dernier cache valide (7 jours
maximum) ; un message précise que l’actualisation n’a pas abouti. Sans JavaScript,
seuls les raccourcis permanents sont affichés. Les liens indiquent une publication
configurée, pas une surveillance en temps réel de la disponibilité de chaque site.

`npm run check` exécute les tests du catalogue (nouveau projet, exclusions,
déduplication, échappement HTML, pagination, erreurs et cache), puis construit le site.

## Déployer

GitHub Pages utilise **GitHub Actions**. Le workflow vérifie le catalogue,
construit et publie `dist/` après chaque push sur `main`. Les pull requests
effectuent la vérification sans déploiement.

Le domaine canonique est `papaye-labs.fr`. GitHub assure la redirection depuis
`www.papaye-labs.fr` une fois les deux noms configurés et HTTPS activé.
Configurer les A de la racine vers les quatre adresses GitHub Pages et le CNAME
`www` vers `cthulhu59138.github.io`. Vérifier la propriété du domaine avec le
TXT fourni par GitHub avant le raccordement. Ne pas modifier la messagerie.

Pour annuler une modification, utiliser `git revert`, puis pousser sur `main`.
Conserver le TXT de vérification. Si l’hébergement est retiré, supprimer aussi
les enregistrements DNS qui pointent vers cet hébergement.

Le portail ne protège pas les futurs outils privés : chacun devra conserver
son propre contrôle d’accès et un hébergement compatible avec ses besoins.
