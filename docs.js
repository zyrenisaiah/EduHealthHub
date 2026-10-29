/* ---------- Health files as real documents: edit, Word (.docx) in/out, PDF ---------- */
const DOC_KINDS=FILE_KINDS.concat(['Medical Clearance','Other Medical Records']);
const DOC_MAX=60000;
const run=(x,f)=>({x,b:/b/.test(f||''),i:/i/.test(f||''),u:/u/.test(f||'')});
const P_=(...r)=>({t:'p',r:r.map(a=>typeof a==='string'?run(a):a)});
const H1=x=>({t:'h1',r:[run(x)]}),H2=x=>({t:'h2',r:[run(x)]}),LI=x=>({t:'li',r:[run(x)]});
const B_=x=>run(x,'b');

/* default dummy content for each file */
function defaultDoc(kind,st,sy){
 const sec=secOf((enrOf(st,sy)||enrOf(st,CUR_SY)).section);
 const head=[P_(run('DUMMY FILE - SAMPLE ONLY. This is not a real medical document.','b')),H1(kind),
  P_(B_('School: '),'EduHealthHub Senior High School (dummy)'),
  P_(B_('Learner: '),fullName(st)+'    ',B_('LRN: '),st.lrn),
  P_(B_('Section: '),secLabel(sec)+' ('+trackLabel(sec)+')    ',B_('School year: '),sy)];
 const sign=[P_(''),P_('Prepared by: ______________________    Date: ______________'),P_(run('DUMMY FILE. Replace this text with the real content.','i'))];
 const body={
  'School Health Examination Card':[H2('Examination summary'),LI('Height: ______ cm      Weight: ______ kg'),LI('Vision: ______      Hearing: ______'),LI('Nutritional status: ______'),LI('Remarks: Lorem ipsum dolor sit amet, dummy remarks only.')],
  'Dental Record':[H2('Dental examination'),LI('Date examined: ______________'),LI('Findings: Lorem ipsum dolor sit amet, dummy dental findings only.'),LI('Treatment needed: ______________')],
  'Immunization Card':[H2('Vaccines received'),LI('BCG: ______________'),LI('Measles (MMR): ______________'),LI('Tetanus-diphtheria (Td): ______________'),LI('HPV: ______________')],
  'Parental Consent Form':[H2('Consent'),P_('I, ______________________, parent/guardian of '+fullName(st)+', allow the school clinic to give first aid and basic health care to my child during school hours. (Dummy consent text.)'),P_(''),P_('Signature: ______________________    Date: ______________')],
  'Medical Clearance':[H2('Clearance'),P_('This is to certify that '+fullName(st)+' was examined and is cleared for the activity below. (Dummy text.)'),LI('Cleared for: ______________________'),LI('Valid until: ______________'),P_(''),P_('Physician: ______________________   License no.: __________')],
  'Other Medical Records':[H2('Other medical records'),LI('Laboratory result: Lorem ipsum dolor sit amet (dummy).'),LI('Doctor\'s note: ______________________'),LI('Attachment list: ______________________')]
 }[kind]||[P_('Lorem ipsum dolor sit amet, dummy content only.')];
 return head.concat(body,sign)}

/* the stored document (if edited) or the dummy template */
function fileEntry(st,sy,kind){return st.files.find(f=>f.sy===sy&&f.name===kind)}
function docOf(st,sy,kind){const e=fileEntry(st,sy,kind);return e&&e.doc&&e.doc.b?{blocks:e.doc.b,custom:true,by:e.doc.by,at:e.doc.at}:{blocks:defaultDoc(kind,st,sy),custom:false}}
function storeDoc(st,sy,kind,blocks){
 let e=fileEntry(st,sy,kind);if(!e){e={sy,name:kind,date:''};st.files.push(e)}
 if(blocks)e.doc={b:blocks,by:S.user.name,at:localDate()},e.date=e.date||localDate();else delete e.doc;
 save()}
const textLen=b=>b.reduce((n,k)=>n+k.r.reduce((m,r)=>m+r.x.length,0),0);

