/* ---------- Home tab for clinic staff (Doctor, Nurse, Dentist) ---------- */
DB.notes=DB.notes||[];
S.hm={q:'',sid:null,panel:'',msg:''};
const AILMENTS=['Headache','Fever','Stomach ache','Dysmenorrhea','Dizziness / fainting','Cough / colds','Minor wound / injury','Sprain / strain','Nosebleed','Asthma attack','Allergic reaction','Toothache','Other'];
const CLEAR_TYPES=['Fit for PE / Intramurals','Fit to return to class after illness','Fit for sports competition','Other'];
const PLAN_TYPES=['Asthma Action Plan','Heart Condition Protocol','Exemption from Strenuous Activity','Allergy / Anaphylaxis Plan','Diabetes Care Plan','Other'];
const localDate=()=>new Date(Date.now()-new Date().getTimezoneOffset()*6e4).toISOString().slice(0,10);
const nowT=()=>new Date().toTimeString().slice(0,5);
const nid=p=>p+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
const ageOf=b=>{const d=new Date(b);if(isNaN(d))return '';return Math.floor((Date.now()-d)/31557600000)};
const canTreat=()=>S.user&&(S.user.role==='Doctor'||S.user.role==='Nurse');
const arr=(s,k)=>s[k]||(s[k]=[]);
const flat=k=>DB.students.flatMap(s=>(s[k]||[]).map(x=>({s,x})));

function alertsFor(s){
 const a=[],al=String(s.allergies||'').trim(),c=String(s.conditions||'');
 if(al&&!/^none$/i.test(al))a.push(['Allergy',al]);
 if(/asthma|heart|seiz|epilep|diabet|faint|syncope|sickle|hemophil/i.test(c))a.push(['Medical condition',c]);
 if((s.visits||[]).some(v=>/faint/i.test(v.ailment)))a.push(['Fainting history','Fainting was recorded in a past clinic visit']);
 (s.plans||[]).forEach(p=>a.push(['Care plan',p.type+(p.details?': '+p.details:'')]));
 if((s.visits||[]).some(v=>v.rest&&!v.out))a.push(['Resting in clinic','Currently resting in the clinic']);
 return a}

function homeStats(){
 const t=localDate(),vs=flat('visits'),role=S.user.role;
 const low=DB.stock.filter(i=>stockState(i)[1]!=='good').length;
 const needs=DB.students.filter(s=>s.dental&&Object.values(s.dental.teeth).some(x=>x.n)).length;
 const tile=(e,b,sub,cls,act)=>`<${act?'button data-act="'+act+'"':'div'} class="tile ${cls||''}" ${act?'style="text-align:left;font:inherit;cursor:pointer"':''}><span class="eyebrow">${e}</span><b>${b}</b><span class="small muted">${sub}</span></${act?'button':'div'}>`;
 const tiles=[];
 if(role!=='Dentist'){
  tiles.push(tile('Patients treated today',vs.filter(x=>x.x.date===t).length,'walk-ins and clinic visits'));
  tiles.push(tile('Active clinic rest cases',vs.filter(x=>x.x.rest&&!x.x.out).length,'resting in clinic beds','','gorest'));
  tiles.push(tile('Doctor referral queue',flat('refs').filter(x=>x.x.status==='pending').length,'waiting for physician review',flat('refs').some(x=>x.x.status==='pending')?'alert':'','gorefs'))}
 tiles.push(tile('Pending dental chartings',DB.students.filter(s=>!dentalDone(s)).length,needs+' with treatment needs'));
 if(role!=='Dentist')tiles.push(tile('Low supply alert',low,'low, out or expiring',low?'alert':'','nav-stock'));
 return `<div class="tiles">${tiles.join('')}</div>`}

function quickActions(){
 const r=S.user.role,b=(a,t,c)=>`<button class="btn ${c||''}" data-act="${a}">${t}</button>`;
 if(r==='Nurse')return b('qa-walk','Log walk-in visit','primary')+b('qa-refer','Refer to doctor')+b('nav-stock','Check inventory');
 if(r==='Doctor')return b('gorefs','Doctor consultation / referral','primary')+b('qa-walk','Log walk-in visit')+b('qa-clear','Issue clearance')+b('nav-stock','Check inventory');
 return b('qa-odonto','Open 2D odontogram','primary')}

