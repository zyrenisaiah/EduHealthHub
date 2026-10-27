/* ---------- shared online database (Supabase) ---------- */
let TOK=null,REV=0,LASTFULL={},LASTSTOCK='',TR_SYNCED=0,CLOUD_COUNT=0,SYNC_TXT='',_pushing=false,_again=false,_poll=null,_retry=null;
const canon=o=>JSON.stringify(o,(k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.keys(v).sort().reduce((r,x)=>(r[x]=v[x],r),{}):v);
function syncStat(t,bad){SYNC_TXT=t;const e=document.getElementById('syncstat');if(e){e.textContent=t;e.style.color=bad?'var(--bad)':''}}
async function rpc(fn,args,keep){
 const h={'Content-Type':'application/json',apikey:CLOUD.key};if(/^eyJ/.test(CLOUD.key))h.Authorization='Bearer '+CLOUD.key;
 let r;try{r=await fetch(CLOUD.url.replace(/\/+$/,'')+'/rest/v1/rpc/'+fn,{method:'POST',headers:h,body:JSON.stringify(args||{}),keepalive:!!keep})}
 catch(e){const x=new Error('OFFLINE');x.code='OFFLINE';throw x}
 const t=await r.text();let j=null;try{j=t?JSON.parse(t):null}catch(e){}
 if(!r.ok){const m=(j&&(j.message||j.error||j.hint))||('HTTP '+r.status);const x=new Error(m);x.code=m;x.status=r.status;throw x}
 return j}
function cloudErr(e){
 const c=e&&e.code;
 if(c==='OFFLINE')return 'Cannot reach the online database. Check your internet connection and try again.';
 if(c==='TOO_MANY_ATTEMPTS')return 'Too many attempts. Wait a minute and try again.';
 if(c==='BAD_LOGIN')return 'Username or password is incorrect.';
 if(c==='SESSION_EXPIRED')return 'Your session expired. Please log in again.';
 if(c==='NOT_ALLOWED')return 'Your account is not allowed to make that change.';
 if(c==='BAD_CODE')return 'That code is not correct. Check it and try again.';
 if(c==='CODE_EXPIRED')return 'That code has expired. Ask for a new one.';
 if(c==='TOO_MANY_TRIES')return 'Too many wrong codes. Log in again to get a new one.';
 if(c==='WAIT')return 'Please wait 30 seconds before asking for another code.';
 if(c==='TOO_MANY_CODES')return 'Too many codes were requested. Try again in an hour.';
 if(c==='BAD_EMAIL')return 'Enter a Gmail address, like name@gmail.com.';
 if(c==='EMAIL_TAKEN')return 'That Gmail is already linked to another account.';
 if(c==='BAD_PASSWORD')return 'Password is incorrect.';
 if(c==='MAIL_NOT_SET_UP'||c==='MAIL_FAILED')return 'The email could not be sent. The site owner still needs to finish the email setup.';
 return 'The online database is not set up correctly ('+c+'). Check the setup steps.'}
function baseline(){DB.students.forEach(s=>LASTFULL[s.id]=JSON.stringify(s));LASTSTOCK=JSON.stringify(DB.stock);TR_SYNCED=DB.transfers.length}
function applySync(r){
 let changed=false;
 if(r.students&&r.students.length){
  const idx={};DB.students.forEach((s,i)=>idx[s.id]=i);
  r.students.forEach(row=>{const i=idx[row.id];if(i==null)return;const cur=DB.students[i];
   if(LASTFULL[row.id]!==undefined&&JSON.stringify(cur)!==LASTFULL[row.id])return;
   const m=Object.assign({},JSON.parse(SEEDJ[row.id]),row.data);
   if(canon(m)!==canon(cur)){DB.students[i]=m;changed=true;LASTFULL[row.id]=JSON.stringify(m)}else LASTFULL[row.id]=JSON.stringify(cur)})}
 if(r.stock&&r.stock.data&&LASTSTOCK===JSON.stringify(DB.stock)){
  if(canon(r.stock.data)!==canon(DB.stock)){DB.stock=r.stock.data;changed=true}LASTSTOCK=JSON.stringify(DB.stock)}
 if(r.transfers&&DB.transfers.length===TR_SYNCED){if(r.transfers.length!==DB.transfers.length)changed=true;DB.transfers=r.transfers;TR_SYNCED=r.transfers.length}
 REV=Math.max(REV,r.rev||0);CLOUD_COUNT=r.count||0;
 return changed}
function inField(){const a=document.activeElement;return !!(a&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))}
function softRender(){if(!S.user)return;if(inField()){S.stale=true;return}S.stale=false;render()}
addEventListener('focusout',()=>setTimeout(()=>{if(S.stale&&S.user&&!inField()){S.stale=false;render()}},60));
async function cloudSync(initial){
 const r=await rpc('app_sync',{p_token:TOK,p_since:initial?0:Math.max(0,REV-100)});
 if(initial)baseline();
 const ch=applySync(r);return {r,ch}}
