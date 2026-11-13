import type {Machine} from './domain';
import {isProductionUnit} from './equipment';
import {facilityLayouts,type PlanId,type PlanPoint,type FacilityZone} from './five-s-layout';

export type MapMachine={machine:Machine;position:PlanPoint;zone:FacilityZone;label:string;size:{w:number;h:number}};
const departmentZone:Record<string,string>={injection:'inj-atelier',metalisation:'met-pulverisation-2',serigraphie:'met-impression',assemblage:'met-assemblage'};
// Inventory identities are real; this arrangement is schematic, independent of the machine editor's coordinates.
export function facilityMachines(machines:Machine[],plan:PlanId):MapMachine[]{
 const groups=new Map<string,Machine[]>();
 for(const machine of machines){
  if(!isProductionUnit(machine)||(plan==='injection'?machine.department!=='injection':!['metalisation','serigraphie','assemblage'].includes(machine.department)))continue;
  const id=departmentZone[machine.department];if(!id)continue;
  groups.set(id,[...(groups.get(id)||[]),machine]);
 }
 return [...groups].flatMap(([id,items])=>{
  const zone=facilityLayouts[plan].zones.find(item=>item.id===id);if(!zone)return [];
  const ordered=items.sort((a,b)=>(a.inventory?.code||a.name).localeCompare(b.inventory?.code||b.name,'fr',{numeric:true})||a.id.localeCompare(b.id));
  const columns=Math.max(1,Math.ceil(ordered.length/(plan==='injection'?2:Math.ceil(Math.sqrt(ordered.length))))),rows=Math.ceil(ordered.length/columns);
  const {rect}=zone,cellW=rect.w/columns,cellH=rect.h/rows;
  return ordered.map((machine,index)=>({machine,zone,
   position:{x:rect.x+cellW*(index%columns+.5),y:rect.y+cellH*(Math.floor(index/columns)+.5)},
   label:machine.inventory?.code?.match(/\d+$/)?.[0].replace(/^0+/,'')||String(index+1),
   size:{w:Math.min(3.1,cellW*.65),h:Math.min(6.1,cellH*.7)},
  }));
 });
}