function histRows(s){
 const rows=[];
 (s.visits||[]).forEach(v=>rows.push({ts:v.date+' '+v.time,k:'Walk-in',t:`${v.ailment}${v.tx?' · '+v.tx:''}${v.rest?(v.out?' · rested, returned '+v.out:' · resting'):''}`,id:v.id,pass:1}));
 (s.refs||[]).forEach(r=>rows.push({ts:r.date+' '+r.time,k:'Referral',t:`${r.reason} · ${r.status==='done'?'evaluated by '+(r.evalBy||'doctor')+': '+(r.eval||'')+(r.rec?' (Recommendation: '+r.rec+')':''):'waiting for the doctor'}`}));
 (s.clear||[]).forEach(c=>rows.push({ts:c.date+' 00:00',k:'Clearance',t:`${c.type}${c.until?' · valid until '+c.until:''}`,cid:c.id}));
 return rows.sort((a,b)=>a.ts<b.ts?1:-1)}

function resultCard(s){
 const r=S.user.role,p=P[r],sec=curSec(s),al=alertsFor(s),d=s.dental,c=countChart(d),g=sec.grade,ex=s.exam[g]||{};
 const nutri=ex.nutri?decode(EXAM_FIELDS.find(f=>f[0]==='nutri'),ex.nutri).txt:'';
 const hist=histRows(s),panel=S.hm.panel;
 const open=(k,t,cls)=>`<button class="btn sm ${panel===k?'primary':''}" data-act="hpanel" data-k="${k}">${t}</button>`;
 const acts=[];
 if(canTreat()){acts.push(open('walk','Log walk-in'),open('refer','Refer to doctor'))}
 if(r==='Doctor'){acts.push(open('clear','Issue clearance'),open('plan','Attach care plan'))}
 acts.push(`<button class="btn sm" data-act="open" data-id="${s.id}" data-tab="profile">Open full record</button>`);
 if(p.dental)acts.push(`<button class="btn sm ${r==='Dentist'?'primary':''}" data-act="open" data-id="${s.id}" data-tab="dental">Open 2D odontogram</button>`);
 const form=panelForm(s,panel);
 const pend=(s.refs||[]).filter(x=>x.status==='pending');
 return `<section class="panel" id="hres" aria-live="polite">
 <div class="sthead"><img class="av lg" src="${av(s).match(/src="([^"]+)"/)[1]}" alt=""><div style="min-width:0"><div class="eyebrow">LRN <span class="mono">${s.lrn}</span></div><h2>${esc(fullName(s))}</h2>
 <div class="muted">${esc(secLabel(sec))} · ${esc(trackLabel(sec))} · ${esc(s.sex)}, ${ageOf(s.birth)} yrs · Blood type ${esc(s.blood)}</div></div></div>
 ${al.length?`<div class="alertbar" role="alert"><b>Medical warning</b><ul>${al.map(a=>`<li><b>${esc(a[0])}:</b> ${esc(a[1])}</li>`).join('')}</ul></div>`:'<div class="small muted" style="margin:10px 0">No allergy or medical warnings on file.</div>'}
 <div class="trow" style="margin:10px 0">${acts.join('')}</div>
 ${pend.length&&r==='Doctor'?pend.map(x=>`<div class="refbox"><b>Referral waiting</b> · ${esc(x.date)} ${esc(x.time)} · ${esc(x.reason)} <span class="small muted">(by ${esc(x.by)})</span>
  <button class="btn sm primary" data-act="hpanel" data-k="eval:${x.id}">Evaluate</button></div>`).join(''):''}
 ${form}
 <div class="grid2" style="margin-top:12px">
  <div><h3 class="hh">Medical history</h3>
   <table class="kvt"><tr><th>Known conditions</th><td>${esc(s.conditions||'-')}</td></tr><tr><th>Allergies</th><td>${esc(s.allergies||'-')}</td></tr>
   ${p.exam?`<tr><th>Latest exam (Grade ${g})</th><td>${ex.date?esc(ex.date):'Not yet examined'}</td></tr><tr><th>Weight / Height</th><td>${esc(ex.wt||'-')} kg / ${esc(ex.ht||'-')} cm</td></tr><tr><th>Nutritional status</th><td>${esc(nutri||'-')}</td></tr>`:''}
   <tr><th>Parent / guardian</th><td>${esc(s.guardian)} · ${esc(s.contact)}</td></tr></table></div>
  <div><h3 class="hh">Dental chart</h3>
   <table class="kvt"><tr><th>Date examined</th><td>${esc(d.date||'Not yet examined')}</td></tr><tr><th>Permanent teeth</th><td>D ${c.p.d} · M ${c.p.m} · F ${c.p.f} · DMFT ${c.p.d+c.p.m+c.p.f}</td></tr>
   <tr><th>Temporary teeth</th><td>d ${c.t.d} · f ${c.t.f}</td></tr><tr><th>Treatment needs</th><td>${Object.values(d.teeth).filter(x=>x.n).length} tooth/teeth</td></tr></table></div></div>
 ${r!=='Dentist'?`<h3 class="hh">Past consultations &amp; clearances</h3>${hist.length?`<div class="tw"><table class="wrapth"><tbody>${hist.slice(0,12).map(h=>`<tr><td class="mono small" style="white-space:nowrap">${esc(h.ts.replace(' 00:00',''))}</td><td>${pill(h.k,h.k==='Referral'?'warn':h.k==='Clearance'?'good':'mute')}</td><td>${esc(h.t)}</td><td style="white-space:nowrap">${h.pass?`<button class="btn sm" data-act="hpass" data-id="${s.id}" data-v="${h.id}">Clinic pass (PDF)</button>`:''}${h.cid?`<button class="btn sm" data-act="hcert" data-id="${s.id}" data-v="${h.cid}">Certificate (PDF)</button>`:''}</td></tr>`).join('')}</tbody></table></div>`:'<p class="small muted">No clinic visits recorded yet.</p>'}
 ${(s.plans||[]).length?`<h3 class="hh">Special medical care plans</h3>${s.plans.map(x=>`<div class="refbox"><b>${esc(x.type)}</b> · since ${esc(x.date)}${x.until?' · until '+esc(x.until):''}<div>${esc(x.details||'')}</div><div class="small muted">Attached by ${esc(x.by)}${r==='Doctor'?` <button class="btn sm" data-act="hdelplan" data-id="${s.id}" data-v="${x.id}">Remove</button>`:''}</div></div>`).join('')}`:''}`:''}
 </section>`}

