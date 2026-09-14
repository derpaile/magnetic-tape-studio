import {CLOUD_DEFAULTS, CLOUD_RANGES, DEFAULTS, DIVISIONS, TRACK_DEFAULTS, type Clip, type Parameters, type Take} from './audio';
import type {Session} from './storage';

// Small JSON index followed by lossless binary audio. Blobs keep large master
// takes out of JSON and avoid duplicating them in the interface's memory.
const MAGIC = 'MAGNETIC';
type Asset = {offset:number; bytes:number};
export function sessionFile(session:Session):Blob {
  const parts:BlobPart[] = [];
  let offset = 0;
  const append = (part:Blob|Float32Array):Asset => {
    const bytes = part instanceof Blob ? part.size : part.byteLength;
    parts.push(part as BlobPart);
    const asset = {offset,bytes}; offset += bytes; return asset;
  };
  const tracks = session.tracks.map(({clip,...track}) => ({...track,clip:clip ? {
    name:clip.name,sampleRate:clip.sampleRate,channels:clip.channels.map(append)
  } : null}));
  const takes = session.takes.map(({blob,...take}) => ({...take,audio:append(blob),mime:blob.type}));
  const metadata = new TextEncoder().encode(JSON.stringify({...session,tracks,takes,version:1}));
  const header = new Uint8Array(12);
  header.set(new TextEncoder().encode(MAGIC));
  new DataView(header.buffer).setUint32(8,metadata.length,true);
  return new Blob([header,metadata,...parts],{type:'application/x-magnetic-session'});
}

export async function readSessionFile(file:Blob):Promise<Session> {
  const invalid = () => new Error('This is not a complete Magnetic backup. The current session has not changed.');
  if(file.size<12 || file.size>2*1024**3) throw invalid();
  const header = await file.slice(0,12).arrayBuffer();
  if(new TextDecoder().decode(header.slice(0,8))!==MAGIC) throw invalid();
  const size = new DataView(header).getUint32(8,true), base = 12+size;
  if(size>1024**2 || base>file.size) throw invalid();
  let data;
  try { data=JSON.parse(await file.slice(12,base).text()); } catch { throw invalid(); }
  if(data?.version!==1 || !Array.isArray(data.tracks) || data.tracks.length!==4 || !Array.isArray(data.takes) || data.takes.length>1000) throw invalid();
  const number=(v:unknown,min:number,max:number,fallback:number)=>typeof v==='number'&&Number.isFinite(v)?Math.max(min,Math.min(max,v)):fallback;
  const label=(v:unknown,fallback:string)=>typeof v==='string'&&v.trim()?v.slice(0,120):fallback;
  const asset=(a:Asset):Blob=>{
    if(!a || !Number.isSafeInteger(a.offset) || !Number.isSafeInteger(a.bytes) || a.offset<0 || a.bytes<0 || base+a.offset+a.bytes>file.size) throw invalid();
    return file.slice(base+a.offset,base+a.offset+a.bytes);
  };
  const tracks:Session['tracks']=[];
  for(const raw of data.tracks){
    if(!raw || typeof raw!=='object') throw invalid();
    let clip:Clip|null=null;
    if(raw.clip){
      const c=raw.clip;
      if(!Number.isInteger(c.sampleRate) || c.sampleRate<8000 || c.sampleRate>192000 || !Array.isArray(c.channels) || c.channels.length<1 || c.channels.length>2) throw invalid();
      const channels:Float32Array[]=[];
      for(const channel of c.channels){
        const audio=asset(channel);
        if(!audio.size || audio.size%4 || audio.size/4/c.sampleRate>1200 || (channels.length&&audio.size!==channels[0].byteLength)) throw invalid();
        const samples=new Float32Array(await audio.arrayBuffer());
        if(samples.some(v=>!Number.isFinite(v))) throw invalid();
        channels.push(samples);
      }
      clip={name:label(c.name,'Audio'),sampleRate:c.sampleRate,channels};
    }
    const duration=clip?clip.channels[0].length/clip.sampleRate:1;
    const loopEnd=number(raw.loopEnd,0,duration,0),limit=loopEnd||duration;
    tracks.push({...TRACK_DEFAULTS,clip,volume:number(raw.volume,0,1,.8),pan:number(raw.pan,-1,1,0),send:number(raw.send,0,1,1),muted:raw.muted===true,solo:raw.solo===true,reversed:raw.reversed===true,mode:['tape','loop','once'].includes(raw.mode)?raw.mode:'tape',loopStart:number(raw.loopStart,0,Math.max(0,limit-.001),0),loopEnd});
  }
  const ids=new Set<string>(),takes:Take[]=[];
  for(const raw of data.takes){
    if(!raw || !Number.isFinite(raw.duration) || raw.duration<=0 || raw.duration>1801 || typeof raw.id!=='string' || ids.has(raw.id)) throw invalid();
    ids.add(raw.id);
    const blob=asset(raw.audio);
    let pcm:Take['pcm'];
    if(raw.pcm){
      const p=raw.pcm;
      if(!Number.isInteger(p.sampleRate)||p.sampleRate<8000||p.sampleRate>192000||!Number.isInteger(p.frames)||p.frames<=0||p.frames*8!==blob.size||p.chunkFrames!==8192||Math.abs(p.frames/p.sampleRate-raw.duration)>.001) throw invalid();
      pcm={sampleRate:p.sampleRate,frames:p.frames,chunkFrames:p.chunkFrames};
    }else{
      const signature=new Uint8Array(await blob.slice(0,12).arrayBuffer());
      if(blob.size<44||new TextDecoder().decode(signature.slice(0,4))!=='RIFF'||new TextDecoder().decode(signature.slice(8,12))!=='WAVE') throw invalid();
    }
    takes.push({id:raw.id,name:label(raw.name,'Master take'),duration:raw.duration,blob:blob.slice(0,blob.size,pcm?'application/x-magnetic-pcm':'audio/wav'),pcm,interrupted:raw.interrupted===true,trimStart:number(raw.trimStart,0,raw.duration,0),trimEnd:number(raw.trimEnd,0,raw.duration,raw.duration)});
  }
  const params={...DEFAULTS};
  for(const key of Object.keys(params) as (keyof Parameters)[]){
    const [min,max]=key==='time'?[.04,1.5]:key==='feedback'?[0,1.08]:key==='lowCut'?[20,1200]:key==='decay'?[1,20]:[0,1];
    params[key]=number(data.params?.[key],min,max,params[key]);
  }
  const cloud={...CLOUD_DEFAULTS};
  for(const key of Object.keys(cloud) as (keyof typeof cloud)[]) cloud[key]=number(data.cloud?.[key],...CLOUD_RANGES[key],cloud[key]);
  const heads=Array.from({length:3},(_,i)=>data.heads?.[i]===true);
  if(!heads.some(Boolean)) heads[0]=true;
  return {tracks,takes,params,cloud,heads,name:label(data.name,'Restored session'),preset:label(data.preset,'Custom'),speed:number(data.speed,.25,2,1),loop:data.loop!==false,enabled:data.enabled!==false,selected:Math.floor(number(data.selected,0,3,0)),bpm:number(data.bpm,40,240,96),sync:data.sync===true,division:Object.hasOwn(DIVISIONS,data.division)?data.division:'1/8',headTiming:[0,1].map(i=>({time:number(data.headTiming?.[i]?.time,.04,4.5,params.time*(i+2)),sync:data.headTiming?.[i]?.sync===true,division:Object.hasOwn(DIVISIONS,data.headTiming?.[i]?.division)?data.headTiming[i].division:'1/4'}))};
}
