/* 3D school seal for the start page: a thick coin, orbiting rings, floating leaves and beads.
   Pure CSS 3D transforms driven by one small animation loop. No libraries. */
(function(){
 var raf=0,state=null;
 var RM=function(){return window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches};
 function el(c,p,s){var e=document.createElement('div');e.className=c;if(s)e.style.cssText=s;if(p)p.appendChild(e);return e}
 var LEAF='<svg viewBox="0 0 48 24" width="100%" height="100%"><path d="M2 12C12 0 34 0 46 12 34 24 12 24 2 12Z" fill="currentColor"/><path d="M4 12H44" stroke="rgba(255,255,255,.55)" stroke-width="1.4" fill="none"/></svg>';
 function build(root){
  var img=root.querySelector('img'),src=img?img.getAttribute('src'):'assets/school-seal.webp',alt=img?img.getAttribute('alt'):'';
  root.textContent='';root.setAttribute('role','img');root.setAttribute('aria-label',alt||'Dasmariñas Integrated High School seal');
  var plate=el('s3plate',root);
  var rig=el('s3rig',root);
  var shadow=el('s3shadow',plate);
  /* coin */
  var coin=el('s3coin',rig);
  for(var i=0;i<18;i++){el('s3slice',coin,'transform:translateZ('+(i-8.5)*1.15+'px)')}
  var f=el('s3front',coin);
  [['base',10.5],['ring',15],['laurel',22],['book',34]].forEach(function(l){var d=el('s3layer '+l[0],f,'transform:translateZ('+l[1]+'px);background-image:url(assets/seal-'+l[0]+'.webp)')});
  var gl=el('s3gloss',f,'transform:translateZ(35px)');
  var b=el('s3face s3back',coin);b.style.backgroundImage='url('+src+')';
  /* rings with beads */
  var rings=[];
  [{r:230,t:72,c:'s3ring a'},{r:200,t:-64,c:'s3ring b'}].forEach(function(d,k){
   var ring=el(d.c,rig,'width:'+d.r*2+'px;height:'+d.r*2+'px;margin:'+(-d.r)+'px 0 0 '+(-d.r)+'px');
   var spin=el('s3spin',ring);
   for(var n=0;n<3;n++){var bead=el('s3bead'+(n%2?' g':''),spin);bead.style.transform='rotate('+(n*120+k*40)+'deg) translateX('+d.r+'px)'}
   rings.push({ring:ring,spin:spin,tilt:d.t,r:d.r,k:k})});
  /* floating leaves and beads */
  var items=[];
  for(var j=0;j<18;j++){
   var leaf=j%3!==2;var e=el(leaf?'s3leaf':'s3gem',rig);if(leaf){e.innerHTML=LEAF;e.style.color=['#3f8f57','#5fae72','#2e6b3e','#86c48f'][j%4]}
   items.push({e:e,leaf:leaf,a:j/18*Math.PI*2+Math.sin(j*3.1)*.3,r:150+((j*53)%90),z:((j*37)%160)-80,s:leaf?(26+(j*7)%22):(10+(j*5)%10),sp:.18+((j*13)%10)/60,ph:j*1.7})}
  return {root:root,rig:rig,coin:coin,shadow:shadow,rings:rings,items:items,gloss:gl,mx:0,my:0,tx:0,ty:0,p:0,sp:0,t0:performance.now()}}
 function progress(){var h=Math.max(300,innerHeight*.9);return Math.min(1,Math.max(0,scrollY/h))}
 function frame(now){
  var S=state;if(!S||!S.root.isConnected){stop();return}
  var t=(now-S.t0)/1000,p=progress();
  S.sp+=(p-S.sp)*.08;S.mx+=(S.tx-S.mx)*.07;S.my+=(S.ty-S.my)*.07;
  paint(S,t);raf=requestAnimationFrame(frame)}
 function paint(S,t){
  var p=S.sp,ry=Math.sin(t*.6)*22+S.mx*28+p*360,rx=-S.my*18+Math.sin(t*.45)*5-p*14;
  S.coin.style.transform='rotateX('+rx.toFixed(2)+'deg) rotateY('+ry.toFixed(2)+'deg) scale('+(1-p*.14).toFixed(3)+')';
  var gl=((ry%360)+360)%360;S.gloss.style.backgroundPosition=(50+Math.sin(gl*Math.PI/180)*70)+'% 0';
  S.shadow.style.transform='translate(-50%,0) scale('+(1-p*.2).toFixed(3)+')';S.shadow.style.opacity=(.55-p*.25).toFixed(2);
  S.rig.style.transform='rotateX('+(S.my*-6).toFixed(2)+'deg) rotateY('+(S.mx*8).toFixed(2)+'deg)';
  S.rings.forEach(function(g){g.ring.style.transform='rotateX('+g.tilt+'deg) rotateY('+(g.k?-1:1)*(t*8+p*140)+'deg) scale('+(1-p*.12).toFixed(3)+')';g.spin.style.transform='rotateZ('+((g.k?-1:1)*(t*28+p*200))+'deg)'});
  S.items.forEach(function(o){
   var a=o.a+t*o.sp+p*2.4,R=o.r*(1-p*.5)*(1+Math.sin(t*.8+o.ph)*.04);
   var x=Math.cos(a)*R,y=Math.sin(a)*R*.62+Math.sin(t*.9+o.ph)*10,z=o.z*(1-p*.6)+Math.sin(a)*40;
   o.e.style.transform='translate3d('+x.toFixed(1)+'px,'+y.toFixed(1)+'px,'+z.toFixed(1)+'px) rotateZ('+((o.leaf?a*57:0)+Math.sin(t+o.ph)*25).toFixed(1)+'deg) rotateY('+(t*60+o.ph*40).toFixed(0)+'deg) scale('+(o.s/30).toFixed(2)+')';
   o.e.style.opacity=(.95-Math.max(0,-z)/260).toFixed(2)})}
 function stop(){if(raf)cancelAnimationFrame(raf);raf=0}
 function start(){if(!raf&&!RM())raf=requestAnimationFrame(frame)}
 function onMove(e){if(!state)return;var w=innerWidth,h=innerHeight;state.tx=(e.clientX/w-.5)*2;state.ty=(e.clientY/h-.5)*2}
 function fit(){if(!state)return;var w=state.root.clientWidth||360;state.root.style.setProperty('--u',Math.min(1,w/520).toFixed(3))}
 window.seal3dInit=function(){
  stop();state=null;
  var root=document.getElementById('s3scene');if(!root||root.dataset.ready)return;
  if(!(window.CSS&&CSS.supports&&CSS.supports('transform-style','preserve-3d')))return;
  root.dataset.ready='1';state=build(root);fit();
  if(RM()){paint(state,1.2);return}
  if('IntersectionObserver' in window){new IntersectionObserver(function(es){es[0].isIntersecting?start():stop()},{threshold:0}).observe(root)}else start();
  start()};
 addEventListener('pointermove',onMove,{passive:true});addEventListener('resize',fit);
 document.addEventListener('visibilitychange',function(){document.hidden?stop():start()});
})();
