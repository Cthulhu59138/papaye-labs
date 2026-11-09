# Papaye Labs

Accueil public des projets Papaye Labs, prévu sur https://papaye-labs.fr/.
HTML et CSS statiques, sans dépendance à installer ni données utilisateur.

L’accueil est un tableau de lancement compact : applications et boutons d’accès
direct avant les ressources techniques. Le catalogue reste utilisable sans JavaScript.

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
Le catalogue est inséré dans le HTML pendant la compilation ; aucun JavaScript
n’est requis dans le navigateur. Seuls les projets prêts et destinés au public
doivent être ajoutés à ce catalogue.

Champs facultatifs : `shortName` (1 à 3 caractères pour l’icône), `status`
(plateforme ou stade de diffusion) et `ctaLabel` (action du bouton).
`source` peut être omis si le code d’une application n’est pas public.
Le nombre d’applications est calculé à la compilation. Les grandes illustrations
et textes de présentation ne font pas partie de l’accueil opérationnel.

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
