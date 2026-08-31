(function(){
  'use strict';
  function place(){const legend=document.querySelector('.wish-legend'),head=document.querySelector('.planner-wrap .planner-meta');if(!legend||!head||legend.parentElement===head)return;legend.classList.add('wish-legend-inline');head.appendChild(legend)}
  new MutationObserver(place).observe(document.documentElement,{childList:true,subtree:true});
  place();
})();
