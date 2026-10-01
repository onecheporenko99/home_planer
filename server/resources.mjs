import {mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
export {inspectResource} from '../src/resource-bytes.mjs';
import {inspectResource} from '../src/resource-bytes.mjs';
export function resourceStorage(root){
 const file=id=>{if(!/^[a-f0-9]{64}$/.test(id))throw Error('Некорректный ID ресурса');return path.join(root,id)};
 return {async put(bytes,mime,name){const dimensions=inspectResource(bytes,mime);if(typeof name!=='string'||name.length>200)throw Error('Некорректное имя файла');const id=createHash('sha256').update(bytes).digest('hex'),metadata={id,sha256:id,name,mimeType:mime,byteLength:bytes.length,...dimensions};await mkdir(root,{recursive:true});try{await writeFile(file(id)+'.bin',bytes,{flag:'wx'})}catch(e){if(e.code!=='EEXIST')throw e}try{await writeFile(file(id)+'.json',JSON.stringify(metadata),{flag:'wx'})}catch(e){if(e.code!=='EEXIST')throw e}return metadata},async get(id){const metadata=JSON.parse(await readFile(file(id)+'.json','utf8')),bytes=await readFile(file(id)+'.bin');if(createHash('sha256').update(bytes).digest('hex')!==id)throw Error('Ресурс повреждён: контрольная сумма не совпадает');return {metadata,bytes}}};
}
// Immutable blobs are retained: undo, .bak documents and future versions may reference them.
// Garbage collection must examine every retained version/history before any physical deletion.
