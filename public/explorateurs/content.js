/* Catalogue photographique : médias locaux et crédits dans chaque fiche. */
import { treeSubjects, treeMedia } from './tree-data.js';
import { animalCards, animalMedia } from './animal-data.js';

export const media = Object.fromEntries([...treeMedia, ...animalMedia].map(photo => [photo.id, photo]));
const views = ['leaf', 'bark', 'fruit', 'whole'];
const prompts = {
 leaf: ['À quel arbre appartient cette feuille ?', 'Observe sa forme, son bord et ses nervures.'],
 bark: ['À quel arbre appartient cette écorce ?', 'Observe la couleur, les lignes et les reliefs du tronc.'],
 fruit: ['Quel arbre porte ce fruit ?', 'Observe sa forme et ce qui l’entoure.'],
 whole: ['Quel arbre vois-tu ?', 'Regarde sa silhouette, son tronc et ses branches.']
};
// Ordre éditorial : varier à la fois le sujet et la vue dans les premières séances.
const treeCards = [];
for (let round = 0; round < views.length; round++) {
 treeSubjects.forEach((subject, index) => {
  const view = views[(round + index) % views.length];
  let [question, hint] = prompts[view];
  if (subject.scientificName === 'Pinus sylvestris') {
   if(view === 'leaf') [question,hint]=['À quel arbre appartiennent ces aiguilles ?', 'Observe leur longueur et comment elles sont regroupées.'];
   if(view === 'fruit') [question,hint]=['Quel arbre porte ce cône ?', 'Observe la forme du cône et ses écailles.'];
  }
  const questionMediaIds = subject.views[view];
  treeCards.push({id:`${subject.id}-${view}`,subjectId:subject.id,scientificName:subject.scientificName,view,
   answer:subject.name,question,hint,fact:subject.fact,
   questionMediaIds,
   answerMediaIds:['whole','leaf','bark','fruit'].map(v=>subject.views[v][0]),
   sourceUrl:media[questionMediaIds[0]].sourceUrl
  });
 });
}
export const decks = [
 {id:'arbres',title:'Les secrets des arbres',subtitle:'Feuilles, écorces, fruits et silhouettes',icon:'🌿',color:'green',cards:treeCards},
 {id:'traces',title:'Sur la piste des animaux',subtitle:'De vrais indices, de vraies rencontres',icon:'🐾',color:'orange',cards:animalCards}
];
