import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const messages=[],scope={Blob,Float32Array,ArrayBuffer,DataView,Math,Number,Error,self:{postMessage:m=>messages.push(m)}};
vm.runInNewContext(readFileSync('public/audio/export-worker.js','utf8'),scope);
const frames=8192*19+127,sr=48000,parts=[];
const sample=(i,c)=>Math.sin(i*.021+c)*.7;
for(let at=0;at<frames;at+=8192){const n=Math.min(8192,frames-at),chunk=new Float32Array(n*2);for(let c=0;c<2;c++)for(let i=0;i<n;i++)chunk[c*n+i]=sample(at+i,c);parts.push(chunk);}
const take={blob:new Blob(parts),pcm:{frames,sampleRate:sr,chunkFrames:8192}};
for(const bits of [16,24,32]){
 messages.length=0;const from=8192-37,to=frames-91;
 await scope.self.onmessage({data:{...take,start:from/sr,end:to/sr,bits}});
 assert(!messages.at(-1).error,messages.at(-1).error);const bytes=Buffer.from(await messages.at(-1).blob.arrayBuffer()),stride=bits/8;
 assert.equal(bytes.readUInt32LE(40),(to-from)*2*stride);assert.equal(bytes.readUInt16LE(34),bits);
 for(let i=0;i<to-from;i++)for(let c=0;c<2;c++){const offset=44+(i*2+c)*stride,value=bits===32?bytes.readFloatLE(offset):bytes.readIntLE(offset,stride)/2**(bits-1);assert(Math.abs(value-sample(from+i,c))< (bits===16?.00006:.000001),`Exact channel/frame at ${i}/${c}, ${bits} bits`);}
 assert(messages.some(m=>m.progress===1));
}
messages.length=0;await scope.self.onmessage({data:{...take,start:1,end:1}});assert(messages.at(-1).error);
messages.length=0;await scope.self.onmessage({data:{...take,blob:new Blob([])}});assert(messages.at(-1).error);
// Existing 16-bit WAVs are returned unchanged, and cropped ranges keep both channels.
messages.length=0;await scope.self.onmessage({data:{...take,bits:16}});const legacy=messages.at(-1).blob;
messages.length=0;await scope.self.onmessage({data:{blob:legacy,bits:16}});assert.deepEqual(Buffer.from(await messages.at(-1).blob.arrayBuffer()),Buffer.from(await legacy.arrayBuffer()));
messages.length=0;await scope.self.onmessage({data:{blob:legacy,start:.1,end:.2,bits:24}});assert.equal(messages.at(-1).blob.size,44+4800*6);
console.log('PASS 16/24/float WAV export, channel ordering, cross-chunk trims, legacy bytes, progress and invalid ranges');
const processors={},clock={sampleRate:48000,currentTime:0,Float32Array,Math,AudioWorkletProcessor:class{constructor(){this.port={postMessage(){}};}},registerProcessor:(n,p)=>processors[n]=p};
vm.runInNewContext(readFileSync('public/audio/tape-processor.js','utf8'),clock);
const cap=new processors['magnetic-capture'](),capture=[];cap.port.postMessage=m=>capture.push(m);cap.port.onmessage({data:{startAt:64/48000}});cap.process([[new Float32Array(128).fill(.4)]],[[new Float32Array(128),new Float32Array(128)]]);cap.port.onmessage({data:'stop'});assert.equal(capture.at(-1).frames,64);assert(capture.find(m=>m.type==='chunk').left.every(v=>Math.abs(v-.4)<1e-6));
console.log('PASS Microphone count-in starts sample-accurately inside an audio block');
