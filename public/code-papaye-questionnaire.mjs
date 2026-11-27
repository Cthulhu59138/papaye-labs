import {propositions} from './propositions-code-papaye.mjs';

export const QUESTIONNAIRE_PATH = '/api/projects/code-papaye/questionnaire';
export const COMMENT_LIMIT = 4000;
export const QUESTION_COMMENT_LIMIT = 1000;
export const QUESTIONNAIRE_BODY_LIMIT = 500_000;

// Keep these keys stable when the wording changes. Saved answers refer to keys.
export const sections = [
  ['Gestes de travail', [
    ['situations', 'Dans quelles situations ouvrirais-tu la boîte à outils ?', [
      ['intervention','Préparer une intervention ou une modification'], ['ecart','Analyser un écart ou un constat de contrôle'],
      ['maintien','Vérifier jusqu’au prochain arrêt'], ['relecture','Relire ou contrôler un calcul existant'],
      ['comparaison','Comparer des variantes de réparation ou de géométrie'], ['epreuve','Préparer ou relire une épreuve'], ['autre','Autre situation']]],
    ['materiels', 'Sur quels matériels ?', [
      ['tubes','Tubes droits'], ['coudes','Coudes, cintres et transitions'], ['piquages','Piquages et raccordements'],
      ['recipients','Récipients, viroles, fonds et bâches'], ['brides','Brides, joints et boulonnerie'],
      ['soudures','Soudures'], ['supports','Supports'], ['gv','Tubes de générateur de vapeur']]],
    ['frequence','Quand as-tu besoin du résultat ?', [
      ['routine','En préparation ou en revue de routine'], ['arret','En préparation d’arrêt'],
      ['terrain','Pendant une intervention ou après un constat terrain'], ['ponctuel','Pour un cas ponctuel ou complexe']]]]],
  ['Problèmes à résoudre', [
    ['pression','Que veux-tu vérifier sous pression ?', [
      ['minimum','Calculer l’épaisseur minimale de service'], ['marge','Comparer la paroi mesurée au minimum'],
      ['max','Calculer la pression admissible pour une paroi connue'], ['nominal','Choisir une épaisseur nominale avec tolérances et réserves'],
      ['essai','Vérifier séparément la situation d’essai'], ['piquage','Vérifier un renforcement de piquage']]],
    ['amincissement','Que veux-tu faire avec une sous-épaisseur ?', [
      ['simplifie','Vérifier la voie simplifiée'], ['local','Vérifier la tenue locale à la pression'],
      ['charges','Contrôler la section restante sous charges mécaniques'], ['suivi','Comparer des mesures successives au même point'],
      ['horizon','Projeter l’épaisseur à une date ou à un nombre de cycles'], ['sensibilite','Comparer plusieurs vitesses de perte ou échéances']]],
    ['defauts','Quelles questions de défaut ou de fatigue te concernent ?', [
      ['enveloppe','Construire une enveloppe à partir d’un relevé END'], ['interaction','Vérifier les interactions entre indications'],
      ['tables','Lire les tables de défauts au niveau applicable'], ['amorcage','Calculer l’amorçage en fatigue'],
      ['propagation','Estimer la propagation ou la taille finale'], ['instabilite','Vérifier l’instabilité plastique ou la charge limite'],
      ['kj','Calculer ou reprendre K, Kcp ou J'], ['thermique','Prendre en compte un chargement thermique ou combiné']]],
    ['autres_usages','Quels autres contrôles veux-tu retrouver ?', [
      ['classement','Classement du matériel ou orientation de l’analyse'], ['pv','Température, pression ou durée d’une épreuve'],
      ['situations','Comptabilisation des situations et transitoires'], ['boulons','Tenue mécanique de la boulonnerie ou des supports'],
      ['requalification','Réparation, bouchage et requalification'], ['fuite','Contrôle d’un débit de fuite déjà mesuré'], ['autre','Autre contrôle']]]]],
  ['Données à saisir ou réutiliser', [
    ['situations_entrees','Quelles pressions et températures as-tu habituellement à disposition ?', [
      ['ps','PS · pression maximale admissible'], ['ts','TS · température maximale ou minimale admissible'],
      ['pc','Pression de calcul'], ['tc','Température de calcul'], ['psit','Pression et température de la situation étudiée'],
      ['essai','Pression et température d’essai'], ['serie','Historique horodaté de pression ou température']]],
    ['dimensions','Quelles épaisseurs, cotes et réserves connais-tu ?', [
      ['calcul','Épaisseur de calcul'], ['nominale','Épaisseur nominale'], ['fabrication','Épaisseur minimale de fabrication'],
      ['mesuree','Épaisseur mesurée avec son incertitude'], ['locale','Épaisseur saine et épaisseur locale au défaut'],
      ['corrosion','Surépaisseur de corrosion ou d’usure'], ['autres','Réserves d’usinage, mécaniques ou tolérances'],
      ['diametres','DN, diamètre extérieur ou diamètre intérieur garanti'], ['geom','Rayon de coude, géométrie de piquage ou de récipient']]],
    ['materiau_charges','Quelles autres données peux-tu renseigner ?', [
      ['nuance','Nuance, produit et état matière'], ['admissible','Contrainte admissible à température'],
      ['code','Code, édition ou classement applicable'], ['joint','Coefficient de joint'],
      ['charges','Efforts, moments ou contraintes calculées'], ['end','Dimensions de défaut ou relevés END'],
      ['cin','Cinétique ou taux de perte externe'], ['cycles','Nombre de cycles ou occurrences'],
      ['courbes','Courbes matière, lois de fatigue ou de propagation']]],
    ['provenance','Comment veux-tu renseigner les valeurs ?', [
      ['manuelle','Saisir une valeur connue et son unité'], ['repere','Ajouter un repère de source et une révision si utile'],
      ['recopie','Reprendre un tableau de mesures ou une série'], ['outil','Reprendre une valeur calculée par une autre feuille'],
      ['catalogue','Sélectionner une valeur dans un référentiel matière ou dimensions'],
      ['compare','Comparer une valeur saisie à une valeur calculée']]],
    ['controles','Quelles confusions veux-tu éviter à la saisie ?', [
      ['pression','PS, pression de calcul, de situation et d’essai'], ['temperature','TS et température de la situation'],
      ['paroi','Paroi nominale, de calcul, minimale et mesurée'], ['corrosion','Épaisseur avec ou sans réserve de corrosion'],
      ['etat','Mesure initiale, épaisseur projetée, paroi saine et locale'],
      ['unites','bar/MPa, N·m/N·mm, années/jours/cycles'], ['conditions','Valeurs à des températures, sections ou dates différentes']]]]],
  ['Résultats et priorités', [
    ['sorties','Quels résultats veux-tu pouvoir reprendre dans ton travail ?', [
      ['minimum','Minimum requis et grandeur effectivement comparée'], ['marge','Marge signée avec unité'],
      ['max','Pression maximale calculée'], ['date','Épaisseur à échéance ou délai avant un seuil'],
      ['verdict','Résultat distinct par critère et situation'], ['diagnostic','Donnée manquante ou motif de sortie du domaine'],
      ['trace','Hypothèses, intermédiaires et références utilisées'], ['transfert','Résultat réutilisable dans une autre feuille'],
      ['excel','Classeur Excel renseigné à archiver ou transmettre']]],
    ['chaines','Quels enchaînements veux-tu faire dans un même dossier ?', [
      ['tube','Admissible à température → minimum de pression → marge sur paroi'],
      ['perte','Mesures et cinétique → épaisseur à échéance → contrôles pression et mécanique'],
      ['end','Relevé END → défaut enveloppe → comparaison à une table'],
      ['rupture','Facteur K ou intégrale J → comparaison au critère'],
      ['situations','Situations et charges → combinaison → contrôle mécanique']]],
    ['priorites','Quelles familles te feraient gagner le plus de temps ?', [
      ['pression','Pression, épaisseurs et piquages'], ['matiere','Choix des admissibles et propriétés matière'],
      ['amin','Amincissement et suivi'], ['meca','Charges et tenue mécanique'], ['defauts','Défauts plans et acceptabilité'],
      ['fatigue','Fatigue, instabilité et rupture'], ['epreuve','Épreuves, classement et requalification']]]]],
];

