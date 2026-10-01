export function downloadBlob(blob:Blob,name:string){
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=name.replace(/[<>:"/\\|?*]/g,'_');a.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
