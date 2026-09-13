export type Clip = { name: string; channels: Float32Array[]; sampleRate: number };
export type Track = { clip: Clip | null; volume: number; muted: boolean; solo: boolean; reversed: boolean; mode: 'tape'|'loop'|'once'; loopStart: number; loopEnd: number; pan: number; send: number };
export const TRACK_DEFAULTS = {mode:'tape' as const,loopStart:0,loopEnd:0,pan:0,send:1};
export type Parameters = { time: number; feedback: number; mix: number; age: number; wow: number; flutter: number; drive: number; tone: number; reverb: number; volume: number; hiss: number; crinkle: number; lowCut: number; spread: number; space: number; decay: number };
export type Take = { id: string; name: string; blob: Blob; duration: number };
export const MASTER_LIMIT = 30 * 60;
export type HeadTiming = {time:number;sync:boolean;division:string};
export type CloudParameters = {dissolve:number;grainSize:number;memory:number;scatter:number;wander:number;return:number};
export const CLOUD_DEFAULTS:CloudParameters = {dissolve:0,grainSize:.24,memory:1.5,scatter:.35,wander:.15,return:0};
export const CLOUD_RANGES:Record<keyof CloudParameters,[number,number]> = {dissolve:[0,1],grainSize:[.08,.8],memory:[.1,10],scatter:[0,1],wander:[0,1],return:[0,.7]};
export type CloudVisual = {peaks:number[];grains:{x:number;life:number}[];filled:number;hold:boolean;motion:'idle'|'record'|'play';motionDuration:number;values:number[]};
export const DEFAULTS: Parameters = {time:.22,feedback:.43,mix:.35,age:.4,wow:.35,flutter:.2,drive:.38,tone:.55,reverb:.18,volume:.75,hiss:.08,crinkle:.12,lowCut:120,spread:.45,space:.12,decay:6};
export const DIVISIONS: Record<string,number> = {'1/16':.25,'1/8 T':1/3,'1/8':.5,'1/8 D':.75,'1/4':1,'1/4 D':1.5,'1/2':2,'1/2 D':3,'1/1':4};
export const PRESETS: Record<string, {params: Parameters; heads: boolean[]}> = {
  'Warm space': {params: DEFAULTS, heads:[true,false,true]},
  'Dub satellite': {params:{...DEFAULTS,time:.3125,feedback:.79,mix:.52,age:.62,drive:.55,lowCut:260,spread:.8,reverb:.3},heads:[false,true,true]},
  'Golden slap': {params:{...DEFAULTS,time:.095,feedback:.16,mix:.3,drive:.6,reverb:.08,space:0},heads:[true,false,false]},
  'Faded memory': {params:{...DEFAULTS,time:.35,feedback:.62,mix:.54,wow:.8,flutter:.5,crinkle:.5,hiss:.24,age:.8,reverb:.42,space:.35},heads:[true,true,true]},
  'Glass orbit': {params:{...DEFAULTS,time:.185,feedback:.56,mix:.46,age:.08,wow:.12,tone:.9,reverb:.5,space:.4},heads:[true,true,false]},
  'Kingston after dark': {params:{...DEFAULTS,time:.46875,feedback:.87,mix:.6,drive:.65,age:.6,lowCut:380,spread:1,reverb:.45,space:.08},heads:[true,false,true]},
  'Endless shoreline': {params:{...DEFAULTS,time:.75,feedback:.78,mix:.58,space:.72,decay:14,wow:.5,spread:.9,reverb:.25,tone:.4},heads:[true,true,true]},
  'Disintegrating loops': {params:{...DEFAULTS,time:.625,feedback:.82,mix:.65,age:.9,wow:.8,flutter:.68,crinkle:.72,hiss:.32,space:.48,decay:11},heads:[false,true,true]},
  'Empty cathedral': {params:{...DEFAULTS,time:1.1,feedback:.58,mix:.4,space:.86,decay:18,reverb:.12,drive:.2,wow:.24,spread:1},heads:[true,false,false]}
};
export function createDemo(kind: string): Clip {
  const sr = 24000, duration = 10, length = sr * duration;
  const left = new Float32Array(length), right = new Float32Array(length);
  let seed = 2047;
  const noise = () => {seed = (seed * 16807) % 2147483647; return seed / 1073741824 - 1;};
  const add = (start:number, dur:number, fn:(t:number)=>number, pan=0) => {
    const from = Math.floor(start * sr), n = Math.min(Math.floor(dur * sr), length - from);
    for(let i=0;i<n;i++) { const y=fn(i/sr); left[from+i]+=y*(1-pan*.35); right[from+i]+=y*(1+pan*.35); }
  };
  const midi = (n:number) => 440 * 2 ** ((n - 69) / 12);
  if(kind === 'Soft keys') {
    [[60,63,67,70],[56,60,63,67],[58,62,65,69],[55,58,62,65]].forEach((chord, bar) => chord.forEach((note,j) => {
      const f=midi(note); add(bar*2.5+j*.026,2.48-j*.026,t=>Math.sin(2*Math.PI*f*t + .3*Math.sin(2*Math.PI*f*2*t)*Math.exp(-t*2)) * (1-Math.exp(-t*80))*Math.exp(-t*2.8)*.13,(j-1.5)/2);
    }));
  } else if(kind === 'Dusty drums') {
    for(let b=0;b<16;b++) {
      if(b%4===0 || b%4===2) add(b*.625,.4,t=>Math.sin(2*Math.PI*(48*t+9*(1-Math.exp(-t*30))))*Math.exp(-t*12)*.55);
      if(b%4===1 || b%4===3) add(b*.625,.23,t=>(noise()*.3+Math.sin(2*Math.PI*180*t)*.14)*Math.exp(-t*23));
      for(let h=0;h<2;h++) add(b*.625+h*.3125,.09,t=>noise()*Math.exp(-t*65)*.12,h? .4:-.3);
    }
  } else if(kind === 'Sub pulse') {
    [36,32,34,31].forEach((note,bar)=>{for(let b=0;b<4;b++) {const f=midi(note);add(bar*2.5+b*.625,.48,t=>(Math.sin(2*Math.PI*f*t)+.18*Math.sin(2*Math.PI*f*2*t))*.28*(1-Math.exp(-t*100))*Math.exp(-t*7));}});
  } else if(kind === 'Slow cloud') {
    [48,55,60,63,70].forEach((note,j)=>{const f=midi(note);add(0,10,t=>(Math.sin(2*Math.PI*f*t)+.4*Math.sin(2*Math.PI*f*1.002*t))*.065*Math.sin(Math.PI*t/10)**2*(.8+.2*Math.sin(t*.7+j)),(j-2)/2);});
  } else if(kind === 'Dub chord') {
    for(let bar=0;bar<4;bar++)for(let beat=0;beat<4;beat++)[60,63,67].forEach((note,j)=>{const f=midi(note);add(bar*2.5+beat*.625+.3125,.24,t=>(Math.sin(2*Math.PI*f*t)+.25*Math.sin(2*Math.PI*f*2*t))*.19*(1-Math.exp(-t*350))*Math.exp(-t*25),(j-1)*.3);});
  } else {
    [72,79,75,82,68,75,72,79,70,77,74,81,67,74,70,77].forEach((note,i)=>{const f=midi(note);add(i*.625,.61,t=>(Math.sin(2*Math.PI*f*t)+.25*Math.sin(2*Math.PI*f*2.01*t))*.18*(1-Math.exp(-t*200))*Math.exp(-t*5),i%2?.7:-.7);});
  }
  return {name:kind,channels:[left,right],sampleRate:sr};
}
export function encodeWav(channels: Float32Array[], sr: number): Blob {
  const frames = channels[0]?.length || 0, n = channels.length;
  const bytes = new ArrayBuffer(44 + frames*n*2), view = new DataView(bytes);
  const str=(offset:number,value:string)=>{for(let i=0;i<value.length;i++)view.setUint8(offset+i,value.charCodeAt(i));};
  str(0,'RIFF');view.setUint32(4,36+frames*n*2,true);str(8,'WAVE');str(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,n,true);view.setUint32(24,sr,true);view.setUint32(28,sr*n*2,true);view.setUint16(32,n*2,true);view.setUint16(34,16,true);str(36,'data');view.setUint32(40,frames*n*2,true);
  for(let i=0;i<frames;i++) for(let c=0;c<n;c++){const s=Math.max(-1,Math.min(1,channels[c][i]));view.setInt16(44+(i*n+c)*2,s<0?s*32768:s*32767,true);}
  return new Blob([bytes],{type:'audio/wav'});
}
function joinChunks(chunks: Float32Array[]) {
  const out=new Float32Array(chunks.reduce((n,c)=>n+c.length,0)); let offset=0;
  for(const chunk of chunks){out.set(chunk,offset);offset+=chunk.length;} return out;
}
export class TapeEngine {
  ctx: AudioContext | null = null;
  tracks: Track[] = Array.from({length:4},()=>({clip:null,volume:.8,muted:false,solo:false,reversed:false,...TRACK_DEFAULTS}));
  params: Parameters = {...DEFAULTS}; heads=[true,false,true]; enabled=true; speed=1; loop=true; bpm=96; sync=false; division='1/8';
  headTiming:HeadTiming[] = [{time:.44,sync:false,division:'1/4'},{time:.66,sync:false,division:'1/4 D'}];
  cloud:CloudParameters = {...CLOUD_DEFAULTS}; cloudHolding=false;
  cloudVisual:CloudVisual = {peaks:[],grains:[],filled:0,hold:false,motion:'idle',motionDuration:0,values:Object.values(CLOUD_DEFAULTS)};
  holding=false; inputCut=false; swelling=false; braking=false; throwing=-1; private motorSpeed=1; private tapeOrigin=0; private taps:number[]=[];
  playing=false; recording=false; masterSaving=false; micRecording=false; micArming=false; monitoring=false; overdub=false;
  position=0; startedAt=0; recordingStarted=0; micStarted=0;
  takes: Take[]=[]; selected=0; onChange:()=>void=()=>{}; onNotice:(s:string)=>void=()=>{};
  private sources: {node:AudioBufferSourceNode;fade:GainNode;index:number}[]=[]; private gains: GainNode[]=[]; private sends: GainNode[]=[]; private pans: StereoPannerNode[]=[];
  private input!: GainNode; private echoInput!: GainNode; private spaceNode!: AudioWorkletNode; private spaceGain!: GainNode; private spring!:ConvolverNode; private tape!: AudioWorkletNode; private reverbGain!: GainNode; private master!: GainNode;
  analyser!: AnalyserNode; private capture!: AudioWorkletNode;
  private micStream: MediaStream|null=null; private micSource: MediaStreamAudioSourceNode|null=null; private micCapture:AudioWorkletNode|null=null; private micSilent:GainNode|null=null;
  private recorder!:Worker; private micChunks:Float32Array[][]=[[],[]];
  private initPromise:Promise<void>|null=null; private stopResolve:(()=>void)|null=null; private micResolve:(()=>void)|null=null;
  private undoStack: {index:number;track:Track}[]=[]; private micTarget=0; private micOffset=0; private micRate=1; private micOverdub=false;
  private bufferCache=new WeakMap<Clip,{key:string;buffer:AudioBuffer}>();
  private speedRamp:{from:number;to:number;at:number;duration:number}|null=null;
  private masterStopPromise:Promise<void>|null=null;
  private micStopPromise:Promise<void>|null=null;
  get headTimes(){return [this.params.time,...this.headTiming.map(h=>h.time)];}
  get duration(){return Math.max(1,...this.tracks.map(t=>t.clip?t.clip.channels[0].length/t.clip.sampleRate:0));}
  get hasUndo(){return this.undoStack.length>0;}
  get repeats(){return this.loop||this.tracks.some(t=>t.clip&&t.mode==='loop');}
  get transportPosition(){
    if(!this.playing||!this.ctx)return this.position;
    const dt=Math.max(0,this.ctx.currentTime-this.startedAt),r=this.speedRamp;
    if(!r)return this.position+dt*this.motorSpeed;
    const t=Math.min(dt,r.duration);
    return this.position+r.from*t+(r.to-r.from)*t*t/(2*r.duration)+Math.max(0,dt-r.duration)*r.to;
  }
  get currentPosition(){return this.repeats?this.transportPosition%this.duration:Math.min(Math.max(0,this.transportPosition-this.tapeOrigin),this.duration);}
  loopBounds(i:number){const t=this.tracks[i],length=t.clip?t.clip.channels[0].length/t.clip.sampleRate:1;const end=Math.max(.001,Math.min(length,t.loopEnd||length));return {start:Math.max(0,Math.min(t.loopStart,end-.001)),end};}
  trackPosition(i:number){const t=this.tracks[i],p=this.transportPosition;if(t.mode==='loop'){const {start,end}=this.loopBounds(i);return start+p%(end-start);}return t.mode==='tape'?(this.loop?p%this.duration:Math.min(Math.max(0,p-this.tapeOrigin),this.duration)):Math.min(p,this.duration);}
  async init() {
    if(!this.ctx){
      const Ctx = window.AudioContext || (window as unknown as {webkitAudioContext:typeof AudioContext}).webkitAudioContext;
      if(!Ctx)throw new Error('This browser does not support audio. Try Safari, Chrome, or Firefox.');
      // A modest output buffer gives file decoding and visual updates headroom.
      this.ctx=new Ctx({latencyHint:'balanced'});
      this.initPromise=this.setup().catch(error=>{void this.ctx?.close();this.ctx=null;this.initPromise=null;throw error;});
    }
    await this.ctx.resume(); await this.initPromise;
  }
  private async setup(){
    const ctx=this.ctx!;
    if(!ctx.audioWorklet)throw new Error('Audio needs HTTPS or localhost. Open this app through a secure address.');
    await ctx.audioWorklet.addModule('/audio/tape-processor.js');
    this.input=ctx.createGain();this.echoInput=ctx.createGain();this.tape=new AudioWorkletNode(ctx,'magnetic-tape',{numberOfInputs:2,outputChannelCount:[2]});
    this.input.connect(this.tape,0,0);this.echoInput.connect(this.tape,0,1); this.master=ctx.createGain();this.tape.connect(this.master);
    const spring=this.spring=ctx.createConvolver(); const impulse=ctx.createBuffer(2,Math.floor(ctx.sampleRate*2.7),ctx.sampleRate);
    for(let c=0;c<2;c++){const a=impulse.getChannelData(c);let prev=0;for(let i=0;i<a.length;i++){const t=i/ctx.sampleRate;prev=prev*.45+(Math.random()*2-1)*.55; a[i]=(prev*.6+Math.sin(2*Math.PI*(1700*t-1250*t*t))*Math.exp(-t*15)*.22)*Math.exp(-t*3.1)*(1-Math.exp(-t*150));}}
    spring.buffer=impulse;this.reverbGain=ctx.createGain();this.tape.connect(spring);spring.connect(this.reverbGain);this.reverbGain.connect(this.master);
    this.spaceNode=new AudioWorkletNode(ctx,'magnetic-space',{outputChannelCount:[2]});this.spaceGain=ctx.createGain();this.tape.connect(this.spaceNode);this.spaceNode.connect(this.spaceGain);this.spaceGain.connect(this.master);
    const limiter=ctx.createDynamicsCompressor();limiter.threshold.value=-3;limiter.knee.value=5;limiter.ratio.value=16;limiter.attack.value=.003;limiter.release.value=.15;
    this.capture=new AudioWorkletNode(ctx,'magnetic-capture',{outputChannelCount:[2],processorOptions:{maxSeconds:MASTER_LIMIT}});
    this.analyser=ctx.createAnalyser();this.analyser.fftSize=256;
    this.master.connect(limiter);limiter.connect(this.capture);this.capture.connect(this.analyser);this.analyser.connect(ctx.destination);
    this.gains=this.tracks.map(()=>{const g=ctx.createGain(),pan=ctx.createStereoPanner(),send=ctx.createGain();g.connect(pan);pan.connect(this.input);pan.connect(send);send.connect(this.echoInput);this.pans.push(pan);this.sends.push(send);return g;});
    this.tape.port.onmessage=({data})=>{if(data.type==='cloud')this.cloudVisual=data;};
    // The worklet sends PCM directly to the encoder, bypassing the UI thread.
    this.recorder=new Worker('/audio/recorder-worker.js');
    const channel=new MessageChannel();this.capture.port.postMessage({sink:channel.port1},[channel.port1]);
    await new Promise<void>((resolve,reject)=>{
      this.recorder.onerror=()=>{reject(new Error('The master recorder could not start. Reload the studio.'));this.recording=false;this.masterSaving=false;this.stopResolve?.();this.stopResolve=null;this.onNotice('Master recorder interrupted. Previously saved takes are still available. Reload before recording again.');this.onChange();};
      this.recorder.onmessage=({data})=>{
        if(data.type==='ready')resolve();
        if(data.type==='take'){
          if(data.frames){this.takes.unshift({id:crypto.randomUUID(),name:`Take ${String(Math.max(0,...this.takes.map(t=>Number(t.name.replace('Take ',''))||0))+1).padStart(2,'0')}`,blob:data.blob,duration:data.duration});this.onNotice(data.limited?'30-minute limit reached. Master take saved.':'Master take saved. Ready to export.');}
          this.recording=false;this.masterSaving=false;this.stopResolve?.();this.stopResolve=null;this.onChange();
        }
      };
      this.recorder.postMessage({source:channel.port2,sampleRate:ctx.sampleRate},[channel.port2]);
    });
    ctx.addEventListener('statechange',()=>{if(this.recording&&ctx.state!=='running')this.onNotice('Audio was interrupted by the browser. Keep the studio open; recording resumes with audio.');});
    this.updateParams();this.updateGains();
  }
  setParam(key:keyof Parameters,value:number){if(!Number.isFinite(value))return;if(key==='time'){this.sync=false;value=Math.max(.04,Math.min(1.5,value));}this.params={...this.params,[key]:value};this.updateParams();this.onChange();}
  setTempo(bpm:number,division=this.division,sync=this.sync){if(!Number.isFinite(bpm))return;this.bpm=Math.max(40,Math.min(240,bpm));this.division=DIVISIONS[division]?division:'1/8';this.sync=sync;if(sync)this.params={...this.params,time:Math.max(.04,Math.min(1.5,60/this.bpm*DIVISIONS[this.division]))};this.headTiming=this.headTiming.map(h=>h.sync?{...h,time:Math.max(.04,Math.min(4.5,60/this.bpm*DIVISIONS[h.division]))}:h);this.updateParams();this.onChange();}
  setHeadTime(index:number,time:number){if(!Number.isFinite(time))return;if(index===0){this.setParam('time',time);return;}this.headTiming=this.headTiming.map((h,i)=>i===index-1?{...h,time:Math.max(.04,Math.min(4.5,time)),sync:false}:h);this.updateParams();this.onChange();}
  setHeadSync(index:number,sync:boolean,division?:string){if(index===0){this.setTempo(this.bpm,division||this.division,sync);return;}const h=this.headTiming[index-1];if(!h)return;const note=division&&DIVISIONS[division]?division:h.division;this.headTiming=this.headTiming.map((v,i)=>i===index-1?{time:sync?Math.max(.04,Math.min(4.5,60/this.bpm*DIVISIONS[note])):h.time,sync,division:note}:v);this.updateParams();this.onChange();}
  resetHeadTimes(){this.headTiming=[{time:this.params.time*2,sync:false,division:'1/4'},{time:this.params.time*3,sync:false,division:'1/4 D'}];}
  setCloud(key:keyof CloudParameters,value:number){if(!Number.isFinite(value))return;const [min,max]=CLOUD_RANGES[key];this.cloud={...this.cloud,[key]:Math.max(min,Math.min(max,value))};if(this.cloudVisual.motion==='play')this.setMotion('stop');this.updateParams();this.onChange();}
  holdCloud(value:boolean){this.cloudHolding=value;this.updateParams();this.onChange();}
  setMotion(motion:'record'|'play'|'stop'){this.tape?.port.postMessage({motion});this.cloudVisual={...this.cloudVisual,motion:motion==='stop'?'idle':motion};this.onChange();}
  tapTempo(){const now=performance.now();if(this.taps.length&&now-this.taps.at(-1)!>1800)this.taps=[];this.taps.push(now);this.taps=this.taps.slice(-5);if(this.taps.length>1)this.setTempo(Math.round(60000*(this.taps.length-1)/(now-this.taps[0])),this.division,true);}
  updateParams(){
    if(!this.tape||!this.ctx)return;const at=this.ctx.currentTime;
    for(const [key,value] of Object.entries(this.params))(this.tape.parameters as unknown as Map<string,AudioParam>).get(key)?.setTargetAtTime(value,at,.025);
    for(const [key,value] of [...Object.entries(this.cloud),['head2',this.headTiming[0].time],['head3',this.headTiming[1].time]] as [string,number][])(this.tape.parameters as unknown as Map<string,AudioParam>).get(key)?.setTargetAtTime(value,at,.035);
    (this.tape.parameters as unknown as Map<string,AudioParam>).get('enabled')!.setTargetAtTime(this.enabled?1:0,at,.015);
    this.tape.port.postMessage({heads:this.heads.map(Number),hold:this.holding,inputCut:this.inputCut,swell:this.swelling,cloudHold:this.cloudHolding});
    (this.spaceNode.parameters as unknown as Map<string,AudioParam>).get('decay')!.setTargetAtTime(this.params.decay,at,.08);
    (this.spaceNode.parameters as unknown as Map<string,AudioParam>).get('damping')!.setTargetAtTime(this.params.age,at,.08);
    this.reverbGain.gain.setTargetAtTime(this.enabled?this.params.reverb*.65:0,at,.03);
    this.spaceGain.gain.setTargetAtTime(this.enabled?this.params.space*.85:0,at,.03);
    this.master.gain.setTargetAtTime(this.params.volume,at,.02);
  }
  updateGains(){if(!this.ctx)return;const anySolo=this.tracks.some(t=>t.solo),at=this.ctx.currentTime;this.tracks.forEach((t,i)=>{this.gains[i]?.gain.setTargetAtTime(t.muted||(anySolo&&!t.solo)?0:t.volume,at,.015);this.sends[i]?.gain.setTargetAtTime(this.throwing===i?1:t.send,at,.01);this.pans[i]?.pan.setTargetAtTime(t.pan,at,.02);});}
  setPerformance(key:'holding'|'inputCut'|'swelling',value:boolean){this[key]=value;this.updateParams();this.onChange();}
  throwEcho(i:number,active:boolean){this.throwing=active?i:-1;this.updateGains();this.onChange();}
  brake(active:boolean){if(this.micRecording||this.braking===active)return;this.braking=active;this.rampSpeed(active?.025:this.speed,active?.8:.45);this.onChange();}
  releasePerformance(){this.swelling=false;this.throwing=-1;this.brake(false);this.updateParams();this.updateGains();this.onChange();}
  private buffer(t:Track){
    const clip=t.clip!,{start,end}=this.loopBounds(this.tracks.indexOf(t));
    const duration=t.mode==='tape'?this.duration:clip.channels[0].length/clip.sampleRate;
    const key=`${duration}:${t.reversed}:${t.mode}:${start}:${end}`;const cached=this.bufferCache.get(clip);if(cached?.key===key)return cached.buffer;
    const b=this.ctx!.createBuffer(2,Math.ceil(duration*clip.sampleRate),clip.sampleRate);
    for(let c=0;c<2;c++){const a=clip.channels[c]||clip.channels[0],out=b.getChannelData(c);out.set(t.reversed?a.slice().reverse():a);
      // Short splice fades keep arbitrary loop boundaries from clicking; timing stays exact.
      if(t.mode==='loop'){const from=Math.round(start*clip.sampleRate),to=Math.min(out.length,Math.round(end*clip.sampleRate)),fade=Math.min(Math.floor((to-from)/2),Math.ceil(clip.sampleRate*.003));for(let j=0;j<fade;j++){out[from+j]*=j/fade;out[to-1-j]*=j/fade;}}
    }this.bufferCache.set(clip,{key,buffer:b});return b;
  }
  async play(){await this.init();if(this.playing)return;if(!this.repeats&&this.position>=this.duration+this.tapeOrigin){this.position=0;this.tapeOrigin=0;}this.motorSpeed=this.braking?.025:this.speed;this.playing=true;this.startSources();this.onChange();}
  private startSources(indices=this.tracks.map((_,i)=>i),replace=false){
    // Prepare every buffer while existing sources are still audible. Start the
    // crossfade only after allocation/copying finishes, on the audio clock.
    const buffers=new Map(indices.flatMap(i=>this.tracks[i].clip?[[i,this.buffer(this.tracks[i])] as const]:[]));
    const at=this.ctx!.currentTime+.025;
    const position=replace?this.transportPosition+.025*this.motorSpeed:this.position;
    if(replace)this.stopSources(indices,at);
    else {this.speedRamp=null;this.startedAt=at;}
    const added=indices.flatMap(i=>{const t=this.tracks[i];
      if(!t.clip)return[];const loops=t.mode==='loop'||(t.mode==='tape'&&this.loop);
      const offset=t.mode==='tape'&&!this.loop?Math.max(0,position-this.tapeOrigin):position;
      if(!loops&&offset>=buffers.get(i)!.duration)return[];
      const node=this.ctx!.createBufferSource(),fade=this.ctx!.createGain();node.buffer=buffers.get(i)!;node.loop=loops;
      const bounds=t.mode==='loop'?this.loopBounds(i):{start:0,end:this.duration};node.loopStart=bounds.start;node.loopEnd=bounds.end;node.playbackRate.value=this.motorSpeed;
      node.connect(fade);fade.connect(this.gains[i]);fade.gain.setValueAtTime(0,at);fade.gain.linearRampToValueAtTime(1,at+.025);
      node.onended=()=>{node.disconnect();fade.disconnect();};node.start(at,loops?bounds.start+position%(bounds.end-bounds.start):offset);return[{node,fade,index:i}];
    });
    this.sources=[...this.sources,...added].sort((a,b)=>a.index-b.index);
  }
  pause(){if(!this.playing)return;this.position=this.transportPosition;this.stopSources();this.playing=false;this.onChange();}
  private stopSources(indices=this.tracks.map((_,i)=>i),at=this.ctx!.currentTime){for(const {node,fade,index} of this.sources){if(!indices.includes(index))continue;if(fade.gain.cancelAndHoldAtTime)fade.gain.cancelAndHoldAtTime(at);else{fade.gain.cancelScheduledValues(at);fade.gain.setValueAtTime(fade.gain.value,at);}fade.gain.linearRampToValueAtTime(0,at+.025);node.stop(at+.026);}this.sources=this.sources.filter(s=>!indices.includes(s.index));}
  stop(){this.pause();this.position=0;this.tapeOrigin=0;this.onChange();}
  seek(position:number){this.tapeOrigin=0;this.position=Math.max(0,Math.min(this.duration-.001,position));if(this.playing){this.stopSources();this.startSources();}this.onChange();}
  private restart(indices=this.tracks.map((_,i)=>i)){if(this.playing)this.startSources(indices,true);}
  private rampSpeed(value:number,duration:number){
    const now=this.ctx?.currentTime||0,r=this.speedRamp,from=r?r.from+(r.to-r.from)*Math.min(1,Math.max(0,now-r.at)/r.duration):this.motorSpeed;
    this.position=this.transportPosition;this.motorSpeed=value;
    if(this.playing){this.startedAt=now;this.speedRamp={from,to:value,at:now,duration};for(const {node} of this.sources){node.playbackRate.cancelScheduledValues(now);node.playbackRate.setValueAtTime(from,now);node.playbackRate.linearRampToValueAtTime(value,now+duration);}}else this.speedRamp=null;
  }
  setSpeed(value:number){this.speed=Math.max(.25,Math.min(2,value));if(!this.braking)this.rampSpeed(this.speed,.08);this.onChange();}
  toggleLoop(){if(this.loop)this.tapeOrigin=Math.floor(this.transportPosition/this.duration)*this.duration;else this.tapeOrigin=0;this.loop=!this.loop;this.restart();this.onChange();}
  setTrackMode(i:number,mode:Track['mode']){this.remember(i);this.tracks[i].mode=mode;this.restart([i]);this.onChange();}
  setLoopBounds(i:number,start:number,end:number){if(!Number.isFinite(start)||!Number.isFinite(end))return;const t=this.tracks[i];if(!t.clip)return;this.remember(i);const length=t.clip.channels[0].length/t.clip.sampleRate,min=Math.min(.02,length);t.loopEnd=Math.max(min,Math.min(length,end));t.loopStart=Math.max(0,Math.min(start,t.loopEnd-min));t.mode='loop';this.restart([i]);this.onChange();}
  tick(){if(this.playing&&!this.repeats&&this.transportPosition>=this.duration+this.tapeOrigin){this.pause();this.position=0;this.tapeOrigin=0;this.onChange();}}
  private remember(i:number){this.undoStack.push({index:i,track:{...this.tracks[i]}});if(this.undoStack.length>8)this.undoStack.shift();}
  setClip(i:number,clip:Clip|null){const duration=this.duration;this.remember(i);this.tracks[i]={...this.tracks[i],clip,reversed:false,loopStart:0,loopEnd:0,...(!clip?{muted:false,solo:false}:{} )};this.restart(this.duration===duration?[i]:this.tracks.flatMap((t,j)=>j===i||t.mode==='tape'?[j]:[]));this.updateGains();this.onChange();}
  undo(){const state=this.undoStack.pop();if(!state)return;const duration=this.duration;this.tracks[state.index]=state.track;this.restart(this.duration===duration?[state.index]:this.tracks.flatMap((t,i)=>i===state.index||t.mode==='tape'?[i]:[]));this.updateGains();this.onChange();}
  reverse(i:number){this.remember(i);this.tracks[i].reversed=!this.tracks[i].reversed;this.restart([i]);this.onChange();}
  async importFile(file:File,index:number){if(file.size>60*1024*1024)throw new Error('Choose an audio file smaller than 60 MB.');await this.init();let decoded:AudioBuffer;try{decoded=await this.ctx!.decodeAudioData(await file.arrayBuffer());}catch{throw new Error('This audio format could not be read. Try WAV, MP3, M4A, or OGG.');}if(decoded.duration>180)throw new Error('Choose a sample under 3 minutes to keep the tape responsive.');const channels=[decoded.getChannelData(0),decoded.getChannelData(Math.min(1,decoded.numberOfChannels-1))];const clip={name:file.name.replace(/\.[^.]+$/,''),channels,sampleRate:decoded.sampleRate};const duration=channels[0].length/clip.sampleRate;if(decoded.numberOfChannels<=2&&(this.tracks[index].mode!=='tape'||duration>=Math.max(1,...this.tracks.filter((_,i)=>i!==index).map(t=>t.clip?t.clip.channels[0].length/t.clip.sampleRate:0)))&&this.tracks[index].mode!=='loop')this.bufferCache.set(clip,{key:`${duration}:false:${this.tracks[index].mode}:0:${duration}`,buffer:decoded});this.setClip(index,clip);this.onNotice(`Loaded ${file.name} onto track ${index+1}.`);}
  async startMaster(){await this.init();if(this.recording||this.masterSaving)return;this.recording=true;this.recordingStarted=this.ctx!.currentTime;this.capture.port.postMessage('start');this.onChange();}
  async stopMaster(){if(this.masterStopPromise)return this.masterStopPromise;if(!this.recording)return;this.masterSaving=true;this.onChange();this.masterStopPromise=this.ctx!.resume().then(()=>new Promise<void>(resolve=>{if(!this.recording){resolve();return;}this.stopResolve=resolve;this.capture.port.postMessage('stop');}));try{await this.masterStopPromise;}finally{this.masterStopPromise=null;this.masterSaving=false;}}
  async startMic(index:number){
    if(this.micRecording||this.micArming)return;this.micArming=true;this.onChange();
    try{
      await this.init();if(!navigator.mediaDevices?.getUserMedia)throw new Error('Microphone recording needs HTTPS or localhost.');
      this.micStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false,channelCount:2}});
      this.micTarget=index;this.micOffset=this.currentPosition;this.micRate=this.speed;this.micOverdub=this.overdub;
      this.micSource=this.ctx!.createMediaStreamSource(this.micStream);this.micCapture=new AudioWorkletNode(this.ctx!,'magnetic-capture',{outputChannelCount:[2]});
      this.micSilent=this.ctx!.createGain();this.micSilent.gain.value=0;this.micSource.connect(this.micCapture);this.micCapture.connect(this.micSilent);this.micSilent.connect(this.ctx!.destination);
      if(this.monitoring){this.micSource.connect(this.input);this.micSource.connect(this.echoInput);}
      this.micChunks=[[],[]];this.micCapture.port.onmessage=({data})=>{
        if(data.type==='chunk'){this.micChunks[0].push(data.left);this.micChunks[1].push(data.right);}
        if(data.type==='done'){
          const captured=this.micChunks.map(joinChunks);this.micChunks=[[],[]];
          if(captured[0].length){
            const sr=this.ctx!.sampleRate, old=this.tracks[this.micTarget].clip;
            const offset=Math.floor(this.micOffset*sr), recordedFrames=Math.ceil(captured[0].length*this.micRate);
            const oldLength=this.micOverdub&&old?Math.ceil(old.channels[0].length/old.sampleRate*sr):0;
            const len=Math.max(offset+recordedFrames,oldLength);
            const channels=[new Float32Array(len),new Float32Array(len)];
            for(let c=0;c<2;c++){
              if(this.micOverdub&&old){const a=old.channels[c]||old.channels[0];for(let i=0;i<oldLength;i++){let r=i/sr*old.sampleRate;if(this.tracks[this.micTarget].reversed)r=a.length-1-r;const lo=Math.max(0,Math.floor(r));channels[c][i]=a[lo]||0;}}
              for(let i=0;i<recordedFrames;i++){const r=i/this.micRate,lo=Math.floor(r),f=r-lo;channels[c][offset+i]+=(captured[c][lo]||0)*(1-f)+(captured[c][lo+1]||0)*f;}
            }
            this.setClip(this.micTarget,{name:this.micOverdub&&old?`${old.name} + overdub`:'Microphone take',sampleRate:sr,channels});this.onNotice(`Recording saved on track ${this.micTarget+1}.`);
          }
          this.releaseMic();this.micResolve?.();this.micResolve=null;
        }
      };
      this.micRecording=true;this.micStarted=this.ctx!.currentTime;this.micCapture.port.postMessage('start');
      this.onNotice(this.micOverdub?'Recording an overdub…':'Recording microphone…');
    }catch(error){this.releaseMic();if(error instanceof DOMException&&error.name==='NotAllowedError')throw new Error('Microphone permission was denied. Allow it in your browser’s site settings, then try again.');throw error;}
    finally{this.micArming=false;this.onChange();}
  }
  async stopMic(){if(this.micStopPromise)return this.micStopPromise;if(!this.micRecording)return;this.micStopPromise=this.ctx!.resume().then(()=>new Promise<void>(resolve=>{this.micResolve=resolve;this.micCapture!.port.postMessage('stop');}));try{await this.micStopPromise;}finally{this.micStopPromise=null;}}
  private releaseMic(){this.micStream?.getTracks().forEach(t=>t.stop());this.micSource?.disconnect();this.micCapture?.disconnect();this.micSilent?.disconnect();this.micStream=null;this.micSource=null;this.micCapture=null;this.micSilent=null;this.micRecording=false;this.onChange();}
  setMonitoring(value:boolean){this.monitoring=value;if(this.micSource){if(value){this.micSource.connect(this.input);this.micSource.connect(this.echoInput);}else{this.micSource.disconnect(this.input);this.micSource.disconnect(this.echoInput);}}this.onChange();}
  panic(){this.holding=false;this.cloudHolding=false;this.inputCut=false;this.releasePerformance();this.setParam('feedback',.25);this.tape?.port.postMessage({clear:true});this.spaceNode?.port.postMessage({clear:true});if(this.spring){const impulse=this.spring.buffer;this.spring.buffer=null;this.spring.buffer=impulse;}this.onNotice('Echo, cloud and reverb cleared. Feedback reset.');}
  async bounce(index:number){const take=this.takes[0];if(!take)return;await this.importFile(new File([take.blob],`${take.name} bounce.wav`,{type:'audio/wav'}),index);}
}
