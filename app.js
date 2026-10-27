/* ---------- student detail ---------- */
function studentView(){
 const st=stu(S.sid), sec=curSec(st), p=P[S.user.role];
 const tabs=[['profile','Profile & files']]; if(p.exam)tabs.push(['exam','Health exam card']); if(p.dental)tabs.push(['dental','Dental service']);
 if(!tabs.find(t=>t[0]===S.tab))S.tab='profile';
 const body=S.tab==='exam'?examTab(st,p.exam==='edit'):S.tab==='dental'?dentalTab(st,p.dental==='edit'):profileTab(st,p.prof==='edit');
 return `<div><button class="btn sm" data-act="back">← Back to list</button></div>
 <section class="panel"><div class="sthead"><img class="av lg" src="${av(st).match(/src="([^"]+)"/)[1]}" alt="Photo of ${esc(fullName(st))}">
  <div style="min-width:0"><div class="eyebrow">LRN <span class="mono">${st.lrn}</span></div><h2>${esc(fullName(st))}</h2>
  <div class="muted">${esc(secLabel(sec))} · ${trackLabel(sec)} · SY ${CUR_SY}</div></div>
  ${S.user.role==='Teacher'?`<div style="margin-left:auto;display:grid;gap:6px;justify-items:start"><div class="trow"><button class="btn sm" data-act="pickphoto">${st.photo?'Change photo':'Upload photo'}</button>${st.photo?'<button class="btn sm danger" data-act="rmphoto">Remove photo</button>':''}</div><input id="photo-in" type="file" accept="image/*" data-bind="photo" hidden><span class="small muted">JPG or PNG. Cropped to a square.</span></div>`:''}
  ${p[S.tab==='profile'?'prof':S.tab]==='edit'?'':'<span class="ro">View only</span>'}</div></section>
 <div class="tabs" role="tablist">${tabs.map(t=>`<button role="tab" aria-selected="${S.tab===t[0]}" data-act="tab" data-t="${t[0]}">${t[1]}</button>`).join('')}</div>${body}`;
}
function profileTab(st,edit){
 const d=edit?'':'disabled', cur=enrOf(st,CUR_SY);
 const f=(k,l,t='text')=>`<div class="field"><label for="p-${k}">${l}</label><input class="inp" id="p-${k}" type="${t}" value="${esc(st[k])}" data-bind="prof" data-f="${k}" ${d}></div>`;
 return `<section class="panel"><div class="head"><h3>Student record</h3>${S.user.role==='Teacher'?`<button class="btn sm" data-act="exportone" data-id="${st.id}">Download record</button>`:''}</div><div class="kv">
  ${f('first','First name')}${f('last','Last name')}
  <div class="field"><label>LRN</label><input class="inp mono" value="${st.lrn}" disabled></div>
  <div class="field"><label for="p-sec">Section (advisory)</label><select class="inp" id="p-sec" data-bind="prof" data-f="section" ${edit?'':'disabled'}>${SECT_UI.map(s=>`<option value="${s.id}" ${cur.section===s.id?'selected':''}>${esc(secLabel(s))} · ${trackLabel(s)}</option>`).join('')}</select></div>
  ${f('birth','Birthdate','date')}
  <div class="field"><label for="p-sex">Sex</label><select class="inp" id="p-sex" data-bind="prof" data-f="sex" ${d}>${['Female','Male'].map(x=>`<option ${st.sex===x?'selected':''}>${x}</option>`).join('')}</select></div>
  ${f('guardian','Parent / guardian')}${f('contact','Contact number')}${f('blood','Blood type')}${f('allergies','Allergies')}${f('conditions','Known conditions')}
 </div></section>
 <section class="panel"><div class="head"><h3>Health files</h3><span class="small muted">Held per school year</span></div><div class="tw"><table><thead><tr><th>School year</th><th>File</th><th>Filed on</th><th>Status</th></tr></thead><tbody>
 ${st.files.slice().sort((a,b)=>b.sy.localeCompare(a.sy)).map(x=>`<tr><td class="mono">${x.sy}</td><td>${esc(x.name)}</td><td class="mono">${x.date||'-'}</td><td>${x.date?pill('On file','good'):pill('Missing','warn')}</td></tr>`).join('')}
 </tbody></table></div></section>`;
}

/* ---------- health exam card ---------- */
function decode(f,val){
 const grp=GROUPS[f[3]]; let bad=false;
 const txt=val.split(/[,;]+/).map(t=>t.trim()).filter(Boolean).map(t=>{
  const L=t[0].toLowerCase(), it=grp.i[L.charCodeAt(0)-97];
  if(!it||!f[4].includes(L)){bad=true;return '? '+t}
  const rest=t.slice(1).replace(/^[\s:\-]+/,''); return L+'. '+it+(rest?': '+rest:'')}).join('; ');
 return {txt,bad};
}
function examTab(st,edit){
 const g=curSec(st).grade;
 const cell=(G,f)=>{
  const rec=st.exam[G]||{}, v=rec[f[0]]||'', ok=edit&&G<=g, d=ok?'':'disabled';
  const at=`data-bind="exam" data-g="${G}" data-f="${f[0]}" ${d} aria-label="${esc(f[1])}, Grade ${G}"`;
  if(f[2]==='date')return `<td><input class="inp" type="date" value="${esc(v)}" ${at}></td>`;
  if(f[2]==='num')return `<td><input class="inp" type="number" step="0.1" min="0" value="${esc(v)}" ${at}></td>`;
  if(f[2]==='code'){const dc=decode(f,v);return `<td><input class="inp mono ${dc.bad?'bad':''}" maxlength="40" placeholder="${G<=g||!edit?'letter, e.g. a':'-'}" value="${esc(v)}" data-code="1" ${at}><div class="dec" id="dec-${G}-${f[0]}">${esc(dc.txt)}</div></td>`}
  return `<td><input class="inp" type="text" value="${esc(v)}" placeholder="${esc(f[4]||'')}" ${at}></td>`;
 };
 return `<section class="panel"><div class="head"><div><h3>Medical examination</h3><div class="small muted">Record ailments by letter from the reference checklist below.${edit&&g<12?' Grade 12 opens once the learner is enrolled in it.':''}</div></div></div>
 <div class="tw"><table class="exam"><thead><tr><th>Examination</th><th>Grade 11</th><th>Grade 12</th></tr></thead><tbody>
 ${EXAM_FIELDS.map(f=>`<tr><td>${f[1]}</td>${cell(11,f)}${cell(12,f)}</tr>`).join('')}
 </tbody></table></div></section>
 <section class="panel"><div class="head"><h3>Other examinations and date</h3>${edit?'<button class="btn sm" data-act="addother">Add examination</button>':''}</div>
 <div class="tw"><table><thead><tr><th>Date</th><th>Examination and result</th><th></th></tr></thead><tbody>
 ${st.otherExams.map((o,i)=>`<tr><td><input class="inp" type="date" value="${esc(o.date)}" data-bind="other" data-i="${i}" data-f="date" ${edit?'':'disabled'}></td><td><input class="inp" value="${esc(o.text)}" data-bind="other" data-i="${i}" data-f="text" ${edit?'':'disabled'}></td><td>${edit?`<button class="btn sm danger" data-act="delother" data-i="${i}">Remove</button>`:''}</td></tr>`).join('')||'<tr><td colspan="3" class="muted">No other examinations recorded.</td></tr>'}
 </tbody></table></div></section>
 <section class="panel"><div class="head"><h3>Reference checklist for ailments</h3></div><div class="lists">
 ${Object.values(GROUPS).map(gr=>`<div><h3>${gr.t}</h3><ol>${gr.i.map((x,i)=>`<li><b>${String.fromCharCode(97+i)}.</b>${x}</li>`).join('')}</ol></div>`).join('')}
 </div></section>`;
}