/* blocks <-> HTML */
function blocksToHtml(bl){
 const inl=r=>{let h=esc(r.x);if(r.u)h=`<u>${h}</u>`;if(r.i)h=`<i>${h}</i>`;if(r.b)h=`<b>${h}</b>`;return h};
 let out='',ul=false;
 bl.forEach(k=>{const h=k.r.map(inl).join('')||'<br>';
  if(k.t==='li'){if(!ul){out+='<ul>';ul=true}out+=`<li>${h}</li>`;return}
  if(ul){out+='</ul>';ul=false}
  out+=k.t==='h1'?`<h1>${h}</h1>`:k.t==='h2'?`<h2>${h}</h2>`:`<p>${h}</p>`});
 return out+(ul?'</ul>':'')}
function htmlToBlocks(root){
 const blocks=[];
 const runs=(node,f,out)=>{
  node.childNodes.forEach(n=>{
   if(n.nodeType===3){if(n.nodeValue)out.push({x:n.nodeValue.replace(/[\r\n]+/g,' '),...f})}
   else if(n.nodeType===1){
    const tg=n.tagName;if(tg==='BR'){out.push({br:1});return}
    if(/^(UL|OL|DIV|P|H1|H2|H3|LI)$/.test(tg)){out.push({br:1});runs(n,f,out);out.push({br:1});return}
    const g={...f};if(/^(B|STRONG)$/.test(tg)||n.style.fontWeight==='bold'||+n.style.fontWeight>=600)g.b=true;
    if(/^(I|EM)$/.test(tg)||n.style.fontStyle==='italic')g.i=true;if(tg==='U'||/underline/.test(n.style.textDecoration))g.u=true;
    runs(n,g,out)}})};
 const flush=(out,t)=>{let cur=[];const push=()=>{const r=cur.filter(x=>x.x!=='');blocks.push({t,r:r.length?r.map(x=>({x:x.x,b:!!x.b,i:!!x.i,u:!!x.u})):[]});cur=[]};
  out.forEach(o=>{if(o.br){if(cur.some(x=>x.x.trim()!==''))push();else cur=[]}else cur.push(o)});
  if(cur.some(x=>x.x.trim()!==''))push()};
 const walk=(el,t)=>el.childNodes.forEach(n=>{
  if(n.nodeType===3){if(n.nodeValue.trim()){const o=[];runs({childNodes:[n]},{},o);flush(o,'p')}return}
  if(n.nodeType!==1)return;
  const tg=n.tagName;
  if(tg==='UL'||tg==='OL'){n.childNodes.forEach(li=>{if(li.nodeType===1){const o=[];runs(li,{},o);flush(o,'li')}});return}
  const ty=tg==='H1'?'h1':/^H[2-6]$/.test(tg)?'h2':'p';
  if(tg==='DIV'&&n.querySelector('ul,ol,p,h1,h2,h3,div')){walk(n,'p');return}
  const o=[];runs(n,{},o);const before=blocks.length;flush(o,ty);
  if(tg!=='P'&&blocks.length===before&&!n.textContent.trim())blocks.push({t:'p',r:[]})});
 walk(root,'p');
 return blocks.length?blocks:[{t:'p',r:[]}]}

