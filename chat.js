/* ---------- Messages: chat between accounts, with live "sent to clinic" tracking ---------- */
S.msg={dir:[],dirOk:false,msgs:[],ids:new Set(),last:0,reads:{},active:'',draft:{},panel:'',q:'',pick:null,tmp:{},err:'',busy:false};
let _msgT=null,_msgTick=0,_baseTitle='';
const mName=id=>id===S.user.id?S.user.name:((S.msg.dir.find(d=>d.id===id)||{}).name||'Someone');
const dmId=(a,b)=>'dm:'+[a,b].sort().join(':');
function convTitle(c){
 if(c==='clinic')return 'Clinic team';
 if(c.startsWith('desk:')){const t=c.slice(5);return t===S.user.id?'Clinic desk':'Desk: '+mName(t)}
 const p=c.split(':');return mName(p[1]===S.user.id?p[2]:p[1])}
function convSub(c){
 if(c==='clinic')return 'Doctors, nurses and dentist';
 if(c.startsWith('desk:'))return c.slice(5)===S.user.id?'You and the clinic staff':'Teacher and clinic staff';
 const p=c.split(':'),o=S.msg.dir.find(d=>d.id===(p[1]===S.user.id?p[2]:p[1]));return o?o.role+(o.adv?' · '+secLabel(secOf(o.adv)):''):''}
const avOf=(id,role)=>{if(id===S.user.id)return S.user.photo||ROLE_ICON[S.user.role];const o=S.msg.dir.find(d=>d.id===id);return(o&&o.photo)||ROLE_ICON[(o&&o.role)||role||'Teacher']};
const convOtherId=c=>c.startsWith('desk:')?c.slice(5):c.startsWith('dm:')?(c.split(':')[1]===S.user.id?c.split(':')[2]:c.split(':')[1]):'';
function convIcon(c){
 if(c==='clinic')return ROLE_ICON.Doctor;
 const id=c.startsWith('desk:')?c.slice(5):(c.split(':')[1]===S.user.id?c.split(':')[2]:c.split(':')[1]);
 if(c.startsWith('desk:')&&id===S.user.id)return ROLE_ICON.Nurse;
 return avOf(id)}
const convMsgs=c=>S.msg.msgs.filter(m=>m.conv===c);
const unreadOf=c=>{const r=S.msg.reads[c]||0;return convMsgs(c).filter(m=>m.id>r&&m.s!==S.user.id&&m.k!=='event').length};
const unreadAll=()=>Object.keys(S.msg.msgs.reduce((o,m)=>(o[m.conv]=1,o),{})).reduce((n,c)=>n+unreadOf(c),0);
function convList(){
 const set=new Set(S.msg.msgs.map(m=>m.conv));
 set.add(S.user.role==='Teacher'?'desk:'+S.user.id:'clinic');
 if(S.msg.active)set.add(S.msg.active);Object.keys(S.msg.tmp).forEach(c=>set.add(c));
 const lastId=c=>{const l=convMsgs(c).slice(-1)[0];return l?l.id:0};
 return [...set].sort((a,b)=>lastId(b)-lastId(a)||convTitle(a).localeCompare(convTitle(b)))}