/* ---------- dental service ---------- */
const ORDER=[TEETH.pu,TEETH.pl,TEETH.tu,TEETH.tl];
const ALLT=[].concat(...ORDER);
function toothName(n){
 const q=Math.floor(n/10),k=n%10,temp=q>=5,qq=temp?q-4:q;
 const side=(qq===1||qq===4)?'right':'left',jaw=qq<=2?'Upper':'Lower';
 const nm=temp?['','central incisor','lateral incisor','canine','first molar','second molar']:['','central incisor','lateral incisor','canine','first premolar','second premolar','first molar','second molar','third molar'];
 return `${jaw} ${side} ${temp?'temporary ':''}${nm[k]}`;
}
function statusLabel(s){const o=STATUS_OPTS.find(q=>q[0]===(s||''));return o&&s?o[1]:'Not examined'}
function pushUndo(d){S.undo=S.undo||[];S.undo.push(JSON.stringify(d.teeth));if(S.undo.length>40)S.undo.shift()}
function setTooth(n,f,v,toggle){
 const d=stu(S.sid).dental;pushUndo(d);
 const t=(d.teeth[n]=d.teeth[n]||{s:'',a:'',n:''});
 if(toggle&&t[f]===v)v='';
 t[f]=v;
 if(f==='s'&&['X','F','F2'].includes(v)&&!t.n)t.n=v==='X'?'Extraction':'Filling';
 if(!t.s&&!t.a&&!t.n)delete d.teeth[n];
 if(!d.date)d.date=today();
 save();
}
function archPts(rx,ry,n,N){
 const pts=[];let len=0;
 for(let i=0;i<=N;i++){const th=Math.PI*(1-i/N),c=Math.cos(th),s=Math.sin(th);
  const x=rx*Math.sign(c)*Math.pow(Math.abs(c),2/n),y=ry*Math.pow(Math.abs(s),2/n);
  if(i)len+=Math.hypot(x-pts[i-1].x,y-pts[i-1].y);pts.push({x,y,len});}
 return {pts,len};
}
function toothDims(n,temp){
 const k=n%10;
 if(temp){const f=1.2;return k<=2?['inc',22*f,20*f]:k===3?['can',24*f,28*f]:['mol',34,32]}
 return k<=2?['inc',22,20]:k===3?['can',24,28]:k<=5?['pm',26,26]:k===8?['mol',32,30]:['mol',38,36];
}
function archScene(d){
 const temp=S.dlayer==='temp',cx=365,f=v=>v.toFixed(1);
 const rx=temp?165:215,ry=temp?118:150,NS=2.4;
 const jaws=[{up:true,arr:temp?TEETH.tu:TEETH.pu,base:345},{up:false,arr:temp?TEETH.tl:TEETH.pl,base:428}];
 let out='';
 jaws.forEach(J=>{
  const {pts,len}=archPts(rx,ry,NS,600),sy=y=>J.up?J.base-y:J.base+y;
  let gum='';for(let i=0;i<=600;i+=6)gum+=(i?'L':'M')+f(cx+pts[i].x)+' '+f(sy(pts[i].y));
  out+=`<path class="gum" d="${gum}" stroke-width="${temp?50:56}"/>`;
  const dims=J.arr.map(n=>toothDims(n,temp)),tot=dims.reduce((a,x)=>a+x[1],0),inset=14,avail=len-2*inset;let cum=0;
  J.arr.forEach((n,i)=>{
   const [kind,w,h]=dims[i],s=inset+(cum+w/2)/tot*avail;cum+=w;
   let j=pts.findIndex(p=>p.len>=s);if(j<1)j=1;if(j>599)j=599;
   const p=pts[j],a=pts[j-1],b=pts[j+1],dx=b.x-a.x,dy=b.y-a.y,nl=Math.hypot(dx,dy),nx=-dy/nl,ny=dx/nl;
   const ox=nx,oy=J.up?-ny:ny,x=cx+p.x,y=sy(p.y),rot=Math.atan2(ox,-oy)*180/Math.PI;
   const t=d.teeth[n]||{},s0=t.s||'',tone=toothTone(s0);
   const cls=['og',tone,s0==='O'?'miss':'',S.tooth===n?'sel':''].join(' ');
   const body=kind==='can'?`<path class="cr" d="M0 ${-h/2}C${w/2} ${-h/4} ${w/2} ${h/3} 0 ${h/2}C${-w/2} ${h/3} ${-w/2} ${-h/4} 0 ${-h/2}Z"/>`:`<rect class="cr" x="${-w/2}" y="${-h/2}" width="${w}" height="${h}" rx="${kind==='inc'?4:kind==='pm'?w/2.5:9}"/>`;
   const fis=(kind==='pm'||kind==='mol')?`<path class="fis" d="M${-w*.26} 0H${w*.26}M0 ${-h*.26}V${h*.26}"/>`:'';
   const inner=s0==='HS'?`<rect class="hs" x="-4.5" y="-4.5" width="9" height="9" rx="1.5"/>`:s0==='OF'?`<rect class="of" x="-4.5" y="-4.5" width="9" height="9" rx="1.5"/>`:'';
   const nd=h/2+14;
   out+=`<g class="${cls}" data-act="tooth" data-n="${n}" tabindex="0" role="button" aria-pressed="${S.tooth===n}" aria-label="Tooth ${n}, ${toothName(n)}, ${statusLabel(s0)}">
    <g transform="translate(${f(x)} ${f(y)}) rotate(${f(rot)})">${body}${fis}${inner}</g>
    ${s0&&s0!=='HS'&&s0!=='OF'?`<text class="sym" x="${f(x)}" y="${f(y)}">${esc(STATUS_SHOW[s0]||s0)}</text>`:''}
    ${t.a?`<circle class="acc" cx="${f(x+w/2-2)}" cy="${f(y-h/2+2)}" r="3.4"/>`:''}${t.n?`<circle class="need" cx="${f(x-w/2+2)}" cy="${f(y-h/2+2)}" r="3.4"/>`:''}
    <text class="num" x="${f(x+ox*nd)}" y="${f(y+oy*nd)}" text-anchor="middle" dominant-baseline="central">${n}</text></g>`;
  });
 });
 const U=temp?['55–51','61–65']:['18–11','21–28'],L=temp?['85–81','71–75']:['48–41','31–38'];
 const nm=temp?'PRIMARY':'';
 return `<svg class="odo" viewBox="0 100 730 530" role="group" aria-label="Arch odontogram, ${temp?'temporary':'permanent'} teeth">
  <line class="mid" x1="365" y1="150" x2="365" y2="590"/><text class="arch-l" x="365" y="140">MIDLINE</text>
  ${out}
  <text class="arch-l" x="365" y="305">UPPER · ${temp?'PRIMARY':'MAXILLARY'} ARCH</text><text class="arch-l" x="365" y="470">LOWER · ${temp?'PRIMARY':'MANDIBULAR'} ARCH</text>
  <text class="quad" x="24" y="122">UR · Upper Right (${U[0]})</text><text class="quad" x="706" y="122" text-anchor="end">UL · Upper Left (${U[1]})</text>
  <text class="quad" x="24" y="618">LR · Lower Right (${L[0]})</text><text class="quad" x="706" y="618" text-anchor="end">LL · Lower Left (${L[1]})</text></svg>`;
}
function toothTone(s){const o=STATUS_OPTS.find(q=>q[0]===(s||''));return o?o[2]:''}
function chartInner(d,edit){
 const mode=edit?(S.dmode||'inspect'):'inspect', c=countChart(d), br=S.brush||{};
 const chip=(f,v,label,tone,title)=>`<button type="button" class="chip ${tone||''}" data-act="brush" data-f="${f}" data-v="${esc(v)}" title="${esc(title||label)}" aria-pressed="${br.f===f&&br.v===v}">${esc(label)}</button>`;
 const t=S.tooth!=null?(d.teeth[S.tooth]||{}):null, dis=edit?'':'disabled';
 const palette=mode==='paint'?`<div class="trow"><span class="eyebrow">Status</span>${STATUS_OPTS.filter(o=>o[0]).map(o=>chip('s',o[0],STATUS_SHOW[o[0]]||o[0],o[2],o[1])).join('')}${chip('s','','Erase','','Erase status')}</div>
  <div class="trow"><span class="eyebrow">Accomplished</span>${ACC_OPTS.filter(Boolean).map(o=>chip('a',o,o,'info','Accomplishment: '+o)).join('')}</div>
  <div class="trow"><span class="eyebrow">Treatment need</span>${NEEDS.filter(Boolean).map(o=>chip('n',o,o,'warn')).join('')}</div>
  <div class="small muted">${br.f?'Click teeth to apply. Click the same value again to clear it.':'Pick a value above, then click teeth to apply it.'}</div>`:'';
 const insp=S.tooth==null?`<h3>No tooth selected</h3><p class="small muted" style="margin:0">Click a tooth on the chart to see and edit its details. Hover any tooth for its name.</p>`:
 `<div><div class="eyebrow">Tooth</div><div class="tno mono">${S.tooth}</div><div class="muted">${toothName(S.tooth)}</div></div>
  <div class="field"><label for="t-s">Status</label><select class="inp" id="t-s" data-bind="tooth" data-f="s" ${dis}>${STATUS_OPTS.map(o=>`<option value="${o[0]}" ${(t.s||'')===o[0]?'selected':''}>${esc(o[1])}</option>`).join('')}</select></div>
  <div class="field"><label for="t-a">Accomplishment</label><select class="inp" id="t-a" data-bind="tooth" data-f="a" ${dis}>${ACC_OPTS.map(o=>`<option value="${o}" ${(t.a||'')===o?'selected':''}>${o||'None'}</option>`).join('')}</select></div>
  <div class="field"><label for="t-n">Treatment need</label><select class="inp" id="t-n" data-bind="tooth" data-f="n" ${dis}>${NEEDS.map(o=>`<option value="${o}" ${(t.n||'')===o?'selected':''}>${o||'None'}</option>`).join('')}</select></div>
  <div class="trow">${edit?`<button class="btn sm" data-act="marksound1">Mark sound</button><button class="btn sm danger" data-act="cleartooth">Clear tooth</button>`:''}<button class="btn sm" data-act="tnav" data-d="-1" aria-label="Previous tooth">←</button><button class="btn sm" data-act="tnav" data-d="1" aria-label="Next tooth">→</button></div>
  ${edit?'<div class="small muted">Keys with a tooth focused: S sound, X extract, F fill, O missing, R root fragment, H filling, Delete clear, arrows move.</div>':''}`;
 const lay=S.dlayer==='temp'?'temp':'perm', list=lay==='temp'?TEETH.tu.concat(TEETH.tl):TEETH.pu.concat(TEETH.pl);
 const cnt={dam:0,mis:0,fil:0};list.forEach(n=>{const s=(d.teeth[n]||{}).s;if(['X','F','F2','RF'].includes(s))cnt.dam++;else if(s==='O')cnt.mis++;else if(s==='HS'||s==='OF')cnt.fil++});
 const healthy=Math.max(0,list.length-cnt.dam-cnt.mis-cnt.fil), D=lay==='temp'?'d':'D',M=lay==='temp'?'':'M',F=lay==='temp'?'f':'F';
 const tile=(cls,n,l)=>`<div class="sumtile ${cls}"><b>${n}</b><span>${l}</span></div>`;
 return `<div class="sumtiles">${tile('t-warn',cnt.dam,'Damaged')}${tile('t-ext',cnt.mis,'Extracted / missing')}${tile('t-fil',cnt.fil,'Filled')}${tile('t-ok',healthy,'Healthy')}
  <div class="sumtile t-dmft"><b>${cnt.dam+cnt.mis+cnt.fil}</b><span>${lay==='temp'?'dft':'DMFT'} index</span><small>${D}${cnt.dam} + ${lay==='temp'?'':M+cnt.mis+' + '}${F}${cnt.fil}</small></div></div>
 <div class="dtools">
  <div class="trow">${edit?`<div class="seg" role="group" aria-label="Mode"><button class="btn sm" data-act="dmode" data-v="inspect" aria-pressed="${mode==='inspect'}">Inspect</button><button class="btn sm" data-act="dmode" data-v="paint" aria-pressed="${mode==='paint'}">Paint</button></div>`:''}
   <div class="seg" role="group" aria-label="Dentition shown">${[['perm','Permanent teeth'],['temp','Temporary teeth']].map(x=>`<button class="btn sm" data-act="dlayer" data-v="${x[0]}" aria-pressed="${lay===x[0]}">${x[1]}</button>`).join('')}</div>
   ${edit?`<button class="btn sm" data-act="undo" ${(S.undo||[]).length?'':'disabled'}>Undo</button><button class="btn sm" data-act="marksound">Mark unexamined permanent teeth sound</button>`:''}</div>
  ${palette}</div>
 <div class="dgrid"><div class="dmain"><p class="small muted" style="margin:0 0 6px">Click any tooth to update its status, accomplishment and treatment need.</p><div class="tw">${archScene(d)}</div>
  <div class="legend-row"><span><i class="sw sw-ok"></i>Healthy</span><span><i class="sw sw-warn"></i>Damaged</span><span><i class="sw sw-ext"></i>Extracted / missing</span><span><i class="sw sw-fil"></i>Filled</span><span><i class="sw sw-acc"></i>Accomplished dot</span><span><i class="sw sw-need"></i>Needs treatment dot</span></div></div>
  <aside class="dside" aria-live="polite">${insp}</aside></div>`;
}
function refreshChart(focus){
 const el=$('#dchart');if(!el)return;const st=stu(S.sid),edit=P[S.user.role].dental==='edit';
 el.innerHTML=chartInner(st.dental,edit);
 if(focus&&S.tooth!=null){const g=document.querySelector(`.og[data-n="${S.tooth}"]`);if(g)g.focus({preventScroll:true})}
}
function dentalTab(st,edit){
 const d=st.dental, dis=edit?'':'disabled';
 const tc=n=>{const t=d.teeth[n]||{}, o=STATUS_OPTS.find(x=>x[0]===(t.s||''));
  return `<button class="tooth ${o?o[2]:''} ${t.n?'need':''} ${S.tooth===n?'sel':''}" data-act="tooth" data-n="${n}" aria-label="Tooth ${n}"><span>${n}</span><b>${esc(STATUS_SHOW[t.s]||t.s||'')}</b><span>${esc(t.a||'')}</span></button>`};
 const row=(arr,cut)=>`<div class="row-t">${arr.map((n,i)=>(i===cut?'<span class="gap"></span>':'')+tc(n)).join('')}</div>`;
 const sel=S.tooth!=null?(d.teeth[S.tooth]||{}):null;
 const ed=S.tooth==null?`<p class="small muted" style="margin:10px 0 0">Select a tooth to set its status and treatment need.</p>`:
 `<div class="editor"><div><div class="eyebrow">Tooth</div><b class="mono" style="font-size:20px">${S.tooth}</b></div>
  <div class="field"><label for="t-s">Status (mouth examination)</label><select class="inp" id="t-s" data-bind="tooth" data-f="s" ${dis}>${STATUS_OPTS.map(o=>`<option value="${o[0]}" ${(sel.s||'')===o[0]?'selected':''}>${esc(o[1])}</option>`).join('')}</select></div>
  <div class="field"><label for="t-a">Accomplishment</label><select class="inp" id="t-a" data-bind="tooth" data-f="a" ${dis}>${ACC_OPTS.map(o=>`<option value="${o}" ${(sel.a||'')===o?'selected':''}>${o||'None'}</option>`).join('')}</select></div>
  <div class="field"><label for="t-n">Treatment need</label><select class="inp" id="t-n" data-bind="tooth" data-f="n" ${dis}>${NEEDS.map(o=>`<option value="${o}" ${(sel.n||'')===o?'selected':''}>${o||'None'}</option>`).join('')}</select></div></div>`;
 const hdr='<th></th>'+['1st','2nd','3rd','4th','5th','6th'].map(x=>`<th>${x} visit</th>`).join('');
 const vi=(k,i,f)=>`<td><input class="inp" ${f==='date'?'type="date"':'type="number" min="0"'} value="${esc(d.visits[k][i][f])}" data-bind="visit" data-k="${k}" data-i="${i}" data-f="${f}" ${dis} aria-label="${f} visit ${i+1}"></td>`;
 const tot=(k,i,m)=>`<td class="mono" id="${m}-${k}-${i}">${visitTotal(d,k,i,m)}</td>`;
 const six=[0,1,2,3,4,5];
 const fillrow=k=>edit?`<tr><td>Count from chart</td>${six.map(i=>`<td><button class="btn sm" data-act="fillvisit" data-k="${k}" data-i="${i}">Use chart</button></td>`).join('')}</tr>`:'';
 const lg=(t,rows)=>`<div class="panel" style="padding:0"><div class="tw"><table><thead><tr><th colspan="2">${t}</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`).join('')}</tbody></table></div></div>`;
 return `<section class="panel"><div class="head"><div><h3>Dentition status and treatment needs</h3><div class="small muted">Right to left as the dentist faces the learner.</div></div>
  <div class="field"><label for="d-date">Date examined</label><input class="inp" id="d-date" type="date" value="${esc(d.date)}" data-bind="ddate" ${dis}></div></div>
  <div id="dchart">${chartInner(d,edit)}</div></section>
 <section class="panel"><div class="head"><h3>Treatment record</h3>${edit?'<button class="btn sm" data-act="addtreat">Add treatment</button>':''}</div>
  <div class="tw"><table><thead><tr><th>Date</th><th>Tooth no.</th><th>Nature of operation</th><th>Dentist</th><th></th></tr></thead><tbody>
  ${d.treat.map((t,i)=>`<tr><td><input class="inp" type="date" value="${esc(t.date)}" data-bind="treat" data-i="${i}" data-f="date" ${dis}></td><td><input class="inp mono" style="width:80px" value="${esc(t.tooth)}" data-bind="treat" data-i="${i}" data-f="tooth" ${dis}></td><td><input class="inp" value="${esc(t.op)}" data-bind="treat" data-i="${i}" data-f="op" ${dis}></td><td><input class="inp" value="${esc(t.dentist)}" data-bind="treat" data-i="${i}" data-f="dentist" ${dis}></td><td>${edit?`<button class="btn sm danger" data-act="deltreat" data-i="${i}">Remove</button>`:''}</td></tr>`).join('')||'<tr><td colspan="5" class="muted">No treatments recorded.</td></tr>'}
  </tbody></table></div></section>
 <section class="panel"><div class="head"><h3>Visit summaries and indices</h3></div>
  <div class="eyebrow" style="margin-bottom:6px">Temporary teeth (index d.f.t.)</div>
  <div class="tw"><table class="vis"><thead><tr>${hdr}</tr></thead><tbody>
   <tr><td>Date of visit</td>${six.map(i=>vi('t',i,'date')).join('')}</tr>
   <tr><td>No. T/decayed</td>${six.map(i=>vi('t',i,'d')).join('')}</tr>
   <tr><td>No. T/filled</td>${six.map(i=>vi('t',i,'f')).join('')}</tr>
   <tr><td>Total d.f.t.</td>${six.map(i=>tot('t',i,'tt')).join('')}</tr>${fillrow('t')}
  </tbody></table></div>
  <div class="eyebrow" style="margin:16px 0 6px">Permanent teeth (index D.M.F.T.)</div>
  <div class="tw"><table class="vis"><thead><tr>${hdr}</tr></thead><tbody>
   <tr><td>Date of visit</td>${six.map(i=>vi('p',i,'date')).join('')}</tr>
   <tr><td>No. T/decayed</td>${six.map(i=>vi('p',i,'d')).join('')}</tr>
   <tr><td>No. T/missing</td>${six.map(i=>vi('p',i,'m')).join('')}</tr>
   <tr><td>No. T/filled</td>${six.map(i=>vi('p',i,'f')).join('')}</tr>
   <tr><td>Total D.M.F.T.</td>${six.map(i=>tot('p',i,'tt')).join('')}</tr>
   <tr><td>Total sound teeth</td>${six.map(i=>tot('p',i,'ts')).join('')}</tr>${fillrow('p')}
  </tbody></table></div></section>
 <section class="panel"><div class="head"><h3>Symbols and legend guide</h3></div><div class="legend">
  ${lg('Symbols for mouth examination',LEG_MOUTH)}${lg('Artificial restoration',LEG_ART)}${lg('Symbols for accomplishment',LEG_ACC)}</div></section>`;
}
function visitTotal(d,k,i,m){
 const v=d.visits[k][i], n=x=>parseInt(x)||0, any=v.date||v.d||v.f||v.m;
 if(!any)return '';
 if(k==='t')return n(v.d)+n(v.f);
 const t=n(v.d)+n(v.m)+n(v.f); return m==='ts'?Math.max(0,32-t):t;
}

/* ---------- teacher dashboard ---------- */
function teacherView(){
 const adv=secOf(S.user.adv), sy=S.sy;
 const mine=DB.students.filter(s=>{const e=enrOf(s,sy);return e&&e.section===adv.id});
 const exD=mine.filter(s=>examDone(s,adv.grade)).length, dnD=mine.filter(dentalDone).length;
 const L=S.tr||{lrn:'',dest:''};
 return `<div class="head"><div><div class="eyebrow">Advisory · ${esc(trackLabel(adv))}</div><h2>${esc(secLabel(adv))}</h2></div>
  <div class="field"><label for="sy">School year</label><select class="inp" id="sy" data-bind="sy">${SYS.map(y=>`<option ${sy===y?'selected':''}>${y}</option>`).join('')}</select></div></div>
 <div class="tiles"><div class="tile"><span class="eyebrow">Learners</span><b>${mine.length}</b></div>
  <div class="tile"><span class="eyebrow">Exam cards</span><b>${exD}/${mine.length}</b></div>
  <div class="tile"><span class="eyebrow">Dental charts</span><b>${dnD}/${mine.length}</b></div>
  <div class="tile"><span class="eyebrow">Files on record</span><b>${mine.reduce((a,s)=>a+s.files.filter(f=>f.sy===sy&&f.date).length,0)}</b></div></div>
 <section class="panel" style="padding:0"><div class="tw"><table><thead><tr><th>Learner</th><th>LRN</th><th>Exam card</th><th>Dental</th><th>Files</th></tr></thead><tbody>
 ${mine.map(s=>{const fl=s.files.filter(f=>f.sy===sy);return `<tr class="click" data-act="open" data-id="${s.id}" data-tab="exam"><td><div class="who-cell">${av(s)}<b>${esc(fullName(s))}</b></div></td><td class="mono">${s.lrn}</td><td>${examDone(s,adv.grade)?pill('Complete','good'):pill('Pending','warn')}</td><td>${dentalDone(s)?pill('Charted','good'):pill('Pending','warn')}</td><td>${fl.filter(f=>f.date).length}/${fl.length}</td></tr>`}).join('')||`<tr><td colspan="5" class="muted">No learners were in this advisory for ${sy}.</td></tr>`}
 </tbody></table></div></section>
 <section class="panel"><div class="head"><div><h3>Transfer a student record</h3><div class="small muted">Enter the learner's LRN. The whole health record moves with them for ${sy}.</div></div></div>
  <div class="filters"><div class="field" style="flex:1 1 200px"><label for="tr-lrn">LRN</label><input class="inp mono" id="tr-lrn" inputmode="numeric" maxlength="12" placeholder="12-digit LRN, e.g. 110001000001" value="${esc(L.lrn)}" data-bind="trlrn"></div>
  <div class="field" style="flex:1 1 220px"><label for="tr-dest">Move to</label><select class="inp" id="tr-dest" data-bind="trdest">${SECT_UI.map(s=>`<option value="${s.id}" ${(L.dest||adv.id)===s.id?'selected':''}>${esc(secLabel(s))}${s.id===adv.id?' (my advisory)':''}</option>`).join('')}</select></div></div>
  <div id="trprev" class="ro" style="margin:12px 0">${trPreview()}</div>
  <button class="btn primary" data-act="transfer">Transfer record</button></section>
 ${DB.transfers.length?`<section class="panel"><div class="head"><h3>Transfer log</h3></div><div class="tw"><table><thead><tr><th>When</th><th>Learner</th><th>LRN</th><th>From</th><th>To</th><th>SY</th></tr></thead><tbody>${DB.transfers.slice().reverse().map(t=>`<tr><td class="mono">${esc(t.when)}</td><td>${esc(t.name)}</td><td class="mono">${t.lrn}</td><td>${esc(t.from)}</td><td>${esc(t.to)}</td><td class="mono">${t.sy}</td></tr>`).join('')}</tbody></table></div></section>`:''}`;
}
function trPreview(){
 const L=S.tr||{lrn:''}; if(!L.lrn)return 'Type a LRN to find the learner.';
 const st=DB.students.find(s=>s.lrn===L.lrn.trim()); if(!st)return L.lrn.length<12?'Keep typing, LRN has 12 digits.':'No learner has this LRN.';
 const e=enrOf(st,S.sy); return e?`Found ${esc(fullName(st))}, now in ${esc(secLabel(secOf(e.section)))} for ${S.sy}.`:`Found ${esc(fullName(st))}, not enrolled in ${S.sy}.`;
}
function doTransfer(){
 const L=S.tr||{lrn:'',dest:''}, adv=S.user.adv, dest=L.dest||adv;
 const st=DB.students.find(s=>s.lrn===(L.lrn||'').trim());
 if(!st)return toast('No learner has this LRN.');
 const e=enrOf(st,S.sy); if(!e)return toast('This learner is not enrolled for '+S.sy+'.');
 if(e.section===dest)return toast('The record is already in that section.');
 if(e.section!==adv&&dest!==adv)return toast('You can only send out your own learners or move one into your advisory.');
 DB.transfers.push({when:new Date().toISOString().slice(0,16).replace('T',' '),name:fullName(st),lrn:st.lrn,from:secLabel(secOf(e.section)),to:secLabel(secOf(dest)),sy:S.sy});
 e.section=dest; save(); S.tr={lrn:'',dest}; toast('Record transferred'); render();
}

/* ---------- my account ---------- */
function accountView(){
 const a=DB.accounts.find(x=>x.id===S.user.id);
 return `<div class="head"><div class="who-cell"><img class="role-ic lg" src="${ROLE_ICON[a.role]}" alt=""><div><div class="eyebrow">${a.role}</div><h2>My account</h2></div></div></div>
 <section class="panel" style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin-bottom:14px">
  <img class="role-ic lg" style="width:88px;height:88px;object-fit:cover" src="${a.photo||ROLE_ICON[a.role]}" alt="Your profile picture">
  <div style="display:grid;gap:8px"><h3 style="margin:0">Profile picture</h3><div class="small muted">Shown in the top bar. JPG or PNG.</div>
   <div class="trow"><button class="btn sm primary" type="button" data-act="pickaccphoto">${a.photo?'Change picture':'Upload picture'}</button>${a.photo?'<button class="btn sm" type="button" data-act="rmaccphoto">Remove</button>':''}</div>
   <input type="file" id="acc-photo" accept="image/*" hidden data-bind="accphoto"></div></section>
 ${gmailPanel(a)}
 <div class="grid2">
 <form class="panel" id="acctform" style="display:grid;gap:12px;align-content:start"><h3>Sign-in details</h3>
  <div class="field"><label>Name</label><input class="inp" value="${esc(a.name)}" disabled></div>
  <div class="field"><label for="ac-u">Username</label><input class="inp" id="ac-u" value="${esc(a.username)}" autocapitalize="off" required></div>
  <div class="field"><label for="ac-e">Email</label><input class="inp" id="ac-e" type="email" value="${esc(a.email)}" required></div>
  <div id="ac-msg" class="small" role="status"></div><div><button class="btn primary" type="submit">Save details</button></div></form>
 <form class="panel" id="pwform" style="display:grid;gap:12px;align-content:start"><h3>Change password</h3>
  <div class="field"><label for="pw-c">Current password</label><input class="inp" id="pw-c" type="password" autocomplete="current-password" required></div>
  <div class="field"><label for="pw-n">New password</label><input class="inp" id="pw-n" type="password" autocomplete="new-password" minlength="8" required><div class="small muted">At least 8 characters.</div></div>
  <div class="field"><label for="pw-r">Repeat new password</label><input class="inp" id="pw-r" type="password" autocomplete="new-password" required></div>
  <div id="pw-msg" class="small" role="status"></div><div><button class="btn primary" type="submit">Change password</button></div></form>
 </div>`;
}
function gmailPanel(a){
 if(!CLOUD_ON)return '';
 const g=S.gm||{};
 const msg=(g.err?`<div class="pill bad" role="alert" style="white-space:normal">${esc(g.err)}</div>`:'')+(g.ok?`<div class="pill good" role="status" style="white-space:normal">${esc(g.ok)}</div>`:'');
 let body;
 if(a.gmail_ok&&g.unlink)body=`<form id="gm-unlink" style="display:grid;gap:10px"><div class="small muted">Enter your password to remove the Gmail. Logins will go back to password only.</div><div class="field"><label for="gm-pw">Password</label><input class="inp" id="gm-pw" type="password" autocomplete="current-password" required></div>${msg}<div class="trow"><button class="btn primary" type="submit">Remove Gmail</button><button class="btn" type="button" data-act="gmcancel">Cancel</button></div></form>`;
 else if(a.gmail_ok)body=`<div class="who-cell"><span class="pill good">Confirmed</span><b>${esc(a.gmail)}</b></div><div class="small muted">A 6-digit code is emailed to this Gmail every time you log in.</div>${msg}<div><button class="btn sm" type="button" data-act="gmunlinkask">Remove Gmail</button></div>`;
 else if(g.sent)body=`<form id="gm-code" style="display:grid;gap:10px"><div class="small muted">Enter the 6-digit code we emailed to <b>${esc(g.hint||g.email)}</b>.</div><div class="field"><label for="gm-c">Confirmation code</label><input class="inp mono" id="gm-c" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" required style="letter-spacing:4px"></div>${msg}<div class="trow"><button class="btn primary" type="submit">Confirm Gmail</button><button class="btn" type="button" data-act="gmcancel">Start over</button></div></form>`;
 else body=`<form id="gm-send" style="display:grid;gap:10px"><div class="small muted">Link your own Gmail to protect this account. After that, every login needs a 6-digit code sent to it.</div><div class="field"><label for="gm-e">Your Gmail address</label><input class="inp" id="gm-e" type="email" placeholder="name@gmail.com" value="${esc(g.email||'')}" required autocapitalize="off"></div>${msg}<div><button class="btn primary" type="submit">Send confirmation code</button></div></form>`;
 return `<section class="panel" style="margin-bottom:14px;display:grid;gap:10px"><h3 style="margin:0">Gmail confirmation ${a.gmail_ok?'':'<span class="pill warn">Not set up</span>'}</h3>${body}</section>`}