function panelForm(s,k){
 if(!k)return '';
 const sel=(id,l)=>`<select class="inp" id="${id}">${l.map(x=>`<option>${esc(x)}</option>`).join('')}</select>`;
 const fld=(l,h,fl)=>`<div class="field" ${fl?`style="flex:${fl}"`:''}><label>${l}</label>${h}</div>`;
 const wrapf=(id,title,inner,btn,extra)=>`<form class="panel hform" id="${id}" data-id="${s.id}" ${extra||''} style="background:var(--surface2);margin:8px 0"><div class="head"><h3>${title}</h3><button type="button" class="btn sm" data-act="hpanel" data-k="">Close</button></div><div class="filters">${inner}</div><div style="margin-top:10px"><button class="btn primary" type="submit">${btn}</button></div></form>`;
 if(k==='walk'&&canTreat()){const items=DB.stock.map(i=>`<option value="${i.id}">${esc(i.name)} (${i.qty} ${esc(i.unit)})</option>`).join('');
  return wrapf('hf-walk','Log walk-in visit',
   fld('Ailment',sel('w-ail',AILMENTS))+fld('Treatment given','<input class="inp" id="w-tx" placeholder="e.g. Paracetamol 500 mg, rest, cold compress" maxlength="200">',2)+
   fld('Supply used (optional)',`<select class="inp" id="w-item"><option value="">None</option>${items}</select>`)+fld('Qty','<input class="inp" id="w-qty" type="number" min="1" value="1" style="width:80px">')+
   `<div class="field" style="flex:1 1 100%"><label><input type="checkbox" id="w-rest"> Student will rest in a clinic bed</label><label><input type="checkbox" id="w-ref"> Needs a doctor referral</label></div>`+
   fld('Referral reason (if referred)','<input class="inp" id="w-why" placeholder="e.g. persistent fever for 3 days" maxlength="200">',2),'Save visit')}
 if(k==='refer'&&canTreat())return wrapf('hf-refer','Refer to doctor',fld('Reason for referral','<input class="inp" id="r-why" required maxlength="240" placeholder="e.g. recurring chest pain, severe injury, persistent fever">',3),'Send to doctor queue');
 if(k.startsWith('eval:')&&S.user.role==='Doctor'){const id=k.slice(5);return wrapf('hf-eval','Doctor evaluation',fld('Evaluation / findings','<textarea class="inp" id="e-ev" rows="3" required maxlength="500"></textarea>',3)+fld('Recommendation','<input class="inp" id="e-rec" maxlength="240" placeholder="e.g. rest at home 2 days, return with medical certificate">',2),'Save evaluation',`data-ref="${id}"`)}
 if(k==='clear'&&S.user.role==='Doctor')return wrapf('hf-clear','Issue medical clearance',fld('Type',sel('c-type',CLEAR_TYPES))+fld('Valid until (optional)','<input class="inp" id="c-until" type="date">')+fld('Remarks','<input class="inp" id="c-rem" maxlength="240">',2),'Issue clearance');
 if(k==='plan'&&S.user.role==='Doctor')return wrapf('hf-plan','Attach special medical care plan',fld('Plan',sel('p-type',PLAN_TYPES))+fld('Details / restrictions','<input class="inp" id="p-det" required maxlength="300" placeholder="e.g. keep inhaler in clinic; no running drills">',3)+fld('Review until (optional)','<input class="inp" id="p-until" type="date">'),'Attach to record');
 return ''}

