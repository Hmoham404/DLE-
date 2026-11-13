import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const directory='outputs/qos-trs-source';
const read=async name=>JSON.parse(await readFile(`${directory}/${name}.json`,'utf8'));
const [manifest,presses,articles,records]=await Promise.all(['manifest','presses','articles','production_records'].map(read));
const lossFields={staffing_min:"Manque d'effectif",mold_breakdown_min:'Panne moule',breakdown_min:'Panne machine',peripherals_min:'Manque périphériques',material_shortage_min:'Rupture MP',quality_stop_min:'Problème qualité',power_cut_min:"Coupure d'énergie",adjustment_min:'Réglage',other_loss_min:'Autres pertes',startup_min:'Démarrage / arrêt',changeover_min:'Changement de série'};
const percent=(numerator,denominator)=>denominator>0?numerator/denominator*100:null;
function metrics(row){
  const required=row.opening_min-row.planned_min;
  const downtime=Object.keys(lossFields).reduce((sum,field)=>sum+(Number(row[field])||0),0);
  const runtime=required-downtime;
  const rejects=row.startup_rejects+row.production_rejects;
  const total=row.good_qty+rejects;
  const earned=row.standard_seconds*row.good_qty/3600;
  return {requiredMinutes:required,unplannedDowntimeMinutes:downtime,runtimeMinutes:runtime,totalQuantity:total,rejectQuantity:rejects,earnedLaborHours:earned,availabilityPercent:percent(runtime,required),performancePercent:percent(total*row.cycle_seconds,runtime*60),qualityPercent:percent(row.good_qty,total),oeePercent:percent(row.good_qty*row.cycle_seconds,required*60),qosDlePercent:percent(earned,row.labor_hours),planAchievementPercent:row.planned_qty==null?null:percent(row.good_qty,row.planned_qty)};
}

// Verify the source conventions against a hand-calculated reference case.
const fixture={opening_min:480,planned_min:30,breakdown_min:60,good_qty:1000,startup_rejects:30,production_rejects:10,cycle_seconds:4.5,standard_seconds:4.5,labor_hours:2,planned_qty:1200};
const expected=metrics(fixture);
assert.equal(expected.requiredMinutes,450);
assert.equal(expected.runtimeMinutes,390);
assert.equal(expected.rejectQuantity,40);
assert.equal(expected.oeePercent,1000*4.5/(450*60)*100);
assert.equal(expected.qosDlePercent,62.5);
assert.equal(metrics({...fixture,planned_min:480,breakdown_min:0}).oeePercent,null);
assert.equal(metrics({...fixture,good_qty:0,startup_rejects:0,production_rejects:0}).qualityPercent,null);

const rows=records.map(row=>{
  const press=presses.find(item=>item.id===row.press_id);
  const article=articles.find(item=>item.id===row.article_id);
  const computed=metrics(row);
  const review=[];
  if(Number(row.date.slice(0,4))<2000||Number(row.date.slice(0,4))>Number(manifest.retrievedAt.slice(0,4))+1)review.push('date-to-confirm');
  if(!press||!article)review.push('reference-not-found');
  if(computed.runtimeMinutes<0||computed.requiredMinutes<0)review.push('inconsistent-time-totals');
  if(computed.performancePercent>100)review.push('performance-above-100-percent');
  if(computed.availabilityPercent!==null&&computed.performancePercent!==null&&computed.qualityPercent!==null){
    const product=computed.availabilityPercent*computed.performancePercent*computed.qualityPercent/10000;
    assert.ok(Math.abs(product-computed.oeePercent)<1e-8,`OEE components inconsistent for ${row.id}`);
  }
  return {sourceRecordId:row.id,date:row.date,shift:row.shift,sourcePressId:row.press_id,pressName:press?.name??null,sourceArticleId:row.article_id,articleCode:article?.code??null,articleName:article?.name??null,localMachineId:null,source:row.source,updatedAt:row.updated_at,
    inputs:{openingMinutes:row.opening_min,plannedDowntimeMinutes:row.planned_min,goodQuantity:row.good_qty,startupRejects:row.startup_rejects,productionRejects:row.production_rejects,plannedQuantity:row.planned_qty,laborHours:row.labor_hours,cycleSecondsPerPiece:row.cycle_seconds,standardSecondsPerPiece:row.standard_seconds,stops:Object.entries(lossFields).map(([field,cause])=>({sourceField:field,cause,minutes:row[field]??0}))},
    metrics:computed,review,detailLevel:'shift-totals',productionValidationStatus:'not-provided-by-source'};
});
const available=Object.fromEntries(['oeePercent','availabilityPercent','performancePercent','qualityPercent','qosDlePercent','planAchievementPercent'].map(key=>[key,rows.filter(row=>row.metrics[key]!==null).length]));
const reviewCounts=Object.fromEntries([...new Set(rows.flatMap(row=>row.review))].map(kind=>[kind,rows.filter(row=>row.review.includes(kind)).length]));
const output={format:'myc-qos-production-metrics-v1',source:manifest.source,retrievedAt:manifest.retrievedAt,status:'prepared-not-imported',department:'injection',unit:'percent (0–100; source values above 100 are preserved)',counts:{records:rows.length,available,reviewCounts},
  formulas:{requiredMinutes:'opening_min - planned_min',runtimeMinutes:'requiredMinutes - sum(unplanned stop categories)',availabilityPercent:'runtimeMinutes / requiredMinutes * 100',performancePercent:'(good_qty + startup_rejects + production_rejects) * cycle_seconds / (runtimeMinutes * 60) * 100',qualityPercent:'good_qty / (good_qty + startup_rejects + production_rejects) * 100',oeePercent:'good_qty * cycle_seconds / (requiredMinutes * 60) * 100',qosDlePercent:'(standard_seconds * good_qty / 3600) / labor_hours * 100',planAchievementPercent:'good_qty / planned_qty * 100'},
  notes:['Indicateurs recalculés à partir des relevés avec les formules du site QOS, et non lus dans une colonne OEE enregistrée.','Un dénominateur nul ou une quantité planifiée absente produit null, jamais une valeur inventée.','Le DLE QOS conserve sa convention propre ; il ne remplace pas directement le DLE MYC.','Les noms QOS sont conservés jusqu’à confirmation de la correspondance avec les matricules MYC.','Les relevés n’ont pas de statut de validation publié ; aucun n’est déclaré validé automatiquement.','Une date suspecte est signalée dans review et conservée sans correction.'],rows};
await writeFile('data/qos-production-metrics.json',JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({records:rows.length,available,reviewCounts,file:'data/qos-production-metrics.json'}));
