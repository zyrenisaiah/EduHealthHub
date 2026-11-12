/* ---------- state & helpers ---------- */
const $=(s,r=document)=>r.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const SEED=seedDB(),SEEDJ={};SEED.students.forEach(s=>SEEDJ[s.id]=JSON.stringify(s));
const SEEDLRN={};SEED.students.forEach(s=>SEEDLRN[s.id]=s.lrn);
let DB=SEED;
if(!CLOUD_ON)try{const j=localStorage.getItem('ehh3');
 if(j){const sv=JSON.parse(j),ov={};(sv.students||[]).forEach(s=>ov[s.id]=s);DB.students=SEED.students.map(s=>ov[s.id]||s);
  if(sv.stock)DB.stock=sv.stock;if(sv.accounts)DB.accounts=sv.accounts;if(sv.transfers)DB.transfers=sv.transfers;if(sv.notes)DB.notes=sv.notes;if(sv.signups)DB.signups=sv.signups}
 else{const o=localStorage.getItem('ehh2');if(o){const sv=JSON.parse(o);if(sv.stock)DB.stock=sv.stock;if(sv.accounts)DB.accounts=sv.accounts}}}catch(e){}
if(!CLOUD_ON)DB.students.forEach(s=>{if(SEEDLRN[s.id])s.lrn=SEEDLRN[s.id]});
let _t=null;
function doSave(){_t=null;if(CLOUD_ON){return cloudPush()}try{const ch=DB.students.filter(s=>JSON.stringify(s)!==SEEDJ[s.id]);localStorage.setItem('ehh3',JSON.stringify({students:ch,stock:DB.stock,accounts:DB.accounts,transfers:DB.transfers,notes:DB.notes,signups:DB.signups}))}catch(e){}}
const save=()=>{clearTimeout(_t);_t=setTimeout(doSave,350)};
addEventListener('pagehide',()=>{if(_t){clearTimeout(_t);doSave()}});
function h53(s){let a=0xdeadbeef,b=0x41c6ce57;for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);a=Math.imul(a^c,2654435761);b=Math.imul(b^c,1597334677)}
 a=Math.imul(a^a>>>16,2246822507)^Math.imul(b^b>>>13,3266489909);b=Math.imul(b^b>>>16,2246822507)^Math.imul(a^a>>>13,3266489909);return(4294967296*(2097151&b)+(a>>>0)).toString(16)}
const pwHash=(id,p)=>h53('ehh:'+id+':'+p);
function plainAccounts(){
 const mk=(id,role,name,pw,extra)=>Object.assign({id,role,name,username:name,email:name.replace(/\s+/g,'').toLowerCase()+'@eduhealthhub.demo',pw},extra||{});
 const A=[mk('A1','Doctor','Test Doctor1','doctor1'),mk('A2','Doctor','Test Doctor2','doctor2'),
  mk('A3','Nurse','Test Nurse1','nurse1'),mk('A4','Nurse','Test Nurse2','nurse2'),mk('A5','Nurse','Test Nurse3','nurse3'),
  mk('A6','Dentist','Test Dentist1','dentist1')];
 TEACHERS.forEach((t,i)=>A.push(mk('T'+(i+1),'Teacher',t[0],t[1],{adv:SECTIONS[i].id})));
 return A;
}
const normU=s=>String(s).replace(/\s+/g,'').toLowerCase();
const DEMO=plainAccounts();
const DEMO_UI=DEMO.filter(a=>a.role!=='Teacher').concat(SECT_UI.map(sc=>DEMO.find(a=>a.adv===sc.id)));
if(CLOUD_ON)DB.accounts=[];
else if(!DB.accounts){DB.accounts=DEMO.map(a=>({id:a.id,role:a.role,adv:a.adv,name:a.name,username:a.username,email:a.email,pw:pwHash(a.id,a.pw)}));save()}
if(!CLOUD_ON)DEMO.forEach(a=>{if(!DB.accounts.find(x=>x.id===a.id))DB.accounts.push({id:a.id,role:a.role,adv:a.adv,name:a.name,username:a.username,email:a.email,pw:pwHash(a.id,a.pw)})});
/* tidy teacher usernames to one format, keeping older typed forms working at login */
const ALIAS={T17:'testteacher1111a3',T18:'testteacher1111a4',T19:'testteacher1111a5',T20:'testteacher1111a6',T21:'testteachertp3',T22:'testteachertp4',T23:'testteachertp5',T24:'testteachertp6'};
if(!CLOUD_ON)DEMO.forEach(d=>{const x=DB.accounts.find(a=>a.id===d.id);if(!x)return;
 if(normU(x.username)===normU(d.username)||normU(x.username)===ALIAS[d.id]){x.username=d.username;x.name=d.name}
 if(ALIAS[d.id]&&x.email===ALIAS[d.id]+'@eduhealthhub.demo')x.email=d.email});
