import type {Take} from './audio';
export type ExportOptions={format:'wav'|'flac'|'m4a';bits:16|24;bitrate:128|192|256;start:number;end:number;name:string};
export type ExportProgress=(progress:number,message:string)=>void;
const abortError=()=>new DOMException('Export cancelled','AbortError');
export async function prepareExport(take:Take,options:ExportOptions,signal:AbortSignal,onProgress:ExportProgress):Promise<Blob>{
  signal.throwIfAborted();
  const wav=await new Promise<Blob>((resolve,reject)=>{
    const worker=new Worker(`/audio/export-worker.js?v=${__AUDIO_VERSION__}`);
    const dispose=()=>{worker.terminate();signal.removeEventListener('abort',cancel);};
    const cancel=()=>{dispose();reject(abortError());};signal.addEventListener('abort',cancel,{once:true});
    worker.onmessage=({data})=>{if(data.error){dispose();reject(new Error(data.error));}else if(data.blob){dispose();resolve(data.blob);}else onProgress(data.progress*(options.format==='wav'?1:.15),'Preparing audio');};
    worker.onerror=()=>{dispose();reject(new Error('Audio preparation failed. The original take is still saved.'));};
    worker.postMessage({blob:take.blob,pcm:take.pcm,start:options.start,end:options.end,bits:options.format==='m4a'?32:options.bits});
  });
  signal.throwIfAborted();if(options.format==='wav')return wav;
  const {FFmpeg,FFFSType}=await import('@ffmpeg/ffmpeg');
  signal.throwIfAborted();const encoder=new FFmpeg();let wasmURL='';
  const cancel=()=>encoder.terminate();signal.addEventListener('abort',cancel,{once:true});
  try{
    const root='/codecs/ffmpeg-0.12.10';
    onProgress(.15,'Loading local converter · first use about 31 MB');
    const response=await fetch(`${root}/manifest.json`,{signal});if(!response.ok)throw new Error('The converter is unavailable. Connect once to download it for offline use.');
    const {parts}=await response.json() as {parts:string[]};const chunks:Blob[]=[];
    for(const part of parts){const r=await fetch(`${root}/${part}`,{signal});if(!r.ok)throw new Error('The converter download failed. Try again when connected.');chunks.push(await r.blob());}
    signal.throwIfAborted();wasmURL=URL.createObjectURL(new Blob(chunks,{type:'application/wasm'}));
    await encoder.load({coreURL:new URL(`${root}/core.js`,location.href).href,wasmURL});
    signal.throwIfAborted();onProgress(.2,'Converting on this device');
    encoder.on('progress',({time})=>onProgress(Math.min(.96,.2+.76*Math.max(0,time/1e6)/(options.end-options.start)),'Converting on this device'));
    await encoder.createDir('/input');
    // WORKERFS reads the Blob on demand; long takes never enter WASM as a full input copy.
    if(!await encoder.mount(FFFSType.WORKERFS,{blobs:[{name:'take.wav',data:wav}]},'/input'))throw new Error('The local converter could not open this recording.');
    const output=`output.${options.format}`;
    const args=['-i','/input/take.wav','-vn','-metadata',`title=${options.name}`,...(options.format==='flac'?['-c:a','flac','-compression_level','5']:['-c:a','aac','-b:a',`${options.bitrate}k`,'-movflags','+faststart']),output];
    if(await encoder.exec(args)!==0)throw new Error('Conversion failed. Try a shorter range. Your original take is still saved.');
    signal.throwIfAborted();const bytes=await encoder.readFile(output);if(typeof bytes==='string')throw new Error('The converter returned no audio.');
    onProgress(1,'Ready');return new Blob([bytes as BlobPart],{type:options.format==='flac'?'audio/flac':'audio/mp4'});
  }catch(error){if(signal.aborted)throw abortError();throw error;}
  finally{encoder.terminate();if(wasmURL)URL.revokeObjectURL(wasmURL);signal.removeEventListener('abort',cancel);}
}
