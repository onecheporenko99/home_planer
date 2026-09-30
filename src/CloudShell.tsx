import {useEffect,useState} from 'react';
import type {Session} from '@supabase/supabase-js';
import {App} from './App';
import {cloudEnabled,configError,supabase} from './cloud';
export function CloudShell(){
 const [session,setSession]=useState<Session|null>(null),[ready,setReady]=useState(!cloudEnabled),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[signup,setSignup]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 useEffect(()=>{if(!supabase)return;let active=true;supabase.auth.getSession().then(({data,error})=>{if(active){setSession(data.session);setReady(true);if(error)setError(error.message)}}).catch(()=>{if(active){setReady(true);setError('Не удалось подключиться к аккаунту')}});const {data}=supabase.auth.onAuthStateChange((_event,next)=>{if(active){setSession(next);setReady(true)}});return()=>{active=false;data.subscription.unsubscribe()}},[]);
 if(!cloudEnabled)return <App/>;
 if(configError)return <div className="auth-page"><section className="auth-card"><h1>Home Planer</h1><h2>Настройка облачной версии</h2><p role="alert">{configError}</p><p>Инструкции находятся в файле DEPLOYMENT.md проекта.</p></section></div>;
 if(!ready)return <div className="auth-page">Подключение к аккаунту…</div>;
 if(session)return <App key={session.user.id} recoveryKey={'home-planer-cloud:'+session.user.id} cloudEmail={session.user.email??'Аккаунт'} onSignOut={async()=>{const {error}=await supabase!.auth.signOut();if(error)throw error}}/>;
 const submit=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);setError('');setMessage('');try{
  if(signup){const {data,error}=await supabase!.auth.signUp({email:email.trim(),password,options:{emailRedirectTo:window.location.origin}});if(error)throw error;if(!data.session)setMessage('Проверьте почту и подтвердите адрес, затем войдите.')}else{const {error}=await supabase!.auth.signInWithPassword({email:email.trim(),password});if(error)throw error}
 }catch(e){setError((e as Error).message)}finally{setBusy(false);setPassword('')}};
 return <div className="auth-page"><section className="auth-card"><div className="brand">⌂ Home Planer</div><h1>{signup?'Создать аккаунт':'Ваши сохранённые планы'}</h1><p>Войдите, чтобы сохранять проекты и открывать их на другом устройстве. Каждый аккаунт видит свои проекты.</p><form onSubmit={submit}><label>Email<input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} disabled={busy}/></label><label>Пароль<input type="password" minLength={signup?8:1} required autoComplete={signup?'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)} disabled={busy}/></label>{error&&<p role="alert" className="error">{error}</p>}{message&&<p role="status">{message}</p>}<button className="primary" disabled={busy}>{busy?'Подключение…':signup?'Зарегистрироваться':'Войти'}</button></form><button disabled={busy} onClick={()=>{setSignup(!signup);setError('');setMessage('');setPassword('')}}>{signup?'Уже есть аккаунт — войти':'Создать аккаунт'}</button></section></div>;
}
