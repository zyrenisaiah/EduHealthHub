/* ---------- Announcements and Schedule (clinic staff post, teachers read and get notified) ---------- */
const PL_KINDS={
 athletes:['Athlete health clearance','k-ath'],
 bmi:['BMI measuring','k-bmi'],
 free:['Clinic free / open','k-free'],
 closed:['Clinic closed','k-closed'],
 other:['Other','k-other']};
const PL_MON=['January','February','March','April','May','June','July','August','September','October','November','December'];
const PL_DOW=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
S.pl={ann:[],ev:[],loaded:false,loading:false,t:0,err:'',m:null,sel:null,lf:'month',form:null};
const plStaff=()=>!!S.user&&['Doctor','Nurse','Dentist'].includes(S.user.role);
const plYmd=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const plParse=s=>{const p=String(s).slice(0,10).split('-');return new Date(+p[0],+p[1]-1,+p[2])};
const plToday=()=>plYmd(new Date());
function plDay(s,long){const d=plParse(s);return PL_DOW[d.getDay()]+', '+PL_MON[d.getMonth()].slice(0,long?9:3)+' '+d.getDate()+(long?', '+d.getFullYear():'')}
function plRange(e){return e.d2&&e.d2!==e.d1?plDay(e.d1)+' to '+plDay(e.d2):plDay(e.d1)}
function plTime(t){if(!t)return '';const p=t.split(':'),h=+p[0],m=p[1]||'00';return (h%12||12)+':'+m+(h<12?' AM':' PM')}
function plTimes(e){return e.t1?plTime(e.t1)+(e.t2?' to '+plTime(e.t2):''):''}
function plSecName(id){const x=SECT_UI.find(y=>y.id===id);return x?secLabel(x):id}
function plPill(k){const x=PL_KINDS[k]||PL_KINDS.other;return `<span class="plk ${x[1]}">${x[0]}</span>`}
function plPostedAt(t){try{return new Date(t).toLocaleString([], {month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'})}catch(e){return ''}}

async function plLoad(force){
 if(!CLOUD_ON||!S.user||!TOK||S.pl.loading)return;
 if(!force&&S.pl.loaded&&Date.now()-S.pl.t<20000)return;
 S.pl.loading=true;
 try{const r=await Promise.all([rpc('app_ann_list',{p_token:TOK}),rpc('app_ev_list',{p_token:TOK})]);const sig=JSON.stringify(r),ch=sig!==S.pl.sig||!S.pl.loaded;S.pl.sig=sig;S.pl.ann=r[0]||[];S.pl.ev=r[1]||[];S.pl.loaded=true;S.pl.err='';S.pl.t=Date.now();S.pl.changed=ch}
 catch(e){S.pl.err=cloudErr(e)}
 S.pl.loading=false;
 const ae=document.activeElement,typing=ae&&/^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName);
 if(['ann','sched','home'].includes(S.view)&&(S.pl.changed||force)&&!(typing&&!force)){const y=window.scrollY;render();window.scrollTo(0,y)}}
function plEnsure(){if(!S.pl.loaded||Date.now()-S.pl.t>20000)setTimeout(()=>plLoad(),0)}

/* mark announcement notifications as read once the page is opened */
function plSeen(){
 if(!S.nt||!S.nt.items)return;
 const un=S.nt.items.filter(n=>n.kind==='announce'&&!n.read);
 if(!un.length)return;
 un.forEach(n=>{n.read=true;S.nt.unread=Math.max(0,S.nt.unread-1);rpc('app_notif_read',{p_token:TOK,p_id:n.id}).catch(()=>{})});
 if(typeof ntPaint==='function')ntPaint();plBadge()}
function plBadge(){
 const el=document.getElementById('annbadge');if(!el)return;
 const n=(S.nt&&S.nt.items?S.nt.items:[]).filter(x=>x.kind==='announce'&&!x.read).length;
 el.textContent=n||'';el.hidden=!n}
function plTopLinks(){
 const cur=S.view,b=(v,t,extra)=>`<button type="button" class="btn sm tl" data-act="nav" data-v="${v}" ${cur===v?'aria-current="page"':''}>${t}${extra||''}</button>`;
 const n=(S.nt&&S.nt.items?S.nt.items:[]).filter(x=>x.kind==='announce'&&!x.read).length;
 return `<div class="toplinks" role="navigation" aria-label="Announcements and schedule">${b('ann','Announcements',`<span class="badge" id="annbadge"${n?'':' hidden'}>${n||''}</span>`)}${b('sched','Schedule')}</div>`}

function plOffline(){return `<div class="panel"><p>Announcements and the schedule are kept in the online database, so they need an internet connection. Check your connection and log in again.</p></div>`}
function plErr(){return S.pl.err?`<div class="pill bad" style="white-space:normal;margin-bottom:10px">${esc(S.pl.err)}</div>`:''}

/* ---------------- Announcements ---------------- */
function annView(){
 if(!CLOUD_ON)return `<div class="head"><div><div class="eyebrow">Clinic</div><h2>Announcements</h2></div></div>${plOffline()}`;
 plEnsure();setTimeout(plSeen,0);
 const list=S.pl.ann,staff=plStaff();
 const compose=staff?`<form class="panel plform" id="annform" style="display:grid;gap:10px;align-content:start"><h3>Post an announcement</h3>
  <p class="small muted">Every teacher is notified. Teachers can read announcements but cannot post.</p>
  <div class="field"><label for="an-t">Title</label><input class="inp" id="an-t" maxlength="120" required placeholder="Example: Free dental check-up on Friday"></div>
  <div class="field"><label for="an-b">Message</label><textarea class="inp" id="an-b" rows="4" maxlength="2000" required placeholder="Write the details teachers need to know."></textarea></div>
  <div id="an-msg" class="small" role="status"></div>
  <div><button class="btn primary" type="submit">Post announcement</button></div></form>`:'';
 const items=!S.pl.loaded?'<div class="small muted" style="padding:8px">'+(S.pl.err?'':'Loading announcements...')+'</div>':list.length?list.map(a=>`<article class="panel annitem"><div class="head"><h3>${esc(a.title)}</h3>${staff?`<button type="button" class="btn sm danger" data-act="anndel" data-id="${a.id}" aria-label="Delete announcement: ${esc(a.title)}">Delete</button>`:''}</div><p class="annbody">${esc(a.body)}</p><div class="small muted">Posted by ${esc(a.by)} (${esc(a.role)}) on ${esc(plPostedAt(a.at))}</div></article>`).join(''):'<div class="panel"><p class="muted">No announcements yet.</p></div>';
 return `<div class="head"><div><div class="eyebrow">Clinic</div><h2>Announcements</h2></div><span class="small muted">${staff?'You can post. Teachers are notified.':'Posted by the clinic staff.'}</span></div>
 ${plErr()}<div class="anngrid${staff?' withform':''}">${compose}<div class="annlist" style="display:grid;gap:12px;align-content:start">${items}</div></div>`}

/* ---------------- Schedule ---------------- */
function plMonthKey(){if(!S.pl.m)S.pl.m=plToday().slice(0,7);return S.pl.m}
function plByDay(){
 const map={};
 S.pl.ev.forEach(e=>{const a=plParse(e.d1),b=plParse(e.d2||e.d1);for(let d=new Date(a),n=0;d<=b&&n<=61;d.setDate(d.getDate()+1),n++){const k=plYmd(d);(map[k]=map[k]||[]).push(e)}});
 return map}
function plCalendar(){
 const mk=plMonthKey(),y=+mk.slice(0,4),m=+mk.slice(5,7)-1,first=new Date(y,m,1),start=new Date(y,m,1-first.getDay()),map=plByDay(),today=plToday();
 let cells='';
 for(let i=0;i<42;i++){
  const d=new Date(start);d.setDate(start.getDate()+i);const k=plYmd(d),ev=map[k]||[],out=d.getMonth()!==m;
  if(i>=35&&out&&i%7===0)break;
  const kinds=[...new Set(ev.map(e=>e.kind))];
  const label=ev.length?plDay(k,true)+': '+ev.map(e=>(PL_KINDS[e.kind]||PL_KINDS.other)[0]+', '+e.title).join('; '):plDay(k,true)+': nothing scheduled';
  cells+=`<button type="button" class="plcell${out?' out':''}${k===today?' today':''}${S.pl.sel===k?' sel':''}${ev.length?' has':''}" data-act="plday" data-d="${k}" aria-label="${esc(label)}" aria-pressed="${S.pl.sel===k}"><span class="pln">${d.getDate()}</span><span class="pldots">${kinds.map(x=>`<i class="${(PL_KINDS[x]||PL_KINDS.other)[1]}"></i>`).join('')}</span>${ev.slice(0,2).map(e=>`<span class="plmini ${(PL_KINDS[e.kind]||PL_KINDS.other)[1]}">${esc(e.title)}</span>`).join('')}${ev.length>2?`<span class="plmore">+${ev.length-2} more</span>`:''}</button>`}
 const legend=Object.keys(PL_KINDS).map(k=>`<span class="pllg">${plPill(k)}</span>`).join('');
 return `<section class="panel plcal" aria-label="Calendar for ${PL_MON[m]} ${y}">
  <div class="plhead"><button type="button" class="btn sm" data-act="plmonth" data-d="-1" aria-label="Previous month">&#8249; Prev</button><h3>${PL_MON[m]} ${y}</h3><button type="button" class="btn sm" data-act="plmonth" data-d="1" aria-label="Next month">Next &#8250;</button><button type="button" class="btn sm" data-act="pltoday">Today</button></div>
  <div class="plgrid" role="group"><div class="plwk" aria-hidden="true">${PL_DOW.map(x=>`<b>${x}</b>`).join('')}</div>${cells}</div>
  <div class="pllegend">${legend}</div></section>`}
function plEvCard(e){
 const staff=plStaff(),tm=plTimes(e);
 return `<div class="plev ${(PL_KINDS[e.kind]||PL_KINDS.other)[1]}"><div class="plevtop">${plPill(e.kind)}<b>${esc(e.title)}</b></div>
  <div class="small">${esc(plRange(e))}${tm?' · '+esc(tm):''}${e.aud?' · For: '+esc(e.aud):''}${e.sec?' · Section: '+esc(plSecName(e.sec)):''}</div>
  ${e.details?`<p class="plnote">${esc(e.details)}</p>`:''}
  <div class="small muted">Added by ${esc(e.by)}</div>
  ${staff?`<div class="trow"><button type="button" class="btn sm" data-act="evedit" data-id="${e.id}">Edit</button><button type="button" class="btn sm danger" data-act="evdel" data-id="${e.id}" aria-label="Delete: ${esc(e.title)}">Delete</button></div>`:''}</div>`}
function plList(){
 const mk=plMonthKey(),today=plToday(),map=plByDay();
 let days,title;
 if(S.pl.sel){days=[S.pl.sel];title='Details for '+plDay(S.pl.sel,true)}
 else{
  const all=Object.keys(map).sort();
  if(S.pl.lf==='month'){days=all.filter(k=>k.slice(0,7)===mk);title='All dates in '+PL_MON[+mk.slice(5,7)-1]+' '+mk.slice(0,4)}
  else if(S.pl.lf==='upcoming'){days=all.filter(k=>k>=today);title='Upcoming dates'}
  else{days=all;title='All dates'}}
 const chips=[['month','This month'],['upcoming','Upcoming'],['all','All dates']].map(c=>`<button type="button" class="chip${!S.pl.sel&&S.pl.lf===c[0]?' on':''}" data-act="pllf" data-v="${c[0]}" aria-pressed="${!S.pl.sel&&S.pl.lf===c[0]}">${c[1]}</button>`).join('');
 const body=days.length?days.map(k=>{const ev=map[k]||[];return `<div class="pldate${k===today?' istoday':''}"><div class="pldh"><b>${esc(plDay(k,true))}</b>${k===today?'<span class="pill good">Today</span>':''}<span class="small muted">${ev.length?ev.length+(ev.length>1?' entries':' entry'):'Nothing scheduled'}</span></div>${ev.length?ev.map(plEvCard).join(''):'<div class="small muted">No entries on this day.</div>'}</div>`}).join(''):'<div class="small muted" style="padding:8px">Nothing scheduled here.</div>';
 return `<section class="panel pllist" aria-label="List of dates"><div class="head"><h3>${esc(title)}</h3><div class="chips" role="group" aria-label="Show">${S.pl.sel?'<button type="button" class="chip on" data-act="plclear">Clear day</button>':''}${chips}</div></div><div class="pldates">${body}</div></section>`}
function plForm(){
 const f=S.pl.form;if(!f)return '';
 const sel=S.pl.sel||plToday();
 const e=f.id?S.pl.ev.find(x=>x.id===f.id)||{}:{};
 const v=(k,d)=>esc(e[k]!=null&&e[k]!==''?e[k]:d||'');
 return `<form class="panel plform" id="evform" style="display:grid;gap:10px"><h3>${f.id?'Edit schedule entry':'Add to the schedule'}</h3>
  <input type="hidden" id="ev-id" value="${f.id||''}">
  <div class="grid2">
   <div class="field"><label for="ev-kind">Type</label><select class="inp" id="ev-kind">${Object.keys(PL_KINDS).map(k=>`<option value="${k}"${(e.kind||'athletes')===k?' selected':''}>${PL_KINDS[k][0]}</option>`).join('')}</select></div>
   <div class="field"><label for="ev-title">Title</label><input class="inp" id="ev-title" maxlength="120" required value="${v('title')}" placeholder="Example: Basketball team health clearance"></div>
   <div class="field"><label for="ev-d1">Date</label><input class="inp" id="ev-d1" type="date" required value="${v('d1',sel)}"></div>
   <div class="field"><label for="ev-d2">Until (optional, for several days)</label><input class="inp" id="ev-d2" type="date" value="${e.d2&&e.d2!==e.d1?esc(e.d2):''}"></div>
   <div class="field"><label for="ev-t1">Start time (optional)</label><input class="inp" id="ev-t1" type="time" value="${v('t1')}"></div>
   <div class="field"><label for="ev-t2">End time (optional)</label><input class="inp" id="ev-t2" type="time" value="${v('t2')}"></div>
  </div>
  <div class="field"><label for="ev-sec">Notify teachers</label><select class="inp" id="ev-sec"><option value="">All teachers</option>${SECT_UI.map(x=>`<option value="${esc(x.id)}"${e.sec===x.id?' selected':''}>Only the adviser of ${esc(secLabel(x))} (${esc(trackLabel(x))})</option>`).join('')}</select><span class="small muted">The entry stays visible to everyone on the calendar. Only the notification is limited.</span></div>
  <div class="field"><label for="ev-aud">Who it is for (team or group, optional)</label><input class="inp" id="ev-aud" maxlength="120" value="${v('aud')}" placeholder="Example: Grade 11 Academic-2, or Volleyball team"></div>
  <div class="field"><label for="ev-det">Details</label><textarea class="inp" id="ev-det" rows="3" maxlength="1000" placeholder="What learners should bring or do.">${v('details')}</textarea></div>
  <div id="ev-msg" class="small" role="status"></div>
  <div class="trow"><button class="btn primary" type="submit">${f.id?'Save changes':'Add to schedule'}</button><button type="button" class="btn" data-act="evcancel">Cancel</button></div>
  ${f.id?'':'<div class="small muted">Teachers get a notification when a new entry is added.</div>'}</form>`}
function schedView(){
 if(!CLOUD_ON)return `<div class="head"><div><div class="eyebrow">Clinic</div><h2>Schedule</h2></div></div>${plOffline()}`;
 plEnsure();
 const staff=plStaff();
 return `<div class="head"><div><div class="eyebrow">Clinic</div><h2>Schedule</h2></div>${staff?`<button type="button" class="btn primary" data-act="evnew">+ Add to schedule</button>`:'<span class="small muted">Athlete clearances, BMI days and free clinic dates.</span>'}</div>
 ${plErr()}${plForm()}${S.pl.loaded?'':'<div class="small muted" style="padding:8px">Loading schedule...</div>'}${plCalendar()}${plList()}`}

const PLAN_ACT={
 plmonth:a=>{const mk=plMonthKey(),d=new Date(+mk.slice(0,4),+mk.slice(5,7)-1+ +a.dataset.d,1);S.pl.m=plYmd(d).slice(0,7);S.pl.sel=null;render()},
 pltoday:()=>{S.pl.m=plToday().slice(0,7);S.pl.sel=plToday();render()},
 plday:a=>{const k=a.dataset.d;S.pl.sel=S.pl.sel===k?null:k;if(k.slice(0,7)!==plMonthKey())S.pl.m=k.slice(0,7);render();const l=document.querySelector('.pllist');if(l&&S.pl.sel)l.scrollIntoView({behavior:'smooth',block:'nearest'})},
 pllf:a=>{S.pl.lf=a.dataset.v;S.pl.sel=null;render()},
 plclear:()=>{S.pl.sel=null;render()},
 evnew:()=>{S.pl.form={id:null};render();const i=document.getElementById('ev-title');if(i)i.focus()},
 evedit:a=>{S.pl.form={id:+a.dataset.id};render();const f=document.getElementById('evform');if(f)f.scrollIntoView({behavior:'smooth',block:'center'})},
 evcancel:()=>{S.pl.form=null;render()},
 evdel:async a=>{
  if(!plStaff()||!confirm('Delete this schedule entry?'))return;
  try{await rpc('app_ev_delete',{p_token:TOK,p_id:+a.dataset.id});toast('Schedule entry deleted');await plLoad(true)}catch(e){toast('Could not delete. '+cloudErr(e))}},
 anndel:async a=>{
  if(!plStaff()||!confirm('Delete this announcement?'))return;
  try{await rpc('app_ann_delete',{p_token:TOK,p_id:+a.dataset.id});toast('Announcement deleted');await plLoad(true)}catch(e){toast('Could not delete. '+cloudErr(e))}},
 ntview:a=>{S.nt.open=false;const id=+a.dataset.id;if(id){rpc('app_notif_read',{p_token:TOK,p_id:id}).catch(()=>{});const it=S.nt.items.find(x=>x.id===id);if(it&&!it.read){it.read=true;S.nt.unread=Math.max(0,S.nt.unread-1)}}S.view=a.dataset.v;S.pl.t=0;render();window.scrollTo(0,0)}
};

function planSubmit(e){
 const id=e.target.id,$=x=>document.getElementById(x),val=x=>($(x)||{}).value||'';
 if(id==='annform'){
  const t=val('an-t').trim(),b=val('an-b').trim(),msg=$('an-msg'),btn=e.target.querySelector('button[type=submit]');
  if(!t||!b){if(msg)msg.textContent='Write a title and a message.';return true}
  btn.disabled=true;btn.textContent='Posting...';
  rpc('app_ann_post',{p_token:TOK,p_title:t,p_body:b}).then(()=>{toast('Announcement posted. Teachers were notified.');S.pl.t=0;plLoad(true)}).catch(er=>{btn.disabled=false;btn.textContent='Post announcement';if(msg)msg.textContent='Could not post. '+cloudErr(er)});
  return true}
 if(id==='evform'){
  const msg=$('ev-msg'),btn=e.target.querySelector('button[type=submit]'),d1=val('ev-d1'),d2=val('ev-d2'),t1=val('ev-t1'),t2=val('ev-t2');
  const bad=!val('ev-title').trim()?'Write a title.':!d1?'Choose a date.':d2&&d2<d1?'The end date must be the same day or later.':d2&&(plParse(d2)-plParse(d1))/864e5>60?'A single entry can cover at most 60 days.':t1&&t2&&t2<=t1?'The end time must be after the start time.':'';
  if(bad){if(msg)msg.textContent=bad;return true}
  btn.disabled=true;btn.textContent='Saving...';
  const data={id:val('ev-id')||null,kind:val('ev-kind'),title:val('ev-title').trim(),d1:d1,d2:d2||d1,t1:t1,t2:t2,aud:val('ev-aud').trim(),sec:val('ev-sec'),details:val('ev-det').trim()};
  rpc('app_ev_save',{p_token:TOK,p_data:data}).then(()=>{toast(data.id?'Schedule entry saved':'Added to the schedule. Teachers were notified.');S.pl.form=null;S.pl.sel=d1;S.pl.m=d1.slice(0,7);plLoad(true)}).catch(er=>{btn.disabled=false;btn.textContent=data.id?'Save changes':'Add to schedule';if(msg)msg.textContent='Could not save. '+cloudErr(er)});
  return true}
 return false}
