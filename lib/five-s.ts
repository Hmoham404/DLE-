import {z} from 'zod';

export const fiveSColors=[
 {id:'rouge',name:'Rouge',title:'Matériel inutile',action:'Retirer',description:'Objets inutiles, obsolètes, endommagés ou hors service.',examples:'Rebuts, outils obsolètes, pièces endommagées.'},
 {id:'jaune',name:'Jaune',title:'À examiner',action:'Évaluer',description:'Matériel dont l’utilité doit être confirmée avant de décider.',examples:'Pièces de rechange, équipements de secours, outils peu utilisés.'},
 {id:'vert',name:'Vert',title:'Matériel nécessaire',action:'Conserver',description:'Matériel utile, identifié et rangé à son emplacement défini.',examples:'Outils quotidiens, matières premières, moyens de contrôle.'},
 {id:'bleu',name:'Bleu',title:'À déplacer',action:'Déplacer',description:'Matériel utile qui doit rejoindre un autre emplacement.',examples:'Surstock, outils d’une autre ligne, matériel d’un autre atelier.'}
] as const;
export const fiveSPlans=[
 {id:'injection',name:'Site injection',description:'Atelier, magasins, maintenance et espaces communs'},
 {id:'metalisation',name:'Site métallisation',description:'Métallisation, assemblage, impression et stockage'}
] as const;
const date=z.string().refine(value=>{
 if(value==='')return true;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const parsed=new Date(value+'T00:00:00Z');
 return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===value;
},'Date invalide.');
export const fiveSTagSchema=z.object({
 id:z.string().uuid(),title:z.string().trim().min(1).max(160),
 color:z.enum(['rouge','jaune','vert','bleu']),status:z.enum(['À traiter','En cours','Clôturée']),
 plan_id:z.enum(['injection','metalisation']),department:z.enum(['commun','injection','metalisation','serigraphie','assemblage']),
 kind:z.enum(['zone','poste','machine']),location:z.string().trim().min(1).max(200),
 machine_id:z.string().uuid().nullable(),position:z.object({x:z.number().finite().min(0).max(100),y:z.number().finite().min(0).max(100)}).nullable(),
 reason:z.string().trim().max(1500),action:z.string().trim().max(1500),destination:z.string().trim().max(200),
 owner:z.string().trim().min(1).max(100),due_date:date,
 created_at:z.string().datetime().optional(),updated_at:z.string().datetime().optional(),closed_at:z.string().datetime().nullable().optional()
}).superRefine((value,context)=>{
 if(value.color==='bleu'&&!value.destination)context.addIssue({code:z.ZodIssueCode.custom,message:'Indiquez la destination du matériel à déplacer.',path:['destination']});
 if(value.kind!=='machine'&&value.machine_id)context.addIssue({code:z.ZodIssueCode.custom,message:'La machine doit correspondre au type d’emplacement choisi.',path:['machine_id']});
});
export type FiveSTag=z.infer<typeof fiveSTagSchema>;
export const newFiveSTag=(plan:FiveSTag['plan_id']='injection',position:FiveSTag['position']=null):FiveSTag=>({
 id:crypto.randomUUID(),title:'',color:'rouge',status:'À traiter',plan_id:plan,department:'commun',kind:'zone',location:'',machine_id:null,position,reason:'',action:'',destination:'',owner:'',due_date:''
});
export const fiveSCode=(tag:Pick<FiveSTag,'id'>)=>'5S-'+tag.id.slice(0,8).toUpperCase();
