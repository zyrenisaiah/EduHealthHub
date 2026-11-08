/* ---------- shared online database (Supabase) ---------- */
let TOK=null,REV=0,LASTFULL={},LASTSTOCK='',LASTNOTES='[]',TR_SYNCED=0,CLOUD_COUNT=0,SYNC_TXT='',_pushing=false,_again=false,_poll=null,_retry=null;
const canon=o=>JSON.stringify(o,(k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.keys(v).sort().reduce((r,x)=>(r[x]=v[x],r),{}):v);
function syncStat(t,bad){SYNC_TXT=t;const e=document.getElementById('syncstat');if(e){e.textContent=t;e.style.color=bad?'var(--bad)':''}}
async function rpc(fn,args,keep){
 const h={'Content-Type':'application/json',apikey:CLOUD.key};if(/^eyJ/.test(CLOUD.key))h.Authorization='Bearer '+CLOUD.key;
 let r;try{r=await fetch(CLOUD.url.replace(/\/+$/,'')+'/rest/v1/rpc/'+fn,{method:'POST',headers:h,body:JSON.stringify(args||{}),keepalive:!!keep})}
 catch(e){const x=new Error('OFFLINE');x.code='OFFLINE';throw x}
 const t=await r.text();let j=null;try{j=t?JSON.parse(t):null}catch(e){}
 if(!r.ok){const m=(j&&(j.message||j.error||j.hint))||('HTTP '+r.status);const x=new Error(m);x.code=m;x.status=r.status;throw x}
 return j}
/* ---- error reporting: unexpected browser errors are saved to the error_log table (Doctor reads them in Activity log) ---- */
(function(){let n=0;const seen=new Set();
 function report(msg,stack){
  if(!CLOUD_ON||n>=5||!msg||/ResizeObserver|^Script error/.test(msg))return;
  const k=String(msg).slice(0,200);if(seen.has(k))return;seen.add(k);n++;
  try{rpc('app_report_error',{p_token:TOK,p_data:{msg:String(msg),stack:String(stack||''),page:location.pathname.split('/').pop()+(S&&S.view?'#'+S.view:''),ua:navigator.userAgent}},true).catch(()=>{})}catch(e){}}
 addEventListener('error',e=>{const where=e.filename?String(e.filename).split('/').pop()+':'+e.lineno+':'+e.colno:'';report((e.message||'')+(where?' ['+where+']':''),(e.error&&e.error.stack)||where)});
 addEventListener('unhandledrejection',e=>{const r=e.reason;if(r&&(r.code||r.status))return;report('Unhandled: '+((r&&r.message)||r),r&&r.stack)});
})();
function cloudErr(e){
 const c=e&&e.code;
 if(c==='BAD_CODE')return 'That code is not right. Type the newest code from your app, or use a recovery code.';
 if(c==='TWOFA_SETUP_REQUIRED')return 'Two-step verification is now required. Log in again to set it up.';
 if(c==='OFFLINE')return 'Cannot reach the online database. Check your internet connection and try again.';
 if(c==='PASSWORD_CHANGE_REQUIRED')return 'You must choose a new password before continuing. Log in again to set it.';
 if(c==='SLOW_DOWN')return 'Too many requests at once. Wait a few seconds and try again.';
 if(c==='TOO_MANY_ATTEMPTS')return 'Too many attempts. Wait 5 minutes and try again.';
 if(c==='BAD_LOGIN')return 'Username or password is incorrect.';
 if(c==='SESSION_EXPIRED')return 'Your session expired. Please log in again.';
 if(c==='NOT_ALLOWED')return 'Your account is not allowed to make that change.';
 if(c==='WRONG_GOOGLE')return 'That Google account is not the one linked to this login.';
 if(c==='GOOGLE_INVALID')return 'Google could not confirm that account. Please try again.';
 if(c==='GOOGLE_NOT_SET_UP')return 'Google sign-in is not finished being set up yet.';
 if(c==='BAD_CODE')return 'That code is not correct. Check it and try again.';
 if(c==='CODE_EXPIRED')return 'That code has expired. Ask for a new one.';
 if(c==='TOO_MANY_TRIES')return 'Too many wrong codes. Log in again to get a new one.';
 if(c==='WAIT')return 'Please wait 30 seconds before asking for another code.';
 if(c==='TOO_MANY_CODES')return 'Too many codes were requested. Try again in an hour.';
 if(c==='BAD_EMAIL')return 'Enter a Gmail address, like name@gmail.com.';
 if(c==='EMAIL_TAKEN')return 'That Gmail is already linked to another account.';
 if(c==='SELF')return 'You cannot do that to your own account.';
 if(c==='LAST_DOCTOR')return 'At least one Doctor account must stay active.';
 if(c==='DUPLICATE')return 'That username or email is already used or waiting for approval.';
 if(c==='BAD_REQUEST')return 'Please check the form. Some details are not valid.';
 if(c==='NOT_FOUND')return 'That request was already handled.';
 if(c==='WEAK_PASSWORD')return 'New password needs 10+ characters with a letter and a number, and must differ from your username and old password.';
 if(c==='BAD_PASSWORD')return 'Password is incorrect.';
 if(c==='MAIL_NOT_SET_UP'||c==='MAIL_FAILED')return 'The email could not be sent. '+((e&&e.detail)?'('+e.detail+') ':'')+'The site owner still needs to finish the email setup.';
 return 'The online database is not set up correctly ('+c+'). Check the setup steps.'}
function baseline(){DB.students.forEach(s=>LASTFULL[s.id]=JSON.stringify(s));LASTSTOCK=JSON.stringify(DB.stock);LASTNOTES=JSON.stringify(DB.notes);TR_SYNCED=DB.transfers.length}
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
 if(r.notes&&r.notes.data&&LASTNOTES===JSON.stringify(DB.notes)){
  if(canon(r.notes.data)!==canon(DB.notes)){DB.notes=r.notes.data;changed=true}LASTNOTES=JSON.stringify(DB.notes)}
 if(r.transfers&&DB.transfers.length===TR_SYNCED){if(r.transfers.length!==DB.transfers.length)changed=true;DB.transfers=r.transfers;TR_SYNCED=r.transfers.length}
 REV=Math.max(REV,r.rev||0);CLOUD_COUNT=r.count||0;
 return changed}
