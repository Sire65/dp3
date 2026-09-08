(function(){
const sel='img[src*="kc-logo.svg"],img[src*="kc-original-kochmuetze.png"]';
function update(){document.querySelectorAll(sel).forEach(img=>{let el=img.parentElement,dark=false;while(el){const s=getComputedStyle(el),v=s.backgroundColor.match(/[\d.]+/g);if(v&&v.length>=3&&(v.length===3||Number(v[3])>.8)){dark=(.2126*Number(v[0])+.7152*Number(v[1])+.0722*Number(v[2]))<128;break;}el=el.parentElement;}img.classList.toggle('kc-original-on-dark',dark);img.classList.add('kc-original-mark');});}
let queued=false;const schedule=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;update();});};
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('load',schedule);window.addEventListener('resize',schedule);schedule();
})();