async function cloudPush(){
 if(!TOK||!S.user)return;if(_pushing){_again=true;return}
 _pushing=true;clearTimeout(_retry);
 try{
  const rows=[],sent=[];
  DB.students.forEach(s=>{const j=JSON.stringify(s);if(LASTFULL[s.id]===j)return;
   const last=JSON.parse(LASTFULL[s.id]||'{}'),patch={};
   Object.keys(s).forEach(k=>{if(JSON.stringify(s[k])!==JSON.stringify(last[k]))patch[k]=s[k]});
   Object.keys(last).forEach(k=>{if(!(k in s))patch[k]=null});
   if(Object.keys(patch).length)rows.push({id:s.id,patch});sent.push([s.id,j])});
  if(rows.length){syncStat('Saving…');await rpc('app_save_students',{p_token:TOK,p_rows:rows},JSON.stringify(rows).length<30000);sent.forEach(([id,j])=>LASTFULL[id]=j)}
  else sent.forEach(([id,j])=>LASTFULL[id]=j);
  const sj=JSON.stringify(DB.stock);
  if(sj!==LASTSTOCK&&(S.user.role==='Doctor'||S.user.role==='Nurse')){await rpc('app_save_stock',{p_token:TOK,p_data:DB.stock});LASTSTOCK=sj}
  while(TR_SYNCED<DB.transfers.length){await rpc('app_add_transfer',{p_token:TOK,p_data:DB.transfers[TR_SYNCED]});TR_SYNCED++}
  syncStat('Saved online ✓')}
 catch(e){
  if(e.code==='SESSION_EXPIRED')return cloudKick();
  if(e.code==='NOT_ALLOWED'){syncStat('Change not allowed',true);toast(cloudErr(e));
   /* drop the rejected local edit so it does not retry forever */ try{await cloudSync(true);render()}catch(x){}}
  else{syncStat('Offline: will retry',true);_retry=setTimeout(cloudPush,8000)}}
 finally{_pushing=false;if(_again){_again=false;cloudPush()}}}
function cloudKick(){TOK=null;ss.del('ehh_tok');ss.del('ehh_role');clearInterval(_poll);S.user=null;location.replace('index.html?role='+PAGE)}
async function cloudPollOnce(){
 if(!TOK||document.hidden||_pushing)return;
 try{const {ch}=await cloudSync(false);if(!SYNC_TXT.startsWith('Saving'))syncStat('Saved online ✓');if(ch)softRender()}
 catch(e){if(e.code==='SESSION_EXPIRED')cloudKick();else syncStat('Offline: will retry',true)}}
function cloudStart(){clearInterval(_poll);_poll=setInterval(cloudPollOnce,12000)}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)cloudPollOnce()});
async function cloudEnter(r){
 TOK=r.token;ss.set('ehh_tok',TOK);ss.set('ehh_role',r.account.role);
 const a=r.account;DB.accounts=[Object.assign({},a)];
 await cloudSync(true);
 S.user={id:a.id,role:a.role,name:a.name,adv:a.adv||null,photo:a.photo||null};
 S.view=NAV[a.role][0][0];S.back=S.view;S.f={q:'',grade:'',strand:'',section:''};S.sy=CUR_SY;
 syncStat('Saved online ✓');cloudStart();render()}
async function cloudLogin(u,pw){
 const L=S.login,btn=$('#loginform button[type=submit]');if(btn){btn.disabled=true;btn.textContent='Signing in…'}
 try{const r=await rpc('app_login',{p_user:u,p_pw:pw});
  if(r.error){L.err=cloudErr({code:r.error});render();const i=$('#lu');if(i)i.value=u;return}
  if(r.pending){L.pending={token:r.pending,hint:r.hint};L.err='';L.info='';
   try{await sendCode('login',r.pending)}catch(e){L.err=cloudErr(e)}
   render();const ci=$('#lc');if(ci)ci.focus();return}
  L.err='';
  /* app_sync needs the token; the account comes back from app_login */
  TOK=r.token;ss.set('ehh_tok',TOK);ss.set('ehh_role',r.account.role);location.href=ROLE_PAGE[r.account.role]}
 catch(e){TOK=null;L.err=cloudErr(e);render();const i=$('#lu');if(i)i.value=u}}
