(function(){
'use strict';
const K=window.KCDP,WEATHER_URL='https://api.open-meteo.com/v1/forecast?latitude=51.6639&longitude=7.6337&hourly=temperature_2m,weather_code,precipitation_probability,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=Europe%2FBerlin&forecast_days=16';
const state={busy:false,weather:{status:'missing',checkedAt:null,error:null},program:{status:'missing',checkedAt:null,error:null},forecast:new Map(),publication:null};
let pending=null,lastWeather=0,lastProgram=0;
const HOUR=3600000;
function condition(code){if(code===null||code===undefined||!Number.isFinite(Number(code)))return 'Keine Wetterangabe';const n=Number(code);return n===0?'klar':n<=3?'bewölkt':[45,48].includes(n)?'Nebel':n>=95?'Gewitter':(n>=71&&n<=77)||[85,86].includes(n)?'Schnee':n>=51?'Regen':'Wetterlage';}
function finite(x){return x!==null&&x!==undefined&&Number.isFinite(Number(x))?Number(x):null;}
function parseWeather(data,at=new Date().toISOString()){
 if(!Array.isArray(data?.daily?.time)||!Array.isArray(data?.hourly?.time))throw Error('Wetterantwort ist unvollständig.');
 const result=new Map();
 data.daily.time.forEach((date,i)=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return;const min=finite(data.daily.temperature_2m_min?.[i]),max=finite(data.daily.temperature_2m_max?.[i]);
 const hourly=data.hourly.time.flatMap((time,j)=>{if(!time.startsWith(date+'T'))return[];const start=Number(time.slice(11,13))+Number(time.slice(14,16))/60,temp=finite(data.hourly.temperature_2m?.[j]);if(!Number.isFinite(start)||temp===null)return[];return[{start,end:start+1,temp,code:data.hourly.weather_code?.[j],condition:condition(data.hourly.weather_code?.[j]),rainProbability:finite(data.hourly.precipitation_probability?.[j]),windSpeed:finite(data.hourly.wind_speed_10m?.[j])}];});
 result.set(date,{date,temp:min!==null&&max!==null?(min+max)/2:null,min,max,condition:condition(data.daily.weather_code?.[i]),code:data.daily.weather_code?.[i],hourly,source:'Open-Meteo · Werne',fetchedAt:at});});
 return result;
}
function validProgram(payload){
 if(payload?.schema!=='KC_DP_CONTEXT_V1'||payload.eventId!==K.eventConfig?.eventId||payload.programPublication?.published!==true||payload.programPublication?.complete!==true||!Array.isArray(payload.program))throw Error('Das Tagesprogramm ist im PC-Manager noch nicht für DP2 freigegeben.');
 const from=payload.programPublication.from,to=payload.programPublication.to;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(from||'')||!/^\d{4}-\d{2}-\d{2}$/.test(to||'')||to<from)throw Error('Der Programmzeitraum fehlt.');
 const program=payload.program.map(p=>{if(typeof p.title!=='string'||!p.title.trim()||!/^\d{4}-\d{2}-\d{2}$/.test(p.date||'')||p.date<from||p.date>to||!Number.isFinite(p.start)||p.start<0||p.start>=24||!(p.end===null||(Number.isFinite(p.end)&&p.end>p.start&&p.end<=24)))throw Error('Programmdaten sind ungültig.');
 const missingEnd=p.end===null;return {...p,title:p.title.slice(0,240),missingEnd,frontDelta:missingEnd?0:['+','++'].includes(p.impact)?1:p.impact==='+++'?2:0,backDelta:!missingEnd&&['++','+++'].includes(p.impact)?1:0,impact:missingEnd?'0':['+','++','+++'].includes(p.impact)?p.impact:'0',source:'PC Manager',leadMinutes:30,lagMinutes:30};});
 return {...payload,program};
}
function forDay(day){
 if(!day)return day;
 const forecast=state.forecast.get(day.date),old=day.weather||{},stale=forecast&&Date.now()-Date.parse(forecast.fetchedAt)>2*HOUR;
 const manual=old.source==='planner_override'||old.source==='manual'||old.factorSource==='planner';
 const weather=forecast&&!stale?{...forecast,factor:manual?Number(old.factor||1):1,impact:manual?old.impact:'neutral',factorSource:manual?'planner':'unrated'}:manual?old:{condition:stale?'Wetterdaten veraltet':'Noch keine Vorhersage für diesen Tag',factor:1,source:'unbekannt'};
 const pub=state.publication,covered=pub&&day.date>=pub.programPublication.from&&day.date<=pub.programPublication.to;
 const local=(day.program||[]).filter(p=>p.source!=='PC Manager'&&p.source!=='manager_context');
 const program=covered?[...pub.program.filter(p=>p.date===day.date&&!local.some(x=>x.title===p.title&&x.start===p.start)),...local]:day.program||[];
 return {...day,weather,program,programStatus:covered?(program.length?'loaded':'empty'):'missing',programUpdatedAt:pub?.updatedAt||null};
}
async function weather(){const response=await fetch(WEATHER_URL,{signal:AbortSignal.timeout(15000),cache:'no-store'});if(!response.ok)throw Error('Wetterdienst antwortet nicht ('+response.status+').');const parsed=parseWeather(await response.json());state.forecast=parsed;lastWeather=Date.now();state.weather={status:'ready',checkedAt:new Date().toISOString(),error:null};}
async function program(){
 const c=K.integrationConfig?.supabase||{},sb=K.supabaseConnection;await sb.ensureSession();const token=sb.sessionSnapshot()?.access_token;if(!token)throw Error('Für das Tagesprogramm bitte bei Supabase anmelden.');
 const query='/rest/v1/kc_manager_state_sections?select=payload,version,updated_at&org_id=eq.'+encodeURIComponent(c.orgId)+'&section_key=eq.dienstplan_context';
 const response=await fetch(new URL(query,c.url),{headers:{apikey:c.publishableKey,Authorization:'Bearer '+token},signal:AbortSignal.timeout(15000),cache:'no-store'});
 if(!response.ok)throw Error('Programmübergabe nicht erreichbar ('+response.status+').');const rows=await response.json();if(!Array.isArray(rows)||!rows[0])throw Error('Im PC-Manager fehlt noch die Freigabe „Für DP2 freigeben“.');
 const next=validProgram(rows[0].payload);state.publication={...next,updatedAt:rows[0].updated_at,version:rows[0].version};lastProgram=Date.now();state.program={status:'ready',checkedAt:new Date().toISOString(),error:null};
}
function allowed(){return K.workMode===true&&K.planningDataReady!==false&&K.auth?.has?.('roster.plan.view_draft')&&K.supabaseConnection?.state?.authStatus==='authenticated';}
async function refresh({force=false}={}){
 if(pending)return pending;if(!allowed())return{skipped:true};state.busy=true;
 pending=(async()=>{const jobs=[];if(force||Date.now()-lastWeather>30*60000)jobs.push(weather().catch(e=>{state.weather={...state.weather,status:'error',error:e.message};lastWeather=Date.now()-29*60000;}));if(force||Date.now()-lastProgram>60000)jobs.push(program().catch(e=>{state.program={...state.program,status:'error',error:e.message};lastProgram=Date.now();}));await Promise.all(jobs);window.dispatchEvent(new CustomEvent('KC_DP_CONTEXT_UPDATED'));return state;})().finally(()=>{state.busy=false;pending=null;});return pending;
}
const original=K.requirementFor;
K.requirementFor=(day,time)=>{const context=forDay(day);return original({...context,program:context.program.filter(p=>!p.missingEnd)},time);};
K.operationalContext={state,forDay,refresh,parseWeather,validProgram,WEATHER_URL};
window.addEventListener('KC_DP_MANAGER_AUTO_SYNC',()=>refresh());setInterval(()=>refresh(),30000);setTimeout(()=>refresh(),2000);
})();