function inField(){const a=document.activeElement;return !!(a&&(/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)||a.isContentEditable))||!!(S.view==='doc'&&S.doc&&S.doc.edit)}
function softRender(){if(!S.user)return;if(inField()){S.stale=true;return}S.stale=false;render()}
addEventListener('focusout',()=>setTimeout(()=>{if(S.stale&&S.user&&!inField()){S.stale=false;render()}},60));
async function cloudSync(initial,pre){
 const r=pre||await rpc('app_sync',{p_token:TOK,p_since:initial?0:Math.max(0,REV-100)});
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
  const nj=JSON.stringify(DB.notes);
  if(nj!==LASTNOTES&&(S.user.role==='Doctor'||S.user.role==='Nurse')){await rpc('app_save_notes',{p_token:TOK,p_data:DB.notes});LASTNOTES=nj}
  while(TR_SYNCED<DB.transfers.length){await rpc('app_add_transfer',{p_token:TOK,p_data:DB.transfers[TR_SYNCED]});TR_SYNCED++}
  syncStat('Saved online ✓')}
 catch(e){
  if(e.code==='SESSION_EXPIRED')return cloudKick();
  if(e.code==='NOT_ALLOWED'){syncStat('Change not allowed',true);toast(cloudErr(e));
   /* drop the rejected local edit so it does not retry forever */ try{await cloudSync(true);render()}catch(x){}}
  else{syncStat('Offline: will retry',true);_retry=setTimeout(cloudPush,8000)}}
 finally{_pushing=false;if(_again){_again=false;cloudPush()}}}
/* ---- closing the browser signs you out ----
   1) The login token lives in sessionStorage, so it disappears with the tab or browser.
   2) When a page closes we leave a note; the next visit to the site ends that session on the server at once
      (a quick reload or moving between pages within 15 seconds is not treated as closing).
   3) Every open page pings the server every 45 s; a session with no ping for 10 minutes is dead on the server. */
