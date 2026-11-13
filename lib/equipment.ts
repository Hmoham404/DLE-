import type {Machine} from './domain';

export const equipmentKinds = {production:'Machine de production',line:'Ligne de production',support:'Équipement auxiliaire',tooling:'Moule / outillage'};
export const departmentLines:Record<string,string[]> = {injection:[],serigraphie:[],metalisation:['Ligne 1','Ligne 2'],assemblage:['Automatique','Manuelle']};
export const isProductionUnit=(machine:Machine)=>!machine.assetKind||machine.assetKind==='production'||machine.assetKind==='line';
export const unitLabel=(machine:Machine)=>machine.inventory?.category?`${machine.name} · ${machine.inventory.category}`:machine.name;
export const lineLabel=(machine:Machine)=>machine.line||'À affecter';
export function lineOptions(machines:Machine[],department:string){return [...new Set([...(departmentLines[department]||[]),...machines.filter(m=>m.department===department).map(m=>m.line).filter((v):v is string=>!!v)])];}
export function reportGroups(machines:Machine[],department:string){
 return lineOptions(machines,department).map(line=>({id:department+':'+line,name:line,ids:machines.filter(m=>m.department===department&&m.line===line&&isProductionUnit(m)).map(m=>m.id)}));
}
