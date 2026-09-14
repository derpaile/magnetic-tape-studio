/* A rolling, stereo memory. Holding stops memory writes, while the tape and
   master keep running. Windowed grains only read fully recorded material. */
class MemoryCloud {
  constructor() {
    this.size = Math.ceil(sampleRate * 12); this.memory = [new Float32Array(this.size), new Float32Array(this.size)];
    this.pos = 0; this.filled = 0; this.hold = false; this.phase = 0; this.clock = 0; this.seed = 7129;
    this.voices = Array.from({length:32}, () => ({pos:0, age:0, length:0, rate:1, pan:0}));
    this.window = Float32Array.from({length:1025}, (_, i) => .5 - .5 * Math.cos(2 * Math.PI * i / 1024));
    this.audible = false; this.grainLength = 0; this.overlap = 3;
    this.output = [0,0]; this.values = [0,.24,1.5,.35,.15,0]; this.keys = ['dissolve','grainSize','memory','scatter','wander','return'];
    this.motion = 'idle'; this.motionFrames = 0; this.motionSamples = 0;
    this.movements = new Float32Array(512 * 6); this.telemetry = 0;
    this.peaks = new Float32Array(64); this.peakBin = -1;
  }
  random() { this.seed = (Math.imul(this.seed,1664525)+1013904223)|0; return (this.seed>>>0)/4294967296; }
  command(data) {
    if (typeof data.cloudHold === 'boolean') this.hold = data.cloudHold;
    if (data.motion === 'record') { this.motion = 'record'; this.motionFrames = 0; this.motionSamples = 0; }
    if (data.motion === 'play') { this.motion = this.motionFrames > 1 ? 'play' : 'idle'; this.motionSamples = 0; }
    if (data.motion === 'stop') this.motion = 'idle';
    if (data.clear) { this.filled = 0; this.hold = false; this.motion = 'idle'; this.motionFrames = 0; this.peaks.fill(0); this.output.fill(0); this.voices.forEach(v => v.length = 0); }
  }
  begin(p, frames) {
    const slot = Math.floor(this.motionSamples / (sampleRate / 32));
    if (this.motion === 'record') {
      if (slot >= 512) { this.motion = 'play'; this.motionSamples = 0; }
      else if (slot >= this.motionFrames) { for (let k=0;k<6;k++) this.movements[slot*6+k] = p[this.keys[k]][0]; this.motionFrames = slot+1; }
    }
    if (this.motion === 'play') {
      const t = this.motionSamples / (sampleRate / 32), a = Math.floor(t) % this.motionFrames, b = (a+1) % this.motionFrames, f = t-Math.floor(t);
      for (let k=0;k<6;k++) this.values[k] += (this.movements[a*6+k]*(1-f)+this.movements[b*6+k]*f-this.values[k])*.08;
    } else for (let k=0;k<6;k++) this.values[k] += (p[this.keys[k]][0]-this.values[k])*.08;
    if (this.motion !== 'idle') this.motionSamples += frames;
    this.telemetry += frames;
    const audible=this.values[0]>.0001||this.values[5]>.0001;
    if(this.audible&&!audible)for(const voice of this.voices)voice.length=0;
    if(!this.audible&&audible)this.clock=0;
    this.audible=audible;
    this.grainLength = Math.round(this.values[1]*sampleRate); this.overlap = 3+this.values[0]*9;
  }
  read(c, pos) { const r = pos<0?pos+this.size:pos>=this.size?pos-this.size:pos, a = Math.floor(r), f = r-a; return this.memory[c][a]*(1-f)+this.memory[c][(a+1)%this.size]*f; }
  process(left, right) {
    const memory=this.values[2], scatter=this.values[3], wander=this.values[4];
    if (!this.hold) {
      this.memory[0][this.pos] = left; this.memory[1][this.pos] = right;
      const bin = Math.min(63, Math.floor(this.pos/this.size*64)); if (bin !== this.peakBin) { this.peaks[bin] = 0; this.peakBin = bin; }
      this.peaks[bin] = Math.max(this.peaks[bin], Math.abs(left), Math.abs(right));
      this.pos = (this.pos+1)%this.size; this.filled = Math.min(this.size, this.filled+1);
    }
    this.phase += 1/sampleRate;
    // Keep listening at zero dissolve, but don't render 32 inaudible voices.
    if (!this.audible) { this.output[0]=this.output[1]=0; return; }
    const length = this.grainLength, overlap = this.overlap;
    if (--this.clock <= 0 && this.filled > length*2+128) {
      this.clock = Math.max(128, length/overlap*(.85+this.random()*.3));
      let voice; for (let k=0;k<this.voices.length;k++) if (this.voices[k].age>=this.voices[k].length) { voice=this.voices[k]; break; }
      if (voice) {
        const safe = length*1.1+128;
        const drift = Math.sin(this.phase*.19)*wander*sampleRate*4;
        const behind = Math.max(safe, Math.min(this.filled-length-2, memory*sampleRate+(this.random()-.5)*scatter*sampleRate*5+drift));
        voice.pos = (this.pos-behind+this.size)%this.size; voice.age = 0; voice.length = length;
        voice.rate = 2**((this.random()-.5)*scatter*.12); voice.pan = (this.random()-.5)*scatter;
      }
    }
    let l=0,r=0,weight=0;
    for (const v of this.voices) if (v.age < v.length) {
      const envelope = this.window[Math.min(1024, Math.floor(v.age/v.length*1024))];
      l += this.read(0,v.pos)*envelope*(1-v.pan); r += this.read(1,v.pos)*envelope*(1+v.pan); weight += envelope;
      v.pos += v.rate; if(v.pos>=this.size)v.pos-=this.size; v.age++;
    }
    // Never divide by a near-zero window: attacks and releases remain soft.
    const norm = Math.max(2,weight); this.output[0] = l/norm; this.output[1] = r/norm;
  }
  report(port) {
    if (this.telemetry < sampleRate/10) return; this.telemetry = 0;
    const peaks = Array.from({length:64}, (_, i) => this.peaks[(Math.floor(this.pos/this.size*64)+i+1)%64]);
    const grains = this.voices.filter(v=>this.audible&&v.age<v.length).map(v=>({x:1-((this.pos-v.pos+this.size)%this.size)/this.size, life:Math.sin(Math.PI*v.age/v.length)}));
    port.postMessage({type:'cloud',peaks,grains,filled:this.filled/sampleRate,hold:this.hold,motion:this.motion,motionDuration:this.motionFrames/32,values:this.values});
  }
}

