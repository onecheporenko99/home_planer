import {validateProject} from './core.mjs';
import {inspectData} from './validation-data.mjs';
export const MAX_IMPORT_BYTES=5*1024*1024;
export function importProject(text){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>MAX_IMPORT_BYTES)throw Error('Размер JSON не должен превышать 5 МБ');
 let raw;try{raw=JSON.parse(text)}catch{throw Error('Файл содержит некорректный JSON')}
 inspectData(raw);if(raw.variantSnapshot)throw Error('Выберите полный проект, а не внутренний снимок варианта');const p=validateProject(raw),now=new Date().toISOString();
 return {...p,id:crypto.randomUUID(),revision:0,name:(p.name+' (импорт)').slice(0,200),createdAt:now,updatedAt:now};
}
