(function(){
'use strict';
const K=window.KCDP=window.KCDP||{};
K.emailInboxConfig=Object.freeze({
  inboundAddress:'dp2@kc-werne.de',
  notifyRoles:['admin','planner','duty_manager'],
  pushOnInbound:true,
  pushOnAutoApply:true,
  pushOnReview:true,
  autoApplyConfidence:0.98
});
})();