const mtime=t=>{const d=new Date(t);return d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})};
const mday=t=>{const d=new Date(t),n=new Date(),y=new Date(Date.now()-864e5);return d.toDateString()===n.toDateString()?'Today':d.toDateString()===y.toDateString()?'Yesterday':d.toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'})};
const mprev=m=>m.k==='pass'?'Sent a student to the clinic':m.k==='record'?'Shared a record':m.k==='event'?m.b:m.b;

/* ---- network ---- */
const msgErr=e=>({NOT_ALLOWED:'You cannot message that person.',SLOW_DOWN:'You are sending too fast. Wait a moment.',TOO_LONG:'That message is too long.',EMPTY:'Type a message first.'}[e&&e.code])||cloudErr(e);
function msgMerge(list){let add=0,others=[];
 list.forEach(m=>{if(S.msg.ids.has(m.id))return;S.msg.ids.add(m.id);S.msg.msgs.push(m);add++;if(m.id>S.msg.last)S.msg.last=m.id;if(m.s!==S.user.id&&m.k!=='event')others.push(m)});
 if(add)S.msg.msgs.sort((a,b)=>a.id-b.id);return others}
async function msgSync(){
 if(!CLOUD_ON||!TOK||!S.user||S.msg.busy)return;S.msg.busy=true;
 try{
  if(!S.msg.dirOk||Date.now()-(S.msg.dirT||0)>120000){S.msg.dir=await rpc('app_directory',{p_token:TOK});S.msg.dirOk=true;S.msg.dirT=Date.now()}
  const first=S.msg.last===0&&!S.msg.msgs.length,r=await rpc('app_msg_sync',{p_token:TOK,p_since:S.msg.last});
  Object.keys(r.reads||{}).forEach(c=>{S.msg.reads[c]=Math.max(S.msg.reads[c]||0,r.reads[c])});
  const others=msgMerge(r.messages||[]);S.msg.err='';
  if(!first&&others.length){const m=others[others.length-1];
   if(!(S.view==='chat'&&S.msg.active===m.conv&&!document.hidden))toast(m.sn+': '+mprev(m).slice(0,60))}
  chatRefresh();
  if(!first&&r.messages.some(m=>m.k==='event'||m.k==='pass'))cloudPollOnce().then(()=>chatRefresh())}
 catch(e){if(e.code==='SESSION_EXPIRED')cloudKick();else S.msg.err=msgErr(e)}
 finally{S.msg.busy=false}}
async function msgSend(conv,body,kind,ref,quiet){
 if(!CLOUD_ON||!TOK)return null;
 try{const m=await rpc('app_msg_send',{p_token:TOK,p_conv:conv,p_body:body||'',p_kind:kind||'text',p_ref:ref||null});
  msgMerge([m]);S.msg.reads[conv]=Math.max(S.msg.reads[conv]||0,m.id);chatRefresh(true);return m}
 catch(e){if(!quiet)toast(msgErr(e));return null}}
const chatPost=(conv,body,kind,ref)=>msgSend(conv,body,kind,ref,true);
let _rd=null;
function msgMarkRead(){
 const c=S.msg.active;if(!c||document.hidden||S.view!=='chat')return;
 const l=convMsgs(c).slice(-1)[0];if(!l||(S.msg.reads[c]||0)>=l.id)return;
 S.msg.reads[c]=l.id;clearTimeout(_rd);_rd=setTimeout(()=>rpc('app_msg_read',{p_token:TOK,p_conv:c,p_id:l.id}).catch(()=>{}),300)}
function msgStart(){
 clearInterval(_msgT);if(!_baseTitle)_baseTitle=document.title;msgSync();
 _msgT=setInterval(()=>{if(document.hidden||!S.user)return;_msgTick++;if(S.view==='chat'||_msgTick%3===0)msgSync()},3000)}
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&S.user)msgSync()});

/* ---- tracking events posted by the clinic flow ---- */
/* post only after the record change has reached the database, so everyone sees the same status */
async function afterSave(fn){await 0;try{clearTimeout(_t);await doSave()}catch(e){}fn()}
function sendPassFor(s,note){
 const me=S.user,p={id:nid('G'),date:localDate(),time:nowT(),by:me.name,byId:me.id,note:note||'',status:'sent'};
 arr(s,'passes').push(p);save();
 afterSave(()=>chatPost('desk:'+me.id,`Sent ${fullName(s)} to the clinic`+(note?' ('+note+')':''),'pass',{sid:s.id,pid:p.id}));return p}
function receivePass(s,x){
 x.status='arrived';x.arr=nowT();x.recvBy=S.user.name;save();
 if(x.byId)afterSave(()=>chatPost('desk:'+x.byId,`${fullName(s)} arrived. Received by ${S.user.name} at ${x.arr}.`,'event',null))}
function postTimeout(s,v){
 if(!v.from)return;
 afterSave(()=>chatPost('desk:'+v.from,`${fullName(s)} was timed out at ${v.out} by ${S.user.name}: ${v.outcome==='home'?'excused, sent home':'cleared to return to class'}.`,'event',null))}