const CLOSE_KEY='ehh_closing';let _hb=null;
const closeList=()=>{try{return JSON.parse(localStorage.getItem(CLOSE_KEY)||'[]')}catch(e){return[]}};
const closeSave=l=>{try{l.length?localStorage.setItem(CLOSE_KEY,JSON.stringify(l.slice(-8))):localStorage.removeItem(CLOSE_KEY)}catch(e){}};
addEventListener('pagehide',e=>{if(e.persisted||!CLOUD_ON||!TOK)return;const l=closeList().filter(m=>m.tok!==TOK);l.push({tok:TOK,t:Date.now()});closeSave(l)});
(function sweepClosed(){
 if(!CLOUD_ON)return;const mine=ss.get('ehh_tok'),now=Date.now(),keep=[];
 closeList().forEach(m=>{
  if(now-m.t<15000){if(m.tok!==mine)keep.push(m);return}
  rpc('app_logout',{p_token:m.tok},true).catch(()=>{});
  if(m.tok===mine){ss.del('ehh_tok');ss.del('ehh_role');ss.del('ehh_uid')}});
 closeSave(keep)})();
function hbStart(){clearInterval(_hb);_hb=setInterval(()=>{if(TOK)rpc('app_ping',{p_token:TOK}).catch(e=>{if(e&&e.code==='SESSION_EXPIRED')cloudKick()})},45000)}
/* ---- live updates: the database pings this browser (Supabase Realtime) the moment something changes ----
   The ping carries no data; it only makes us fetch sooner through the normal checked calls.
   If the live connection is down we fall back to checking every few seconds (RT_ON=false). */
let RT_ON=false,_ws=null,_wsHb=null,_wsRetry=null,_wsTry=0,_wsDeb=null,_rtKey='',_pk=0;
function rtPing(){clearTimeout(_wsDeb);_wsDeb=setTimeout(()=>{if(!TOK||!S.user)return;cloudPollOnce();if(typeof msgSync==='function')msgSync()},120)}
async function rtStart(){
 rtStop();if(!CLOUD_ON||!TOK||typeof WebSocket==='undefined')return;
 let key;try{key=await rpc('app_rt',{p_token:TOK})}catch(e){return}
 if(!key||!TOK)return;_rtKey=key;rtConnect(key)}
function rtConnect(key){
 const url=CLOUD.url.replace(/\/+$/,'').replace(/^http/,'ws')+'/realtime/v1/websocket?apikey='+encodeURIComponent(CLOUD.key)+'&vsn=1.0.0';
 let ws;try{ws=new WebSocket(url)}catch(e){return}
 _ws=ws;let ref=0;const send=(topic,event,payload)=>{try{ws.send(JSON.stringify({topic,event,payload,ref:String(++ref),join_ref:'1'}))}catch(e){}};
 ws.onopen=()=>{send('realtime:rt:'+key,'phx_join',{config:{broadcast:{self:false,ack:false},presence:{enabled:false},private:false}});
  clearInterval(_wsHb);_wsHb=setInterval(()=>send('phoenix','heartbeat',{}),25000)};
 ws.onmessage=ev=>{let m;try{m=JSON.parse(ev.data)}catch(e){return}
  if(m.event==='phx_reply'&&m.topic==='realtime:rt:'+key){if(m.payload&&m.payload.status==='ok'){RT_ON=true;_wsTry=0}else{RT_ON=false}}
  else if(m.event==='broadcast'&&m.topic==='realtime:rt:'+key)rtPing();
  else if(m.event==='phx_close'||m.event==='phx_error'){RT_ON=false}};
 ws.onclose=()=>{clearInterval(_wsHb);RT_ON=false;if(_ws!==ws||!TOK)return;_ws=null;
  _wsTry++;_wsRetry=setTimeout(()=>{if(TOK&&_rtKey===key)rtConnect(key)},Math.min(30000,1000*Math.pow(2,Math.min(_wsTry,5))))};
 ws.onerror=()=>{RT_ON=false}}