async function cloudRestore(){
 const t=ss.get('ehh_tok');if(!t)return 'none';
 try{TOK=t;const r=await rpc('app_sync',{p_token:t,p_since:0});
  await cloudEnter({token:t,account:r.account})}
 catch(e){console.error('restore failed',e);if(e&&e.code==='SESSION_EXPIRED'){TOK=null;ss.del('ehh_tok');ss.del('ehh_role');return 'expired'}return e}return 'ok'}
async function cloudLogout(){const t=TOK;TOK=null;clearInterval(_poll);ss.del('ehh_tok');ss.del('ehh_role');REV=0;
 if(t){try{await rpc('app_logout',{p_token:t})}catch(e){}}}
async function seedCloud(){
 const btn=$('[data-act="seedcloud"]'),msg=$('#seedmsg');if(btn)btn.disabled=true;
 const say=m=>{if(msg)msg.textContent=m};
 try{
  const B=50;let done=0;
  for(let i=0;i<SEED.students.length;i+=B){
   const rows=SEED.students.slice(i,i+B).map(s=>({id:s.id,data:JSON.parse(SEEDJ[s.id])}));
   await rpc('app_seed',{p_token:TOK,p_rows:rows,p_stock:i===0?SEED.stock:null});
   done+=rows.length;say('Uploading… '+done+' of '+SEED.students.length)}
  const {ch}=await cloudSync(true);say('Done. '+CLOUD_COUNT+' student records are stored online.');toast('Starting data uploaded');render()}
 catch(e){say('Upload stopped: '+cloudErr(e)+' You can press the button again to continue.');if(btn)btn.disabled=false}}
function cloudPanel(){
 if(!CLOUD_ON||!S.user||S.user.role!=='Doctor')return '';
 const full=CLOUD_COUNT>=DB.students.length;
 return `<section class="panel"><div class="head"><div><h3>Shared online database</h3>
  <div class="small muted">Everything you and your colleagues change is saved online and appears in other browsers within about 15 seconds.</div></div>
  <button class="btn ${full?'':'primary'}" data-act="seedcloud">${full?'Re-check starting data':'Upload starting data'}</button></div>
  <div id="seedmsg" class="small" role="status">${full?'All '+CLOUD_COUNT+' student records are stored online.':CLOUD_COUNT+' of '+DB.students.length+' student records are stored online. Press the button once to upload the rest and the supply list.'}</div></section>`}

/* ---------- emailed confirmation codes (Gmail) ---------- */
async function sendCode(kind,token,email){
 const h={'Content-Type':'application/json',apikey:CLOUD.key};if(/^eyJ/.test(CLOUD.key))h.Authorization='Bearer '+CLOUD.key;
 let r;try{r=await fetch(CLOUD.url.replace(/\/+$/,'')+'/functions/v1/send-code',{method:'POST',headers:h,body:JSON.stringify({kind,token,email:email||null})})}
 catch(e){const x=new Error('OFFLINE');x.code='OFFLINE';throw x}
 let j=null;try{j=await r.json()}catch(e){}
 if(!r.ok||!j||j.error){const c=(j&&j.error)||('HTTP '+r.status);const x=new Error(c);x.code=c;throw x}
 return j}
async function cloudVerifyLogin(code){
 const L=S.login,btn=$('#codeform button[type=submit]');if(btn){btn.disabled=true;btn.textContent='Checking…'}
 try{const r=await rpc('app_verify_login',{p_token:L.pending.token,p_code:code});
  if(r.error){if(r.error==='TOO_MANY_TRIES')L.pending=null;L.err=cloudErr({code:r.error});L.info='';render();return}
  L.pending=null;L.err='';ss.set('ehh_tok',r.token);ss.set('ehh_role',r.account.role);location.href=ROLE_PAGE[r.account.role]}
 catch(e){if(e.code==='SESSION_EXPIRED')L.pending=null;L.err=cloudErr(e);render()}}
async function cloudResend(){
 const L=S.login;if(!L.pending)return;
 try{await sendCode('login',L.pending.token);L.err='';L.info='A new code was sent.'}catch(e){L.info='';L.err=cloudErr(e)}
 render();const ci=$('#lc');if(ci)ci.focus()}