/* ---- views ---- */
function passCard(m){
 const r=m.r||{},s=stu(r.sid);if(!s)return `<div class="mcard"><b>Student sent to the clinic</b><div class="small muted">Record not available here.</div></div>`;
 const p=(s.passes||[]).find(x=>x.id===r.pid),v=(s.visits||[]).find(x=>x.passId===r.pid),st=statusOf(s);
 const steps=[['Sent',p?p.time+' by '+p.by:'',true],['Received at clinic',p&&p.arr?p.arr+' by '+(p.recvBy||''):'',!!(p&&p.arr)],['In clinic',v?'since '+v.time:'',!!v],[v&&v.outcome==='home'?'Sent home':'Back in class',v&&v.out?v.out+(v.outBy?' by '+v.outBy:''):'',!!(v&&v.out)]];
 const ov=openVisit(s),act=canSlip()?(p&&p.status==='sent'?`<button class="btn sm primary" data-act="crecv" data-id="${s.id}" data-v="${p.id}">Receive</button>`:(ov?`<button class="btn sm primary" data-act="hreturn" data-o="class" data-id="${s.id}" data-v="${ov.id}">Return to class</button> <button class="btn sm" data-act="hreturn" data-o="home" data-id="${s.id}" data-v="${ov.id}">Send home</button>`:'')):'';
 return `<div class="mcard"><div class="eyebrow">Student sent to the clinic</div><b>${esc(fullName(s))}</b> <span class="mono small">${s.lrn}</span><div class="small muted">${esc(secLabel(curSec(s)))}${r.note||(p&&p.note)?' · '+esc(r.note||p.note):''}</div>
 <div style="margin:6px 0">${pill(esc(st.t),st.c)}</div><ol class="msteps">${steps.map(x=>`<li class="${x[2]?'done':''}"><b>${x[0]}</b>${x[1]?' <span class="small muted">'+esc(x[1])+'</span>':''}</li>`).join('')}</ol>${act?`<div class="trow">${act}</div>`:''}</div>`}
function recCard(m){
 const r=m.r||{},s=stu(r.sid);if(!s)return `<div class="mcard"><b>Shared record</b></div>`;
 return `<div class="mcard"><div class="eyebrow">${r.kind?'Shared health file':'Shared learner'}</div><b>${esc(fullName(s))}</b> <span class="mono small">${s.lrn}</span><div class="small muted">${esc(secLabel(curSec(s)))}${r.kind?' · '+esc(r.kind)+' · '+esc(r.sy||''):''}</div>
 <div class="trow"><button class="btn sm primary" data-act="copen" data-id="${s.id}" data-sy="${esc(r.sy||'')}" data-k="${esc(r.kind||'')}">Open${r.kind?' file':' record'}</button></div></div>`}
function threadHtml(c){
 const ms=convMsgs(c);let out='',day='';
 if(!ms.length)return `<div class="small muted" style="text-align:center;margin:30px 0">No messages yet. Say hello${S.user.role==='Teacher'&&c==='desk:'+S.user.id?' or send a student to the clinic':''}.</div>`;
 ms.forEach((m,i)=>{const d=mday(m.t);if(d!==day){day=d;out+=`<div class="mday">${esc(d)}</div>`}
  if(m.k==='event'){out+=`<div class="evt">${esc(m.b)} <span>${mtime(m.t)}</span></div>`;return}
  const me=m.s===S.user.id,prev=ms[i-1],showName=!me&&(!prev||prev.s!==m.s||prev.k==='event');
  const body=m.k==='pass'?passCard(m):m.k==='record'?recCard(m):`<div class="mtext">${esc(m.b).replace(/\n/g,'<br>')}</div>`;
  const av=!me&&(!prev||prev.s!==m.s||prev.k==='event'||mday(prev.t)!==d)?profImg(m.s,'mav',avOf(m.s,m.sr)):'';
  out+=`<div class="mrow ${me?'me':'them'}">${av}${showName&&!c.startsWith('dm:')?`<div class="mname">${esc(m.sn)} <span class="mrole">${esc(m.sr)}</span></div>`:''}<div class="bubble ${m.k!=='text'?'bwide':''}">${body}</div><div class="mtime">${mtime(m.t)}</div></div>`});
 return out}
