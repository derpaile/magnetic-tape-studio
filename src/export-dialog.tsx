import React,{useEffect,useRef,useState} from 'react';
import type {Take} from './audio';
import {prepareExport,type ExportOptions} from './export';
export function ExportDialog({take,sessionName,onClose,onTrim}:{take:Take;sessionName:string;onClose:()=>void;onTrim:(start:number,end:number)=>void}){
  const [format,setFormat]=useState<ExportOptions['format']>('wav'),[bits,setBits]=useState<16|24>(16),[bitrate,setBitrate]=useState<128|192|256>(256);
  const [name,setName]=useState(`${sessionName} - ${take.name}`),[start,setStart]=useState(take.trimStart||0),[end,setEnd]=useState(take.trimEnd||take.duration),[progress,setProgress]=useState(0),[message,setMessage]=useState(''),[error,setError]=useState('');
  const [busy,setBusy]=useState(false),controller=useRef<AbortController|null>(null);
  useEffect(()=>()=>controller.current?.abort(),[]);
  const duration=Math.max(0,end-start),sr=take.pcm?.sampleRate||48000;
  const estimate=format==='m4a'?`≈ ${(duration*bitrate*1000/8/1024/1024).toFixed(1)} MB`:format==='wav'?`≈ ${(duration*sr*2*bits/8/1024/1024).toFixed(1)} MB`:'Size depends on the sound · lossless compression';
  const submit=async(e:React.FormEvent)=>{
    e.preventDefault();if(busy)return;if(start<0||end>take.duration||end<=start){setError('Choose a start before the end, within this take.');return;}
    setError('');setBusy(true);setProgress(0);setMessage('Preparing audio');const abort=new AbortController();controller.current=abort;
    try{
      const blob=await prepareExport(take,{format,bits,bitrate,start,end,name},abort.signal,(p,m)=>{setProgress(p);setMessage(m);});abort.signal.throwIfAborted();
      onTrim(start,end);const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${name.replace(/[<>:"/\\|?*\x00-\x1f]/g,'').trim()||'Magnetic take'}.${format}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);onClose();
    }catch(e){if(!abort.signal.aborted)setError(e instanceof Error?e.message:'Export failed. Your original take is still saved.');}
    finally{if(controller.current===abort){controller.current=null;setBusy(false);}}
  };
  return <form className="export-form" onSubmit={e=>void submit(e)}>
    <fieldset disabled={busy}><label>File name<input aria-label="Export file name" required maxLength={120} value={name} onChange={e=>setName(e.target.value)}/></label>
      <div className="export-options"><label>Format<select aria-label="Export format" value={format} onChange={e=>setFormat(e.target.value as typeof format)}><option value="wav">WAV · editing</option><option value="flac">FLAC · lossless archive</option><option value="m4a">M4A / AAC · sharing</option></select></label>
      {format==='m4a'?<label>Quality<select aria-label="AAC quality" value={bitrate} onChange={e=>setBitrate(Number(e.target.value) as typeof bitrate)}><option value={128}>128 kb/s · compact</option><option value={192}>192 kb/s · balanced</option><option value={256}>256 kb/s · high quality</option></select></label>:<label>Resolution<select aria-label="Export bit depth" value={bits} onChange={e=>setBits(Number(e.target.value) as typeof bits)}><option value={16}>16-bit</option><option value={24}>24-bit</option></select></label>}</div>
      <div className="export-options"><label>Start · seconds<input aria-label="Export start" type="number" min={0} max={Math.max(0,end-.001)} step="any" required value={start} onChange={e=>setStart(Number(e.target.value))}/></label><label>End · seconds<input aria-label="Export end" type="number" min={start+.001} max={take.duration} step="any" required value={end} onChange={e=>setEnd(Number(e.target.value))}/></label></div>
      <button type="button" className="text-button" onClick={()=>{setStart(0);setEnd(take.duration);}}>Use complete take</button>
    </fieldset>
    <div className="export-estimate"><b>{duration.toFixed(2)} seconds</b><span>{estimate}</span></div>
    <p className="modal-footnote">The original take stays untouched. Trims are remembered for the next export.{format!=='wav'?' FLAC and M4A conversion happens on this device. The converter downloads once (about 31 MB), then works offline.':''}</p>
    {error&&<p className="export-error" role="alert">{error}</p>}
    {busy&&<div className="export-progress" role="status"><progress max={1} value={progress}/><span>{message} · {Math.round(progress*100)}%</span></div>}
    <div className="export-actions"><button type="button" className="text-button" onClick={()=>{controller.current?.abort();onClose();}}>{busy?'Cancel export':'Cancel'}</button><button type="submit" className="export-download" disabled={busy}>{busy?'Preparing…':'Download file'}</button></div>
  </form>;
}
