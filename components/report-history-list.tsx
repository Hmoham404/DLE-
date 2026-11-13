'use client';
import {ArrowRight,Trash2} from 'lucide-react';
import type {Machine,Report} from '@/lib/domain';
import {shiftLabel} from '@/lib/shifts';
import {fmt} from './local-factory';
export function ReportHistoryList({reports,machines,canDelete,onOpen,onDelete}:{reports:Report[];machines:Machine[];canDelete:boolean;onOpen:(report:Report)=>void;onDelete:(report:Report)=>void}){
 return <div className="history-list"><h3>Rapports enregistrés</h3>{reports.length?reports.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(report=><div className="report-history-item" key={report.id}><button className="history-open" onClick={()=>onOpen(report)}><span>{report.date}<small>{machines.find(machine=>machine.id===report.machine_id)?.name} · {shiftLabel(report.shift)}</small></span><span>{report.reference||'Sans référence'}<small>{fmt(report.metrics.actual)} pièces · {report.status==='validated'?'Validé':'Brouillon'}</small></span><ArrowRight size={17}/></button>{canDelete&&<button className="history-delete" aria-label={'Supprimer la saisie '+(report.reference||report.date)} title="Supprimer cette saisie" onClick={()=>onDelete(report)}><Trash2 size={17}/></button>}</div>):<p>Aucune saisie enregistrée.</p>}</div>;
}
