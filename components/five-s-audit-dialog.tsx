'use client';
import {useState,type FormEvent} from 'react';
import {CalendarCheck,CheckCheck,ClipboardCheck} from 'lucide-react';
import {auditRatings,auditScore,auditStatuses,fiveSAuditSchema,fiveSCriteria,type FiveSAudit} from '@/lib/five-s-audits';
import {Button,Dialog} from './local-factory';

type Props={initial:FiveSAudit;canEdit:boolean;onClose:()=>void;onSaved:()=>Promise<void>};
export function FiveSAuditDialog({initial,canEdit,onClose,onSaved}:Props){
 const [draft,setDraft]=useState(initial),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const update=(change:Partial<FiveSAudit>)=>setDraft(value=>({...value,...change}));
 const close=()=>{if(!busy&&(!canEdit||JSON.stringify(draft)===JSON.stringify(initial)||window.confirm('Fermer cet audit sans enregistrer les modifications ?')))onClose();};
 const save=async(event:FormEvent)=>{
  event.preventDefault();if(!canEdit||busy)return;setError('');
  const parsed=fiveSAuditSchema.safeParse(draft);
  if(!parsed.success){setError(parsed.error.issues[0]?.message||'Vérifiez les informations de l’audit.');return;}
  setBusy(true);
  try{
   const response=await fetch('/api/five-s/audits',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(parsed.data)});
   const result=await response.json() as {error?:string};if(!response.ok)throw new Error(result.error||'L’audit n’a pas pu être enregistré.');
   await onSaved();
  }catch(failure){setError((failure as Error).message==='Failed to fetch'?'Connexion interrompue. Votre audit reste à l’écran.':(failure as Error).message);}
  finally{setBusy(false);}
 };
 const score=auditScore(draft),answered=fiveSCriteria.filter(item=>draft.checks[item.id]!==null).length;
 return <Dialog title={initial.updated_at?'Audit 5S de la machine':'Planifier un audit 5S'} wide onClose={close} className="five-s-audit-dialog">
  <form className="five-s-audit-form" onSubmit={save}>
   <div className="audit-machine-banner"><span><ClipboardCheck size={24}/></span><div><small>MACHINE SÉLECTIONNÉE</small><h3>{draft.machine_name}</h3><p>{draft.plan_id==='injection'?'Site injection':'Site métallisation'} · L’audit est lié à cette machine.</p></div></div>
   <fieldset disabled={!canEdit||busy}>
    <div className="audit-schedule"><label className="field">Date de l’audit<input type="date" required value={draft.scheduled_date} onChange={event=>update({scheduled_date:event.target.value})}/></label><label className="field">Heure (facultatif)<input type="time" value={draft.scheduled_time} onChange={event=>update({scheduled_time:event.target.value})}/></label><label className="field">Responsable de l’audit<input autoFocus required maxLength={100} placeholder="Nom de l’auditeur" value={draft.owner} onChange={event=>update({owner:event.target.value})}/></label><label className="field">Statut de l’audit<select value={draft.status} onChange={event=>update({status:event.target.value as FiveSAudit['status']})}>{auditStatuses.map(status=><option key={status}>{status}</option>)}</select></label></div>
    <details className="audit-checklist" open={draft.status!=='Planifié'||undefined}><summary><CheckCheck size={17}/><span>Réaliser l’audit · Les cinq S</span><b>{score===null?answered+'/5 évalués':score+' %'}</b></summary><p>Pour chaque point : 0 = non conforme, 1 = partiel, 2 = conforme. Le résultat est calculé lorsque les cinq points sont évalués.</p><div>{fiveSCriteria.map((criterion,index)=><div className="audit-criterion" key={criterion.id}><div><span>0{index+1}</span><label htmlFor={'audit-'+criterion.id}><strong>{criterion.name}</strong><small>{criterion.question}</small></label></div><select id={'audit-'+criterion.id} aria-label={'Évaluation 5S · '+criterion.name} value={draft.checks[criterion.id]??''} onChange={event=>update({checks:{...draft.checks,[criterion.id]:event.target.value===''?null:Number(event.target.value)}})}><option value="">À évaluer</option>{auditRatings.map(item=><option key={item.value} value={item.value}>{item.value} · {item.label}</option>)}</select></div>)}</div></details>
    <div className="form-two audit-notes"><label className="field">Observations (facultatif)<textarea rows={3} maxLength={2000} placeholder="Points à contrôler, constats…" value={draft.notes} onChange={event=>update({notes:event.target.value})}/></label><label className="field">Actions à suivre (facultatif)<textarea rows={3} maxLength={2000} placeholder="Ce qui doit être corrigé après l’audit…" value={draft.action} onChange={event=>update({action:event.target.value})}/></label></div>
   </fieldset>
   {error&&<p className="five-s-error" role="alert">{error}</p>}
   <div className="dialog-actions"><Button disabled={busy} onClick={close}>Fermer</Button>{canEdit&&<Button type="submit" kind="primary" disabled={busy}><CalendarCheck size={16}/>{busy?'Enregistrement…':initial.updated_at?'Enregistrer l’audit':draft.status==='Planifié'?'Planifier l’audit':'Enregistrer l’audit'}</Button>}</div>
  </form>
 </Dialog>;
}
