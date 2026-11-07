import {useEffect,useId,useRef,useState} from 'react';
import type {ReactNode} from 'react';
import {AlertCircle,LoaderCircle,Moon,Sun,X} from 'lucide-react';

export function ErrorBox({error,retry}:{error:unknown;retry?:()=>void}) {
 if(!error)return null;
 return (
  <div className="error" role="alert">
   <AlertCircle size={20}/>
   <span>{error instanceof Error?error.message:'İşlem tamamlanamadı.'}</span>
   {retry&&<button onClick={retry}>Yeniden dene</button>}
  </div>
 );
}

export function Loading(){
 return <div className="empty" role="status"><LoaderCircle className="spin" size={24}/> Yükleniyor…</div>;
}

export function Empty({children}:{children:ReactNode}){
 return <div className="empty">{children}</div>;
}

export function Modal({title,children,onClose,preventClose=false}:{title:string;children:ReactNode;onClose:()=>void;preventClose?:boolean}){
 const ref=useRef<HTMLDialogElement>(null);
 const titleId=useId();

 useEffect(()=>{
  const d=ref.current;
  if(!d)return;
  const previous=document.activeElement as HTMLElement|null;
  if(!d.open)d.showModal();
  return ()=>{
   d.close();
   previous?.focus();
  };
 },[]);

 return (
  <dialog
   ref={ref}
   aria-labelledby={titleId}
   onCancel={e=>{
    if(preventClose){
     e.preventDefault();
     return;
    }
    onClose();
   }}
   onClick={e=>{
    if(e.target===ref.current&&!preventClose){
     onClose();
    }
   }}
  >
   <div className="modal-head">
    <h2 id={titleId}>{title}</h2>
    <button
     type="button"
     className="icon-button"
     onClick={onClose}
     disabled={preventClose}
     aria-label="Pencereyi kapat"
    >
     <X size={20}/>
    </button>
   </div>
   {children}
  </dialog>
 );
}

export type ThemeMode = 'light' | 'dark';

export function ThemeToggle(){
 const [mode,setMode]=useState<ThemeMode>(()=>
  document.documentElement.getAttribute('data-theme')==='dark'?'dark':'light'
 );

 useEffect(()=>{
  document.documentElement.setAttribute('data-theme',mode);
  try {
   localStorage.setItem('restorant_theme',mode);
  } catch {
   // The theme remains available for this page even when storage is blocked.
  }
 },[mode]);

 const cycle=()=>{
  setMode(prev=>prev==='light'?'dark':'light');
 };

 const label=mode==='light'?'Açık tema':'Koyu tema';
 const Icon=mode==='light'?Sun:Moon;

 return (
  <button
   type="button"
   className="icon-button theme-toggle"
   onClick={cycle}
   aria-label={`Tema: ${label}. Değiştirmek için dokunun.`}
   title={`Tema: ${label}`}
  >
   <Icon size={18}/>
   <span className="theme-label">{label}</span>
  </button>
 );
}
