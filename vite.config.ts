import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
const audioVersion=createHash('sha256').update(['tape-processor','recorder-worker','wav-worker','export-worker'].map(name=>readFileSync(`public/audio/${name}.js`,'utf8')).join('\n')).digest('hex').slice(0,12);
function offlineApp(){return {name:'magnetic-offline',closeBundle(){
  const walk=(dir:string):string[]=>readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(join(dir,entry.name)):[join(dir,entry.name)]);
  const files=walk('dist').filter(f=>!f.endsWith('sw.js')&&f!=='dist/_headers'&&!f.startsWith('dist/codecs/'));
  const version=createHash('sha256').update('magnetic-offline-canonical-v2');files.forEach(f=>version.update(readFileSync(f)));
  const urls=files.flatMap(f=>{const url=f==='dist/index.html'?'/':'/'+f.slice(5);return f.startsWith('dist/audio/')?[url,`${url}?v=${audioVersion}`]:[url];});
  writeFileSync('dist/sw.js',`const CACHE='magnetic-${version.digest('hex').slice(0,12)}';
const ASSETS=${JSON.stringify(urls)};
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('magnetic-')&&key!==CACHE&&key!=='magnetic-codecs-v1').map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{const request=event.request;if(request.method!=='GET'||new URL(request.url).origin!==self.location.origin)return;
if(new URL(request.url).pathname.startsWith('/codecs/')){event.respondWith(caches.open('magnetic-codecs-v1').then(async cache=>{const hit=await cache.match(request);if(hit)return hit;const response=await fetch(request);if(response.ok)try{await cache.put(request,response.clone());}catch{}return response;}));return;}
if(request.mode==='navigate'){event.respondWith(fetch(request).catch(()=>caches.open(CACHE).then(cache=>cache.match('/',{ignoreVary:true}))));return;}
if(ASSETS.includes(new URL(request.url).pathname+new URL(request.url).search))event.respondWith(caches.open(CACHE).then(cache=>cache.match(request,{ignoreVary:true})).then(cached=>cached||fetch(request)));});`);
}};}
const headers={'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp'};
export default defineConfig({ plugins: [react(),offlineApp()],define:{__AUDIO_VERSION__:JSON.stringify(audioVersion)},server:{headers},preview:{headers} });