function searchMatches(q){
 q=q.trim().toLowerCase();if(q.length<2||/^\d+$/.test(q))return /^\d{3,}$/.test(q)?DB.students.filter(s=>s.lrn.startsWith(q)).slice(0,6):[];
 return DB.students.filter(s=>fullName(s).toLowerCase().includes(q)).slice(0,6)}

function homeView(){
 const r=S.user.role,h=S.hm,t=localDate();
 const s=h.sid?stu(h.sid):null;
 const m=!s?searchMatches(h.q):[];
 const rest=flat('visits').filter(x=>x.x.rest&&!x.x.out);
 const q=flat('refs').filter(x=>x.x.status==='pending');
 const low=DB.stock.filter(i=>stockState(i)[1]!=='good');
 return `<div class="head"><div><div class="eyebrow">${r} hub · ${new Date().toDateString()}</div><h2>Home</h2></div></div>
 <section class="panel"><form id="hform" autocomplete="off"><div class="field"><label for="hq">Find a learner by 12-digit LRN (or type a name)</label>
  <div class="who-cell"><input class="inp mono hsearch" id="hq" data-bind="hq" inputmode="numeric" maxlength="40" placeholder="Type or scan an LRN, e.g. 110001000001" value="${esc(h.q)}"><button class="btn primary" type="submit">Search</button>${h.sid?'<button type="button" class="btn" data-act="hclear">Clear</button>':''}</div></div></form>
  ${h.msg?`<div class="small" style="margin-top:8px;color:var(--bad)" role="status">${esc(h.msg)}</div>`:''}
  ${m.length?`<div class="matches">${m.map(x=>`<button class="btn sm" data-act="hpick" data-id="${x.id}">${esc(fullName(x))} · <span class="mono">${x.lrn}</span></button>`).join('')}</div>`:''}
  <div class="trow" style="margin-top:12px">${quickActions()}</div></section>
 ${homeStats()}
 ${s?resultCard(s):''}
 ${r!=='Dentist'?`<div class="grid2">
 <section class="panel" id="refq"><div class="head"><h3>Doctor referral queue</h3><span class="small muted">${q.length} waiting</span></div>
  ${q.length?`<div class="tw"><table class="wrapth"><tbody>${q.map(({s:x,x:rf})=>`<tr><td><b>${esc(fullName(x))}</b><div class="small muted mono">${x.lrn}</div></td><td>${esc(rf.reason)}<div class="small muted">${esc(rf.date)} ${esc(rf.time)} · ${esc(rf.by)}</div></td><td><button class="btn sm" data-act="hpick" data-id="${x.id}" data-k="${r==='Doctor'?'eval:'+rf.id:''}">${r==='Doctor'?'Evaluate':'Open'}</button></td></tr>`).join('')}</tbody></table></div>`:'<p class="small muted">No learners are waiting for the doctor.</p>'}</section>
 <section class="panel" id="restq"><div class="head"><h3>Resting in clinic</h3><span class="small muted">${rest.length} now</span></div>
  ${rest.length?`<div class="tw"><table class="wrapth"><tbody>${rest.map(({s:x,x:v})=>`<tr><td><b>${esc(fullName(x))}</b><div class="small muted mono">${x.lrn}</div></td><td>Since ${esc(v.time)}<div class="small muted">${esc(v.ailment)}</div></td><td style="white-space:nowrap">${canTreat()?`<button class="btn sm primary" data-act="hreturn" data-id="${x.id}" data-v="${v.id}">Return to class</button>`:''}</td></tr>`).join('')}</tbody></table></div>`:'<p class="small muted">Nobody is resting in a clinic bed.</p>'}</section>
 </div>
 ${canTreat()?`<div class="grid2">
 <section class="panel"><div class="head"><h3>Supply tracker</h3><button class="btn sm" data-act="nav-stock">Open stock</button></div>
  ${low.length?`<ul class="plainlist">${low.slice(0,8).map(i=>`<li><b>${esc(i.name)}</b> ${pill(stockState(i)[0],stockState(i)[1])} <span class="small muted">${i.qty} ${esc(i.unit)} left (minimum ${i.min})</span></li>`).join('')}</ul>`:'<p class="small muted">All supplies are above their minimum.</p>'}</section>
 <section class="panel"><div class="head"><h3>Shift handover notes</h3><span class="small muted">shared by nurses and doctors</span></div>
  <form id="hf-note" class="who-cell"><input class="inp" id="n-text" maxlength="300" placeholder="Note for the next shift" required><button class="btn primary" type="submit">Add</button></form>
  ${DB.notes.length?`<ul class="plainlist" style="margin-top:10px">${DB.notes.slice().reverse().slice(0,10).map(n=>`<li><div>${esc(n.text)}</div><div class="small muted">${esc(n.by)} · ${esc(n.date)} ${esc(n.time)}${(n.by===S.user.name||r==='Doctor')?` <button class="btn sm" data-act="hdelnote" data-v="${n.id}">Delete</button>`:''}</div></li>`).join('')}</ul>`:'<p class="small muted" style="margin-top:10px">No notes yet.</p>'}</section></div>`:''}`:''}`}

