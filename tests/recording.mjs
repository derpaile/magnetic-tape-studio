import {chromium} from 'playwright';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=process.env.TEST_URL||'http://localhost:4173';
await mkdir('test-results',{recursive:true});
function wav(seconds,frequency){const sr=48000,n=sr*seconds,b=Buffer.alloc(44+n*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(sr,24);b.writeUInt32LE(sr*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(n*2,40);for(let i=0;i<n;i++)b.writeInt16LE(Math.round(Math.sin(i/sr*2*Math.PI*frequency)*12000),44+i*2);return b;}
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
const results=[];
try{for(const fallback of [false,true]){
  const context=await browser.newContext({acceptDownloads:true,viewport:{width:1440,height:900}});
  await context.addInitScript(({fallback})=>{
    if(fallback)Object.defineProperty(window,'crossOriginIsolated',{value:false});
    window.__trackSources=[];window.__wavJobs=0;
    const create=AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createBufferSource=function(...args){const node=create.apply(this,args);window.__trackSources.push(node);return node;};
    const NativeWorker=Worker;
    window.Worker=class extends NativeWorker{
      constructor(url,options){
        const isRecorder=String(url).includes('recorder-worker.js');
        if(isRecorder){const script=`importScripts(${JSON.stringify(new URL(url,location.href).href)});const handler=self.onmessage;self.onmessage=e=>{if(e.data.stall){const until=performance.now()+e.data.stall;while(performance.now()<until){Math.sqrt(Math.random());}}else handler(e);};`;url=URL.createObjectURL(new Blob([script],{type:'text/javascript'}));}
        super(url,options);
        if(isRecorder)window.__recorder=this;
        if(String(url).includes('wav-worker.js'))window.__wavJobs++;
      }
    };
  },{fallback});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const mode=fallback?'recycled-port':'shared-ring';
  await page.goto(base);await page.getByText('Saved on this device',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>crossOriginIsolated),!fallback,'Shared memory is available on the production preview');
  await page.getByLabel('Import audio files',{exact:true}).setInputFiles({name:'Continuous tone.wav',mimeType:'audio/wav',buffer:wav(4,220)});
  await page.getByRole('button',{name:'Select track 1: Continuous tone',exact:true}).waitFor();
  await page.getByRole('button',{name:'Loop track 1',exact:true}).click();
  await page.getByRole('switch',{name:'Echo circuit',exact:true}).click();
  await page.getByRole('button',{name:'Play tape',exact:true}).click();await page.waitForTimeout(500);
  await page.evaluate(()=>window.__originalTrackSource=window.__trackSources.at(-1));
  await page.getByRole('button',{name:'Record master',exact:true}).click();await page.waitForTimeout(400);
  assert(await page.locator('.capture-frame.active').isVisible());
  assert.equal(await page.locator('.capture-frame').evaluate(el=>getComputedStyle(el).pointerEvents),'none');
  await page.getByRole('button',{name:'Mute track 4',exact:true}).click();await page.getByRole('button',{name:'Select track 4: Empty tape',exact:true}).click();
  await page.evaluate(()=>window.__recorder.postMessage({stall:2000}));
  await page.getByLabel('Import audio files',{exact:true}).setInputFiles({name:'Long load.wav',mimeType:'audio/wav',buffer:wav(179,440)});
  await page.getByRole('button',{name:'Select track 4: Long load',exact:true}).waitFor();
  assert(await page.evaluate(()=>window.__trackSources.filter(n=>n.loopEnd===4).length===1),'The sounding own-loop source was not restarted');
  await page.evaluate(()=>{const until=performance.now()+1500;while(performance.now()<until){Math.sqrt(Math.random());}});
  await page.waitForTimeout(500);
  assert.equal(await page.evaluate(()=>window.__wavJobs),0,'No WAV encoding happens during capture');
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>scrollTo(0,1100));
  const quick=page.getByRole('button',{name:'Save master from quick controls',exact:true}),rect=await quick.boundingBox();
  assert(rect&&rect.y>=0&&rect.y+rect.height<=844,'Master stop is reachable while scrolled on mobile');
  await page.screenshot({path:`test-results/recording-mobile-${mode}.png`});
  await quick.click();
  await page.getByRole('button',{name:'Export latest take as WAV',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.__wavJobs),0,'Stopping stores raw PCM without conversion');
  assert.equal(await page.locator('.capture-frame.active').count(),0);
  const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Export latest take as WAV',exact:true}).click();
  const path=`test-results/continuous-recording-${mode}.wav`;await (await pending).saveAs(path);
  assert.equal(await page.evaluate(()=>window.__wavJobs),1,'Export launches its own encoder');
  await page.getByRole('button',{name:'Pause playback',exact:true}).click();
  const bytes=await readFile(path),frames=(bytes.length-44)/4,sr=bytes.readUInt32LE(24),windowSize=Math.round(sr*.02);
  assert.equal(bytes.readUInt32LE(40),frames*4);assert.equal(bytes.readUInt16LE(22),2);
  let minRms=Infinity,maxStep=0,previous=bytes.readInt16LE(44)/32768;
  for(let start=0;start+windowSize<frames;start+=windowSize){let sum=0;for(let i=start;i<start+windowSize;i++){const sample=bytes.readInt16LE(44+i*4)/32768;sum+=sample*sample;maxStep=Math.max(maxStep,Math.abs(sample-previous));previous=sample;}minRms=Math.min(minRms,Math.sqrt(sum/windowSize));}
  assert(frames/sr>2);assert(minRms>.09,`No silent or dropped 20 ms windows: minimum RMS ${minRms}`);assert(maxStep<.025,`No discontinuities: maximum step ${maxStep}`);assert.deepEqual(errors,[]);
  await page.getByText('Saved on this device',{exact:true}).waitFor();await page.reload();await page.getByText('Saved on this device',{exact:true}).waitFor();
  const again=page.waitForEvent('download');await page.getByRole('button',{name:'Export latest take as WAV',exact:true}).click();await(await again).saveAs(`test-results/restored-${mode}.wav`);
  assert.deepEqual(await readFile(`test-results/restored-${mode}.wav`),bytes,'Reloaded raw PCM exports to identical WAV bytes');
  const result={mode,duration:frames/sr,sampleRate:sr,minimum20msRms:minRms,maximumSampleStep:maxStep};results.push(result);
  console.log(`PASS ${mode}: 179-second import, 2-second recorder stall, 1.5-second UI stall, mobile stop, deferred export and identical reload: ${JSON.stringify(result)}`);
  await context.close();
}
await writeFile('test-results/recording-stress.json',JSON.stringify(results,null,2));
}finally{await browser.close();}
