import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {validateProject,screenToWorld,undo,pushHistory,redo} from '../src/core.mjs';
import {engineeringExample} from '../src/examples.mjs';
import {assertLayerEdits,snapProject,isVisible} from '../src/layers.mjs';
import {moveObjects,deleteObjects,duplicateObjects} from '../src/geometry.mjs';
import {snapPoint,defaultSnapSettings} from '../src/snapping.mjs';
import {importProject} from '../src/import-project.mjs';
import {exportBounds,exportSize} from '../src/export-plan.mjs';
import {createTouchState,touchStart,touchMove,touchEnd} from '../src/touch.mjs';
import {storage} from '../server/storage.mjs';
const sample=()=>validateProject(engineeringExample());
const lock=(p,id)=>({...p,layers:p.layers.map(l=>l.id===id?{...l,locked:true}:l)});
test('Миграция всех старых объектов назначает 11 слоёв, сохраняет координаты и связи',async()=>{
 const old=JSON.parse(await readFile(new URL('../examples/stage4-demo.json',import.meta.url),'utf8')),p=validateProject(old);
 assert.equal(p.layers.length,11);assert.deepEqual(p.nodes,old.nodes);assert.ok([...p.objects,...p.openings].every(o=>p.layers.some(l=>l.id===o.layerId)));
 assert.equal(p.objects.find(o=>o.kind==='socket-double')?.layerId,'electrical');
 assert.throws(()=>validateProject({...p,layers:[...p.layers.slice(0,-1),p.layers[0]]}));
 assert.throws(()=>validateProject({...p,objects:p.objects.map((o,i)=>i===0?{...o,layerId:'missing'}:o)}));
});
test('Скрытый слой исключается из привязок; заблокированный участвует по настройке',()=>{
 let p=sample(),originalNodes=structuredClone(p.nodes),o=p.objects.find(o=>o.type==='wall'),v=p.nodes[o.vertexIds[0]],raw={x:v.x+.002,y:v.y+.002};
 // Isolate the wall: shared visible building nodes remain valid snap targets in the complete plan.
 p={...p,objects:[o],openings:[]};const settings={...defaultSnapSettings,grid:false};
 assert.equal(snapPoint(snapProject(p),raw,100,settings).key,'node:'+v.id);
 p=lock(p,'walls');assert.equal(snapProject(p,false).objects.length,0);assert.equal(snapProject(p,true).objects.length,1);
 p={...p,layers:p.layers.map(l=>l.id==='walls'?{...l,visible:false}:l)};
 assert.equal(isVisible(p,o),false);assert.deepEqual(snapPoint(snapProject(p),raw,100,settings).point,raw);assert.deepEqual(p.nodes,originalNodes);
});
test('Блокировка защищает общий узел, связанных детей, проём и присоединённую трубу',()=>{
 let p=sample(),building=p.objects.find(o=>o.type==='building'),bath=p.objects.find(o=>o.kind==='bath-straight');
 let guarded=lock(p,'walls');assert.throws(()=>assertLayerEdits(guarded,validateProject(moveObjects(guarded,[building.id],1,1))),/заблокирован/);
 guarded=lock(p,'pipes');assert.throws(()=>assertLayerEdits(guarded,validateProject(moveObjects(guarded,[bath.id],.1,.1))),/заблокирован/);
 assert.throws(()=>assertLayerEdits(guarded,validateProject(deleteObjects(guarded,[bath.id]))),/заблокирован/);
 guarded=lock(p,'openings');const wall=p.objects.find(o=>o.id===p.openings[0].wallId);
 assert.throws(()=>assertLayerEdits(guarded,validateProject(moveObjects(guarded,[wall.id],.1,.1))),/заблокирован/);
 guarded=lock(p,'plumbing');assert.throws(()=>assertLayerEdits(guarded,validateProject(duplicateObjects(guarded,[bath.id]).project)),/заблокирован/);
 const visibility={...guarded,layers:guarded.layers.map(l=>({...l,visible:false}))};assert.doesNotThrow(()=>assertLayerEdits(guarded,visibility));
});
test('Слои сохраняются на сервере, undo/redo восстанавливает их без удаления геометрии',async()=>{
 const p=sample(),hidden={...p,layers:p.layers.map(l=>l.id==='pipes'?{...l,visible:false,locked:true}:l)},h=pushHistory({past:[],present:p,future:[]},hidden);
 assert.deepEqual(undo(h).present,p);assert.deepEqual(redo(undo(h)).present,hidden);
 const root=await mkdtemp(path.join(os.tmpdir(),'home-planer-stage5-'));try{const db=storage(root);await db.save(hidden);assert.deepEqual((await db.get(p.id)).layers,hidden.layers)}finally{await rm(root,{recursive:true,force:true})}
});
test('Импорт создаёт самостоятельную копию; ошибочные числа, ID и связи не меняют исходник',()=>{
 const p=sample(),before=JSON.stringify(p),copy=importProject(before);
 assert.notEqual(copy.id,p.id);assert.equal(copy.revision,0);assert.deepEqual(copy.nodes,p.nodes);assert.deepEqual(copy.objects,JSON.parse(before).objects);
 for(const bad of ['{',before.replace('"schemaVersion":2','"schemaVersion":99'),JSON.stringify({...p,nodes:{...p.nodes,bad:{id:'bad',x:1e308,y:0}}}),JSON.stringify({...p,objects:[...p.objects,p.objects[0]]}),JSON.stringify({...p,openings:p.openings.map((o,i)=>i===0?{...o,wallId:'missing'}:o)}),' {"__proto__":{}}',before.replace('"revision":0','"revision":1e999')])assert.throws(()=>importProject(bad));
 assert.throws(()=>importProject(' '.repeat(5*1024*1024+1)));assert.equal(JSON.stringify(p),before);
});
test('Экспорт охватывает покрытие и двери, учитывает выбранные слои и ограничивает растровый размер',()=>{
 const p=sample(),box=exportBounds(p,40,24),pixels=exportSize(box,40);assert.ok(box.x<0&&box.y<0&&box.width>30&&box.height>20);assert.ok(pixels.width>1200);
 const only={...p,layers:p.layers.map(l=>({...l,visible:l.id==='paths'}))},small=exportBounds(only,40,0);assert.ok(small.width<box.width);assert.ok(small.height<box.height);
 assert.throws(()=>exportBounds({...p,layers:p.layers.map(l=>({...l,visible:false}))}));assert.throws(()=>exportSize({x:0,y:0,width:10000,height:10000},400));assert.throws(()=>exportSize({...box,width:-1},40));
});
test('Два пальца отменяют начало редактирования, масштаб сохраняет мировую опору; остаточный палец не размещает объект',()=>{
 const s=createTouchState(),camera={x:20,y:30,scale:25};assert.equal(touchStart(s,1,{x:100,y:100},camera),'pending');assert.equal(touchStart(s,2,{x:200,y:100},camera),'cancel-edit');
 let c=touchMove(s,1,{x:50,y:100});c=touchMove(s,2,{x:250,y:100});assert.equal(c.scale,50);assert.deepEqual(screenToWorld({x:150,y:100},c),screenToWorld({x:150,y:100},camera));
 assert.equal(touchEnd(s,1,c),'cancel');assert.equal(touchMove(s,2,{x:270,y:120}),null);assert.equal(touchEnd(s,2,c),'cancel');assert.equal(s.multi,false);
 touchStart(s,3,{x:50,y:50},c);assert.equal(touchEnd(s,3,c),'tap');
});
test('Смена жеста после drag, третий палец, отмена и ограничения масштаба не оставляют команды размещения',()=>{
 const s=createTouchState(),c={x:0,y:0,scale:25};touchStart(s,1,{x:0,y:0},c);assert.equal(touchMove(s,1,{x:10,y:0}),'drag');s.drag=true;assert.equal(touchStart(s,2,{x:20,y:0},c),'cancel-edit');assert.equal(s.drag,false);
 touchStart(s,3,{x:30,y:30},c);touchEnd(s,1,c);assert.equal(touchMove(s,2,{x:100000,y:0}).scale,400);assert.equal(touchEnd(s,2,c,true),'cancel');assert.equal(touchEnd(s,3,c),'cancel');assert.equal(s.points.size,0);assert.equal(s.pending,null);
});
