import {vertices,edges} from './geometry.mjs';
import {pathOutline,fixtureCorners} from './engineering-math.mjs';
import {fixtureDefinition} from './engineering-catalog.mjs';
import {openingGeometry} from './openings.mjs';
import {isVisible,layerVisible} from './layers.mjs';
export function exportBounds(p,scale=40,margin=24){
 const points=[];const add=(v,r=0)=>points.push({x:v.x-r,y:v.y-r},{x:v.x+r,y:v.y+r});
 for(const o of p.objects.filter(o=>isVisible(p,o))){
  const vs=o.type==='path'?pathOutline(p,o):vertices(p,o);for(const v of vs)add(v,o.type==='wall'?(o.thickness??.2)/2:20/scale);
  if(o.type==='fixture'&&fixtureDefinition(o.kind)?.category==='electrical')for(const v of fixtureCorners(p,{...o,width:Math.max(o.width,(o.symbolSize??20)/scale),depth:Math.max(o.depth,(o.symbolSize??20)/scale)}))add(v,2/scale);
  if(layerVisible(p,'labels')&&vs.length){const v=vs[0];points.push({x:v.x-10/scale,y:v.y-55/scale},{x:v.x+(o.name.length+20)*8/scale,y:v.y+35/scale})}
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
