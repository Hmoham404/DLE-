'use client';
import {useEffect,useMemo,useRef} from 'react';
import {Canvas,useThree,type ThreeEvent} from '@react-three/fiber';
import {CanvasTexture,PCFShadowMap,SRGBColorSpace} from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import type {Machine} from '@/lib/domain';
import {scenePoint,sceneShortName,sceneStatusColors,sceneStatusLabels} from '@/lib/scene-presentation';
import type {SceneCameraCommand} from './machine-scene-hud';

function Controls({command=defaultCamera,machines}:{command:SceneCameraCommand;machines:Machine[]}){
 const {camera,gl,invalidate}=useThree(),controls=useRef<OrbitControls|null>(null);
 const focused=machines.find(machine=>machine.id===command.focusId);
 const focusX=focused?(focused.x-50)/6:0,focusZ=focused?(focused.y-50)/6:0;
 useEffect(()=>{
  const control=new OrbitControls(camera,gl.domElement);controls.current=control;
  control.maxPolarAngle=Math.PI/2.13;control.minDistance=4;control.maxDistance=55;
  control.enableDamping=false;control.autoRotate=false;control.zoomSpeed=.8;
  const changed=()=>invalidate();control.addEventListener('change',changed);
  return()=>{controls.current=null;control.removeEventListener('change',changed);control.dispose();};
 },[camera,gl,invalidate]);
 useEffect(()=>{
  const control=controls.current;if(!control)return;
  control.target.set(focusX,0,focusZ);
  if(command.view==='top')camera.position.set(focusX,27/command.zoom,focusZ+.1);
  else camera.position.set(focusX+16/command.zoom,16/command.zoom,focusZ+21/command.zoom);
  control.update();invalidate();
 },[command.view,command.zoom,command.revision,focusX,focusZ,camera,invalidate]);
 return null;
}
function Part({position,size,color='#9cb3b8',metal=.5}:{position:[number,number,number];size:[number,number,number];color?:string;metal?:number}){
 return <mesh position={position} castShadow receiveShadow><boxGeometry args={size}/><meshStandardMaterial color={color} roughness={.4} metalness={metal}/></mesh>;
}
function Cylinder({position,radius,length,color='#adbec3',rotation=[0,0,Math.PI/2]}:{position:[number,number,number];radius:number;length:number;color?:string;rotation?:[number,number,number]}){
 return <mesh position={position} rotation={rotation} castShadow><cylinderGeometry args={[radius,radius,length,16]}/><meshStandardMaterial color={color} roughness={.3} metalness={.75}/></mesh>;
}
function Nameplate({machine,selected}:{machine:Machine;selected:boolean}){
 const shortName=sceneShortName(machine),status=machine.status;
 const texture=useMemo(()=>{
  const canvas=document.createElement('canvas');canvas.width=384;canvas.height=112;
  const context=canvas.getContext('2d');if(!context)return null;
  context.fillStyle=selected?'#173b31':'#14292e';context.fillRect(1,1,382,110);
  context.strokeStyle=selected?'#79e6a6':'#426068';context.lineWidth=3;context.strokeRect(2,2,380,108);
  context.fillStyle=sceneStatusColors[status];context.fillRect(18,22,7,27);
  context.font='600 32px sans-serif';context.fillStyle='#e6f2ef';context.fillText(shortName,40,48,325);
  context.font='22px sans-serif';context.fillStyle='#adc1c4';context.fillText(sceneStatusLabels[status],20,88,345);
  const value=new CanvasTexture(canvas);value.colorSpace=SRGBColorSpace;return value;
 },[shortName,status,selected]);
 useEffect(()=>()=>texture?.dispose(),[texture]);
 return texture?<sprite position={[0,2.65,0]} scale={[3.1,.9,1]}><spriteMaterial map={texture} transparent depthTest={false} toneMapped={false}/></sprite>:null;
}
function InjectionPress(){
 return <>
  <Part position={[-.65,.95,0]} size={[1.2,1.2,1.36]} color="#aebfbd"/>
  <Part position={[-.65,1.08,.692]} size={[.95,.64,.035]} color="#244445" metal={.2}/>
  <Part position={[-.65,1.09,.722]} size={[.74,.43,.025]} color="#3f6665" metal={.25}/>
  <Part position={[-.66,.66,.735]} size={[.04,.24,.045]} color="#c5d1cb"/>
  <Part position={[-.65,1.62,0]} size={[1.24,.1,1.41]} color="#315a4d"/>
  <Part position={[.47,.68,0]} size={[1.04,.48,1.04]} color="#617f80"/>
  <Cylinder position={[.57,1.02,0]} radius={.18} length={1.4}/>
  <Cylinder position={[1.26,1.02,0]} radius={.28} length={.36} color="#3c595d"/>
  {[-.36,.36].map(z=><Cylinder key={z} position={[.2,1.18,z]} radius={.045} length={1.05}/>)}
  <mesh position={[.7,1.6,0]} castShadow><cylinderGeometry args={[.33,.09,.65,20]}/><meshStandardMaterial color="#becdc7" metalness={.7} roughness={.27}/></mesh>
  <Part position={[.7,1.94,0]} size={[.75,.07,.75]} color="#697f7b"/>
  <Part position={[-1.3,.98,.83]} size={[.11,.68,.33]} color="#273e43"/>
  <Part position={[-1.29,1.13,1.005]} size={[.1,.21,.015]} color="#68a8aa" metal={.1}/>
  {[-.88,-.66,-.44].map(x=><Part key={x} position={[x,.49,.7]} size={[.12,.035,.025]} color="#516d68"/>)}
 </>;
}
function Equipment({machine,selected,onSelect,showLabel}:{machine:Machine;selected:boolean;onSelect:(machine:Machine)=>void;showLabel:boolean}){
 const signal=sceneStatusColors[machine.status],base=selected?'#39785c':'#345450';
 const click=(event:ThreeEvent<MouseEvent>)=>{event.stopPropagation();onSelect(machine);};
 const pointer=(event:ThreeEvent<PointerEvent>,cursor:string)=>{event.stopPropagation();const target=event.nativeEvent.target as HTMLElement;target?.style?.setProperty('cursor',cursor);};
 return <group position={scenePoint(machine)} onClick={click} onPointerOver={event=>pointer(event,'pointer')} onPointerOut={event=>pointer(event,'grab')}>
  <Part position={[0,.035,0]} size={[3.35,.07,2.5]} color={selected?'#173e32':'#102e2b'} metal={.2}/>
  {[-1,1].map(side=><Part key={side} position={[0,.085,side*1.19]} size={[3.2,.025,.035]} color={selected?'#83e59f':'#397968'} metal={.2}/>)}
  <Part position={[0,.24,0]} size={[2.9,.28,1.6]} color={base}/>
  {[-1.08,1.08].flatMap(x=>[-.57,.57].map(z=><Part key={`${x}:${z}`} position={[x,.17,z]} size={[.2,.3,.23]} color="#1b3335"/>))}
  {machine.assetKind==='support'||machine.assetKind==='tooling'?<>
   <Part position={[0,.85,0]} size={[1.6,1.05,1.2]} color="#8baba7"/>
   <Part position={[0,.86,.61]} size={[.04,.95,.025]} color="#264845"/>
   {[-.5,.5].map(x=><Cylinder key={x} position={[x,1.4,0]} radius={.07} length={.2} rotation={[0,0,0]}/>)}
  </>:machine.department==='injection'?<InjectionPress/>:machine.department==='metalisation'?<>
   <mesh position={[0,1.1,0]} rotation={[Math.PI/2,0,0]} castShadow><cylinderGeometry args={[.8,.8,1.55,32]}/><meshStandardMaterial color="#a9c0bd" metalness={.8} roughness={.3}/></mesh>
   <mesh position={[0,1.1,.8]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[.7,.07,10,32]}/><meshStandardMaterial color="#3f6663" metalness={.75}/></mesh>
   <Part position={[1.01,.86,.12]} size={[.5,1.05,.7]} color={base}/>
  </>:machine.department==='serigraphie'?<>
   <Part position={[0,.67,0]} size={[2.6,.25,1.2]} color="#29474a"/>
   {[-.7,.5].map(x=><group key={x}><Part position={[x,1.15,-.5]} size={[.1,1.1,.1]}/><Part position={[x,1.15,.5]} size={[.1,1.1,.1]}/><Part position={[x,1.65,0]} size={[.65,.16,1.35]} color={base}/></group>)}
  </>:<><Part position={[0,.8,0]} size={[2.8,.25,1]} color="#314d53"/>{[-1,-.5,0,.5,1].map(x=><Part key={x} position={[x,.98,0]} size={[.25,.1,.35]} color="#abbdb0"/>)}<Part position={[.2,1.35,-.55]} size={[.15,1,.15]}/><Part position={[.45,1.8,-.2]} size={[.7,.15,.9]} color={base}/></>}
  <Part position={[-1.12,1.47,-.65]} size={[.08,.7,.08]} color="#456163"/>
  <mesh position={[-1.12,1.9,-.65]}><sphereGeometry args={[.1,10,10]}/><meshStandardMaterial color={signal} emissive={signal} emissiveIntensity={.5}/></mesh>
  {selected&&<mesh position={[0,.1,0]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[1.85,1.89,48]}/><meshBasicMaterial color="#8ae8ac" transparent opacity={.85}/></mesh>}
  {showLabel&&<Nameplate machine={machine} selected={selected}/>}
 </group>;
}
const defaultCamera:SceneCameraCommand={view:'perspective',zoom:1,revision:0,focusId:null};
export default function VirtualMachines({machines,selected,onSelect,cameraCommand=defaultCamera}:{machines:Machine[];selected:string|null;onSelect:(machine:Machine)=>void;cameraCommand?:SceneCameraCommand}){
 return <div className="digital-twin-canvas"><Canvas shadows={{type:PCFShadowMap}} frameloop="demand" dpr={[1,1.5]} camera={{position:[16,16,21],fov:42,near:.1,far:100}} aria-label="Vue 3D indicative des équipements MYC" fallback={<div className="scene-loading">WebGL indisponible. Utilisez le plan 2D ou les fiches.</div>}>
  <color attach="background" args={['#081b1e']}/><fog attach="fog" args={['#081b1e',34,70]}/>
  <hemisphereLight args={['#c1e1db','#182a29',2.2]}/>
  <directionalLight position={[6,18,6]} intensity={3.2} color="#e0f6e8" castShadow shadow-mapSize={[1024,1024]} shadow-camera-left={-15} shadow-camera-right={15} shadow-camera-top={15} shadow-camera-bottom={-15} shadow-bias={-.0005}/>
  <directionalLight position={[-9,7,-8]} color="#78a7c0" intensity={2}/>
  <mesh rotation={[-Math.PI/2,0,0]} receiveShadow position={[0,-.055,0]}><planeGeometry args={[48,48]}/><meshStandardMaterial color="#0d2426" metalness={.3} roughness={.8}/></mesh>
  <gridHelper args={[46,46,'#315d59','#1b3b3c']} position={[0,-.04,0]}/>
  {[-10.5,10.5].map(z=><Part key={z} position={[0,-.01,z]} size={[23,.015,.04]} color="#427963" metal={.1}/>)}
  {machines.map(machine=><Equipment key={machine.id} machine={machine} selected={selected===machine.id} onSelect={onSelect} showLabel={machines.length<=32||selected===machine.id}/>)}
  <Controls command={cameraCommand} machines={machines}/>
 </Canvas></div>;
}
