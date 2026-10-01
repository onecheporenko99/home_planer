import {readdir,readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {validateProject} from '../src/core.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=path.join(root,'data/projects');
const destination=path.join(root,'data/backups','phase2-'+new Date().toISOString().replace(/[:.]/g,'-'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
await mkdir(destination,{recursive:true});
const manifest={createdAt:new Date().toISOString(),source,files:[],checks:[]};
const names=(await readdir(source)).filter(name=>/^[a-zA-Z0-9-]+\.json(?:\.bak)?$/.test(name));
try{for(const id of (await readdir(path.join(source,'.versions'))).filter(id=>/^[a-zA-Z0-9-]+$/.test(id)))for(const file of (await readdir(path.join(source,'.versions',id))).filter(file=>/^[0-9]+\.json$/.test(file)))names.push(path.join('.versions',id,file));}catch(e){if(e.code!=='ENOENT')throw e}
for(const name of names.sort()){
 await mkdir(path.dirname(path.join(destination,name)),{recursive:true});
 const original=await readFile(path.join(source,name));
 await writeFile(path.join(destination,name),original,{flag:'wx'});
 assert.equal(hash(await readFile(path.join(destination,name))),hash(original));
 assert.equal(hash(await readFile(path.join(source,name))),hash(original),'Проект изменился во время копирования; повторите проверку');
 manifest.files.push({name,bytes:original.length,sha256:hash(original)});
}
// Validation happens only after the byte-for-byte backups are complete.
for(const file of manifest.files){
 const saved=JSON.parse(await readFile(path.join(destination,file.name),'utf8'));
 const raw=file.name.startsWith('.versions')?saved.document:saved;
 const canonical=validateProject(raw);
 assert.deepEqual(validateProject(JSON.parse(JSON.stringify(canonical))),canonical);
 assert.deepEqual(validateProject(raw),canonical);
 assert.equal(canonical.id,raw.id);assert.equal(canonical.revision,raw.revision);
 assert.deepEqual(canonical.objects.map(object=>[object.id,object.name]),raw.objects.map(object=>[object.id,object.name]));
 manifest.checks.push({name:file.name,schema:raw.schemaVersion,objects:canonical.objects.length,nodes:Object.keys(canonical.nodes).length,openings:canonical.openings.length,status:'passed'});
}
await writeFile(path.join(destination,'manifest.json'),JSON.stringify(manifest,null,2));
console.log(JSON.stringify({backup:destination,files:manifest.files.length,validated:manifest.checks.length,sourceFilesUnchanged:true},null,2));
