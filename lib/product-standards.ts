import {z} from 'zod';
import qos from '@/data/qos-reference.json';
import type {Workshop} from './workshop';
import {newWorkshop,workshopTotals} from './workshop';
import {shiftDefinition} from './shifts';

const nonnegative=z.number().finite().min(0).max(100000000);
export const productStandardSchema=z.object({
 id:z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/),department:z.enum(['injection','metalisation','serigraphie','assemblage']),
 reference:z.string().trim().min(1).max(120),name:z.string().trim().min(1).max(180),operation:z.string().trim().max(80),
 cycleSeconds:nonnegative.positive().nullable(),cavities:nonnegative.min(1),standardSeconds:nonnegative.positive().nullable(),
 standardOperators:nonnegative.nullable(),defaultPeople:nonnegative.nullable(),oeeTarget:nonnegative.max(100).nullable(),dleTarget:nonnegative.max(100).nullable(),
 source:z.string().max(200),updated_at:z.string().datetime().optional()
});
export type ProductStandard=z.infer<typeof productStandardSchema>;
const supplied=(id:string,department:ProductStandard['department'],reference:string,name:string,operation:string,cycleSeconds:number,standardSeconds:number,standardOperators:number,target:number):ProductStandard=>({id,department,reference,name,operation,cycleSeconds,standardSeconds,standardOperators,defaultPeople:standardOperators,cavities:1,oeeTarget:target,dleTarget:target,source:'Fiches produit fournies par MYC'});
export const initialProductStandards:ProductStandard[]=[
 ...qos.articles.map(article=>({id:'inj-'+article.code.replaceAll('.','-'),department:'injection' as const,reference:article.code,name:article.name,operation:'Injection',cycleSeconds:article.moldCycleSeconds,cavities:article.cavities,standardSeconds:article.standardSecondsPerPiece,standardOperators:null,defaultPeople:null,oeeTarget:null,dleTarget:null,source:'Référentiel QOS local · sans affectation de presse'})),
 supplied('metal-cover-kiko','metalisation','2.3.30156','Cover KIKO','Métallisation',.75,22.5,30,70),
 supplied('metal-base-kiko','metalisation','2.4.30050','Base KIKO','Métallisation',.75,22.5,30,70),
 supplied('metal-cover-pm','metalisation','11600CO','Cover PM Belotti','Métallisation',.75,22.5,30,70),
 supplied('metal-base-pm','metalisation','11600BD','Base PM Belotti','Métallisation',.75,22.5,30,70),
 supplied('metal-cover-gm','metalisation','12900CO','Cover GM Belotti','Métallisation',1.036,31.08,30,70),
 supplied('metal-base-gm','metalisation','12900BD','Cover GM Belotti','Métallisation',1.036,31.08,30,70),
 supplied('seri-base-kiko','serigraphie','2.4.30051','Base KIKO','Sérigraphie',5,7.5,1.5,80),
 supplied('assembly-compact-kiko','assemblage','3.3.30273','Compact KIKO','Assemblage',3.26,42.35,13,80),
 supplied('welding-kiko','assemblage','2.4.30049','Base+insert soudés KIKO','Soudure',5.94,11.88,2,80)
];
export function productStandards(stored:ProductStandard[]=[]){
 const merged=new Map(initialProductStandards.map(product=>[product.id,product]));
 for(const product of stored)merged.set(product.id,product);
 return [...merged.values()];
}
export const findProduct=(products:ProductStandard[],department:string,reference:string)=>products.find(product=>product.department===department&&product.reference.toLowerCase()===reference.trim().toLowerCase());
export function quickWorkshop(shift:string):Workshop{
 return {...newWorkshop(shift),entryMode:'totals',laborCalculation:'standard-output',totals:{good:null,rejects:0,people:null,plannedMinutes:shiftDefinition(shift)?shiftDefinition(shift)!.hours*60:null,stopMinutes:0},standardLaborSeconds:null};
}
export function applyProductStandard(work:Workshop,product:ProductStandard):Workshop{
 return {...work,productId:product.id,productName:product.name,productOperation:product.operation,idealCycleSeconds:product.cycleSeconds,cavities:product.cavities,standardLaborSeconds:product.standardSeconds,laborCalculation:'standard-output',oeeTarget:product.oeeTarget,dleTarget:product.dleTarget,...(work.entryMode==='totals'?{totals:{...workshopTotals(work),people:product.defaultPeople}}:{})};
}
export function clearProductStandard(work:Workshop):Workshop{
 return {...work,productId:undefined,productName:undefined,productOperation:undefined,idealCycleSeconds:null,cavities:1,standardLaborSeconds:null,oeeTarget:null,dleTarget:null,...(work.entryMode==='totals'?{totals:{...workshopTotals(work),people:null}}:{})};
}
export const lossSuggestions=(department:string,operation?:string)=>['Manque effectif','Panne machine',...(department==='metalisation'?['Panne Vaccum','Panne ligne de peinture']:department==='serigraphie'?['Panne four']:[]),'Problème qualité',operation==='Soudure'?'Rupture SFIN':'Rupture MP','Coupure d’énergie','Réglage','Démarrage/arrêt','Changement de référence','Autres pertes'];
