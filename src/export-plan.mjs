import {floorExtraPoints} from './floors.mjs';
import {notePoint} from './workspace.mjs';
import {siteBounds} from './site-analysis.mjs';
import {roomMetrics,edgeLength} from './room-math.mjs';
import {openingDimensionChain,layoutChainLabels,chainTotalOffset} from './room-commands.mjs';
import {underlayCorners} from './underlays.mjs';
import {contourBounds} from './contour-math.mjs';
import {vertices,edges} from './geometry.mjs';
import {pathOutline,fixtureCorners} from './engineering-math.mjs';
import {fixtureDefinition} from './engineering-catalog.mjs';
import {openingGeometry} from './openings.mjs';
import {isVisible,layerVisible} from './layers.mjs';
export function exportBounds(p,scale=40,margin=24,includeSiteNorth=true){
 const points=[...siteBounds(p,includeSiteNorth),...floorExtraPoints(p,false,scale)];const add=(v,r=0)=>points.push({x:v.x-r,y:v.y-r},{x:v.x+r,y:v.y+r});
 if(layerVisible(p,'notes'))for(const n of p.notes??[])add(notePoint(p,n),12/scale);
 if(layerVisible(p,'underlays'))for(const u of p.underlays??[])if(u.visible)for(const n of underlayCorners(u))add(n);
 if(layerVisible(p,'rooms'))for(const r of p.rooms??[])if(r.active){try{const m=roomMetrics(p,r);add({x:m.bounds.minX,y:m.bounds.minY});add({x:m.bounds.maxX,y:m.bounds.maxY});if(layerVisible(p,'labels')){const center={x:r.anchor.x+r.labelOffset.x,y:r.anchor.y+r.labelOffset.y},width=Math.max(r.name.length,30)*4/scale;add({x:center.x-width,y:center.y-16/scale});add({x:center.x+width,y:center.y+24/scale})}}catch{}}
 if(layerVisible(p,'dimensions')&&layerVisible(p,'rooms')&&p.settings.measurements?.showRoomDimensions)for(const r of p.rooms??[])if(r.active){try{for(const e of roomMetrics(p,r).edges.filter(e=>!e.connector)){const length=Math.hypot(e.b.x-e.a.x,e.b.y-e.a.y)||1,offset=-(e.thickness??.2)-18/scale,n={x:-(e.b.y-e.a.y)/length,y:(e.b.x-e.a.x)/length},cx=(e.a.x+e.b.x)/2+n.x*offset,cy=(e.a.y+e.b.y)/2+n.y*offset,text='Внутр. '+edgeLength(e).toFixed(3)+' м'+(e.curve?' по дуге':'');add({x:cx-(text.length*3.5+12)/scale,y:cy-14/scale});add({x:cx+(text.length*3.5+12)/scale,y:cy+4/scale});}}catch{}}
 if(layerVisible(p,'dimensions')&&p.settings.measurements?.showChains)for(const c of p.dimensionChains??[]){const w=p.objects.find(w=>w.id===c.wallId);if(!w||!isVisible(p,w))continue;const chain=openingDimensionChain(p,w);const labels=layoutChainLabels(chain,c,scale,!!w.curve),totalOffset=chainTotalOffset(chain,c,scale,labels),ta=chain.point(0),tb=chain.point(chain.length),tl=Math.hypot(tb.x-ta.x,tb.y-ta.y)||1;for(const q of [ta,tb])add({x:q.x-(tb.y-ta.y)/tl*totalOffset,y:q.y+(tb.x-ta.x)/tl*totalOffset},50/scale);for(const label of labels){add({x:label.box.minX,y:label.box.minY});add({x:label.box.maxX,y:label.box.maxY})}for(const [i,span]of chain.spans.entries()){const a=chain.point(span.start),b=chain.point(span.end),len=Math.hypot(b.x-a.x,b.y-a.y)||1,offset=c.offset,n={x:-(b.y-a.y)/len,y:(b.x-a.x)/len},label=c.labelOffsets[i]??{x:0,y:0},center={x:(a.x+b.x)/2+n.x*offset+label.x,y:(a.y+b.y)/2+n.y*offset+label.y};add(center,(span.label.length+20)*4/scale);for(const q of [a,b])add({x:q.x+n.x*offset,y:q.y+n.y*offset},50/scale)}}
 for(const o of p.objects.filter(o=>isVisible(p,o))){if(o.type==='annotation'&&['text','leader'].includes(o.drawingKind)){const n=p.nodes[o.vertexIds.at(-1)],font=(o.fontSize??16)/scale,w=(o.textWidth??240)/scale,chars=Math.max(1,Math.floor((o.textWidth??240)/((o.fontSize??16)*.6))),rows=(o.text??'').split('\n').reduce((s,line)=>s+Math.max(1,Math.ceil(line.length/chars)),0),left=o.textAlign==='center'?n.x-w/2:o.textAlign==='right'?n.x-w:n.x;add({x:left,y:n.y-font},4/scale);add({x:left+w,y:n.y+rows*font*1.25},4/scale)}
  if(['outline','plot','building'].includes(o.type)){const b=contourBounds(p,o);add({x:b.minX,y:b.minY});add({x:b.maxX,y:b.maxY})}const vs=o.type==='path'?pathOutline(p,o):vertices(p,o);for(const v of vs)add(v,o.type==='wall'?(o.thickness??.2)/2:20/scale);
  if(o.type==='fixture'&&fixtureDefinition(o.kind)?.category==='electrical')for(const v of fixtureCorners(p,{...o,width:Math.max(o.width,(o.symbolSize??20)/scale),depth:Math.max(o.depth,(o.symbolSize??20)/scale)}))add(v,2/scale);
  if(layerVisible(p,'labels')&&o.labelVisible!==false&&vs.length){const v=vs[0];points.push({x:v.x-10/scale,y:v.y-55/scale},{x:v.x+(o.name.length+20)*8/scale,y:v.y+35/scale})}
  if(layerVisible(p,'dimensions'))for(const e of edges(p,o).filter(e=>o.type!=='fixture'||e.index<2)){
   const architectural=!['fixture','pipe','wire','path'].includes(o.type),dx=e.b.x-e.a.x,dy=e.b.y-e.a.y;
   const cx=(e.a.x+e.b.x)/2+(architectural?dy/e.length*18/scale:0),cy=(e.a.y+e.b.y)/2-(architectural?dx/e.length*18/scale+4/scale:8/scale);
   const factor=p.settings.unit==='mm'?1000:p.settings.unit==='cm'?100:1,half=((e.length*factor).toLocaleString('ru',{maximumFractionDigits:2}).length+3)*4/scale;
   points.push({x:cx-half,y:cy-14/scale},{x:cx+half,y:cy+4/scale});
  }
 }
 for(const o of p.openings.filter(o=>isVisible(p,o))){const g=openingGeometry(p,o);for(const v of [g.a,g.b])add(v,o.type==='door'?o.width:(g.wall.thickness??.2)/2);if(layerVisible(p,'labels'))add(g.center,(o.name.length+20)*4/scale)}
 if(!points.length)throw Error('Выбранные слои не содержат геометрии');
 let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;for(const v of points){minX=Math.min(minX,v.x);minY=Math.min(minY,v.y);maxX=Math.max(maxX,v.x);maxY=Math.max(maxY,v.y)}
 const x=minX-margin/scale,y=minY-margin/scale;return {x,y,width:maxX-x+margin/scale,height:maxY-y+margin/scale};
}
export function exportSize(bounds,scale){
 if(!Number.isFinite(scale)||scale<3||scale>400||!['x','y','width','height'].every(k=>Number.isFinite(bounds[k]))||bounds.width<=0||bounds.height<=0)throw Error('Некорректные границы или масштаб экспорта');
 const width=Math.ceil(bounds.width*scale),height=Math.ceil(bounds.height*scale);
 if(width>8192||height>8192||width*height>32000000)throw Error('Слишком большое изображение: уменьшите масштаб или границы (до 8192 px и 32 Мп)');
 return {width,height};
}
