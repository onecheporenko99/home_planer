import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';import os from 'node:os';import assert from 'node:assert/strict';
import {validateProject} from '../src/core.mjs';
import {addUnderlay} from '../src/underlays.mjs';
import {addNote} from '../src/workspace.mjs';
import {inspectResource} from '../src/resource-bytes.mjs';
import {exportArchive,importArchive} from '../src/project-archive.mjs';
import {sha256} from '../src/browser-crypto.mjs';
import {resourceStorage} from '../server/resources.mjs';
import {storage} from '../server/storage.mjs';
const source=validateProject(JSON.parse(await readFile('data/projects/288b77c2-ebda-431a-8b53-a79056417cc9.json','utf8'))),original=JSON.stringify(source),assets=new Map();
const resources=[];
for(const [file,mime] of [['plan.pdf','application/pdf'],['plan.png','image/png']]){const bytes=await readFile('tests/fixtures/underlays/'+file),id=await sha256(bytes);assets.set(id,bytes);resources.push({id,sha256:id,name:file,mimeType:mime,byteLength:bytes.length,...inspectResource(bytes,mime)})}
let p=validateProject({...source,id:crypto.randomUUID(),revision:0,name:'Phase 2 — переносимый архив с файлами'});
p=validateProject(addNote(addUnderlay(p,resources,{page:1}),'Фото и исходная PDF-подложка входят в архив',{x:7,y:5}));
p=validateProject({...p,notes:p.notes.map((n,i,a)=>i===a.length-1?{...n,photoIds:[resources[1].id]}:n)});
const read=async r=>assets.get(r.id)??(await readFile('data/resources/'+r.id+'.bin'));
const archive=await exportArchive(p,read);await mkdir('output/acceptance',{recursive:true});await writeFile('output/acceptance/phase2-example.homeplaner.zip',archive);
const imported=await importArchive(archive),root=await mkdtemp(path.join(os.tmpdir(),'home-stage10-'));
try{const binaries=resourceStorage(path.join(root,'resources')),db=storage(path.join(root,'projects'));for(const {resource,bytes} of imported.assets)await binaries.put(Buffer.from(bytes),resource.mimeType,resource.name);const saved=await db.save(imported.project,'Импорт архива'),reopened=await storage(path.join(root,'projects')).get(saved.id);assert.deepEqual(reopened,validateProject(saved));for(const r of reopened.resources)assert.deepEqual((await binaries.get(r.id)).bytes,await read(r));console.log(JSON.stringify({archive:'output/acceptance/phase2-example.homeplaner.zip',bytes:archive.length,resources:imported.assets.length,floors:reopened.floorModel.levels.length,variants:reopened.workspace.variants.length,reopenedInEmptyStorage:true}))}finally{await rm(root,{recursive:true,force:true})}
if(process.argv.includes('--save-project')){
 const base='http://localhost:3003';for(const r of p.resources){const response=await fetch(base+'/api/resources?name='+encodeURIComponent(r.name),{method:'POST',headers:{'Content-Type':r.mimeType},body:await read(r)});assert.equal(response.status,200);assert.equal((await response.json()).id,r.id)}
 const response=await fetch(base+'/api/projects/'+p.id+'/checkpoints',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({document:p,name:'Переносимый архив'})});assert.equal(response.status,200);const saved=await response.json();const reopened=await (await fetch(base+'/api/projects/'+saved.id)).json();assert.equal(reopened.revision,1);assert.equal(reopened.resources.length,p.resources.length);console.log(JSON.stringify({localExample:saved.id,name:saved.name,revision:saved.revision}));
}
assert.equal(JSON.stringify(source),original);