if(!CLOUD_ON)save();

const WANT=(new URLSearchParams(location.search).get('role')||'').replace(/[^A-Za-z]/g,'');
const S={user:null,view:'',back:'',sid:null,tab:'profile',tooth:null,sy:CUR_SY,open:new Set(),f:{q:'',grade:'',strand:'',section:''},login:{err:''},fails:{}};
const P={
 Doctor:{exam:'edit',dental:'view',prof:'edit',stock:'edit'},
 Nurse:{exam:'edit',dental:'view',prof:'edit',stock:'edit'},
 Dentist:{exam:'view',dental:'edit',prof:'view',stock:null},
 Teacher:{exam:'view',dental:'view',prof:'view',stock:null}
};
const NAV={
 Doctor:[['home','Home'],['chat','Messages'],['overview','Overview'],['students','Students'],['stock','Supply stock'],['accounts','Accounts'],['activity','Activity log'],['account','My account']],
 Nurse:[['home','Home'],['chat','Messages'],['students','Students'],['stock','Supply stock'],['account','My account']],
 Dentist:[['home','Home'],['chat','Messages'],['students','Students'],['account','My account']],
 Teacher:[['home','Home'],['chat','Messages'],['dash','My advisory'],['files','Record of files'],['account','My account']]
};
const PERM_NOTE={
 Doctor:'Full access to records, referrals, clearances and the activity log. Odontogram is read only.',
 Nurse:'Full access to exam cards, walk-ins and supplies. Can flag cases for the doctor. Odontogram is read only.',
 Dentist:'Full access to the odontogram and dental records. Medical history is read only.',
 Teacher:'Can see pass and status only. Medical details stay hidden.'
};
const stu=id=>DB.students.find(s=>s.id===id);
const enrOf=(st,sy)=>st.enr.find(e=>e.sy===sy);
const curSec=st=>secOf(enrOf(st,CUR_SY).section);
const fullName=st=>st.first+' '+st.last;
const avCache={};
function av(st){
 if(!avCache[st.id]){
  const n=parseInt(st.id.slice(1)), h=(n*47)%360, skin=[28,24,32,20][n%4], hair=['#2b1d17','#3a281d','#1c1a1a','#5a3a22'][n%4], f=st.sex==='Female';
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="hsl(${h} 38% 80%)"/><path d="M8 64c2-17 14-23 24-23s22 6 24 23z" fill="hsl(${h} 45% 36%)"/><circle cx="32" cy="27" r="11" fill="hsl(${skin} 48% 62%)"/><path d="M20 26c0-14 24-14 24 0c-3-6-8-8-12-8s-9 2-12 8z" fill="${hair}"/>${f?`<path d="M19 26c0 12-2 16-1 20 3-1 4-3 5-6zM45 26c0 12 2 16 1 20-3-1-4-3-5-6z" fill="${hair}"/>`:''}</svg>`;
  avCache[st.id]='data:image/svg+xml,'+encodeURIComponent(svg);
 }
 return `<img class="av" src="${st.photo||avCache[st.id]}" alt="">`;
}
function toast(m){const t=document.createElement('div');t.className='toast';t.setAttribute('role','status');t.textContent=m;document.body.appendChild(t);setTimeout(()=>t.remove(),2400)}
const today=()=>new Date().toISOString().slice(0,10);
const examDone=(st,g)=>{const r=st.exam[g];return !!(r&&r.date&&r.wt)};
const dentalDone=st=>!!(st.dental&&st.dental.date);
const pill=(t,c)=>`<span class="pill ${c}">${t}</span>`;
const ICON='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';

/* ---------- login ---------- */
function loginView(){
 const L=S.login;
 return `<div class="stage"><div class="bg" aria-hidden="true"><i class="blob b1"></i><i class="blob b2"></i><i class="blob b3"></i>${[1,2,3,4,5,6,7].map(n=>`<i class="fx x${n}"></i>`).join('')}<svg class="ecg" viewBox="0 0 1200 120" preserveAspectRatio="none"><path d="M0 60 H300 l20 0 l15 -40 l25 80 l20 -70 l15 30 H620 l20 0 l15 -40 l25 80 l20 -70 l15 30 H940 l20 0 l15 -40 l25 80 l20 -70 l15 30 H1200"/></svg></div>
<div class="login"><div class="intro">
  <h1 class="sr">EduHealthHub</h1>
  <div class="seal-wrap"><img class="seal" src="${LOGO_SEAL}" width="220" height="220" alt="Dasmariñas Integrated High School seal, with the EduHealthHub mark"></div>
  <div class="logo-card"><img class="logo-full" src="${LOGO_FULL}" alt="EduHealthHub. Healthy Students. Brighter Futures."></div>
  <p class="lead">A Web-Based Student Health Record Management System</p>
  <p class="tag" aria-live="off"><span id="tagtxt">Healthy Students. Brighter Futures.</span></p>
  <div class="eyebrow" style="margin:6px 0 8px">Choose your role</div>
  <div class="role-strip">${['Doctor','Nurse','Dentist','Teacher'].map((r,i)=>`<a href="${ROLE_PAGE[r]}" style="--d:${i*70}ms" class="${WANT===r?'want':''}" ${WANT===r?'aria-current="page"':''}><div><img class="role-ic" src="${ROLE_ICON[r]}" alt=""><span>${r}</span></div></a>`).join('')}</div>
  <div class="chart-strip" aria-hidden="true"><span>SY ${CUR_SY}</span><span>Private &amp; role-based</span><span>Synced online</span></div>
 </div>
 <div style="display:grid;gap:14px;min-width:0">
${L.signup?` <form class="login-card" id="signupform" autocomplete="off">
  ${L.done?`<div><h2>Request sent</h2><div class="small muted">Thank you. A Doctor has to approve your account before you can log in. You can come back to this page and log in once it is approved.</div></div><div class="trow"><button type="button" class="btn primary" data-act="signupback">Back to log in</button></div>`:`<div><h2>Create an account</h2><div class="small muted">For clinic staff and teachers only. A Doctor reviews every request before the account works. Learners do not have accounts.</div></div>
  <div class="field"><label for="su-name">Full name</label><input class="inp" id="su-name" maxlength="80" autocomplete="name" required></div>
  <div class="field"><label for="su-role">I am a</label><select class="inp" id="su-role">${['Teacher','Nurse','Dentist','Doctor'].map(r=>`<option ${WANT===r?'selected':''}>${r}</option>`).join('')}</select></div>
  <div class="field" id="su-advf"><label for="su-adv">Advisory section</label><select class="inp" id="su-adv">${SECTIONS.map(x=>`<option value="${esc(x.id)}">${esc(secLabel(x))}</option>`).join('')}<option value="__other">My section is not listed. I will write it.</option></select><input class="inp" id="su-adv2" maxlength="30" placeholder="Write your section, e.g. Grade 12 STEM-A" hidden style="margin-top:6px"><div class="small muted">A Doctor confirms your section when approving.</div></div>
  <div class="field"><label for="su-email">Email</label><input class="inp" id="su-email" type="email" maxlength="120" autocomplete="email" required></div>
  <div class="field"><label for="su-user">Username</label><input class="inp" id="su-user" minlength="3" maxlength="40" autocomplete="username" autocapitalize="off" spellcheck="false" required><div class="small muted">3 or more characters. Capitals and small letters count when you log in.</div></div>
  <div class="field"><label for="su-pw">Password</label><input class="inp" id="su-pw" type="password" minlength="10" autocomplete="new-password" autocapitalize="off" required><div class="small muted">At least 10 characters with a letter and a number.</div></div>
  <div class="field"><label for="su-pw2">Repeat password</label><input class="inp" id="su-pw2" type="password" autocomplete="new-password" autocapitalize="off" required></div>
  <div id="su-err" role="alert">${L.err?`<div class="pill bad" style="white-space:normal">${esc(L.err)}</div>`:''}</div>
  <button class="btn primary" type="submit">Send request</button>
  <div class="trow"><button type="button" class="btn sm" data-act="signupback">Back to log in</button></div>`}
 </form>`:L.must?` <form class="login-card" id="mustform" autocomplete="off">
  <div><h2>Choose a new password</h2><div class="small muted">For privacy, this account must set its own password before opening any records. Capitals and small letters count.</div></div>
  <div class="field"><label for="mu-n">New password</label><input class="inp" id="mu-n" type="password" autocomplete="new-password" autocapitalize="off" minlength="10" required><div class="small muted">At least 10 characters with a letter and a number.</div></div>
  <div class="field"><label for="mu-r">Repeat new password</label><input class="inp" id="mu-r" type="password" autocomplete="new-password" autocapitalize="off" required></div>
  ${L.err?`<div class="pill bad" role="alert" style="white-space:normal">${esc(L.err)}</div>`:''}
  <button class="btn primary" type="submit">Save and continue</button>
 </form>`:L.enroll?` <form class="login-card" id="enrollform" autocomplete="off">${enrollHtml(L.enroll)}</form>`:L.totp?` <form class="login-card" id="totpform" autocomplete="off">
  <div><h2>Enter your code</h2><div class="small muted">Open your authenticator app and type the 6-digit code for EduHealthHub. Lost your phone? Type one of your recovery codes instead.</div></div>
  <div class="field"><label for="tc">Code</label><input class="inp" id="tc" autocomplete="one-time-code" autocapitalize="off" spellcheck="false" maxlength="12" required></div>
  ${L.totp.err?`<div class="pill bad" role="alert" style="white-space:normal">${esc(L.totp.err)}</div>`:''}
  <button class="btn primary" type="submit">Verify</button>
  <div class="trow"><button type="button" class="btn sm" data-act="codeback">Back</button></div>
 </form>`:L.pending?` <form class="login-card" id="codeform" autocomplete="off">
  <div><h2>Confirm it is you</h2><div class="small muted">${L.pending.viaGoogle?'Google confirmed your account, <b>':'Your account is linked to <b>'}${esc(L.pending.hint)}</b>. We email a 6-digit code to that Gmail before you can log in.</div></div>
  ${L.pending.msg?`<div class="pill good" role="status" style="white-space:normal">${esc(L.pending.msg)}</div>`:''}
  ${L.pending.mailErr?`<div class="pill bad" role="alert" style="white-space:normal">${esc(L.pending.mailErr)} You can confirm with Google below instead.</div>`:''}
  <div class="field"><label for="lc">6-digit code from your email</label><input class="inp" id="lc" inputmode="numeric" autocomplete="one-time-code" maxlength="7" required></div>
  ${L.err?`<div class="pill bad" role="alert" style="white-space:normal">${esc(L.err)}</div>`:''}
  <button class="btn primary" type="submit">Verify and log in</button>
  <div class="trow"><button type="button" class="btn sm" data-act="resendcode" ${L.pending.busy?'disabled':''}>Send the code again</button><button type="button" class="btn sm" data-act="codeback">Back</button></div>
  ${L.pending.viaGoogle?'':`<div class="small muted">No email? Confirm with the same Google account instead:</div>
  <div style="display:grid;gap:6px;justify-items:start"><div id="g-login" style="min-height:44px"></div></div>`}
 </form>`:` <form class="login-card ${L.err?'err':''}" id="loginform" autocomplete="on">
  <div class="lhead">${WANT&&ROLE_ICON[WANT]?`<img class="role-ic lg" src="${ROLE_ICON[WANT]}" alt="">`:'<span class="lock" aria-hidden="true">&#128274;</span>'}<div><h2>${WANT?esc(WANT)+' log in':'Welcome back'}</h2><div class="small muted">${WANT?`Log in with a ${WANT} account to open the ${WANT} page.`:'Use your own username or email. Learners do not have accounts.'}</div></div></div>
  <div class="field"><label for="lu">Username or email</label><input class="inp" id="lu" name="username" autocomplete="username" autocapitalize="off" spellcheck="false" required></div>
  <div class="field"><label for="pw">Password</label><input class="inp" id="pw" name="password" type="password" autocomplete="current-password" autocapitalize="off" autocorrect="off" spellcheck="false" required><div class="caps" id="caps" hidden>Caps Lock is on</div><div class="small muted" style="margin-top:4px">Username and password are case-sensitive: capitals and small letters must match exactly.</div></div>
  ${(()=>{const o=lockOther(),n=ss.get('ehh_notice');window._lockShown=!!o;if(n)ss.del('ehh_notice');return L.err?`<div class="pill bad" role="alert" style="white-space:normal">${esc(L.err)}</div>`:o?`<div class="pill warn" role="status" style="white-space:normal">${esc(lockMsg(o))}</div>`:n?`<div class="pill warn" role="status" style="white-space:normal">${esc(n)}</div>`:''})()}
  <button class="btn primary" type="submit">Log in</button>
  ${CLOUD_ON&&GOOGLE_CLIENT_ID?`<div class="small muted" style="text-align:center">or</div><div style="display:grid;justify-items:center"><div id="g-start" style="min-height:44px"></div></div><div class="small muted" style="text-align:center">For accounts linked to Google. A code is emailed next.</div>`:''}
 <div class="trow" style="justify-content:center"><span class="small muted">New here?</span> <button type="button" class="btn sm" data-act="signupopen">Create an account</button></div>
 </form>`}
</div></div></div>`;
}

/* ---------- shell ---------- */
function shell(){
 const u=S.user, nav=NAV[u.role];
 const body={chat:chatView,doc:docView,activity:activityView,accounts:accountsView,home:()=>S.user.role==='Teacher'?teacherHome():homeView(),overview:overviewView,students:studentsView,stock:stockView,dash:teacherView,student:studentView,account:accountView,files:filesView}[S.view]();
 const navKey=(S.view==='student'||S.view==='doc')?S.back:S.view;
 return `<div class="shell"><header class="topbar"><button class="name homebtn" data-act="nav" data-v="${nav[0][0]}" title="Go to Home" aria-label="EduHealthHub, go to Home"><span class="logo-chip"><img src="${LOGO_EMBLEM}" alt="" height="34"></span>EduHealthHub</button><div class="spacer"></div>
  <img class="role-ic" style="object-fit:cover" src="${u.photo||ROLE_ICON[u.role]}" alt="${u.role}">
  <div class="who"><b>${esc(u.name)}</b><span class="small muted">${u.role}${u.role==='Teacher'?' · '+esc(secLabel(secOf(u.adv))):''}</span></div>
  ${CLOUD_ON?`<span class="small muted" id="syncstat" aria-live="polite">${esc(SYNC_TXT)}</span>`:''}<button class="btn sm" data-act="logout">Log out</button></header>
  <div class="layout"><nav class="nav" aria-label="Main">${nav.map(n=>`<button data-act="nav" data-v="${n[0]}" ${navKey===n[0]?'aria-current="page"':''}>${n[1]}${n[0]==='chat'&&unreadAll()?`<span class="badge">${unreadAll()}</span>`:''}</button>`).join('')}<div class="perm">${PERM_NOTE[u.role]}</div></nav>
  <main>${body}</main></div></div>`;
}

/* ---------- overview (doctor) ---------- */
function stockState(i){
 if(i.qty<=0)return ['Out','bad'];
 if(i.exp&&i.exp<today())return ['Expired','bad'];
 if(i.qty<=i.min)return ['Low','warn'];
 if(i.exp&&i.exp<new Date(Date.now()+90*864e5).toISOString().slice(0,10))return ['Expiring','warn'];
 return ['OK','good'];
}
function overviewView(){
 const all=DB.students, ex=all.filter(s=>examDone(s,curSec(s).grade)), dn=all.filter(dentalDone);
 const low=DB.stock.filter(i=>stockState(i)[1]!=='good');
 const ns={a:0,b:0,c:0,d:0,e:0}; ex.forEach(s=>{const k=s.exam[curSec(s).grade].nutri; if(ns[k]!=null)ns[k]++});
 const mx=Math.max(1,...Object.values(ns));
 const refer=all.filter(s=>{const r=s.exam[curSec(s).grade];return r&&/a|d/.test(r.remarks||'')});
 const needs=all.filter(s=>s.dental&&Object.values(s.dental.teeth).some(t=>t.n));
 const pend=all.filter(s=>!examDone(s,curSec(s).grade));
 return `<div class="head"><div><div class="eyebrow">School year ${CUR_SY}</div><h2>Clinic overview</h2></div></div>
 ${cloudPanel()}
 <div class="tiles">
  <div class="tile"><span class="eyebrow">Learners</span><b>${all.length}</b><span class="small muted">${SECTIONS.length} sections</span></div>
  <div class="tile"><span class="eyebrow">Exam cards done</span><b>${ex.length}/${all.length}</b><span class="small muted">${pend.length} pending</span></div>
  <div class="tile"><span class="eyebrow">Dental charts done</span><b>${dn.length}/${all.length}</b><span class="small muted">${needs.length} with treatment needs</span></div>
  <div class="tile ${low.length?'alert':''}"><span class="eyebrow">Supplies to restock</span><b>${low.length}</b><span class="small muted">low, out or expiring</span></div>
 </div>
 <div class="grid2">
  <section class="panel"><div class="head"><h3>Nutritional status</h3><span class="small muted">${ex.length} examined</span></div>
   <div class="bars">${Object.keys(ns).map(k=>`<div class="bar"><span>${GROUPS.ns.i[k.charCodeAt(0)-97]}</span><div class="tr"><i style="width:${ns[k]/mx*100}%"></i></div><b class="mono">${ns[k]}</b></div>`).join('')}</div>
   <p class="small muted" style="margin:12px 0 0">${refer.length} learner(s) marked Referred or Observation.</p></section>
  <section class="panel"><div class="head"><h3>Supply alerts</h3><button class="btn sm" data-act="nav" data-v="stock">Open stock</button></div>
   <div class="tw"><table><thead><tr><th>Item</th><th>Qty</th><th>Status</th></tr></thead><tbody>
   ${low.map(i=>{const s=stockState(i);return `<tr><td>${esc(i.name)}</td><td class="mono">${i.qty} ${esc(i.unit)}</td><td>${pill(s[0],s[1])}</td></tr>`}).join('')||'<tr><td colspan="3" class="muted">All supplies are stocked.</td></tr>'}
   </tbody></table></div></section>
 </div>
 <section class="panel"><div class="head"><h3>Exam cards still to complete</h3><button class="btn sm" data-act="nav" data-v="students">All students</button></div>
  <div class="tw"><table><thead><tr><th>Learner</th><th>LRN</th><th>Section</th></tr></thead><tbody>
  ${pend.slice(0,12).map(s=>`<tr class="click" data-act="open" data-id="${s.id}" data-tab="exam"><td><div class="who-cell">${av(s)}${esc(fullName(s))}</div></td><td class="mono">${s.lrn}</td><td>${esc(secLabel(curSec(s)))}</td></tr>`).join('')+(pend.length>12?`<tr><td colspan="3" class="muted">and ${pend.length-12} more. Use Students to see them all.</td></tr>`:'')||'<tr><td colspan="3" class="muted">Every learner has an exam card for this year.</td></tr>'}
  </tbody></table></div></section>`;
}

/* ---------- students list ---------- */
function filterStudents(list,getSec){
 const f=S.f, q=f.q.trim().toLowerCase();
 return list.filter(s=>{const sec=getSec(s);
  return (!q||(fullName(s).toLowerCase().includes(q)||s.lrn.includes(q)))&&(!f.grade||String(sec.grade)===f.grade)&&(!f.strand||sec.strand===f.strand)&&(!f.section||sec.id===f.section)});
}
function studentsView(){
 const role=S.user.role, p=P[role], f=S.f;
 const list=filterStudents(DB.students,curSec);
 const groups=SECT_UI.map(sec=>[sec,list.filter(s=>curSec(s).id===sec.id)]).filter(g=>g[1].length);
 const strands=[...new Set(SECT_UI.map(s=>s.strand))];
 const cols=3+(p.exam?1:0)+(p.dental?1:0), filt=!!(f.q||f.grade||f.strand||f.section), open=sec=>filt||S.open.has(sec.id);
 return `<div class="head"><div><div class="eyebrow">${role==='Dentist'?'Dental service':'Student records'}</div><h2>Students</h2></div><div class="trow"><span class="muted">${list.length} of ${DB.students.length} learners</span>${filt?'':`<button class="btn sm" data-act="grpall">${S.open.size?'Collapse all':'Expand all'}</button>`}</div></div>
 <div class="filters">
  <input class="inp" id="q" data-bind="filter" data-f="q" placeholder="Search name or LRN" value="${esc(f.q)}" aria-label="Search">
  <select class="inp" data-bind="filter" data-f="grade" aria-label="Grade"><option value="">All grades</option><option value="11" ${f.grade==='11'?'selected':''}>Grade 11</option><option value="12" ${f.grade==='12'?'selected':''}>Grade 12</option></select>
  <select class="inp" data-bind="filter" data-f="strand" aria-label="Track and strand"><option value="">All tracks / strands</option>${strands.map(s=>`<option value="${s}" ${f.strand===s?'selected':''}>${trackLabel(SECTIONS.find(x=>x.strand===s))}</option>`).join('')}</select>
  <select class="inp" data-bind="filter" data-f="section" aria-label="Section"><option value="">All sections</option>${SECT_UI.map(s=>`<option value="${s.id}" ${f.section===s.id?'selected':''}>${esc(secLabel(s))}</option>`).join('')}</select>
 </div>
 <section class="panel" style="padding:0"><div class="tw"><table><thead><tr><th>Learner</th><th>LRN</th><th>Section</th>${p.exam?'<th>Exam card</th>':''}${p.dental?'<th>Dental</th>':''}</tr></thead><tbody>
 ${groups.map(([sec,arr])=>`<tr class="grp click" data-act="grp" data-id="${sec.id}"><td colspan="${cols}">${open(sec)?'▾':'▸'} ${esc(secLabel(sec))} · ${trackLabel(sec)} · Adviser ${esc(sec.adviser)} · <b>${arr.length}</b> learners</td></tr>`+(open(sec)?arr.map(s=>{
   const g=sec.grade;
   return `<tr class="click" data-act="open" data-id="${s.id}" data-tab="${role==='Dentist'?'dental':role==='Nurse'?'exam':'profile'}"><td><div class="who-cell">${av(s)}<b>${esc(fullName(s))}</b></div></td><td class="mono">${s.lrn}</td><td>${esc(secLabel(sec))}</td>${p.exam?`<td>${examDone(s,g)?pill('Complete','good'):pill('Pending','warn')}</td>`:''}${p.dental?`<td>${dentalDone(s)?pill('Charted','good'):pill('Pending','warn')}</td>`:''}</tr>`}).join(''):'')).join('')||`<tr><td colspan="${cols}" class="muted">No learners match these filters.</td></tr>`}
 </tbody></table></div></section>`;
}

/* ---------- supply stock ---------- */
function stockView(){
 const cats=[...new Set(DB.stock.map(i=>i.cat))];
 return `<div class="head"><div><div class="eyebrow">Clinic supplies</div><h2>Supply stock</h2></div><span class="muted">${DB.stock.length} items</span></div>
 <section class="panel" style="padding:0"><div class="tw"><table><thead><tr><th>Item</th><th>Category</th><th>Unit</th><th>Quantity</th><th>Reorder at</th><th>Expiry</th><th>Status</th><th></th></tr></thead><tbody>
 ${DB.stock.map(i=>{const s=stockState(i);const b=(f,v,t='text',w='')=>`<input class="inp" ${w?`style="width:${w}"`:''} type="${t}" value="${esc(v)}" data-bind="stock" data-id="${i.id}" data-f="${f}" aria-label="${f} for ${esc(i.name)}">`;
  return `<tr><td style="min-width:190px">${b('name',i.name)}</td><td style="min-width:110px">${b('cat',i.cat)}</td><td style="min-width:90px">${b('unit',i.unit)}</td>
  <td><div class="who-cell"><button class="btn sm" data-act="qty" data-id="${i.id}" data-d="-1" aria-label="Decrease">−</button>${b('qty',i.qty,'number','70px')}<button class="btn sm" data-act="qty" data-id="${i.id}" data-d="1" aria-label="Increase">+</button></div></td>
  <td>${b('min',i.min,'number','70px')}</td><td style="min-width:140px">${b('exp',i.exp,'date')}</td><td>${pill(s[0],s[1])}</td><td><button class="btn sm danger" data-act="delstock" data-id="${i.id}">Remove</button></td></tr>`}).join('')}
 </tbody></table></div></section>
 <section class="panel"><div class="head"><h3>Add supply</h3></div>
  <form id="addstock" class="filters">
   <input class="inp" id="ns-name" placeholder="Item name" aria-label="Item name" required>
   <input class="inp" id="ns-cat" placeholder="Category" list="cats" aria-label="Category"><datalist id="cats">${cats.map(c=>`<option value="${esc(c)}">`).join('')}</datalist>
   <input class="inp" id="ns-unit" placeholder="Unit (boxes, tablets)" aria-label="Unit">
   <input class="inp" id="ns-qty" type="number" min="0" placeholder="Quantity" aria-label="Quantity">
   <button class="btn primary" type="submit">Add item</button>
  </form></section>`;
}

/* A small confirmation pop-up inside the page (instead of the browser's own confirm box). Resolves true/false. */
function askConfirm(o){
 return new Promise(res=>{
  const old=document.getElementById('cfm');if(old)old.remove();
  const prev=document.activeElement,d=document.createElement('div');d.id='cfm';d.className='cfm';d.setAttribute('role','alertdialog');d.setAttribute('aria-modal','true');d.setAttribute('aria-labelledby','cfmt');d.setAttribute('aria-describedby','cfmd');
  d.innerHTML=`<div class="cfmbox"><h3 id="cfmt">${esc(o.title||'Are you sure?')}</h3><p id="cfmd">${esc(o.text||'')}</p><div class="cfmrow"><button type="button" class="btn" data-cfm="no">${esc(o.cancel||'Cancel')}</button><button type="button" class="btn ${o.danger?'danger':'primary'}" data-cfm="yes">${esc(o.ok||'OK')}</button></div></div>`;
  const done=v=>{document.removeEventListener('keydown',key,true);d.remove();try{if(prev&&prev.focus)prev.focus()}catch(e){}res(v)};
  const key=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();done(false)}
   else if(e.key==='Tab'){const b=[...d.querySelectorAll('button')],i=b.indexOf(document.activeElement);e.preventDefault();b[(i+(e.shiftKey?b.length-1:1))%b.length].focus()}};
  d.addEventListener('click',e=>{const b=e.target.closest('[data-cfm]');if(b)done(b.dataset.cfm==='yes');else if(e.target===d)done(false)});
  document.addEventListener('keydown',key,true);document.body.appendChild(d);
  d.querySelector('[data-cfm=no]').focus();
 })}

/* ---------- one signed-in account per browser ----------
   A tab that is signed in writes a small marker (with a heartbeat) to localStorage. Another tab of the same browser
   cannot log in while a fresh marker exists, and a tab that finds an older marker of another tab signs itself out. */
const LOCK_KEY='ehh_active',LOCK_TTL=15000;
const TAB_ID=(()=>{let t=ss.get('ehh_tab');if(!t){t=Math.random().toString(36).slice(2)+Date.now().toString(36);ss.set('ehh_tab',t)}return t})();
function lockRead(){try{const v=JSON.parse(localStorage.getItem(LOCK_KEY)||'null');return v&&Date.now()-v.t<LOCK_TTL?v:null}catch(e){return null}}
function lockOther(){const v=lockRead();return v&&v.tab!==TAB_ID?v:null}
let _since=0;
function lockWrite(a){if(!_since)_since=Date.now();try{localStorage.setItem(LOCK_KEY,JSON.stringify({tab:TAB_ID,id:a.id,name:a.name,role:a.role,since:_since,t:Date.now()}))}catch(e){}}
function lockFree(){const v=lockRead();if(v&&v.tab===TAB_ID)try{localStorage.removeItem(LOCK_KEY)}catch(e){}}
function lockMsg(v){return (v.name||'Another account')+' ('+v.role+') is already signed in on this browser. Only one account can be signed in at a time. Log out there first.'}
function lockTick(){
 if(!S.user)return;const o=lockOther();
 /* two tabs signed in at once: the tab that signed in first keeps the session, the other one signs out */
 if(o&&(_since?o.since<=_since:true)){ss.set('ehh_notice',lockMsg(o));try{ACT.logout()}catch(e){}return}
 lockWrite(S.user)}
setInterval(lockTick,1500);
addEventListener('storage',e=>{if(e.key===LOCK_KEY){if(S.user)lockTick();else{const u=document.getElementById('lu');if(u&&!u.value&&document.getElementById('loginform')&&!!lockOther()!==!!window._lockShown)render()}}});