function rtStop(){clearTimeout(_wsRetry);clearInterval(_wsHb);RT_ON=false;_rtKey='';const w=_ws;_ws=null;if(w){try{w.close()}catch(e){}}}
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&TOK&&CLOUD_ON&&!RT_ON&&!_ws)rtStart()});
function cloudKick(){rtStop();clearInterval(_hb);TOK=null;ss.del('ehh_tok');ss.del('ehh_role');clearInterval(_poll);S.user=null;location.replace('index.html?role='+PAGE)}
async function cloudPollOnce(){
 if(!TOK||document.hidden||_pushing)return;
 try{const {ch}=await cloudSync(false);if(!SYNC_TXT.startsWith('Saving'))syncStat('Saved online ✓');if(ch)softRender()}
 catch(e){if(e.code==='SESSION_EXPIRED')cloudKick();else syncStat('Offline: will retry',true)}}
function cloudStart(){clearInterval(_poll);_poll=setInterval(()=>{if(RT_ON&&++_pk%5)return;cloudPollOnce()},12000);if(typeof msgStart==='function')msgStart();rtStart();hbStart()}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)cloudPollOnce()});
async function cloudEnter(r,pre){
 TOK=r.token;ss.set('ehh_tok',TOK);ss.set('ehh_role',r.account.role);
 const a=r.account;DB.accounts=[Object.assign({},a)];
 await cloudSync(true,pre);
 S.user={id:a.id,role:a.role,name:a.name,adv:a.adv||null,photo:a.photo||null};
 S.view=NAV[a.role][0][0];S.back=S.view;S.f={q:'',grade:'',strand:'',section:''};S.sy=CUR_SY;
 syncStat('Saved online ✓');cloudStart();render()}
async function cloudLogin(u,pw){
 const L=S.login,btn=$('#loginform button[type=submit]');if(btn){btn.disabled=true;btn.textContent='Signing in…'}
 try{const r=await rpc('app_login',{p_user:u,p_pw:pw});
  if(r.error){L.err=cloudErr({code:r.error});render();const i=$('#lu');if(i)i.value=u;return}
  if(r.pending){L.pending={token:r.pending,hint:r.hint,pw,sent:false,msg:'',mailErr:''};L.err='';L.info='';
   render();mailCode();return}
  if(r.totp){L.totp={token:r.totp,pw,err:''};L.err='';L.info='';render();const ti=$('#tc');if(ti)ti.focus();return}
  L.err='';
  if(r.account&&r.account.must_change){L.must={token:r.token,old:pw,role:r.account.role,acct:r.account};lockWrite(r.account);L.info='';render();const ni=$('#mu-n');if(ni)ni.focus();return}
  if(r.account&&r.account.need2fa){lockWrite(r.account);return twofaStart(r.token,r.account,r.account.role)}
  /* app_sync needs the token; the account comes back from app_login */
  lockWrite(r.account);TOK=r.token;ss.set('ehh_tok',TOK);ss.set('ehh_role',r.account.role);location.href=ROLE_PAGE[r.account.role]}
 catch(e){TOK=null;L.err=cloudErr(e);render();const i=$('#lu');if(i)i.value=u}}
/* ---------- two-step verification (authenticator app codes) ---------- */
function spaceKey(s){return String(s||'').replace(/(.{4})/g,'$1 ').trim()}
function otpUri(secret,user){return 'otpauth://totp/'+encodeURIComponent('EduHealthHub:'+user)+'?secret='+secret+'&issuer=EduHealthHub&algorithm=SHA1&digits=6&period=30'}
function codesHtml(codes){return `<div class="rcodes mono">${codes.map(c=>`<span>${esc(c)}</span>`).join('')}</div>`}
function enrollHtml(E){
 if(E.step==='codes')return `<div><h2>Save your recovery codes</h2><div class="small muted">If you lose your phone, each code below works <b>once</b> instead of an app code. Keep them somewhere safe, not only on the same phone. They are shown just this one time.</div></div>
  ${codesHtml(E.codes)}
  <div class="trow"><button type="button" class="btn sm" data-act="enrcopy">Copy</button><button type="button" class="btn sm" data-act="enrdl">Download</button></div>
  <label class="small" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="en-ok"> I saved my recovery codes</label>
  ${E.err?`<div class="pill bad" role="alert" style="white-space:normal">${esc(E.err)}</div>`:''}
  <button class="btn primary" type="button" data-act="enrdone">Continue</button>`;
 return `<div><h2>Set up two-step verification</h2><div class="small muted">Every account needs this. After your password, you also type a 6-digit code from an app on your phone.</div></div>
  ${E.secret?`<ol class="small" style="margin:0;padding-left:18px;display:grid;gap:4px"><li>Install an authenticator app (Google Authenticator, Microsoft Authenticator or Authy).</li><li>In the app, add an account and scan this code.</li><li>Type the 6-digit code the app shows.</li></ol>
  <div class="qrbox">${qrSvg(otpUri(E.secret,E.username),190)}</div>
  <div class="small muted">Cannot scan? Type this key into the app instead:</div><div class="mono" style="user-select:all;overflow-wrap:anywhere">${spaceKey(E.secret)}</div>
  <div class="field"><label for="en-c">6-digit code</label><input class="inp" id="en-c" inputmode="numeric" autocomplete="one-time-code" maxlength="7" required></div>`:'<div class="small muted" role="status">Preparing…</div>'}
  ${E.err?`<div class="pill bad" role="alert" style="white-space:normal">${esc(E.err)}</div>`:''}
  <button class="btn primary" type="submit" ${E.secret?'':'disabled'}>Verify and turn on</button>`}
