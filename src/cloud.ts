import {createClient} from '@supabase/supabase-js';
import {localRepository,cloudRepository} from './project-repository.mjs';
const mode=import.meta.env.VITE_STORAGE_MODE;
export const cloudEnabled=mode==='cloud'||mode!=='local'&&(import.meta.env.PROD||!!import.meta.env.VITE_SUPABASE_URL);
const url=import.meta.env.VITE_SUPABASE_URL,key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
function publicKey(value:string){
 if(value.startsWith('sb_secret_'))return false;
 if(value.startsWith('sb_publishable_'))return true;
 try{return JSON.parse(atob(value.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).role==='anon'}catch{return false}
}
export const configError=cloudEnabled&&(!url||!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url)||!key||!publicKey(key))?'Облачное хранилище не настроено. Добавьте VITE_SUPABASE_URL и публичный VITE_SUPABASE_PUBLISHABLE_KEY в Vercel, затем повторите сборку.':'';
export const supabase=cloudEnabled&&!configError?createClient(url,key):null;
export const projectRepository=supabase?cloudRepository(supabase):localRepository();
