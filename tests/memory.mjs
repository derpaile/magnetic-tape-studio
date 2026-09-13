import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const processors={};
vm.runInNewContext(readFileSync('public/audio/tape-processor.js','utf8'),{sampleRate:48000,Float32Array,Math,AudioWorkletProcessor:class{constructor(){this.port={postMessage(){}};}},registerProcessor:(name,p)=>processors[name]=p});
const Tape=processors['magnetic-tape'];
const params=()=>Object.fromEntries(Tape.parameterDescriptors.map(p=>[p.name,new Float32Array([p.defaultValue])]));
const energy=a=>a.reduce((n,v)=>n+v*v,0);
function block(proc,p,b,signal=true){const input=[new Float32Array(128),new Float32Array(128)],out=[new Float32Array(128),new Float32Array(128)];if(signal)for(let i=0;i<128;i++)input[0][i]=input[1][i]=Math.sin((b*128+i)*Math.PI*440/48000)*.3;proc.process([input,input],[out],p);assert(out.every(c=>c.every(v=>Number.isFinite(v)&&Math.abs(v)<2)));return out;}
const tape=new Tape(),p=params();p.hiss[0]=p.crinkle[0]=p.wow[0]=p.flutter[0]=0;
for(let b=0;b<900;b++)block(tape,p,b);
tape.port.onmessage({data:{cloudHold:true}});const heldPosition=tape.cloud.pos,heldSamples=tape.cloud.memory[0].slice();p.dissolve[0]=1;p.return[0]=.7;
let tail=0;for(let b=0;b<1400;b++){const out=block(tape,p,b,false);if(b>900)tail+=energy(out[0]);}
assert(tail>1,'Frozen granular cloud remains audible after the live input stops');assert.equal(tape.cloud.pos,heldPosition);assert.deepEqual(tape.cloud.memory[0],heldSamples);assert(energy(tape.tape[0])>.01,'Cloud return writes material back to the tape');
tape.port.onmessage({data:{cloudHold:false}});block(tape,p,0);assert.notEqual(tape.cloud.pos,heldPosition);
tape.port.onmessage({data:{motion:'record'}});for(let b=0;b<250;b++){p.scatter[0]=b/250;block(tape,p,b);}tape.port.onmessage({data:{motion:'play'}});const length=tape.cloud.motionFrames;assert(length>10);for(let b=0;b<500;b++)block(tape,p,b);assert.equal(tape.cloud.motion,'play');assert.equal(tape.cloud.motionFrames,length);assert(tape.cloud.values[3]<.99);
tape.port.onmessage({data:{clear:true}});assert.equal(tape.cloud.filled,0);assert.equal(tape.cloud.motion,'idle');assert(!tape.cloud.hold);assert(tape.cloud.voices.every(v=>v.length===0));
console.log('PASS Audible frozen cloud, tape return, release, sample-clock motion and panic');

// Independent head impulse arrival, independent of the legacy 1×/2×/3× ratios.
for(let head=0;head<3;head++){
  const proc=new Tape(),q=params(),times=[.12,.37,.81];proc.heads=[0,0,0];proc.heads[head]=1;proc.headLevels=[...proc.heads];proc.delays=times.map(t=>t*48000);
  q.time[0]=times[0];q.head2[0]=times[1];q.head3[0]=times[2];q.mix[0]=1;q.feedback[0]=q.wow[0]=q.flutter[0]=q.crinkle[0]=q.hiss[0]=0;
  let max=0,at=0;for(let b=0;b<340;b++){const input=[new Float32Array(128),new Float32Array(128)],out=[new Float32Array(128),new Float32Array(128)];if(b===0)input[0][0]=input[1][0]=.5;proc.process([input,input],[out],q);for(let i=0;i<128;i++)if(Math.abs(out[0][i])>max){max=Math.abs(out[0][i]);at=b*128+i;}}
  assert(Math.abs(at-times[head]*48000)<2);assert(max>.05);
}
console.log('PASS Three independently timed audio impulses arrive at 120 / 370 / 810 ms');

const Capture=processors['magnetic-capture'],cap=new Capture({processorOptions:{maxSeconds:1800}}),messages=[];
cap.port.postMessage=m=>messages.push(m);cap.port.onmessage({data:'start'});assert.equal(cap.limit,48000*1800);cap.total=cap.limit-61;
cap.process([[new Float32Array(128).fill(.25)]],[[new Float32Array(128),new Float32Array(128)]]);
assert(!cap.active);assert.equal(messages.at(-1).frames,48000*1800);assert(messages.at(-1).limited);assert.equal(messages.find(m=>m.type==='chunk').frames,61);
cap.port.onmessage({data:'stop'});assert.equal(messages.filter(m=>m.type==='done').length,1,'An explicit stop after auto-stop cannot duplicate the take');
cap.port.onmessage({data:'start'});assert.equal(cap.total,0);assert(cap.active);
console.log('PASS Exact 30-minute sample boundary, partial final block, one acknowledgement and fresh restart');