/* Two-input stereo tape machine: dry tape bus + independent echo sends. */
class TapeProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return Object.entries({time:[.22,.04,1.5],head2:[.44,.04,4.5],head3:[.66,.04,4.5],dissolve:[0,0,1],grainSize:[.24,.08,.8],memory:[1.5,.1,10],scatter:[.35,0,1],wander:[.15,0,1],return:[0,0,.7],feedback:[.43,0,1.08],mix:[.35,0,1],age:[.4,0,1],wow:[.35,0,1],flutter:[.2,0,1],drive:[.38,0,1],tone:[.55,0,1],hiss:[.08,0,1],crinkle:[.12,0,1],lowCut:[120,20,1200],spread:[.45,0,1],enabled:[1,0,1]}).map(([name,[defaultValue,minValue,maxValue]])=>({name,defaultValue,minValue,maxValue,automationRate:'k-rate'}));
  }
  constructor() {
    super();this.size=Math.ceil(sampleRate*4.6);this.tape=[new Float32Array(this.size),new Float32Array(this.size)];
    this.held=[new Float32Array(this.size),new Float32Array(this.size)];this.heldLength=2;this.heldPos=0;this.hold=false;this.holdMix=0;this.inputCut=false;this.swell=false;this.feed=1;
    this.drySize=Math.ceil(sampleRate*.03);this.dryTape=[new Float32Array(this.drySize),new Float32Array(this.drySize)];this.dryPos=0;this.dryLP=[0,0];
    this.pos=0;this.phase=0;this.delay=.22*sampleRate;this.lp=[0,0];this.dc=[0,0];this.last=[0,0];this.env=0;this.dust=0;this.dustTarget=0;this.dustClock=0;this.seed=7841;
    this.heads=[1,0,1];this.headLevels=[1,0,1];this.wet=[0,0];this.returned=[0,0];this.delays=[.22*sampleRate,.44*sampleRate,.66*sampleRate];this.cloud=new MemoryCloud();this.memoryInput=[0,0];
    this.port.onmessage=({data})=>{
      this.cloud.command(data);
      if(data.heads)this.heads=data.heads;
      if(data.hold&&!this.hold){
        this.heldLength=Math.min(this.size-2,Math.max(2,Math.round(Math.max(...this.delays.map((d,i)=>this.heads[i]?d:0)))));this.heldPos=0;
        for(let c=0;c<2;c++)for(let i=0;i<this.heldLength;i++)this.held[c][i]=this.tape[c][(this.pos-this.heldLength+i+this.size)%this.size];
        const fade=Math.min(Math.round(sampleRate*.003),Math.floor(this.heldLength/2));for(let c=0;c<2;c++)for(let i=0;i<fade;i++){this.held[c][i]*=i/fade;this.held[c][this.heldLength-1-i]*=i/fade;}
      }
      if(typeof data.hold==='boolean')this.hold=data.hold;
      if(typeof data.inputCut==='boolean')this.inputCut=data.inputCut;
      if(typeof data.swell==='boolean')this.swell=data.swell;
      if(data.clear){this.tape.forEach(c=>c.fill(0));this.held.forEach(c=>c.fill(0));this.lp.fill(0);this.dc.fill(0);this.last.fill(0);this.hold=false;this.holdMix=0;this.env=0;}
    };
  }
  random(){this.seed=(Math.imul(this.seed,1664525)+1013904223)|0;return (this.seed>>>0)/2147483648-1;}
  read(buffer,position,size){const r=position<0?position+size:position>=size?position-size:position,a=Math.floor(r),f=r-a;return buffer[a]*(1-f)+buffer[(a+1)%size]*f;}
  process(inputs,outputs,p){
    const out=outputs[0],input=inputs[0]||[],send=inputs.length>1?inputs[1]:input;
    const enabled=p.enabled[0],mix=p.mix[0]*enabled,drive=1+p.drive[0]*4.5;
    const cutoff=900+p.tone[0]*11500*(1-p.age[0]*.86),alpha=1-Math.exp(-2*Math.PI*cutoff/sampleRate);
    const dryAlpha=1-Math.exp(-2*Math.PI*(14000-p.age[0]*10000)/sampleRate),hpCoeff=Math.exp(-2*Math.PI*p.lowCut[0]/sampleRate);
    const targets=[p.time[0]*sampleRate,p.head2[0]*sampleRate,p.head3[0]*sampleRate],feedback=this.swell?1.065:p.feedback[0],spread=p.spread[0];
    const slew=1-Math.exp(-1/(sampleRate*.16)),smooth=1-Math.exp(-1/(sampleRate*.015));
    const dryLevel=Math.cos(mix*Math.PI/2),wetLevel=Math.sin(mix*Math.PI/2),bias=p.drive[0]*.12,biasDC=Math.tanh(bias);
    const wowDepth=.0025*p.wow[0]*sampleRate,flutterDepth=.00045*p.flutter[0]*sampleRate,crinkleDepth=.003*p.crinkle[0]*sampleRate;
    this.cloud.begin(p,out[0].length);
    const dissolved=this.cloud.values[0]*enabled,tapeLevel=Math.cos(dissolved*Math.PI/2),cloudLevel=Math.sin(dissolved*Math.PI/2),cloudReturn=this.cloud.values[5]*enabled;
    for(let i=0;i<out[0].length;i++){
      for(let h=0;h<3;h++)this.delays[h]+=(targets[h]-this.delays[h])*slew;this.delay=this.delays[0];this.phase+=1/sampleRate;
      if(--this.dustClock<=0){this.dustTarget=Math.max(0,this.random()-.35);this.dustClock=sampleRate*(.03+(this.random()+1)*.08);}
      this.dust+=(this.dustTarget-this.dust)*.001;
      const wow=Math.sin(this.phase*2*Math.PI*.63)+.32*Math.sin(this.phase*2*Math.PI*.17);
      const flutter=Math.sin(this.phase*2*Math.PI*7.13)+.3*Math.sin(this.phase*2*Math.PI*13.7);
      const movement=wow*wowDepth+flutter*flutterDepth+this.dust*crinkleDepth;
      const wear=1-this.dust*p.crinkle[0]*1.1;
      this.holdMix+=((this.hold?1:0)-this.holdMix)*smooth;
      this.feed+=((this.inputCut||this.hold?0:1)-this.feed)*smooth;
      let total=0;for(let h=0;h<3;h++){this.headLevels[h]+=(this.heads[h]-this.headLevels[h])*smooth;total+=this.headLevels[h];}total=Math.max(1,total);
      for(let c=0;c<2;c++){
        let wet=0,returned=0;
        for(let h=0;h<3;h++){
          const delay=Math.max(2,Math.min(this.size-2,this.delays[h]+movement*(h+1))),tap=this.read(this.tape[c],this.pos-delay,this.size)*this.headLevels[h];
          returned+=tap;wet+=tap*(h===1?1:((h===0&&c===0)||(h===2&&c===1))?1+spread*.5:1-spread*.5);
        }this.wet[c]=wet/total;this.returned[c]=returned/total;
      }
      const energy=Math.max(Math.abs(input[0]?.[i]||0),Math.abs(input[1]?.[i]||0),Math.abs(this.wet[0]),Math.abs(this.wet[1]));
      this.env+=(energy-this.env)*(energy>this.env?.005:.00003);
      for(let c=0;c<2;c++){
        const dry=input[c]?.[i]??input[0]?.[i]??0,sent=send[c]?.[i]??send[0]?.[i]??0;
        const returned=this.returned[c]*(1-spread*.42)+this.returned[1-c]*spread*.42;
        this.lp[c]+=alpha*(returned-this.lp[c]);const hp=this.lp[c]-this.last[c]+hpCoeff*this.dc[c];this.last[c]=this.lp[c];this.dc[c]=hp;
        const held=this.held[c][this.heldPos],noise=this.random()*p.hiss[0]*.012*Math.min(1,this.env*8);
        const written=sent*.7*this.feed+hp*feedback+held*this.holdMix*.12+this.cloud.output[c]*cloudReturn;
        this.tape[c][this.pos]=Math.tanh(written*drive)/drive*wear+noise*.3;
        this.dryTape[c][this.dryPos]=dry;
        const magnetic=this.read(this.dryTape[c],this.dryPos-sampleRate*.006-movement,this.drySize);
        const saturated=(Math.tanh(magnetic*drive+bias)-biasDC)/drive;
        this.dryLP[c]+=dryAlpha*(saturated-this.dryLP[c]);
        const tapeDry=(this.dryLP[c]*.8+magnetic*.2)*wear+noise;
        const wet=this.wet[c]*(1-this.holdMix)+held*this.holdMix;
        const tapeOut=(dry*(1-enabled)+tapeDry*enabled)*dryLevel+wet*wetLevel;
        this.memoryInput[c]=tapeOut;
        out[c][i]=tapeOut*tapeLevel+this.cloud.output[c]*cloudLevel;
      }
      this.cloud.process(this.memoryInput[0],this.memoryInput[1]);
      this.pos=(this.pos+1)%this.size;this.dryPos=(this.dryPos+1)%this.drySize;this.heldPos=(this.heldPos+1)%this.heldLength;
    }this.cloud.report(this.port);return true;
  }
}
registerProcessor('magnetic-tape',TapeProcessor);