function accMsg(id,m,ok){const e=$('#'+id);e.textContent=m;e.style.color=ok?'var(--good)':'var(--bad)'}

/* ---------- photo cropper: move and zoom before saving ---------- */
function openCropper(file,done){
 if(!file)return;
 if(!/^image\//.test(file.type))return toast('Choose an image file (JPG or PNG).');
 if(file.size>15*1024*1024)return toast('That image is too large. Choose one under 15 MB.');
 const url=URL.createObjectURL(file),img=new Image();
 img.onerror=()=>{URL.revokeObjectURL(url);toast('That image could not be read.')};
 img.onload=()=>{
  const V=260,w=img.naturalWidth,h=img.naturalHeight,b=Math.max(V/w,V/h);let z=1,ox=(V-w*b)/2,oy=(V-h*b)/2;
  const ov=document.createElement('div');ov.className='crop-ov';ov.setAttribute('role','dialog');ov.setAttribute('aria-label','Adjust your picture');
  ov.innerHTML='<div class="crop-box"><h3>Adjust your picture</h3><div class="small muted" style="justify-self:start">Drag the picture to move it. Use the slider or mouse wheel to zoom.</div><div class="crop-vp" id="cvp"><img alt=""></div><div class="crop-zoom"><span class="small muted">Zoom</span><input type="range" id="czoom" min="1" max="4" step="0.01" value="1" aria-label="Zoom"></div><div class="crop-act"><button class="btn" type="button" id="ccancel">Cancel</button><button class="btn primary" type="button" id="csave">Save picture</button></div></div>';
  document.body.appendChild(ov);
  const vp=ov.querySelector('#cvp'),im=vp.querySelector('img');im.src=url;
  const clamp=()=>{const k=b*z;ox=Math.min(0,Math.max(V-w*k,ox));oy=Math.min(0,Math.max(V-h*k,oy))};
  const draw=()=>{clamp();const k=b*z;im.style.width=w*k+'px';im.style.height=h*k+'px';im.style.transform='translate('+ox+'px,'+oy+'px)'};
  const setZ=nz=>{const k0=b*z,cx=(V/2-ox)/k0,cy=(V/2-oy)/k0;z=Math.min(4,Math.max(1,nz));const k=b*z;ox=V/2-cx*k;oy=V/2-cy*k;ov.querySelector('#czoom').value=z;draw()};
  draw();
  let drag=null;
  vp.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,ox,oy};vp.setPointerCapture(e.pointerId)});
  vp.addEventListener('pointermove',e=>{if(!drag)return;ox=drag.ox+(e.clientX-drag.x);oy=drag.oy+(e.clientY-drag.y);draw()});
  const end=()=>{drag=null};vp.addEventListener('pointerup',end);vp.addEventListener('pointercancel',end);
  vp.addEventListener('wheel',e=>{e.preventDefault();setZ(z+(e.deltaY<0?.1:-.1))},{passive:false});
  ov.querySelector('#czoom').addEventListener('input',e=>setZ(+e.target.value));
  const close=()=>{URL.revokeObjectURL(url);ov.remove();document.removeEventListener('keydown',onKey)};
  const onKey=e=>{if(e.key==='Escape')close()};document.addEventListener('keydown',onKey);
  ov.addEventListener('pointerdown',e=>{if(e.target===ov)close()});
  ov.querySelector('#ccancel').onclick=close;
  ov.querySelector('#csave').onclick=()=>{
   const cv=document.createElement('canvas');cv.width=cv.height=240;const f=240/V,k=b*z,c=cv.getContext('2d');
   c.fillStyle='#fff';c.fillRect(0,0,240,240);c.drawImage(img,0,0,w,h,ox*f,oy*f,w*k*f,h*k*f);
   let p;try{p=cv.toDataURL('image/jpeg',.88)}catch(e){return toast('That image could not be read.')}
   close();done(p)};
  ov.querySelector('#csave').focus()};
 img.src=url}
