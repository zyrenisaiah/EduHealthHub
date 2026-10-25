/* ===== SHARED DATABASE SETTINGS =====
   Paste your Supabase "Project URL" and "anon / publishable key" between the quotes.
   Leave both empty to run in single-browser (local) mode. */
const CLOUD={url:"",key:""};
const CLOUD_ON=!!(CLOUD.url&&CLOUD.key);
/* which page is this? home (login) or one page per role */
const PAGE=document.body.dataset.page||'home';
const ROLE_PAGE={Doctor:'doctor.html',Nurse:'nurse.html',Dentist:'dentist.html',Teacher:'teacher.html'};
const ss={get:k=>{try{return sessionStorage.getItem(k)}catch(e){return null}},set:(k,v)=>{try{sessionStorage.setItem(k,v)}catch(e){}},del:k=>{try{sessionStorage.removeItem(k)}catch(e){}}};
