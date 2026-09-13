/* On-demand 16-bit stereo export. Bounded reads and Blob parts avoid ever
   allocating a second full take of PCM. Legacy WAVs bypass this worker. */
self.onmessage = async ({data:{blob, pcm}}) => {
  try {
    const {frames, sampleRate, chunkFrames} = pcm, header = new ArrayBuffer(44), v = new DataView(header);
    const str = (at, s) => { for (let i = 0; i < s.length; i++) v.setUint8(at+i,s.charCodeAt(i)); };
    str(0,'RIFF');v.setUint32(4,36+frames*4,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);
    v.setUint16(20,1,true);v.setUint16(22,2,true);v.setUint32(24,sampleRate,true);v.setUint32(28,sampleRate*4,true);
    v.setUint16(32,4,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,frames*4,true);
    if (blob.size !== frames*8) throw new Error('The saved take is incomplete.');
    const parts = [header];
    for (let frame = 0; frame < frames; frame += chunkFrames * 16) {
      const count = Math.min(chunkFrames*16,frames-frame);
      const samples = new Float32Array(await blob.slice(frame*8,(frame+count)*8).arrayBuffer());
      const bytes = new ArrayBuffer(count*4), out = new DataView(bytes);
      for (let block = 0; block < count; block += chunkFrames) {
        const n = Math.min(chunkFrames,count-block);
        for (let i = 0; i < n; i++) for (let c = 0; c < 2; c++) {
          const raw = samples[block*2+c*n+i], s = Number.isFinite(raw)?Math.max(-1,Math.min(1,raw)):0;
          out.setInt16((block+i)*4+c*2,s<0?s*32768:s*32767,true);
        }
      }
      parts.push(new Blob([bytes]));
    }
    self.postMessage({blob:new Blob(parts,{type:'audio/wav'})});
  } catch (e) { self.postMessage({error:e.message || 'WAV export failed. Your raw take remains saved.'}); }
};
