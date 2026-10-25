/* ---------- state & helpers ---------- */
const $=(s,r=document)=>r.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const SEED=seedDB(),SEEDJ={};SEED.students.forEach(s=>SEEDJ[s.id]=JSON.stringify(s));
const SEEDLRN={};SEED.students.forEach(s=>SEEDLRN[s.id]=s.lrn);
let DB=SEED;
if(!CLOUD_ON)try{const j=localStorage.getItem('ehh3');
 if(j){const sv=JSON.parse(j),ov={};(sv.students||[]).forEach(s=>ov[s.id]=s);DB.students=SEED.students.map(s=>ov[s.id]||s);
  if(sv.stock)DB.stock=sv.stock;if(sv.accounts)DB.accounts=sv.accounts;if(sv.transfers)DB.transfers=sv.transfers}
 else{const o=localStorage.getItem('ehh2');if(o){const sv=JSON.parse(o);if(sv.stock)DB.stock=sv.stock;if(sv.accounts)DB.accounts=sv.accounts}}}catch(e){}
if(!CLOUD_ON)DB.students.forEach(s=>{if(SEEDLRN[s.id])s.lrn=SEEDLRN[s.id]});
let _t=null;
function doSave(){_t=null;if(CLOUD_ON){cloudPush();return}try{const ch=DB.students.filter(s=>JSON.stringify(s)!==SEEDJ[s.id]);localStorage.setItem('ehh3',JSON.stringify({students:ch,stock:DB.stock,accounts:DB.accounts,transfers:DB.transfers}))}catch(e){}}
const save=()=>{clearTimeout(_t);_t=setTimeout(doSave,350)};
addEventListener('pagehide',()=>{if(_t){clearTimeout(_t);doSave()}});
function h53(s){let a=0xdeadbeef,b=0x41c6ce57;for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);a=Math.imul(a^c,2654435761);b=Math.imul(b^c,1597334677)}
 a=Math.imul(a^a>>>16,2246822507)^Math.imul(b^b>>>13,3266489909);b=Math.imul(b^b>>>16,2246822507)^Math.imul(a^a>>>13,3266489909);return(4294967296*(2097151&b)+(a>>>0)).toString(16)}
