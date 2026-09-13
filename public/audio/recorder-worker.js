/* PCM encoding stays off the interface and audio threads. Blob parts avoid a
   second full-length PCM allocation when a 30-minute performance is saved. */
let source, rate = 48000, parts = [], frames = 0;
function header(count) {
  const bytes = new ArrayBuffer(44), v = new DataView(bytes);
  const str = (at, s) => { for (let i = 0; i < s.length; i++) v.setUint8(at + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + count * 4, true); str(8, 'WAVE');
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, 2, true); v.setUint32(24, rate, true); v.setUint32(28, rate * 4, true);
  v.setUint16(32, 4, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, count * 4, true);
  return bytes;
}
self.onmessage = ({data}) => {
  if (!data.source) return;
  source = data.source; rate = data.sampleRate;
  source.onmessage = ({data: message}) => {
    if (message.type === 'started') { parts = []; frames = 0; }
    if (message.type === 'chunk') {
      const {left, right} = message, count = message.frames ?? left.length;
      const bytes = new ArrayBuffer(count * 4), view = new DataView(bytes);
      for (let i = 0; i < count; i++) {
        const l = Math.max(-1, Math.min(1, left[i])), r = Math.max(-1, Math.min(1, right[i]));
        view.setInt16(i * 4, l < 0 ? l * 32768 : l * 32767, true);
        view.setInt16(i * 4 + 2, r < 0 ? r * 32768 : r * 32767, true);
      }
      parts.push(new Blob([bytes])); frames += count;
      source.postMessage({type: 'recycle', left, right}, [left.buffer, right.buffer]);
    }
    if (message.type === 'done') {
      const blob = new Blob([header(frames), ...parts], {type: 'audio/wav'});
      self.postMessage({type: 'take', blob, frames, duration: frames / rate, limited: message.limited});
      parts = []; frames = 0;
    }
  };
  self.postMessage({type: 'ready'});
};