function listHtml(){
 return convList().map(c=>{const l=convMsgs(c).slice(-1)[0],u=unreadOf(c);
  return `<button class="citem ${S.msg.active===c?'on':''} ${u?'unr':''}" data-act="copenconv" data-c="${esc(c)}"><img class="role-ic" src="${esc(convIcon(c))}" alt=""><span class="cmid"><b>${esc(convTitle(c))}</b><span class="small muted">${l?esc((l.s===S.user.id?'You: ':'')+mprev(l)).slice(0,48):esc(convSub(c))}</span></span><span class="cend">${l?`<span class="small muted">${mtime(l.t)}</span>`:''}${u?`<span class="badge">${u}</span>`:''}</span></button>`}).join('')}
const canProf=id=>S.user.role!=='Teacher'&&(S.msg.dir.find(d=>d.id===id)||{}).role==='Teacher';
const profImg=(id,cls,src)=>canProf(id)?`<button type="button" class="avbtn" data-act="cprof" data-id="${id}" title="View advisory" aria-label="View advisory class"><img class="${cls}" src="${esc(src)}" alt=""></button>`:`<img class="${cls}" src="${esc(src)}" alt="">`;
function profHtml(close){
 const o=S.msg.dir.find(d=>d.id===S.msg.prof);if(!o)return '';
 const sec=o.adv?secOf(o.adv):null,list=sec?DB.students.filter(s=>{const e=enrOf(s,S.sy);return e&&e.section===o.adv}).sort((a,b)=>a.last.localeCompare(b.last)||a.first.localeCompare(b.first)):[];
 return `<div class="cpanel"><div class="head"><h3>Teacher profile</h3>${close}</div><div class="who-cell"><img class="role-ic lg" src="${esc(avOf(o.id))}" alt=""><div><b>${esc(o.name)}</b><div class="small muted">${o.role}${sec?' · Adviser of '+esc(secLabel(sec)):' · No advisory section'}</div></div></div>
 ${sec?`<div class="small muted">${list.length} student${list.length===1?'':'s'} in this advisory</div><div class="tw"><table class="wrapth"><thead><tr><th>Student</th><th>LRN</th><th>Today</th></tr></thead><tbody>${list.map(s=>{const st=statusOf(s);return `<tr class="click" data-act="open" data-id="${s.id}" data-tab="profile"><td><b>${esc(fullName(s))}</b></td><td class="mono small">${s.lrn}</td><td>${st.k==='none'?'<span class="small muted">In class</span>':pill(esc(st.t),st.c)}</td></tr>`}).join('')}</tbody></table></div>`:''}</div>`}
function panelHtml(){
 const p=S.msg.panel,m=S.msg;if(!p)return '';
 const close='<button type="button" class="btn sm" data-act="cpanel" data-k="">Close</button>';
 if(p==='prof')return profHtml(close);
 if(p==='new'){const q=m.q.toLowerCase(),list=m.dir.filter(d=>!q||(d.name+' '+d.role).toLowerCase().includes(q)).slice(0,30);
  return `<div class="cpanel"><div class="head"><h3>New chat</h3>${close}</div><input class="inp" id="cq" data-bind="cq" placeholder="Search a name or role" value="${esc(m.q)}" autocomplete="off"><div class="cres">${list.map(d=>`<button class="btn sm" data-act="cdm" data-id="${d.id}">${esc(d.name)} <span class="small muted">${d.role}</span></button>`).join('')||'<span class="small muted">No match.</span>'}</div></div>`}
 if(p==='attach'||p==='send'){
  const isSend=p==='send';
  if(m.pick){const s=stu(m.pick);
   return `<div class="cpanel"><div class="head"><h3>${isSend?'Send to clinic':'Attach'}: ${esc(fullName(s))}</h3>${close}</div>
   ${isSend?`<div class="field"><label for="cnote">Reason (optional, non-medical)</label><input class="inp" id="cnote" maxlength="100" placeholder="e.g. says they feel unwell"></div><div style="margin-top:8px"><button class="btn primary" data-act="csendpass" data-id="${s.id}">Send pass</button></div>`
   :`<div class="cres"><button class="btn sm primary" data-act="cattach" data-id="${s.id}">Learner card</button>${DOC_KINDS.map(k=>`<button class="btn sm" data-act="cattach" data-id="${s.id}" data-k="${esc(k)}">${esc(k)}</button>`).join('')}</div>`}</div>`}
  const list=m.q.trim().length>=2||/^\d{3,}$/.test(m.q.trim())?searchMatches(m.q):[];
  return `<div class="cpanel"><div class="head"><h3>${isSend?'Send a student to the clinic':'Attach a learner or health file'}</h3>${close}</div><input class="inp" id="cq" data-bind="cq" placeholder="Type the LRN or the student's name" value="${esc(m.q)}" autocomplete="off"><div class="cres" id="cres">${list.map(x=>`<button class="btn sm" data-act="cpick" data-id="${x.id}">${esc(fullName(x))} <span class="mono small">${x.lrn}</span></button>`).join('')}</div></div>`}
 return ''}
