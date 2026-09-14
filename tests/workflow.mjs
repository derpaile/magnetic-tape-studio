import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
const button=name=>page.getByRole('button',{name,exact:true});
const saved=()=>page.getByText('Saved on this device',{exact:true}).waitFor();
try{
 await page.goto(process.env.TEST_URL||'http://localhost:4173');await saved();
 assert(!await page.getByRole('slider',{name:'Dissolve',exact:true}).isVisible());
 await button('Play starter mix').click();await button('Pause playback').waitFor();
 assert.equal(await page.getByLabel('Session name',{exact:true}).inputValue(),'First light');
 assert.equal(await page.getByRole('button',{name:/Select track [1-4]: (Soft keys|Dusty drums|Sub pulse|Glass bells)/}).count(),4);
 await button('Loop track 1').click();assert(await page.getByLabel('Loop in',{exact:true}).isVisible());await button('Loop track 1').click();assert.equal(await page.getByLabel('Selected track playback mode',{exact:true}).inputValue(),'tape');assert(!await page.getByLabel('Loop in',{exact:true}).isVisible());
 await page.getByRole('slider',{name:'Seek Soft keys',exact:true}).focus();await page.keyboard.press('Home');
 await button('Record from start').click();await button('Stop & save take').waitFor();await page.waitForTimeout(800);await button('Stop & save take').click();await button('Export latest take').waitFor();await button('Pause playback').click();
 await button('Open recorded takes').click();await button('Delete Take 01').click();await button('Undo delete').click();assert(await page.getByLabel('Rename Take 01',{exact:true}).isVisible());await button('Close dialog').click();
 await button('Session files').click();const pending=page.waitForEvent('download');await button('Download session backup').click();const backup=await pending;await backup.saveAs('test-results/portable.magnetic');assert.equal((await readFile('test-results/portable.magnetic')).subarray(0,8).toString(),'MAGNETIC');
 await button('Start a new tape').click();await button('Start new tape').click();assert.equal(await page.getByRole('button',{name:/Select track [1-4]: Empty tape/}).count(),4);assert(await button('Export latest take').isVisible(),'New tape retains master recordings');
 await page.getByLabel('Open session backup',{exact:true}).setInputFiles('test-results/portable.magnetic');await button('Open this session').waitFor();assert((await page.locator('.track .clip-name').allTextContents()).every(text=>text.startsWith('Empty tape')),'Reading a backup does not overwrite the current tape');await button('Open this session').click();await button('Select track 1: Soft keys').waitFor();assert.equal(await page.getByLabel('Session name',{exact:true}).inputValue(),'First light');await saved();await page.reload();await saved();await button('Select track 4: Glass bells').waitFor();assert(await button('Export latest take').isVisible());
 await page.getByLabel('Open session backup',{exact:true}).setInputFiles({name:'broken.magnetic',mimeType:'application/octet-stream',buffer:Buffer.from('broken')});await page.getByRole('alert').waitFor();assert((await page.locator('[data-track="1"] .clip-name').textContent()).includes('Soft keys'));await button('Close dialog').click();
 for(const width of [1440,768,390,320]){
  await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`No horizontal overflow at ${width}`);await page.screenshot({path:`test-results/workflow-${width}.png`,fullPage:true});
 }
 assert.deepEqual(errors,[]);console.log('PASS Starter playback, contextual loops, keyboard seek, record from start, take deletion undo, backup review/restore/new tape, saved restoration, malformed-file recovery and responsive focused layout');
}finally{await browser.close();}
