'use client';

import {ArrowLeft,ArrowRight,FilePenLine} from 'lucide-react';
import {Button,Dialog} from './local-factory';

export function UnsavedChangesDialog({onCancel,onLeave}:{onCancel:()=>void;onLeave:()=>void}){
 return <Dialog title="Modifications non enregistrées" onClose={onCancel} className="unsaved-dialog">
  <div className="unsaved-dialog-icon" aria-hidden="true"><FilePenLine size={27}/></div>
  <span className="unsaved-dialog-kicker">AVANT DE CONTINUER</span>
  <h3>Quitter cette saisie ?</h3>
  <p>Vous avez des modifications en attente. Si vous quittez maintenant, elles ne seront pas enregistrées.</p>
  <div className="unsaved-dialog-note"><span aria-hidden="true"/>Restez sur la page pour enregistrer votre travail.</div>
  <div className="dialog-actions"><Button kind="unsaved-stay" onClick={onCancel}><ArrowLeft size={15}/>Continuer la saisie</Button><Button kind="unsaved-leave" onClick={onLeave}>Quitter sans enregistrer<ArrowRight size={15}/></Button></div>
 </Dialog>;
}
