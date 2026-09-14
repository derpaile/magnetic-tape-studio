import {mkdirSync,readFileSync,writeFileSync,copyFileSync} from 'node:fs';
const base='public/codecs/ffmpeg-0.12.10';
mkdirSync(base,{recursive:true});
copyFileSync('node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.js',`${base}/core.js`);
const wasm=readFileSync('node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.wasm'),size=12*1024*1024,parts=[];
// Each asset stays below Cloudflare's 25 MiB per-file limit.
for(let offset=0;offset<wasm.length;offset+=size){const name=`core-${parts.length}.bin`;writeFileSync(`${base}/${name}`,wasm.subarray(offset,offset+size));parts.push(name);}
writeFileSync(`${base}/manifest.json`,JSON.stringify({parts,bytes:wasm.length}));
writeFileSync(`${base}/NOTICE.txt`,'FFmpeg WebAssembly core 0.12.10. Source and build instructions: https://github.com/ffmpegwasm/ffmpeg.wasm/tree/main/packages/core and https://github.com/ffmpegwasm/ffmpeg.wasm/tree/main/build. FFmpeg and the libraries included in this core retain their respective licenses. See https://ffmpegwasm.netlify.app/docs/overview/ and https://ffmpeg.org/legal.html.\n');
