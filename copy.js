/* "Copy code" page opened from the login-code email. The code travels in the #fragment, which browsers never send to a server. */
(function(){
 var code=(location.hash||'').replace(/^#/,'').replace(/\D/g,'').slice(0,6);
 var box=document.getElementById('cp-code'),btn=document.getElementById('cp-btn'),msg=document.getElementById('cp-msg');
 try{history.replaceState(null,'',location.pathname)}catch(e){}   /* remove the code from the address bar and history */
 if(code.length!==6){box.textContent='------';btn.disabled=true;msg.textContent='This link has no code. Open the newest email from EduHealthHub and press Copy code again.';return}
 box.textContent=code.slice(0,3)+' '+code.slice(3);
 function sel(){var r=document.createRange();r.selectNodeContents(box);var s=getSelection();s.removeAllRanges();s.addRange(r)}
 box.addEventListener('click',sel);
 function done(ok){
  if(ok){btn.textContent='Copied';btn.classList.add('copied');msg.textContent='Copied. Go back to EduHealthHub and paste the code.';msg.className='small copyok'}
  else{sel();msg.textContent='Your browser did not allow copying. The code is selected: press Ctrl+C (or touch and hold, then Copy).';msg.className='small'}}
 btn.addEventListener('click',function(){
  if(navigator.clipboard&&window.isSecureContext){navigator.clipboard.writeText(code).then(function(){done(true)},function(){legacy()})}
  else legacy();
  function legacy(){try{var t=document.createElement('textarea');t.value=code;t.setAttribute('readonly','');t.style.position='fixed';t.style.opacity='0';document.body.appendChild(t);t.select();var ok=document.execCommand('copy');document.body.removeChild(t);done(ok)}catch(e){done(false)}}
 });
})();
