// Instantané documentaire local. Les résultats restent liés aux fiches du catalogue.
const MAX_RESULTS = 6;
const EMPTY_HELP = 'Précisez le support, son état, le milieu, les travaux et la température de surface en service, ou indiquez un code série–groupe, un numéro FNP ou un produit.';
const LIST_URL = 'https://fnp.edf.fr/fr/codification/list';
const SYSTEM_URL = 'https://fnp.edf.fr/fr/fnp/list';
const STOP = new Set(('a au aux avec ce cet cette chez comment contre d dans de des du en est et faire faut fiche fiches fnp groupe il j je l la le les ma me meilleur meilleure mes mon n ne notre nous ou par peindre peinture peintures pour peut peux quelle quelles quel quels que qui qu recherche rechercher reference references s se serie ses souhaitez souhaite suggerer sur systeme systemes t travaux trouver un une utiliser utilise utilisable voudrais veux y °c celsius temperature degres surface surfaces support supports convient conviendrait conseiller conseille besoin type couche application mettre choisir appliquer protege proteger peux tu doit comme vous numero documentee').split(' '));
const ALIASES = new Map();
for (const [word, aliases] of Object.entries({
  acier: ['aciers','ferreux','ferrifere','ferriferes','fer','fonte'],
  ciment: ['beton','betons','cimente','ciments'],
  corrosion: ['anticorrosif','anticorrosive','anticorrosion','rouille','antirouille'],
  entretien: ['maintenance','renovation'], neuf: ['neufs','neuve','neuves','neuvage'],
  mer: ['marine','marin'], exterieur: ['exterieure','exterieures','exterieurs','dehors'],
  interieur: ['interieure','interieures','interieurs','dedans'],
  galvanise: ['galva','galvanisee','galvanisees','galvanises','galvanisation'],
  inox: ['inoxydable','inoxydables'], brut: ['brute','brutes','bruts'], mur: ['mural','murale','murs'],
  plafond: ['plafonds'], sol: ['sols'], lessivable: ['lavable','lessivables','lavables'],
  poussiere: ['antipoussiere','poussieres'], campagne: ['rural','rurale','ruraux'],
  etancheite: ['etanche','etanches'], enterree: ['enterre','enterrees','enterres'],
  marquage: ['signalisation'], tuyauterie: ['tuyau','tuyaux'], acide: ['acides'],
  basique: ['basiques'], peu: ['faiblement'], agressif: ['agressive','agressifs','agressives'],
  chaud: ['chauds','chaude','chaudes'],
  pollution: ['pollue','polluee','pollues','polluees'],
})) {
  for (const alias of aliases) ALIASES.set(alias, word);
}
const fold = value => String(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’']/g,' ');
const words = value => (fold(value).match(/[a-z0-9]+/g) || []).filter(word => !STOP.has(word)).map(word => ALIASES.get(word) || word);
const codeOf = c => c.serie + ' ' + c.groupe;
const link = (label,url) => ({label,url});
const answer = (message,results = [],total = results.length) => ({message,results,total});
const join = parts => parts.filter(Boolean).join(' · ');
const listNums = ns => ns.join(', ');

function codeTerms(data,c) {
  const s = data.series[c.serie], g = data.groupes[c.groupe];
  // Distinguish absence of exposure from its presence, particularly for the acid-vapour series.
  const milieu = s.milieu.replace(/sans vapeurs acides ou basiques/gi,'sansvapeurs')
    .replace(/non nucléaire/gi,'nonnucleaire').replace(/peu corrosif/gi,'peucorrosif')
    .replace(/sans circuit sodium/gi,'sanssodium').replace(/hors enceinte/gi,'horsenceinte');
  let support = c.support || g.support;
  if (g.etat === 'Cuivre') support = 'Cuivre métal non ferreux';
  const text = [c.serie, s.famille, s.travaux, milieu, support, g.etat, g.fonction, g.temperature]
    .join(' ').replace(/non ferreux/gi,'nonferreux').replace(/acier inoxydable/gi,'acier inox')
    .replace(/contr[e] la corrosion/gi,'corrosion');
  return new Set(words(text));
}

function searchTerms(query) {
  const text = fold(query).replace(/sans (?:vapeurs? )?acides?(?: ou basiques?)?/g,'sansvapeurs')
    .replace(/non nucleaire/g,'nonnucleaire').replace(/non ferreux/g,'nonferreux')
    .replace(/peu corrosi(?:ve|f)/g,'peucorrosif').replace(/sans circuit (?:de )?sodium/g,'sanssodium')
    .replace(/hors (?:de l )?enceinte/g,'horsenceinte')
    .replace(/anti[ -](corrosion|poussiere|rouille)/g,'anti$1')
    .replace(/\b(?:me faut|qu il me faut|mettre en peinture)\b/g,' ');
  return [...new Set(words(text))];
}

const DEGREE = /(-?\d+(?:[.,]\d+)?)\s*(?:°\s*c\b|degres?\s*(?:celsius\b)?|celsius\b)/gi;
function requestedTemperature(query) {
  const text = fold(query);
  const hits = [...text.matchAll(DEGREE)];
  if (!hits.length) return {rest:query};
  const constraints = text.replace(/\b(?:[a-z]{3}\s*[-/]?\s*\d{3}|fnp\s*\d+|groupe\s*\d{3})\b/g,' ');
  if (hits.length > 1 || /([<>≤≥]|(?:plus|moins) de|entre|(?:superieur|inferieur)e? a|jusqu a|\d\s+(?:a|et)|\d\s*[-–—])\s*-?\d/.test(constraints)) {
    return {error:'La recherche par température accepte une valeur de surface en service, en °C. Pour un intervalle, vérifiez toute la plage dans la fiche technique du système.'};
  }
  return {t:Number(hits[0][1].replace(',','.')),rest:text.replace(hits[0][0],' ')};
}

// Only intervals printed in the group definitions are general. Some file-specific
// limits below narrow the set to the single system documented by that FT.
const FT_106 = 'https://fnp.edf.fr/fr/ficheconstitutive/download/40419';
const FT_106_NOTE = 'FT 106 G10/10.10 rév. 14, p. 1 et 4–5 : acier en intérieur sec, jusqu’à 500 °C en service continu. Sur acier mis à nu, vérifier le grenaillage Sa 3, la rugosité Moyen G et le cycle de durcissement. Si l’ancien revêtement est conservé, vérifier la préparation spécifique en page 5.';
function hasReviewed106(data,c) {
  return c.groupe === '105' && ['EIA','EID','PIA','PID','PIC'].includes(c.serie) && data.systemes[106]?.ft === FT_106;
}

function temperatureEvidence(data, c, systems, t) {
  const group = data.groupes[c.groupe];
  if (t === undefined) return {state:'unfiltered',systems};
  if (['ELF', 'PLF'].includes(c.serie) && ['300', '301', '303', '304'].includes(c.groupe)) {
    const hot = c.groupe === '304';
    const documented = systems.filter(num => reviewedTankSystem(data, num) && (!hot || num === 1086));
    const within = hot ? 50 < t && t < 80 : t < 50;
    const candidates = within ? documented : [];
    return {
      state: candidates.length ? 'ft' : 'unknown',
      systems: candidates,
      note: documented.length ? 'Plage documentée pour ' + documented.map(n => 'FNP ' + n).join(', ') +
        (hot ? ' : 50 °C < T < 80 °C.' : ' : T < 50 °C.') : ''
    };
  }
  const interval = group.temperature;
  let matches;
  if (interval.startsWith('10 °C < T < 60')) matches = 10 < t && t < 60;
  else if (interval === 'T ≤ 60 °C') matches = t <= 60;
  else if (interval.startsWith('60 °C < T ≤ 120')) matches = 60 < t && t <= 120;
  else if (interval.startsWith('T > 120 °C')) {
    if (t <= 120) return {state:'outside',systems:[]};
    if (systems.includes(106) && hasReviewed106(data,c)) {
      return t <= 500 ? {state:'ft',systems:[106],note:FT_106_NOTE} :
        {state:'unknown',systems:[],note:'La FT 106 fixe un maximum de 500 °C en continu. Le groupe ne précise pas de maximum pour les autres systèmes.'};
    }
    return {state:'unknown',systems:[],note:'Le groupe indique un seuil de 120 °C ; sa limite supérieure doit être établie dans la FT de chaque système.'};
  }
  else if (interval === 'T < 10 °C') matches = t < 10;
  else if (interval === 'T < 50 °C') matches = t < 50;
  else if (interval.startsWith('T < 50 °C ou')) matches = t < 50 || (50 < t && t < 90);
  else {
    const documented = interval.includes('(FT 1119)') ? 1119
      : group.reserve.includes('FT 1094 précise') ? 1094
      : group.reserve.includes('FT 1086 précise') ? 1086 : null;
    if (!documented || !systems.includes(documented)) return {state:'unknown',systems:[]};
    const within = documented === 1086 ? (50 < t && t < 80) : t < 50;
    return {state:within ? 'ft' : 'unknown',systems:within ? [documented] : []};
  }
  return {state:matches ? 'within' : 'outside',systems:matches ? systems : []};
}

function codeCard(data,c,ns=c.fnp) {
  const s=data.series[c.serie], g=data.groupes[c.groupe];
  const details=[s.travaux,s.milieu,c.support || g.support,g.etat,g.fonction,g.temperature,g.reserve];
  const links=[link('Codification FNP',c.url)];
  if(g.complement) links.push(link('Fiche citée dans la précision',g.complement));
  if(ns.length) links.push(link('FT du FNP '+ns[0],data.systemes[ns[0]].ft));
  details.push(ns.length ? 'FNP associés à examiner : '+listNums(ns)+'.' : c.fnp.length ? '' : 'Aucun système publié associé dans le relevé.');
  return {title:codeOf(c),detail:join(details),links};
}

const EPODUR_PRODUCT_SHEET = 'https://www.maestria.fr/fiches-techniques/pdf/ant/ant_pdf.php?idx=346';
const IM209_DIESEL = 'Pour les hydrocarbures sur métal ferreux, la fiche associe ELF (entretien) et PLF (neuf) aux groupes 300, 301 et 303, à T < 50 °C. Les essais diesel à 23, 50 et 80 °C sont rapportés sous PLF, sans durée précisée. Sur acier nu, préparation Sa 2½. Avant mise en service, la FT indique 7 jours à 20 °C et 75 % d’humidité relative. La durée de vie du revêtement en service reste à établir pour le carburant et la cuve concernés.';
const TANK_SYSTEM_REVIEWS = {
  1086: {
    ft: 'https://fnp.edf.fr/fr/ficheconstitutive/download/40115',
    indice: 'S006',
    detail: 'FT 16-001 R15, p. 1–3. EPODUX 292 (50 µm) et EPODUR NV 75-25 (600 µm), soit 650 µm secs. Sur métal ferreux au contact des hydrocarbures, ELF en entretien ou PLF en neuf, groupes 300, 301 et 303 à T < 50 °C, groupe 304 à 50 °C < T < 80 °C. Essais d’immersion totale d’un mois dans le diesel à 80 °C et dans le biodiesel pur à 23 et à 80 °C. Aucune durée de vie en service chiffrée. Sur acier nu, préparation Sa 2½. Avant mise en service, la FT système indique 3 jours à 20 °C et 75 % d’humidité relative. La FT produit EPODUR de janvier 2026 (p. 1–2) indique 7 jours à 20 °C pour 600 µm. Faire confirmer par Maestria le délai avant remplissage et la compatibilité avec le carburant exact. Le fabricant demande à être consulté pour un stockage hors température ambiante.',
    productSheet: EPODUR_PRODUCT_SHEET
  },
  1094: {
    ft: 'https://fnp.edf.fr/fr/ficheconstitutive/download/26152',
    indice: 'S003',
    detail: 'FT 17-005 R05, p. 2–3. EPODUX IM 209 en trois couches de 50, 250 et 250 µm, soit 550 µm secs. ' + IM209_DIESEL
  },
  1095: {
    ft: 'https://fnp.edf.fr/fr/ficheconstitutive/download/22434',
    indice: 'S004',
    detail: 'FT 17-006 R04, p. 2–3. EPODUX IM 209 en deux couches de 50 et 500 µm, soit 550 µm secs. ' + IM209_DIESEL
  }
};

function reviewedTankSystem(data, num) {
  const system = data.systemes[num];
  const review = TANK_SYSTEM_REVIEWS[num];
  if (review && system.ft === review.ft && system.indice === review.indice) return review;
}

function systemCard(data,num,usageCodes,matchNames=[]) {
  const s=data.systemes[num];
  const names=matchNames.length ? matchNames : [...new Set(s.produits.map(p=>p.nom))];
  const details=['Indice '+s.indice+' du '+s.revision,s.equipement,
    'Produits cités : '+names.join(', ')+'.'];
  const links = [link('Fiche système',s.fiche),link('Fiche technique FR',s.ft)];
  const review = reviewedTankSystem(data, num);
  if (review) {
    details.push(review.detail);
    if (review.productSheet) links.push(link('FT produit EPODUR NV 75-25 (janvier 2026)', review.productSheet));
  }
  if (Number(num) === 106 && s.ft === FT_106) details.push(FT_106_NOTE);
  if(usageCodes?.length) details.push('Couples associés : '+usageCodes.join(', ')+'.');
  return {title:'FNP '+num+' · '+s.societe, detail:join(details), links};
}

const MAX_ALTERNATIVES = 2;
const surfaceOf = (data, c) => c.support || data.groupes[c.groupe].support;

function alternativeCard(data, c, number, condition) {
  const group = data.groupes[c.groupe];
  const system = data.systemes[number];
  const links = [link('Codification ' + codeOf(c), c.url), link('FT du FNP ' + number, system.ft)];
  if (group.complement) links.push(link('Fiche citée dans la précision', group.complement));
  const check = number === 106 && hasReviewed106(data,c) ? FT_106_NOTE : '';
  return {
    title: codeOf(c),
    detail: [condition, check, 'Exemple publié pour ' + codeOf(c) + ' : FNP ' + number + ' (' + system.societe + ').', group.reserve].filter(Boolean).join(' '),
    links
  };
}

const unspecifiedProtection = 'Protection particulière à préciser';
const atmospheric = new Set(['Intérieur', 'Extérieur']);
const zincFinish = /galvanisée|électrozinguée|métallisée au zinc/;
const limitedService = /nucléaire|potable|radioactif|contamination|irradiation/i;

function nearbyEnvironment(a, b) {
  if (a.famille !== b.famille || a.travaux !== b.travaux) return false;
  if (a.famille === 'Extérieur') {
    const gradeA = Number(a.milieu.match(/\bC([2-5])\b/)?.[1]);
    const gradeB = Number(b.milieu.match(/\bC([2-5])\b/)?.[1]);
    return gradeB === gradeA + 1;
  }
  if (a.famille === 'Intérieur') {
    return a.milieu.includes('bâtiment non nucléaire, air peu corrosif') &&
      b.milieu.includes('bâtiment non nucléaire, air corrosif');
  }
  // Two definitions for untreated fresh water, differentiated by water chemistry.
  return a.milieu.includes('eau douce brute') && b.milieu.includes('eau douce brute') && a.milieu !== b.milieu;
}

function compareUses(data, original, c, t) {
  const source = data.groupes[original.groupe], target = data.groupes[c.groupe];
  const series = data.series[original.serie], other = data.series[c.serie];
  const surface = surfaceOf(data, original);
  if (surfaceOf(data, c) !== surface) return;
  if (c.serie !== original.serie) {
    if (c.groupe !== original.groupe || series.famille !== other.famille) return;
    if (series.milieu === other.milieu && series.travaux !== other.travaux &&
        ![series.travaux,other.travaux].includes('Non précisé')) {
      return 'Même groupe et même milieu : ' + series.milieu + ' À envisager uniquement pour des travaux de type « ' +
        other.travaux + ' » au lieu de « ' + series.travaux + ' ». Confirmez le type de travaux.';
    }
    if (nearbyEnvironment(series, other)) {
      return 'Même groupe et mêmes travaux. Le milieu demandé est « ' + series.milieu + ' ». ' +
        'Cette piste concerne « ' + other.milieu + ' ». Confirmez que cette seconde description correspond au chantier.';
    }
    return;
  }
  if (!atmospheric.has(series.famille) || !source.etat || !target.etat) return;
  if (t === undefined && source.temperature !== target.temperature) return;
  if (source.fonction === unspecifiedProtection && target.fonction !== source.fonction &&
      source.etat === target.etat && source.temperature === target.temperature && !target.reserve) {
    return 'Même milieu, même support et même état. La protection demandée reste à préciser. ' +
      'Piste à examiner si la fonction attendue est « ' + target.fonction + ' ». Confirmez la fonction.';
  }
  if (source.fonction !== target.fonction || source.reserve || source.etat === target.etat && source.temperature === target.temperature) return;
  const sameMetalFamily = surface === 'Métal ferreux' || (zincFinish.test(source.etat) && zincFinish.test(target.etat));
  if (source.etat !== target.etat && !sameMetalFamily) return;
  const before = [source.etat, source.temperature].filter(Boolean).join(', ');
  const after = [target.etat, target.temperature].filter(Boolean).join(', ');
  return 'Même milieu, même support et même fonction. Le groupe ' + original.groupe + ' décrit « ' + before +
    ' ». Cette piste concerne « ' + after + ' ». Confirmez que ce second cas décrit la surface et vérifiez sa préparation dans la fiche.';
}

// Compare documented uses, never the numerical distance between two codes.
export function findAlternatives(data, original, t) {
  const options = [];
  for (const c of data.couples) {
    if (!c.fnp.length || c === original) continue;
    const condition = compareUses(data, original, c, t);
    if (!condition) continue;
    const proof = temperatureEvidence(data,c,c.fnp,t);
    if (proof.systems.length) options.push(alternativeCard(data, c, proof.systems[0], condition));
    if (options.length === MAX_ALTERNATIVES) break;
  }
  return options;
}

export function noAlternativeHint(data, c) {
  const group = data.groupes[c.groupe];
  const series = data.series[c.serie];
  let hint;
  if (group.fonction === unspecifiedProtection || group.fonction.includes('à préciser')) {
    hint = 'Précisez la protection indispensable sur cette surface.';
  } else if (group.reserve || group.temperature.includes('tronqu')) {
    hint = 'Vérifiez la limite ou la réserve du groupe dans la fiche de codification et la fiche technique.';
  } else if (series.famille === 'Contact avec un milieu' || limitedService.test(series.milieu)) {
    hint = 'Confirmez le milieu de service exact et les exigences de protection avec le prescripteur.';
  } else {
    hint = 'Confirmez avec le prescripteur la fonction « ' + group.fonction + ' » pour le support « ' + surfaceOf(data,c) + ' ».';
  }
  return 'Aucune autre codification suffisamment proche dans le relevé. ' + hint;
}

// For a hot bare-steel query, the catalogue describes the temperature class
// separately from the surface preparation. Keep every other requested term.
function hotSteelOptions(data, terms, tokens, t) {
  if (!tokens.includes('acier') || !tokens.includes('brut') || (!tokens.includes('chaud') && t === undefined)) return [];
  const remaining = tokens.filter(token => token !== 'brut');
  const options = [];
  for (const c of data.couples) {
    const g = data.groupes[c.groupe];
    if (!c.fnp.length || !/^Surface (très )?chaude$/.test(g.etat) || surfaceOf(data,c) !== 'Métal ferreux') continue;
    const proof = temperatureEvidence(data,c,c.fnp,t);
    if (!proof.systems.length) continue;
    const dryInterior = proof.systems[0] === 106 && hasReviewed106(data,c);
    const documented = token => terms.get(c).has(token) || (token === 'sec' && dryInterior);
    if (!remaining.every(documented)) continue;
    const s = data.series[c.serie];
    const condition = s.travaux + ' · ' + s.milieu + ' ' + g.etat + ' : ' + g.temperature +
      '. Vérifiez la température de surface en service et la préparation de l’acier brut dans la fiche technique.';
    options.push(alternativeCard(data,c,proof.systems[0],condition));
    if (options.length === MAX_ALTERNATIVES) break;
  }
  return options;
}

function withAlternatives(response, alternatives) {
  if (!alternatives.length) return response;
  return {
    ...response,
    message: response.message + ' Des pistes sous conditions figurent ci-dessous.',
    alternatives
  };
}

function showCode(data,c,t,num,remaining) {
  const code=codeOf(c),g=data.groupes[c.groupe];
  function otherSystem(response) {
    if (!data.systemes[num] || remaining) return response;
    const other = temperatureEvidence(data,c,c.fnp.filter(n=>n!==num),t).systems[0];
    if (!other) return response;
    const condition = 'Si la référence FNP ' + num + ' peut changer, ce système figure sous le même code. Confirmez que le produit initial n’est pas imposé. ' + g.temperature;
    return withAlternatives(response,[alternativeCard(data,c,other,condition)]);
  }
  if (num !== undefined && !c.fnp.includes(num)) {
    return otherSystem(answer('Le catalogue n’associe pas le FNP '+num+' au code '+code+'.',[codeCard(data,c,[])]));
  }
  const considered = num ? [num] : c.fnp;
  const proof=temperatureEvidence(data,c,considered,t);
  const header=codeCard(data,c,proof.systems);
  if(proof.state==='outside' || proof.state==='unknown') {
    const message = proof.state === 'outside'
      ? code+' : '+t+' °C est hors de la plage du groupe ('+g.temperature+'). Aucun candidat retenu à cette température.'
      : 'Le catalogue ne permet pas de retenir un système pour '+code+' à '+t+' °C. Vérifiez les conditions propres à la FT.';
    const response = answer([message,proof.note].filter(Boolean).join(' '),[header]);
    if (num !== undefined) return otherSystem(response);
    return withAlternatives(response, remaining ? [] : findAlternatives(data,c,t));
  }
  const systems=proof.systems;
  const cards=systems.slice(0,MAX_RESULTS-1).map(n=>systemCard(data,n));
  const status=systems.length ? systems.length+' système(s) associé(s) à examiner. La fiche technique et le commentaire du système précisent les conditions.' : 'Aucun système publié associé à ce couple.';
  const extra=remaining ? ' La recherche par code ne vérifie pas les autres contraintes rédigées dans votre question.' : '';
  const info = proof.state === 'ft'
    ? ' ' + (proof.note || 'Seul le seuil documenté pour le FNP '+systems[0]+' est utilisé ici.') : '';
  const response = answer(code+' — '+status+info+extra,[header,...cards],systems.length+1);
  if (!systems.length && num === undefined && !remaining) {
    const alternatives = findAlternatives(data,c,t);
    if (!alternatives.length) response.message += ' ' + noAlternativeHint(data,c);
    return withAlternatives(response, alternatives);
  }
  return response;
}

function codeList(data,rows,message) {
  return answer(message,rows.slice(0,MAX_RESULTS).map(c=>codeCard(data,c)),rows.length);
}

export function createCatalogueSearch(data) {
  const byCode=new Map(), bySystem=new Map(), terms=new Map();
  for(const c of data.couples){
    byCode.set(codeOf(c),c);
    terms.set(c,codeTerms(data,c));
    for(const n of c.fnp){
      if(!bySystem.has(n)) bySystem.set(n,[]);
      bySystem.get(n).push(codeOf(c));
    }
  }
  return function search(query) {
    if(typeof query!=='string' || !query.trim()) return answer(EMPTY_HELP);
    if(query.length>700) return answer('Résumez la recherche en indiquant le support, le milieu et la température, ou un code du catalogue.');
    const temperature=requestedTemperature(query);
    if(temperature.error) return answer(temperature.error);
    let text=fold(temperature.rest).trim();
    const foundNums=[...text.matchAll(/\bf\s*\.?\s*n\s*\.?\s*p\s*\.?\s*(?:n[°ºo]?\s*)?[-:#]?\s*(\d{1,5})\b/gi)];
    if(foundNums.length>1) return answer('Recherchez un numéro FNP à la fois pour vérifier ses propres codes et conditions.');
    const explicitNum=foundNums[0];
    const implicitNum=/^\d+$/.test(text) && !data.groupes[text] ? Number(text) : undefined;
    const num=explicitNum ? Number(explicitNum[1]) : implicitNum;
    if(explicitNum) text=text.replace(explicitNum[0],' ').trim();
    const possibleUnknown=/^[a-z]{3}[ /-]*\d{3}$/.test(text);
    const codeMatches=[...text.matchAll(/\b([a-z]{3})[ \-/]*(\d{3})\b/gi)]
      .filter(m=>data.series[m[1].toUpperCase()]);
    if(codeMatches.length>1) return answer('Examinez une codification à la fois pour conserver ses propres conditions et systèmes.');
    if(codeMatches.length){
      const m=codeMatches[0], code=m[1].toUpperCase()+' '+m[2], c=byCode.get(code);
      if(!c) return answer('Le couple '+code+' est absent du relevé du '+data.date+'.');
      return showCode(data,c,temperature.t,num,searchTerms(text.replace(m[0],' ')).length>0);
    }
    if(num!==undefined){
      if(!data.systemes[num]) return answer('Le FNP '+num+' est absent de la liste des systèmes publiés du '+data.date+'.');
      const rows=bySystem.get(num), info=systemCard(data,num,rows);
      if (num === 106 && data.systemes[num].ft === FT_106 && temperature.t > 500) {
        return answer('Le FNP 106 dépasse sa limite de service continu à '+temperature.t+' °C. La FT indique un maximum de 500 °C.',[info]);
      }
      const warnings=[...new Set(data.couples.filter(c=>c.fnp.includes(num) && ['154','310'].includes(c.groupe)).map(c=>c.groupe))];
      for(const group of warnings){
        info.detail+=' '+data.groupes[group].reserve;
        info.links.push(link('Précision groupe '+group,data.groupes[group].complement));
      }
      return answer('Système publié. Précisez le couple et les conditions de service pour vérifier son emploi.',[info]);
    }
    if(/^\d{3}$/.test(text) && data.groupes[text] && data.systemes[Number(text)]) return answer('Ce nombre désigne un groupe et un numéro FNP. Précisez « groupe '+text+' » ou « FNP '+Number(text)+' ».');
    const family=text.match(/^(?:serie\s*)?([a-z]{3})$/i)?.[1]?.toUpperCase();
    const group=text.match(/^(?:groupe\s*)?(\d{3})$/)?.[1];
    if(data.series[family] || data.groupes[group]){
      const rows=data.couples.filter(c=>c.serie===family || c.groupe===group);
      const g=data.groupes[group];
      return codeList(data,rows,(g ? 'Groupe '+group+' : '+join([g.support,g.etat,g.fonction,g.temperature,g.reserve]) : 'Série '+family+' : '+data.series[family].milieu)+' '+rows.length+' couples répertoriés. Précisez le code complet.');
    }
    const tokens=searchTerms(text);
    if(!tokens.length) return answer(EMPTY_HELP);
    const products=[];
    const productSystems=[];
    for(const [n,s] of Object.entries(data.systemes)){
      const matching=s.produits.filter(p=>{
        const fields=new Set(words(p.nom+' '+s.societe));
        return tokens.every(t=>fields.has(t));
      });
      if(matching.length){
        productSystems.push(n);
        products.push(systemCard(data,n,bySystem.get(Number(n)),[...new Set(matching.map(p=>p.nom))]));
      }
    }
    if(products.length && temperature.t===undefined) return answer(products.length+' système(s) où figurent ce nom commercial ou ce fournisseur : '+listNums(productSystems)+'. Recherchez un numéro FNP pour ouvrir sa fiche et vérifier le couple concerné.',products.slice(0,MAX_RESULTS),products.length);
    if(possibleUnknown) return answer('Ce code ou nom commercial est absent du relevé du '+data.date+'.');
    const matches=[];
    const withoutSystem=[];
    for(const c of data.couples){
      if(!tokens.every(t=>terms.get(c).has(t))) continue;
      const proof=temperatureEvidence(data,c,c.fnp,temperature.t);
      if (!proof.systems.length) withoutSystem.push(c);
      if(['outside','unknown'].includes(proof.state)) continue;
      matches.push({c,proof});
    }
    // Published choices first, then reference order. No performance ranking is inferred.
    matches.sort((a,b)=>Number(Boolean(b.proof.systems.length))-Number(Boolean(a.proof.systems.length)) || codeOf(a.c).localeCompare(codeOf(b.c),'fr'));
    const alternatives = [];
    if (!matches.some(m => m.proof.systems.length)) {
      for (const source of withoutSystem) {
        for (const card of findAlternatives(data,source,temperature.t)) {
          if (!alternatives.some(previous => previous.title === card.title)) alternatives.push(card);
          if (alternatives.length === MAX_ALTERNATIVES) break;
        }
        if (alternatives.length === MAX_ALTERNATIVES) break;
      }
    }
    if (!matches.length && !alternatives.length) alternatives.push(...hotSteelOptions(data,terms,tokens,temperature.t));
    if (!matches.length) {
      if (!alternatives.length && /\b(cuve|reservoir|citerne)s?\b/.test(text)
        && tokens.includes('interieur') && /\b(gazole|gasoil|gas-oil|diesel|fioul|fuel|hydrocarbures?)\b/.test(text)) {
        return answer('Pour la paroi intérieure au contact du carburant, précisez le matériau, le carburant exact et sa température maximale. En cas de décollement, utilisez « Solliciter le Peintre » pour examiner les constats et les fiches adaptés à votre situation.');
      }
      const prompt = alternatives.length ? '' : ' ' + EMPTY_HELP;
      return withAlternatives(answer('Aucune correspondance sur tous les mots et seuils saisis.' + prompt), alternatives);
    }
    const qualifier=temperature.t===undefined?'':' Les bornes explicites ont été comparées à '+temperature.t+' °C.';
    const response = answer(matches.length+' couple(s) repéré(s) par mots-clés.'+qualifier+' Précisez les conditions ou ouvrez le code pour examiner les systèmes et leurs FT.',matches.slice(0,MAX_RESULTS).map(({c,proof})=>codeCard(data,c,proof.systems)),matches.length);
    return withAlternatives(response, alternatives);
  };
}

let cataloguePromise;
export function loadCatalogue() {
  if (!cataloguePromise) {
    cataloguePromise = fetch(new URL('./catalogue.json', import.meta.url)).then(response => {
      if (!response.ok) throw new Error('Indisponible');
      return response.json();
    }).catch(error => {
      cataloguePromise = undefined;
      throw error;
    });
  }
  return cataloguePromise;
}

let search;
export async function searchCatalogue(query) {
  try {
    const data = await loadCatalogue();
    search ??= createCatalogueSearch(data);
    return search(query);
  }
  catch {return answer('Le référentiel local est momentanément indisponible.',[{title:'Sources du catalogue',detail:'Consultez le catalogue officiel ou réessayez.',links:[link('Codifications',LIST_URL),link('Systèmes publiés',SYSTEM_URL)]}]);}
}
