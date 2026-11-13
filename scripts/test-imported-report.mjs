import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';

// Click the real entry UI and validate its payload with the real server parser.
// Persistence and fetch are isolated in memory: this script never contacts Supabase.
await mkdir('.sites-runtime/tests',{recursive:true});
await build({stdin:{contents:"export {parseReport,failure} from './lib/server';export {today} from './lib/domain';export {metricsFromCells} from './lib/metrics';",resolveDir:process.cwd(),loader:'ts'},bundle:true,packages:'external',platform:'node',format:'esm',outfile:'.sites-runtime/tests/imported-server.mjs',tsconfig:'tsconfig.json',plugins:[{name:'server-adapters',setup(builder){
 builder.onResolve({filter:/^(server-only|next\/headers)$/},args=>({path:args.path,namespace:'test-server'}));
 builder.onLoad({filter:/.*/,namespace:'test-server'},args=>({contents:args.path==='server-only'?'':'export const headers=()=>{throw Error("Unexpected session access")};export const cookies=()=>{throw Error("Unexpected session access")};',loader:'js'}));
}}]});
const api=await import(pathToFileURL(process.cwd()+'/.sites-runtime/tests/imported-server.mjs'));
const dom=new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>',{url:'http://localhost:3000',pretendToBeVisual:true});
for(const key of ['window','document','HTMLElement','HTMLInputElement','Element','SVGElement','Node','Event','MouseEvent','MutationObserver','getComputedStyle'])globalThis[key]=key==='getComputedStyle'?dom.window.getComputedStyle.bind(dom.window):dom.window[key];
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
window.matchMedia=query=>({matches:query.includes('prefers-reduced-motion'),media:query,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
globalThis.requestAnimationFrame=window.requestAnimationFrame.bind(window);
globalThis.cancelAnimationFrame=window.cancelAnimationFrame.bind(window);
globalThis.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};
await build({entryPoints:['components/local-factory.tsx'],bundle:true,packages:'external',platform:'node',format:'esm',outfile:'.sites-runtime/tests/imported-ui.mjs',tsconfig:'tsconfig.json',plugins:[{name:'next-ui-adapters',setup(builder){
 builder.onResolve({filter:/^next\/(image|dynamic)$/},args=>({path:args.path,namespace:'test-next'}));
 builder.onLoad({filter:/.*/,namespace:'test-next'},args=>({contents:args.path.endsWith('image')?"import React from 'react';export default function Image({unoptimized,...props}){return React.createElement('img',props);}":"export default function dynamic(){return function DynamicComponent(){return null;};}",loader:'js',resolveDir:process.cwd()}));
}}]});
const React=await import('react');
const {createRoot}=await import('react-dom/client');
const {act}=React;
const {default:App}=await import(pathToFileURL(process.cwd()+'/.sites-runtime/tests/imported-ui.mjs'));
const machine={id:'11111111-1111-4111-8111-111111111111',name:'IMPORT TEST',department:'injection',status:'unknown',assetKind:'production',x:50,y:50};
const state={machines:[machine],reports:[],actions:[],fiveSTags:[],settings:{green:95,yellow:85,metricApproved:true},connected:true};
const attempts=[],saved=[];
let rejectStorage=false;
globalThis.fetch=async(url,options={})=>{
 if(options.method==='POST'&&String(url)==='/api/factory'){
  const body=JSON.parse(options.body);attempts.push(body);
  try{
   assert.equal(body.kind,'report');
   const report=api.parseReport(body.value),current=state.reports.find(r=>r.id===report.id);
   if(body.value.updated_at&&current?.updated_at!==body.value.updated_at)throw Error('Ce rapport a été modifié ailleurs. Rechargez-le avant de corriger.');
   if(rejectStorage)throw Error('Enregistrement temporairement indisponible. Réessayez.');
   const stored={...report,updated_at:new Date(Date.now()+saved.length).toISOString()};state.reports=[stored];saved.push(stored);
   return Response.json({ok:true});
  }catch(error){return api.failure(error);}
 }
 if(String(url)==='/api/session')return Response.json({session:{role:'entry',automatic:true},automatic:true,storage:'supabase'});
 if(String(url)==='/api/factory')return Response.json(state);
 if(String(url).startsWith('/api/audit'))return Response.json({versions:[]});
 throw Error('Unexpected request '+url);
};
const root=createRoot(document.getElementById('root'));
let passed=0,revision=0;
const test=(name,fn)=>{fn();passed++;console.log('PASS '+name);};
const button=text=>[...document.querySelectorAll('button')].find(node=>node.textContent.trim()===text);
const click=async(element)=>{assert.ok(element,'Missing clickable element');await act(async()=>{element.dispatchEvent(new MouseEvent('click',{bubbles:true}));});};
const setInput=async(input,value)=>{assert.ok(input,'Missing input');await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,String(value));input.dispatchEvent(new Event('input',{bubbles:true}));});};
const fixture=()=>{const cells={A:machine.name,C:'Équipe de jour',E:'ORIGINAL',AD:130,AF:8,AI:1,AJ:1300,AR:20,G:'Texte importé conservé'};return {id:'22222222-2222-4222-8222-222222222222',date:api.today(),department:'injection',shift:'Équipe de jour',machine_id:machine.id,reference:'ORIGINAL',status:'draft',cells,metrics:api.metricsFromCells('injection',cells),updated_at:'2026-01-01T00:00:00.000Z'};};
const mount=async(report)=>{state.reports=[report];rejectStorage=false;await act(async()=>{root.render(React.createElement(App,{key:++revision}));});};
try{
 await mount(fixture());
 await setInput(document.querySelector('input[placeholder="Saisir la référence du produit"]'),'CORRIGÉE');
 await click(button('Enregistrer le brouillon'));
 test('imported draft saves without hourly data and preserves source values, version and corrected reference',()=>{assert.equal(saved.length,1);assert.equal(saved.at(-1).workshop,undefined);assert.equal(saved.at(-1).cells.AJ,1300);assert.equal(saved.at(-1).cells.G,'Texte importé conservé');assert.equal(saved.at(-1).reference,'CORRIGÉE');assert.equal(saved.at(-1).cells.E,'CORRIGÉE');assert.equal(attempts.at(-1).value.updated_at,'2026-01-01T00:00:00.000Z');});
 await click(button('Valider pour la réunion'));
 test('complete imported report validates through the real server parser without inventing hourly detail',()=>{assert.equal(saved.length,2);assert.equal(saved.at(-1).status,'validated');assert.equal(saved.at(-1).workshop,undefined);assert.equal(saved.at(-1).metrics.actual,1300);assert.match(document.querySelector('.document-status').textContent,/Validé/);});
 const incomplete=fixture();delete incomplete.cells.AD;
 await mount(incomplete);await click(button('Enregistrer le brouillon'));
 test('incomplete imported values still save as a draft',()=>{assert.equal(saved.length,3);assert.equal(saved.at(-1).status,'draft');assert.equal(saved.at(-1).cells.AD,undefined);});
 await click(button('Valider pour la réunion'));
 test('incomplete validation fails with the precise missing Excel column and preserves the saved draft',()=>{assert.equal(saved.length,3);assert.match(document.querySelector('.toast-message').textContent,/champ AD.*obligatoire/);assert.equal(state.reports[0].status,'draft');});
 await mount(fixture());state.reports[0]={...state.reports[0],updated_at:'2026-01-02T00:00:00.000Z'};
 await setInput(document.querySelector('input[placeholder="Saisir la référence du produit"]'),'VERSION LOCALE');await click(button('Enregistrer le brouillon'));
 test('stale-version rejection retains the local correction and does not overwrite the latest report',()=>{assert.equal(saved.length,3);assert.match(document.querySelector('.toast-message').textContent,/modifié ailleurs/);assert.equal(document.querySelector('input[placeholder="Saisir la référence du produit"]').value,'VERSION LOCALE');assert.equal(state.reports[0].reference,'ORIGINAL');});
 await mount(fixture());rejectStorage=true;await click(button('Enregistrer le brouillon'));
 test('storage failure is displayed and is never reported as a successful draft save',()=>{assert.equal(saved.length,3);assert.match(document.querySelector('.toast-message').textContent,/temporairement indisponible/);});
 for(const [column,value] of [['AD',-1],['AF','invalide'],['AJ',-1]]){const invalid=fixture();invalid.cells[column]=value;assert.throws(()=>api.parseReport({...invalid,status:'validated'}));passed++;console.log('PASS server refuses invalid imported numeric field '+column);}
 const emptyReference=fixture();assert.throws(()=>api.parseReport({...emptyReference,reference:'',status:'validated'}),/référence produit/);passed++;console.log('PASS server requires the product reference for validation');
 console.log(JSON.stringify({passed,networkRequests:0,persistedTestRecords:0}));
}finally{await act(async()=>{root.unmount();});dom.window.close();}