/* ---- search ---- */
function homeFind(){
 const h=S.hm,q=h.q.trim();h.msg='';
 if(/^\d{12}$/.test(q)){const s=DB.students.find(x=>x.lrn===q);if(s){if(h.sid!==s.id)h.panel='';h.sid=s.id}else{h.sid=null;h.msg='No learner has that LRN.'}return}
 h.sid=null}
function homeSearch(el){
 S.hm.q=el.value;const was=S.hm.sid;homeFind();
 const pos=el.selectionStart;render();const i=$('#hq');if(i){i.focus();i.setSelectionRange(pos,pos)}}
function homeFocusSearch(){const i=$('#hq');if(i)i.focus()}

/* ---- PDFs ---- */
function miniPDF(file,W,H,draw){
 const ops=[],GRAY=[.35,.42,.45],INK=[.06,.16,.18],TEAL=[.043,.498,.51];
 const pe=s=>String(s==null?'':s).replace(/[–—]/g,'-').replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/[\\()]/g,'\\$&');
 const T=(x,y,s,sz,b,c)=>ops.push(`BT /${b?'F2':'F1'} ${sz} Tf ${(c||INK).join(' ')} rg ${x.toFixed(1)} ${(H-y).toFixed(1)} Td (${pe(s)}) Tj ET`);
 const R=(x,y,w,h,c)=>ops.push(`${c.join(' ')} rg ${x.toFixed(1)} ${(H-y-h).toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)} re f`);
 const L=(x1,y1,x2,y2)=>ops.push(`0.5 0.55 0.57 RG 0.6 w ${x1} ${(H-y1).toFixed(1)} m ${x2} ${(H-y2).toFixed(1)} l S`);
 const wrap=(s,w,sz,b)=>{const out=[];let line='';String(s).split(' ').forEach(wd=>{const t=line?line+' '+wd:wd;if(pdfText(t,sz,b)<=w||!line)line=t;else{out.push(line);line=wd}});out.push(line);return out};
 draw({T,R,L,wrap,GRAY,INK,TEAL});
 return saveFile(file,pdfBuild([ops.join('\n')],W,H))}
