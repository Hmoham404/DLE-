'use client';
import {Trash2} from 'lucide-react';
import type {Report} from '@/lib/domain';
import {shiftLabel} from '@/lib/shifts';
import {Button,Dialog} from './local-factory';
export function DeleteReportDialog({report,machineName,busy,unsaved,onCancel,onConfirm}:{report:Report;machineName:string;busy:boolean;unsaved:boolean;onCancel:()=>void;onConfirm:()=>void}){
 return <Dialog title="Supprimer cette saisie ?" onClose={()=>{if(!busy)onCancel();}}><p className="dialog-help">Cette saisie sera retirée de la production et de la réunion. Son historique restera conservé dans le JSON.</p><dl className="delete-report-summary"><div><dt>Machine / ligne</dt><dd>{machineName}</dd></div><div><dt>Date de production</dt><dd>{report.date}</dd></div><div><dt>Équipe</dt><dd>{shiftLabel(report.shift)}</dd></div><div><dt>Référence / OF</dt><dd>{report.reference||'Sans référence'}</dd></div></dl>{unsaved&&<p className="delete-warning">Les modifications non enregistrées de cette saisie seront également abandonnées.</p>}<div className="dialog-actions"><Button disabled={busy} onClick={onCancel}>Annuler</Button><Button kind="danger" disabled={busy} onClick={onConfirm}><Trash2 size={16}/>{busy?'Suppression…':'Supprimer la saisie'}</Button></div></Dialog>;
}
