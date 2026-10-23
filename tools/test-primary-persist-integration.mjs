import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
const source=await readFile('src/ui/app.js','utf8'),part=source.slice(source.indexOf('let persistRunning='),source.indexOf('function day(){'));let local=0,cloud=0,recovery=0,lastMessage='';
const K={planningDataReady:false,days:[],shifts:[],wishes:[],standby:[],people:[],storage:{putMany:async()=>{local++;return {written:1};}},recovery:{checkpoint:async()=>{recovery++;}},cloudPrimary:{enabled:()=>true,save:async entries=>{cloud++;assert(entries.some(([k])=>k==='demandMatrix'));return {confirmed:true};}}};
vm.runInContext(part,vm.createContext({K,traffic:()=>{},setIdbStatus:()=>{},updateUndoRedoUI:()=>{},msg:(message)=>{lastMessage=message;},undoAction:null,Promise}));
await assert.rejects(K.persistAll(),/noch nicht/);assert.equal(cloud,0);K.planningDataReady=true;await K.persistAll();assert.equal(cloud,1);assert.equal(local,0);assert.equal(recovery,0);assert.match(lastMessage,/In Supabase/);
K.cloudPrimary.save=async()=>({offline:true,confirmed:false});await K.persistAll();assert.match(lastMessage,/Nur lokal/);assert.equal(local,0);
K.cloudPrimary.save=async()=>{throw new Error('stale revision');};await assert.rejects(K.persistAll(),/stale revision/);assert.match(lastMessage,/nicht bestätigt/);assert.equal(local,0);
K.cloudPrimary.enabled=()=>false;await K.persistAll();assert.equal(local,1);assert.equal(recovery,1);console.log('PASS real application persistence: startup gate, primary branch, offline warning, conflict propagation, legacy member path.');
