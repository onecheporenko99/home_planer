import {zip,inflateSync,strToU8,strFromU8} from 'fflate';
import {validateProject} from './core.mjs';
import {importProject,MAX_IMPORT_BYTES} from './import-project.mjs';
import {sha256} from './browser-crypto.mjs';
import {inspectResource} from './resource-bytes.mjs';
export const MAX_ARCHIVE_BYTES=128*1024*1024;
const MAX_MANIFEST_BYTES=128*1024,MAX_ENTRIES=202;
const assetPath=id=>'resources/'+id+'.bin';
const fail=()=>{throw Error('Архив повреждён или имеет неподдерживаемый формат')};
const crcTable=Uint32Array.from({length:256},(_,i)=>{let c=i;for(let n=0;n<8;n++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0});
function crc32(bytes){let c=0xffffffff;for(const n of bytes)c=crcTable[(c^n)&255]^(c>>>8);return (c^0xffffffff)>>>0}
// Inspect the central directory BEFORE decompression: sizes, paths, duplicate
// names, encrypted/symlink entries, local headers and overlapping byte ranges.
export function inspectArchive(bytes){
 if(!(bytes instanceof Uint8Array)||bytes.length<22||bytes.length>MAX_ARCHIVE_BYTES)throw Error('Архив: до 128 МБ');
 const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let end=-1;
 for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(v.getUint32(i,true)===0x06054b50&&i+22+v.getUint16(i+20,true)===bytes.length){end=i;break}
 if(end<0||v.getUint16(end+4,true)||v.getUint16(end+6,true))fail();
 const count=v.getUint16(end+10,true),size=v.getUint32(end+12,true),offset=v.getUint32(end+16,true);
 if(count<2||count>MAX_ENTRIES||count!==v.getUint16(end+8,true)||offset+size!==end)fail();
 const entries=[],seen=new Set();let pos=offset,total=0;
 for(let i=0;i<count;i++){
  if(pos+46>end||v.getUint32(pos,true)!==0x02014b50)fail();
  const flags=v.getUint16(pos+8,true),method=v.getUint16(pos+10,true),crc=v.getUint32(pos+16,true),compressed=v.getUint32(pos+20,true),length=v.getUint32(pos+24,true),nl=v.getUint16(pos+28,true),el=v.getUint16(pos+30,true),cl=v.getUint16(pos+32,true),local=v.getUint32(pos+42,true);
  if(pos+46+nl+el+cl>end)fail();
  const name=strFromU8(bytes.subarray(pos+46,pos+46+nl));
  if(!/^(manifest\.json|project\.json|resources\/[a-f0-9]{64}\.bin)$/.test(name)||seen.has(name)||flags&(1|64|0x2000)||![0,8].includes(method)||v.getUint16(pos+34,true)||((v.getUint32(pos+38,true)>>>16)&0xf000)===0xa000)fail();
  const limit=name==='project.json'?MAX_IMPORT_BYTES:name==='manifest.json'?MAX_MANIFEST_BYTES:20*1024*1024;
  total+=length;if(!length||length>limit||total>MAX_ARCHIVE_BYTES||local+30>offset)throw Error('Превышены лимиты распаковки архива');
  if(v.getUint32(local,true)!==0x04034b50||v.getUint16(local+6,true)!==flags||v.getUint16(local+8,true)!==method)fail();
  const localName=v.getUint16(local+26,true),localExtra=v.getUint16(local+28,true),data=local+30+localName+localExtra;
  if(data+compressed>offset||strFromU8(bytes.subarray(local+30,local+30+localName))!==name||method===0&&compressed!==length)fail();
  if(!(flags&8)&&(v.getUint32(local+14,true)!==crc||v.getUint32(local+18,true)!==compressed||v.getUint32(local+22,true)!==length))fail();
  seen.add(name);entries.push({name,length,crc,local,data,compressed,method,end:data+compressed});pos+=46+nl+el+cl;
 }
 if(pos!==end||!seen.has('manifest.json')||!seen.has('project.json'))fail();
 const ranges=[...entries].sort((a,b)=>a.local-b.local);for(let i=1;i<ranges.length;i++)if(ranges[i].local<ranges[i-1].end)fail();
 return entries;
}
async function validateResource(bytes,resource){
 if(bytes.length!==resource.byteLength||await sha256(bytes)!==resource.sha256)throw Error('Контрольная сумма файла не совпадает: '+resource.name);
 const dimensions=inspectResource(bytes,resource.mimeType);
 if(resource.mimeType!=='application/pdf'&&(dimensions.width!==resource.width||dimensions.height!==resource.height))throw Error('Размеры изображения не совпадают: '+resource.name);
}
export async function exportArchive(input,readResource){
 const project=validateProject(input),projectBytes=strToU8(JSON.stringify(project));
 if(projectBytes.length>MAX_IMPORT_BYTES)throw Error('Размер JSON не должен превышать 5 МБ');
 const resources=project.resources??[],declared=resources.reduce((n,r)=>n+r.byteLength,projectBytes.length);
 if(declared+MAX_MANIFEST_BYTES+MAX_ENTRIES*200>MAX_ARCHIVE_BYTES)throw Error('Архив: общий размер файлов до 127 МБ');
 const files={'project.json':projectBytes};
 for(const resource of resources){const bytes=new Uint8Array(await readResource(resource));await validateResource(bytes,resource);files[assetPath(resource.id)]=bytes}
 files['manifest.json']=strToU8(JSON.stringify({format:'home-planer',version:1,project:'project.json',projectSha256:await sha256(projectBytes),resources:resources.map(r=>({id:r.id,path:assetPath(r.id),sha256:r.sha256,byteLength:r.byteLength,mimeType:r.mimeType}))}));
 const result=await new Promise((resolve,reject)=>zip(files,{level:0},(error,data)=>error?reject(error):resolve(data)));
 inspectArchive(result);return result;
}
export async function importArchive(bytes){
 const entries=inspectArchive(bytes),files={};
 // Decompress only the ranges inspected above, into bounded output buffers.
 // Do not ask a second ZIP parser to reinterpret EOCD comments/ZIP64 extras.
 try{for(const entry of entries){const data=bytes.subarray(entry.data,entry.end);files[entry.name]=entry.method===0?new Uint8Array(data):inflateSync(data,{out:new Uint8Array(entry.length)})}}catch{fail()}
 for(const entry of entries)if(!files[entry.name]||files[entry.name].length!==entry.length||crc32(files[entry.name])!==entry.crc)fail();
 let manifest;try{manifest=JSON.parse(strFromU8(files['manifest.json']))}catch{fail()}
 if(!manifest||manifest.format!=='home-planer'||manifest.version!==1||manifest.project!=='project.json'||!Array.isArray(manifest.resources)||manifest.resources.length>200||await sha256(files['project.json'])!==manifest.projectSha256)fail();
 const project=importProject(strFromU8(files['project.json'])),resources=project.resources??[];
 if(manifest.resources.length!==resources.length||entries.length!==resources.length+2)fail();
 const assets=[];
 for(const resource of resources){const records=manifest.resources.filter(r=>r?.id===resource.id),record=records[0];
  if(records.length!==1||record.path!==assetPath(resource.id)||record.sha256!==resource.sha256||record.byteLength!==resource.byteLength||record.mimeType!==resource.mimeType||!files[record.path])fail();
  const data=files[record.path];await validateResource(data,resource);assets.push({resource,bytes:data});
 }
 return {project,assets};
}