const pwHash=(id,p)=>h53('ehh:'+id+':'+p);
function plainAccounts(){
 const mk=(id,role,name,pw,extra)=>Object.assign({id,role,name,username:name,email:name.replace(/\s+/g,'').toLowerCase()+'@eduhealthhub.demo',pw},extra||{});
 const A=[mk('A1','Doctor','Dummy Doctor1','doctor1'),mk('A2','Doctor','Dummy Doctor2','doctor2'),
  mk('A3','Nurse','Dummy Nurse1','nurse1'),mk('A4','Nurse','Dummy Nurse2','nurse2'),mk('A5','Nurse','Dummy Nurse3','nurse3'),
  mk('A6','Dentist','Dummy Dentist1','dentist1')];
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
const ALIAS={T17:'dummyteacher1111a3',T18:'dummyteacher1111a4',T19:'dummyteacher1111a5',T20:'dummyteacher1111a6',T21:'dummyteachertp3',T22:'dummyteachertp4',T23:'dummyteachertp5',T24:'dummyteachertp6'};
if(!CLOUD_ON)DEMO.forEach(d=>{const x=DB.accounts.find(a=>a.id===d.id);if(!x)return;
 if(normU(x.username)===normU(d.username)||normU(x.username)===ALIAS[d.id]){x.username=d.username;x.name=d.name}
 if(ALIAS[d.id]&&x.email===ALIAS[d.id]+'@eduhealthhub.demo')x.email=d.email});
if(!CLOUD_ON)save();

const WANT=(new URLSearchParams(location.search).get('role')||'').replace(/[^A-Za-z]/g,'');
const S={user:null,view:'',back:'',sid:null,tab:'profile',tooth:null,sy:CUR_SY,open:new Set(),f:{q:'',grade:'',strand:'',section:''},login:{err:''},fails:{}};
const P={
 Doctor:{exam:'edit',dental:'edit',prof:'edit',stock:'edit'},
 Nurse:{exam:'edit',dental:null,prof:'edit',stock:'edit'},
 Dentist:{exam:null,dental:'edit',prof:'view',stock:null},
 Teacher:{exam:'view',dental:'view',prof:'view',stock:null}
};
const NAV={
 Doctor:[['overview','Overview'],['students','Students'],['stock','Supply stock'],['account','My account']],
 Nurse:[['students','Students'],['stock','Supply stock'],['account','My account']],
 Dentist:[['students','Students'],['account','My account']],
 Teacher:[['dash','My advisory'],['files','Record of files'],['account','My account']]
};
const PERM_NOTE={
 Doctor:'Can view and edit every record, including supply stock.',
 Nurse:'Can edit exam cards, student records and supply stock.',
 Dentist:'Can edit dental charts and treatment records.',
 Teacher:'Can view advisory health files and transfer records by LRN.'
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
 return `<div class="login"><div>
  <h1 class="sr">EduHealthHub</h1>
  <div class="logo-card"><img class="logo-full" src="${LOGO_FULL}" alt="EduHealthHub. Healthy Students. Brighter Futures."></div>
  <p class="lead">A Web-Based Student Health Record Management System</p>
  <div class="role-strip">${['Doctor','Nurse','Dentist','Teacher'].map(r=>`<a href="${ROLE_PAGE[r]}" class="${WANT===r?'want':''}"><div><img class="role-ic" src="${ROLE_ICON[r]}" alt=""><span>${r}</span></div></a>`).join('')}</div>
  <div class="chart-strip" aria-hidden="true"><span>SY ${CUR_SY}</span></div>
 </div>
 <div style="display:grid;gap:14px;min-width:0">
 <form class="login-card" id="loginform" autocomplete="on">
  <div><h2>Log in</h2><div class="small muted">${WANT?`Log in with a ${WANT} account to open the ${WANT} page.`:'Use your own username or email. Learners do not have accounts.'}</div></div>
  <div class="field"><label for="lu">Username or email</label><input class="inp" id="lu" name="username" autocomplete="username" autocapitalize="off" spellcheck="false" required></div>
  <div class="field"><label for="pw">Password</label><div class="who-cell"><input class="inp" id="pw" name="password" type="password" autocomplete="current-password" required><button type="button" class="btn sm" data-act="showpw" aria-pressed="false">Show</button></div></div>
  ${L.err?`<div class="pill bad" role="alert" style="white-space:normal">${esc(L.err)}</div>`:''}
  <button class="btn primary" type="submit">Log in</button>
 </form>
</div></div>`;
}

/* ---------- shell ---------- */
function shell(){
 const u=S.user, nav=NAV[u.role];
 const body={overview:overviewView,students:studentsView,stock:stockView,dash:teacherView,student:studentView,account:accountView,files:filesView}[S.view]();
 const navKey=S.view==='student'?S.back:S.view;
 return `<div class="shell"><header class="topbar"><div class="name"><span class="logo-chip"><img src="${LOGO_EMBLEM}" alt="" height="34"></span>EduHealthHub</div><div class="spacer"></div>
  <img class="role-ic" src="${ROLE_ICON[u.role]}" alt="${u.role}">
  <div class="who"><b>${esc(u.name)}</b><span class="small muted">${u.role}${u.role==='Teacher'?' · '+esc(secLabel(secOf(u.adv))):''}</span></div>
  ${CLOUD_ON?`<span class="small muted" id="syncstat" aria-live="polite">${esc(SYNC_TXT)}</span>`:''}<button class="btn sm" data-act="theme">Theme</button><button class="btn sm" data-act="logout">Log out</button></header>
  <div class="layout"><nav class="nav" aria-label="Main">${nav.map(n=>`<button data-act="nav" data-v="${n[0]}" ${navKey===n[0]?'aria-current="page"':''}>${n[1]}</button>`).join('')}<div class="perm">${PERM_NOTE[u.role]}</div></nav>
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
