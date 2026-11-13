export type ShiftDefinition={id:string;value:string;name:string;start:number;end:number;hours:number;overnight:boolean;label:string;slots:string[]};
function time(minutes:number){const value=((minutes%1440)+1440)%1440;return String(Math.floor(value/60)).padStart(2,'0')+(value%60?':'+String(value%60).padStart(2,'0'):'');}
function define(id:string,value:string,name:string,start:number,duration:number,label:string):ShiftDefinition{
 return {id,value,name,start,end:(start+duration*60)%1440,hours:duration,overnight:start+duration*60>1440,label,slots:Array.from({length:duration},(_,index)=>time(start+index*60)+'–'+time(start+(index+1)*60))};
}
export const shifts=[
 define('jour','Équipe de jour','Jour',360,8,'Jour · 06h–14h'),
 define('apres-midi','Équipe d’après-midi','Après-midi',840,8,'Après-midi · 14h–22h'),
 define('nuit','Équipe de nuit','Nuit',1320,8,'Nuit · 22h–06h'),
 define('journee','Journée','Journée',450,10,'Journée · 07h30–17h30')
];
const normalized=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’']/g,'').replace(/\s+/g,' ').trim();
const aliases:Record<string,string>={
 'equipe du matin':'jour','equipe de jour':'jour','matin':'jour','jour':'jour',
 'equipe du soir':'apres-midi','equipe dapres-midi':'apres-midi','equipe dapres midi':'apres-midi','apres-midi':'apres-midi','apres midi':'apres-midi','soir':'apres-midi',
 'equipe de nuit':'nuit','nuit':'nuit',
 'journee':'journee','equipe de journee':'journee','equipe journee':'journee'
};
export function shiftDefinition(value:string){const key=aliases[normalized(value)]||value;return shifts.find(shift=>shift.id===key||shift.value===value);}
export const canonicalShift=(value:string)=>shiftDefinition(value)?.value||value;
export const sameShift=(a:string,b:string)=>canonicalShift(a)===canonicalShift(b);
export const shiftLabel=(value:string)=>shiftDefinition(value)?.label||value;
export function shiftSlots(value=shifts[0].value){return [...(shiftDefinition(value)||shifts[0]).slots];}
export function slotStart(value:string){
 const match=value.match(/^(\d{1,2})(?::(\d{2}))?\s*[-–—]\s*(\d{1,2})(?::(\d{2}))?$/);
 return match?((Number(match[1])%24)*60+Number(match[2]||0)):null;
}
export function canonicalSlot(value:string){
 const match=value.match(/^(\d{1,2})(?::(\d{2}))?\s*[-–—]\s*(\d{1,2})(?::(\d{2}))?$/);
 return match?time(Number(match[1])*60+Number(match[2]||0))+'–'+time(Number(match[3])*60+Number(match[4]||0)):value;
}