/* Damped eight-line feedback network; decay is the nominal 60 dB decay time. */
class SpaceProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors(){return [{name:'decay',defaultValue:6,minValue:1,maxValue:20,automationRate:'k-rate'},{name:'damping',defaultValue:.4,minValue:0,maxValue:1,automationRate:'k-rate'}];}
  constructor(){super();this.lines=[.0297,.0371,.0411,.0437,.0531,.0617,.0719,.0793].map(t=>new Float32Array(Math.round(t*sampleRate)|1));this.positions=new Int32Array(8);this.filtered=new Float32Array(8);this.values=new Float32Array(8);this.gains=new Float32Array(8);this.port.onmessage=({data})=>{if(data.clear){this.lines.forEach(l=>l.fill(0));this.filtered.fill(0);}};}
  process(inputs,outputs,p){const input=inputs[0]||[],out=outputs[0],alpha=1-Math.exp(-2*Math.PI*(1800+(1-p.damping[0])*7500)/sampleRate);
    for(let k=0;k<8;k++)this.gains[k]=10**(-3*this.lines[k].length/(sampleRate*p.decay[0]));
    for(let i=0;i<out[0].length;i++){
      let sum=0;for(let k=0;k<8;k++){const v=this.lines[k][this.positions[k]];this.filtered[k]+=alpha*(v-this.filtered[k]);this.values[k]=this.filtered[k];sum+=this.values[k];}
      for(let k=0;k<8;k++){const source=input[k%2]?.[i]??input[0]?.[i]??0;this.lines[k][this.positions[k]]=source*.22+(sum*.25-this.values[k])*this.gains[k];this.positions[k]=(this.positions[k]+1)%this.lines[k].length;}
      out[0][i]=(this.values[0]+this.values[2]-this.values[4]-this.values[6])*.5;
      out[1][i]=(this.values[1]+this.values[3]-this.values[5]-this.values[7])*.5;
    }return true;
  }
}
registerProcessor('magnetic-space',SpaceProcessor);

