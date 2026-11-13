import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';

// Isolated DOM tests: API requests are mocked; no test records reach Supabase.
const dom=new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>',{url:'http://localhost:3000',pretendToBeVisual:true});
for(const key of ['window','document','HTMLElement','HTMLInputElement','Element','SVGElement','Node','Event','MouseEvent','MutationObserver','getComputedStyle'])globalThis[key]=key==='getComputedStyle'?dom.window.getComputedStyle.bind(dom.window):dom.window[key];
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
window.matchMedia=query=>({matches:query.includes('prefers-reduced-motion'),media:query,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
globalThis.requestAnimationFrame=window.requestAnimationFrame.bind(window);
globalThis.cancelAnimationFrame=window.cancelAnimationFrame.bind(window);
globalThis.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};
let microphoneResult,microphoneEnd;
window.SpeechRecognition=class{start(){microphoneResult=event=>this.onresult?.(event);microphoneEnd=()=>this.onend?.();}stop(){this.onend?.();}abort(){this.onend?.();}};
await mkdir('.sites-runtime/tests',{recursive:true});
await build({entryPoints:['components/local-factory.tsx'],bundle:true,packages:'external',platform:'node',format:'esm',outfile:'.sites-runtime/tests/industrial-ui.mjs',tsconfig:'tsconfig.json',plugins:[{
 name:'next-ui-test-adapters',setup(build){
  build.onResolve({filter:/^next\/(image|dynamic)$/},args=>({path:args.path,namespace:'test-next'}));
  build.onLoad({filter:/.*/,namespace:'test-next'},args=>({contents:args.path.endsWith('image')?"import React from 'react';export default function Image({unoptimized,...props}){return React.createElement('img',props);}":"export default function dynamic(){return function DynamicComponent(){return null;};}",loader:'js',resolveDir:process.cwd()}));
 }
}]});
const React=await import('react');
const {createRoot}=await import('react-dom/client');
const {act}=React;
const {default:App}=await import(pathToFileURL(process.cwd()+'/.sites-runtime/tests/industrial-ui.mjs'));
const machine={id:'11111111-1111-4111-8111-111111111111',name:'TEST UI',department:'injection',status:'unknown',assetKind:'production',x:50,y:50};
const state={machines:[machine],reports:[],actions:[],fiveSTags:[],settings:{green:85,yellow:65,metricApproved:false},connected:true};
const writes=[];
let fiveSError=null,auditError=null,reportError=null,productError=null;
globalThis.fetch=async(url,options={})=>{
 if(options.method==='POST'){
  const body=JSON.parse(options.body);writes.push(body);
  if(body.kind==='product'){
   if(productError)return Response.json({error:productError},{status:409});
   const saved={...body.value,updated_at:new Date().toISOString()};state.products=[...(state.products||[]).filter(product=>product.id!==saved.id),saved];
  }
  if(String(url)==='/api/five-s/audits'){
   if(auditError)return Response.json({error:auditError},{status:409});
   state.fiveSAudits=[{...body,updated_at:new Date().toISOString()}];
  }
  if(String(url)==='/api/five-s'){
   if(fiveSError)return Response.json({error:fiveSError},{status:409});
   const saved={...body,updated_at:new Date().toISOString()};state.fiveSTags=[...state.fiveSTags.filter(tag=>tag.id!==body.id),saved];
  }
  if(body.kind==='report'){if(reportError)return Response.json({error:reportError},{status:400});const saved={...body.value,updated_at:new Date().toISOString()};state.reports=[saved];}
  return Response.json({ok:true});
 }
 if(String(url).includes('/api/session'))return Response.json({session:{role:'entry',automatic:true},automatic:true,storage:'supabase'});
 if(String(url).includes('/api/factory'))return Response.json(state);
 if(String(url).includes('/api/audit'))return Response.json({versions:[]});
 throw new Error('Unexpected request '+url);
};
const root=createRoot(document.getElementById('root'));
let passed=0;
const test=(name,fn)=>{fn();passed++;console.log('PASS '+name);};
const click=async(element)=>{assert.ok(element,'Missing clickable element');await act(async()=>{element.dispatchEvent(new MouseEvent('click',{bubbles:true}));});};
const button=text=>[...document.querySelectorAll('button')].find(node=>node.textContent.trim()===text);
const setInput=async(input,value)=>{assert.ok(input,'Missing input');await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,String(value));input.dispatchEvent(new Event('input',{bubbles:true}));});};
try{
 await act(async()=>{root.render(React.createElement(App));});
 test('entry is light with the original MYC logo and accessible navigation',()=>{assert.equal(document.querySelector('.premium-factory').dataset.theme,'light');assert.ok(document.querySelector('img[src="/myc-logo.jpg"]'));assert.equal(document.querySelector('.industrial-nav [aria-current="page"]').textContent,'Saisie');assert.ok(document.querySelector('.skip-to-content'));});
 test('new entry opens directly on totals with shift duration and explicit zero rejects',()=>{assert.equal(document.querySelector('.production-grid').dataset.entryMode,'totals');assert.equal(document.querySelector('.entry-mode-switch'),null);assert.equal(document.querySelector('.quick-production'),null);assert.equal(document.querySelector('input[aria-label="Temps planifié — total de l’équipe"]').value,'480');assert.equal(document.querySelector('input[aria-label="Rebuts — total de l’équipe"]').value,'0');assert.equal(document.querySelectorAll('.hourly-grid').length,1);assert.equal(document.querySelectorAll('.hourly-grid .total-column input').length,5);});
 await setInput(document.querySelector('input[aria-label="Production conforme — total de l’équipe"]'),500);
 await setInput(document.querySelector('input[aria-label="Rebuts — total de l’équipe"]'),20);
 await setInput(document.querySelector('input[aria-label="Temps planifié — total de l’équipe"]'),480);
 await setInput(document.querySelector('input[aria-label="Arrêts — total de l’équipe"]'),30);
 await setInput(document.querySelector('input[placeholder="Saisir la référence du produit"]'),'TEST-UI');
 await setInput(document.querySelector('input[aria-label^="Production conforme 06"]'),10);
 test('editing an hour uses hourly sums while keeping the direct totals separately',()=>{assert.equal(document.querySelector('.production-grid').dataset.entryMode,'hourly');assert.equal(document.querySelector('input[aria-label="Production conforme — total de l’équipe"]').value,'10');});
 await setInput(document.querySelector('input[aria-label="Production conforme — total de l’équipe"]'),500);
 test('editing TOTAL restores direct entry in the same table without adding the hourly values',()=>{assert.equal(document.querySelector('.production-grid').dataset.entryMode,'totals');assert.equal(document.querySelector('input[aria-label="Production conforme — total de l’équipe"]').value,'500');assert.equal(document.querySelector('input[aria-label^="Production conforme 06"]').value,'10');});
 await click(document.querySelector('.cause-editor .text-action'));
 await click(document.querySelector('.cause-editor .cause-microphone'));
 await act(async()=>{microphoneResult({resultIndex:0,results:[{isFinal:true,0:{transcript:'20 pièces rayures'}}]});microphoneEnd();});
 test('dictation still updates cause and numeric quantity together',()=>{assert.equal(document.querySelector('.cause-editor input[placeholder="Cause / type de défaut"]').value,'rayures');assert.equal(document.querySelector('.cause-editor input[type="number"]').value,'20');});
 await click(button('Réunion'));
 test('navigation with unsaved inputs opens the existing confirmation and preserves inputs',()=>{assert.ok(document.querySelector('.unsaved-dialog'));assert.equal(document.querySelector('.premium-factory').dataset.workspace,'entry');});
 await click(button('Continuer la saisie'));
 test('cancel leaves the typed production intact',()=>assert.equal(document.querySelector('input[aria-label="Production conforme — total de l’équipe"]').value,'500'));
 await click(button('Valider pour la réunion'));
 test('validation saves the unchanged report structure and animates only its status',()=>{assert.equal(writes.length,1);assert.equal(writes[0].value.workshop.totals.good,500);assert.equal(writes[0].value.workshop.entryMode,'totals');assert.equal(writes[0].value.status,'validated');assert.match(document.querySelector('.document-status').textContent,/Validé/);});
 await click(button('Historique'));
 test('saved report history still opens in an accessible dialog',()=>assert.ok(document.querySelector('[role="dialog"][aria-label="Historique de production"]')));
 await click(document.querySelector('.dialog-title .icon-button'));
 await click(button('Réunion'));
 test('meeting opens dark, and empty dates retain unavailable KPI values',()=>{assert.equal(document.querySelector('.premium-factory').dataset.theme,'dark');assert.equal(document.querySelector('.meeting-kpis article strong').textContent,'—');assert.ok(document.querySelector('.meeting-kpis').textContent.includes('TRS / OEE'));});
 await click(button('Aujourd’hui'));
 test('validated totals appear in meeting without invented hourly production',()=>{assert.ok(document.querySelector('.meeting-table').textContent.includes('500'));assert.ok(document.querySelector('.manual-totals-note'));assert.equal(document.querySelector('.meeting-hourly tbody tr td').textContent,'—');});
 await click(document.querySelector('.theme-toggle'));
 test('meeting theme toggle does not alter loaded reports',()=>{assert.equal(document.querySelector('.premium-factory').dataset.theme,'light');assert.ok(document.querySelector('.meeting-table').textContent.includes('500'));assert.equal(writes.length,1);});
 const departments=document.querySelectorAll('.department-switch button');
 await click(departments[1]);
 test('all production departments now expose their own workspace without sample indicators',()=>{assert.equal(document.querySelector('.department-coming-soon'),null);assert.ok(document.querySelector('.meeting-kpis'));assert.equal(document.querySelector('.meeting-kpis article strong').textContent,'—');});
 await click(document.querySelector('.department-switch button'));
 await click(button('Saisie'));
 test('return to entry restores saved totals and light mode',()=>{assert.equal(document.querySelector('.premium-factory').dataset.theme,'light');assert.equal(document.querySelector('input[aria-label="Production conforme — total de l’équipe"]').value,'500');});
 await click(button('Machines'));
 test('3D supervision shows only actual inventory counts, including unknown states',()=>{assert.equal(document.querySelector('.twin-total strong').textContent,'1');const rows=[...document.querySelectorAll('.twin-state-counts>div')];assert.equal(rows.find(row=>row.textContent.includes('En marche')).querySelector('dd').textContent,'0');assert.equal(rows.find(row=>row.textContent.includes('État à renseigner')).querySelector('dd').textContent,'1');});
 await click(document.querySelector('.twin-minimap button'));
 test('minimap selection opens the real equipment panel and enables camera focus',()=>{assert.ok(document.querySelector('.selected-machine-panel').textContent.includes('TEST UI'));assert.equal(document.querySelector('button[aria-label="Centrer sur la machine sélectionnée"]').disabled,false);assert.equal(document.querySelector('#twin-machine-select').value,machine.id);});
 await click(document.querySelector('button[aria-label="Vue du dessus"]'));
 test('camera controls switch the selected projection without changing machine data',()=>{assert.equal(document.querySelector('button[aria-label="Vue du dessus"]').getAttribute('aria-pressed'),'true');assert.equal(writes.length,1);});
 await click(button('Plan 2D'));
 test('original editable 2D plan remains available with preserved positions',()=>{assert.ok(document.querySelector('.floor-plan'));assert.equal(document.querySelector('.plan-marker').style.left,'50%');assert.equal(document.querySelector('.twin-sidebar'),null);});
 await click(button('Vue 3D'));
 await click(document.querySelector('.selected-machine-panel .button:last-child'));
 test('equipment record editing remains accessible from the 3D selection',()=>assert.ok(document.querySelector('[role="dialog"][aria-label="Fiche machine / équipement"]')));
 await click(document.querySelector('.dialog-title .icon-button'));
 await click(button('5S usine'));
 test('5S opens a reconstructed facility with both sites and source plans behind a disclosure',()=>{
  assert.ok(document.querySelector('.facility-shell'));assert.equal(document.querySelectorAll('.facility-machine-list>button').length,1);
  assert.equal(document.querySelector('.facility-views button[aria-pressed=true]').textContent,'Maquette 3D');
  assert.equal(document.querySelector('.facility-sources').open,false);assert.equal(document.querySelectorAll('.facility-sources img').length,0);
 });
 await click(document.querySelector('.facility-views button:last-child'));
 test('the 2D reconstruction provides keyboard-accessible selectable rooms',()=>{
  assert.ok(document.querySelector('svg.facility-vector'));assert.equal(document.querySelectorAll('.facility-vector-zone[tabindex="0"]').length,15);
 });
 await click(document.querySelector('.facility-list-tabs button:last-child'));
 await click(document.querySelector('.facility-zone-list>button'));
 await click(document.querySelector('.facility-create'));
 const fiveField=text=>[...document.querySelectorAll('.five-s-form label')].find(label=>label.firstChild?.textContent===text)?.querySelector('input,select,textarea');
 test('creating from a room pre-fills location, department and a real plan position',()=>{
  assert.equal(fiveField('Nom de la zone, du poste ou de la machine').value,'Atelier d’injection plastique');
  assert.equal(fiveField('Département ou espace commun').value,'injection');assert.match(document.querySelector('.five-s-form-position').textContent,/Emplacement repéré/);
 });
 await setInput(fiveField('Matériel ou objet à identifier'),'Outil à ranger');await setInput(fiveField('Responsable'),'Responsable test');
 await click(button('Enregistrer l’étiquette'));
 test('5S save refreshes the register, zone counters and 2D pin from the mocked persisted record',()=>{
  assert.equal(state.fiveSTags.length,1);assert.equal(state.fiveSTags[0].location,'Atelier d’injection plastique');
  assert.equal(document.querySelectorAll('.facility-vector-tag').length,1);assert.match(document.querySelector('.facility-zone-tags').textContent,/Outil à ranger/);
  assert.match(document.querySelector('.five-s-record').textContent,/Outil à ranger/);assert.equal(document.querySelectorAll('.five-s-form').length,0);
 });
 await click(document.querySelector('.facility-vector-tag'));
 await click(button('Repositionner'));
 test('reposition mode locks the site switch and preserves the pending form',()=>{
  assert.ok(document.querySelector('.facility-placement'));assert.ok([...document.querySelectorAll('.facility-sites button')].every(button=>button.disabled));
 });
 await click(document.querySelector('.facility-placement button'));
 test('cancelling position selection restores the existing draft without a write',()=>{assert.equal(fiveField('Matériel ou objet à identifier').value,'Outil à ranger');assert.equal(state.fiveSTags.length,1);});
 await click(button('Repositionner'));
 await click([...document.querySelectorAll('.facility-zone-list>button')].find(button=>button.textContent.includes('Matières brutes')));
 test('moving a tag to another zone updates its location before saving',()=>assert.equal(fiveField('Nom de la zone, du poste ou de la machine').value,'Dépôt matières brutes'));
 fiveSError='Cette étiquette a été modifiée ailleurs.';
 await click(button('Enregistrer l’étiquette'));
 test('a rejected write leaves the draft visible and preserves the previously saved location',()=>{
  assert.match(document.querySelector('.five-s-error').textContent,/modifiée ailleurs/);assert.equal(state.fiveSTags[0].location,'Atelier d’injection plastique');assert.ok(document.querySelector('.five-s-form'));
 });
 fiveSError=null;
 await act(async()=>{const select=fiveField('État du suivi');select.value='Clôturée';select.dispatchEvent(new Event('change',{bubbles:true}));});
 await click(button('Enregistrer l’étiquette'));
 test('closing a positioned tag retains its pin and register entry with the saved status',()=>{
  assert.equal(state.fiveSTags[0].status,'Clôturée');assert.equal(state.fiveSTags[0].location,'Dépôt matières brutes');assert.equal(document.querySelectorAll('.facility-vector-tag').length,1);assert.match(document.querySelector('.five-s-record').textContent,/Clôturée/);
 });
 await click(document.querySelector('.facility-sites button:last-child'));
 test('switching to metallisation renders its distinct layout and filters unrelated tags',()=>{assert.equal(document.querySelectorAll('.facility-zone-list>button').length,18);assert.equal(document.querySelectorAll('.facility-vector-tag').length,0);assert.match(document.querySelector('.facility-stage-label').textContent,/métallisation/);});
 await click(document.querySelector('.facility-sites button:first-child'));
 await click(document.querySelector('.facility-list-tabs button:first-child'));
 await click(document.querySelector('.facility-vector-machine'));
 test('a map machine selects its inventory identity instead of the whole workshop',()=>{
  assert.equal(document.querySelector('.facility-machine-detail h3').textContent,machine.name);assert.equal(document.querySelector('.facility-vector-machine').getAttribute('aria-pressed'),'true');assert.equal(document.querySelectorAll('.facility-vector-machine').length,1);
 });
 await click(document.querySelector('.facility-views button:first-child'));
 test('switching to 3D preserves the exact selected machine and audit action',()=>{assert.equal(document.querySelector('.facility-machine-detail h3').textContent,machine.name);assert.ok(document.querySelector('.facility-audit-create'));});
 await click(document.querySelector('.facility-audit-create'));
 const auditField=text=>[...document.querySelectorAll('.five-s-audit-form label')].find(label=>label.firstChild?.textContent===text)?.querySelector('input,select,textarea');
 const setSelect=async(select,value)=>{assert.ok(select,'Missing select');await act(async()=>{select.value=String(value);select.dispatchEvent(new Event('change',{bubbles:true}));});};
 test('audit planning fixes the machine automatically with only the schedule and owner to fill',()=>{assert.equal(document.querySelector('.audit-machine-banner h3').textContent,machine.name);assert.equal(auditField('Statut de l’audit').value,'Planifié');assert.equal(document.querySelectorAll('.five-s-audit-form select').length,6);assert.equal(state.fiveSAudits?.length||0,0);});
 await setInput(auditField('Responsable de l’audit'),'Auditeur UI');await setInput(auditField('Date de l’audit'),'2026-11-15');await setInput(auditField('Heure (facultatif)'),'09:00');
 await click(document.querySelector('.five-s-audit-form button[type="submit"]'));
 test('planning saves a separate audit linked to the selected machine and refreshes its calendar',()=>{assert.equal(state.fiveSAudits.length,1);assert.equal(state.fiveSAudits[0].machine_id,machine.id);assert.equal(state.fiveSAudits[0].scheduled_date,'2026-11-15');assert.equal(state.fiveSAudits[0].scheduled_time,'09:00');assert.equal(state.fiveSAudits[0].checks.trier,null);assert.match(document.querySelector('.facility-machine-audits').textContent,/Auditeur UI/);assert.match(document.querySelector('.audit-register-list').textContent,/Planifié/);assert.equal(document.querySelector('.five-s-audit-form'),null);});
 await click(document.querySelector('.facility-machine-audits button'));
 await setSelect(auditField('Statut de l’audit'),'Terminé');
 await click(button('Enregistrer l’audit'));
 test('an audit cannot be completed while its five S remain unanswered',()=>{assert.match(document.querySelector('.five-s-audit-form .five-s-error').textContent,/cinq S/);assert.equal(state.fiveSAudits[0].status,'Planifié');});
 for(const [index,select] of [...document.querySelectorAll('.audit-criterion select')].entries())await setSelect(select,index%2?1:2);
 auditError='Cet audit a été modifié ailleurs.';await click(button('Enregistrer l’audit'));
 test('failed audit saving retains the full checklist and the saved original',()=>{assert.match(document.querySelector('.five-s-audit-form .five-s-error').textContent,/modifié ailleurs/);assert.equal(document.querySelector('.audit-criterion select').value,'2');assert.equal(state.fiveSAudits[0].status,'Planifié');});
 auditError=null;await click(button('Enregistrer l’audit'));
 test('a completed machine audit keeps all answers and displays the calculated score',()=>{assert.equal(state.fiveSAudits[0].status,'Terminé');assert.equal(state.fiveSAudits[0].machine_id,machine.id);assert.ok(writes.at(-1).updated_at);assert.match(document.querySelector('.audit-register-list').textContent,/80 %/);assert.match(document.querySelector('.facility-machine-audits').textContent,/Terminé/);});
 const imported={id:'22222222-2222-4222-8222-222222222222',date:'2026-11-05',department:'injection',shift:'Équipe de jour',machine_id:machine.id,reference:'IMPORT-ORIGINAL',status:'draft',cells:{A:'TEST UI',C:'Équipe de jour',E:'IMPORT-ORIGINAL',AD:130,AF:8,AI:1,AJ:1300,AR:20,H:'OF-IMPORT',G:'Information conservée'},metrics:{planned:0,actual:1300,defects:20,loadMinutes:480,runMinutes:480,idealSeconds:null,earnedMinutes:null,laborMinutes:null,losses:{},defectCategories:{}},updated_at:'2026-11-05T08:00:00.000Z'};
 state.reports=[imported];
 await act(async()=>{root.render(React.createElement(App,{key:'imported-report'}));});
 await click(button('Historique'));
 await click(document.querySelector('.history-open'));
 test('imported report explains that saving is possible with empty hourly inputs',()=>{assert.match(document.querySelector('.notice').textContent,/sans remplir les heures/);assert.equal(document.querySelector('input[aria-label^="Production conforme 06"]').value,'');});
 await setInput(document.querySelector('input[placeholder="Saisir la référence du produit"]'),'IMPORT-CORRIGE');
 await click(button('Aperçu Excel automatique'));
 const excelDialog=()=>document.querySelector('[role="dialog"][aria-label="Excel rempli depuis la saisie"]');
 const excelButton=text=>[...excelDialog().querySelectorAll('button')].find(node=>node.textContent.trim()===text);
 test('Excel preview retains imported quantities and reflects the edited product reference',()=>{assert.match(excelDialog().textContent,/rapport Excel importé conservées/);const input=[...excelDialog().querySelectorAll('.official-fields label')].find(label=>label.querySelector('small').textContent==='E').querySelector('input');assert.equal(input.value,'IMPORT-CORRIGE');});
 await click(excelButton('Enregistrer le brouillon'));
 test('saving an imported draft from the preview preserves Excel data and does not invent hourly data',()=>{const saved=state.reports[0];assert.equal(saved.status,'draft');assert.equal(saved.workshop,undefined);assert.equal(saved.cells.AJ,1300);assert.equal(saved.cells.AR,20);assert.equal(saved.cells.G,'Information conservée');assert.equal(saved.reference,'IMPORT-CORRIGE');assert.equal(saved.cells.E,'IMPORT-CORRIGE');assert.equal(writes.at(-1).value.updated_at,imported.updated_at);});
 await click(excelButton('Valider pour la réunion'));
 test('validating an imported report from the preview preserves totals without requiring hourly inputs',()=>{assert.equal(state.reports[0].status,'validated');assert.equal(state.reports[0].workshop,undefined);assert.equal(state.reports[0].cells.AJ,1300);assert.match(document.querySelector('.document-status').textContent,/Validé/);});
 reportError='Ce rapport a été modifié ailleurs. Rechargez-le avant de corriger.';
 await click(excelButton('Enregistrer le brouillon'));
 test('a rejected imported save displays its error inside the open preview and preserves the saved report',()=>{assert.match(excelDialog().querySelector('[role="alert"]').textContent,/modifié ailleurs/);assert.equal(state.reports[0].status,'validated');});
 reportError=null;
 await click(excelButton('Revenir à la saisie'));
 await setInput(document.querySelector('input[aria-label="Production conforme — total de l’équipe"]'),1);
 await setInput(document.querySelector('input[aria-label="Production conforme — total de l’équipe"]'),'');
 const writeCount=writes.length;
 await click(button('Valider pour la réunion'));
 test('switching an import to empty manual totals cannot silently validate or erase its saved values',()=>{assert.equal(writes.length,writeCount);assert.equal(state.reports[0].cells.AJ,1300);assert.match(document.querySelector('.toast-message').textContent,/renseignez production/);});
 state.reports=[];
 await act(async()=>{root.render(React.createElement(App,{key:'product-standards'}));});
 await setInput(document.querySelector('input[placeholder="Saisir la référence du produit"]'),'2.1.30171');
 test('selecting an existing product fills its designation, machine cycle, cavities and standard labor time',()=>{assert.match(document.querySelector('.product-snapshot').textContent,/Cover KIKO/);assert.equal(document.querySelector('input[aria-label="Cycle standard en secondes"]').value,'39');assert.equal(document.querySelector('input[aria-label="Nombre d’empreintes"]').value,'8');assert.equal(document.querySelector('input[aria-label="Temps standard main-d’œuvre en secondes"]').value,'4.875');});
 await setInput(document.querySelector('input[aria-label="Production conforme — total de l’équipe"]'),1200);
 await setInput(document.querySelector('input[aria-label="Effectif — total de l’équipe"]'),2);
 test('the DLE card recalculates from good pieces, product standard and actual staff times duration',()=>{assert.match(document.querySelectorAll('.entry-result')[1].querySelector('strong').textContent,/10,2/);assert.equal(document.querySelectorAll('.hourly-grid').length,1);assert.ok([...document.querySelectorAll('.hourly-grid .production-row td:not(.total-column) input')].every(input=>input.value===''));});
 await setInput(document.querySelector('input[placeholder="Saisir la référence du produit"]'),'INCONNUE');
 test('an unknown reference clears stale product standards and leaves its DLE unavailable',()=>{assert.equal(document.querySelector('input[aria-label="Cycle standard en secondes"]').value,'');assert.equal(document.querySelectorAll('.entry-result')[1].querySelector('strong').textContent,'—');});
 await setInput(document.querySelector('input[placeholder="Saisir la référence du produit"]'),'2.1.30171');
 await click(button('Référentiel produits'));
 await click([...document.querySelectorAll('.catalog-list button')].find(node=>node.textContent.includes('2.1.30171')));
 await setInput(document.querySelector('input[aria-label="Temps standard (s / pièce)"]'),5);
 await setInput(document.querySelector('input[aria-label="Effectif proposé à la saisie"]'),2);
 productError='Cette référence a été modifiée ailleurs.';
 await click(button('Enregistrer la référence'));
 test('a refused catalog save keeps the edited parameters and displays the error in its dialog',()=>{assert.match(document.querySelector('.catalog-error').textContent,/modifiée ailleurs/);assert.equal(document.querySelector('input[aria-label="Temps standard (s / pièce)"]').value,'5');});
 productError=null;
 await click(button('Enregistrer la référence'));
 test('saving a reference persists a separate product record and does not rewrite the active production',()=>{assert.equal(writes.at(-1).kind,'product');assert.equal(state.products[0].standardSeconds,5);assert.equal(state.products[0].defaultPeople,2);assert.match(document.querySelector('.catalog-success').textContent,/enregistrée/);assert.equal(state.reports.length,0);});
 await setInput(document.querySelector('input[aria-label="Objectif DLE (%)"]'),80);
 await click(button('Enregistrer la référence'));
 test('a second catalog save carries the refreshed record version',()=>assert.ok(writes.at(-1).value.updated_at));
 await click(document.querySelector('.product-catalog-dialog .dialog-title button'));
 test('catalog edits preserve the production snapshot already being entered',()=>assert.equal(document.querySelector('input[aria-label="Temps standard main-d’œuvre en secondes"]').value,'4.875'));
 await setInput(document.querySelector('input[placeholder="Saisir la référence du produit"]'),'');
 await setInput(document.querySelector('input[placeholder="Saisir la référence du produit"]'),'2.1.30171');
 test('reselecting a reference loads its newly saved parameters and staffing',()=>{assert.equal(document.querySelector('input[aria-label="Temps standard main-d’œuvre en secondes"]').value,'5');assert.equal(document.querySelector('input[aria-label="Effectif — total de l’équipe"]').value,'2');});
 console.log(JSON.stringify({passed}));
}finally{await act(async()=>{root.unmount();});dom.window.close();}