/* ---- zip (store only) and unzip (inflate via the browser) ---- */
const CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
const crc32=u=>{let c=0xFFFFFFFF;for(let i=0;i<u.length;i++)c=CRC[(c^u[i])&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0};
function zipStore(files){
 const te=new TextEncoder(),parts=[],cd=[];let off=0;
 const now=new Date(),dt=((now.getFullYear()-1980)<<9)|((now.getMonth()+1)<<5)|now.getDate(),tm=(now.getHours()<<11)|(now.getMinutes()<<5)|(now.getSeconds()>>1);
 Object.entries(files).forEach(([name,txt])=>{
  const nb=te.encode(name),d=typeof txt==='string'?te.encode(txt):txt,crc=crc32(d);
  const h=new DataView(new ArrayBuffer(30));h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x0800,true);h.setUint16(8,0,true);h.setUint16(10,tm,true);h.setUint16(12,dt,true);
  h.setUint32(14,crc,true);h.setUint32(18,d.length,true);h.setUint32(22,d.length,true);h.setUint16(26,nb.length,true);h.setUint16(28,0,true);
  parts.push(new Uint8Array(h.buffer),nb,d);
  const c=new DataView(new ArrayBuffer(46));c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x0800,true);c.setUint16(10,0,true);c.setUint16(12,tm,true);c.setUint16(14,dt,true);
  c.setUint32(16,crc,true);c.setUint32(20,d.length,true);c.setUint32(24,d.length,true);c.setUint16(28,nb.length,true);c.setUint32(42,off,true);
  cd.push(new Uint8Array(c.buffer),nb);off+=30+nb.length+d.length});
 const cdl=cd.reduce((n,a)=>n+a.length,0),e=new DataView(new ArrayBuffer(22));
 e.setUint32(0,0x06054b50,true);e.setUint16(8,Object.keys(files).length,true);e.setUint16(10,Object.keys(files).length,true);e.setUint32(12,cdl,true);e.setUint32(16,off,true);
 return new Blob([...parts,...cd,new Uint8Array(e.buffer)],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'})}
async function unzipEntry(buf,want){
 const u=new Uint8Array(buf),v=new DataView(buf);let e=-1;
 for(let i=u.length-22;i>=Math.max(0,u.length-65600);i--)if(v.getUint32(i,true)===0x06054b50){e=i;break}
 if(e<0)throw new Error('This is not a Word (.docx) file.');
 let p=v.getUint32(e+16,true);const n=v.getUint16(e+10,true),td=new TextDecoder();
 for(let k=0;k<n;k++){
  if(v.getUint32(p,true)!==0x02014b50)break;
  const method=v.getUint16(p+10,true),csz=v.getUint32(p+20,true),nl=v.getUint16(p+28,true),xl=v.getUint16(p+30,true),cl=v.getUint16(p+32,true),lo=v.getUint32(p+42,true),name=td.decode(u.subarray(p+46,p+46+nl));
  p+=46+nl+xl+cl;
  if(name!==want)continue;
  const ls=lo+30+v.getUint16(lo+26,true)+v.getUint16(lo+28,true),data=u.subarray(ls,ls+csz);
  if(method===0)return td.decode(data);
  if(method!==8||typeof DecompressionStream==='undefined')throw new Error('This browser cannot open that Word file.');
  const out=await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer();
  return td.decode(out)}
 throw new Error('No document text was found in that file.')}

/* ---- Word (.docx) out and in ---- */
const xe=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
function buildDocx(blocks){
 const W='xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
 const rn=r=>`<w:r><w:rPr>${r.b?'<w:b/>':''}${r.i?'<w:i/>':''}${r.u?'<w:u w:val="single"/>':''}</w:rPr><w:t xml:space="preserve">${xe(r.x)}</w:t></w:r>`;
 const ps=blocks.map(k=>{
  const st=k.t==='h1'?'<w:pPr><w:pStyle w:val="Heading1"/></w:pPr>':k.t==='h2'?'<w:pPr><w:pStyle w:val="Heading2"/></w:pPr>':k.t==='li'?'<w:pPr><w:pStyle w:val="ListParagraph"/><w:ind w:left="720" w:hanging="360"/></w:pPr>':'';
  return `<w:p>${st}${k.t==='li'?rn({x:'\u2022  '}):''}${k.r.map(rn).join('')}</w:p>`}).join('');
 const doc=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${W}><w:body>${ps}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`;
 const styles=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ${W}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
 <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
 <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:color w:val="0B6F72"/><w:sz w:val="36"/></w:rPr></w:style>
 <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="200" w:after="80"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style>
 <w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:ind w:left="720"/></w:pPr></w:style></w:styles>`;
 const R='xmlns="http://schemas.openxmlformats.org/package/2006/relationships"';
 return zipStore({
  '[Content_Types].xml':'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>',
  '_rels/.rels':`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships ${R}><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
  'word/_rels/document.xml.rels':`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships ${R}><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
  'word/document.xml':doc,'word/styles.xml':styles})}
async function readDocx(file){
 if(!file)throw new Error('No file chosen.');
 if(!/\.docx$/i.test(file.name))throw new Error('Please choose a Word file that ends in .docx.');
 if(file.size>5e6)throw new Error('That file is too large (limit 5 MB).');
 const xml=await unzipEntry(await file.arrayBuffer(),'word/document.xml');
 const dom=new DOMParser().parseFromString(xml,'application/xml');
 if(dom.querySelector('parsererror'))throw new Error('That Word file could not be read.');
 const NS='http://schemas.openxmlformats.org/wordprocessingml/2006/main',ge=(el,n)=>el.getElementsByTagNameNS(NS,n);
 const on=el=>{if(!el)return false;const v=el.getAttributeNS(NS,'val');return v!=='0'&&v!=='false'&&v!=='none'};
 const blocks=[];
 for(const p of ge(dom,'p')){
  const ppr=ge(p,'pPr')[0],ps=ppr&&ge(ppr,'pStyle')[0],sid=ps?(ps.getAttributeNS(NS,'val')||''):'';
  let t=/^(Heading1|Title)$/i.test(sid)?'h1':/^Heading[2-9]$/i.test(sid)?'h2':'p';
  const isList=/list/i.test(sid)||(ppr&&ge(ppr,'numPr')[0]);
  const r=[];
  for(const w of ge(p,'r')){
   const rp=ge(w,'rPr')[0];let x='';
   for(const c of w.childNodes){if(c.localName==='t')x+=c.textContent;else if(c.localName==='tab')x+='    ';else if(c.localName==='br')x+=' '}
   if(!x)continue;
   const b=rp&&on(ge(rp,'b')[0]),i=rp&&on(ge(rp,'i')[0]),u=rp&&on(ge(rp,'u')[0]);
   r.push({x,b:!!b,i:!!i,u:!!u})}
  if(t==='p'&&isList)t='li';
  if(r.length&&/^[\u2022\-*]\s/.test(r[0].x)){r[0].x=r[0].x.replace(/^[\u2022\-*]\s+/,'');t='li'}
  if(r.length&&/^\u2022\s*$/.test(r[0].x)){r.shift();t='li'}
  if(t==='li'&&r.length)r[0].x=r[0].x.replace(/^\s+/,'');
  blocks.push({t,r})}
 while(blocks.length&&!blocks[blocks.length-1].r.length)blocks.pop();
 if(!blocks.length)throw new Error('That Word file has no text.');
 if(textLen(blocks)>DOC_MAX)throw new Error('That file has too much text for a health file (limit '+DOC_MAX.toLocaleString()+' characters).');
 return blocks}

/* ---- PDF of a document (wraps, paginates, DUMMY watermark) ---- */
function docPDF(file,title,blocks){
 const W=595,H=842,M=56,CW=W-2*M,pages=[];let ops,y;
 const GRAY=[.45,.5,.52],INK=[.06,.16,.18],TEAL=[.043,.498,.51];
 const pe=s=>String(s).replace(/[\u2013\u2014]/g,'-').replace(/[\u2018\u2019]/g,"'").replace(/[\u201C\u201D]/g,'"').replace(/\u2022/g,'-').replace(/[\\()]/g,'\\$&');
 const T=(x,yy,s,sz,b,c)=>ops.push(`BT /${b?'F2':'F1'} ${sz} Tf ${(c||INK).join(' ')} rg ${x.toFixed(1)} ${(H-yy).toFixed(1)} Td (${pe(s)}) Tj ET`);
 const newPage=()=>{ops=[];pages.push(ops);
  ops.push(`BT /F2 84 Tf 0.93 0.95 0.95 rg 0.7071 0.7071 -0.7071 0.7071 110 250 Tm (DUMMY FILE) Tj ET`);
  T(M,40,'EDUHEALTHHUB',8.5,true,TEAL);T(W-M-pdfText(title,8.5,false),40,title,8.5,false,GRAY);y=M+34};
 newPage();
 blocks.forEach(k=>{
  const sz=k.t==='h1'?20:k.t==='h2'?14:11,lh=sz*1.45,ind=k.t==='li'?18:0,w=CW-ind;
  if(!k.r.length){y+=lh*.8;return}
  const toks=[];k.r.forEach(r=>r.x.split(/(\s+)/).forEach(s=>{if(s)toks.push({s,b:r.b||k.t!=='p'&&k.t!=='li',u:r.u})}));
  const lines=[];let cur=[],cw=0;
  toks.forEach(t=>{const tw=pdfText(t.s,sz,t.b);if(cw+tw>w&&cur.length&&t.s.trim()){lines.push(cur);cur=[];cw=0}
   if(!cur.length&&!t.s.trim())return;cur.push({...t,w:tw});cw+=tw});
  if(cur.length)lines.push(cur);
  if(k.t==='h1'||k.t==='h2')y+=sz*.4;
  lines.forEach((ln,li)=>{
   if(y+lh>H-60)newPage();
   let x=M+ind;if(k.t==='li'&&li===0)T(M+4,y+sz,'-',sz,true);
   ln.forEach(t=>{T(x,y+sz,t.s,sz,t.b,k.t==='h1'?TEAL:INK);if(t.u&&t.s.trim())ops.push(`0.06 0.16 0.18 RG 0.6 w ${x.toFixed(1)} ${(H-y-sz-2).toFixed(1)} m ${(x+t.w).toFixed(1)} ${(H-y-sz-2).toFixed(1)} l S`);x+=t.w});
   y+=lh});
  y+=k.t==='li'?2:5});
 pages.forEach((o,i)=>{ops=o;T(M,H-30,'DUMMY FILE - sample only | Confidential student health information',8,false,GRAY);const pg=`Page ${i+1} of ${pages.length}`;T(W-M-pdfText(pg,8,false),H-30,pg,8,false,GRAY)});
 return saveFile(file,pdfBuild(pages.map(o=>o.join('\n')),W,H))}

/* ---- viewer / editor page ---- */
S.doc=null;
const canEditDocs=()=>S.user&&(S.user.role==='Doctor'||S.user.role==='Nurse');
function docView(){
 const d=S.doc,st=d&&stu(d.sid);if(!st){S.view='students';return studentsView()}
 const dc=docOf(st,d.sy,d.kind),ed=canEditDocs(),r=S.user.role;
 const fb=(c,l,t)=>`<button type="button" class="btn sm" data-act="dfmt" data-c="${c}" ${t?`data-v="${t}"`:''} onmousedown="event.preventDefault()">${l}</button>`;
 const tools=d.edit?`<div class="trow doctools">${fb('bold','<b>B</b>')}${fb('italic','<i>I</i>')}${fb('underline','<u>U</u>')}${fb('formatBlock','Heading 1','h1')}${fb('formatBlock','Heading 2','h2')}${fb('formatBlock','Text','p')}${fb('insertUnorderedList','• List')}
   <span class="spacer"></span><button class="btn primary" data-act="dsave">Save</button><button class="btn" data-act="dcancel">Cancel</button></div>`
  :`<div class="trow">${ed?`<button class="btn primary" data-act="dedit">Edit content</button><button class="btn" data-act="ddocx">Download Word (.docx)</button><button class="btn" data-act="dupload">Upload Word (.docx)</button><input type="file" id="docup" data-bind="docup" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden>`:''}
   ${r==='Dentist'?'':`<button class="btn ${ed?'':'primary'}" data-act="dpdf">Download PDF</button>`}${ed&&dc.custom?'<button class="btn" data-act="dreset">Reset to dummy template</button>':''}${r==='Dentist'?'<span class="ro">View only</span>':''}</div>`;
 const e=fileEntry(st,d.sy,d.kind),status=e&&e.date?pill('On file','good'):pill('Not filed','mute');
 return `<div><button class="btn sm" data-act="docback">← Back to ${esc(fullName(st))}</button></div>
 <section class="panel" ${ed&&!d.edit?'data-drop="viewer"':''}><div class="head"><div><div class="eyebrow">${esc(d.sy)} · LRN <span class="mono">${st.lrn}</span></div><h2>${esc(d.kind)}</h2><div class="muted">${esc(fullName(st))} ${status} ${pill('Dummy file','warn')} ${dc.custom?`<span class="small muted">Edited by ${esc(dc.by||'')} on ${esc(dc.at||'')}</span>`:'<span class="small muted">Dummy template, not edited yet</span>'}</div></div></div>
 ${S.docMsg?`<div class="pill ${S.docMsg[0]}" role="status" style="white-space:normal;margin-bottom:8px">${esc(S.docMsg[1])}</div>`:''}
 ${tools}
 ${ed&&!d.edit?'<div class="dropzone" aria-hidden="true">Drag a Word (.docx) file here to replace this file</div>':''}
 <article class="docpage" id="docedit" ${d.edit?'contenteditable="true" spellcheck="true"':''} aria-label="${esc(d.kind)} content">${blocksToHtml(dc.blocks)}</article></section>`}
const DOC_ACT={
 docopen:a=>{S.doc={sid:a.dataset.id,sy:a.dataset.sy,kind:a.dataset.k,edit:false};S.docMsg=null;S.dback=S.view;S.view='doc';render();scrollTo(0,0)},
 docback:()=>{S.view='student';S.docMsg=null;render()},
 dedit:()=>{if(!canEditDocs())return;S.doc.edit=true;S.docMsg=null;render();const a=$('#docedit');if(a)a.focus()},
 dcancel:()=>{S.doc.edit=false;render()},
 dsave:()=>{if(!canEditDocs())return;const b=htmlToBlocks($('#docedit'));
  if(textLen(b)>DOC_MAX){S.docMsg=['bad','Too much text (limit '+DOC_MAX.toLocaleString()+' characters).'];render();return}
  storeDoc(stu(S.doc.sid),S.doc.sy,S.doc.kind,b);S.doc.edit=false;S.docMsg=['good','Saved.'];render()},
 dreset:()=>{if(!canEditDocs())return;storeDoc(stu(S.doc.sid),S.doc.sy,S.doc.kind,null);S.docMsg=['good','Back to the dummy template.'];render()},
 dfmt:a=>{document.execCommand(a.dataset.c,false,a.dataset.v?'<'+a.dataset.v+'>':null)},
 ddocx:()=>{const d=S.doc,st=stu(d.sid);saveFile(`${safeName(d.kind)}_${st.lrn}_${d.sy}.docx`,buildDocx(docOf(st,d.sy,d.kind).blocks))},
 dpdf:()=>{const d=S.doc,st=stu(d.sid);docPDF(`${safeName(d.kind)}_${st.lrn}_${d.sy}.pdf`,`${d.kind} | ${fullName(st)} | ${d.sy}`,docOf(st,d.sy,d.kind).blocks)},
 dupload:()=>{const i=$('#docup');if(i)i.click()}
};
async function docUpload(el){
 const f=el.files&&el.files[0];el.value='';if(f)docAccept(f,S.doc.sid,S.doc.sy,S.doc.kind,true)}
/* shared by the Upload button and drag and drop */
async function docAccept(f,sid,sy,kind,inViewer){
 if(!canEditDocs()||!stu(sid))return;
 try{const b=await readDocx(f);storeDoc(stu(sid),sy,kind,b);
  if(inViewer){S.doc.edit=false;S.docMsg=['good','Uploaded '+f.name+'. The content was replaced.']}else toast('Uploaded '+f.name+' to '+kind)}
 catch(e){if(inViewer)S.docMsg=['bad',e.message||'That file could not be read.'];else toast(e.message||'That file could not be read.')}
 render()}
/* drag and drop: drop a .docx on a file row or on the open document */
(()=>{
 const hasFiles=e=>e.dataTransfer&&[...(e.dataTransfer.types||[])].includes('Files');
 const zone=e=>e.target.closest&&e.target.closest('[data-drop]');
 let hot=null;const clear=()=>{if(hot){hot.classList.remove('dragover');hot=null}};
 addEventListener('dragover',e=>{if(!hasFiles(e))return;e.preventDefault();const z=zone(e);
  if(z&&canEditDocs()){e.dataTransfer.dropEffect='copy';if(hot!==z){clear();hot=z;z.classList.add('dragover')}}else{e.dataTransfer.dropEffect='none';clear()}});
 addEventListener('dragleave',e=>{if(!e.relatedTarget)clear()});
 addEventListener('drop',e=>{if(!hasFiles(e))return;e.preventDefault();const z=zone(e);clear();
  if(!z||!canEditDocs()){if(z)toast('Only the Doctor and Nurse can upload files.');return}
  const f=e.dataTransfer.files[0];if(!f)return;
  if(z.dataset.drop==='viewer'&&S.doc)docAccept(f,S.doc.sid,S.doc.sy,S.doc.kind,true);
  else docAccept(f,z.dataset.id,z.dataset.sy,z.dataset.k,false)});
})();
