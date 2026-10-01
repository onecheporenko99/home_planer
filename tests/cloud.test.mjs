import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cloudRepository,localRepository,ProjectError} from '../src/project-repository.mjs';
import {freshProject} from '../src/core.mjs';
function fake({uid='owner-a',document=freshProject(),error=null}={}){
 const calls=[],client={auth:{getUser:async()=>({data:{user:uid?{id:uid}:null},error:null})},
  from(table){calls.push(['table',table]);const query={select(cols){calls.push(['select',cols]);return query},eq(k,v){calls.push(['eq',k,v]);return query},order:()=>({then(resolve,reject){return Promise.resolve({data:[{id:document.id,name:document.name,revision:1,updated_at:document.updatedAt}],error}).then(resolve,reject)},range:async()=>({data:[{revision:1,label:null,created_at:document.updatedAt}],error})}),maybeSingle:async()=>({data:document?{document}:null,error})};return query},
  rpc:async(name,args)=>{calls.push(['rpc',name,args]);return {data:{...args.p_document,revision:args.p_document.revision+1},error}}
 };return {calls,client};
}
test('Облачные список и открытие ограничены текущим подтверждённым пользователем',async()=>{
 const f=fake(),repo=cloudRepository(f.client);const list=await repo.list();assert.equal(list[0].revision,1);assert.ok(list[0].updatedAt);await repo.get(list[0].id);
 assert.equal(f.calls.filter(c=>c[0]==='eq'&&c[1]==='owner_id'&&c[2]==='owner-a').length,2);
 assert.ok(f.calls.some(c=>c[0]==='eq'&&c[1]==='id'&&c[2]===list[0].id));
});
test('Без входа облако не читает и не сохраняет проекты',async()=>{
 const f=fake({uid:null}),repo=cloudRepository(f.client);for(const action of [()=>repo.list(),()=>repo.get('id'),()=>repo.save(freshProject())])await assert.rejects(action,e=>e.status===401);assert.deepEqual(f.calls,[]);
});
test('Облачная запись валидируется до RPC и сохраняет ожидаемую ревизию',async()=>{
 const f=fake(),repo=cloudRepository(f.client),p=freshProject();const saved=await repo.save(p);assert.equal(saved.revision,1);assert.equal(f.calls[0][1],'home_planer_save_project');assert.equal(f.calls[0][2].p_document.revision,0);
 await assert.rejects(()=>repo.save({...p,objects:[{id:'broken'}]}));assert.equal(f.calls.length,1);
});
test('Конфликт облачных ревизий становится 409 и не изменяет проект',async()=>{
 const f=fake({error:{message:'Conflict',details:'revision_conflict',code:'P0001'}}),p=freshProject(),before=JSON.stringify(p);await assert.rejects(()=>cloudRepository(f.client).save(p),e=>e instanceof ProjectError&&e.status===409);assert.equal(JSON.stringify(p),before);
});
test('Локальный режим сохраняет API и обработку конфликтов',async()=>{
 let called;const p=freshProject(),repo=localRepository(async(url,options)=>{called={url,options};return {ok:true,status:200,json:async()=>({...p,revision:1})}});assert.equal((await repo.save(p)).revision,1);assert.equal(called.url,'/api/projects');assert.equal(JSON.parse(called.options.body).revision,0);
 const conflicting=localRepository(async()=>({ok:false,status:409,json:async()=>({error:'Conflict'})}));await assert.rejects(()=>conflicting.save(p),e=>e.status===409);
});
test('Новые облачные методы истории и точек требуют входа, ограничивают владельца и сохраняют ревизию',async()=>{const f=fake(),repo=cloudRepository(f.client),p=freshProject();await repo.versions(p.id);await repo.version(p.id,1);const checkpoint=await repo.checkpoint(p,'Перед ремонтом');assert.equal(checkpoint.revision,1);assert.ok(f.calls.some(c=>c[0]==='table'&&c[1]==='home_planer_versions'));assert.equal(f.calls.filter(c=>c[0]==='eq'&&c[1]==='owner_id'&&c[2]==='owner-a').length,2);assert.ok(f.calls.some(c=>c[0]==='rpc'&&c[1]==='home_planer_create_checkpoint'&&c[2].p_name==='Перед ремонтом'&&c[2].p_document.revision===0));const denied=fake({uid:null}),anonymous=cloudRepository(denied.client);for(const fn of [()=>anonymous.versions(p.id),()=>anonymous.version(p.id,1),()=>anonymous.checkpoint(p,'Точка')])await assert.rejects(fn,e=>e.status===401);assert.deepEqual(denied.calls,[]);});
test('Локальные методы истории используют отдельные URL, контрольная точка отправляет документ и название',async()=>{const p=freshProject(),calls=[],repo=localRepository(async(url,options)=>{calls.push({url,options});return {ok:true,status:200,json:async()=>url.endsWith('/versions')?[]:{...p,revision:1}}});await repo.versions(p.id);await repo.version(p.id,1);await repo.checkpoint(p,'Точка');assert.equal(calls[0].url,'/api/projects/'+p.id+'/versions');assert.equal(calls[1].url,'/api/projects/'+p.id+'/versions/1');assert.equal(JSON.parse(calls[2].options.body).name,'Точка');assert.equal(JSON.parse(calls[2].options.body).document.revision,0);});
test('История Supabase читает страницы, чтобы контрольные точки старше 1000 ревизий оставались доступны',async()=>{const ranges=[],client={auth:{getUser:async()=>({data:{user:{id:'owner'}}})},from(){const q={select:()=>q,eq:()=>q,order:()=>q,range:async(start,end)=>{ranges.push([start,end]);return {data:start===0?Array.from({length:1000},(_,i)=>({revision:1001-i,label:null,created_at:'2026-10-01'})):[{revision:1,label:'Первая точка',created_at:'2026-10-01'}],error:null}}};return q}};const versions=await cloudRepository(client).versions('project');assert.equal(versions.length,1001);assert.equal(versions.at(-1).label,'Первая точка');assert.deepEqual(ranges,[[0,999],[1000,1999]]);});