const workerMessages=[],returned=[],source={postMessage:m=>returned.push(m)},self={postMessage:m=>workerMessages.push(m)};
vm.runInNewContext(readFileSync('public/audio/recorder-worker.js','utf8'),{self,Blob,Float32Array,ArrayBuffer,DataView,Math,clearInterval,setInterval});
self.onmessage({data:{source,sampleRate:48000}});source.onmessage({data:{type:'started'}});
source.onmessage({data:{type:'chunk',left:new Float32Array([.5,-.5,1,1]),right:new Float32Array([-.25,.25,1,1]),frames:2}});
source.onmessage({data:{type:'done',frames:2,limited:false}});
const take=workerMessages.find(m=>m.type==='take');
assert.equal(take.blob.size,16);assert.equal(take.blob.type,'application/x-magnetic-pcm');assert.equal(returned.length,1);
const exported=[],encoder={postMessage:m=>exported.push(m)};
vm.runInNewContext(readFileSync('public/audio/wav-worker.js','utf8'),{self:encoder,Blob,ArrayBuffer,DataView,Float32Array,Math});
await encoder.onmessage({data:take});
const bytes=Buffer.from(await exported[0].blob.arrayBuffer());
assert.equal(bytes.length,52);assert.equal(bytes.readUInt32LE(40),8);assert.equal(bytes.readUInt32LE(24),48000);assert.equal(bytes.readInt16LE(44),16383);assert.equal(bytes.readInt16LE(46),-8192);assert.equal(bytes.readInt16LE(48),-16384);
source.onmessage({data:{type:'started'}});source.onmessage({data:{type:'done',frames:0}});assert.equal(workerMessages.at(-1).blob.size,0,'Next take does not retain previous audio');
console.log('PASS Raw stereo capture, on-demand WAV, partial lengths and recycled buffers');

// The shared ring is sample-exact across wraps, including a stalled consumer.
const shared={state:new SharedArrayBuffer(16),audio:new SharedArrayBuffer(32768*2*4)},state=new Int32Array(shared.state);
const captured=[],ringSource={postMessage(){}},ringWorker={postMessage:m=>captured.push(m)};
let poll;
vm.runInNewContext(readFileSync('public/audio/recorder-worker.js','utf8'),{self:ringWorker,Blob,Float32Array,Int32Array,Atomics,setInterval:fn=>{poll=fn;return 1;},clearInterval(){}});
ringWorker.onmessage({data:{source:ringSource,sampleRate:48000,shared}});
const ringCap=new Capture({processorOptions:{maxSeconds:1800}});
ringCap.port.onmessage({data:{shared}});
ringCap.port.onmessage({data:{sink:{postMessage:m=>ringSource.onmessage({data:m})}}});
ringCap.port.onmessage({data:'start'});
let total=0;
for(let pass=0;pass<9;pass++){
  for(let block=0;block<187;block++){
    const left=Float32Array.from({length:128},(_,i)=>Math.sin((total+i)*.013)*.6),right=Float32Array.from(left,x=>-x);
    ringCap.process([[left,right]],[[new Float32Array(128),new Float32Array(128)]]);total+=128;
  }
  poll();
}
ringCap.port.onmessage({data:'stop'});
const ringTake=captured.find(m=>m.type==='take');assert.equal(ringTake.pcm.frames,total);assert(!ringTake.interrupted);
await encoder.onmessage({data:ringTake});const rendered=Buffer.from(await exported.at(-1).blob.arrayBuffer());
for(let i=0;i<total;i++){const expected=Math.sin(i*.013)*.6;assert(Math.abs(rendered.readInt16LE(44+i*4)/32768-expected)<.00006);assert(Math.abs((rendered.readInt16LE(44+i*4)+rendered.readInt16LE(46+i*4))/32768)<.00006);}
ringCap.port.onmessage({data:'start'});
for(let i=0;i<258;i++)ringCap.process([[new Float32Array(128).fill(.25)]],[[new Float32Array(128),new Float32Array(128)]]);
assert(!ringCap.active);assert(captured.at(-1).interrupted);assert.equal(captured.at(-1).frames,32768,'Overflow stops before overwriting captured audio');
ringCap.port.onmessage({data:'start'});assert.equal(state[0],0);assert.equal(state[1],0);ringCap.port.onmessage({data:'stop'});
await encoder.onmessage({data:{blob:new Blob([]),pcm:{frames:2,sampleRate:48000,chunkFrames:8192}}});assert(exported.at(-1).error);
console.log('PASS Shared-ring wrap, stalled consumer, exact export, safe overflow, restart and corrupt-take detection');
