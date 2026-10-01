import {synchronizeFloors} from './floors.mjs';
import {synchronizeWorkspace,variantProject} from './workspace.mjs';
import {wallLength} from './curved-walls.mjs';
import {routeLength,pathArea} from './engineering.mjs';
import {contourArea} from './contour-math.mjs';
import {roomMetrics} from './room-math.mjs';
export const categories={wall:'Стены',fence:'Ограждения',door:'Двери',window:'Окна',socket:'Розетки',switch:'Выключатели',light:'Светильники',fixture:'Предметы',room:'Комнаты',path:'Дорожки',covering:'Покрытия / контуры',building:'Пятна построек',plot:'Участок',pipe:'Трубы',wire:'Провода',stair:'Лестницы',post:'Столбы',section:'Секции',gate:'Ворота / калитки'};
export function billContext(input,variantId){let p=synchronizeWorkspace(synchronizeFloors(input));if(variantId&&p.workspace&&variantId!==p.workspace.activeVariantId)p=variantProject(p,variantId);return synchronizeFloors(p)}
export function buildBill(input,{variantId,buildingId='',floorId='',category='',reservePercent=0}={}){
 if(!Number.isFinite(reservePercent)||reservePercent<0||reservePercent>100)throw Error('Монтажный запас: от 0 до 100%');
 const p=billContext(input,variantId),m=p.floorModel,variant=p.workspace?.variants.find(v=>v.id===p.workspace.activeVariantId)?.name??'Текущий план',records=m?[{id:'site',name:'Общий участок',document:m.site.document,buildingId:null},...m.levels]:[{id:'site',name:'Общий план',document:p,buildingId:null}],rows=[],warnings=[];
 const buildingName=id=>m?.site.document.objects.find(o=>o.id===id)?.name??p.objects.find(o=>o.id===id)?.name??'Без постройки';
 const add=(record,o,cat,value=1,unit='шт',spec='',horizontal=0,vertical=0,extra={})=>{const owner=record.buildingId??o.buildingId??(o.type==='building'?o.id:null);if(buildingId&&owner!==buildingId||floorId&&record.id!==floorId||category&&cat!==category)return;const reserve=['pipe','wire'].includes(cat)?value*reservePercent/100:0;rows.push({key:record.id+':'+o.id,id:o.id,floorId:record.id==='site'?null:record.id,buildingId:owner,building:buildingName(owner),floor:record.name,variant,category:cat,categoryName:categories[cat],name:o.name??cat,spec,unit,quantity:1,horizontal,vertical,geometry:value,reserve,total:value+reserve,...extra})};
 const pipeSpec=o=>`${o.kind} · Ø ${(o.diameter*1000).toFixed(2).replace(/\.00$/,'')} мм`,wireSpec=o=>`${o.kind} · группа ${o.group||'не задана'}`;
 for(const record of records){const d=record.document;
  for(const o of d.objects){switch(o.type){
   case 'wall':add(record,o,'wall',wallLength(d,o),'м',o.wallKind??'');break;
   case 'fixture':add(record,o,o.kind.startsWith('socket-')?'socket':o.kind.startsWith('switch-')?'switch':o.kind.startsWith('light-')?'light':'fixture',1,'шт',o.kind);break;
   case 'pipe':case 'wire':{const length=routeLength(d,o);add(record,o,o.type,length,'м',o.type==='pipe'?pipeSpec(o):wireSpec(o),length);break;}
   case 'path':add(record,o,'path',pathArea(d,o),'м²',o.material??'');break;
   case 'outline':case 'building':case 'plot':add(record,o,o.type==='outline'?'covering':o.type,contourArea(d,o),'м²');break;
  }}
  for(const o of d.openings)add(record,{...o,buildingId:record.buildingId??d.objects.find(w=>w.id===o.wallId)?.buildingId},o.type,1,'шт',`${o.kind??''} · ${o.width} м`,0,0,{buildingId:record.buildingId??d.objects.find(w=>w.id===o.wallId)?.buildingId??null});
  for(const room of (d.rooms??[]).filter(r=>r.active)){try{add(record,room,'room',roomMetrics(d,room).area,'м²',room.purpose??'')}catch(e){warnings.push(`${record.name} / ${room.name}: ${(e).message}`)}}
  for(const f of d.fences??[]){const length=f.points.slice(1).reduce((sum,b,i)=>sum+Math.hypot(b.x-f.points[i].x,b.y-f.points[i].y),0);add(record,f,'fence',length,'м',`${f.kind} · H ${f.height} м`);for(const post of f.posts)add(record,{...post,name:f.name+' · столб'},'post');for(const section of f.sections)add(record,{...section,name:f.name+' · секция'},'section');for(const opening of f.openings)add(record,opening,'gate',1,'шт',`${opening.kind} · ${opening.width} м`)}
 }
 if(m){for(const s of m.stairs){const floor=m.levels.find(f=>f.id===s.lowerId);if(floorId&&![s.lowerId,s.upperId].includes(floorId))continue;add(floorId?m.levels.find(f=>f.id===floorId):floor,s,'stair',1,'шт',`${s.kind} · ${s.steps} ступеней · H ${(s.steps*s.riser).toFixed(3)} м`)}
  for(const link of m.verticalLinks){if(floorId&&![link.lowerId,link.upperId].includes(floorId))continue;const lo=m.levels.find(f=>f.id===link.lowerId),hi=m.levels.find(f=>f.id===link.upperId),a=lo.document.objects.find(o=>o.id===link.fromRouteId),b=hi.document.objects.find(o=>o.id===link.toRouteId);const spec=link.type==='pipe'?a.diameter===b.diameter?pipeSpec(a):`${link.kind} · Ø ${a.diameter*1000} → ${b.diameter*1000} мм`:a.group===b.group?wireSpec(a):`${link.kind} · группы ${a.group||'не задана'} → ${b.group||'не задана'}`;add(floorId?m.levels.find(f=>f.id===floorId):lo,link,link.type,link.height,'м',spec,0,link.height,{linkedFloorIds:[lo.id,hi.id],name:link.name+` (${lo.name} → ${hi.name})`,verticalLink:true})}
 }
 const grouped=new Map();for(const row of rows){const key=[row.category,row.spec,row.unit].join('\0');if(!grouped.has(key))grouped.set(key,{category:row.category,categoryName:row.categoryName,spec:row.spec,unit:row.unit,quantity:0,horizontal:0,vertical:0,geometry:0,reserve:0,total:0});const group=grouped.get(key);for(const k of ['quantity','horizontal','vertical','geometry','reserve','total'])group[k]+=row[k]}
 return {rows,summary:[...grouped.values()],warnings,variant,reservePercent};
}
// UTF-8 BOM and quoted cells for spreadsheets. User text cannot become a formula.
const cell=value=>{let s=String(value??'');if(/^[\s]*[=+@-]/.test(s)&&typeof value!=='number')s="'"+s;return '"'+s.replaceAll('"','""')+'"'};
export function billCsv(bill,summary=false){const headers=summary?['Категория','Параметры','Ед.','Объектов','Горизонтально, м','Вертикально, м','Геометрия','Запас','С запасом']:['Вариант','Постройка','Этаж','Категория','Объект','ID','Параметры','Ед.','Горизонтально, м','Вертикально, м','Геометрия','Запас','С запасом'];const rows=(summary?bill.summary:bill.rows).map(r=>summary?[r.categoryName,r.spec,r.unit,r.quantity,r.horizontal,r.vertical,r.geometry,r.reserve,r.total]:[r.variant,r.building,r.floor,r.categoryName,r.name,r.id,r.spec,r.unit,r.horizontal,r.vertical,r.geometry,r.reserve,r.total]);return '\ufeff'+[headers,...rows].map(row=>row.map(cell).join(';')).join('\r\n')+'\r\n'}
