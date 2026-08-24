(function(){
  const K=window.KCDP=window.KCDP||{},clone=v=>JSON.parse(JSON.stringify(v));
  const fields=['shifts','standby','wishes','workflow','planVersions','acknowledgements','swapRequests','actualShifts','actualWorkflow','actualPlanVersions','actualConfig','breakConfig','personRules','absences','replacementRequests','notificationInbox','notificationPreferences','eventConfig','daySettings','demandMatrix'];
  const state={undo:[],redo:[],restoring:false,max:30,lastKey:null};
  function snapshot(){const s={};for(const f of fields)s[f]=clone(K[f]??null);return s;}
  function key(s){let h=2166136261,t=JSON.stringify(s);for(let i=0;i<t.length;i++){h^=t.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
  function restore(s){state.restoring=true;for(const f of fields)if(f in s)K[f]=clone(s[f]);K.configuration?.restore?.({eventConfig:K.eventConfig,daySettings:K.daySettings,demandMatrix:K.demandMatrix});K.refreshWorkflowState?.();state.restoring=false;}
  function reset(label='Start'){const s=snapshot();state.undo=[{label,s,key:key(s)}];state.redo=[];state.lastKey=key(s);}
  function record(label='Änderung'){if(state.restoring)return;const s=snapshot(),k=key(s);if(k===state.lastKey)return;state.undo.push({label,s,key:k});if(state.undo.length>state.max)state.undo.shift();state.redo=[];state.lastKey=k;}
  function undo(){if(state.undo.length<2)return null;const cur=state.undo.pop();state.redo.push(cur);const prev=state.undo.at(-1);restore(prev.s);state.lastKey=prev.key;return prev;}
  function redo(){if(!state.redo.length)return null;const n=state.redo.pop();state.undo.push(n);restore(n.s);state.lastKey=n.key;return n;}
  K.historyManager={version:'0.13.0',state,snapshot,reset,record,undo,redo,canUndo:()=>state.undo.length>1,canRedo:()=>state.redo.length>0};
})();
