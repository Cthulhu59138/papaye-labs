const ink='#284139',paper='#fffdf6';
const line=(a,b)=>[a,[a[0]+(b[0]-a[0])*.12,a[1]+(b[1]-a[1])*.12],[a[0]+(b[0]-a[0])*.23,a[1]+(b[1]-a[1])*.23],[a[0]+(b[0]-a[0])*.33,a[1]+(b[1]-a[1])*.33],[a[0]+(b[0]-a[0])*.45,a[1]+(b[1]-a[1])*.45],[a[0]+(b[0]-a[0])*.56,a[1]+(b[1]-a[1])*.56],[a[0]+(b[0]-a[0])*.66,a[1]+(b[1]-a[1])*.66],[a[0]+(b[0]-a[0])*.78,a[1]+(b[1]-a[1])*.78],[a[0]+(b[0]-a[0])*.9,a[1]+(b[1]-a[1])*.9],b];
export const initial=[line([185,185],[185,55]),line([255,185],[400,185]),line([255,255],[255,390]),line([185,255],[40,255])];
export const folded=[
  [[185,185],[185,135],[170,75],[220,75],[270,75],[270,100],[270,150],[270,220],[270,300],[270,390]],
  [[255,185],[305,185],[385,170],[385,220],[385,270],[360,270],[310,270],[240,270],[140,270],[40,270]],
  [[255,255],[255,305],[270,390],[220,390],[170,390],[170,365],[170,315],[170,245],[170,145],[170,50]],
  [[185,255],[135,255],[50,270],[50,220],[50,170],[75,170],[125,170],[195,170],[300,170],[400,170]]
];
const beforeTunnel=folded[3].map(p=>[...p]);beforeTunnel[7]=[165,170];beforeTunnel[8]=[205,170];beforeTunnel[9]=[235,170];
const tight=[
  [[185,185],[193,183],[228,179],[232,194],[233,204],[232,212],[232,235],[232,280],[232,330],[232,390]],
  [[255,185],[262,194],[268,229],[250,232],[234,232],[225,232],[210,232],[150,232],[90,232],[40,232]],
  [[255,255],[245,268],[207,267],[208,248],[208,235],[208,220],[208,205],[208,150],[208,90],[208,50]],
  [[185,255],[174,241],[174,207],[190,208],[205,208],[220,208],[235,208],[280,208],[340,208],[400,208]]
];
export const blend=(a,b,t)=>a.map((p,i)=>p.map((v,j)=>v+(b[i][j]-v)*t));
const d=points=>`M${points[0].join(' ')} C${points.slice(1).map(p=>p.map(v=>Number(v.toFixed(2))).join(' ')).join(' ')}`;
function stroke(path,color,width=14,extra=''){return `<path d="${path}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;}
function cord(path,color,width=14){return stroke(path,'#243d3420',width+4)+stroke(path,color,width)+stroke(path,'#ffffff',2,'opacity=".4"');}
function txt(text,x,y,size=14,fill=ink,anchor='middle'){return `<text x="${x}" y="${y}" font-family="Trebuchet MS,Arial,sans-serif" font-weight="600" font-size="${size}" text-anchor="${anchor}" fill="${fill}">${text}</text>`;}
function arrow(path){return `<path d="${path}" fill="none" stroke="#768b7e" stroke-width="2.5" stroke-dasharray="4 7" stroke-linecap="round" marker-end="url(#arrow)"/>`;}
function tag(n,x,y,color,active=false,interactive=true){return `<g ${interactive?`role="button" tabindex="0" aria-label="Fil ${n}" data-strand="${n}" style="cursor:pointer"`:'aria-hidden="true"'}><circle cx="${x}" cy="${y}" r="25" fill="transparent"/>${active?`<circle cx="${x}" cy="${y}" r="23" fill="none" stroke="#dba528" stroke-width="3"/>`:''}<circle cx="${x}" cy="${y}" r="17" fill="#fffdf6" stroke="${color}" stroke-width="4"/>${txt(n,x,y+6,18,ink)}</g>`;}
function base(inner,title){return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 440 440" role="img" aria-label="${title}"><defs><pattern id="dots" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#d6e0d2"/></pattern><marker id="arrow" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M2 2L10 6L2 10" fill="none" stroke="#768b7e" stroke-width="2" stroke-linejoin="round"/></marker></defs><rect width="440" height="440" rx="26" fill="${paper}"/><rect x="12" y="12" width="416" height="416" rx="20" fill="url(#dots)"/>${inner}</svg>`;}
export function strandState(stage,t=1){t=Math.max(0,Math.min(1,t));let paths=initial.map(p=>p.map(a=>[...a]));if(stage==='cross')return paths;if(typeof stage!=='number')return paths;for(let k=1;k<=Math.min(stage,3);k++)paths[k-1]=k===stage?blend(initial[k-1],folded[k-1],t):folded[k-1];if(stage===4)paths[3]=blend(initial[3],beforeTunnel,t);if(stage===5)paths[3]=blend(beforeTunnel,folded[3],t);if(stage===6)paths=folded.map((p,i)=>blend(p,tight[i],t));return paths;}
export function stitchScene(stage,t,colors,active=0){
  const paths=strandState(stage,t);let inner=`<circle cx="220" cy="220" r="52" fill="#e8ebdf" opacity=".65"/>`;
  inner+=txt('HAUT',220,24,10,'#849384');inner+=txt('VERS TOI',220,431,10,'#849384');
  const order=stage===1?[1,2,3,0]:stage===2?[2,3,0,1]:stage===3?[3,0,1,2]:[0,1,2,3];
  order.forEach(i=>{const c=colors[i%2];inner+=`<g opacity="${active && i+1 !== active ? 0.72 : 1}">${cord(d(paths[i]),c)}</g>`;});
  // Preserve the crossings already made near each strand's fixed root.
  if(typeof stage==='number'&&stage>=2&&stage<6)inner+=cord('M270 169 L270 201',colors[0]);
  if(typeof stage==='number'&&stage>=3&&stage<6)inner+=cord('M241 270 L280 270',colors[1]);
  if(typeof stage==='number'&&stage>=4&&stage<6)inner+=cord('M170 239 L170 260',colors[0]);
  if(stage===5&&t>.22){inner+=cord('M270 152 L270 188',colors[0]);}
  if(stage===6){const x=270+(232-270)*t,y=170+(208-170)*t;inner+=cord(`M${x} ${y-15}L${x} ${y+15}`,colors[0]);}
  if(stage==='cross'){inner+=`<rect x="190" y="190" width="60" height="60" rx="20" fill="#e1e6d6" stroke="#b6c5aa" stroke-width="2"/>`;inner+=txt('nœud',220,225,12,'#657a5c');}
  if(stage===1&&t>.8)inner+=txt('Garde ce trou',304,65,13)+arrow('M300 75 Q286 92 248 106');
  if(stage===2&&t>.8)inner+=txt('2 au-dessus de 1',290,327,13)+arrow('M289 307L276 284');
  if(stage===3&&t>.8)inner+=txt('3 au-dessus de 2',108,322,13)+arrow('M123 305L160 282');
  if(stage===4&&t>.8)inner+=txt('Stop ici',232,128,14)+arrow('M232 137L235 150');
  if(stage===5&&t>.8){inner+=`<circle cx="270" cy="170" r="30" fill="none" stroke="#e1b849" stroke-width="3" stroke-dasharray="5 5"/>`;inner+=txt('4 SOUS 1',317,121,13)+arrow('M308 130L290 150');}
  if(stage===6&&t>.9){inner+=`<g opacity="${(t-.9)*10}"><rect x="201" y="201" width="38" height="38" rx="6" fill="${colors[0]}"/><path d="M220 204H236V220H220ZM204 220H220V236H204Z" fill="${colors[1]}"/></g>`;inner+=arrow('M265 335L265 377')+arrow('M103 267L57 267')+arrow('M175 107L175 63')+arrow('M335 175L385 175');}
  paths.forEach((p,i)=>{const [x,y]=p[9],offset=[[23,0],[0,23],[-23,0],[0,-23]][i];inner+=stroke(`M${x} ${y}L${x+offset[0]} ${y+offset[1]}`,colors[i%2],3)+tag(i+1,x+offset[0],y+offset[1],colors[i%2],i+1===active);});
  return base(inner,stage==='cross'?'Les quatre fils en croix : 1 en haut, 2 à droite, 3 en bas, 4 à gauche.':`Démonstration du passage des fils, geste ${stage}. Le fil à déplacer porte un cercle jaune.`);
}
export function tunnelScene(colors,t=1){const x=20+Math.max(0,Math.min(1,t))*300;return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 150" role="img" aria-label="Gros plan de côté : le fil 4 passe sous le pont formé par le fil 1."><rect width="360" height="150" rx="18" fill="#fff2d3"/>${stroke('M85 113 Q85 25 180 25 Q275 25 275 113',colors[0],18)}${stroke(`M20 96 L${x} 96`,colors[1],14)}${x>266?stroke('M273 92 L275 113',colors[0],18):''}${tag(4,x,96,colors[1],false,false)}${tag(1,180,25,colors[0],false,false)}${txt('DANS LA BOUCLE',180,142,11,'#7d6334')}</svg>`;}
export function scoubiArt(colors,rows=10,face=true){let pattern='';for(let i=0;i<Math.min(18,rows);i++){const y=145+i*12;pattern+=`<rect x="177" y="${y}" width="76" height="16" rx="8" fill="${colors[i%2]}"/><path d="M188 ${y+5}L239 ${y+10}" stroke="${colors[(i+1)%2]}" stroke-width="8" stroke-linecap="round"/><path d="M188 ${y+3}h16" stroke="#fff" opacity=".3" stroke-width="2.5" stroke-linecap="round"/>`;}
  const y=145+Math.min(18,rows)*12;return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 440 440" role="img" aria-label="Un scoubidou aux deux couleurs choisies, avec une boucle et une petite frange."><defs><filter id="softshadow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="5" dy="12" stdDeviation="6" flood-color="#46675c" flood-opacity=".16"/></filter></defs><g transform="rotate(-13 220 220)" filter="url(#softshadow)">${cord('M192 145 C100 10 333 13 240 145',colors[0],17)}${stroke('M203 145 C135 32 295 30 228 145',colors[1],10)}${pattern}${cord(`M189 ${y} Q165 ${y+38} 178 ${y+65}`,colors[0],11)}${cord(`M208 ${y} Q202 ${y+35} 210 ${y+75}`,colors[1],11)}${cord(`M229 ${y} Q236 ${y+40} 247 ${y+62}`,colors[0],11)}${cord(`M244 ${y} Q275 ${y+25} 275 ${y+55}`,colors[1],11)}${face?`<ellipse cx="199" cy="192" rx="9" ry="12" fill="white"/><ellipse cx="230" cy="192" rx="9" ry="12" fill="white"/><circle cx="201" cy="194" r="4" fill="${ink}"/><circle cx="229" cy="194" r="4" fill="${ink}"/>${stroke('M207 214Q215 223 223 214',ink,3)}`:''}</g></svg>`;}
export function preparationScene(which,t,colors){
  if(which==='cross')return stitchScene('cross',1,colors);
  if(which==='reward')return scoubiArt(colors,8,true);
  if(which==='finish')return scoubiArt(colors,12,false);
  let inner='';
  if(which==='fold'){
    const straightA=line([135,90],[135,360]),foldA=[[135,360],[135,275],[135,120],[155,110],[175,100],[185,100],[195,110],[215,120],[215,275],[215,360]];
    const straightB=line([225,90],[225,360]),foldB=[[225,360],[225,275],[225,120],[245,110],[265,100],[275,100],[285,110],[305,120],[305,275],[305,360]];
    inner+=cord(d(blend(straightA,foldA,t)),colors[0],12)+cord(d(blend(straightB,foldB,t)),colors[1],12);
    inner+=txt(t>.85?'Deux plis en haut':'Deux longs fils',220,45,18);if(t>.85)inner+=txt('4 bouts ensemble',220,401,15);
  }else{
    inner+=cord('M170 365 L190 180 C100 25 333 20 240 180 L270 365',colors[0],12)+cord('M205 365 L202 180 C140 55 293 50 227 180 L235 365',colors[1],11);
    inner+=`<ellipse cx="216" cy="183" rx="34" ry="22" fill="${colors[0]}"/>`+stroke('M192 172 Q213 207 239 171',colors[1],15);
    inner+=txt('petite boucle',322,81,14)+arrow('M287 88L248 99');inner+=txt('nœud du grand',92,213,14)+arrow('M121 202L180 184');inner+=txt('4 bouts libres',220,408,15);
  }
  return base(inner,which==='fold'?'Deux fils se plient en deux pour obtenir quatre bouts.':'Résultat du nœud de départ à préparer par un adulte : une boucle et quatre brins.');
}