/* Never wait, encode or grow storage on the audio callback. */
class CaptureProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super(); this.active=false; this.count=0; this.total=0; this.interrupted=false;
    this.limit=Math.round(sampleRate*(options?.processorOptions?.maxSeconds||600));
    this.sink=this.port; this.state=null; this.ring=null; this.capacity=0;
    this.pool=Array.from({length:options?.processorOptions?.maxSeconds>600?64:0},()=>[new Float32Array(8192),new Float32Array(8192)]);
    this.chunk=[new Float32Array(8192),new Float32Array(8192)];
    this.port.onmessage=({data})=>{
      if(data.shared){this.state=new Int32Array(data.shared.state);this.ring=new Float32Array(data.shared.audio);this.capacity=this.ring.length/2;this.pool=[];}
      if(data.sink){this.sink=data.sink;this.sink.onmessage=({data:m})=>{if(m.type==='recycle'&&this.pool.length<64)this.pool.push([m.left,m.right]);};}
      if((data==='start'||typeof data.startAt==='number')&&!this.active){this.startAt=typeof data.startAt==='number'?data.startAt:0;this.count=0;this.total=0;this.interrupted=false;if(this.state){Atomics.store(this.state,0,0);Atomics.store(this.state,1,0);}else if(!this.chunk)this.chunk=this.pool.pop()||[new Float32Array(8192),new Float32Array(8192)];this.active=true;this.sink.postMessage({type:'started'});}
      if(data==='stop')this.finish();
    };
  }
  flush(){
    if(!this.count)return;
    const direct=this.sink!==this.port;
    const left=direct?this.chunk[0]:this.chunk[0].slice(0,this.count),right=direct?this.chunk[1]:this.chunk[1].slice(0,this.count);
    this.sink.postMessage({type:'chunk',left,right,frames:this.count},[left.buffer,right.buffer]);
    this.count=0;
    if(direct){this.chunk=this.pool.pop();if(!this.chunk&&this.active){this.interrupted=true;this.finish();}}
  }
  finish(){if(!this.active)return;this.active=false;this.flush();this.sink.postMessage({type:'done',frames:this.total,limited:this.total>=this.limit,interrupted:this.interrupted});}
  process(inputs,outputs){
    const input=inputs[0],output=outputs[0],left=input[0],right=input[1]||left;
    for(let c=0;c<output.length;c++)if(input[c]||left)output[c].set(input[c]||left);
    if(!this.active)return true;
    const first=this.startAt?Math.max(0,Math.min(output[0].length,Math.ceil((this.startAt-currentTime)*sampleRate))):0;
    const count=Math.min(output[0].length-first,this.limit-this.total);
    if(this.state){
      const read=Atomics.load(this.state,1);
      if(this.total-read+count>this.capacity){this.interrupted=true;this.finish();return true;}
      for(let i=0;i<count;i++){const at=(this.total+i)%this.capacity;this.ring[at]=left?.[i+first]||0;this.ring[this.capacity+at]=right?.[i+first]||0;}
      this.total+=count;Atomics.store(this.state,0,this.total);
    }else for(let i=0;i<count&&this.active;i++){
      this.chunk[0][this.count]=left?.[i+first]||0;this.chunk[1][this.count]=right?.[i+first]||0;
      this.count++;this.total++;if(this.count===8192)this.flush();
    }
    if(this.total>=this.limit)this.finish();
    return true;
  }
}
registerProcessor('magnetic-capture',CaptureProcessor);
