/* ---------- reference data ---------- */
const CUR_SY='2026-2027', SYS=['2025-2026','2026-2027'];
const TEACHERS=[ /* username, password, grade, track, strand, code, number */
 ['Dummy Teacher 11A1','acad1',11,'Academic','Academic','ACAD',1],
 ['Dummy Teacher 11A2','acad2',11,'Academic','Academic','ACAD',2],
 ['Dummy Teacher 11TP1','techpro1',11,'Technical Professional','TechPro','TP',1],
 ['Dummy Teacher 11TP2','techpro2',11,'Technical Professional','TechPro','TP',2],
 ['Dummy Teacher 12STEM1','stem1',12,'Academic','STEM','STEM',1],
 ['Dummy Teacher 12STEM2','stem2',12,'Academic','STEM','STEM',2],
 ['Dummy Teacher 12STEM3','stem3',12,'Academic','STEM','STEM',3],
 ['Dummy Teacher 12ABM1','abm1',12,'Academic','ABM','ABM',1],
 ['Dummy Teacher 12ABM2','abm2',12,'Academic','ABM','ABM',2],
 ['Dummy Teacher 12ABM3','abm3',12,'Academic','ABM','ABM',3],
 ['Dummy Teacher 12HUMMS1','humms1',12,'Academic','HUMSS','HUMSS',1],
 ['Dummy Teacher 12HUMMS2','humms2',12,'Academic','HUMSS','HUMSS',2],
 ['Dummy Teacher 12HUMMS3','humms3',12,'Academic','HUMSS','HUMSS',3],
 ['Dummy Teacher 12TVL1','tvl1',12,'TVL','TVL','TVL',1],
 ['Dummy Teacher 12TVL2','tvl2',12,'TVL','TVL','TVL',2],
 ['Dummy Teacher 12TVL3','tvl3',12,'TVL','TVL','TVL',3]
 ,['Dummy Teacher 11A3','acad3',11,'Academic','Academic','ACAD',3]
 ,['Dummy Teacher 11A4','acad4',11,'Academic','Academic','ACAD',4]
 ,['Dummy Teacher 11A5','acad5',11,'Academic','Academic','ACAD',5]
 ,['Dummy Teacher 11A6','acad6',11,'Academic','Academic','ACAD',6]
 ,['Dummy Teacher 11TP3','techpro3',11,'Technical Professional','TechPro','TP',3]
 ,['Dummy Teacher 11TP4','techpro4',11,'Technical Professional','TechPro','TP',4]
 ,['Dummy Teacher 11TP5','techpro5',11,'Technical Professional','TechPro','TP',5]
 ,['Dummy Teacher 11TP6','techpro6',11,'Technical Professional','TechPro','TP',6]
];
const SECTIONS=TEACHERS.map(t=>({id:`${t[2]}-${t[5]}-${t[6]}`,grade:t[2],track:t[3],strand:t[4],name:String(t[6]),adviser:t[0]}));
const _RK=['ACAD','TP','STEM','ABM','HUMSS','TVL'];
const SECT_UI=SECTIONS.slice().sort((x,y)=>x.grade-y.grade||_RK.indexOf(x.id.split('-')[1])-_RK.indexOf(y.id.split('-')[1])||(+x.name)-(+y.name));
const secTag=s=>({ACAD:'acad',TP:'techpro',STEM:'stem',ABM:'abm',HUMSS:'humms',TVL:'tvl'}[s.id.split('-')[1]])+s.name;
const STRAND_CODE={ACAD:'00',TP:'01',STEM:'02',ABM:'03',HUMSS:'04',TVL:'05'};
/* LRN pattern: grade(2) + track/strand(2) + section no.(2) + 0000 + learner no.(2), e.g. 110001000001 = Grade 11, ACAD, section 1, learner 1 */
const mkLrn=(sec,k)=>String(sec.grade)+STRAND_CODE[sec.id.split('-')[1]]+String(sec.name).padStart(2,'0')+'0000'+String(k+1).padStart(2,'0');
const trackLabel=s=>s.track===s.strand?s.track:s.track+' / '+s.strand;
const secOf=id=>SECTIONS.find(s=>s.id===id);
const secLabel=s=>`Grade ${s.grade} ${s.strand}-${s.name}`;
const USERS={
 Doctor:{name:'Dummy Doctor1',blurb:'Overview, all records and supplies'},
 Nurse:{name:'Dummy Nurse1',blurb:'Exam cards, student records, supplies'},
 Dentist:{name:'Dummy Dentist1',blurb:'Dental service charts and treatments'},
 Teacher:{name:'',blurb:'Advisory health files and transfers'}
};
const GROUPS={
 skin:{t:'Skin & Scalp',i:['Pediculosis','Tinea Flava','Scabies','Ulcers','Minor Injuries','Ringworm','Skin Allergy','Others (specify)']},
 ee:{t:'Eyes & Ears',i:['Granular eyelid','Inflamed Eyes','Squinting Eyes','Pale Conjunctivae','Discharging Ear','Impacted Cerumen','Others (specify)']},
 nm:{t:'Nose & Mouth',i:['Colds/cough','Dirty Teeth','Defective Teeth','Stomatitis','Cleft Palate','Harelip','Defective Speech','Others (specify)']},
 tn:{t:'Throat & Neck',i:['Enlarged Tonsils','Inflamed Throat','Enlarged Glands','Goiter','Others (specify)']},
 hl:{t:'Heart & Lungs',i:['Normal','RH/RHD','CHD','Asthma','Primary Complex','Others (specify)']},
 ex:{t:'Extremities',i:['Abnormal','Deformities (congenital or acquired)','Others (specify)']},
 ns:{t:'Nutritional Status',i:['Severely Wasted','Wasted','Normal','Overweight','Obese']},
 rm:{t:'Remarks',i:['Referred','Treated','Further Evaluation','Observation']}
};
/* field: key,label,type,group,allowed letters */
const EXAM_FIELDS=[
 ['date','Date of Examination','date'],['wt','Weight (Kg.)','num'],['ht','Height (Cm.)','num'],
 ['vision',"Vision (Snellen's Chart)",'text','','e.g. 20/20'],['hearing','Hearing','text','','e.g. Normal'],
 ['nutri','Nutritional Status','code','ns','abcde'],['skin','Skin and Scalp','code','skin','abcdefgh'],
 ['eyes','Eyes','code','ee','abcdg'],['ears','Ears','code','ee','efg'],['nose','Nose','code','nm','ah'],
 ['mouth','Mouth','code','nm','bcdefgh'],['throat','Throat','code','tn','abe'],['neck','Neck','code','tn','cde'],
 ['heart','Heart','code','hl','abcf'],['lungs','Lungs','code','hl','adef'],['ext','Extremities','code','ex','abc'],
 ['other','Other Illness (Identify)','text'],['remarks','Remarks','code','rm','abcd'],['by','Examined By','text']
];
const LEG_MOUTH=[['X','Carious tooth indicated for extraction'],['F','Carious tooth indicated for filling'],['RF','Root fragment'],['O','Missing tooth'],['F2','Permanently filled tooth with reoccurrence of decay'],['Heavy Shade','Permanent filling'],['Outline of filling','Tooth with temporary filling'],['( ✓ )','Sound/erupted permanent tooth']];
const LEG_ART=[['JC','Jacket Crown'],['AB','Abutment'],['P','Pontic'],['I','Inlay'],['RPD','Removable Partial Denture'],['FB','Fixed Bridge'],['CD','Complete Denture']];
const LEG_ACC=[['P','Prophylaxis'],['X','Extracted permanent tooth'],['xt','Extracted temporary tooth'],['Ag F','Amalgam filling'],['Sy F','Synthetic Porcelain filling'],['CF','Cement filling'],['ZnO F','Zinc Oxide filling'],['Corrected','Correction of all defects'],['TF','Treatment of eugenol in cotton'],['R','Referred to private dentist']];
/* tooth status options: value, label, tone */
const STATUS_OPTS=[['','Not examined',''],['✓','✓ Sound / erupted permanent','good'],['X','X Indicated for extraction','bad'],['F','F Indicated for filling','warn'],['RF','RF Root fragment','bad'],['O','O Missing','bad'],['F2','F2 Filled with recurrent decay','warn'],['HS','Heavy shade: permanent filling','blue'],['OF','Outline: temporary filling','blue'],['JC','JC Jacket Crown','info'],['AB','AB Abutment','info'],['PN','P Pontic','info'],['I','I Inlay','info'],['RPD','RPD Removable Partial Denture','info'],['FB','FB Fixed Bridge','info'],['CD','CD Complete Denture','info']];
const STATUS_SHOW={HS:'■',OF:'□',PN:'P'};
const ACC_OPTS=['','P','X','xt','Ag F','Sy F','CF','ZnO F','Corrected','TF','R'];
const NEEDS=['','Extraction','Filling','Prophylaxis','Referral','Observation','Sealant'];
const TEETH={
 tu:[55,54,53,52,51,61,62,63,64,65],
 pu:[18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28],
 pl:[48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38],
 tl:[85,84,83,82,81,71,72,73,74,75]
};
const FILE_KINDS=['School Health Examination Card','Dental Record','Immunization Card','Parental Consent Form'];

