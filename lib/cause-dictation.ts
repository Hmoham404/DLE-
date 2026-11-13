export type CauseUnit='min'|'pcs';

const small=['zero','un','deux','trois','quatre','cinq','six','sept','huit','neuf','dix','onze','douze','treize','quatorze','quinze','seize'];
function frenchNumber(n:number):string{
 if(n<17)return small[n];
 if(n<20)return 'dix '+small[n-10];
 if(n<70){const tens=['','','vingt','trente','quarante','cinquante','soixante'][Math.floor(n/10)],rest=n%10;return tens+(rest===1?' et un':rest?' '+small[rest]:'');}
 if(n<80)return 'soixante '+(n===71?'et onze':frenchNumber(n-60));
 return 'quatre vingt'+(n===80?'s':' '+frenchNumber(n-80));
}
const numbers=new Map(Array.from({length:100},(_,n)=>[frenchNumber(n),n] as const));
numbers.set('une',1);numbers.set('quatre vingt',80);
for(const [word,value] of [...numbers])if(word.endsWith(' un'))numbers.set(word.slice(0,-2)+'une',value);
const wordNumbers=[...numbers.keys()].sort((a,b)=>b.length-a.length).join('|');
const numberPattern=`(?:\\d+(?:[.,]\\d+)?|${wordNumbers})`;
const numberValue=(text:string)=>numbers.get(text)??Number(text.replace(',','.'));

/** Extract only explicit quantities with the matching unit. Ambiguous dictation stays editable text. */
export function parseCauseDictation(transcript:string,unit:CauseUnit):{cause:string;quantity:number|null}{
 const source=transcript.replace(/\s+/g,' ').trim();
 let text='';const offsets:number[]=[];
 for(let i=0;i<source.length;i++){
  const folded=source[i].normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’]/g,"'").replace(/[-–]/g,' ');
  for(const character of folded){text+=character;offsets.push(i);}
 }
 const pattern=unit==='min'
  ?new RegExp(`(?<![\\p{L}\\d])(${numberPattern})\\s*(heures?|h|minutes?|mins?|mn|mint)(?![\\p{L}])(?:\\s*(${numberPattern})(?:\\s*(minutes?|mins?|mn|mint)(?![\\p{L}]))?)?`,'gu')
  :new RegExp(`(?<![\\p{L}\\d])(${numberPattern})\\s*(pieces?|pcs?|rebuts?)(?![\\p{L}])`,'gu');
 const matches=[...text.matchAll(pattern)];
 if(matches.length!==1)return {cause:source,quantity:null};
 const match=matches[0],isHours=/^(h|heure|heures)$/.test(match[2]);
 // A number following minutes belongs to the cause, unless it is part of an hours/minutes duration.
 let length=match[0].length;
 if(unit==='min'&&!isHours&&match[3])length=match[0].indexOf(match[2])+match[2].length;
 const quantity=numberValue(match[1])*(isHours?60:1)+(isHours&&match[3]?numberValue(match[3]):0);
 if(!Number.isFinite(quantity)||quantity<0||quantity>100000000)return {cause:source,quantity:null};
 // The original string may contain decomposed accents or number-word hyphens. Normalize each
 // prefix to locate the removed phrase without changing the spelling of the remaining cause.
 const start=match.index!;
 const sourceIndex=(target:number)=>offsets[target]??source.length;
 const before=source.slice(0,sourceIndex(start)).replace(/\s+(?:de|pendant|durant|pour)\s*$/iu,'').trim();
 const after=source.slice(sourceIndex(start+length)).replace(/^\s*(?:de\s+|d['’]\s*)/iu,'').trim();
 const cause=[before,after].filter(Boolean).join(' ').replace(/^[\s,;:.\-]+|[\s,;:.\-]+$/g,'').trim();
 return {cause,quantity};
}
