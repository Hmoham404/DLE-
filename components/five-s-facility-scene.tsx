'use client';
import {useEffect,useMemo,useRef} from 'react';
import {Canvas,useThree,type ThreeEvent} from '@react-three/fiber';
import {CanvasTexture,SRGBColorSpace} from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import type {FiveSTag} from '@/lib/five-s';
import type {MapMachine} from '@/lib/five-s-machines';
import {facilityLayouts,planToWorld,worldToPlan,zoneCenter,zoneColors,tagColors,type PlanId,type PlanPoint,type FacilityZone} from '@/lib/five-s-layout';

export type FacilityCamera={top:boolean;zoom:number;revision:number};
export type FacilitySceneProps={plan:PlanId;tags:FiveSTag[];machines:MapMachine[];selectedMachine:string|null;onSelectMachine:(machine:MapMachine)=>void;selected:string|null;placing:boolean;camera:FacilityCamera;onSelect:(zone:FacilityZone,point:PlanPoint)=>void;onOpenTag:(tag:FiveSTag)=>void;onUnavailable:()=>void};

function Box({at,size,color}:{at:[number,number,number];size:[number,number,number];color:string}){return <mesh position={at} receiveShadow><boxGeometry args={size}/><meshStandardMaterial color={color} roughness={.75} metalness={.12}/></mesh>;}
function Label({text,position,selected=false,small=false}:{text:string;position:[number,number,number];selected?:boolean;small?:boolean}){
 const texture=useMemo(()=>{
  const canvas=document.createElement('canvas');canvas.width=small?128:384;canvas.height=72;
  const ctx=canvas.getContext('2d');if(!ctx)return null;
  ctx.fillStyle=selected?'#d4f4dc':'#142f32';ctx.beginPath();ctx.roundRect(0,0,canvas.width,72,9);ctx.fill();
  ctx.fillStyle=selected?'#122d25':'#e6f3ed';ctx.font=small?'600 44px sans-serif':'500 38px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,canvas.width/2,37,canvas.width-20);
  const result=new CanvasTexture(canvas);result.colorSpace=SRGBColorSpace;return result;
 },[text,selected,small]);
 useEffect(()=>()=>texture?.dispose(),[texture]);
 return texture?<sprite position={position} scale={small?[2.4,.55,1]:[6.2,1.16,1]} renderOrder={selected?5:2}><spriteMaterial map={texture} transparent depthTest={false}/></sprite>:null;
}
function InventoryMachine({item,selected,onSelect}:{item:MapMachine;selected:boolean;onSelect:(item:MapMachine)=>void}){
 const injection=item.machine.department==='injection',w=item.size.w*.5,h=item.size.h*.3535;
 return <group position={planToWorld(item.machine.department==='injection'?'injection':'metalisation',item.position)}
  onClick={event=>{event.stopPropagation();onSelect(item);}}
  onPointerOver={event=>{event.stopPropagation();(event.nativeEvent.target as HTMLElement).style.cursor='pointer';}}
  onPointerOut={event=>{(event.nativeEvent.target as HTMLElement).style.cursor='grab';}}>
  <Box at={[0,.16,0]} size={[w,.15,h]} color={selected?'#f5ce6b':'#487970'}/>
  <Box at={[0,.38,0]} size={[w*.75,.35,h*.83]} color={selected?'#b8daca':'#8da89e'}/>
  <Box at={[0,.85,-h*.18]} size={[w*.77,.7,h*.45]} color={selected?'#d8eadb':'#b6c4bd'}/>
  <Box at={[0,.87,-h*.41]} size={[w*.55,.35,.025]} color="#254f4d"/>
  {injection?<><Box at={[0,.55,h*.25]} size={[w*.55,.28,h*.35]} color="#6e948a"/><mesh position={[0,1.18,h*.25]}><cylinderGeometry args={[.22,.07,.53,8]}/><meshStandardMaterial color="#b7c7bc" metalness={.6} roughness={.4}/></mesh></>:<Box at={[0,.85,h*.22]} size={[w*.65,.6,h*.25]} color="#668c86"/>}
  {selected&&<mesh position={[0,.26,0]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[Math.max(w,h)*.63,Math.max(w,h)*.69,40]}/><meshBasicMaterial color="#ffda78"/></mesh>}
  <Label text={selected?item.machine.name:item.label} position={[0,selected?2.3:1.8,0]} selected={selected} small={!selected}/>
 </group>;
}
function Furniture({zone}:{zone:FacilityZone}){
 const w=zone.rect.w*.5,h=zone.rect.h*.3535;
 if(zone.furniture==='racks'){
  const vertical=w<h,rows=Math.max(2,Math.min(6,Math.round((vertical?w:h)/1.4)));
  return <>{Array.from({length:rows},(_,i)=><group key={i} position={vertical?[-w/2+(i+1)*w/(rows+1),0,0]:[0,0,-h/2+(i+1)*h/(rows+1)]}>
   {[.2,.7,1.2].map(y=><Box key={y} at={[0,y,0]} size={vertical?[.45,.1,h*.7]:[w*.75,.1,.45]} color="#baa379"/>)}
   {[-1,1].map(side=><Box key={side} at={vertical?[0,.7,side*h*.34]:[side*w*.37,.7,0]} size={[.08,1.5,.08]} color="#5a6e71"/>)}
  </group>)}</>;
 }
 if(zone.furniture==='line')return <>{[-.2,.2].map((r,i)=><group key={i} position={[w*r,0,0]}><Box at={[0,.45,0]} size={[w*.23,.3,h*.7]} color="#8da9a6"/>{[-.25,0,.25].map(z=><Box key={z} at={[0,.87,h*z]} size={[w*.27,.55,.5]} color="#4b7271"/>)}</group>)}</>;
 if(zone.furniture==='benches')return <>{[-.22,.22].map(r=><group key={r}><Box at={[w*r,.58,0]} size={[w*.27,.16,h*.6]} color="#b2bcb2"/><Box at={[w*r,.27,0]} size={[w*.23,.5,h*.5]} color="#476963"/></group>)}</>;
 return null;
}
function Zone({zone,props}:{zone:FacilityZone;props:FacilitySceneProps}){
 const selected=zone.id===props.selected,w=zone.rect.w*.5,h=zone.rect.h*.3535,wall=zone.category==='support'||zone.category==='commun'?.72:.26;
 const click=(e:ThreeEvent<MouseEvent>)=>{e.stopPropagation();props.onSelect(zone,worldToPlan(props.plan,e.point.x,e.point.z));};
 return <group position={planToWorld(props.plan,zoneCenter(zone))} onClick={click} onPointerOver={e=>{e.stopPropagation();(e.nativeEvent.target as HTMLElement).style.cursor=props.placing?'crosshair':'pointer';}} onPointerOut={e=>{(e.nativeEvent.target as HTMLElement).style.cursor='grab';}}>
  <Box at={[0,.035,0]} size={[w,.15,h]} color={selected?'#4c8d75':zone.category==='production'?'#294b48':zone.category==='stockage'?'#494737':'#34454a'}/>
  {[-1,1].map(side=><Box key={'z'+side} at={[0,wall/2+.05,side*h/2]} size={[w,wall,.055]} color={selected?'#a2edb9':zoneColors[zone.category]}/>)}
  {[-1,1].map(side=><Box key={'x'+side} at={[side*w/2,wall/2+.05,0]} size={[.055,wall,h]} color={selected?'#a2edb9':zoneColors[zone.category]}/>)}
  {zone.category!=='production'&&<Furniture zone={zone}/>}
  {(selected||(zone.rect.w>10&&zone.rect.h>7))&&!props.machines.some(item=>item.zone.id===zone.id)&&<Label text={zone.short} selected={selected} position={[0,1.85,0]}/>}
 </group>;
}
function Controls({plan,camera:command,onUnavailable}:{plan:PlanId;camera:FacilityCamera;onUnavailable:()=>void}){
 const {camera,gl,invalidate,size}=useThree(),controls=useRef<OrbitControls|null>(null);
 useEffect(()=>{
  const control=new OrbitControls(camera,gl.domElement);controls.current=control;
  control.maxPolarAngle=Math.PI/2.15;control.minDistance=8;control.maxDistance=90;control.enableDamping=false;control.enablePan=true;
  const change=()=>invalidate(),lost=(event:Event)=>{event.preventDefault();onUnavailable();};
  control.addEventListener('change',change);gl.domElement.addEventListener('webglcontextlost',lost);
  return()=>{control.removeEventListener('change',change);gl.domElement.removeEventListener('webglcontextlost',lost);control.dispose();};
 },[camera,gl,invalidate,onUnavailable]);
 useEffect(()=>{
  const bounds=facilityLayouts[plan].bounds,span=Math.max(bounds.w*.5,bounds.h*.3535),fit=Math.max(1,1.3/(size.width/Math.max(1,size.height))),d=span*fit/command.zoom;
  camera.position.set(command.top?0:d*.68,command.top?d*1.22:d*.88,command.top?.01:d*.82);
  controls.current?.target.set(0,0,0);controls.current?.update();invalidate();
 },[plan,command.top,command.zoom,command.revision,size.width,size.height,camera,invalidate]);
 return null;
}
export default function FiveSFacilityScene(props:FacilitySceneProps){
 const layout=facilityLayouts[props.plan],w=layout.bounds.w*.5,h=layout.bounds.h*.3535;
 return <Canvas frameloop="demand" dpr={[1,1.5]} camera={{position:[25,32,32],fov:43,near:.1,far:180}} aria-label={'Maquette 3D du '+layout.name} fallback={<div className="facility-no-webgl">La 3D nécessite WebGL. Choisissez le plan 2D ou une zone dans la liste.</div>}>
  <color attach="background" args={['#10282b']}/>
  <hemisphereLight args={['#e2f3e9','#455858',2.4]}/>
  <directionalLight position={[8,24,10]} intensity={3} color="#fff1d3"/>
  <directionalLight position={[-12,12,-8]} intensity={1.6} color="#a7d4d9"/>
  <gridHelper args={[100,100,'#315052','#1c373a']} position={[0,-.3,0]}/>
  <Box at={[0,-.17,0]} size={[w+1,.28,h+1]} color="#b1bdb3"/>
  <Box at={[0,-.01,0]} size={[w+.5,.1,h+.5]} color="#233f3d"/>
  {layout.aisles.map((rect,i)=><Box key={i} at={planToWorld(props.plan,{x:rect.x+rect.w/2,y:rect.y+rect.h/2}).map((v,j)=>j===1?.105:v) as [number,number,number]} size={[rect.w*.5,.025,rect.h*.3535]} color="#70947a"/>)}
  {layout.zones.map(zone=><Zone key={zone.id} zone={zone} props={props}/>)}
  {props.machines.map(item=><InventoryMachine key={item.machine.id} item={item} selected={props.selectedMachine===item.machine.id} onSelect={props.onSelectMachine}/>)}
  {props.tags.filter(tag=>tag.position).map(tag=>{
   const [x,,z]=planToWorld(props.plan,tag.position!);
   return <group key={tag.id} position={[x,0,z]} onClick={e=>{e.stopPropagation();if(!props.placing)props.onOpenTag(tag);}}>
    <Box at={[0,1.2,0]} size={[.055,2.4,.055]} color={tagColors[tag.color]}/>
    <mesh position={[0,2.6,0]}><octahedronGeometry args={[.37]}/><meshStandardMaterial color={tagColors[tag.color]} emissive={tagColors[tag.color]} emissiveIntensity={.4} wireframe={tag.status==='Clôturée'}/></mesh>
   </group>;
  })}
  <Controls plan={props.plan} camera={props.camera} onUnavailable={props.onUnavailable}/>
 </Canvas>;
}
