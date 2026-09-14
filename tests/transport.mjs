import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
const exported={};
vm.runInNewContext(ts.transpileModule(readFileSync('src/audio.ts','utf8').replaceAll('import.meta.url', '"file:///src/audio.ts"'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{exports:exported,Float32Array,Blob,performance});
const param=()=>({value:1,setValueAtTime(v){this.value=v;},linearRampToValueAtTime(v){this.value=v;},cancelScheduledValues(){},setTargetAtTime(v){this.value=v;}});
let allocations=0;
const ctx={currentTime:0,createBuffer(c,n,sr){allocations++;const channels=Array.from({length:c},()=>new Float32Array(n));return {duration:n/sr,getChannelData:c=>channels[c]};},createGain(){return {gain:param(),connect(){},disconnect(){}};},createBufferSource(){return {playbackRate:param(),connect(){},disconnect(){},start(at,offset){this.at=at;this.offset=offset;},stop(){}};}};
const engine=new exported.TapeEngine();assert(engine.tracks.every(t=>t.clip===null),'New sessions start empty');engine.tracks[0].clip=exported.createDemo('Soft keys');engine.tracks[1].clip=exported.createDemo('Dusty drums');engine.ctx=ctx;engine.init=async()=>{};
engine.tracks[0].mode='loop';engine.tracks[0].loopStart=.2;engine.tracks[0].loopEnd=.9;
engine.tracks[1].mode='loop';engine.tracks[1].loopStart=1;engine.tracks[1].loopEnd=2.1;
engine.loop=false;
await engine.play();
assert.equal(engine.sources[0].node.loopStart,.2);assert.equal(engine.sources[0].node.loopEnd,.9);assert.equal(engine.sources[1].node.loopEnd,2.1);
ctx.currentTime=engine.startedAt+23.7;engine.tick();assert(engine.playing,'Own loops keep transport running beyond longest clip');
assert(Math.abs(engine.trackPosition(0)-(.2+23.7%.7))<1e-7);assert(Math.abs(engine.trackPosition(1)-(1+23.7%1.1))<1e-7);
const before=engine.trackPosition(1);engine.pause();await engine.play();assert(Math.abs(engine.sources[1].node.offset-before)<1e-7,'Pause/resume retains independent phase across global tape boundaries');
const count=allocations;engine.setSpeed(.5);ctx.currentTime+=.04;engine.setSpeed(1);assert.equal(allocations,count,'Speed ramp reuses sample buffers');
engine.brake(true);ctx.currentTime+=.8;assert(Math.abs(engine.motorSpeed-.025)<1e-8);engine.brake(false);assert.equal(engine.speed,1);
engine.pause();engine.seek(0);engine.tracks[0].mode='once';engine.tracks[1].mode='once';await engine.play();assert(!engine.sources[0].node.loop);ctx.currentTime=engine.startedAt+11;engine.tick();assert(!engine.playing,'One shots finish with global loop off');
engine.setLoopBounds(0,.15,.6);assert.equal(engine.tracks[0].mode,'loop');engine.reverse(0);engine.undo();assert(!engine.tracks[0].reversed);assert.equal(engine.tracks[0].loopEnd,.6);engine.undo();assert.equal(engine.tracks[0].mode,'once');
engine.setTempo(120,'1/8 D',true);assert.equal(engine.params.time,.375);engine.setTempo(40,'1/2',true);assert.equal(engine.params.time,1.5);engine.setParam('time',.65);assert(!engine.sync);assert.equal(engine.params.time,.65);
console.log('PASS Independent loop phase, A–B bounds, one shots, speed/brake, undo and tempo conversion');

const looping=new exported.TapeEngine();looping.tracks[0].clip=exported.createDemo('Soft keys');looping.tracks[1].clip=exported.createDemo('Dusty drums');looping.ctx=ctx;looping.init=async()=>{};looping.tracks[0].mode='loop';looping.tracks[0].loopStart=.2;looping.tracks[0].loopEnd=.9;await looping.play();ctx.currentTime=looping.startedAt+23.7;
const phase=looping.trackPosition(0);looping.setClip(2,exported.createDemo('Sub pulse'));assert(Math.abs(looping.trackPosition(0)-phase)<1e-7,'Loading another track preserves independent loop phase after multiple tape laps');
looping.toggleLoop();assert.equal(looping.sources.length,3,'Disabling whole-tape looping lets ordinary tracks finish their current lap');assert(Math.abs(looping.sources[1].node.offset-3.725)<1e-7);assert(Math.abs(looping.trackPosition(0)-phase)<1e-7);
console.log('PASS Imports and global loop changes preserve independent loops and finish the current tape lap');

const h2=engine.headTimes[1];engine.setHeadTime(2,1.23);engine.setHeadTime(0,.18);assert.equal(engine.headTimes[1],h2);assert.equal(engine.headTimes[2],1.23);engine.setHeadSync(1,true,'1/4 D');engine.setTempo(100);assert(Math.abs(engine.headTimes[1]-.9)<1e-10);assert.equal(engine.headTimes[2],1.23);engine.setHeadTime(1,.72);assert.equal(engine.headTiming[0].sync,false);
const existingSource=looping.sources.find(s=>s.index===0).node;const pBefore=looping.trackPosition(0);looping.setClip(3,{name:'Long sample',sampleRate:24000,channels:[new Float32Array(24000*30),new Float32Array(24000*30)]});assert.equal(looping.sources.find(s=>s.index===0).node,existingSource,'Imports leave independent loops running');assert.equal(looping.trackPosition(0),pBefore);looping.setClip(3,null);assert.equal(looping.sources.find(s=>s.index===0).node,existingSource,'Deleting another track leaves independent loops running');
console.log('PASS Independent head times and tempo, empty startup, uninterrupted loops across loading/deleting longer files');

const follower=new exported.TapeEngine();follower.ctx=ctx;follower.init=async()=>{};follower.tracks[0].clip=exported.createDemo('Soft keys');await follower.play();ctx.currentTime=follower.startedAt+23.7;
const originalPhase=follower.trackPosition(0);
follower.setClip(3,{name:'Long import',sampleRate:24000,channels:[new Float32Array(24000*30)]});
assert(Math.abs(follower.trackPosition(0)-originalPhase)<1e-7,'A longer import preserves the current Follow tape phase after multiple laps');
assert(Math.abs(follower.sources[0].node.offset-(originalPhase+.025))<1e-7,'The audible replacement starts at the same tape position');
follower.toggleLoop();assert(Math.abs(follower.trackPosition(0)-originalPhase)<1e-7);
follower.toggleLoop();assert(Math.abs(follower.trackPosition(0)-originalPhase)<1e-7);
follower.undo();assert(Math.abs(follower.trackPosition(0)-originalPhase)<1e-7,'Undo preserves the current lap too');
console.log('PASS Follow tape phase survives reel-length changes, loop toggles and undo after multiple laps');

follower.toggleLoop();ctx.currentTime+=40;const finishedPosition=follower.transportPosition-follower.tapeOrigin;follower.setClip(2,{name:'Long one shot',sampleRate:24000,channels:[new Float32Array(24000*90)]});assert(follower.trackPosition(0)>=10,'Loading with Full tape loop off does not restart finished tape audio');assert(Math.abs(follower.trackPosition(0)-finishedPosition)<1e-7);

const oneShot=new exported.TapeEngine();oneShot.ctx=ctx;oneShot.init=async()=>{};oneShot.tracks[0].clip=exported.createDemo('Soft keys');oneShot.tracks[0].mode='once';
assert(!oneShot.repeats,'Full tape loop does not keep one-shot-only sessions running forever');await oneShot.play();ctx.currentTime=oneShot.startedAt+11;oneShot.tick();assert(!oneShot.playing);
const empty=new exported.TapeEngine();let initialized=false;empty.init=async()=>{initialized=true;};await empty.play();assert(!initialized&&!empty.playing,'Empty playback gives guidance without starting audio');
oneShot.tracks[0].mode='tape';await oneShot.play();oneShot.brake(true);ctx.currentTime+=.4;oneShot.pause();assert(!oneShot.braking);assert.equal(oneShot.motorSpeed,oneShot.speed);await oneShot.play();assert.equal(oneShot.sources[0].node.playbackRate.value,1,'Pause releases the motor brake before the next play');
console.log('PASS Empty tape guidance, one-shot auto-stop with global loop enabled, and brake release across pause/resume');
