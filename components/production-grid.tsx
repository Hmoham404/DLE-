'use client';
import {useId} from 'react';
import type {Workshop} from '@/lib/workshop';
import {workshopTotals} from '@/lib/workshop';
import {NumberInput} from './local-factory';

const rows=[
 {key:'good',name:'Production conforme',unit:'pièces',className:'production-row'},
 {key:'rejects',name:'Rebuts',unit:'pièces',className:'reject-row'},
 {key:'people',name:'Effectif',unit:'personnes',className:''},
 {key:'plannedMinutes',name:'Temps planifié',unit:'minutes',className:''},
 {key:'stopMinutes',name:'Arrêts',unit:'minutes',className:'stop-row'}
] as const;

export function ProductionGrid({work,disabled,onChange}:{work:Workshop;disabled:boolean;onChange:(value:Workshop)=>void}){
 const description=useId(),direct=work.entryMode==='totals',totals=workshopTotals(work);
 const editTotal=(key:typeof rows[number]['key'],value:number|null)=>onChange({...work,entryMode:'totals',totals:{...(direct?totals:work.totals??totals),[key]:value}});
 return <div className="production-grid" data-entry-mode={direct?'totals':'hourly'}>
  <div className="hourly-caption" id={description} role="status"><span><i/>{direct?'SAISIE DIRECTE DANS TOTAL':'SOMME DES HEURES'}</span><span>{direct?'Les totaux saisis sont utilisés. Les heures restent conservées séparément.':'Les heures sont additionnées. Vous pouvez aussi saisir directement dans TOTAL.'}</span></div>
  <div className="hourly-scroll" role="region" aria-label="Tableau de production et totaux modifiables" tabIndex={0}>
   <table className="hourly-grid" aria-describedby={description}><thead><tr><th scope="col">Indicateur<small>Unité</small></th>{work.hours.map(hour=><th scope="col" key={hour.slot}>{hour.slot}<small>h</small></th>)}<th scope="col" className="total-column">TOTAL<small>{direct?'Saisie directe':'Calculé · modifiable'}</small></th></tr></thead>
    <tbody>{rows.map(row=><tr key={row.key} className={row.className}><th scope="row">{row.name}<small>{row.unit}</small></th>{work.hours.map((hour,index)=><td key={hour.slot} className={direct?'hour-retained':''}><NumberInput label={`${row.name} ${hour.slot}`} value={hour[row.key]} max={row.key==='plannedMinutes'||row.key==='stopMinutes'?60:undefined} disabled={disabled} onChange={value=>onChange({...work,entryMode:'hourly',hours:work.hours.map((item,itemIndex)=>itemIndex===index?{...item,[row.key]:value}:item)})}/></td>)}<td className="total-column"><NumberInput label={`${row.name} — total de l’équipe`} value={totals[row.key]} max={row.key==='plannedMinutes'||row.key==='stopMinutes'?1440:undefined} disabled={disabled} onChange={value=>editTotal(row.key,value)}/>{row.key==='people'&&<small>{direct?'effectif réel':'maximum horaire'}</small>}</td></tr>)}</tbody>
   </table>
  </div>
  <p className="grid-entry-help">Saisissez dans la colonne TOTAL pour renseigner toute l’équipe. Modifier une cellule horaire réactive le calcul à partir des heures. Les deux saisies ne s’additionnent jamais.</p>
 </div>;
}
