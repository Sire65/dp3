(function(){
 'use strict';
 const K=window.KCDP=window.KCDP||{};
 function attach(input,button,preview){
  if(!input||!button||!preview)return null;
  let characterTimer,eyeTimer;
  const clearPreview=()=>{clearTimeout(characterTimer);preview.textContent='';preview.hidden=true;input.style.color='';};
  const hide=()=>{clearPreview();clearTimeout(eyeTimer);input.type='password';button.setAttribute('aria-pressed','false');button.setAttribute('aria-label','Sicherheitsschlüssel anzeigen');button.title='Sicherheitsschlüssel kurz anzeigen';};
  const toggle=()=>{const show=input.type==='password';hide();if(show){input.type='text';button.setAttribute('aria-pressed','true');button.setAttribute('aria-label','Sicherheitsschlüssel verbergen');button.title='Sicherheitsschlüssel verbergen';eyeTimer=setTimeout(hide,10000)}};
  input.addEventListener('input',e=>{clearPreview();if(input.type!=='password'||e.isComposing||e.inputType!=='insertText'||!e.data||Array.from(e.data).length!==1)return;const end=input.selectionStart;if(end==null)return;const start=end-e.data.length;if(start<0)return;const style=getComputedStyle(input);preview.style.font=style.font;preview.style.padding=style.padding;preview.style.letterSpacing=style.letterSpacing;preview.style.color=style.color;input.style.caretColor=style.color;preview.textContent='•'.repeat(Array.from(input.value.slice(0,start)).length)+e.data+'•'.repeat(Array.from(input.value.slice(end)).length);preview.hidden=false;input.style.color='transparent';preview.scrollLeft=input.scrollLeft;characterTimer=setTimeout(clearPreview,800)});
  input.addEventListener('blur',hide);input.addEventListener('keydown',e=>{if(e.key==='Escape'||e.key==='Enter')hide()});input.addEventListener('compositionstart',clearPreview);input.addEventListener('select',clearPreview);input.addEventListener('scroll',()=>{preview.scrollLeft=input.scrollLeft});
  button.addEventListener('pointerdown',e=>e.preventDefault());button.addEventListener('click',toggle);
  const visibility=()=>{if(document.hidden)hide()};document.addEventListener('visibilitychange',visibility);input.form?.addEventListener('submit',hide);
  const observer=new MutationObserver(()=>{if(!input.isConnected){hide();observer.disconnect();document.removeEventListener('visibilitychange',visibility)}});observer.observe(document.body,{childList:true,subtree:true});hide();
  return{hide};
 }
 K.secretVisibility={attach};
})();
