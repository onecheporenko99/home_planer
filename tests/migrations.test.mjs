import {test} from 'node:test';
import assert from 'node:assert/strict';
import {freshProject,validateProject} from '../src/core.mjs';
import {migrateProject} from '../src/project-migrations.mjs';

const legacy = () => ({...freshProject(),schemaVersion:1,objects:[{id:'old-outline',type:'outline',name:'Старый план',vertices:[{id:'old-a',x:0,y:0},{x:4,y:0},{x:4,y:3},{x:0,y:3}]}]});
test('Миграция повторяема, сохраняет старые ID, геометрию и исходник',()=>{
 const source=legacy(),snapshot=JSON.stringify(source),first=validateProject(source),second=validateProject(source);
 assert.deepEqual(first,second);assert.deepEqual(validateProject(first),first);
 assert.equal(first.objects[0].id,'old-outline');assert.equal(first.objects[0].vertexIds[0],'old-a');
 assert.deepEqual(first.objects[0].vertexIds.map(id=>({x:first.nodes[id].x,y:first.nodes[id].y})),source.objects[0].vertices.map(({x,y})=>({x,y})));
 assert.equal(JSON.stringify(source),snapshot);assert.equal(first.revision,source.revision);
});
test('Общие старые ID сохраняют связь; неоднозначные координаты отклоняются',()=>{
 const source=legacy();source.objects.push({id:'other',type:'outline',name:'Сосед',vertices:[{id:'old-a',x:0,y:0},{x:-2,y:0},{x:0,y:-2}]});
 const result=validateProject(source);assert.equal(result.objects[0].vertexIds[0],result.objects[1].vertexIds[0]);
 source.objects[1].vertices[0].x=1;const before=JSON.stringify(source);assert.throws(()=>validateProject(source));assert.equal(JSON.stringify(source),before);
});
test('Неизвестная версия и конфликт ID отклоняются до изменения исходника',()=>{
 assert.throws(()=>migrateProject({...freshProject(),schemaVersion:11}));
 const source=legacy();source.objects[0].vertices[0].id='old-outline';assert.throws(()=>validateProject(source));
});
test('Созданный ID не объединяет разные вершины с сохранённым старым ID',()=>{
 const source=legacy();source.objects[0].vertices[0].id='legacy-node-0-1';
 const result=validateProject(source);assert.notEqual(result.objects[0].vertexIds[0],result.objects[0].vertexIds[1]);
 assert.deepEqual(validateProject(source),result);
});
