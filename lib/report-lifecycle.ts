export type VersionedRecord={value:any;updated_at:string;history:{at:string;actor:string;report:any}[];deleted_at?:string;deleted_by?:string};
export function markReportDeleted(current:VersionedRecord|undefined,expected:string,actor:string,at=new Date().toISOString()):VersionedRecord{
 if(!current||current.deleted_at)throw new Error('Cette saisie a déjà été supprimée ou n’existe plus.');
 if(current.updated_at!==expected)throw new Error('Cette saisie a été modifiée. Rechargez-la avant de la supprimer.');
 return {...current,updated_at:at,deleted_at:at,deleted_by:actor};
}
