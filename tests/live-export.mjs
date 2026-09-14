import {chromium} from 'playwright';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const base=process.env.TEST_URL||'http://localhost:4173';
await mkdir('test-results',{recursive:true});
const sr=48000,n=sr*3,wav=Buffer.alloc(44+n*4);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(2,22);wav.writeUInt32LE(sr,24);wav.writeUInt32LE(sr*4,28);wav.writeUInt16LE(4,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(n*4,40);for(let i=0;i<n;i++){wav.writeInt16LE(Math.sin(i/sr*Math.PI*880)*9000,44+i*4);wav.writeInt16LE(Math.sin(i/sr*Math.PI*1320)*7000,46+i*4);}const fixture=resolve('test-results/live-input.wav');await writeFile(fixture,wav);
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',`--use-file-for-fake-audio-capture=${fixture}`,'--autoplay-policy=no-user-gesture-required']});
const context=await browser.newContext({viewport:{width:1440,height:900},permissions:['microphone'],acceptDownloads:true});
await context.addInitScript(()=>{
 window.__analysers=[];const create=AudioContext.prototype.createAnalyser;AudioContext.prototype.createAnalyser=function(){const node=create.call(this);window.__analysers.push(node);return node;};
 window.__streams=[];const get=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=async c=>{const stream=await get(c);window.__streams.push(stream);return stream;};
});
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
const rms=()=>page.evaluate(()=>{const a=new Float32Array(8192);window.__analysers[0].getFloatTimeDomainData(a);return Math.sqrt(a.reduce((n,x)=>n+x*x,0)/a.length);});
const button=name=>page.getByRole('button',{name,exact:true});
const exportFile=async(format,path)=>{await button('Export latest take').click();await page.getByLabel('Export format',{exact:true}).selectOption(format);const download=page.waitForEvent('download',{timeout:120000});await button('Download file').click();await(await download).saveAs(path);};
try{
 await page.goto(base);await page.getByText('Saved on this device',{exact:true}).waitFor();
 await page.getByLabel('Selected track input source',{exact:true}).selectOption('mic');await page.getByLabel('Live microphone waveform',{exact:true}).waitFor();
 await page.getByRole('switch',{name:'All effects',exact:true}).click();await page.waitForTimeout(500);assert((await rms())<.0001,'Live input is silent before monitoring');
 await button('Monitor microphone').click();await page.waitForTimeout(500);assert((await rms())>.025,'Live monitoring works without recording or transport');
 await button('Mute track 1').click();await page.waitForTimeout(500);assert((await rms())<.0001,'Mic follows lane mute');await button('Mute track 1').click();
 await button('Solo track 2').click();await page.waitForTimeout(500);assert((await rms())<.0001,'Mic follows another lane solo');await button('Solo track 2').click();
 await page.getByLabel('Track 1 volume',{exact:true}).fill('0');await page.waitForTimeout(500);assert((await rms())<.0001,'Mic follows lane level');await page.getByLabel('Track 1 volume',{exact:true}).fill('0.8');
 await button('Select track 2: Empty tape').click();await button('Mute track 2').click();await page.waitForTimeout(500);assert((await rms())>.025,'Selecting a different lane leaves the live assignment on lane 1');await button('Mute track 2').click();await button('Select track 1: Empty tape').click();
 await page.getByLabel('Microphone input settings',{exact:true}).click();await page.getByLabel('Microphone channel',{exact:true}).selectOption('left');await page.getByLabel('Microphone input gain',{exact:true}).fill('-6');const device=await page.getByLabel('Microphone device',{exact:true}).locator('option').evaluateAll(options=>options.find(o=>o.value)?.value);if(device){await page.getByLabel('Microphone device',{exact:true}).selectOption(device);await page.waitForFunction(()=>window.__streams.length>1);assert(await page.evaluate(()=>window.__streams[0].getAudioTracks()[0].readyState==='ended'));}await page.getByLabel('Four-beat microphone count-in',{exact:true}).check();
 await page.getByLabel('Microphone input settings',{exact:true}).click();
 const bandSize=await page.locator('.machine-display').boundingBox();await button('Spectrum').click();await page.waitForTimeout(600);
 const spectrumSize=await page.locator('.machine-display').boundingBox();assert(Math.abs(bandSize.height-spectrumSize.height)<=1,`Analysis uses the same reel area: ${bandSize.height} / ${spectrumSize.height}`);
 await page.getByLabel('Spectrum signal source',{exact:true}).selectOption('input');await page.waitForTimeout(500);
 assert(await page.locator('.analysis-window canvas').evaluate(c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data.some(v=>v>100)));
 await button('Listen to level-matched original').click();assert.equal(await button('Listen to level-matched original').getAttribute('aria-pressed'),'true');await button('Listen to level-matched original').click();await button('Reference').click();await button('Clear ref').waitFor();await button('Freeze').click();await button('Resume').waitFor();await button('Resume').click();await button('History').click();await page.waitForTimeout(600);await page.screenshot({path:'test-results/live-spectrum-desktop.png',fullPage:true});
 for(const width of [390,320,768]){await page.setViewportSize({width,height:844});await page.screenshot({path:`test-results/live-spectrum-${width}.png`,fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`No overflow at ${width}`);}
 await page.setViewportSize({width:1440,height:900});
 await button('Record microphone to selected track').click();await button('Stop microphone recording').waitFor();assert(await page.locator('.recording-wave').innerText().then(t=>t.includes('COUNT')));await page.waitForTimeout(3100);
 await button('Select track 3: Empty tape').click();await button('Stop microphone recording').click();await button('Select track 1: Microphone take').waitFor();
 assert.equal(await button('Select track 3: Empty tape').getAttribute('aria-pressed'),'true','Recording saves to armed lane even after selection changes');
 await button('Record master').click();assert(await button('Listen to level-matched original').isDisabled());await page.waitForTimeout(1200);await button('Stop & save take').click();await button('Export latest take').waitFor();
 await button('Export latest take').click();await page.getByLabel('Export format',{exact:true}).selectOption('flac');let cancelledDownload=false;const downloadListener=()=>{cancelledDownload=true;};page.on('download',downloadListener);await button('Download file').click();await button('Cancel export').click();await page.waitForTimeout(350);page.off('download',downloadListener);assert(!cancelledDownload,'Cancelled export does not download a partial file');await exportFile('wav','test-results/live-export.wav');await exportFile('flac','test-results/live-export.flac');await exportFile('m4a','test-results/live-export.m4a');
 const flac=await readFile('test-results/live-export.flac'),m4a=await readFile('test-results/live-export.m4a');assert.equal(flac.subarray(0,4).toString(),'fLaC');assert.equal(m4a.subarray(4,8).toString(),'ftyp');
 for(const format of ['wav','flac','m4a']){
  const data=await readFile(`test-results/live-export.${format}`);const decoded=await page.evaluate(async bytes=>{const ctx=new OfflineAudioContext(2,1,48000),b=await ctx.decodeAudioData(new Uint8Array(bytes).buffer);return {duration:b.duration,peak:Math.max(...b.getChannelData(0).slice(0,40000).map(Math.abs)),channels:b.numberOfChannels};},Array.from(data));assert(decoded.duration>.8&&decoded.duration<2);assert(decoded.peak>.01);assert.equal(decoded.channels,2);
 }
 await button('Export latest take').click();await page.getByLabel('Export format',{exact:true}).selectOption('m4a');await page.getByLabel('Export start',{exact:true}).fill('0.1');await page.getByLabel('Export end',{exact:true}).fill('0.5');const trimmed=page.waitForEvent('download');await button('Download file').click();await(await trimmed).saveAs('test-results/live-trim.m4a');
 await button('Export latest take').click();assert.equal(await page.getByLabel('Export start',{exact:true}).inputValue(),'0.1');await button('Cancel').click();
 await button('Open recorded takes').click();await page.getByLabel('Rename Take 01',{exact:true}).fill('Live room');await page.getByLabel('Rename Take 01',{exact:true}).press('Enter');await button('Close dialog').click();
 await button('Record master').click();await page.waitForTimeout(350);await button('Finish with effect tail').click();await button('Record master').waitFor({timeout:10000});await page.waitForTimeout(350);assert((await rms())>.01,'Monitoring returns after automatic tail save');
 // Disconnect notification retains saved takes and stops live input.
 await page.evaluate(()=>{const track=window.__streams.at(-1).getAudioTracks()[0];track.stop();track.dispatchEvent(new Event('ended'));});await page.getByRole('status').filter({hasText:'disconnected'}).waitFor();
 await page.getByText('Saved on this device',{exact:true}).waitFor();await page.reload();await page.getByText('Saved on this device',{exact:true}).waitFor();assert.equal(await page.getByLabel('Selected track input source',{exact:true}).inputValue(),'tape');
 await page.getByLabel('Microphone input settings',{exact:true}).click();assert.equal(await page.getByLabel('Microphone channel',{exact:true}).inputValue(),'left');assert.equal(await page.getByLabel('Microphone input gain',{exact:true}).inputValue(),'-6');await page.getByLabel('Microphone input settings',{exact:true}).click();
 await page.waitForFunction(()=>navigator.serviceWorker.controller);await context.setOffline(true);await page.reload();await page.getByText('Saved on this device',{exact:true}).waitFor();await exportFile('m4a','test-results/live-offline.m4a');
 assert.deepEqual(errors,[]);console.log('PASS Independent live mic, lane routing, count-in, target lock, analysis, responsive layout, actual WAV/FLAC/AAC decoding, trimming, rename, disconnect, saved settings and offline M4A');
}catch(error){await page.screenshot({path:'test-results/live-failure.png',fullPage:true}).catch(()=>{});console.error('Live browser errors:',errors);console.error(await page.locator('body').innerText().then(t=>t.slice(-2000)));throw error;}finally{await browser.close();}
