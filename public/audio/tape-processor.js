/* Two-input stereo tape machine: dry tape bus + independent echo sends. */
class TapeProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return Object.entries({time:[.22,.04,1.5],feedback:[.43,0,1.08],mix:[.35,0,1],age:[.4,0,1],wow:[.35,0,1],flutter:[.2,0,1],drive:[.38,0,1],tone:[.55,0,1],hiss:[.08,0,1],crinkle:[.12,0,1],lowCut:[120,20,1200],spread:[.45,0,1],enabled:[1,0,1]}).map(([name,[defaultValue,minValue,maxValue]])=>({name,defaultValue,minValue,maxValue,automationRate:'k-rate'}));
  }
  constructor() {
    super();this.size=Math.ceil(sampleRate*4.6);this.tape=[new Float32Array(this.size),new Float32Array(this.size)];
    this.held=[new Float32Array(this.size),new Float32Array(this.size)];this.heldLength=2;this.heldPos=0;this.hold=false;this.holdMix=0;this.inputCut=false;this.swell=false;this.feed=1;
    this.drySize=Math.ceil(sampleRate*.03);this.dryTape=[new Float32Array(this.drySize),new Float32Array(this.drySize)];this.dryPos=0;this.dryLP=[0,0];
    this.pos=0;this.phase=0;this.delay=.22*sampleRate;this.lp=[0,0];this.dc=[0,0];this.last=[0,0];this.env=0;this.dust=0;this.dustTarget=0;this.dustClock=0;this.seed=7841;
    this.heads=[1,0,1];this.headLevels=[1,0,1];this.wet=[0,0];this.returned=[0,0];
    this.port.onmessage=({data})=>{
      if(data.heads)this.heads=data.heads;
      if(data.hold&&!this.hold){
        this.heldLength=Math.min(this.size-2,Math.max(2,Math.round(this.delay*(this.heads[2]?3:this.heads[1]?2:1))));this.heldPos=0;
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
  read(buffer,position,size){const r=(position+size*2)%size,a=Math.floor(r),f=r-a;return buffer[a]*(1-f)+buffer[(a+1)%size]*f;}
  process(inputs,outputs,p){
    const out=outputs[0],input=inputs[0]||[],send=inputs.length>1?inputs[1]:input;
    const enabled=p.enabled[0],mix=p.mix[0]*enabled,drive=1+p.drive[0]*4.5;
    const cutoff=900+p.tone[0]*11500*(1-p.age[0]*.86),alpha=1-Math.exp(-2*Math.PI*cutoff/sampleRate);
    const dryAlpha=1-Math.exp(-2*Math.PI*(14000-p.age[0]*10000)/sampleRate),hpCoeff=Math.exp(-2*Math.PI*p.lowCut[0]/sampleRate);
    const target=p.time[0]*sampleRate,feedback=this.swell?1.065:p.feedback[0],spread=p.spread[0];
    const slew=1-Math.exp(-1/(sampleRate*.16)),smooth=1-Math.exp(-1/(sampleRate*.015));
    const dryLevel=Math.cos(mix*Math.PI/2),wetLevel=Math.sin(mix*Math.PI/2);
    for(let i=0;i<out[0].length;i++){
      this.delay+=(target-this.delay)*slew;this.phase+=1/sampleRate;
      if(--this.dustClock<=0){this.dustTarget=Math.max(0,this.random()-.35);this.dustClock=sampleRate*(.03+(this.random()+1)*.08);}
      this.dust+=(this.dustTarget-this.dust)*.001;
      const wow=Math.sin(this.phase*2*Math.PI*.63)+.32*Math.sin(this.phase*2*Math.PI*.17);
      const flutter=Math.sin(this.phase*2*Math.PI*7.13)+.3*Math.sin(this.phase*2*Math.PI*13.7);
      const movement=(wow*.0025*p.wow[0]+flutter*.00045*p.flutter[0]+this.dust*.003*p.crinkle[0])*sampleRate;
      const wear=1-this.dust*p.crinkle[0]*1.1;
      this.holdMix+=((this.hold?1:0)-this.holdMix)*smooth;
      this.feed+=((this.inputCut||this.hold?0:1)-this.feed)*smooth;
      let total=0;for(let h=0;h<3;h++){this.headLevels[h]+=(this.heads[h]-this.headLevels[h])*smooth;total+=this.headLevels[h];}total=Math.max(1,total);
      for(let c=0;c<2;c++){
        let wet=0,returned=0;
        for(let h=0;h<3;h++){
          const delay=Math.max(2,this.delay*(h+1)+movement*(h+1)),tap=this.read(this.tape[c],this.pos-delay,this.size)*this.headLevels[h];
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
        const written=sent*.7*this.feed+hp*feedback+held*this.holdMix*.12;
        this.tape[c][this.pos]=Math.tanh(written*drive)/drive*wear+noise*.3;
        this.dryTape[c][this.dryPos]=dry;
        const magnetic=this.read(this.dryTape[c],this.dryPos-sampleRate*.006-movement,this.drySize);
        const bias=p.drive[0]*.12;
        const saturated=(Math.tanh(magnetic*drive+bias)-Math.tanh(bias))/drive;
        this.dryLP[c]+=dryAlpha*(saturated-this.dryLP[c]);
        const tapeDry=(this.dryLP[c]*.8+magnetic*.2)*wear+noise;
        const wet=this.wet[c]*(1-this.holdMix)+held*this.holdMix;
        out[c][i]=(dry*(1-enabled)+tapeDry*enabled)*dryLevel+wet*wetLevel;
      }
      this.pos=(this.pos+1)%this.size;this.dryPos=(this.dryPos+1)%this.drySize;this.heldPos=(this.heldPos+1)%this.heldLength;
    }return true;
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

/* Capture uncompressed stereo PCM, with an acknowledged stop and bounded duration. */
class CaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super(); this.active = false; this.count = 0; this.total = 0;
    this.chunk = [new Float32Array(8192), new Float32Array(8192)];
    this.port.onmessage = ({data}) => {
      if (data === 'start') { this.count = 0; this.total = 0; this.active = true; }
      if (data === 'stop') this.finish();
    };
  }
  flush() {
    if (!this.count) return;
    const left = this.chunk[0].slice(0, this.count), right = this.chunk[1].slice(0, this.count);
    this.port.postMessage({ type: 'chunk', left, right }, [left.buffer, right.buffer]);
    this.count = 0;
  }
  finish() { if (!this.active) return; this.active = false; this.flush(); this.port.postMessage({type:'done', frames:this.total}); }
  process(inputs, outputs) {
    const input = inputs[0], output = outputs[0];
    for (let c = 0; c < output.length; c++) if (input[c] || input[0]) output[c].set(input[c] || input[0]);
    if (this.active) for (let i = 0; i < output[0].length; i++) {
      this.chunk[0][this.count] = input[0]?.[i] || 0;
      this.chunk[1][this.count] = input[1]?.[i] ?? input[0]?.[i] ?? 0;
      this.count++; this.total++;
      if (this.count === 8192) this.flush();
      if (this.total >= sampleRate * 600) { this.finish(); break; }
    }
    return true;
  }
}
registerProcessor('magnetic-capture', CaptureProcessor);
