/* ===== SHARED DATABASE SETTINGS =====
   Paste your Supabase "Project URL" and "anon / publishable key" between the quotes.
   Leave both empty to run in single-browser (local) mode. */
const CLOUD={url:"https://myfcltwnunmrtiymkths.supabase.co",key:"sb_publishable_7m37CCvmCEAsIhff10wadA_y6zjaJLO"};
/* Optional: your Google OAuth "Web client ID" turns on the 'Continue with Google' buttons (see README). */
const GOOGLE_CLIENT_ID="239588073376-u1pet0b32a3qfbo4824c2tk5n13se5li.apps.googleusercontent.com";
/* Emailed 6-digit codes need a sender Gmail (see README). Leave false to use Google confirmation only. */
const EMAIL_CODES_ON=false;
const CLOUD_ON=!!(CLOUD.url&&CLOUD.key);
/* which page is this? home (login) or one page per role */
const PAGE=document.body.dataset.page||'home';
const ROLE_PAGE={Doctor:'doctor.html',Nurse:'nurse.html',Dentist:'dentist.html',Teacher:'teacher.html'};
const ss={get:k=>{try{return sessionStorage.getItem(k)}catch(e){return null}},set:(k,v)=>{try{sessionStorage.setItem(k,v)}catch(e){}},del:k=>{try{sessionStorage.removeItem(k)}catch(e){}}};
