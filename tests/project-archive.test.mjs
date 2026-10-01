import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import path from 'node:path';import os from 'node:os';
import {zipSync,unzipSync,strToU8} from 'fflate';
import {freshProject,validateProject} from '../src/core.mjs';
import {exportArchive,importArchive,inspectArchive,MAX_ARCHIVE_BYTES} from '../src/project-archive.mjs';
import {resourceStorage} from '../server/resources.mjs';
import {storage} from '../server/storage.mjs';
import {createGeometry} from '../src/geometry.mjs';
import {withFloors,addFloor,switchFloor} from '../src/floors.mjs';
import {copyVariant,variantProject,addNote} from '../src/workspace.mjs';
import {addUnderlay} from '../src/underlays.mjs';
import {sha256} from '../src/browser-crypto.mjs';
import {inspectResource} from '../src/resource-bytes.mjs';
const png=await readFile(new URL('./fixtures/underlays/plan.png',import.meta.url));
const pdf=await readFile(new URL('./fixtures/underlays/plan.pdf',import.meta.url));
async function metadata(bytes,mime,name){const id=await sha256(bytes);return {id,sha256:id,name,mimeType:mime,byteLength:bytes.length,...inspectResource(bytes,mime)}}
async function fixture(){
 const image=await metadata(png,'image/png','Фото.png'),source=await metadata(pdf,'application/pdf','Исходная подложка.pdf');
 const house=createGeometry(freshProject(),{type:'building',name:'Дом'},[{x:0,y:0},{x:6,y:0},{x:6,y:6},{x:0,y:6}],'rectangle');
 let p=addFloor(withFloors(house.project),house.ids[0],'Первый этаж',0,3);const floor=p.floorModel.levels[0].id;
 p=validateProject(addUnderlay(switchFloor(p,floor),[source,image],{page:1}));p=validateProject(addNote(p,'Фото ремонта',{x:1,y:1}));
 p=validateProject({...p,notes:p.notes.map(n=>({...n,photoIds:[image.id]}))});const variant=p.workspace.activeVariantId;
 p=validateProject(copyVariant(p,'Другая планировка'));p=validateProject(switchFloor(p,null));
 return {p,variant,floor,assets:new Map([[image.id,png],[source.id,pdf]])};
}
test('Архив переносит PDF, подложку и фото неактивного этажа/варианта в пустое хранилище; исходник не изменяется',async()=>{
 const {p,variant,floor,assets}=await fixture(),before=JSON.stringify(p),archive=await exportArchive(p,r=>assets.get(r.id)),root=await mkdtemp(path.join(os.tmpdir(),'home-archive-'));
 try{const result=await importArchive(archive),store=resourceStorage(path.join(root,'resources'));
  assert.notEqual(result.project.id,p.id);assert.equal(result.project.revision,0);assert.equal(result.assets.length,2);
  for(const asset of result.assets){const uploaded=await store.put(Buffer.from(asset.bytes),asset.resource.mimeType,asset.resource.name);assert.equal(uploaded.id,asset.resource.id)}
  const db=storage(path.join(root,'projects')),saved=await db.save(result.project),opened=await storage(path.join(root,'projects')).get(saved.id);
  const restored=validateProject(switchFloor(variantProject(opened,variant),floor));
  assert.equal(restored.underlays.length,1);assert.equal(restored.notes[0].photoIds.length,1);
  for(const resource of opened.resources)assert.deepEqual((await store.get(resource.id)).bytes,assets.get(resource.id));
  assert.equal(JSON.stringify(p),before);assert.deepEqual(restored.floorModel.levels.map(l=>l.id),p.floorModel.levels.map(l=>l.id));
 }finally{await rm(root,{recursive:true,force:true})}
});
test('Старый v2 переносится без файлов и не требует нового формата',async()=>{const p=freshProject(),r=await importArchive(await exportArchive(p,()=>{throw Error('unexpected')}));assert.equal(r.project.schemaVersion,2);assert.equal(r.assets.length,0)});
test('Сжатый ZIP читается с тем же манифестом; дубликаты ресурсов запрещены до распаковки',async()=>{
 const {p,assets}=await fixture(),files=unzipSync(await exportArchive(p,r=>assets.get(r.id)));
 assert.equal((await importArchive(zipSync(files,{level:6}))).assets.length,2);
 const bytes=zipSync(files,{level:0}),entries=inspectArchive(bytes),resources=entries.filter(e=>e.name.startsWith('resources/'));
 const first=resources[0],second=resources[1],v=new DataView(bytes.buffer);let pos=v.getUint32(bytes.length-22+16,true);
 for(let i=0;i<entries.length;i++){const length=v.getUint16(pos+28,true);const name=new TextDecoder().decode(bytes.subarray(pos+46,pos+46+length));if(name===second.name){bytes.set(strToU8(first.name),pos+46);bytes.set(strToU8(first.name),second.local+30);break}pos+=46+length+v.getUint16(pos+30,true)+v.getUint16(pos+32,true)}
 assert.throws(()=>inspectArchive(bytes));
});
test('Экспорт не создаёт неполный архив при отсутствующем или повреждённом ресурсе',async()=>{const {p,assets}=await fixture();await assert.rejects(exportArchive(p,()=>{throw Error('missing')}),/missing/);await assert.rejects(exportArchive(p,r=>{const b=new Uint8Array(assets.get(r.id));b[0]^=1;return b}),/Контрольная сумма/)});
test('Импорт отклоняет подмену проекта, отсутствие/подмену ресурса, лишние файлы и неизвестный формат',async()=>{
 const {p,assets}=await fixture(),files=unzipSync(await exportArchive(p,r=>assets.get(r.id))),resource=Object.keys(files).find(n=>n.startsWith('resources/'));
 for(const mutate of [f=>f['project.json'][30]^=1,f=>delete f[resource],f=>f[resource][0]^=1,f=>f['extra.txt']=strToU8('extra'),f=>{const m=JSON.parse(new TextDecoder().decode(f['manifest.json']));m.version=99;f['manifest.json']=strToU8(JSON.stringify(m))}]){
  const copy=Object.fromEntries(Object.entries(files).map(([k,v])=>[k,new Uint8Array(v)]));mutate(copy);await assert.rejects(importArchive(zipSync(copy,{level:0})));
 }
});
test('До распаковки запрещены traversal, абсолютные/внешние пути и дубликаты ZIP-записей',async()=>{
 for(const name of ['../escape','/project.json','resources/../x','https://host/a','C:/x'])assert.throws(()=>inspectArchive(zipSync({'manifest.json':strToU8('{}'),'project.json':strToU8('{}'),[name]:strToU8('x')},{level:0})));
 const bytes=zipSync({'manifest.json':strToU8('{}'),'project.json':strToU8('{}')},{level:0}),v=new DataView(bytes.buffer);const end=bytes.length-22,central=v.getUint32(end+16,true),next=central+46+v.getUint16(central+28,true)+v.getUint16(central+30,true)+v.getUint16(central+32,true);
 // Same-length project.json -> another manifest would require 13 vs 12 bytes;
 // force its local offset to overlap instead: duplicate payloads must be denied.
 v.setUint32(next+42,v.getUint32(central+42,true),true);assert.throws(()=>inspectArchive(bytes));
});
test('CRC-повреждение, обрезанный ZIP, превышение распакованного размера и шифрование отвергаются',async()=>{
 const bytes=await exportArchive(freshProject(),()=>null);
 await assert.rejects(importArchive(bytes.subarray(0,bytes.length-3)));
 const crc=new Uint8Array(bytes),entry=inspectArchive(crc)[0];crc[entry.end-1]^=1;await assert.rejects(importArchive(crc));
 for(const kind of ['size','encrypted']){const b=new Uint8Array(bytes),v=new DataView(b.buffer),end=b.length-22,c=v.getUint32(end+16,true);if(kind==='size')v.setUint32(c+24,MAX_ARCHIVE_BYTES+1,true);else v.setUint16(c+8,1,true);assert.throws(()=>inspectArchive(b))}
});
test('Размеры и тип ресурса проверяются независимо от верной SHA',async()=>{const image=await metadata(png,'image/png','Фото.png'),p=validateProject(addUnderlay(freshProject(),[{...image,width:image.width+1}]));await assert.rejects(exportArchive(p,()=>png),/Размеры изображения/);assert.throws(()=>inspectResource(png,'application/pdf'));assert.throws(()=>inspectResource(new Uint8Array([1,2,3]),'image/png'))});
