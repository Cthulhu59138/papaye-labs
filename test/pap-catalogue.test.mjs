import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createCatalogueSearch} from '../public/pap/catalogue.mjs';

const catalog = JSON.parse(await readFile(new URL('../public/pap/catalogue.json',import.meta.url)));
const search = createCatalogueSearch(catalog);
const pair = text => catalog.couples.find(c=>c.serie+' '+c.groupe===text);
const titles = result => result.results.map(item=>item.title);

test('PAP : intégrité des couples, associations, produits et documents officiels',()=>{
  const codes=new Set(catalog.couples.map(c=>c.serie+' '+c.groupe));
  assert.equal(codes.size,934);
  assert.equal(Object.keys(catalog.series).length,69);
  assert.equal(Object.keys(catalog.groupes).length,105);
  assert.equal(Object.keys(catalog.systemes).length,103);
  assert.equal(catalog.couples.filter(c=>c.fnp.length).length,399);
  assert.equal(catalog.couples.reduce((a,c)=>a+c.fnp.length,0),1508);
  assert.equal(Object.values(catalog.systemes).reduce((a,s)=>a+s.produits.length,0),471);
  for(const c of catalog.couples){
    assert.ok(catalog.series[c.serie] && catalog.groupes[c.groupe]);
    assert.match(c.groupe,/^\d{3}$/);
    assert.equal(new Set(c.fnp).size,c.fnp.length);
    for(const n of c.fnp) assert.ok(catalog.systemes[n]);
    assert.equal(new URL(c.url).origin,'https://fnp.edf.fr');
  }
  for(const s of Object.values(catalog.systemes)){
    assert.ok(s.indice && s.revision && s.produits.length);
    for(const url of [s.fiche,s.ft]) assert.equal(new URL(url).origin,'https://fnp.edf.fr');
  }
});

test('PAP : les libellés publics utilisent le vocabulaire du catalogue FNP', () => {
  const visibleText = JSON.stringify(catalog, (key, value) =>
    typeof value === 'string' && value.startsWith('https://') ? undefined : value
  );
  assert.doesNotMatch(visibleText, /\bEDF\b|électricité de france/i);
});

test('PAP : les codes et numéros exacts préservent la source, les zéros et les absences',()=>{
  assert.equal(search('eea200').results[0].title,'EEA 200');
  assert.ok(pair('EEA 200').fnp.every(n=>search('EEA-200').results[0].detail.includes(String(n))));
  assert.equal(search('PTC010').results[0].title,'PTC 010');
  assert.match(search('EEA 202').message,/Aucun système publié/);
  assert.equal(search('PTC 999').total,0);
  assert.equal(search('FNP 9999').total,0);
  assert.match(search('EEA 200 FNP 0').message,/n’associe pas/);
  assert.match(search('FNP 1119 et FNP 1118').message,/un numéro FNP à la fois/);
  assert.match(search('EEA 200 FNP 1119').message,/n’associe pas/);
  assert.match(search('123').message,/groupe et un numéro FNP/);
  const reference=search('FNP 1119').results[0];
  assert.match(reference.title,/1119/);
  assert.match(reference.detail,/PLE 310/);
  assert.ok(reference.links.some(l=>l.url.endsWith('/28921')));
  assert.ok(titles(search('EPODUR NV 75-25')).some(t=>t.startsWith('FNP 1119')));
});

test('PAP : seuils stricts, limites incluses, libellés tronqués et divergence 154',()=>{
  assert.match(search('EEA 200 à 60 °C').message,/16 système/);
  assert.match(search('EEA 200 à 60,1°C').message,/hors de la plage/);
  assert.match(search('PTC 010 à 10°C').message,/hors de la plage/);
  assert.match(search('EEA 204 à 120°C').message,/système\(s\)/);
  assert.match(search('PEA 205 à 120°C').message,/hors de la plage/);
  assert.match(search('EIA 154').results[0].detail,/Divergence entre le groupe et la fiche technique.*sols/);
  assert.match(search('EIA 154 à 30°C').message,/ne permet pas/);
  assert.match(search('PLE 310').results[0].detail,/1118, 1119/);
  assert.match(search('PLE310 à 49°C').message,/Seul le seuil documenté pour le FNP 1119/);
  assert.match(search('PLE310 à 50°C').message,/ne permet pas/);
  assert.match(search('ELE310 FNP 1118 à 20°C').message,/ne permet pas/);
  assert.match(search('groupe 310').message,/protection cathodique/);
  assert.match(search('acier à plus de 60°C').message,/intervalle/);
  assert.match(search('EEA 204 50–80 °C').message,/intervalle/);
  assert.match(search('EEA 204 50-80 °C').message,/intervalle/);
  assert.match(search('acier entre 60 et 120°C').message,/intervalle/);
});

test('PAP : recherche multi-critères sans extrapoler les seuils ni confondre les milieux',()=>{
  assert.ok(titles(search('entretien, acier brut extérieur à 40°C')).includes('EEA 200'));
  assert.equal(search('entretien acier brut extérieur à 70°C').total,0);
  assert.ok(titles(search('mur intérieur béton lessivable')).includes('EIA 151'));
  assert.deepEqual(new Set(titles(search('acier eau de mer abrasion'))),new Set(['ELE 310','PLE 310']));
  assert.equal(search('acier béton banane').total,0);
  assert.equal(search('aucunmateriauconnu').total,0);
  assert.equal(search('').total,0);
  assert.ok(titles(search('entretien intérieur vapeurs acides béton lessivable')).every(x=>!x.startsWith('EIA')));
});

test('PAP : les produits MAT avec numéro restent des noms commerciaux',()=> {
  assert.ok(titles(search('MAT 450')).some(t=>t.startsWith('FNP 1112')));
  assert.ok(titles(search('MAT 300')).some(t=>t.startsWith('FNP 1149')));
});
