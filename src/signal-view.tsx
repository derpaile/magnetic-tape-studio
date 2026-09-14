import React,{useEffect,useRef,useState} from 'react';
import type {TapeEngine} from './audio';
type Mode='tape'|'spectrum'|'history';
type Source='master'|'track'|'input';
const labels:Record<Source,string>={master:'Master · post FX',track:'Selected track · pre FX',input:'Microphone input'};
export function SignalWindow({engine,children}:{engine:TapeEngine;children:React.ReactNode}){
  const [mode,setMode]=useState<Mode>('tape'),[source,setSource]=useState<Source>('master'),[frozen,setFrozen]=useState(false),[reference,setReference]=useState(false),[compare,setCompare]=useState(false),[reading,setReading]=useState('20 Hz — 20 kHz · −96 to 0 dBFS');
  const canvas=useRef<HTMLCanvasElement>(null),latest=useRef<Float32Array|null>(null),saved=useRef<{values:Float32Array;label:string}|null>(null),pointer=useRef<{x:number;y:number}|null>(null),saveRequested=useRef(false);
  useEffect(()=>{setFrozen(false);saved.current=null;setReference(false);},[source,engine.selected]);
  useEffect(()=>()=>engine.auditionOriginal(false),[engine]);
  useEffect(()=>{if(engine.recording||mode==='tape'){engine.auditionOriginal(false);setCompare(false);}},[engine.recording,mode,engine]);
  useEffect(()=>{
    if(mode==='tape')return;
    let frame=0,last=0,lastSource:AnalyserNode|undefined|null;
    const bins=new Float32Array(4096),time=new Float32Array(8192),values=new Float32Array(256),history=document.createElement('canvas');history.width=256;history.height=128;
    const hc=history.getContext('2d')!,image=hc.createImageData(1,128);let lines=0;const timestamps:number[]=[];
    const draw=(now:number)=>{
      frame=requestAnimationFrame(draw);if(document.hidden||now-last<(engine.recording?100:40))return;last=now;
      const node=source==='master'?engine.analyser:source==='track'?engine.trackAnalysers[engine.selected]:engine.micAnalyser;
      const target=canvas.current;if(!target)return;const ctx=target.getContext('2d')!,w=target.clientWidth,h=target.clientHeight,scale=Math.min(2,devicePixelRatio||1);
      if(target.width!==Math.round(w*scale)||target.height!==Math.round(h*scale)){target.width=Math.round(w*scale);target.height=Math.round(h*scale);}
      ctx.setTransform(scale,0,0,scale,0,0);
      if(lastSource!==node){hc.clearRect(0,0,256,128);lines=0;timestamps.length=0;lastSource=node;}
      const high=Math.min(20000,(engine.ctx?.sampleRate||48000)/2),range=Math.log(high/20);
      if(!frozen){
        values.fill(-96);
        if(node){node.getFloatFrequencyData(bins);node.getFloatTimeDomainData(time);const binHz=engine.ctx!.sampleRate/node.fftSize;
          for(let x=0;x<256;x++){
            const hz=20*Math.exp(x/255*range),hi=20*Math.exp(Math.min(255,x+1)/255*range),lo=Math.max(1,Math.floor(hz/binHz)),end=Math.max(lo+1,Math.ceil(hi/binHz));let power=0;
            for(let b=lo;b<Math.min(end,bins.length);b++)power+=10**(bins[b]/10);
            values[x]=Math.max(-96,10*Math.log10(power/Math.max(1,Math.min(end,bins.length)-lo)));
          }
        }
        latest.current=values.slice();
        if(mode==='history'){
          hc.drawImage(history,-1,0);
          for(let y=0;y<128;y++){
            const v=Math.max(0,Math.min(1,(values[Math.round((127-y)/127*255)]+96)/96));const index=y*4;
            // Petrol shadows, warm amber highlights: brightness tracks measured energy.
            image.data[index]=Math.round(12+218*v*v);image.data[index+1]=Math.round(22+150*v);image.data[index+2]=Math.round(21+72*v);image.data[index+3]=255;
          }hc.putImageData(image,255,0);lines=Math.min(256,lines+1);timestamps.push(engine.ctx?.currentTime??now/1000);if(timestamps.length>256)timestamps.shift();
        }
      }
      const visible=latest.current||values;
      if(saveRequested.current){saved.current={values:visible.slice(),label:labels[source]};saveRequested.current=false;setReference(true);}
      ctx.fillStyle='#101c1a';ctx.fillRect(0,0,w,h);
      const left=30,right=w-12,top=8,bottom=h-18,width=right-left,height=bottom-top;
      if(mode==='history'){ctx.drawImage(history,left,top,width,height);}
      ctx.font='9px monospace';ctx.lineWidth=.5;
      if(mode==='spectrum')for(const db of [-72,-48,-24,0]){const y=bottom-(db+96)/96*height;ctx.strokeStyle='#aec5b31c';ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(right,y);ctx.stroke();ctx.fillStyle='#839789';ctx.fillText(String(db),2,y+3);}
      for(const hz of [20,100,1000,10000,20000]){
        const position=Math.log(hz/20)/range;
        ctx.strokeStyle='#aec5b31c';ctx.fillStyle='#839789';const label=hz>=1000?`${hz/1000}k`:String(hz);
        if(mode==='spectrum'){const x=left+position*width;ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x,bottom);ctx.stroke();ctx.fillText(label,Math.min(right-16,x-5),h-3);}
        else{const y=bottom-position*height;ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(right,y);ctx.stroke();ctx.fillText(label,2,y+3);}
      }
      if(mode==='spectrum'){
        const curve=(array:Float32Array,color:string,dash:number[])=>{ctx.strokeStyle=color;ctx.lineWidth=1.5;ctx.setLineDash(dash);ctx.beginPath();array.forEach((v,i)=>{const x=left+i/255*width,y=bottom-Math.max(0,Math.min(1,(v+96)/96))*height;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();ctx.setLineDash([]);};
        if(saved.current)curve(saved.current.values,'#bac4b8',[3,3]);curve(visible,'#e0a572',[]);
      }else{ctx.fillStyle='#839789';ctx.fillText(`${timestamps.length>1?(timestamps.at(-1)!-timestamps[0]).toFixed(1):'0.0'}s history`,left,h-3);ctx.fillText('NOW',right-20,h-3);}
      if(!node){ctx.fillStyle='#c7d0bf';ctx.textAlign='center';ctx.fillText(source==='input'?'Connect a live microphone':'Play or record to inspect the sound',w/2,h/2);ctx.textAlign='left';}
      if(pointer.current){const x=Math.max(0,Math.min(1,(pointer.current.x-left)/width)),y=Math.max(0,Math.min(1,(bottom-pointer.current.y)/height));const hz=20*Math.exp((mode==='history'?y:x)*range);setReading(`${hz<1000?`${Math.round(hz)} Hz`:`${(hz/1000).toFixed(2)} kHz`} · ${mode==='spectrum'?`${visible[Math.round(x*255)].toFixed(1)} dBFS`:'brightness = energy'}`);}
    };frame=requestAnimationFrame(draw);return()=>cancelAnimationFrame(frame);
  },[engine,mode,source,frozen]);
  return <div className={`signal-window ${mode!=='tape'?'analysing':''}`}>
    <div className="signal-tabs" role="group" aria-label="Tape window display">{(['tape','spectrum','history'] as Mode[]).map(value=><button key={value} aria-pressed={mode===value} onClick={()=>setMode(value)}>{value==='tape'?'Tape':value==='spectrum'?'Spectrum':'History'}</button>)}</div>
    <div className="signal-band" aria-hidden={mode!=='tape'} inert={mode!=='tape'} style={{visibility:mode==='tape'?'visible':'hidden'}}>{children}</div>{mode!=='tape'&&<div className="analysis-window">
      <div className="analysis-toolbar"><select aria-label="Spectrum signal source" value={source} onChange={e=>setSource(e.target.value as Source)}>{Object.entries(labels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select><button aria-pressed={frozen} onClick={()=>setFrozen(!frozen)}>{frozen?'Resume':'Freeze'}</button><button disabled={mode==='history'} aria-pressed={reference} onClick={()=>{if(reference){saved.current=null;setReference(false);}else saveRequested.current=true;}}>{reference?'Clear ref':'Reference'}</button></div>
      <canvas ref={canvas} aria-label={mode==='spectrum'?'Live frequency spectrum':'Live frequency history'} onPointerMove={e=>{const r=e.currentTarget.getBoundingClientRect();pointer.current={x:e.clientX-r.left,y:e.clientY-r.top};}} onPointerLeave={()=>{pointer.current=null;setReading('20 Hz — 20 kHz · −96 to 0 dBFS');}}/>
      <div className="analysis-footer"><span>{reading}</span><button aria-label="Listen to level-matched original" disabled={engine.recording||!engine.ctx} aria-pressed={compare} onClick={()=>{engine.auditionOriginal(!compare);setCompare(!compare);}}>{compare?'A · Original':'B · Effects'}</button></div>
      <small className="analysis-note">{source==='track'?'Pre FX · solo this track to inspect its shared effects.':compare?'Listening to original at matched RMS. Analysis still shows the selected source.':'Mono sum · fixed scale · A/B matches measured RMS, up to ±12 dB.'}</small>
    </div>}
  </div>;
}