/* ---------- student photo (teacher) ---------- */
function setPhoto(file){
 const sid=S.sid,st=stu(sid);if(!file||!st||S.user.role!=='Teacher')return;
 openCropper(file,p=>{const s=stu(sid);if(!s)return;s.photo=p;save();toast('Photo updated');render()})
}
function rpcGmSend(em){
 sendCode('link',TOK,em).then(r=>{S.gm={email:em,sent:true,hint:r.hint,ok:'Code sent to '+r.hint+'. It works for 10 minutes.'};render();const i=$('#gm-c');if(i)i.focus()})
  .catch(x=>{S.gm={email:em,err:cloudErr(x)};render()})}
/* ---------- my profile picture (all staff) ---------- */
function setAccPhoto(file,remove){
 const a=DB.accounts.find(x=>x.id===S.user.id);if(!a)return;
 const done=p=>{if(p)a.photo=p;else delete a.photo;S.user.photo=p||null;toast(p?'Profile picture updated':'Profile picture removed');render()};
 const store=p=>{if(CLOUD_ON)rpc('app_set_photo',{p_token:TOK,p_photo:p}).then(()=>done(p)).catch(e=>toast(cloudErr(e)));else{done(p);save()}};
 if(remove)return store(null);
 openCropper(file,store)}