function clinicPass(s,v){
 const sec=curSec(s);
 miniPDF(`Clinic-Pass_${s.lrn}_${v.date}_${v.time.replace(':','')}.pdf`,595,420,({T,R,L,GRAY,INK,TEAL})=>{
  R(0,0,595,10,TEAL);T(40,52,'EDUHEALTHHUB CLINIC',11,true,TEAL);T(40,86,'CLINIC PASS',28,true,INK);
  T(40,110,'This learner was seen at the school clinic.',11,false,GRAY);
  L(40,128,555,128);
  T(40,160,fullName(s),20,true,INK);T(40,180,`LRN ${s.lrn}`,11,false,GRAY);T(40,196,`${secLabel(sec)} (${trackLabel(sec)})`,11,false,GRAY);
  T(40,236,'Time in',9,true,GRAY);T(40,252,`${v.date}  ${v.time}`,14,true,INK);
  T(250,236,'Time out',9,true,GRAY);T(250,252,v.out?`${v.date}  ${v.out}`:'____________',14,true,INK);
  T(40,290,v.out?'Please allow the learner to return to class.':'Please allow the learner to return to class once the time out is filled in.',11,false,INK);
  L(40,350,250,350);T(40,366,'Clinic staff: '+(v.by||''),10,false,GRAY);
  T(40,392,'No medical details are shown on this slip, to protect the learner\'s privacy.',8,false,GRAY);T(440,392,'Printed '+localDate()+' '+nowT(),8,false,GRAY)})}
function certificate(s,c){
 const sec=curSec(s);
 miniPDF(`Medical-Clearance_${s.lrn}_${c.date}.pdf`,595,842,({T,R,L,wrap,GRAY,INK,TEAL})=>{
  R(0,0,595,10,TEAL);T(40,60,'EDUHEALTHHUB CLINIC',11,true,TEAL);
  T(40,110,'MEDICAL CLEARANCE',26,true,INK);T(40,134,'CERTIFICATE',26,true,INK);L(40,152,555,152);
  T(40,196,'This is to certify that',11,false,GRAY);
  T(40,222,fullName(s),20,true,INK);T(40,244,`LRN ${s.lrn}  |  ${secLabel(sec)} (${trackLabel(sec)})`,11,false,GRAY);
  T(40,290,'has been examined at the school clinic and is considered:',11,false,GRAY);
  let y=324;wrap(c.type.toUpperCase(),515,18,true).forEach(l=>{T(40,y,l,18,true,TEAL);y+=24});
  y+=10;if(c.until){T(40,y,'Valid until:  '+c.until,12,false,INK);y+=22}
  if(c.remarks){T(40,y,'Remarks:',11,true,GRAY);y+=16;wrap(c.remarks,515,11,false).forEach(l=>{T(40,y,l,11,false,INK);y+=15})}
  T(40,640,'Date issued:  '+c.date,11,false,INK);
  L(340,720,555,720);T(340,736,c.by||'',11,true,INK);T(340,750,'Examining physician',9,false,GRAY);
  T(40,800,'EduHealthHub  |  Confidential student health information',8,false,GRAY)})}

