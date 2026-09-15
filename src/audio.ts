export type Clip = { name: string; channels: Float32Array[]; sampleRate: number };
export type Track = { clip: Clip | null; volume: number; muted: boolean; solo: boolean; reversed: boolean; mode: 'tape'|'loop'|'once'; loopStart: number; loopEnd: number; pan: number; send: number };
export const TRACK_DEFAULTS = {mode:'tape' as const,loopStart:0,loopEnd:0,pan:0,send:1};
export type Parameters = { time: number; feedback: number; mix: number; age: number; wow: number; flutter: number; drive: number; tone: number; reverb: number; volume: number; hiss: number; crinkle: number; lowCut: number; spread: number; space: number; decay: number };
export type Take = { id: string; name: string; blob: Blob; duration: number; pcm?: {sampleRate:number;frames:number;chunkFrames:number}; interrupted?:boolean; trimStart?:number; trimEnd?:number };
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
  braking=false; throwing=-1; private motorSpeed=1; private tapeOrigin=0; private taps:number[]=[];
  playing=false; recording=false; masterSaving=false; micRecording=false; micArming=false; monitoring=false; overdub=false;
  micTrack:number|null=null; micLive=false; micDeviceId=''; micChannel:'mono'|'left'|'right'|'stereo'='mono'; micGainDb=0; micCountIn=false; micDeviceLabel='Default microphone'; micProblem='';
  micAnalyser:AnalyserNode|null=null; micRawAnalyser:AnalyserNode|null=null;
  trackAnalysers:AnalyserNode[]=[]; inputAnalyser:AnalyserNode|null=null;
  private micTrim:GainNode|null=null; private micMonitor:GainNode|null=null; private micSplitter:ChannelSplitterNode|null=null; private micMerger:ChannelMergerNode|null=null;
  private countClicks:OscillatorNode[]=[];
  tailSaving=false; private tailTimer:ReturnType<typeof setTimeout>|null=null;
  get micRecordingTarget(){return this.micTarget;}
  get micActive(){return !!this.micStream;}
  position=0; startedAt=0; recordingStarted=0; micStarted=0;
  takes: Take[]=[]; selected=0; onChange:()=>void=()=>{}; onNotice:(s:string)=>void=()=>{};
  private sources: {node:AudioBufferSourceNode;fade:GainNode;index:number}[]=[]; private gains: GainNode[]=[]; private sends: GainNode[]=[]; private pans: StereoPannerNode[]=[];
  private input!: GainNode; private echoInput!: GainNode; private spaceNode!: AudioWorkletNode; private spaceGain!: GainNode; private spring!:ConvolverNode; private tape!: AudioWorkletNode; private reverbGain!: GainNode; private master!: GainNode;
  private auditionWet:GainNode|null=null; private auditionDry:GainNode|null=null;
  analyser!: AnalyserNode; private capture!: AudioWorkletNode;
  private micStream: MediaStream|null=null; private micSource: MediaStreamAudioSourceNode|null=null; private micCapture:AudioWorkletNode|null=null; private micSilent:GainNode|null=null;
  private recorder!:Worker; private recorderFailed=false;
  private wavJobs=new WeakMap<Blob,Promise<Blob>>();
  private captureState:Int32Array|null=null;
  get recordedDuration(){return this.captureState?Atomics.load(this.captureState,0)/this.ctx!.sampleRate:Math.max(0,(this.ctx?.currentTime||0)-this.recordingStarted);}
  private recorderError(message:string){this.recorderFailed=true;this.capture?.port.postMessage('stop');this.recording=false;this.masterSaving=false;this.stopResolve?.();this.stopResolve=null;this.onNotice(message);this.onChange();}
  private micChunks:Float32Array[][]=[[],[]];
  private initPromise:Promise<void>|null=null; private stopResolve:(()=>void)|null=null; private micResolve:(()=>void)|null=null;
  private undoStack: {index:number;track:Track}[]=[]; private micTarget=0; private micOffset=0; private micRate=1; private micOverdub=false;
  private bufferCache=new WeakMap<Clip,{key:string;buffer:AudioBuffer}>();
  private speedRamp:{from:number;to:number;at:number;duration:number}|null=null;
  private masterStopPromise:Promise<void>|null=null;
  private micStopPromise:Promise<void>|null=null;
  get headTimes(){return [this.params.time,...this.headTiming.map(h=>h.time)];}
  get duration(){return Math.max(1,...this.tracks.map(t=>t.clip?t.clip.channels[0].length/t.clip.sampleRate:0));}
  get hasUndo(){return this.undoStack.length>0;}
  clearUndo(){this.undoStack=[];}
  get repeats(){return this.tracks.some(t=>t.clip&&(t.mode==='loop'||(t.mode==='tape'&&this.loop)));}
  get transportPosition(){
    if(!this.playing||!this.ctx)return this.position;
    const dt=Math.max(0,this.ctx.currentTime-this.startedAt),r=this.speedRamp;
    if(!r)return this.position+dt*this.motorSpeed;
    const t=Math.min(dt,r.duration);
    return this.position+r.from*t+(r.to-r.from)*t*t/(2*r.duration)+Math.max(0,dt-r.duration)*r.to;
  }
  get currentPosition(){return this.loop?Math.max(0,this.transportPosition-this.tapeOrigin)%this.duration:this.repeats?this.transportPosition%this.duration:Math.min(Math.max(0,this.transportPosition-this.tapeOrigin),this.duration);}
  loopBounds(i:number){const t=this.tracks[i],length=t.clip?t.clip.channels[0].length/t.clip.sampleRate:1;const end=Math.max(.001,Math.min(length,t.loopEnd||length));return {start:Math.max(0,Math.min(t.loopStart,end-.001)),end};}
  trackPosition(i:number){const t=this.tracks[i],p=this.transportPosition;if(t.mode==='loop'){const {start,end}=this.loopBounds(i);return start+p%(end-start);}return t.mode==='tape'?(this.loop?Math.max(0,p-this.tapeOrigin)%this.duration:Math.min(Math.max(0,p-this.tapeOrigin),this.duration)):Math.min(p,this.duration);}
  async init() {
    if(!this.ctx){
      const Ctx = window.AudioContext || (window as unknown as {webkitAudioContext:typeof AudioContext}).webkitAudioContext;
      if(!Ctx)throw new Error('This browser does not support audio. Try Safari, Chrome, or Firefox.');
      // Prioritize live monitoring; recording still has its independent eight-second buffer.
      // Native device rates remain stable across output-route changes, notably
      // on mobile Safari where a forced rate can leave a live context silent.
      this.ctx=new Ctx({latencyHint:'interactive'});
      this.initPromise=this.setup().catch(error=>{void this.ctx?.close();this.ctx=null;this.initPromise=null;throw error;});
    }
    await this.ctx.resume(); await this.initPromise;
  }
  private async setup(){
    const ctx=this.ctx!;
    if(!ctx.audioWorklet)throw new Error('Audio needs HTTPS or localhost. Open this app through a secure address.');
    await ctx.audioWorklet.addModule(`/audio/tape-processor.js?v=${__AUDIO_VERSION__}`);
    this.input=ctx.createGain();this.echoInput=ctx.createGain();this.tape=new AudioWorkletNode(ctx,'magnetic-tape',{numberOfInputs:2,outputChannelCount:[2]});
    this.input.connect(this.tape,0,0);this.echoInput.connect(this.tape,0,1); this.master=ctx.createGain();this.tape.connect(this.master);
    const spring=this.spring=ctx.createConvolver(); const impulse=ctx.createBuffer(2,Math.floor(ctx.sampleRate*2.7),ctx.sampleRate);
    for(let c=0;c<2;c++){const a=impulse.getChannelData(c);let prev=0;for(let i=0;i<a.length;i++){const t=i/ctx.sampleRate;prev=prev*.45+(Math.random()*2-1)*.55; a[i]=(prev*.6+Math.sin(2*Math.PI*(1700*t-1250*t*t))*Math.exp(-t*15)*.22)*Math.exp(-t*3.1)*(1-Math.exp(-t*150));}}
    spring.buffer=impulse;this.reverbGain=ctx.createGain();this.tape.connect(spring);spring.connect(this.reverbGain);this.reverbGain.connect(this.master);
    this.spaceNode=new AudioWorkletNode(ctx,'magnetic-space',{outputChannelCount:[2]});this.spaceGain=ctx.createGain();this.tape.connect(this.spaceNode);this.spaceNode.connect(this.spaceGain);this.spaceGain.connect(this.master);
    const limiter=ctx.createDynamicsCompressor();limiter.threshold.value=-3;limiter.knee.value=5;limiter.ratio.value=16;limiter.attack.value=.003;limiter.release.value=.15;
    this.capture=new AudioWorkletNode(ctx,'magnetic-capture',{outputChannelCount:[2],processorOptions:{maxSeconds:MASTER_LIMIT}});
    this.analyser=ctx.createAnalyser();this.analyser.fftSize=8192;this.analyser.smoothingTimeConstant=.65;
    // Playback stays independent from capture: a recorder interruption must
    // never mute the studio output. The zero-gain branch keeps capture alive.
    const captureSink=ctx.createGain();captureSink.gain.value=0;
    this.master.connect(limiter);limiter.connect(this.analyser);limiter.connect(this.capture);this.capture.connect(captureSink);captureSink.connect(ctx.destination);this.auditionWet=ctx.createGain();this.auditionDry=ctx.createGain();this.auditionDry.gain.value=0;this.analyser.connect(this.auditionWet);this.auditionWet.connect(ctx.destination);this.input.connect(this.auditionDry);this.auditionDry.connect(ctx.destination);
    this.inputAnalyser=ctx.createAnalyser();this.inputAnalyser.fftSize=8192;this.input.connect(this.inputAnalyser);
    this.gains=this.tracks.map(()=>{const g=ctx.createGain(),pan=ctx.createStereoPanner(),send=ctx.createGain();g.connect(pan);pan.connect(this.input);pan.connect(send);send.connect(this.echoInput);const analyser=ctx.createAnalyser();analyser.fftSize=8192;pan.connect(analyser);this.trackAnalysers.push(analyser);this.pans.push(pan);this.sends.push(send);return g;});
    this.tape.port.onmessage=({data})=>{if(data.type==='cloud')this.cloudVisual=data;};
    // Eight seconds of shared PCM absorb worker scheduling stalls. The audio
    // callback only copies samples; WAV conversion happens on demand elsewhere.
    this.recorder=new Worker(`/audio/recorder-worker.js?v=${__AUDIO_VERSION__}`);
    const shared=globalThis.crossOriginIsolated&&typeof SharedArrayBuffer!=='undefined'?{state:new SharedArrayBuffer(16),audio:new SharedArrayBuffer(ctx.sampleRate*8*2*4)}:undefined;
    if(shared)this.captureState=new Int32Array(shared.state);
    this.capture.port.postMessage({shared});
    const channel=new MessageChannel();this.capture.port.postMessage({sink:channel.port1},[channel.port1]);
    await new Promise<void>((resolve,reject)=>{
      this.recorder.onerror=()=>{reject(new Error('The master recorder could not start. Reload the studio.'));this.recorderError('Master recorder interrupted. Previously saved takes are still available. Reload before recording again.');};
      this.recorder.onmessage=({data})=>{
        if(data.type==='ready')resolve();
        if(data.type==='error')this.recorderError(data.message);
        if(data.type==='take'){
          if(data.frames){this.takes.unshift({id:crypto.randomUUID(),name:`Take ${String(Math.max(0,...this.takes.map(t=>Number(t.name.replace('Take ',''))||0))+1).padStart(2,'0')}`,blob:data.blob,duration:data.duration,pcm:data.pcm,interrupted:data.interrupted});this.onNotice(data.interrupted?'Capture buffer filled. The complete captured portion was saved; recording stopped.':data.limited?'30-minute limit reached. Master take saved.':'Master take saved. WAV is prepared when you export.');}
          this.recording=false;this.masterSaving=false;this.tailSaving=false;if(this.tailTimer)clearTimeout(this.tailTimer);this.tailTimer=null;this.applyMicSettings();this.stopResolve?.();this.stopResolve=null;this.onChange();
        }
      };
      this.recorder.postMessage({source:channel.port2,sampleRate:ctx.sampleRate,shared},[channel.port2]);
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
    this.tape.port.postMessage({heads:this.heads.map(Number),cloudHold:this.cloudHolding});
    (this.spaceNode.parameters as unknown as Map<string,AudioParam>).get('decay')!.setTargetAtTime(this.params.decay,at,.08);
    (this.spaceNode.parameters as unknown as Map<string,AudioParam>).get('damping')!.setTargetAtTime(this.params.age,at,.08);
    this.reverbGain.gain.setTargetAtTime(this.enabled?this.params.reverb*.65:0,at,.03);
    this.spaceGain.gain.setTargetAtTime(this.enabled?this.params.space*.85:0,at,.03);
    this.master.gain.setTargetAtTime(this.params.volume,at,.02);
  }
  updateGains(){if(!this.ctx)return;const anySolo=this.tracks.some(t=>t.solo),at=this.ctx.currentTime;this.tracks.forEach((t,i)=>{this.gains[i]?.gain.setTargetAtTime(t.muted||(anySolo&&!t.solo)?0:t.volume,at,.015);this.sends[i]?.gain.setTargetAtTime(this.throwing===i?1:t.send,at,.01);this.pans[i]?.pan.setTargetAtTime(t.pan,at,.02);});}
  throwEcho(i:number,active:boolean){this.throwing=active?i:-1;this.updateGains();this.onChange();}
  brake(active:boolean){if(this.micRecording||this.braking===active)return;this.braking=active;this.rampSpeed(active?.025:this.speed,active?.8:.45);this.onChange();}
  releaseMomentaries(){this.throwing=-1;this.brake(false);this.updateGains();this.onChange();}
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
  async play(){if(!this.tracks.some(t=>t.clip)){this.onNotice('Add audio, choose a sound from the library, or play the starter mix.');return;}await this.init();if(this.playing)return;if(!this.repeats&&this.position>=this.duration+this.tapeOrigin){this.position=0;this.tapeOrigin=0;}this.motorSpeed=this.braking?.025:this.speed;this.playing=true;this.startSources();this.onChange();}
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
      const offset=t.mode==='tape'?Math.max(0,position-this.tapeOrigin):position;
      if(!loops&&offset>=buffers.get(i)!.duration)return[];
      const node=this.ctx!.createBufferSource(),fade=this.ctx!.createGain();node.buffer=buffers.get(i)!;node.loop=loops;
      const bounds=t.mode==='loop'?this.loopBounds(i):{start:0,end:this.duration};node.loopStart=bounds.start;node.loopEnd=bounds.end;node.playbackRate.value=this.motorSpeed;
      node.connect(fade);fade.connect(this.gains[i]);fade.gain.setValueAtTime(0,at);fade.gain.linearRampToValueAtTime(1,at+.025);
      node.onended=()=>{node.disconnect();fade.disconnect();};node.start(at,loops?bounds.start+offset%(bounds.end-bounds.start):offset);return[{node,fade,index:i}];
    });
    this.sources=[...this.sources,...added].sort((a,b)=>a.index-b.index);
  }
  pause(){if(!this.playing)return;this.position=this.transportPosition;this.stopSources();this.playing=false;this.braking=false;this.motorSpeed=this.speed;this.speedRamp=null;this.onChange();}
  private stopSources(indices=this.tracks.map((_,i)=>i),at=this.ctx!.currentTime){for(const {node,fade,index} of this.sources){if(!indices.includes(index))continue;if(fade.gain.cancelAndHoldAtTime)fade.gain.cancelAndHoldAtTime(at);else{fade.gain.cancelScheduledValues(at);fade.gain.setValueAtTime(fade.gain.value,at);}fade.gain.linearRampToValueAtTime(0,at+.025);node.stop(at+.026);}this.sources=this.sources.filter(s=>!indices.includes(s.index));}
  stop(){this.pause();this.position=0;this.tapeOrigin=0;this.onChange();}
  seek(position:number){this.tapeOrigin=0;this.position=Math.max(0,Math.min(this.duration-.001,position));if(this.playing){this.stopSources();this.startSources();}this.onChange();}
  private restart(indices=this.tracks.map((_,i)=>i)){if(this.playing)this.startSources(indices,true);}
  private rampSpeed(value:number,duration:number){
    const now=this.ctx?.currentTime||0,r=this.speedRamp,from=r?r.from+(r.to-r.from)*Math.min(1,Math.max(0,now-r.at)/r.duration):this.motorSpeed;
    this.position=this.transportPosition;this.motorSpeed=value;
    if(this.playing){this.startedAt=now;this.speedRamp={from,to:value,at:now,duration};for(const {node} of this.sources){node.playbackRate.cancelScheduledValues(now);node.playbackRate.setValueAtTime(from,now);node.playbackRate.linearRampToValueAtTime(value,now+duration);}}else this.speedRamp=null;
  }
  setSpeed(value:number){if(!Number.isFinite(value))return;this.speed=Math.max(.25,Math.min(2,value));if(!this.braking)this.rampSpeed(this.speed,.08);this.onChange();}
  toggleLoop(){if(this.loop)this.tapeOrigin=this.transportPosition-this.currentPosition;this.loop=!this.loop;this.restart();this.onChange();}
  setTrackMode(i:number,mode:Track['mode']){this.remember(i);this.tracks[i].mode=mode;this.restart([i]);this.onChange();}
  setLoopBounds(i:number,start:number,end:number){if(!Number.isFinite(start)||!Number.isFinite(end))return;const t=this.tracks[i];if(!t.clip)return;this.remember(i);const length=t.clip.channels[0].length/t.clip.sampleRate,min=Math.min(.02,length);t.loopEnd=Math.max(min,Math.min(length,end));t.loopStart=Math.max(0,Math.min(start,t.loopEnd-min));t.mode='loop';this.restart([i]);this.onChange();}
  tick(){if(this.playing&&!this.repeats&&this.transportPosition>=this.duration+this.tapeOrigin){this.pause();this.position=0;this.tapeOrigin=0;this.onChange();}}
  private remember(i:number){this.undoStack.push({index:i,track:{...this.tracks[i]}});if(this.undoStack.length>8)this.undoStack.shift();}
  setClip(i:number,clip:Clip|null){const duration=this.duration,phase=this.currentPosition;this.remember(i);this.tracks[i]={...this.tracks[i],clip,reversed:false,loopStart:0,loopEnd:0,...(!clip?{muted:false,solo:false}:{} )};if(this.loop&&this.duration!==duration)this.tapeOrigin=this.transportPosition-Math.min(phase,this.duration-.001);this.restart(this.duration===duration?[i]:this.tracks.flatMap((t,j)=>j===i||t.mode==='tape'?[j]:[]));this.updateGains();this.onChange();}
  undo(){const state=this.undoStack.pop();if(!state)return;const duration=this.duration,phase=this.currentPosition;this.tracks[state.index]=state.track;if(this.loop&&this.duration!==duration)this.tapeOrigin=this.transportPosition-Math.min(phase,this.duration-.001);this.restart(this.duration===duration?[state.index]:this.tracks.flatMap((t,i)=>i===state.index||t.mode==='tape'?[i]:[]));this.updateGains();this.onChange();}
  reverse(i:number){this.remember(i);this.tracks[i].reversed=!this.tracks[i].reversed;this.restart([i]);this.onChange();}
  private async prepareBuffer(track:Track,duration:number){
    track={...track};
    const clip=track.clip;if(!clip)return;
    const length=clip.channels[0].length/clip.sampleRate;
    const end=Math.max(.001,Math.min(length,track.loopEnd||length)),start=Math.max(0,Math.min(track.loopStart,end-.001));
    const seconds=track.mode==='tape'?duration:length,key=`${seconds}:${track.reversed}:${track.mode}:${start}:${end}`;
    if(this.bufferCache.get(clip)?.key===key)return;
    const buffer=this.ctx!.createBuffer(2,Math.ceil(seconds*clip.sampleRate),clip.sampleRate);
    for(let c=0;c<2;c++){
      const src=clip.channels[c]||clip.channels[0],dst=buffer.getChannelData(c);
      for(let offset=0;offset<src.length;offset+=32768){
        const until=Math.min(src.length,offset+32768);
        if(track.reversed)for(let i=offset;i<until;i++)dst[i]=src[src.length-1-i];
        else dst.set(src.subarray(offset,until),offset);
        // Let input, painting and native audio tasks run between sample copies.
        await new Promise<void>(resolve=>setTimeout(resolve,0));
      }
      if(track.mode==='loop'){const from=Math.round(start*clip.sampleRate),to=Math.min(dst.length,Math.round(end*clip.sampleRate)),fade=Math.min(Math.floor((to-from)/2),Math.ceil(clip.sampleRate*.003));for(let j=0;j<fade;j++){dst[from+j]*=j/fade;dst[to-1-j]*=j/fade;}}
    }
    this.bufferCache.set(clip,{key,buffer});
  }
  async loadDemo(kind:string,index:number){
    const clip=await new Promise<Clip>((resolve,reject)=>{
      const worker=new Worker(new URL('./sample-worker.ts',import.meta.url),{type:'module'});
      worker.onmessage=({data})=>{worker.terminate();resolve(data);};
      worker.onerror=()=>{worker.terminate();reject(new Error('This sound could not be prepared. Please try again.'));};
      worker.postMessage({kind});
    });
    if(this.ctx){
      const duration=Math.max(1,clip.channels[0].length/clip.sampleRate,...this.tracks.filter((_,i)=>i!==index).map(t=>t.clip?t.clip.channels[0].length/t.clip.sampleRate:0));
      await this.prepareBuffer({...this.tracks[index],clip,reversed:false,loopStart:0,loopEnd:0},duration);
      if(duration!==this.duration)for(let i=0;i<4;i++)if(i!==index&&this.tracks[i].mode==='tape')await this.prepareBuffer(this.tracks[i],duration);
    }
    this.setClip(index,clip);
  }
  async importFile(file:File,index:number){
    if(file.size>60*1024*1024)throw new Error('Choose an audio file smaller than 60 MB.');
    await this.init();let decoded:AudioBuffer;
    // Decoding uses a separate offline context, away from the live graph.
    const decoder=new OfflineAudioContext(2,1,this.ctx!.sampleRate);
    try{decoded=await decoder.decodeAudioData(await file.arrayBuffer());}catch{throw new Error('This audio format could not be read. Try WAV, MP3, M4A, or OGG.');}
    if(decoded.duration>180)throw new Error('Choose a sample under 3 minutes to keep the tape responsive.');
    const channels=[decoded.getChannelData(0),decoded.getChannelData(Math.min(1,decoded.numberOfChannels-1))];
    const clip={name:file.name.replace(/\.[^.]+$/,''),channels,sampleRate:decoded.sampleRate};
    const next={...this.tracks[index],clip,reversed:false,loopStart:0,loopEnd:0};
    const duration=Math.max(1,decoded.duration,...this.tracks.filter((_,i)=>i!==index).map(t=>t.clip?t.clip.channels[0].length/t.clip.sampleRate:0));
    if(decoded.numberOfChannels<=2&&next.mode!=='loop'&&(next.mode!=='tape'||decoded.duration===duration))this.bufferCache.set(clip,{key:`${decoded.duration}:false:${next.mode}:0:${decoded.duration}`,buffer:decoded});
    await this.prepareBuffer(next,duration);
    // Only followers need new padding when the full reel gets longer.
    if(duration!==this.duration)for(let i=0;i<4;i++)if(i!==index&&this.tracks[i].mode==='tape')await this.prepareBuffer(this.tracks[i],duration);
    this.setClip(index,clip);this.onNotice(`Loaded ${file.name} onto track ${index+1}.`);
  }
  async takeWav(take:Take):Promise<Blob>{
    if(!take.pcm)return take.blob; // Existing WAV takes remain byte-for-byte compatible.
    const pending=this.wavJobs.get(take.blob);if(pending)return pending;
    const job=new Promise<Blob>((resolve,reject)=>{
      const worker=new Worker(`/audio/wav-worker.js?v=${__AUDIO_VERSION__}`);
      worker.onmessage=({data})=>{worker.terminate();if(data.error)reject(new Error(data.error));else resolve(data.blob);};
      worker.onerror=()=>{worker.terminate();reject(new Error('WAV export failed. Your raw take is still saved; try again.'));};
      worker.postMessage({blob:take.blob,pcm:take.pcm});
    });
    this.wavJobs.set(take.blob,job);
    // Share concurrent requests, then release the extra WAV memory.
    try{return await job;}finally{this.wavJobs.delete(take.blob);}
  }
  async startMaster(){if(this.recording||this.masterSaving)return;await this.init();this.auditionOriginal(false);this.applyMicSettings();if(this.recorderFailed)throw new Error('Reload the studio before recording again.');if(this.recording||this.masterSaving)return;if(this.captureState)this.captureState.fill(0);this.recording=true;this.recordingStarted=this.ctx!.currentTime;this.capture.port.postMessage('start');this.onChange();}
  async stopMaster(){if(this.tailTimer)clearTimeout(this.tailTimer);this.tailTimer=null;this.tailSaving=false;if(this.masterStopPromise)return this.masterStopPromise;if(!this.recording)return;this.masterSaving=true;this.onChange();this.masterStopPromise=this.ctx!.resume().then(()=>new Promise<void>(resolve=>{if(!this.recording){resolve();return;}this.stopResolve=resolve;this.capture.port.postMessage('stop');}));try{await this.masterStopPromise;}finally{this.masterStopPromise=null;this.masterSaving=false;}}
  auditionOriginal(active:boolean){
    if(!this.ctx||!this.auditionWet||!this.auditionDry||!this.inputAnalyser)return;
    if(this.recording)active=false;
    let gain=1;
    if(active){const a=new Float32Array(8192),b=new Float32Array(8192);this.inputAnalyser.getFloatTimeDomainData(a);this.analyser.getFloatTimeDomainData(b);const rms=(v:Float32Array)=>Math.sqrt(v.reduce((n,x)=>n+x*x,0)/v.length);gain=Math.max(.25,Math.min(4,rms(b)/Math.max(.0001,rms(a))));}
    this.auditionWet.gain.setTargetAtTime(active?0:1,this.ctx.currentTime,.025);this.auditionDry.gain.setTargetAtTime(active?gain:0,this.ctx.currentTime,.025);
  }
  async finishWithTail(){
    if(!this.recording||this.tailSaving)return;
    this.pause();this.micMonitor?.gain.setTargetAtTime(0,this.ctx!.currentTime,.01);
    this.tailSaving=true;this.onNotice('Tape paused. Capturing the decay; Stop & save ends it immediately.');this.onChange();
    const began=this.ctx!.currentTime,samples=new Float32Array(2048);let quietSince:number|null=null;
    const check=()=>{
      if(!this.recording){this.tailSaving=false;return;}
      const now=this.ctx!.currentTime;this.analyser.getFloatTimeDomainData(samples);
      const rms=Math.sqrt(samples.reduce((n,v)=>n+v*v,0)/samples.length);
      if(rms<.001)quietSince??=now;else quietSince=null;
      if(now-began>=30||(now-began>=2&&quietSince!==null&&now-quietSince>1.5))void this.stopMaster();
      else this.tailTimer=setTimeout(check,150);
    };check();
  }
  private async openMic(index:number){
    await this.init();
    if(!navigator.mediaDevices?.getUserMedia)throw new Error('Microphone recording needs HTTPS or localhost.');
    if(this.micStream&&this.micTrack===index)return;
    const stream=await navigator.mediaDevices.getUserMedia({audio:{deviceId:this.micDeviceId?{exact:this.micDeviceId}:undefined,echoCancellation:false,noiseSuppression:false,autoGainControl:false,channelCount:{ideal:2}}});
    this.releaseMic();
    try{
      this.micStream=stream;this.micTrack=index;this.micProblem='';
      const track=stream.getAudioTracks()[0];this.micDeviceLabel=track.label||'Microphone';
      this.micSource=this.ctx!.createMediaStreamSource(stream);
      this.micSplitter=this.ctx!.createChannelSplitter(2);this.micMerger=this.ctx!.createChannelMerger(2);
      this.micTrim=this.ctx!.createGain();this.micMonitor=this.ctx!.createGain();
      this.micAnalyser=this.ctx!.createAnalyser();this.micAnalyser.fftSize=8192;
      this.micRawAnalyser=this.ctx!.createAnalyser();this.micRawAnalyser.fftSize=2048;
      this.micSource.connect(this.micSplitter);this.micMerger.connect(this.micRawAnalyser);this.micMerger.connect(this.micTrim);
      this.micTrim.connect(this.micAnalyser);this.micTrim.connect(this.micMonitor);this.micMonitor.connect(this.gains[index]);
      this.applyMicSettings();
      track.addEventListener('ended',()=>{
        if(this.micStream!==stream)return;
        this.micProblem=`${this.micDeviceLabel} disconnected. Choose an input to reconnect.`;this.micLive=false;
        if(this.micRecording)void this.stopMic().finally(()=>this.releaseMic());else this.releaseMic();
        this.onNotice(this.micProblem);this.onChange();
      });
    }catch(error){this.releaseMic();throw error;}
  }
  private applyMicSettings(){
    if(!this.ctx||!this.micSplitter||!this.micMerger)return;
    this.micSplitter.disconnect();
    const stereo=(this.micStream?.getAudioTracks()[0].getSettings().channelCount||1)>1;
    if(this.micChannel==='mono'&&stereo){
      // Sum both inputs with half gain rather than discarding one side of a stereo mic.
      this.micMerger.disconnect();this.micMerger.connect(this.micRawAnalyser!);this.micMerger.connect(this.micTrim!);
      this.micSplitter.connect(this.micMerger,0,0);this.micSplitter.connect(this.micMerger,1,1);
      this.micTrim!.channelCount=1;this.micTrim!.channelCountMode='explicit';
    }else{
      const left=this.micChannel==='right'&&stereo?1:0,right=this.micChannel==='stereo'&&stereo?1:left;
      this.micSplitter.connect(this.micMerger,left,0);this.micSplitter.connect(this.micMerger,right,1);
      this.micTrim!.channelCount=2;this.micTrim!.channelCountMode='explicit';
    }
    this.micTrim!.gain.setTargetAtTime(10**(this.micGainDb/20),this.ctx.currentTime,.015);
    this.micMonitor!.gain.setTargetAtTime(this.monitoring&&!this.tailSaving?1:0,this.ctx.currentTime,.015);
  }
  async activateMic(index:number){
    if(this.micArming||this.micRecording)return;
    this.micArming=true;this.onChange();
    try{await this.openMic(index);this.micLive=true;}
    catch(error){this.micError(error);}
    finally{this.micArming=false;this.onChange();}
  }
  async changeMicDevice(id:string){
    if(this.micRecording||this.micArming)return;
    const previous=this.micDeviceId,index=this.micTrack;this.micDeviceId=id;
    if(index!==null){
      // Keep the current working input until the replacement has been granted.
      this.micTrack=null;this.micArming=true;this.onChange();
      try{await this.openMic(index);this.micLive=true;}
      catch(error){this.micDeviceId=previous;this.micTrack=index;this.micError(error);}
      finally{this.micArming=false;}
    }
    this.onChange();
  }
  setMicGain(db:number){this.micGainDb=Math.max(-24,Math.min(24,Number.isFinite(db)?db:0));this.applyMicSettings();this.onChange();}
  setMicChannel(channel:typeof this.micChannel){if(this.micRecording)return;this.micChannel=channel;this.applyMicSettings();this.onChange();}
  async deactivateMic(){if(this.micRecording)await this.stopMic();this.micLive=false;this.monitoring=false;this.releaseMic();this.onChange();}
  private micError(error:unknown):never{
    if(error instanceof DOMException){
      if(error.name==='NotAllowedError')throw new Error('Microphone permission was denied. Allow microphone access in your browser’s site settings.');
      if(error.name==='NotFoundError'||error.name==='OverconstrainedError')throw new Error('The selected microphone is unavailable. Choose another input or System default.');
      if(error.name==='NotReadableError')throw new Error('The microphone is busy or unavailable. Check the device connection.');
    }throw error;
  }
  async startMic(index:number){
    if(this.micRecording||this.micArming)return;this.micArming=true;this.onChange();
    try{
      await this.openMic(index);
      this.micTarget=index;this.micRate=this.speed;this.micOverdub=this.overdub;
      const delay=this.micCountIn?4*60/this.bpm:0;
      this.micStarted=this.ctx!.currentTime+delay;
      const position=this.trackPosition(index)+(this.playing?delay*this.speed:0);
      this.micOffset=this.tracks[index].mode==='loop'?this.loopBounds(index).start+(position-this.loopBounds(index).start)%(this.loopBounds(index).end-this.loopBounds(index).start):this.loop?position%this.duration:position;
      this.micCapture=new AudioWorkletNode(this.ctx!,'magnetic-capture',{outputChannelCount:[2]});
      this.micSilent=this.ctx!.createGain();this.micSilent.gain.value=0;this.micTrim!.connect(this.micCapture);this.micCapture.connect(this.micSilent);this.micSilent.connect(this.ctx!.destination);
      this.micChunks=[[],[]];this.micCapture.port.onmessage=({data})=>{
        if(data.type==='chunk'){this.micChunks[0].push(data.left);this.micChunks[1].push(data.right);}
        if(data.type==='done'){
          try{
            const captured=this.micChunks.map(joinChunks);this.micChunks=[[],[]];
            if(captured[0].length){
              const sr=this.ctx!.sampleRate,old=this.tracks[this.micTarget].clip;
              const offset=Math.floor(this.micOffset*sr),recordedFrames=Math.ceil(captured[0].length*this.micRate);
              const oldLength=this.micOverdub&&old?Math.ceil(old.channels[0].length/old.sampleRate*sr):0;
              const len=Math.max(offset+recordedFrames,oldLength),channels=[new Float32Array(len),new Float32Array(len)];
              for(let c=0;c<2;c++){
                if(this.micOverdub&&old){const a=old.channels[c]||old.channels[0];for(let i=0;i<oldLength;i++){let r=i/sr*old.sampleRate;if(this.tracks[this.micTarget].reversed)r=a.length-1-r;const lo=Math.max(0,Math.floor(r));channels[c][i]=a[lo]||0;}}
                for(let i=0;i<recordedFrames;i++){const r=i/this.micRate,lo=Math.floor(r),f=r-lo;channels[c][offset+i]+=(captured[c][lo]||0)*(1-f)+(captured[c][lo+1]||0)*f;}
              }
              this.setClip(this.micTarget,{name:this.micOverdub&&old?`${old.name} + overdub`:'Microphone take',sampleRate:sr,channels});
              this.onNotice(data.limited?`10-minute limit reached. Recording saved on track ${this.micTarget+1}.`:`Recording saved on track ${this.micTarget+1}.`);
            }
          }catch{this.onNotice('Not enough memory to place this microphone take. Shorter recordings use less memory.');}
          finally{
            if(this.micCapture)this.micTrim?.disconnect(this.micCapture);this.micCapture?.disconnect();this.micSilent?.disconnect();
            this.micCapture=null;this.micSilent=null;this.micRecording=false;
            if(!this.micLive&&!this.monitoring)this.releaseMic();
            this.micResolve?.();this.micResolve=null;this.onChange();
          }
        }
      };
      this.micRecording=true;this.micCapture.port.postMessage(delay?{startAt:this.micStarted}:'start');
      if(delay)for(let i=0;i<4;i++){
        const oscillator=this.ctx!.createOscillator(),gain=this.ctx!.createGain(),at=this.ctx!.currentTime+i*60/this.bpm;
        oscillator.frequency.value=i===0?1000:750;gain.gain.setValueAtTime(.045,at);gain.gain.exponentialRampToValueAtTime(.0001,at+.045);
        oscillator.connect(gain);gain.connect(this.ctx!.destination);oscillator.start(at);oscillator.stop(at+.05);
        oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};this.countClicks.push(oscillator);
      }
      this.onNotice(delay?'Four-beat count-in…':this.micOverdub?'Recording an overdub…':'Recording microphone…');
    }catch(error){if(!this.micLive)this.releaseMic();this.micError(error);}
    finally{this.micArming=false;this.onChange();}
  }
  async stopMic(){
    for(const click of this.countClicks)try{click.stop();}catch{}this.countClicks=[];
    if(this.micStopPromise)return this.micStopPromise;if(!this.micRecording)return;
    this.micStopPromise=this.ctx!.resume().then(()=>new Promise<void>(resolve=>{this.micResolve=resolve;this.micCapture!.port.postMessage('stop');}));
    try{await this.micStopPromise;}finally{this.micStopPromise=null;}
  }
  private releaseMic(){
    this.micStream?.getTracks().forEach(t=>t.stop());this.micSource?.disconnect();this.micCapture?.disconnect();this.micSilent?.disconnect();
    this.micSplitter?.disconnect();this.micMerger?.disconnect();this.micTrim?.disconnect();this.micMonitor?.disconnect();this.micAnalyser?.disconnect();this.micRawAnalyser?.disconnect();
    this.micStream=null;this.micSource=null;this.micCapture=null;this.micSilent=null;this.micSplitter=null;this.micMerger=null;this.micTrim=null;this.micMonitor=null;this.micAnalyser=null;this.micRawAnalyser=null;this.micTrack=null;this.micRecording=false;
  }
  async setMonitoring(value:boolean,index=this.selected){
    if(value&&!this.micStream)await this.activateMic(index);
    this.monitoring=value;this.applyMicSettings();this.onChange();
  }
  clearEffects(){this.cloudHolding=false;this.releaseMomentaries();this.tape?.port.postMessage({clear:true});this.spaceNode?.port.postMessage({clear:true});if(this.spring){const impulse=this.spring.buffer;this.spring.buffer=null;this.spring.buffer=impulse;}}
  async bounce(index:number){const take=this.takes[0];if(!take)return;await this.importFile(new File([await this.takeWav(take)],`${take.name} bounce.wav`,{type:'audio/wav'}),index);}
}