async function twofaStart(token,acct,role){
 const L=S.login;L.must=null;L.pending=null;L.totp=null;L.err='';L.info='';
 L.enroll={token,acct,role,step:'scan',secret:'',username:acct.username,err:''};render();
 try{const r=await rpc('app_totp_begin',{p_token:token});L.enroll.secret=r.secret;L.enroll.username=r.username;render();const i=$('#en-c');if(i)i.focus()}
 catch(e){L.enroll=null;lockFree();L.err=cloudErr(e);render()}}
async function twofaVerify(){
 const L=S.login,E=L.enroll;if(!E||E.step!=='scan')return;const el=$('#en-c');if(!el)return;
 try{const r=await rpc('app_totp_enable',{p_token:E.token,p_code:el.value});
  if(r.error){E.err=cloudErr({code:r.error});render();const i=$('#en-c');if(i)i.focus();return}
  E.codes=r.codes;E.step='codes';E.err='';render()}
 catch(e){E.err=cloudErr(e);render()}}
function twofaFinish(token,acct,role){lockWrite(acct);TOK=token;ss.set('ehh_tok',TOK);ss.set('ehh_role',role);location.href=ROLE_PAGE[role]}
async function totpLogin(){
 const L=S.login,T=L.totp;if(!T)return;const el=$('#tc');if(!el)return;
 try{const r=await rpc('app_totp_login',{p_token:T.token,p_code:el.value});
  if(r.error){T.err=cloudErr({code:r.error});render();const i=$('#tc');if(i)i.focus();return}
  L.totp=null;
  if(r.account.must_change){L.must={token:r.token,old:T.pw,role:r.account.role,acct:r.account};lockWrite(r.account);render();const ni=$('#mu-n');if(ni)ni.focus();return}
  twofaFinish(r.token,r.account,r.account.role)}
 catch(e){if(e.code==='SESSION_EXPIRED'){L.totp=null;L.err=cloudErr(e)}else T.err=cloudErr(e);render()}}
async function cloudRestore(){
 const t=ss.get('ehh_tok');if(!t)return 'none';
 try{TOK=t;const r=await rpc('app_sync',{p_token:t,p_since:0});
  await cloudEnter({token:t,account:r.account},r)}
 catch(e){console.error('restore failed',e);if(e&&e.code==='SESSION_EXPIRED'){TOK=null;ss.del('ehh_tok');ss.del('ehh_role');return 'expired'}return e}return 'ok'}
