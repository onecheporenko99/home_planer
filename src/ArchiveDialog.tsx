import {useState} from 'react';
import {exportArchive,MAX_ARCHIVE_BYTES} from './project-archive.mjs';
import {downloadResource} from './resource-client';
import {downloadBlob} from './download';
import type {Project,Resource} from './types';
export function ArchiveDialog({project,onClose}:{project:Project;onClose:()=>void}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[progress,setProgress]=useState(0);
 const resources=project.resources??[],size=resources.reduce((n,r)=>n+r.byteLength,0);
 const run=async()=>{setBusy(true);setError('');setProgress(0);try{
  const bytes=await exportArchive(project,async (r:Resource)=>{const bytes=await (await downloadResource(r)).arrayBuffer();setProgress(n=>n+1);return bytes});
  downloadBlob(new Blob([bytes],{type:'application/zip'}),project.name+'.homeplaner.zip');
 }catch(e){setError((e as Error).message)}finally{setBusy(false)}};
 return <div className="overlay"><div className="dialog"><h2>Переносимый архив проекта</h2><p>План, все варианты и этажи вместе с изображениями, исходными PDF и фотографиями. Архив можно открыть через «Импорт» на другом устройстве.</p><p>Файлов: {resources.length} · {(size/1024/1024).toFixed(1)} МБ. Лимит архива — {MAX_ARCHIVE_BYTES/1024/1024} МБ.</p><p className="hint">История сохранённых версий остаётся в хранилище. Архив содержит текущее состояние проекта. JSON отдельно содержит только данные и ссылки на файлы.</p>{error&&<p role="alert" className="error">{error}</p>}<button className="primary" onClick={()=>void run()} disabled={busy}>{busy?`Подготовка файлов: ${progress} / ${resources.length}`:'Скачать архив'}</button><button onClick={onClose} disabled={busy}>Закрыть</button></div></div>;
}
