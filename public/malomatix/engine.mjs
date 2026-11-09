export const GAMES = [
  {id:'compare',name:'Comparer',tag:'Observe les quantités',icon:'≷',color:'mint'},
  {id:'flash',name:'Flash',tag:'Ouvre grand les yeux',icon:'✦',color:'peach'},
  {id:'calculation',name:'Calcul',tag:'Des jetons pour compter',icon:'+',color:'yellow'},
  {id:'sequence',name:'Suites logiques',tag:'Trouve ce qui vient après',icon:'● ▲',color:'lilac'},
  {id:'puzzle',name:'Puzzles',tag:'Chaque pièce à sa place',icon:'◒',color:'blue'},
  {id:'tens',name:'Fabrique des dizaines',tag:'Des graines et des paquets',icon:'10',color:'mint'},
  {id:'market',name:'Petit marché',tag:'À toi de payer le juste prix',icon:'€',color:'yellow'},
  {id:'robot',name:'Robot jardinier',tag:'Un chemin pour la fleur',icon:'↗',color:'peach'},
];
export const DIRECTIONS={up:[0,-1,'↑'],down:[0,1,'↓'],left:[-1,0,'←'],right:[1,0,'→']};
const animals=['🐝','🐢','🐞','🦋','🐟','🐸'];
const shapes=['●','▲','■','★','◆'];
export const int=(min,max,rng=Math.random)=>min+Math.floor(rng()*(max-min+1));
export function shuffle(values,rng=Math.random){const a=[...values];for(let i=a.length-1;i>0;i--){const j=int(0,i,rng);[a[i],a[j]]=[a[j],a[i]];}return a;}
function pick(a,rng){return a[int(0,a.length-1,rng)];}
function choices(answer,max,rng){return shuffle([answer,...shuffle(Array.from({length:max+1},(_,i)=>i).filter(n=>n!==answer),rng).slice(0,2)],rng);}
export function robotPath(q){const queue=[[q.start,[]]],seen=new Set([q.start]);while(queue.length){const [cell,path]=queue.shift();if(cell===q.goal)return path;for(const dir of Object.keys(DIRECTIONS)){const next=step(q,cell,dir);if(next!==null&&!seen.has(next)){seen.add(next);queue.push([next,[...path,dir]]);}}}return null;}
function step(q,cell,dir){const d=DIRECTIONS[dir];if(!d)return null;const x=cell%q.size+d[0],y=Math.floor(cell/q.size)+d[1];if(x<0||y<0||x>=q.size||y>=q.size)return null;const n=y*q.size+x;return q.stones.includes(n)?null:n;}
export function simulateRobot(q,program=q.program){let cell=q.start;const trace=[cell];for(const dir of program){const next=step(q,cell,dir);if(next===null)return {success:false,blocked:true,trace};cell=next;trace.push(cell);}return {success:program.length>0&&cell===q.goal,blocked:false,trace};}
export function marketSolutions(q){const solutions=[];for(let mask=0;mask<2**q.wallet.length;mask++){const selected=q.wallet.map((_,i)=>i).filter(i=>mask&(1<<i));if(selected.reduce((n,i)=>n+q.wallet[i],0)===q.target)solutions.push(selected);}return solutions;}
export const payment=q=>q.selected.reduce((n,i)=>n+q.wallet[i],0);
export const tensTotal=q=>q.packs*10+q.units;
export function tensMove(q,action){const n={...q};const total=tensTotal(q);if(action==='add1'&&total<20)n.units++;else if(action==='remove1'&&q.units>0)n.units--;else if(action==='add10'&&total<=10)n.packs++;else if(action==='remove10'&&q.packs>0)n.packs--;else if(action==='group'&&q.units>=10){n.units-=10;n.packs++;}else if(action==='ungroup'&&q.packs>0){n.packs--;n.units+=10;}return n;}
export function makeQuestion(game,profile,round=0,options={},rng=Math.random,previous=null){
 const adult=profile==='adult',level=options.level||1,animal=pick(animals,rng);
 if(game==='compare'){const max=adult?12:level===1?6:8;const a=int(1,max,rng);let b=pick(Array.from({length:max},(_,i)=>i+1).filter(n=>n!==a),rng);const variant=options.variant||'more';if(variant==='equal'&&rng()<.5)b=a;return {a,b,animal,variant,answer:variant==='equal'?(a===b?'yes':'no'):variant==='less'?(a<b?'left':'right'):(a>b?'left':'right')};}
 if(game==='flash'){const max=adult?10:level===1?6:8;const answer=int(1,max,rng);return {answer,animal,choices:choices(answer,max,rng),observed:false};}
 if(game==='calculation'){const max=adult?20:10,operation=options.operation||'add';const a=int(operation==='add'?0:1,max,rng),b=int(0,operation==='add'?max-a:a,rng),answer=operation==='add'?a+b:a-b;return {a,b,operation,answer,animal,choices:choices(answer,max,rng)};}
 if(game==='sequence'){
  if(round%2===0){const cycle=shuffle(shapes,rng).slice(0,round===0?2:3);const shown=Array.from({length:cycle.length*2},(_,i)=>cycle[i%cycle.length]);const answer=cycle[0];return {kind:'shapes',shown,answer,choices:shuffle([answer,...shapes.filter(s=>s!==answer).slice(0,2)],rng),rule:'Observe le petit groupe qui se répète.'};}
  const amount=level>=3?2:1,sign=rng()<.5?1:-1,delta=amount*sign,max=level>=3?20:level===2||adult?10:9;const start=delta>0?int(1,max-4*amount,rng):int(1+4*amount,max,rng);const shown=Array.from({length:4},(_,i)=>start+i*delta),answer=start+4*delta;return {kind:level===1&&!adult?'dots':'numbers',shown,answer,choices:choices(answer,max,rng),rule:`À chaque case, on ${delta>0?'ajoute':'retire'} ${amount}.`};
 }
 if(game==='puzzle'){const missing=shuffle([0,1,2,3],rng).slice(0,adult?4:level>=2?3:2);return {model:round,missing,placed:[],tray:shuffle(missing,rng),selected:null};}
 if(game==='tens'){const pool=Array.from({length:11},(_,i)=>i+10).filter(n=>n!==previous?.target);const target=!adult&&round===0?int(5,9,rng):pick(pool,rng);return {target,packs:round%2===0&&round>0&&target!==10?1:0,units:round%2===1?target:0};}
 if(game==='market'){const wallet=shuffle(!adult&&round===0?[2,2,1,1,1]:!adult&&round===1?[5,2,2,1,1,1]:pick([[10,5,2,1,1,1],[5,5,5,2,1,1,1],[10,2,2,2,1,1,1,1]],rng),rng);const min=!adult&&round===0?3:6,max=wallet.reduce((a,b)=>a+b,0);const possible=Array.from({length:max-min+1},(_,i)=>min+i).filter(target=>target!==previous?.target&&marketSolutions({wallet,target}).length);return {target:pick(possible,rng),wallet,selected:[],item:round};}
 if(game==='robot'){
  const size=adult?4:3,start=int(0,size*size-1,rng),distance=cell=>Math.abs(cell%size-start%size)+Math.abs(Math.floor(cell/size)-Math.floor(start/size));const max=adult?6:round<2?3:4;const goal=pick(Array.from({length:size*size},(_,i)=>i).filter(i=>distance(i)>=2&&distance(i)<=max&&!(previous?.start===start&&previous?.goal===i)),rng);const q={size,start,goal,stones:[],program:[],attempted:false};
  if(round>=2){const path=simulateRobot(q,robotPath(q)).trace;const candidates=Array.from({length:size*size},(_,i)=>i).filter(i=>!path.includes(i));if(candidates.length)q.stones=[pick(candidates,rng)];}return q;
 }
 throw Error('Unknown game');
}
export function newSession(game,profile='child',options={},rng=Math.random){if(!GAMES.some(g=>g.id===game))throw Error('Unknown game');return {id:`${Date.now()}-${rng().toString(36).slice(2)}`,game,profile,options:{level:1,...options},round:0,status:'playing',correct:0,helped:false,feedback:null,question:makeQuestion(game,profile,0,options,rng),rewarded:false};}
function resolve(s,correct,message){s.status='feedback';s.feedback={correct,message};if(correct&&!s.helped)s.correct++;return s;}
export function act(session,action,value){
 const s=structuredClone(session),q=s.question;if(s.status!=='playing')return s;
 if(action==='help'){s.helped=true;return s;}
 if(action==='observe'&&s.game==='flash'){q.observed=true;return s;}
 if(action==='answer'&&['compare','flash','calculation','sequence'].includes(s.game)){
  if(s.game==='flash'&&!q.observed)return s;
  const valid=s.game==='compare'?(q.variant==='equal'?['yes','no']:['left','right']):q.choices;if(!valid.includes(value))return s;
  const correct=value===q.answer;let message='';
  if(s.game==='compare')message=q.a===q.b?`Il y en a ${q.a} de chaque côté : autant !`:`${Math.max(q.a,q.b)} est plus grand que ${Math.min(q.a,q.b)}.`;
  if(s.game==='flash')message=`Il y avait ${q.answer} animaux. Bien observer, ça s’apprend !`;
  if(s.game==='calculation')message=`${q.a} ${q.operation==='add'?'+':'−'} ${q.b} = ${q.answer}.`;
  if(s.game==='sequence')message=`La suite continue avec ${q.answer}. ${q.kind==='shapes'?'Le motif se répète dans le même ordre.':q.rule}`;
  return resolve(s,correct,message);
 }
 if(s.game==='tens'&&action==='tens'){s.question=tensMove(q,value);if(tensTotal(s.question)===q.target&&s.question.units<10)return resolve(s,true,`${s.question.packs} dizaine${s.question.packs>1?'s':''} et ${s.question.units} unité${s.question.units>1?'s':''} : ${q.target} !`);}
 if(s.game==='market'&&action==='coin'&&Number.isInteger(value)&&value>=0&&value<q.wallet.length){q.selected=q.selected.includes(value)?q.selected.filter(i=>i!==value):[...q.selected,value];if(payment(q)===q.target)return resolve(s,true,`Exactement ${q.target} € : le compte est bon !`);}
 if(s.game==='puzzle'){
  if(action==='piece'&&q.missing.includes(value)&&!q.placed.includes(value))q.selected=value;
  if(action==='place'&&q.missing.includes(value)&&!q.placed.includes(value)&&q.selected!==null){if(q.selected===value){q.placed.push(value);q.selected=null;q.error=false;if(q.placed.length===q.missing.length)return resolve(s,true,'Toutes les pièces sont à leur place !');}else{q.error=true;s.helped=true;}}
 }
 if(s.game==='robot'){
  const max=q.size===3?6:8;
  if(action==='arrow'&&DIRECTIONS[value]&&q.program.length<max){q.program.push(value);q.attempted=false;}
  if(action==='erase'){q.program.pop();q.attempted=false;}
  if(action==='launch'&&q.program.length){q.attempted=true;const result=simulateRobot(q);if(result.success)return resolve(s,true,'La fleur est arrosée. Bien joué, jardinier !');s.helped=true;}
 }
 return s;
}
export function nextRound(session,rng=Math.random){const s=structuredClone(session);if(s.status!=='feedback')return s;if(s.round===4){s.status='done';return s;}s.round++;s.question=makeQuestion(s.game,s.profile,s.round,s.options,rng,s.question);s.status='playing';s.feedback=null;s.helped=false;return s;}
export function hint(s){const q=s.question;
 if(s.game==='compare')return 'Compte les animaux de chaque groupe, un par un. Le dernier nombre dit combien il y en a.';
 if(s.game==='flash')return 'Observe les petits groupes : deux et deux font quatre. Tu peux revoir les animaux avec le bouton « Revoir ».';
 if(s.game==='calculation')return q.operation==='add'?`Pars de ${q.a}, puis ajoute ${q.b} jetons. Tu peux les compter tous.`:`Pars de ${q.a} jetons et enlèves-en ${q.b}. Compte ceux qui restent.`;
 if(s.game==='sequence')return q.rule;
 if(s.game==='puzzle')return 'Regarde le modèle, choisis une pièce, puis touche son emplacement. Les lignes et les couleurs se rejoignent.';
 if(s.game==='tens')return q.units>=10?'Tu as au moins dix graines libres. Le bouton « 10 → paquet » les regroupe sans changer la quantité.':`${q.target} se construit avec ${Math.floor(q.target/10)} paquet de dix et ${q.target%10} graines seules.`;
 if(s.game==='market'){const chosen=new Set(q.selected);const solution=marketSolutions(q).sort((a,b)=>a.filter(i=>!chosen.has(i)).length+q.selected.filter(i=>!a.includes(i)).length-b.filter(i=>!chosen.has(i)).length-q.selected.filter(i=>!b.includes(i)).length)[0];const remove=q.selected.find(i=>!solution.includes(i));const add=solution.find(i=>!chosen.has(i));return remove!==undefined?`Essaie de retirer une pièce ou un billet de ${q.wallet[remove]} € de ton paiement.`:`Essaie d’ajouter ${q.wallet[add]} € à ton paiement.`;}
 return `Voici un chemin possible : ${robotPath(q).map(d=>DIRECTIONS[d][2]).join(' ')}. Les flèches suivent les directions de l’écran.`;
}
export function validSession(s){try{
 if(!s||!GAMES.some(g=>g.id===s.game)||!['child','adult'].includes(s.profile)||!Number.isInteger(s.round)||s.round<0||s.round>4||!['playing','feedback','done'].includes(s.status)||typeof s.id!=='string'||s.id.length>100||!Number.isInteger(s.correct)||s.correct<0||s.correct>5||![1,2,3].includes(s.options?.level))return false;
 const q=s.question,n=(v,a,b)=>Number.isInteger(v)&&v>=a&&v<=b,unique=a=>new Set(a).size===a.length;
 if(!q||typeof q!=='object')return false;
 if(s.status==='done'&&s.round!==4)return false;
 if(s.status==='feedback'&&(!s.feedback||typeof s.feedback.message!=='string'||s.feedback.message.length>300))return false;
 if(s.game==='compare')return n(q.a,1,12)&&n(q.b,1,12)&&animals.includes(q.animal)&&['more','less','equal'].includes(q.variant)&&['left','right','yes','no'].includes(q.answer);
 if(['flash','calculation','sequence'].includes(s.game)){if(!Array.isArray(q.choices)||q.choices.length!==3||!unique(q.choices)||!q.choices.includes(q.answer))return false;if(s.game==='sequence')return ['shapes','dots','numbers'].includes(q.kind)&&Array.isArray(q.shown)&&q.shown.length>=4&&q.shown.length<=6&&[...q.shown,...q.choices].every(v=>shapes.includes(v)||n(v,0,20))&&typeof q.rule==='string'&&q.rule.length<100;if(!n(q.answer,0,20)||!q.choices.every(v=>n(v,0,20))||!animals.includes(q.animal))return false;return s.game==='flash'||(n(q.a,0,20)&&n(q.b,0,20)&&['add','subtract'].includes(q.operation)&&q.answer===(q.operation==='add'?q.a+q.b:q.a-q.b));}
 if(s.game==='tens')return n(q.target,1,20)&&n(q.packs,0,2)&&n(q.units,0,20)&&tensTotal(q)<=20;
 if(s.game==='market')return n(q.item,0,4)&&n(q.target,1,20)&&Array.isArray(q.wallet)&&q.wallet.length>0&&q.wallet.length<=8&&q.wallet.every(v=>[1,2,5,10].includes(v))&&q.wallet.reduce((a,b)=>a+b,0)<=20&&Array.isArray(q.selected)&&unique(q.selected)&&q.selected.every(v=>n(v,0,q.wallet.length-1))&&marketSolutions(q).length>0;
 if(s.game==='puzzle')return n(q.model,0,4)&&Array.isArray(q.missing)&&q.missing.length>=2&&q.missing.length<=4&&unique(q.missing)&&q.missing.every(v=>n(v,0,3))&&Array.isArray(q.placed)&&unique(q.placed)&&q.placed.every(v=>q.missing.includes(v))&&Array.isArray(q.tray)&&q.tray.length===q.missing.length&&unique(q.tray)&&q.tray.every(v=>q.missing.includes(v))&&(q.selected===null||q.missing.includes(q.selected));
 if(s.game==='robot')return [3,4].includes(q.size)&&n(q.start,0,q.size**2-1)&&n(q.goal,0,q.size**2-1)&&q.start!==q.goal&&Array.isArray(q.stones)&&q.stones.length<=1&&q.stones.every(v=>n(v,0,q.size**2-1)&&v!==q.start&&v!==q.goal)&&Array.isArray(q.program)&&q.program.length<=(q.size===3?6:8)&&q.program.every(d=>Object.hasOwn(DIRECTIONS,d))&&robotPath(q)!==null;
 return false;
}catch{return false;}}
