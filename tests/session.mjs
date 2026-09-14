import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
function compile(path,dependencies={}){
 const exports={};
 vm.runInNewContext(ts.transpileModule(readFileSync(path,'utf8').replaceAll('import.meta.url','"file:///src/audio.ts"'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:id=>dependencies[id],Blob,Float32Array,Uint8Array,ArrayBuffer,DataView,TextEncoder,TextDecoder,performance});
 return exports;
}
const audio=compile('src/audio.ts'),files=compile('src/session-file.ts',{'./audio':audio});
const engine=new audio.TapeEngine();
engine.tracks[0].clip=audio.createDemo('Soft keys');engine.tracks[0].mode='loop';engine.tracks[0].loopStart=.3;engine.tracks[0].loopEnd=2.1;engine.tracks[0].pan=-.4;
const frames=8192+157,left=Float32Array.from({length:frames},(_,i)=>Math.sin(i*.1)*.25),right=Float32Array.from(left,v=>-v);
const raw=new Blob([left.subarray(0,8192),right.subarray(0,8192),left.subarray(8192),right.subarray(8192)]);
const legacy=audio.encodeWav([left,right],48000);
const session={tracks:engine.tracks,params:engine.params,heads:engine.heads,takes:[{id:'raw',name:'Stereo master',duration:frames/48000,blob:raw,pcm:{sampleRate:48000,frames,chunkFrames:8192},trimStart:.01,trimEnd:.1},{id:'wav',name:'Older master',duration:frames/48000,blob:legacy}],name:'Portable tape',speed:.7,loop:true,enabled:true,selected:2,preset:'Custom',bpm:123,sync:true,division:'1/4',headTiming:[{time:.42,sync:false,division:'1/8'},{time:.9,sync:true,division:'1/4 D'}],cloud:{...audio.CLOUD_DEFAULTS,dissolve:.3}};
const blob=files.sessionFile(session),restored=await files.readSessionFile(blob);
assert.equal(restored.name,session.name);assert.equal(restored.tracks[0].pan,-.4);assert.equal(restored.tracks[0].loopEnd,2.1);assert.equal(restored.headTiming[1].sync,true);assert.equal(restored.cloud.dissolve,.3);assert.equal(restored.selected,2);
for(let c=0;c<2;c++)assert.deepEqual(restored.tracks[0].clip.channels[c],session.tracks[0].clip.channels[c]);
for(let i=0;i<2;i++)assert.deepEqual(await restored.takes[i].blob.arrayBuffer(),await session.takes[i].blob.arrayBuffer());
assert.equal(restored.takes[0].trimStart,.01);assert.equal(restored.takes[0].trimEnd,.1);
await assert.rejects(()=>files.readSessionFile(blob.slice(0,blob.size-1)),/not a complete/);
await assert.rejects(()=>files.readSessionFile(new Blob(['wrong file'])),/not a complete/);
const malicious=new Uint8Array(await blob.arrayBuffer());new DataView(malicious.buffer).setUint32(8,0xffffffff,true);
await assert.rejects(()=>files.readSessionFile(new Blob([malicious])),/not a complete/);
const corrupt={...session,takes:[{...session.takes[0],pcm:{sampleRate:48000,frames:100,chunkFrames:8192}}]};
await assert.rejects(()=>files.readSessionFile(files.sessionFile(corrupt)),/not a complete/);
console.log('PASS Portable backup preserves exact stereo samples, raw/legacy master bytes, loop/head/cloud settings and trims; rejects truncated and malformed backups');