/* ---------- record of files + export (teacher) ---------- */
S.sel=new Set();S.lrnText='';S.lrnMsg='';
function filesFor(st,sy){
 return FILE_KINDS.map(k=>{
  const f=st.files.find(x=>x.sy===sy&&x.name===k);let date=f?f.date:'';
  if(k==='Dental Record'&&sy===CUR_SY&&st.dental&&st.dental.date)date=st.dental.date;
  const missing=!date&&(f||(k==='Dental Record'&&sy===CUR_SY));
  return {name:k,date,status:date?'On file':missing?'Missing':'Not filed'};
 });
}
const advList=()=>DB.students.filter(s=>{const e=enrOf(s,S.sy);return e&&e.section===S.user.adv});
const exportList=()=>advList().filter(s=>!S.sel.size||S.sel.has(s.id));
const safeName=s=>String(s).replace(/[^A-Za-z0-9._-]+/g,'_').replace(/^_+|_+$/g,'');
function filesView(){
 const adv=secOf(S.user.adv),list=advList(),ex=exportList(),sy=S.sy;
 const stPill=s=>s==='On file'?pill(s,'good'):s==='Missing'?pill(s,'warn'):pill('Not filed','mute');
 const rows=list.map(s=>{const fl=filesFor(s,sy),n=fl.filter(x=>x.date).length;
  return `<tr><td><input type="checkbox" data-act="sel" data-id="${s.id}" ${S.sel.has(s.id)?'checked':''} aria-label="Select ${esc(fullName(s))}"></td>
  <td><div class="who-cell">${av(s)}<a href="#" class="plain" data-act="open" data-id="${s.id}" data-tab="profile"><b>${esc(fullName(s))}</b></a></div></td><td class="mono">${s.lrn}</td>
  ${fl.map(x=>`<td>${stPill(x.status)}${x.date?`<div class="small muted mono">${x.date}</div>`:''}</td>`).join('')}
  <td class="mono">${n}/${fl.length}</td><td><button class="btn sm" data-act="exportone" data-id="${s.id}">Download record</button></td></tr>`}).join('');
 return `<div class="head"><div><div class="eyebrow">${esc(secLabel(adv))} · ${esc(trackLabel(adv))}</div><h2>Record of files</h2></div>
  <div class="field"><label for="sy">School year</label><select class="inp" id="sy" data-bind="sy">${SYS.map(y=>`<option ${sy===y?'selected':''}>${y}</option>`).join('')}</select></div></div>
 <section class="panel"><div class="head"><div><h3>Export</h3><div class="small muted">Pick learners in the table, or add them by LRN. With nothing picked, the whole advisory is exported.</div></div></div>
  <div class="filters"><div class="field" style="flex:2 1 280px"><label for="lrns">Add learners by LRN</label><input class="inp mono" id="lrns" data-bind="lrntext" placeholder="One or more 12-digit LRNs, e.g. 110001000001 110001000002" value="${esc(S.lrnText)}"></div>
   <div class="field" style="flex:0 0 auto;align-self:flex-end"><button class="btn" data-act="addlrn">Add</button></div></div>
  ${S.lrnMsg?`<div class="small" style="margin-top:8px;color:var(--muted)" role="status">${esc(S.lrnMsg)}</div>`:''}
  <div class="ro" style="margin:12px 0">${S.sel.size?`${ex.length} selected learner(s) will be exported.`:`All ${list.length} learner(s) in this advisory will be exported.`}${S.sel.size?' <button class="btn sm" data-act="selclear" style="margin-left:8px">Clear selection</button>':''}</div>
  <div class="trow"><button class="btn primary" data-act="exportpdf" ${ex.length?'':'disabled'}>Download record of files (PDF)</button><button class="btn" data-act="exporthtml" ${ex.length?'':'disabled'}>Download full health records (HTML)</button></div></section>
 <section class="panel" style="padding:0"><div class="tw"><table class="wrapth"><thead><tr><th><input type="checkbox" data-act="selall" ${list.length&&S.sel.size===list.length?'checked':''} aria-label="Select all"></th><th>Learner</th><th>LRN</th>${FILE_KINDS.map(k=>`<th>${esc(k)}</th>`).join('')}<th>On file</th><th></th></tr></thead><tbody>
 ${rows||`<tr><td colspan="9" class="muted">No learners were in this advisory for ${sy}.</td></tr>`}</tbody></table></div></section>`;
}
function browserSave(filename,data){
 const type=/\.pdf$/i.test(filename)?'application/pdf':/\.html$/i.test(filename)?'text/html':'application/octet-stream';
 const blob=data instanceof Blob?data:new Blob([data],{type}),u=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=u;a.download=filename;a.style.display='none';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),5000);
 toast('Downloaded '+filename);
}
async function saveFile(filename,data){
 let dl=null;try{dl=window.claude&&await claude.use('downloads')}catch(e){}
 if(!dl)return browserSave(filename,data);
 try{await dl.save({filename,data});toast('Ready to save '+filename)}
 catch(e){const c=e&&e.code;if(c==='declined')return;
  if(['unavailable','not_granted','capability_disabled','capability_removed'].includes(c))return browserSave(filename,data);
  toast('Could not save the file ('+(c||'error')+').')}
}
/* ---------- minimal PDF writer (no libraries) ---------- */
function pdfBuild(pages,W,H){
 const enc=s=>{let o='';for(const ch of String(s)){const c=ch.charCodeAt(0);o+=c<256?ch:'?'}return o};
 const objs=[],add=s=>{objs.push(s);return objs.length};
 add('<< /Type /Catalog /Pages 2 0 R >>');
 add('<< /Type /Pages /Kids ['+pages.map((_,i)=>(5+2*i)+' 0 R').join(' ')+'] /Count '+pages.length+' >>');
 add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
 add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
 pages.forEach((c,i)=>{
  add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6+2*i} 0 R >>`);
  const s=enc(c);add(`<< /Length ${s.length} >>\nstream\n${s}\nendstream`);
 });
 let out='%PDF-1.4\n',off=[];
 objs.forEach((o,i)=>{off.push(out.length);out+=`${i+1} 0 obj\n${o}\nendobj\n`});
 const x=out.length;
 out+=`xref\n0 ${objs.length+1}\n0000000000 65535 f \n`+off.map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size ${objs.length+1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`;
 const u=new Uint8Array(out.length);for(let i=0;i<out.length;i++)u[i]=out.charCodeAt(i)&255;
 return new Blob([u],{type:'application/pdf'});
}
function exportPDF(){
 const adv=secOf(S.user.adv),ex=exportList(),sy=S.sy,W=842,H=595,M=40;
 const esc2=t=>String(t).replace(/[\\()]/g,'\\$&');
 const col=[22,84,128,112,112,112,112,50];
 const heads=[['#'],['LRN'],['Learner'],['School Health','Examination Card'],['Dental','Record'],['Immunization','Card'],['Parental','Consent Form'],['On file']];
 const X=[];col.reduce((a,w,i)=>(X[i]=a,a+w),M);
 const GREEN=[.114,.455,.267],AMBER=[.6,.34,0],GRAY=[.45,.5,.52],INK=[.06,.16,.18],TEAL=[.043,.498,.51];
 const pagesOps=[];let ops,y;
 const T=(x,yy,s,sz,bold,c)=>{ops.push(`BT /${bold?'F2':'F1'} ${sz} Tf ${(c||INK).join(' ')} rg ${x.toFixed(1)} ${(H-yy).toFixed(1)} Td (${esc2(enc0(s))}) Tj ET`)};
 const enc0=s=>String(s);
 const R=(x,yy,w,h,c)=>ops.push(`${c.join(' ')} rg ${x.toFixed(1)} ${(H-yy-h).toFixed(1)} ${w} ${h} re f`);
 const LN=(yy)=>ops.push(`0.8 0.85 0.86 RG 0.5 w ${M} ${(H-yy).toFixed(1)} m ${W-M} ${(H-yy).toFixed(1)} l S`);
 const header=()=>{R(M,y,W-2*M,34,TEAL);heads.forEach((h,i)=>h.forEach((ln,k)=>T(X[i]+5,y+(h.length>1?14:21)+k*11,ln,8.5,true,[1,1,1])));y+=34};
 const newPage=first=>{ops=[];pagesOps.push(ops);y=first?0:M;
  if(first){T(M,48,'Record of Files',20,true,INK);
   T(M,66,`${secLabel(adv)} (${trackLabel(adv)})  |  School year ${sy}  |  Adviser: ${S.user.name}`,9.5,false,GRAY);
   T(M,80,`Generated ${new Date().toISOString().slice(0,10)}  |  ${ex.length} learner${ex.length===1?'':'s'}  |  Confidential student health information`,9.5,false,GRAY);y=96}
  header()};
 newPage(true);
 const RH=30;
 ex.forEach((s,i)=>{
  if(y+RH>H-50)newPage(false);
  if(i%2)R(M,y,W-2*M,RH,[.95,.97,.97]);
  const fl=filesFor(s,sy),n=fl.filter(f=>f.date).length;
  T(X[0]+5,y+18,String(i+1),9,false,GRAY);T(X[1]+5,y+18,s.lrn,9,false,INK);
  T(X[2]+5,y+18,fullName(s).slice(0,28),9,true,INK);
  fl.forEach((f,k)=>{const c=f.status==='On file'?GREEN:f.status==='Missing'?AMBER:GRAY;
   T(X[3+k]+5,y+(f.date?13:18),f.status,9,f.status!=='Not filed',c);if(f.date)T(X[3+k]+5,y+24,f.date,8,false,GRAY)});
  T(X[7]+5,y+18,n+'/'+fl.length,9,false,INK);
  y+=RH;LN(y);
 });
 pagesOps.forEach((o,i)=>{ops=o;T(M,H-24,'EduHealthHub',8,true,GRAY);T(W-M-60,H-24,`Page ${i+1} of ${pagesOps.length}`,8,false,GRAY)});
 const blob=pdfBuild(pagesOps.map(o=>o.join('\n')),W,H);
 saveFile(`Record-of-Files_${safeName(secLabel(adv))}_${sy}.pdf`,blob);
}
function recordHTML(list,sy){
 const e=esc,gen=new Date().toISOString().slice(0,10);
 const one=s=>{
  const en=enrOf(s,sy),sec=secOf(en.section),fl=filesFor(s,sy);
  const exRows=EXAM_FIELDS.map(f=>`<tr><th>${e(f[1])}</th>${[11,12].map(G=>{const v=(s.exam[G]||{})[f[0]]||'';const dc=f[2]==='code'&&v?decode(f,v).txt:'';return `<td>${e(v)}${dc?`<div class="s">${e(dc)}</div>`:''}</td>`}).join('')}</tr>`).join('');
  const d=s.dental,c=countChart(d);
  const teeth=ALLT.filter(n=>d.teeth[n]&&(d.teeth[n].s||d.teeth[n].a||d.teeth[n].n)).map(n=>{const t=d.teeth[n];return `<tr><td>${n}</td><td>${e(toothName(n))}</td><td>${e(statusLabel(t.s))}</td><td>${e(t.a||'')}</td><td>${e(t.n||'')}</td></tr>`}).join('');
  return `<section class="stu">${s.photo?`<img src="${s.photo}" alt="" style="float:right;width:84px;height:84px;object-fit:cover;border-radius:10px">`:''}<h2>${e(fullName(s))}</h2>
  <p class="meta">LRN ${s.lrn} · ${e(secLabel(sec))} (${e(trackLabel(sec))}) · School year ${sy}</p>
  <table class="kv"><tr><th>Sex</th><td>${e(s.sex)}</td><th>Birthdate</th><td>${e(s.birth)}</td></tr><tr><th>Parent / guardian</th><td>${e(s.guardian)}</td><th>Contact</th><td>${e(s.contact)}</td></tr><tr><th>Blood type</th><td>${e(s.blood)}</td><th>Allergies</th><td>${e(s.allergies)}</td></tr><tr><th>Known conditions</th><td colspan="3">${e(s.conditions)}</td></tr></table>
  <h3>Record of files</h3><table><tr><th>File</th><th>Status</th><th>Filed on</th></tr>${fl.map(f=>`<tr><td>${e(f.name)}</td><td>${f.status}</td><td>${f.date||''}</td></tr>`).join('')}</table>
  <h3>School health examination</h3><table><tr><th>Examination</th><th>Grade 11</th><th>Grade 12</th></tr>${exRows}</table>
  <h3>Other examinations</h3>${s.otherExams.length?`<table><tr><th>Date</th><th>Result</th></tr>${s.otherExams.map(o=>`<tr><td>${e(o.date)}</td><td>${e(o.text)}</td></tr>`).join('')}</table>`:'<p class="s">None recorded.</p>'}
  <h3>Dental service</h3><p>Date examined: ${e(d.date||'not yet examined')} · Permanent teeth: D ${c.p.d}, M ${c.p.m}, F ${c.p.f}, DMFT ${c.p.d+c.p.m+c.p.f} · Temporary teeth: d ${c.t.d}, f ${c.t.f}</p>
  ${teeth?`<table><tr><th>Tooth</th><th>Name</th><th>Status</th><th>Accomplished</th><th>Treatment need</th></tr>${teeth}</table>`:'<p class="s">No tooth findings recorded.</p>'}
  ${d.treat.length?`<h3>Treatment record</h3><table><tr><th>Date</th><th>Tooth</th><th>Operation</th><th>Dentist</th></tr>${d.treat.map(t=>`<tr><td>${e(t.date)}</td><td>${e(t.tooth)}</td><td>${e(t.op)}</td><td>${e(t.dentist)}</td></tr>`).join('')}</table>`:''}</section>`;
 };
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>EduHealthHub student health records</title><style>
 body{font:14px/1.5 system-ui,Segoe UI,sans-serif;color:#10282e;margin:0;padding:24px;max-width:860px;margin-inline:auto}
 h1{font-size:20px;margin:0 0 4px}h2{font-size:22px;margin:0}h3{font-size:14px;margin:18px 0 6px;text-transform:uppercase;letter-spacing:.06em;color:#0b6f72}
 table{border-collapse:collapse;width:100%;margin:4px 0}th,td{border:1px solid #c9d8d8;padding:5px 8px;text-align:left;vertical-align:top}th{background:#eef5f5;font-weight:600}
 .meta,.s{color:#51676c;font-size:12px;margin:2px 0}.kv th{width:18%}.stu{page-break-before:always;padding-top:8px}.stu:first-of-type{page-break-before:auto}
 header{border-bottom:2px solid #0b7f82;padding-bottom:10px;margin-bottom:12px}</style></head><body>
 <header><h1>EduHealthHub · Student health records</h1><div class="meta">${e(secLabel(secOf(S.user.adv)))} · School year ${sy} · Generated ${gen} by ${e(S.user.name)} · ${list.length} learner(s). Confidential health information.</div></header>
 ${list.map(one).join('')}</body></html>`;
}
function exportHTML(list){
 const sy=S.sy,adv=secOf(S.user.adv);
 const name=list.length===1?`Health-Record_${list[0].lrn}_${sy}.html`:`Health-Records_${safeName(secLabel(adv))}_${sy}.html`;
 saveFile(name,recordHTML(list,sy));
}

/* ---------- render, events ---------- */
function render(){
 if(S.user&&(PAGE==='home'||PAGE!==S.user.role)){location.replace(ROLE_PAGE[S.user.role]);return}
 if(!S.user&&PAGE!=='home'){$('#root').innerHTML='<div class="login"><div class="small muted" role="status">Opening the '+PAGE+' page…</div></div>';return}
 $('#root').innerHTML=S.user?shell():loginView(); }
const goOpen=(id,tab)=>{S.back=S.view;S.view='student';S.sid=id;S.tab=tab||'profile';S.tooth=null;S.undo=[];S.brush=null;render();window.scrollTo(0,0)};
const ACT={
 fill:a=>{const d=DEMO.find(x=>x.id===a.dataset.id);$('#lu').value=d.username;$('#pw').value=d.pw;const acc=DB.accounts.find(x=>x.id===d.id);
  if(acc&&acc.pw!==pwHash(d.id,d.pw))toast('That account changed its password. Type the new one.');$('#pw').focus()},
 showpw:a=>{const i=$('#pw'),on=i.type==='password';i.type=on?'text':'password';a.textContent=on?'Hide':'Show';a.setAttribute('aria-pressed',on)},
 nav:a=>{S.view=a.dataset.v;render();window.scrollTo(0,0)},
 open:a=>goOpen(a.dataset.id,a.dataset.tab),
 back:()=>{S.view=S.back;render()},
 tab:a=>{S.tab=a.dataset.t;render()},
 theme:()=>{const r=document.documentElement,dark=r.dataset.theme?r.dataset.theme==='dark':matchMedia('(prefers-color-scheme: dark)').matches;r.dataset.theme=dark?'light':'dark'},
 logout:()=>{if(CLOUD_ON)cloudLogout();ss.del('ehh_uid');ss.del('ehh_role');S.user=null;location.href='index.html'},
 seedcloud:()=>{seedCloud()},
 qty:a=>{const i=DB.stock.find(x=>x.id===a.dataset.id);i.qty=Math.max(0,i.qty+ +a.dataset.d);save();render()},
 delstock:a=>{DB.stock=DB.stock.filter(x=>x.id!==a.dataset.id);save();render();toast('Item removed')},
 addother:()=>{stu(S.sid).otherExams.push({date:today(),text:''});save();render()},
 delother:a=>{stu(S.sid).otherExams.splice(+a.dataset.i,1);save();render()},
 addtreat:()=>{stu(S.sid).dental.treat.push({date:today(),tooth:'',op:'',dentist:S.user.name});save();render()},
 deltreat:a=>{stu(S.sid).dental.treat.splice(+a.dataset.i,1);save();render()},
 tooth:a=>{const n=+a.dataset.n,edit=P[S.user.role].dental==='edit';S.tooth=n;
  if(edit&&S.dmode==='paint'&&S.brush&&S.brush.f)setTooth(n,S.brush.f,S.brush.v,true);refreshChart(true)},
 dmode:a=>{S.dmode=a.dataset.v;refreshChart()},
 dlayer:a=>{S.dlayer=a.dataset.v;refreshChart()},
 brush:a=>{const f=a.dataset.f,v=a.dataset.v;S.brush=(S.brush&&S.brush.f===f&&S.brush.v===v)?null:{f,v};refreshChart()},
 undo:()=>{const d=stu(S.sid).dental;if(!(S.undo||[]).length)return;d.teeth=JSON.parse(S.undo.pop());save();refreshChart();toast('Undone')},
 marksound:()=>{const d=stu(S.sid).dental;pushUndo(d);let n=0;TEETH.pu.concat(TEETH.pl).forEach(k=>{if(!d.teeth[k]||!d.teeth[k].s){d.teeth[k]=Object.assign({s:'✓',a:'',n:''},d.teeth[k]||{},{s:'✓'});n++}});if(!d.date)d.date=today();save();refreshChart();toast(n+' teeth marked sound')},
 marksound1:()=>{if(S.tooth!=null){setTooth(S.tooth,'s','✓');refreshChart()}},
 cleartooth:()=>{if(S.tooth==null)return;const d=stu(S.sid).dental;pushUndo(d);delete d.teeth[S.tooth];save();refreshChart()},
 tnav:a=>{const i=ALLT.indexOf(S.tooth);S.tooth=ALLT[(Math.max(0,i)+ +a.dataset.d+ALLT.length)%ALLT.length];refreshChart(true)},
 fillvisit:a=>{const d=stu(S.sid).dental,c=countChart(d),k=a.dataset.k,v=d.visits[k][+a.dataset.i];
  v.date=v.date||today();v.d=String(c[k].d);v.f=String(c[k].f);if(k==='p')v.m=String(c.p.m);save();render();toast('Counts copied from the chart')},
 transfer:()=>doTransfer(),
 pickphoto:()=>{const i=$('#photo-in');if(i)i.click()},
 resendcode:()=>cloudResend(),
 codeback:()=>{S.login.pending=null;S.login.err='';S.login.info='';render()},
 gmcancel:()=>{S.gm=null;render()},
 gmunlinkask:()=>{S.gm={unlink:true};render()},
 pickaccphoto:()=>{const i=$('#acc-photo');if(i)i.click()},
 rmaccphoto:()=>setAccPhoto(null,true),
 rmphoto:()=>{const st=stu(S.sid);if(!st||!st.photo)return;delete st.photo;save();toast('Photo removed');render()},
 grp:a=>{const id=a.dataset.id;S.open.has(id)?S.open.delete(id):S.open.add(id);render()},
 grpall:()=>{S.open=S.open.size?new Set():new Set(SECT_UI.map(x=>x.id));render()},
 sel:a=>{const id=a.dataset.id;S.sel.has(id)?S.sel.delete(id):S.sel.add(id);render()},
 selall:()=>{const l=advList();S.sel=S.sel.size===l.length?new Set():new Set(l.map(x=>x.id));render()},
 selclear:()=>{S.sel=new Set();render()},
 addlrn:()=>{const toks=S.lrnText.split(/[\s,;]+/).filter(Boolean),l=advList(),bad=[];let n=0;
  toks.forEach(t=>{const st=l.find(x=>x.lrn===t);if(st){S.sel.add(st.id);n++}else bad.push(t)});
  S.lrnMsg=!toks.length?'Type at least one LRN.':`${n} added.${bad.length?' Not found in your advisory for '+S.sy+': '+bad.join(', ')+'.':''}`;if(!bad.length)S.lrnText='';render()},
 exportpdf:()=>exportPDF(),
 exporthtml:()=>exportHTML(exportList()),
 exportone:a=>exportHTML([stu(a.dataset.id)])
};
document.addEventListener('click',e=>{const a=e.target.closest('[data-act]');if(a&&ACT[a.dataset.act])ACT[a.dataset.act](a)});
const KEYS={s:'✓',x:'X',f:'F',o:'O',r:'RF',h:'HS'};
document.addEventListener('keydown',e=>{
 const g=e.target.classList&&e.target.classList.contains('og')?e.target:null;if(!g)return;
 const n=+g.dataset.n,edit=P[S.user.role].dental==='edit',k=e.key;
 if(k==='Enter'||k===' '){e.preventDefault();ACT.tooth(g);return}
 if(k==='ArrowRight'||k==='ArrowLeft'){e.preventDefault();const l=ORDER.find(a=>a.includes(n)),i=l.indexOf(n),m=l[(i+(k==='ArrowRight'?1:-1)+l.length)%l.length];S.tooth=m;refreshChart(true);return}
 if(k==='ArrowUp'||k==='ArrowDown'){e.preventDefault();const pairs={0:1,1:0,2:3,3:2},li=ORDER.findIndex(a=>a.includes(n)),l=ORDER[pairs[li]],i=ORDER[li].indexOf(n);S.tooth=l[Math.min(l.length-1,Math.round(i*(l.length-1)/(ORDER[li].length-1)))];refreshChart(true);return}
 if(!edit)return;
 if(k==='Delete'||k==='Backspace'){e.preventDefault();S.tooth=n;ACT.cleartooth();refreshChart(true);return}
 const v=KEYS[k.toLowerCase()];if(v&&!e.ctrlKey&&!e.metaKey){e.preventDefault();S.tooth=n;setTooth(n,'s',v);refreshChart(true)}
});
/* tooltip */
const tip=document.createElement('div');tip.id='tip';tip.hidden=true;document.body.appendChild(tip);
document.addEventListener('mouseover',e=>{const g=e.target.closest&&e.target.closest('.og');if(!g||!S.sid){tip.hidden=true;return}
 const n=+g.dataset.n,t=(stu(S.sid).dental.teeth[n])||{};tip.innerHTML=`<b>${n}</b> · ${toothName(n)}<br>${esc(statusLabel(t.s))}${t.n?' · needs '+esc(t.n.toLowerCase()):''}`;tip.hidden=false});
document.addEventListener('mousemove',e=>{if(!tip.hidden){tip.style.left=Math.min(innerWidth-250,e.clientX+14)+'px';tip.style.top=(e.clientY+16)+'px'}});
document.addEventListener('mouseout',e=>{if(!e.relatedTarget||!e.relatedTarget.closest||!e.relatedTarget.closest('.og'))tip.hidden=true});
function onBind(e){
 const el=e.target.closest('[data-bind]'); if(!el)return; const b=el.dataset.bind, ch=e.type==='change', v=el.value;
 const st=S.sid?stu(S.sid):null;
 if(b==='filter'){S.f[el.dataset.f]=v; if(ch||el.dataset.f==='q'){const pos=el.selectionStart;render();if(el.dataset.f==='q'){const q=$('#q');q.focus();q.setSelectionRange(pos,pos)}}return}
 if(b==='loginadv'){S.login.adv=v;return}
 if(b==='sy'){S.sy=v;S.sel=new Set();S.lrnMsg='';render();return}
 if(b==='lrntext'){S.lrnText=v;return}
 if(b==='photo'){if(ch){const f=el.files&&el.files[0];el.value='';setPhoto(f)}return}
 if(b==='accphoto'){if(ch){const f=el.files&&el.files[0];el.value='';setAccPhoto(f)}return}
 if(b==='trlrn'){S.tr=S.tr||{};S.tr.lrn=v.replace(/\D/g,'');const p=$('#trprev');if(p)p.innerHTML=trPreview();return}
 if(b==='trdest'){S.tr=S.tr||{};S.tr.dest=v;return}
 if(b==='stock'){if(!ch)return;const i=DB.stock.find(x=>x.id===el.dataset.id),f=el.dataset.f;i[f]=(f==='qty'||f==='min')?Math.max(0,parseInt(v)||0):v;save();render();return}
 if(b==='exam'){const G=+el.dataset.g,f=el.dataset.f;const rec=(st.exam[G]=st.exam[G]||{});rec[f]=v;
  if(el.dataset.code){const fd=EXAM_FIELDS.find(x=>x[0]===f),dc=decode(fd,v);$('#dec-'+G+'-'+f).textContent=dc.txt;el.classList.toggle('bad',dc.bad)}
  if(f==='date'&&v&&!rec.by){rec.by=S.user.name;const bi=$(`[data-g="${G}"][data-f="by"]`);if(bi)bi.value=rec.by}
  save();return}
 if(b==='prof'){const f=el.dataset.f;if(f==='section'){enrOf(st,CUR_SY).section=v;save();if(ch)render();return}st[f]=v;save();return}
 if(b==='other'){st.otherExams[+el.dataset.i][el.dataset.f]=v;save();return}
 if(b==='ddate'){st.dental.date=v;save();return}
 if(b==='treat'){st.dental.treat[+el.dataset.i][el.dataset.f]=v;save();return}
 if(b==='tooth'){if(S.tooth==null)return;setTooth(S.tooth,el.dataset.f,v);refreshChart();return}
 if(b==='visit'){const k=el.dataset.k,i=+el.dataset.i,d=st.dental;d.visits[k][i][el.dataset.f]=v;
  ['tt','ts'].forEach(m=>{const c=$(`#${m}-${k}-${i}`);if(c)c.textContent=visitTotal(d,k,i,m)});save();return}
}
document.addEventListener('input',onBind);document.addEventListener('change',onBind);
document.addEventListener('submit',e=>{
 e.preventDefault();
 if(e.target.id==='loginform'){
  if(CLOUD_ON){cloudLogin($('#lu').value.trim(),$('#pw').value);return}
  const id=normU($('#lu').value),pw=$('#pw').value,L=S.login,f=S.fails[id]||{n:0,t:0};
  if(f.n>=5&&Date.now()-f.t<30000){L.err='Too many attempts. Wait 30 seconds and try again.';render();return}
  const acc=DB.accounts.find(x=>normU(x.username)===id||normU(x.email)===id||(ALIAS[x.id]===id));
  if(!acc||acc.pw!==pwHash(acc.id,pw)){S.fails[id]={n:f.n+1,t:Date.now()};L.err='Username or password is incorrect.';render();$('#lu').value=id;return}
  delete S.fails[id];L.err='';
  ss.set('ehh_uid',acc.id);ss.set('ehh_role',acc.role);location.href=ROLE_PAGE[acc.role];return}
if(e.target.id==='codeform'){cloudVerifyLogin($('#lc').value.trim());return}
 if(e.target.id==='gm-send'){if(S.gm&&S.gm.busy)return;const em=$('#gm-e').value.trim();S.gm={email:em,busy:true};const sb=e.target.querySelector('button');if(sb){sb.disabled=true;sb.textContent='Sending…'}rpcGmSend(em);return}
 if(e.target.id==='gm-code'){const cd=$('#gm-c').value.trim();rpc('app_verify_link',{p_token:TOK,p_code:cd}).then(r=>{if(r.error){S.gm.err=cloudErr({code:r.error});S.gm.ok='';render();return}
   Object.assign(DB.accounts[0],r.account);S.gm=null;toast('Gmail linked. You will get a code at every login.');render()}).catch(x=>{S.gm.err=cloudErr(x);render()});return}
 if(e.target.id==='gm-unlink'){const pw=$('#gm-pw').value;rpc('app_unlink_gmail',{p_token:TOK,p_password:pw}).then(r=>{Object.assign(DB.accounts[0],r);S.gm=null;toast('Gmail unlinked');render()}).catch(x=>{S.gm=Object.assign(S.gm||{},{err:cloudErr(x)});render()});return}
 if(e.target.id==='acctform'){
  const a=DB.accounts.find(x=>x.id===S.user.id),u=$('#ac-u').value.trim(),m=$('#ac-e').value.trim();
  if(u.length<3)return accMsg('ac-msg','Username needs 3 or more characters.');
  if(!/^\S+@\S+\.\S+$/.test(m))return accMsg('ac-msg','Enter a valid email address.');
  if(DB.accounts.some(x=>x.id!==a.id&&(normU(x.username)===normU(u)||normU(x.email)===normU(m))))return accMsg('ac-msg','Another account already uses that username or email.');
  if(CLOUD_ON){rpc('app_update_account',{p_token:TOK,p_username:u,p_email:m}).then(r=>{Object.assign(a,r);accMsg('ac-msg','Saved. Use these to log in next time.',true)}).catch(x=>accMsg('ac-msg',x.code==='DUPLICATE'?'Another account already uses that username or email.':cloudErr(x)));return}
  a.username=u;a.email=m;save();accMsg('ac-msg','Saved. Use these to log in next time.',true);return}
 if(e.target.id==='pwform'){
  const a=DB.accounts.find(x=>x.id===S.user.id),c=$('#pw-c').value,n=$('#pw-n').value,r=$('#pw-r').value;
  if(n.length<8)return accMsg('pw-msg','New password needs at least 8 characters.');
  if(n!==r)return accMsg('pw-msg','The new passwords do not match.');
  if(CLOUD_ON){const f=e.target;rpc('app_change_password',{p_token:TOK,p_old:c,p_new:n}).then(()=>{f.reset();accMsg('pw-msg','Password changed.',true)}).catch(x=>accMsg('pw-msg',x.code==='BAD_PASSWORD'?'Current password is incorrect.':cloudErr(x)));return}
  if(a.pw!==pwHash(a.id,c))return accMsg('pw-msg','Current password is incorrect.');
  a.pw=pwHash(a.id,n);save();e.target.reset();accMsg('pw-msg','Password changed.',true);return}
 if(e.target.id==='addstock'){
  const n=$('#ns-name').value.trim();if(!n)return;
  DB.stock.push({id:'I'+Date.now(),name:n,cat:$('#ns-cat').value.trim()||'General',unit:$('#ns-unit').value.trim()||'pcs',qty:parseInt($('#ns-qty').value)||0,min:5,exp:''});
  save();render();toast('Supply added')}
});
function localRestore(){
 const acc=DB.accounts.find(x=>x.id===ss.get('ehh_uid'));
 if(!acc)return false;
 S.user={id:acc.id,role:acc.role,name:acc.name,adv:acc.adv||null,photo:acc.photo||null};
 S.view=NAV[acc.role][0][0];S.back=S.view;return true}
function boot(){
 const role=ss.get('ehh_role');
 if(PAGE==='home'){ if(role&&ROLE_PAGE[role]&&(ss.get('ehh_tok')||ss.get('ehh_uid'))){location.replace(ROLE_PAGE[role]);return} render();return}
 render();
 const bad=()=>{ss.del('ehh_tok');ss.del('ehh_uid');ss.del('ehh_role');location.replace('index.html?role='+PAGE)};
 if(CLOUD_ON){cloudRestore().then(r=>{if(r==='ok'&&S.user)return;if(r==='none'||r==='expired')return bad();
  const m=cloudErr(r),c=(r&&r.code)||'error';
  $('#root').innerHTML='<div class="login"><div style="display:grid;gap:12px;max-width:420px"><h2>Could not open this page</h2><div class="pill bad" style="white-space:normal">'+esc(m)+' ('+esc(c)+')</div><div class="small muted">Your login is still active. Check the connection and try again.</div><div><button class="btn primary" onclick="location.reload()">Try again</button> <button class="btn" onclick="sessionStorage.clear();location.href=&quot;index.html&quot;">Back to login</button></div></div></div>'})}
 else{if(localRestore())render();else bad()}
}
boot();
