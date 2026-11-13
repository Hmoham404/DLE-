import {z} from 'zod';
import {today,type Machine} from './domain';
import type {FiveSTag} from './five-s';

export const fiveSCriteria=[
 {id:'trier',name:'Trier',question:'Le matériel inutile a-t-il été retiré ?'},
 {id:'ranger',name:'Ranger',question:'Les outils et matières ont-ils une place identifiée ?'},
 {id:'nettoyer',name:'Nettoyer',question:'La machine et ses abords sont-ils propres ?'},
 {id:'standardiser',name:'Standardiser',question:'Les repères et consignes sont-ils visibles et à jour ?'},
 {id:'maintenir',name:'Maintenir',question:'Les règles de rangement sont-elles respectées ?'},
] as const;
export const auditStatuses=['Planifié','En cours','Terminé'] as const;
export const auditRatings=[{value:0,label:'Non conforme'},{value:1,label:'Partiel'},{value:2,label:'Conforme'}] as const;
const rating=z.number().int().min(0).max(2).nullable();
const validDate=z.string().refine(value=>{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const parsed=new Date(value+'T00:00:00Z');return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===value;
},'Choisissez une date valide pour l’audit.');
export const fiveSAuditSchema=z.object({
 id:z.string().uuid(),machine_id:z.string().uuid(),machine_name:z.string().max(160),
 plan_id:z.enum(['injection','metalisation']),position:z.object({x:z.number().finite().min(0).max(100),y:z.number().finite().min(0).max(100)}),
 scheduled_date:validDate,scheduled_time:z.string().refine(value=>value===''||/^([01]\d|2[0-3]):[0-5]\d$/.test(value),'Heure invalide.'),
 owner:z.string().trim().min(1,'Indiquez le responsable de l’audit.').max(100),status:z.enum(auditStatuses),
 checks:z.object({trier:rating,ranger:rating,nettoyer:rating,standardiser:rating,maintenir:rating}),
 notes:z.string().trim().max(2000),action:z.string().trim().max(2000),
 created_at:z.string().datetime().optional(),updated_at:z.string().datetime().optional(),completed_at:z.string().datetime().nullable().optional(),
}).superRefine((audit,context)=>{
 if(audit.status==='Terminé'&&fiveSCriteria.some(item=>audit.checks[item.id]===null))context.addIssue({code:z.ZodIssueCode.custom,path:['checks'],message:'Évaluez les cinq S avant de terminer l’audit.'});
});
export type FiveSAudit=z.infer<typeof fiveSAuditSchema>;
export const auditPlan=(machine:Machine):FiveSTag['plan_id']=>machine.department==='injection'?'injection':'metalisation';
export function newFiveSAudit(machine:Machine,position:FiveSAudit['position']):FiveSAudit{return {
 id:crypto.randomUUID(),machine_id:machine.id,machine_name:machine.name,plan_id:auditPlan(machine),position,
 scheduled_date:today(),scheduled_time:'',owner:'',status:'Planifié',checks:{trier:null,ranger:null,nettoyer:null,standardiser:null,maintenir:null},notes:'',action:'',
};}
export function auditScore(audit:Pick<FiveSAudit,'checks'>){const values=fiveSCriteria.map(item=>audit.checks[item.id]);return values.some(value=>value===null)?null:values.reduce<number>((sum,value)=>sum+(value??0),0)*10;}
export function prepareFiveSAudit(input:FiveSAudit,machine:Machine|undefined,current:FiveSAudit|undefined,now=new Date().toISOString()){
 if(!machine)throw new Error('La machine sélectionnée n’existe plus.');
 if(current&&current.machine_id!==input.machine_id)throw new Error('La machine d’un audit enregistré ne peut pas être changée.');
 if(input.plan_id!==auditPlan(machine))throw new Error('Le site ne correspond pas à la machine sélectionnée.');
 if(current&&(!input.updated_at||current.updated_at!==input.updated_at))throw new Error('Cet audit a été modifié ailleurs. Rechargez-le avant de corriger.');
 const {updated_at:version,...value}=input;void version;
 return {...value,machine_name:machine.name,created_at:current?.created_at||now,completed_at:input.status==='Terminé'?(current?.status==='Terminé'?current.completed_at||now:now):null};
}