function chHead(c){
 const id=convOtherId(c),inner=`<img class="role-ic" src="${esc(convIcon(c))}" alt=""><div><b>${esc(convTitle(c))}</b><div class="small muted">${esc(convSub(c))}${canProf(id)?' · tap to view advisory':''}</div></div>`;
 return canProf(id)?`<button type="button" class="chwho" data-act="cprof" data-id="${id}" aria-label="View advisory class of ${esc(convTitle(c))}">${inner}</button>`:`<div class="chwho">${inner}</div>`}
function chatView(){
 if(!CLOUD_ON)return `<div class="head"><div><div class="eyebrow">Messages</div><h2>Messages</h2></div></div><section class="panel"><p class="muted">Messaging needs the online database. It is not available in offline mode.</p></section>`;
 const c=S.msg.active,u=S.user,canSend=u.role==='Teacher'&&c==='desk:'+u.id;
 return `<div class="head"><div><div class="eyebrow">Messages</div><h2>Messages</h2></div><button class="btn primary" data-act="cpanel" data-k="new">New chat</button></div>
 ${S.msg.err?`<div class="pill bad" style="white-space:normal;margin-bottom:8px">${esc(S.msg.err)}</div>`:''}
 <div class="chat ${c||S.msg.panel==='new'?'has-active':''}"><aside class="chlist" id="chlist" aria-label="Conversations">${listHtml()}</aside>
 <section class="chmain" aria-label="Conversation">${c?`<div class="chhead"><button class="btn sm cback" data-act="cback" aria-label="Back to conversations">←</button>${chHead(c)}</div>
  <div class="chthread" id="chthread" role="log" aria-live="polite">${threadHtml(c)}</div><div id="chpanel">${panelHtml()}</div>
  <form class="chcomp" id="chform"><button type="button" class="btn" data-act="cpanel" data-k="attach" title="Attach a learner or health file" aria-label="Attach">+</button>${canSend?'<button type="button" class="btn" data-act="cpanel" data-k="send">Send student to clinic</button>':''}<textarea id="chtext" rows="1" maxlength="2000" placeholder="Write a message" aria-label="Message">${esc(S.msg.draft[c]||'')}</textarea><button class="btn primary" type="submit">Send</button></form>`
  :`<div class="chempty"><p class="muted">Choose a conversation, or start a new chat.</p><div id="chpanel">${panelHtml()}</div></div>`}</section></div>`}
function chatBadge(){
 const n=unreadAll();document.querySelectorAll('[data-v="chat"]').forEach(b=>{let e=b.querySelector('.badge');if(n){if(!e){e=document.createElement('span');e.className='badge';b.appendChild(e)}e.textContent=n}else if(e)e.remove()});
 if(_baseTitle)document.title=(n?'('+n+') ':'')+_baseTitle}
function chatRefresh(scroll){
 chatBadge();if(S.view!=='chat')return;
 const l=$('#chlist');if(l)l.innerHTML=listHtml();
 const t=$('#chthread');if(t&&S.msg.active){const near=t.scrollHeight-t.scrollTop-t.clientHeight<140;t.innerHTML=threadHtml(S.msg.active);if(near||scroll)t.scrollTop=t.scrollHeight}
 msgMarkRead();chatBadge()}
