import React,{useEffect,useRef,useState} from 'react';
import {ChevronDown,Mic} from 'lucide-react';
import type {TapeEngine} from './audio';
export function MicControls({engine,act}:{engine:TapeEngine;act:(fn:()=>Promise<unknown>)=>Promise<void>}){
  const [devices,setDevices]=useState<MediaDeviceInfo[]>([]),[deviceError,setDeviceError]=useState('');
  useEffect(()=>{
    let alive=true;const refresh=async()=>{try{const list=await navigator.mediaDevices?.enumerateDevices();if(alive){setDevices((list||[]).filter(d=>d.kind==='audioinput'&&d.deviceId!=='default'));setDeviceError('');}}catch{if(alive)setDeviceError('Input list unavailable. Check microphone permission.');}};
    void refresh();navigator.mediaDevices?.addEventListener('devicechange',refresh);
    return()=>{alive=false;navigator.mediaDevices?.removeEventListener('devicechange',refresh);};
  },[engine.micActive,engine.micDeviceLabel]);
  const live=engine.micTrack===engine.selected&&engine.micActive;
  return <div className="mic-source-row">
    <label><Mic size={12}/><select aria-label="Selected track input source" value={live?'mic':'tape'} disabled={engine.micRecording||engine.micArming} onChange={e=>void act(()=>e.target.value==='mic'?engine.activateMic(engine.selected):engine.deactivateMic())}><option value="tape">Audio on tape</option><option value="mic">Live microphone</option></select></label>
    <details className="mic-settings"><summary aria-label="Microphone input settings"><span>{engine.micArming?'Connecting…':engine.micProblem?'Input disconnected':live?engine.micDeviceLabel:'Choose input'}</span><ChevronDown size={12}/></summary>
      <div className="mic-popover">
        <b>MICROPHONE → TRACK {engine.micTrack!==null?engine.micTrack+1:engine.selected+1}</b>
        <label>Device<select aria-label="Microphone device" value={engine.micDeviceId} disabled={engine.micRecording||engine.micArming} onChange={e=>void act(()=>engine.changeMicDevice(e.target.value))}><option value="">System default</option>{engine.micDeviceId&&!devices.some(d=>d.deviceId===engine.micDeviceId)&&<option value={engine.micDeviceId}>Saved input · unavailable</option>}{devices.map((d,i)=><option key={d.deviceId} value={d.deviceId}>{d.label||`Microphone ${i+1}`}</option>)}</select></label>
        <label>Input channel<select aria-label="Microphone channel" value={engine.micChannel} disabled={engine.micRecording} onChange={e=>engine.setMicChannel(e.target.value as typeof engine.micChannel)}><option value="mono">Mono · both inputs</option><option value="left">Left / input 1</option><option value="right">Right / input 2</option><option value="stereo">Stereo · inputs 1 + 2</option></select></label>
        <label>Input gain <output>{engine.micGainDb>0?'+':''}{engine.micGainDb} dB</output><input aria-label="Microphone input gain" type="range" min={-24} max={24} step={1} value={engine.micGainDb} onChange={e=>engine.setMicGain(Number(e.target.value))}/></label>
        <label className="check-label"><input type="checkbox" aria-label="Four-beat microphone count-in" checked={engine.micCountIn} disabled={engine.micRecording} onChange={e=>{engine.micCountIn=e.target.checked;engine.onChange();}}/>Four-beat count-in</label>
        <p>{live?'Live input follows this track’s level, pan, mute, solo and echo send. Saved tape still plays for overdubs.':'Choose Live microphone to check the input before recording.'} Use headphones when monitoring.</p>
        {engine.ctx&&<small>Output buffer ≈ {Math.round(engine.ctx.baseLatency*1000)} ms · total microphone delay depends on the device.</small>}
        {(deviceError||engine.micProblem)&&<p role="status" className="input-error">{deviceError||engine.micProblem}</p>}
      </div>
    </details>
    <span className={`mic-state ${live?'on':''}`}>{live?(engine.monitoring?'LIVE · HEARING':'LIVE · SILENT'):engine.micTrack!==null?`LIVE → ${engine.micTrack+1}`:'MIC OFF'}</span>
  </div>;
}
export function LiveWave({engine,color}:{engine:TapeEngine;color:string}){
  const ref=useRef<HTMLCanvasElement>(null),[peak,setPeak]=useState(-100),[clipping,setClipping]=useState(false);
  useEffect(()=>{
    let timer=0,lastClip=0;const samples=new Float32Array(512),raw=new Float32Array(2048);
    const draw=()=>{
      const canvas=ref.current,analyser=engine.micAnalyser;if(canvas&&analyser){
        const ctx=canvas.getContext('2d')!,w=canvas.clientWidth,h=canvas.clientHeight,scale=devicePixelRatio||1;
        if(canvas.width!==Math.round(w*scale)||canvas.height!==Math.round(h*scale)){canvas.width=Math.round(w*scale);canvas.height=Math.round(h*scale);}
        ctx.setTransform(scale,0,0,scale,0,0);ctx.clearRect(0,0,w,h);analyser.getFloatTimeDomainData(samples);engine.micRawAnalyser?.getFloatTimeDomainData(raw);
        let maximum=0;for(const value of samples)maximum=Math.max(maximum,Math.abs(value));for(const value of raw)if(Math.abs(value)>=.98)lastClip=performance.now();
        if(maximum>=.98)lastClip=performance.now();setClipping(performance.now()-lastClip<1200);setPeak(maximum>0?20*Math.log10(maximum):-100);
        ctx.strokeStyle=color;ctx.lineWidth=1.3;ctx.beginPath();for(let i=0;i<samples.length;i++){const x=i/(samples.length-1)*w,y=h/2-Math.max(-1,Math.min(1,samples[i]))*h*.44;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.stroke();
      }timer=window.setTimeout(draw,engine.recording?100:50);
    };draw();return()=>clearTimeout(timer);
  },[engine,color]);
  return <div className={`live-wave ${clipping?'clipping':''}`}><canvas ref={ref} aria-label="Live microphone waveform"/><span>{clipping?'CLIP':peak<=-90?'NO SIGNAL':`${peak.toFixed(0)} dBFS`}</span></div>;
}