/* ---- actions ---- */
const HOME_ACT={
 hpanel:a=>{S.hm.panel=a.dataset.k;render();const f=$('.hform');if(f)f.scrollIntoView({block:'nearest'})},
 hpick:a=>{S.hm.sid=a.dataset.id;S.hm.q=stu(a.dataset.id).lrn;S.hm.msg='';S.hm.panel=a.dataset.k||'';render();const r=$('#hres');if(r)r.scrollIntoView({block:'start'})},
 hclear:()=>{S.hm={q:'',sid:null,panel:'',msg:''};render()},
 'qa-walk':()=>{S.hm.panel='walk';S.hm.msg=S.hm.sid?'':'Type the learner\'s LRN first.';render();S.hm.sid?0:homeFocusSearch()},
 'qa-refer':()=>{S.hm.panel='refer';S.hm.msg=S.hm.sid?'':'Type the learner\'s LRN first.';render();S.hm.sid?0:homeFocusSearch()},
 'qa-clear':()=>{S.hm.panel='clear';S.hm.msg=S.hm.sid?'':'Type the learner\'s LRN first.';render();S.hm.sid?0:homeFocusSearch()},
 'qa-odonto':()=>{if(S.hm.sid)return goOpen(S.hm.sid,'dental');S.hm.msg='Type the learner\'s LRN to open the odontogram.';render();homeFocusSearch()},
 gorefs:()=>{const e=$('#refq');if(e)e.scrollIntoView({behavior:'smooth',block:'start'})},
 gorest:()=>{const e=$('#restq');if(e)e.scrollIntoView({behavior:'smooth',block:'start'})},
 'nav-stock':()=>{S.view='stock';render();scrollTo(0,0)},
 hreturn:a=>{const s=stu(a.dataset.id),v=(s.visits||[]).find(x=>x.id===a.dataset.v);if(!v||!canTreat())return;v.out=nowT();save();render();toast('Returned to class at '+v.out+'. Clinic pass is ready in the record.');clinicPass(s,v)},
 hpass:a=>{const s=stu(a.dataset.id),v=(s.visits||[]).find(x=>x.id===a.dataset.v);if(v)clinicPass(s,v)},
 hcert:a=>{const s=stu(a.dataset.id),c=(s.clear||[]).find(x=>x.id===a.dataset.v);if(c)certificate(s,c)},
 hdelplan:a=>{const s=stu(a.dataset.id);if(S.user.role!=='Doctor')return;s.plans=(s.plans||[]).filter(x=>x.id!==a.dataset.v);save();render();toast('Care plan removed')},
 hdelnote:a=>{DB.notes=DB.notes.filter(n=>n.id!==a.dataset.v);save();render()}
};
function homeSubmit(e){
 const f=e.target,id=f.id,v=i=>($('#'+i)||{}).value||'';
 const s=f.dataset&&f.dataset.id?stu(f.dataset.id):null,me=S.user,date=localDate(),time=nowT();
 if(id==='hform'){const q=S.hm.q.trim();S.hm.msg='';
  if(/^\d{12}$/.test(q)){homeFind();if(!S.hm.sid)S.hm.msg='No learner has that LRN.'}
  else{const m=searchMatches(q);if(m.length===1){S.hm.sid=m[0].id;S.hm.q=m[0].lrn}else S.hm.msg=m.length?'Pick one of the matching learners below.':(q?'No learner matches that. LRNs have 12 digits.':'Type an LRN first.')}
  render();return true}
 if(id==='hf-note'){if(!canTreat())return true;const t=v('n-text').trim();if(!t)return true;DB.notes.push({id:nid('N'),text:t,by:me.name,role:me.role,date,time});save();render();return true}
 if(!s)return false;
 if(id==='hf-walk'&&canTreat()){
  const ail=v('w-ail'),ref=$('#w-ref').checked,vis={id:nid('V'),date,time,ailment:ail,tx:v('w-tx').trim(),rest:$('#w-rest').checked,out:'',by:me.name};
  arr(s,'visits').push(vis);
  const it=DB.stock.find(x=>x.id===v('w-item'));if(it){const n=Math.max(1,parseInt(v('w-qty'))||1);it.qty=Math.max(0,it.qty-n);vis.tx+=(vis.tx?'; ':'')+n+' '+it.unit+' '+it.name}
  if(ref)arr(s,'refs').push({id:nid('R'),date,time,reason:v('w-why').trim()||ail,by:me.name,status:'pending'});
  S.hm.panel='';save();render();toast('Visit saved'+(ref?' and sent to the doctor':''));return true}
 if(id==='hf-refer'&&canTreat()){arr(s,'refs').push({id:nid('R'),date,time,reason:v('r-why').trim(),by:me.name,status:'pending'});S.hm.panel='';save();render();toast('Sent to the doctor queue');return true}
 if(id==='hf-eval'&&me.role==='Doctor'){const r=(s.refs||[]).find(x=>x.id===f.dataset.ref);if(!r)return true;Object.assign(r,{status:'done',eval:v('e-ev').trim(),rec:v('e-rec').trim(),evalBy:me.name,evalDate:date});S.hm.panel='';save();render();toast('Evaluation saved');return true}
 if(id==='hf-clear'&&me.role==='Doctor'){const c={id:nid('C'),date,type:v('c-type'),until:v('c-until'),remarks:v('c-rem').trim(),by:me.name};arr(s,'clear').push(c);S.hm.panel='';save();render();toast('Clearance issued');certificate(s,c);return true}
 if(id==='hf-plan'&&me.role==='Doctor'){arr(s,'plans').push({id:nid('P'),date,type:v('p-type'),details:v('p-det').trim(),until:v('p-until'),by:me.name});S.hm.panel='';save();render();toast('Care plan attached');return true}
 return false}
