// Canonical URL redirects differ between Vite and Cloudflare; verify the actual host.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const url=process.env.TEST_URL||'http://localhost:4173';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const context=await browser.newContext();
const page=await context.newPage();
try{
  await page.goto(url);await page.getByText('Saved on this device',{exact:true}).waitFor();
  await page.waitForFunction(()=>navigator.serviceWorker.controller,undefined,{timeout:15000});
  const cache=await page.evaluate(async()=>{const keys=await caches.keys();const cache=await caches.open(keys.find(k=>k.startsWith('magnetic-')));const response=await cache.match('/');return {cached:!!response,redirected:response?.redirected};});
  assert(cache.cached,'Canonical app document is precached');assert.equal(cache.redirected,false,'Offline document must not be a redirected response');
  await context.setOffline(true);await page.reload();await page.getByText('Saved on this device',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Open library for track 1',exact:true}).click();await page.getByRole('button',{name:/Soft keys/}).click();
  await page.getByRole('button',{name:'Play tape',exact:true}).click();await page.waitForTimeout(650);
  assert(!(await page.locator('.meter-wrap svg').getAttribute('aria-label')).includes(' 0 percent'));
  await page.getByRole('button',{name:'Pause playback',exact:true}).click();
  console.log('PASS Hosted app reloads and plays audio offline, without redirected cache responses');
}finally{await browser.close();}
