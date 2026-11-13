import type {Machine} from './domain';

export const sceneStatusLabels:Record<Machine['status'],string>={running:'En marche',stopped:'À l’arrêt',maintenance:'Maintenance',idle:'Disponible',unknown:'État à renseigner'};
export const sceneStatusColors:Record<Machine['status'],string>={running:'#6bd59e',stopped:'#f08b7b',maintenance:'#e6bc72',idle:'#8cb7cd',unknown:'#91a5ac'};
export const scenePoint=(machine:Pick<Machine,'x'|'y'>):[number,number,number]=>[(machine.x-50)/6,0,(machine.y-50)/6];
export function sceneCounts(machines:Machine[]){
 const counts={running:0,stopped:0,maintenance:0,idle:0,unknown:0};
 for(const machine of machines)counts[machine.status]++;
 return counts;
}
export function sceneDisplayMachines(machines:Machine[],selected:string|null,limit=80){
 const visible=machines.slice(0,limit),chosen=machines.find(machine=>machine.id===selected);
 if(chosen&&!visible.some(machine=>machine.id===chosen.id)&&visible.length)visible[visible.length-1]=chosen;
 return visible;
}
export function sceneShortName(machine:Machine){
 const code=machine.inventory?.code||machine.name;
 const match=code.match(/(?:^|-)\b(INJ|MET|SER|ASM)-(\d+)$/i);
 return match?`${match[1]} · ${match[2]}`:code.length>16?code.slice(0,15)+'…':code;
}
