import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readdir,readFile,mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {validateProject,pushHistory,undo,redo} from '../src/core.mjs';
import {storage} from '../server/storage.mjs';
test('Все эталонные планы первой очереди переживают сохранение, чтение и историю без потери связей',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'home-planer-phase2-'));
 try{
  const db=storage(root);
  for(const file of (await readdir(new URL('../examples/',import.meta.url))).filter(file=>file.endsWith('.json'))){
   const source=validateProject(JSON.parse(await readFile(new URL('../examples/'+file,import.meta.url),'utf8')));
   const project={...source,id:crypto.randomUUID(),revision:0};
   const saved=await db.save(project),opened=await db.get(project.id);
   assert.deepEqual(opened,saved,file);
   for(const field of ['nodes','objects','openings','layers','settings'])assert.deepEqual(opened[field],project[field],file+': '+field);
   const history=pushHistory({past:[],present:opened,future:[]},{...opened,name:'Проверка'});
   assert.deepEqual(undo(history).present,opened);assert.equal(redo(undo(history)).present.name,'Проверка');
  }
 }finally{await rm(root,{recursive:true,force:true})}
});