/* ---------- seed ---------- */
function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function seedDB(){
 const R=rng(2026), pick=a=>a[Math.floor(R()*a.length)], ri=(a,b)=>Math.floor(a+R()*(b-a+1));
 const FN=['Juan','Maria','Angelo','Bea','Carlo','Dana','Enzo','Faith','Gab','Hannah','Ian','Jasmine','Kyle','Lara','Miguel','Nina','Oscar','Pia','Rico','Sofia','Tomas','Uma','Vince','Wendy','Xavier','Yna','Zed','Alyssa','Bryan','Chloe','Dante','Elise','Aaron','Bianca','Cyrus','Denise','Elias','Fiona','Gio','Hazel','Isaac','Jolina','Kevin','Lyka','Marco','Nadine','Owen','Paula','Ada','Basil','Cathy','Dale','Edna','Felix','Gina','Hugo','Iris','Jude','Kara','Leo','Mira','Noel','Opal','Paul','Rina','Seth','Tess','Ulysses','Vera','Wilmer','Xyra','Yago'];
 const LN=['Dela Cruz','Garcia','Ramos','Bautista','Ocampo','Pascual','Mendoza','Lim','Tan','Villar','Soriano','Aguilar','Salazar','Manalo','Cabrera','Fernandez','Padilla','Rosales','Valdez','Zamora','Estrada','Lopez','Silva','Herrera','Santiago','Mallari','Quiambao','Robles','De Leon','Hizon','Magno','Tolentino','Abad','Briones','Castro','Dizon','Evangelista','Francisco','Gonzales','Ibarra','Javier','Kalaw','Lacson','Morales','Nolasco','Ortega','Pineda','Quito','Alcantara','Buenaventura','Cortez','Dumlao','Esguerra','Flores','Galang','Honrado','Inocencio','Jimenez','Katigbak','Lorenzo','Macaraeg','Nepomuceno','Olivares','Pangilinan','Quizon','Reyes','Sarmiento','Trinidad','Umali','Villanueva','Wenceslao','Yap'];
 
 const students=[]; let n=0;
 const usedL=new Set(),newLrn=()=>{let v;do{v='1367'+String(ri(10000000,99999999))}while(usedL.has(v));usedL.add(v);return v};
 SECTIONS.forEach(sec=>{const size=ri(38,48);for(let k=0;k<size;k++){
  const sex=n%2?'Female':'Male', id='S'+String(n+1).padStart(4,'0');
  const enr=[{sy:CUR_SY,section:sec.id}]; if(sec.grade===12) enr.unshift({sy:'2025-2026',section:'11-'+(sec.track==='Academic'?'ACAD':'TP')+'-'+(1+n%6)});
  const st={id,first:'Dummy Student '+(k+1),last:secTag(sec),sex,lrn:(ri(10000000,99999999),mkLrn(sec,k)),
   birth:`${2026-(sec.grade===11?16:17)}-${String(ri(1,12)).padStart(2,'0')}-${String(ri(1,28)).padStart(2,'0')}`,
   guardian:(pick(['Rosario','Eduardo','Lourdes','Armando','Teresita']),'Dummy Guardian '+(k+1)+' '+secTag(sec)),contact:'0917 '+ri(100,999)+' '+ri(1000,9999),
   blood:pick(['O+','A+','B+','AB+','O-']),allergies:pick(['None','None','Peanuts','Dust','Penicillin','Seafood']),
   conditions:pick(['None','None','None','Asthma','Mild myopia','Hay fever']),
   enr,exam:{},otherExams:[],files:[],dental:null,visits:[],refs:[],clear:[],plans:[],passes:[]};
  enr.forEach(e=>{const g=secOf(e.section).grade; const done=e.sy!==CUR_SY||R()>.3; if(done)st.exam[g]=mkExam(st,e.sy,g);
    st.files.push({sy:e.sy,name:FILE_KINDS[0],date:done?'2026-08-10':''});
    st.files.push({sy:e.sy,name:FILE_KINDS[2],date:'2026-06-05'});
    if(e.sy===CUR_SY){st.files.push({sy:e.sy,name:FILE_KINDS[3],date:R()>.2?'2026-06-12':''});}});
  if(R()>.5) st.otherExams.push({date:'2026-08-12',text:pick(['Chest X-ray: clear','Urinalysis: normal','Fecalysis: no ova','CBC: within range'])});
  st.dental=mkDental(R,ri,pick,secOf(sec.id).grade);
  students.push(st); n++; }});
 const stock=[
  ['Paracetamol 500 mg','Medicine','tablets',240,100,'2027-03-01'],['Mefenamic Acid 500 mg','Medicine','tablets',80,60,'2027-01-15'],
  ['Cetirizine 10 mg','Medicine','tablets',45,50,'2026-12-20'],['Oral Rehydration Salts','Medicine','sachets',30,25,'2027-05-30'],
  ['Povidone-iodine 10%','First aid','bottles',6,4,'2027-02-10'],['Isopropyl Alcohol 70%','First aid','bottles',3,5,'2027-06-01'],
  ['Sterile Gauze Pads','Dressing','packs',40,20,'2028-01-01'],['Adhesive Bandage','Dressing','boxes',12,8,'2028-03-01'],
  ['Elastic Bandage','Dressing','rolls',7,6,'2028-01-01'],['Disposable Gloves (M)','Protective','boxes',0,4,'2027-09-01'],
  ['Face Masks','Protective','boxes',9,5,'2027-10-01'],['Digital Thermometer','Equipment','pcs',3,2,''],
  ['Snellen Chart','Equipment','pcs',2,1,''],['Dental Prophylaxis Paste','Dental','tubes',5,3,'2027-04-01'],['Amalgam Capsules','Dental','capsules',24,20,'2027-02-01']
 ].map((r,i)=>({id:'I'+i,name:r[0],cat:r[1],unit:r[2],qty:r[3],min:r[4],exp:r[5]}));
 return {students,stock,transfers:[]};
}
function mkExam(st,sy,g){
 const R=rng(st.id.charCodeAt(2)*37+g+sy.length*3+parseInt(st.id.slice(1))*11), ri=(a,b)=>Math.floor(a+R()*(b-a+1)), pk=a=>a[Math.floor(R()*a.length)];
 const wt=ri(42,78), ht=ri(150,176), bmi=wt/((ht/100)**2);
 return {date:sy==='2025-2026'?'2025-08-14':'2026-08-10',wt:String(wt),ht:String(ht),vision:pk(['20/20','20/20','20/30','20/40']),hearing:'Normal',
  nutri:bmi<16?'b':bmi<23?'c':bmi<27?'d':'e',skin:pk(['','','','e','g','a']),eyes:pk(['','','','c']),ears:pk(['','','f']),nose:pk(['','','a']),
  mouth:pk(['','b','c','']),throat:pk(['','','a']),neck:'',heart:'a',lungs:pk(['a','a','a','d']),ext:'',other:'',
  remarks:pk(['','','a','b','d']),by:'Dummy Nurse1'};
}
function mkDental(R,ri,pk,grade){
 const teeth={}, done=R()>.25;
 if(done){TEETH.pu.concat(TEETH.pl).forEach(t=>{const r=R();teeth[t]={s:r<.62?'✓':r<.74?'F':r<.82?'HS':r<.86?'X':r<.89?'O':r<.93?'F2':'✓',a:'',n:''};
  const s=teeth[t].s; if(s==='X')teeth[t].n='Extraction'; if(s==='F'||s==='F2')teeth[t].n='Filling'; if(s==='HS')teeth[t].a='Ag F';});}
 const d={date:done?'2026-08-24':'',teeth,treat:[],visits:{t:Array.from({length:6},()=>({date:'',d:'',f:''})),p:Array.from({length:6},()=>({date:'',d:'',m:'',f:''}))}};
 if(done){const c=countChart(d); d.visits.p[0]={date:'2026-08-24',d:String(c.p.d),m:String(c.p.m),f:String(c.p.f)};
  const bad=Object.entries(teeth).find(([k,v])=>v.s==='HS'); if(bad)d.treat.push({date:'2026-08-24',tooth:bad[0],op:'Amalgam filling',dentist:USERS.Dentist.name});
  d.treat.push({date:'2026-08-24',tooth:'',op:'Oral prophylaxis',dentist:USERS.Dentist.name});}
 return d;
}
function countChart(d){
 const T=d.teeth, P={d:0,m:0,f:0}, Tt={d:0,f:0};
 TEETH.pu.concat(TEETH.pl).forEach(n=>{const s=(T[n]||{}).s; if(['X','F','F2','RF'].includes(s))P.d++; else if(s==='O')P.m++; else if(s==='HS')P.f++;});
 TEETH.tu.concat(TEETH.tl).forEach(n=>{const s=(T[n]||{}).s; if(['X','F','RF'].includes(s))Tt.d++; else if(['HS','OF'].includes(s))Tt.f++;});
 return {p:P,t:Tt};
}
