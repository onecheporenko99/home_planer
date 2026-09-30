import { readFile,writeFile,rename,mkdir,copyFile,readdir } from 'node:fs/promises';
import path from 'node:path';
import {validateProject} from '../src/core.mjs';
export function storage(root){
 const file=id=>{if(!/^[a-zA-Z0-9-]{1,80}$/.test(id))throw Error('Некорректный ID');return path.join(root,id+'.json')};
 return {async list(){await mkdir(root,{recursive:true});const files=await readdir(root);return Promise.all(files.filter(f=>/^[a-zA-Z0-9-]+\.json$/.test(f)).map(async f=>{const p=JSON.parse(await readFile(path.join(root,f),'utf8'));return {id:p.id,name:p.name,updatedAt:p.updatedAt,revision:p.revision}}));},async get(id){return validateProject(JSON.parse(await readFile(file(id),'utf8')))},async save(p){p=validateProject(p);await mkdir(root,{recursive:true});let old;try{old=JSON.parse(await readFile(file(p.id),'utf8'))}catch(e){if(e.code!=='ENOENT')throw e}if((old?.revision??0)!==p.revision){const e=Error('Проект изменён на другом устройстве');e.status=409;throw e}const next={...p,revision:p.revision+1,updatedAt:new Date().toISOString()};const temp=file(p.id)+'.tmp';await writeFile(temp,JSON.stringify(next,null,2),'utf8');if(old)await copyFile(file(p.id),file(p.id)+'.bak');await rename(temp,file(p.id));return next;}};
}
