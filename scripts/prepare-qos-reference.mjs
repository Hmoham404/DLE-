import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const directory='outputs/qos-trs-source';
const read=name=>readFile(`${directory}/${name}.json`,'utf8').then(JSON.parse);
const [manifest,presses,articles,records,localMachines]=await Promise.all(['manifest','presses','articles','production_records','local-injection-machines'].map(read));
const countBy=(rows,key)=>Object.fromEntries([...new Set(rows.map(row=>row[key]))].map(value=>[value,rows.filter(row=>row[key]===value).length]));
const knownPresses=new Set(presses.map(row=>row.id));
const knownArticles=new Set(articles.map(row=>row.id));
const currentYear=Number(manifest.retrievedAt.slice(0,4));
const issues=[];
const identities=new Set();
for(const row of records){
  const identity=[row.date,row.shift,row.press_id,row.article_id].join('|');
  if(identities.has(identity))issues.push({recordId:row.id,kind:'duplicate-production-key',identity});
  identities.add(identity);
  if(!knownPresses.has(row.press_id)||!knownArticles.has(row.article_id))issues.push({recordId:row.id,kind:'unknown-reference'});
  if(Number(row.date.slice(0,4))<2000||Number(row.date.slice(0,4))>currentYear+1)issues.push({recordId:row.id,kind:'date-to-review',value:row.date,action:'Conserver la valeur brute ; date à confirmer avant import.'});
}
const catalog={
  format:'myc-qos-reference-v1',source:manifest.source,retrievedAt:manifest.retrievedAt,
  status:'prepared-not-imported',
  presses:presses.map(row=>({sourceId:row.id,name:row.name,active:row.active,localMachineId:null,mappingStatus:'needs-confirmation'})),
  articles:articles.map(row=>({sourceId:row.id,code:row.code,name:row.name,active:row.active,cavities:row.cavities,moldCycleSeconds:row.mold_cycle_seconds,cycleSecondsPerPiece:row.mold_cycle_seconds/row.cavities,standardSecondsPerPiece:row.standard_seconds,localToolingId:null,workshopDefaults:{idealCycleSeconds:row.mold_cycle_seconds,cavities:row.cavities}})),
  shiftMapping:{Matin:'Équipe de jour','Après-Midi':'Équipe d’après-midi',Nuit:'Équipe de nuit'},
  constraints:[
    'Les noms des presses QOS ne sont pas reliés aux matricules MYC par une preuve commune (numéro de série ou table de correspondance).',
    'Les articles produits ne sont pas des identifiants physiques de moules ; aucun lien aux outillages YZA/CYZ n’est établi.',
    'active signifie référence disponible ; cela ne donne pas l’état courant de la presse.',
    'Ne pas copier cycle_seconds dans idealCycleSeconds avec cavities=8 : la valeur source est déjà en secondes par pièce.',
    'Les paramètres historiques cycle_seconds et standard_seconds doivent rester propres à chaque relevé.'
  ]
};
await writeFile('data/qos-reference.json',JSON.stringify(catalog,null,2)+'\n');
const localPresses=localMachines.filter(row=>row.assetKind==='production');
const mapping={source:manifest.source,retrievedAt:manifest.retrievedAt,confirmedMappings:[],sourcePresses:catalog.presses,localPresses:localPresses.map(row=>({id:row.id,code:row.inventory?.code,name:row.name,model:row.inventory?.model,serialNumber:row.inventory?.serialNumber})),sourceArticles:catalog.articles,localTooling:localMachines.filter(row=>row.assetKind==='tooling').map(row=>({id:row.id,name:row.name,model:row.inventory?.model,serialNumber:row.inventory?.serialNumber}))};
await writeFile(`${directory}/correspondances-a-confirmer.json`,JSON.stringify(mapping,null,2)+'\n');
const dates=records.map(row=>row.date).filter(date=>Number(date.slice(0,4))>=2000).sort();
const summary={source:manifest.source,retrievedAt:manifest.retrievedAt,counts:{presses:presses.length,articles:articles.length,productionRecords:records.length,localPresses:localPresses.length,localTooling:mapping.localTooling.length,confirmedPressMappings:0},dateRangeExcludingFlaggedYears:{from:dates[0],to:dates.at(-1)},recordsByShift:countBy(records,'shift'),recordsByOrigin:countBy(records,'source'),recordsWithoutPlannedQuantity:records.filter(row=>row.planned_qty===null).length,recordsWithoutCompleteTimeline:records.filter(row=>!row.timeline_complete).length,recordsWithZeroOutput:records.filter(row=>row.good_qty+row.startup_rejects+row.production_rejects===0).length,issues,files:{}};
for(const table of ['presses','articles','production_records'])summary.files[table]={path:`${table}.json`,sha256:createHash('sha256').update(await readFile(`${directory}/${table}.json`)).digest('hex')};
await writeFile(`${directory}/verification.json`,JSON.stringify(summary,null,2)+'\n');
const notes=`# Préparation des données QOS pour MYC Smart Factory

Source : ${manifest.source}
Capture en lecture seule : ${manifest.retrievedAt}

Les catalogues et relevés proviennent des tables utilisées par le client public du site. Aucune écriture distante n’a été faite. Le catalogue préparé est dans data/qos-reference.json ; il n’est pas encore branché dans l’interface et aucun relevé n’a été ajouté au JSON Supabase MYC.

## Données conservées

- presses.json : ${presses.length} presses, avec identifiant, nom et disponibilité.
- articles.json : ${articles.length} articles/moules, avec code, désignation, empreintes, cycle moule et standard par pièce.
- production_records.json : ${records.length} relevés, avec les valeurs et identifiants d’origine.
- correspondances-a-confirmer.json : les deux inventaires à rapprocher, sans affectation inventée.
- verification.json : décomptes, empreintes SHA-256 et identifiants des anomalies.
- data/qos-production-metrics.json (depuis la racine du projet) : OEE/TRS, disponibilité, performance, qualité, DLE QOS et réalisation du plan, avec les bases de calcul de chaque relevé. Généré par node scripts/prepare-qos-metrics.mjs. Les indicateurs sont recalculés avec les formules QOS et ne sont pas automatiquement importés dans les saisies MYC.

## Conversion à respecter avant une intégration

Les valeurs QOS mold_cycle_seconds sont en secondes par cycle moule. Le champ QOS cycle_seconds des relevés est déjà en secondes par pièce. Dans MYC, idéal par pièce = workshop.idealCycleSeconds / workshop.cavities : pour un nouveau relevé article, utiliser le cycle moule et les empreintes du catalogue. Pour un relevé historique, conserver son cycle par pièce ; ne pas le diviser une seconde fois par les empreintes.

Le champ QOS planned_min représente les arrêts planifiés, et non le temps de production planifié. La charge MYC correspond à opening_min - planned_min. Les arrêts non planifiés correspondent à la somme de breakdown_min, startup_min, changeover_min, staffing_min, mold_breakdown_min, peripherals_min, material_shortage_min, quality_stop_min, power_cut_min, adjustment_min et other_loss_min. Les rebuts totaux sont startup_rejects + production_rejects. planned_qty correspond à plannedQuantity et doit rester absent lorsqu’il est nul dans la source.

Tous les relevés capturés ont timeline_complete=false. Une éventuelle reprise doit utiliser le mode totaux ; elle ne doit pas répartir les quantités sur des créneaux horaires fictifs. Matin correspond à Équipe de jour, Après-Midi à Équipe d’après-midi et Nuit à Équipe de nuit. La date de début de l’équipe est conservée.

Le DLE QOS est (standard_seconds × good_qty / 3600) / labor_hours. Le DLE MYC actuellement confirmé est heures allouées / heures nécessaires. Ces rapports sont inverses si labor_hours est traité comme les heures allouées. Ne pas recopier le pourcentage QOS. Le sens métier du standard et des heures nécessaires doit être confirmé avant de remplir les champs DLE MYC. Le TRS QOS global est pondéré par le temps requis ; le résumé MYC actuel est pondéré par les quantités : les agrégats peuvent différer même avec des relevés identiques.

## Points restant à résoudre

Aucun numéro de série ni matricule MYC n’est fourni pour les presses QOS. Les 16 presses locales portent MYC-01-INJ-0001 à 0016. Les noms D280, D230, D180, D140, F220 et F150 ne permettent pas de déterminer l’ordre des machines d’un même modèle. D280 diffère en outre du modèle Wi270Sell de l’inventaire. Ne pas supposer une correspondance par position dans la liste. Les codes article 2.1.30171 à 2.1.30173 ne sont pas reliés aux identifiants physiques YZA/CYZ des moules locaux.

Un relevé porte la date 0001-10-30 : conserver cette valeur dans la sauvegarde et confirmer sa date réelle avant import. ${summary.recordsWithoutPlannedQuantity} relevés n’ont pas de quantité planifiée. ${summary.recordsWithZeroOutput} relevés ont une production totale nulle ; cela ne suffit pas à les déclarer erronés et ils sont conservés. Aucun doublon de la combinaison date/équipe/presse/article ni référence orpheline n’a été détecté.

## Relancer la préparation

Depuis le dossier du projet : node scripts/prepare-qos-reference.mjs
La collecte distante se relance par node scripts/collect-qos-reference.mjs et exige l’accès réseau. Les fichiers de ce dossier sont exclus de Git par la règle outputs/ déjà présente.
`;
await writeFile(`${directory}/LIRE-MOI.md`,notes);
console.log(JSON.stringify({counts:summary.counts,issues:summary.issues,preparedCatalog:'data/qos-reference.json'}));
