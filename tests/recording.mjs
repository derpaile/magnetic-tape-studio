import {chromium} from 'playwright';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=process.env.TEST_URL||'http://localhost:4173';
await mkdir('test-results',{recursive:true});
function wav(seconds,frequency){const sr=48000,n=sr*seconds,b=Buffer.alloc(44+n*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(sr,24);b.writeUInt32LE(sr*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(n*2,40);for(let i=0;i<n;i++)b.writeInt16LE(Math.round(Math.sin(i/sr*2*Math.PI*frequency)*12000),44+i*2);return b;}
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
const context=await browser.newContext({acceptDownloads:true});
await context.addInitScript(()=>{window.__trackSources=[];const create=AudioContext.prototype.createBufferSource;AudioContext.prototype.createBufferSource=function(...args){const node=create.apply(this,args);window.__trackSources.push(node);return node;};});
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
  await page.goto(base);await page.getByText('Saved on this device',{exact:true}).waitFor();
  await page.getByLabel('Import audio files',{exact:true}).setInputFiles({name:'Continuous tone.wav',mimeType:'audio/wav',buffer:wav(4,220)});
  await page.getByRole('button',{name:'Select track 1: Continuous tone',exact:true}).waitFor();
  await page.getByRole('button',{name:'Loop track 1',exact:true}).click();
  await page.getByRole('switch',{name:'Echo circuit',exact:true}).click();
  await page.getByRole('button',{name:'Play tape',exact:true}).click();await page.waitForTimeout(500);
  await page.evaluate(()=>window.__originalTrackSource=window.__trackSources.at(-1));
  await page.getByRole('button',{name:'Record master',exact:true}).click();await page.waitForTimeout(400);
  await page.getByRole('button',{name:'Mute track 4',exact:true}).click();await page.getByRole('button',{name:'Select track 4: Empty tape',exact:true}).click();
  await page.getByLabel('Import audio files',{exact:true}).setInputFiles({name:'Ninety second load.wav',mimeType:'audio/wav',buffer:wav(90,440)});
  await page.getByRole('button',{name:'Select track 4: Ninety second load',exact:true}).waitFor();
  assert(await page.evaluate(()=>window.__trackSources.filter(n=>n.loopEnd===4).length===1),'The sounding own-loop source was not restarted');
  // Stop the UI thread for half a second while the audio clock keeps recording.
  await page.evaluate(()=>{const until=performance.now()+500;while(performance.now()<until){Math.sqrt(Math.random());}});
  await page.waitForTimeout(400);await page.getByRole('button',{name:'Stop & save take',exact:true}).click();
  await page.getByRole('button',{name:'Export latest take as WAV',exact:true}).waitFor();
  const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Export latest take as WAV',exact:true}).click();await (await pending).saveAs('test-results/continuous-recording.wav');
  await page.getByRole('button',{name:'Pause playback',exact:true}).click();
  const bytes=await readFile('test-results/continuous-recording.wav'),frames=(bytes.length-44)/4,sr=bytes.readUInt32LE(24),window=Math.round(sr*.02);
  let minRms=Infinity,maxStep=0,previous=bytes.readInt16LE(44)/32768;
  for(let start=0;start+window<frames;start+=window){let sum=0;for(let i=start;i<start+window;i++){const sample=bytes.readInt16LE(44+i*4)/32768;sum+=sample*sample;maxStep=Math.max(maxStep,Math.abs(sample-previous));previous=sample;}minRms=Math.min(minRms,Math.sqrt(sum/window));}
  assert(frames/sr>1.2);assert(minRms>.09,`No silent or dropped 20 ms windows: minimum RMS ${minRms}`);assert(maxStep<.025,`No discontinuities in the continuous tone: maximum step ${maxStep}`);assert.deepEqual(errors,[]);
  const result={duration:frames/sr,sampleRate:sr,minimum20msRms:minRms,maximumSampleStep:maxStep};await writeFile('test-results/recording-stress.json',JSON.stringify(result,null,2));
  console.log(`PASS Master stays continuous through a 90-second sample load and a 500 ms UI stall: ${JSON.stringify(result)}`);
}finally{await browser.close();}
