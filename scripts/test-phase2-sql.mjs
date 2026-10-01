// Run from project root after: npm install --prefix tmp/sql-validation --no-audit --no-fund @electric-sql/pglite@0.5.8
// Isolated in-memory PostgreSQL; minimal auth/storage stand-ins, no cloud connection.
import fs from 'node:fs';
import {PGlite} from '../tmp/sql-validation/node_modules/@electric-sql/pglite/dist/index.js';
const db=new PGlite();
try{
await db.exec(`create role anon; create role authenticated; create schema auth; create schema storage;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,owner_id text,metadata jsonb,primary key(bucket_id,name));
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name,'/') $$;
grant usage on schema auth,storage to authenticated,anon;
grant select,insert,update,delete on storage.objects to authenticated;
`);
for(const f of fs.readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort()){
 await db.exec(fs.readFileSync('supabase/migrations/'+f,'utf8')); console.log('Applied',f);
}
const results=await db.exec(fs.readFileSync('supabase/phase2-stage9-verification.sql','utf8'));
for(const r of results) for(const row of r.rows??[]) if(Object.values(row).some(v=>String(v).startsWith('PASS'))) console.log(row);
console.log('Remaining test users/projects',await db.query('select (select count(*) from auth.users) users,(select count(*) from public.home_planer_projects) projects'));
}catch(e){console.error({message:e.message,detail:e.detail,where:e.where,code:e.code});process.exitCode=1;}finally{await db.close();}
