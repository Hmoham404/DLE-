'use client';

import {Activity,Box,Focus,Layers3,Maximize2,MoveUpRight,RotateCcw,ScanLine,ZoomIn,ZoomOut} from 'lucide-react';
import type {Machine} from '@/lib/domain';
import {sceneCounts,sceneStatusColors,sceneStatusLabels} from '@/lib/scene-presentation';

export type SceneCameraView='perspective'|'top';
export type SceneCameraCommand={view:SceneCameraView;zoom:number;revision:number;focusId:string|null};
export function MachineSceneHud({machines,selected,onSelect,visibleCount,camera,onCamera,onFullscreen}:{machines:Machine[];selected:string|null;onSelect:(id:string)=>void;visibleCount:number;camera:SceneCameraCommand;onCamera:(command:SceneCameraCommand)=>void;onFullscreen:()=>void}){
 const counts=sceneCounts(machines);
 const chooseView=(view:SceneCameraView)=>onCamera({...camera,view,focusId:null,revision:camera.revision+1});
 return <>
  <aside className="twin-sidebar" aria-label="Informations de la vue 3D">
   <section className="twin-glass twin-overview"><header><span><Activity size={14}/>VUE D’ENSEMBLE</span><span className="twin-source">INVENTAIRE</span></header><div className="twin-total"><strong>{machines.length}</strong><span>unités dans la sélection<small>{visibleCount} volumes affichés</small></span></div>
    <dl className="twin-state-counts">{(['running','stopped','maintenance','idle','unknown'] as const).map(status=><div key={status}><dt><i style={{background:sceneStatusColors[status]}}/>{sceneStatusLabels[status]}</dt><dd>{counts[status]}</dd></div>)}</dl>
    <p>États issus des fiches machines.<br/>Sans connexion aux automates.</p>
   </section>
   <section className="twin-glass twin-minimap-panel"><header><span><ScanLine size={14}/>IMPLANTATION</span><Layers3 size={13}/></header><div className="twin-minimap" role="group" aria-label="Mini-plan de sélection des machines">{machines.map(machine=><button type="button" key={machine.id} style={{left:`${machine.x}%`,top:`${machine.y}%`,background:sceneStatusColors[machine.status]}} className={selected===machine.id?'selected':''} aria-label={`Sélectionner ${machine.name}`} aria-pressed={selected===machine.id} title={machine.name+' · '+sceneStatusLabels[machine.status]} onClick={()=>onSelect(machine.id)}/>)}</div><p>Positions et volumes indicatifs.</p></section>
  </aside>
  <div className="twin-canvas-heading"><span className="twin-eyebrow"><Box size={13}/>ATELIER / MODÈLE 3D</span><strong>Parc machines</strong></div>
  <div className="twin-camera-tools twin-glass" role="group" aria-label="Commandes de caméra">
   <button type="button" aria-label="Vue en perspective" aria-pressed={camera.view==='perspective'} onClick={()=>chooseView('perspective')} title="Perspective"><MoveUpRight size={17}/></button>
   <button type="button" aria-label="Vue du dessus" aria-pressed={camera.view==='top'} onClick={()=>chooseView('top')} title="Vue du dessus"><Layers3 size={17}/></button><span/>
   <button type="button" aria-label="Zoomer" onClick={()=>onCamera({...camera,zoom:Math.min(2.5,camera.zoom*1.2),revision:camera.revision+1})} title="Zoomer"><ZoomIn size={17}/></button>
   <button type="button" aria-label="Dézoomer" onClick={()=>onCamera({...camera,zoom:Math.max(.6,camera.zoom/1.2),revision:camera.revision+1})} title="Dézoomer"><ZoomOut size={17}/></button>
   <button type="button" aria-label="Centrer sur la machine sélectionnée" disabled={!selected} onClick={()=>onCamera({...camera,focusId:selected,zoom:1.8,revision:camera.revision+1})} title="Centrer sur la sélection"><Focus size={17}/></button>
   <button type="button" aria-label="Réinitialiser la caméra" onClick={()=>onCamera({view:'perspective',zoom:1,focusId:null,revision:camera.revision+1})} title="Réinitialiser"><RotateCcw size={16}/></button><span/>
   <button type="button" aria-label="Afficher l’atelier en plein écran" onClick={onFullscreen} title="Plein écran"><Maximize2 size={17}/></button>
  </div>
  <div className="twin-select-machine twin-glass"><label htmlFor="twin-machine-select">Sélectionner une unité</label><select id="twin-machine-select" value={selected&&machines.some(machine=>machine.id===selected)?selected:''} onChange={event=>onSelect(event.target.value)}><option value="">Choisir une machine</option>{machines.map(machine=><option key={machine.id} value={machine.id}>{machine.name}</option>)}</select></div>
  <div className="twin-coordinate-label" aria-hidden="true"><span>Y</span><i/><b>X</b></div>
 </>;
}
