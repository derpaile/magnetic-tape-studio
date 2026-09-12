import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
function offlineApp(){return {name:'magnetic-offline',closeBundle(){
  const walk=(dir:string):string[]=>readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(join(dir,entry.name)):[join(dir,entry.name)]);
  const files=walk('dist').filter(f=>!f.endsWith('sw.js')&&f!=='dist/_headers');
  const version=createHash('sha256');files.forEach(f=>version.update(readFileSync(f)));
  const urls=files.map(f=>'/'+f.slice(5));
  writeFileSync('dist/sw.js',`const CACHE='magnetic-${version.digest('hex').slice(0,12)}';
const ASSETS=${JSON.stringify(urls)};
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('magnetic-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{const request=event.request;if(request.method!=='GET'||new URL(request.url).origin!==self.location.origin)return;
if(request.mode==='navigate'){event.respondWith(fetch(request).catch(()=>caches.open(CACHE).then(cache=>cache.match('/index.html',{ignoreVary:true}))));return;}
if(ASSETS.includes(new URL(request.url).pathname))event.respondWith(caches.open(CACHE).then(cache=>cache.match(request,{ignoreVary:true})).then(cached=>cached||fetch(request)));});`);
}};}
export default defineConfig({ plugins: [react(),offlineApp()] });