function chatPanelRender(){const p=$('#chpanel');if(p)p.innerHTML=panelHtml()}
function chatResults(){const live=$('#chpanel .cres');if(!live)return;const t=document.createElement('div');t.innerHTML=panelHtml();const n=t.querySelector('.cres');if(n&&live.innerHTML!==n.innerHTML)live.innerHTML=n.innerHTML}
function chatOpen(c){S.msg.active=c;S.msg.panel='';S.msg.q='';S.msg.pick=null;render();const t=$('#chthread');if(t)t.scrollTop=t.scrollHeight;msgMarkRead();chatBadge();const i=$('#chtext');if(i&&innerWidth>860)i.focus()}
const CHAT_ACT={
 copenconv:a=>chatOpen(a.dataset.c),
 cback:()=>{S.msg.active='';render()},
 cpanel:a=>{S.msg.panel=a.dataset.k;S.msg.q='';S.msg.pick=null;if(!S.msg.active)render();else chatPanelRender();const i=$('#cq');if(i)i.focus()},
 cprof:a=>{S.msg.prof=a.dataset.id;S.msg.panel='prof';if(!S.msg.active)render();else chatPanelRender()},
 cdm:a=>{const c=dmId(S.user.id,a.dataset.id);S.msg.tmp[c]=1;chatOpen(c)},
 cpick:a=>{S.msg.pick=a.dataset.id;chatPanelRender()},
 cattach:async a=>{const s=stu(a.dataset.id),k=a.dataset.k,sy=k?(s.enr.map(e=>e.sy).sort().pop()):'';
  S.msg.panel='';S.msg.pick=null;chatPanelRender();
  await msgSend(S.msg.active,k?`Shared ${k} of ${fullName(s)}`:`Shared the record of ${fullName(s)}`,'record',k?{sid:s.id,sy:enrOf(s,CUR_SY)?CUR_SY:sy,kind:k}:{sid:s.id})},
 csendpass:async a=>{const s=stu(a.dataset.id);if(!pool().includes(s))return toast('That learner is not in your advisory.');
  const st=statusOf(s);if(st.k==='in'||st.k==='way'){S.msg.panel='';S.msg.pick=null;chatPanelRender();return toast('That learner is already '+(st.k==='way'?'on the way to':'in')+' the clinic.')}
  const note=($('#cnote')||{}).value||'';S.msg.panel='';S.msg.pick=null;chatPanelRender();sendPassFor(s,note.trim());toast('Pass sent. The clinic can now track the learner.')},
 crecv:a=>{const s=stu(a.dataset.id),x=(s.passes||[]).find(p=>p.id===a.dataset.v);if(!x||!canSlip())return;receivePass(s,x);chatRefresh();toast('Received. Open Home to log the visit.')},
 copen:a=>{const s=stu(a.dataset.id);if(!s)return;if(S.user.role==='Teacher'&&!advList().includes(s))return toast('That learner is not in your advisory.');
  S.back='chat';S.sid=s.id;S.tab='profile';
  if(a.dataset.k){S.doc={sid:s.id,sy:a.dataset.sy||CUR_SY,kind:a.dataset.k,edit:false};S.docMsg=null;S.view='doc'}else S.view='student';render();scrollTo(0,0)}
};
function chatSubmit(){
 const c=S.msg.active,i=$('#chtext');if(!c||!i)return;const t=i.value.trim();if(!t)return;
 i.value='';S.msg.draft[c]='';i.style.height='';msgSend(c,t,'text',null).then(m=>{if(!m){i.value=t;S.msg.draft[c]=t}})}
document.addEventListener('submit',e=>{if(e.target.id==='chform'){e.preventDefault();e.stopImmediatePropagation();chatSubmit()}},true);
document.addEventListener('keydown',e=>{if(e.target.id==='chtext'&&e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();chatSubmit()}});
document.addEventListener('input',e=>{if(e.target.id==='chtext'){S.msg.draft[S.msg.active]=e.target.value;e.target.style.height='auto';e.target.style.height=Math.min(140,e.target.scrollHeight)+'px'}});
