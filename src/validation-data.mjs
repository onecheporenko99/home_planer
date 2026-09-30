export function inspectData(value,depth=0){
 if(depth>32)throw Error('Слишком глубокая структура JSON');
 if(typeof value==='number'&&!Number.isFinite(value))throw Error('JSON содержит неконечное число');
 if(typeof value==='string'&&value.length>10000)throw Error('Слишком длинная строка');
 if(value&&typeof value==='object')for(const key of Object.keys(value)){
  if(['__proto__','prototype','constructor'].includes(key))throw Error('Недопустимое поле JSON');
  inspectData(value[key],depth+1);
 }
}
