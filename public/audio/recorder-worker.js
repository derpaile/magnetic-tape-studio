/* Raw PCM only during capture. This worker owns storage and never sends sample
   arrays through React. A shared ring absorbs up to eight seconds of stalls;
   browsers without isolation use a direct, recycled MessagePort pool. */
let source, rate = 48000, parts = [], frames = 0, state, ring, capacity = 0, timer;
const CHUNK = 8192;
function store(left, right, count) {
  // Fixed planar blocks: left then right; only the final block may be short.
  parts.push(new Blob([left.subarray(0, count), right.subarray(0, count)]));
  frames += count;
}
function drain(final = false) {
  if (!state) return;
  let read = Atomics.load(state, 1), available = Atomics.load(state, 0) - read;
  while (available >= CHUNK || (final && available > 0)) {
    const count = Math.min(CHUNK, available), left = new Float32Array(count), right = new Float32Array(count);
    for (let i = 0; i < count; i++) { const at = (read + i) % capacity; left[i] = ring[at]; right[i] = ring[capacity + at]; }
    store(left, right, count);
    read += count; available -= count; Atomics.store(state, 1, read);
  }
}
self.onmessage = ({data}) => {
  if (!data.source) return;
  source = data.source; rate = data.sampleRate;
  if (data.shared) { state = new Int32Array(data.shared.state); ring = new Float32Array(data.shared.audio); capacity = ring.length / 2; }
  source.onmessage = ({data: message}) => {
    try {
      if (message.type === 'started') { parts = []; frames = 0; if (state) { clearInterval(timer); timer = setInterval(drain, 40); } }
      if (message.type === 'chunk') {
        const {left, right} = message;
        store(left, right, message.frames ?? left.length);
        source.postMessage({type: 'recycle', left, right}, [left.buffer, right.buffer]);
      }
      if (message.type === 'done') {
        clearInterval(timer); drain(true);
        const blob = new Blob(parts, {type:'application/x-magnetic-pcm'});
        self.postMessage({type:'take', blob, frames, duration:frames/rate,
          pcm:{sampleRate:rate, frames, chunkFrames:CHUNK}, limited:message.limited,
          interrupted:!!message.interrupted || frames !== message.frames});
        parts = []; frames = 0;
      }
    } catch {
      clearInterval(timer);
      self.postMessage({type:'error',message:'The recorder ran out of storage or memory. Previously saved takes are safe. Reload before recording again.'});
    }
  };
  self.postMessage({type:'ready'});
};
