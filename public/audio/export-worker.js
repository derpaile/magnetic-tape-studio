// Convert saved PCM in bounded batches. The original Blob is never modified.
self.onmessage=async({data:{blob,pcm,start=0,end,bits=16}})=>{
  try{
    let sr,frames,channels=2,offset=0,sourceBits=32,format=3,block=8192;
    if(pcm){sr=pcm.sampleRate;frames=pcm.frames;block=pcm.chunkFrames;if(blob.size!==frames*8)throw Error('The saved take is incomplete.');}
    else{
      const head=new DataView(await blob.slice(0,12).arrayBuffer());
      if(head.byteLength<12||head.getUint32(0)!==0x52494646||head.getUint32(8)!==0x57415645)throw Error('This saved take is not a WAV file.');
      let at=12,found=false;
      while(at+8<=blob.size){
        const header=new DataView(await blob.slice(at,at+8).arrayBuffer()),id=header.getUint32(0),n=header.getUint32(4,true);
        if(id===0x666d7420){const f=new DataView(await blob.slice(at+8,at+8+Math.min(n,40)).arrayBuffer());format=f.getUint16(0,true);channels=f.getUint16(2,true);sr=f.getUint32(4,true);sourceBits=f.getUint16(14,true);}
        if(id===0x64617461){offset=at+8;frames=Math.floor(n/(channels*sourceBits/8));found=true;break;}
        at+=8+n+(n%2);
      }
      if(!found||!sr||![1,3].includes(format)||![16,24,32].includes(sourceBits))throw Error('Unsupported saved WAV format.');
      if(bits===sourceBits&&format===1&&start===0&&(end===undefined||end>=frames/sr)){self.postMessage({blob});return;}
    }
    const from=Math.max(0,Math.min(frames,Math.round(start*sr))),to=Math.max(from,Math.min(frames,Math.round((end??frames/sr)*sr))),count=to-from;
    if(!count)throw Error('Choose an export range longer than zero seconds.');
    const bytesPer=bits/8,header=new ArrayBuffer(44),v=new DataView(header),str=(at,s)=>{for(let i=0;i<s.length;i++)v.setUint8(at+i,s.charCodeAt(i));};
    str(0,'RIFF');v.setUint32(4,36+count*channels*bytesPer,true);str(8,'WAVEfmt ');v.setUint32(16,16,true);v.setUint16(20,bits===32?3:1,true);v.setUint16(22,channels,true);v.setUint32(24,sr,true);v.setUint32(28,sr*channels*bytesPer,true);v.setUint16(32,channels*bytesPer,true);v.setUint16(34,bits,true);str(36,'data');v.setUint32(40,count*channels*bytesPer,true);
    const parts=[header],batch=block*16;
    for(let frame=Math.floor(from/batch)*batch;frame<to;frame+=batch){
      const length=Math.min(batch,frames-frame),a=Math.max(from,frame),b=Math.min(to,frame+length);
      const raw=pcm?new Float32Array(await blob.slice(frame*8,(frame+length)*8).arrayBuffer()):null;
      const source=pcm?null:new DataView(await blob.slice(offset+frame*channels*sourceBits/8,offset+(frame+length)*channels*sourceBits/8).arrayBuffer());
      const out=new DataView(new ArrayBuffer((b-a)*channels*bytesPer));
      for(let f=a;f<b;f++)for(let c=0;c<channels;c++){
        const local=f-frame,chunk=Math.floor(local/block)*block,n=Math.min(block,length-chunk);
        let value;
        if(raw)value=raw[chunk*2+c*n+local-chunk];
        else{const pos=(local*channels+c)*sourceBits/8;
          value=format===3?source.getFloat32(pos,true):sourceBits===16?source.getInt16(pos,true)/32768:sourceBits===24?((source.getUint8(pos)|(source.getUint8(pos+1)<<8)|(source.getInt8(pos+2)<<16))/8388608):source.getInt32(pos,true)/2147483648;
        }
        value=Number.isFinite(value)?value:0;const pos=((f-a)*channels+c)*bytesPer;
        if(bits===32)out.setFloat32(pos,value,true);
        else{value=Math.max(-1,Math.min(1,value));const q=Math.round(value*(value<0?2**(bits-1):2**(bits-1)-1));
          if(bits===16)out.setInt16(pos,q,true);else{out.setUint8(pos,q&255);out.setUint8(pos+1,(q>>8)&255);out.setUint8(pos+2,(q>>16)&255);}
        }
      }
      parts.push(new Blob([out.buffer]));self.postMessage({progress:(b-from)/count});
    }
    self.postMessage({blob:new Blob(parts,{type:'audio/wav'})});
  }catch(error){self.postMessage({error:error.message||'Export failed. Your original take is still saved.'});}
};
