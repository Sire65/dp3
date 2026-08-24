(function(){
 const K=window.KCDP=window.KCDP||{};
 const state={weather:null,program:null,lastWeatherAt:null,lastProgramAt:null,errors:[]};
 function setWeatherProvider(p){state.weather=p&&typeof p.fetch==='function'?p:null;}
 function setProgramProvider(p){state.program=p&&typeof p.fetch==='function'?p:null;}
 async function refreshWeather(date){if(!state.weather)throw new Error('Kein WeatherProvider verbunden.');try{const x=await state.weather.fetch({date,eventId:K.eventConfig?.eventId});const d=K.days.find(q=>q.date===date);if(!d)throw new Error('Tag nicht gefunden.');d.weather={...d.weather,...x,fetchedAt:x.fetchedAt||new Date().toISOString(),source:x.source||'provider'};state.lastWeatherAt=new Date().toISOString();return d.weather;}catch(e){state.errors.push({at:new Date().toISOString(),type:'weather',message:e.message});throw e;}}
 async function refreshProgram(date){if(!state.program)throw new Error('Kein ProgramProvider verbunden.');try{const x=await state.program.fetch({date,eventId:K.eventConfig?.eventId});const d=K.days.find(q=>q.date===date);if(!d)throw new Error('Tag nicht gefunden.');d.program=Array.isArray(x)?x:(x.items||[]);state.lastProgramAt=new Date().toISOString();return d.program;}catch(e){state.errors.push({at:new Date().toISOString(),type:'program',message:e.message});throw e;}}
 async function refreshDay(date){const out={};if(state.weather)out.weather=await refreshWeather(date);if(state.program)out.program=await refreshProgram(date);return out;}
 K.contextProviders={version:'0.14.0',state,setWeatherProvider,setProgramProvider,refreshWeather,refreshProgram,refreshDay,hasWeather:()=>!!state.weather,hasProgram:()=>!!state.program};
 if(window.KCDPWeatherProvider)setWeatherProvider(window.KCDPWeatherProvider);if(window.KCDPProgramProvider)setProgramProvider(window.KCDPProgramProvider);
})();