const priorities = [
  ['prioritaire','Prioritaire'], ['utile','Utile'], ['plus_tard','Plus tard'],
  ['hors_sujet','Hors sujet'], ['incertain','À clarifier'],
];
export const automationSections = propositions.map(([topic, entries]) =>
  [topic, entries.map(([id, label]) => ['auto_'+id, label, priorities])]);
export const automationKeys = new Set(automationSections.flatMap(([, questions]) => questions.map(([key]) => key)));

const allowed = new Map([...sections,...automationSections].flatMap(([, questions]) => questions.map(([key,, choices]) =>
  [key, new Set(choices.map(([value]) => value))])));

export function validAnswers(answers) {
  return !!answers && typeof answers === 'object' && !Array.isArray(answers) &&
    Object.entries(answers).every(([key, choices]) => {
      const options = allowed.get(key);
      return options && Array.isArray(choices) && (!automationKeys.has(key) || choices.length <= 1) && new Set(choices).size === choices.length &&
        choices.every(choice => options.has(choice));
    });
}

export function validQuestionComments(comments) {
  return !!comments && typeof comments === 'object' && !Array.isArray(comments) &&
    Object.entries(comments).every(([key, text]) =>
      allowed.has(key) && typeof text === 'string' && text.length <= QUESTION_COMMENT_LIMIT);
}
