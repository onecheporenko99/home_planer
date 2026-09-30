import {fixtureDefinition} from './engineering-catalog.mjs';
import {openingGeometry} from './openings.mjs';
import {resolveEngineering} from './engineering-math.mjs';
export const defaultLayers=()=>[
 ['plot','Участок'],['buildings','Постройки'],['walls','Стены'],['openings','Окна и двери'],['plumbing','Сантехника'],['pipes','Трубы'],['electrical','Электрические предметы'],['wires','Провода'],['paths','Дорожки'],['dimensions','Размеры'],['labels','Подписи']
].map(([id,name])=>({id,name,visible:true,locked:false}));
export const defaultLayerId=o=>({outline:'plot',plot:'plot',building:'buildings',wall:'walls',door:'openings',window:'openings',pipe:'pipes',wire:'wires',path:'paths'})[o.type]??(fixtureDefinition(o.kind)?.category==='electrical'?'electrical':'plumbing');
export const layerOf=(p,o)=>p.layers?.find(l=>l.id===(o.layerId??defaultLayerId(o)));
export const layerVisible=(p,id)=>p.layers?.find(l=>l.id===id)?.visible!==false;
export const isVisible=(p,o)=>layerOf(p,o)?.visible!==false;
export const isLocked=(p,o)=>layerOf(p,o)?.locked===true;
export function withLayers(p){return {...p,layers:p.layers??defaultLayers(),objects:p.objects.map(o=>({...o,layerId:o.layerId??defaultLayerId(o)})),openings:p.openings.map(o=>({...o,layerId:o.layerId??defaultLayerId(o)}))};}
export function validateLayers(p){
 if(!Array.isArray(p.layers)||p.layers.length!==11)throw Error('Некорректные слои');
 const ids=new Set();for(const l of p.layers){if(!l||!defaultLayers().some(n=>n.id===l.id)||ids.has(l.id)||typeof l.name!=='string'||l.name.length>80||typeof l.visible!=='boolean'||typeof l.locked!=='boolean')throw Error('Некорректный слой');ids.add(l.id)}
 for(const o of [...p.objects,...p.openings])if(!ids.has(o.layerId)||['dimensions','labels'].includes(o.layerId))throw Error('Не найден геометрический слой объекта');
}
/** @param {import('./types').Project} p @returns {import('./types').Project} */
export function snapProject(p,includeLocked=true){return {...p,objects:p.objects.filter(o=>isVisible(p,o)&&(includeLocked||!isLocked(p,o))),openings:p.openings.filter(o=>isVisible(p,o)&&(includeLocked||!isLocked(p,o)))};}
// Compare both stored properties and derived geometry, including indirect shared-node edits.
export function assertLayerEdits(before,after){
 if(before.id!==after.id)return;
 before=resolveEngineering(before);after=resolveEngineering(after);
 const fingerprint=(p,o)=>{const g=o.wallId?openingGeometry(p,o):null;return JSON.stringify([o,o.vertexIds?.map(id=>p.nodes[id]),g?{a:g.a,b:g.b,angle:g.angle,thickness:g.wall.thickness}:null])};
 for(const old of [...before.objects,...before.openings])if(isLocked(before,old)){
  const next=[...after.objects,...after.openings].find(o=>o.id===old.id);
  if(!next||fingerprint(before,old)!==fingerprint(after,next))throw Error(`Слой «${layerOf(before,old).name}» заблокирован: изменение затрагивает «${old.name}»`);
 }
 for(const next of [...after.objects,...after.openings])if(![...before.objects,...before.openings].some(o=>o.id===next.id)&&isLocked(after,next))throw Error(`Слой «${layerOf(after,next).name}» заблокирован. Разблокируйте его перед построением`);
}
