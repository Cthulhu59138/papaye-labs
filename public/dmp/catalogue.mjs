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
  const text = [s.famille, s.travaux, milieu, support, g.etat, g.fonction, g.temperature]
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
function temperatureEvidence(group, systems, t) {
  if (t === undefined) return {state:'unfiltered',systems};
  const interval = group.temperature;
  let matches;
  if (interval.startsWith('10 °C < T < 60')) matches = 10 < t && t < 60;
  else if (interval === 'T ≤ 60 °C') matches = t <= 60;
  else if (interval.startsWith('60 °C < T ≤ 120')) matches = 60 < t && t <= 120;
  else if (interval.startsWith('T > 120 °C')) matches = t > 120;
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

function systemCard(data,num,usageCodes,matchNames=[]) {
  const s=data.systemes[num];
  const names=matchNames.length ? matchNames : [...new Set(s.produits.map(p=>p.nom))];
  const details=['Indice '+s.indice+' du '+s.revision,s.equipement,
    'Produits cités : '+names.join(', ')+'.'];
  if(usageCodes?.length) details.push('Couples associés : '+usageCodes.join(', ')+'.');
  return {title:'FNP '+num+' · '+s.societe,detail:join(details),
    links:[link('Fiche système',s.fiche),link('Fiche technique FR',s.ft)]};
}

function showCode(data,c,t,num,remaining) {
  const code=codeOf(c),g=data.groupes[c.groupe];
  if(num !== undefined && !c.fnp.includes(num)) return answer('Le catalogue n’associe pas le FNP '+num+' au code '+code+'.',[codeCard(data,c,[])]);
  const considered = num ? [num] : c.fnp;
  const proof=temperatureEvidence(g,considered,t);
  const header=codeCard(data,c,proof.systems);
  if(proof.state==='outside') return answer(code+' : '+t+' °C est hors de la plage du groupe ('+g.temperature+'). Aucun candidat retenu à cette température.',[header]);
  if(proof.state==='unknown') return answer('Le catalogue ne permet pas de retenir un système pour '+code+' à '+t+' °C. Vérifiez les conditions propres à la FT.',[header]);
  const systems=proof.systems;
  const cards=systems.slice(0,MAX_RESULTS-1).map(n=>systemCard(data,n));
  const status=systems.length ? systems.length+' système(s) associé(s) à examiner. La fiche technique et le commentaire du système précisent les conditions.' : 'Aucun système publié associé à ce couple.';
  const extra=remaining ? ' La recherche par code ne vérifie pas les autres contraintes rédigées dans votre question.' : '';
  const info=proof.state==='ft' ? ' Seul le seuil documenté pour le FNP '+systems[0]+' est utilisé ici.' : '';
  return answer(code+' — '+status+info+extra,[header,...cards],systems.length+1);
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
    for(const c of data.couples){
      if(!tokens.every(t=>terms.get(c).has(t))) continue;
      const proof=temperatureEvidence(data.groupes[c.groupe],c.fnp,temperature.t);
      if(['outside','unknown'].includes(proof.state)) continue;
      matches.push({c,proof});
    }
    // Published choices first, then reference order. No performance ranking is inferred.
    matches.sort((a,b)=>Number(Boolean(b.proof.systems.length))-Number(Boolean(a.proof.systems.length)) || codeOf(a.c).localeCompare(codeOf(b.c),'fr'));
    if(!matches.length) return answer('Aucune correspondance sur tous les mots et seuils saisis. '+EMPTY_HELP);
    const qualifier=temperature.t===undefined?'':' Les bornes explicites ont été comparées à '+temperature.t+' °C.';
    return answer(matches.length+' couple(s) repéré(s) par mots-clés.'+qualifier+' Précisez les conditions ou ouvrez le code pour examiner les systèmes et leurs FT.',matches.slice(0,MAX_RESULTS).map(({c,proof})=>codeCard(data,c,proof.systems)),matches.length);
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