async function cloudLogout(){rtStop();clearInterval(_hb);const t=TOK;TOK=null;clearInterval(_poll);ss.del('ehh_tok');ss.del('ehh_role');REV=0;
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

/* ---------- Continue with Google (confirms the person owns the Google account) ---------- */
function loadGIS(cb){
 if(window.google&&google.accounts&&google.accounts.id)return cb();
 if(document.getElementById('gis')){setTimeout(()=>loadGIS(cb),200);return}
 const s=document.createElement('script');s.id='gis';s.src='https://accounts.google.com/gsi/client';s.async=true;s.onload=()=>cb();document.head.appendChild(s)}
function mountGoogle(elId,handler,text){
 if(!GOOGLE_CLIENT_ID)return;
 loadGIS(()=>{const el=document.getElementById(elId);if(!el)return;
  google.accounts.id.initialize({client_id:GOOGLE_CLIENT_ID,callback:r=>handler(r.credential),auto_select:false});
  google.accounts.id.renderButton(el,{theme:'outline',size:'large',text:text||'continue_with',shape:'pill',width:260})})}
async function googleCall(kind,token,credential){return fnCall('google-auth',{kind,token,credential})}
async function fnCall(name,body){
 const h={'Content-Type':'application/json',apikey:CLOUD.key};if(/^eyJ/.test(CLOUD.key))h.Authorization='Bearer '+CLOUD.key;
 let r;try{r=await fetch(CLOUD.url.replace(/\/+$/,'')+'/functions/v1/'+name,{method:'POST',headers:h,body:JSON.stringify(body)})}
 catch(e){const x=new Error('OFFLINE');x.code='OFFLINE';throw x}
 let j=null;try{j=await r.json()}catch(e){}
 if(!r.ok||!j||j.error){const c=(j&&j.error)||('HTTP '+r.status);const x=new Error(c);x.code=c;throw x}
 return j}
/* ---------- linked Google account: a 6-digit code is emailed before login (or confirm with Google) ---------- */
function loginDone(r,pw){
 const L=S.login;L.pending=null;L.totp=null;L.err='';L.info='';
 if(r.account&&r.account.must_change){L.must={token:r.token,old:pw,role:r.account.role,acct:r.account};lockWrite(r.account);render();const ni=$('#mu-n');if(ni)ni.focus();return}
 if(r.account&&r.account.need2fa){lockWrite(r.account);return twofaStart(r.token,r.account,r.account.role)}
 lockWrite(r.account);TOK=r.token;ss.set('ehh_tok',TOK);ss.set('ehh_role',r.account.role);location.href=ROLE_PAGE[r.account.role]}
async function mailCode(){
 const L=S.login,P=L.pending;if(!P||P.busy)return;P.busy=true;P.mailErr='';P.msg='Sending a code to your Gmail...';render();
 try{const j=await fnCall('send-code',{kind:'login',token:P.token});if(S.login.pending!==P)return;P.sent=true;P.msg='We emailed a 6-digit code to '+j.hint+'. It works for 10 minutes.'}
 catch(e){if(S.login.pending!==P)return;P.msg='';if(e.code==='SESSION_EXPIRED'){L.pending=null;L.err=cloudErr(e)}else P.mailErr=cloudErr(e)}
 P.busy=false;const typed=$('#lc')?$('#lc').value:'';render();const i=$('#lc');if(i){i.value=typed;i.focus()}}
async function verifyLoginCode(){
 const L=S.login,P=L.pending;if(!P)return;const el=$('#lc');if(!el)return;
 try{const r=await rpc('app_verify_login',{p_token:P.token,p_code:el.value.replace(/\s/g,'')});
  if(r.error){L.err=cloudErr({code:r.error});if(r.error==='TOO_MANY_TRIES')L.pending=null;render();const i=$('#lc');if(i)i.focus();return}
  loginDone(r,P.pw)}
 catch(e){if(e.code==='SESSION_EXPIRED')L.pending=null;L.err=cloudErr(e);render()}}
async function googleLogin(cred){
 const L=S.login;if(!L.pending)return;const pw=L.pending.pw;
 try{const r=await googleCall('login',L.pending.token,cred);loginDone(r,pw)}
 catch(e){if(e.code==='SESSION_EXPIRED')L.pending=null;L.err=cloudErr(e);L.info='';render()}}
async function googleLink(cred){
 try{const r=await googleCall('link',TOK,cred);Object.assign(DB.accounts[0],r.account);S.gm=null;toast('Google account linked. Logins now ask you to confirm with Google.');render()}
 catch(e){S.gm=Object.assign(S.gm||{},{err:cloudErr(e)});render()}}
function afterRender(){
 if(!GOOGLE_CLIENT_ID||!CLOUD_ON)return;
 if(document.getElementById('g-login'))mountGoogle('g-login',googleLogin,'continue_with');
 if(document.getElementById('g-link'))mountGoogle('g-link',googleLink,'continue_with')}
