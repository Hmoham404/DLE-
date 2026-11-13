'use client';

import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {Mic,Square} from 'lucide-react';
import {parseCauseDictation,type CauseUnit} from '@/lib/cause-dictation';

type RecognitionResult={isFinal:boolean;0:{transcript:string}};
type Recognition={
 lang:string;continuous:boolean;interimResults:boolean;maxAlternatives:number;
 onresult:((event:{resultIndex:number;results:ArrayLike<RecognitionResult>})=>void)|null;
 onerror:((event:{error:string})=>void)|null;
 onend:(()=>void)|null;
 start:()=>void;stop:()=>void;abort:()=>void;
};
type SpeechWindow=Window&{
 SpeechRecognition?:new()=>Recognition;
 webkitSpeechRecognition?:new()=>Recognition;
};
const stopOtherDictation='myc-stop-cause-dictation';
const subscribe=()=>()=>{};
const speechSupported=()=>{const browser=window as SpeechWindow;return Boolean(browser.SpeechRecognition||browser.webkitSpeechRecognition);};
const serverSupported=()=>null;

export function CauseTextInput({value,onChange,onDictate,unit,label,disabled}:{value:string;onChange:(text:string)=>void;onDictate:(cause:string,quantity:number|null)=>void;unit:CauseUnit;label:string;disabled:boolean}){
 const supported=useSyncExternalStore(subscribe,speechSupported,serverSupported);
 const [listening,setListening]=useState(false),[message,setMessage]=useState('');
 const recognition=useRef<Recognition|null>(null),latest=useRef({value,onChange,onDictate,unit,disabled});
 useEffect(()=>{
  if(latest.current.value!==value)recognition.current?.abort();
  latest.current={value,onChange,onDictate,unit,disabled};
 },[value,onChange,onDictate,unit,disabled]);
 useEffect(()=>{
  const stop=()=>recognition.current?.abort();
  window.addEventListener(stopOtherDictation,stop);
  return()=>{window.removeEventListener(stopOtherDictation,stop);const active=recognition.current;recognition.current=null;if(active){active.onresult=null;active.onerror=null;active.onend=null;active.abort();}};
 },[]);
 useEffect(()=>{if(disabled)recognition.current?.abort();},[disabled]);
 const dictate=()=>{
  if(listening){recognition.current?.stop();return;}
  if(disabled)return;
  const browser=window as SpeechWindow,Constructor=browser.SpeechRecognition||browser.webkitSpeechRecognition;
  if(!Constructor){setMessage('Dictée indisponible dans ce navigateur. Vous pouvez écrire la cause au clavier.');return;}
  window.dispatchEvent(new Event(stopOtherDictation));
  const active=new Constructor();recognition.current=active;
  active.lang='fr-FR';active.continuous=false;active.interimResults=false;active.maxAlternatives=1;
  setMessage('');
  active.onresult=event=>{
   if(recognition.current!==active||latest.current.disabled)return;
   const parts:string[]=[];
   for(let i=event.resultIndex;i<event.results.length;i++)if(event.results[i].isFinal)parts.push(event.results[i][0].transcript);
   const text=parts.join(' ').trim();
   if(text){
    const current=latest.current,parsed=parseCauseDictation(text,current.unit);
    const next=[current.value.trim(),parsed.cause].filter(Boolean).join(' ').slice(0,150);
    latest.current={...current,value:next};current.onDictate(next,parsed.quantity);
    setMessage(parsed.quantity!==null?`Cause et quantité renseignées : ${parsed.quantity} ${current.unit}. Vous pouvez les corriger.`:'Texte ajouté. Indiquez la quantité dans le champ à côté.');
   }
  };
  active.onerror=event=>{
   if(recognition.current!==active)return;
   const errors:Record<string,string>={
    'not-allowed':'Accès au microphone refusé. Autorisez-le dans le navigateur ou écrivez au clavier.',
    'service-not-allowed':'Le service de dictée est indisponible. Vous pouvez écrire au clavier.',
    'audio-capture':'Microphone introuvable. Vérifiez son branchement ou écrivez au clavier.',
    'no-speech':'Aucune parole détectée. Réessayez ou écrivez au clavier.',
    network:'Connexion au service vocal impossible. Vérifiez Internet ou écrivez au clavier.',
    'language-not-supported':'La dictée en français est indisponible dans ce navigateur.'
   };
   if(event.error!=='aborted')setMessage(errors[event.error]||'La dictée a été interrompue. Vous pouvez écrire au clavier.');
  };
  active.onend=()=>{if(recognition.current===active){recognition.current=null;setListening(false);}};
  try{active.start();setListening(true);}catch{recognition.current=null;setListening(false);setMessage('Impossible de démarrer le micro. Vous pouvez écrire au clavier.');}
 };
 return <div className="cause-text-field"><div className="cause-text-controls"><input placeholder="Cause / type de défaut" aria-label={label} value={value} maxLength={150} disabled={disabled||listening} onChange={event=>onChange(event.target.value)}/><button type="button" className={'cause-microphone'+(listening?' listening':'')} onClick={dictate} disabled={disabled||supported!==true} aria-label={listening?'Arrêter la dictée de '+label:'Dicter '+label} aria-pressed={listening} title={supported===false?'Dictée indisponible dans ce navigateur':listening?'Arrêter la dictée':'Dicter en français, sans clé API'}>{listening?<Square size={14}/>:<Mic size={16}/>}</button></div><span className="cause-dictation-status" role="status">{listening?'Écoute en cours… Parlez puis cliquez sur Arrêter.':message||(supported===false?'Dictée indisponible ici · saisie au clavier disponible.':supported===true?(unit==='min'?'Exemple : 30 minutes panne machine':'Exemple : 20 pièces rayures'):'')}</span></div>;
}
