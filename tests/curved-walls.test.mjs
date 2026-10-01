import {test} from 'node:test';
import assert from 'node:assert/strict';
import {freshProject,validateProject,pushHistory,undo,redo} from '../src/core.mjs';
import {addCurvedWall,editWallCurve,joinCorner,convertWallToArc,convertWallToLine,splitCurvedWall,curveWallPaths} from '../src/curved-walls.mjs';
import {createGeometry,duplicateObjects,moveObjects} from '../src/geometry.mjs';
import {createOpening} from '../src/openings.mjs';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {storage} from '../server/storage.mjs';
const curve={kind:'arc',center:{x:4,y:4},radius:2,startAngle:0,sweepAngle:90};
test('Кривые стены записываются и открываются с параметрами, проёмами и историей',async()=>{
 let {project,id}=addCurvedWall(freshProject(),curve);project=validateProject(project);
 project=validateProject(createOpening(project,id,'window',.5,.7,'curved').project);
 assert.equal(project.schemaVersion,3);assert.equal(curveWallPaths(project,project.objects[0]).length,2);
 const root=await mkdtemp(path.join(os.tmpdir(),'home-planer-curves-'));try{const db=storage(root),saved=await db.save(project);assert.deepEqual(await db.get(project.id),saved)}finally{await rm(root,{recursive:true,force:true})}
 const modified=validateProject(editWallCurve(project,id,{radius:3})),history=pushHistory({past:[],present:project,future:[]},modified);assert.deepEqual(undo(history).present,project);assert.deepEqual(redo(undo(history)).present,modified);
});
test('Копия кривой сохраняет свою геометрию и переносит проём на новые ID',()=>{
 const base=addCurvedWall(freshProject(),curve);const p=validateProject(createOpening(base.project,base.id,'window',.5,.7,'curved').project);
 const copy=duplicateObjects(p,[base.id],10,0),result=validateProject(copy.project);assert.notEqual(result.objects[0].curve.centerId,result.objects[1].curve.centerId);assert.equal(result.openings[1].wallId,result.objects[1].id);
 const moved=validateProject(moveObjects(p,[base.id],1,2));assert.equal(moved.nodes[moved.objects[0].curve.centerId].x,5);assert.deepEqual(p.nodes[p.objects[0].curve.centerId],{id:p.objects[0].curve.centerId,x:4,y:4});
});
test('Скругление и фаска атомарны, большой радиус и дополнительные связи сохраняют исходник',()=>{
 const base=createGeometry(freshProject(),{type:'wall',name:'Стена',thickness:.2},[{x:4,y:0},{x:0,y:0},{x:0,y:4}],'wall');const before=JSON.stringify(base.project);
 const rounded=validateProject(joinCorner(base.project,base.ids,.3));assert.equal(rounded.objects.length,3);assert.equal(rounded.objects[2].curve.radius,.3);
 assert.throws(()=>joinCorner(base.project,base.ids,5));assert.equal(JSON.stringify(base.project),before);
 const bevel=validateProject(joinCorner(base.project,base.ids,.2,.4));assert.equal(bevel.objects.length,3);assert.equal(bevel.objects[2].curve,undefined);
});
test('Фиксированные концы, преобразование и разбиение сохраняют геометрию',()=>{
 const base=createGeometry(freshProject(),{type:'wall',name:'Стена',thickness:.2},[{x:0,y:0},{x:4,y:0}],'wall'),id=base.ids[0];const curved=validateProject(convertWallToArc(base.project,id,90)),fixed=validateProject(editWallCurve(curved,id,{sweepAngle:120},true));
 assert.deepEqual(fixed.objects[0].vertexIds,curved.objects[0].vertexIds);for(const n of curved.objects[0].vertexIds.slice(0,2)){assert.ok(Math.hypot(fixed.nodes[n].x-curved.nodes[n].x,fixed.nodes[n].y-curved.nodes[n].y)<1e-6)}
 assert.equal(validateProject(convertWallToLine(curved,id)).objects[0].curve,undefined);
 assert.equal(validateProject(splitCurvedWall(curved,id)).objects.length,2);
});
test('Окружность имеет отдельную сущность; окна через начальную метку проверяют пересечения',()=>{
 const base=addCurvedWall(freshProject(),{...curve,kind:'circle',sweepAngle:360});let p=validateProject(base.project);assert.equal(p.objects[0].vertexIds.length,1);
 p=validateProject(createOpening(p,base.id,'window',12,.8,'curved').project);assert.ok(curveWallPaths(p,p.objects[0]).length>0);
 assert.throws(()=>validateProject(createOpening(p,base.id,'window',0,.5,'curved').project));
 assert.throws(()=>validateProject(createOpening(base.project,base.id,'door',1,.9).project));
 assert.throws(()=>editWallCurve(base.project,base.id,{radius:.05}));
});
