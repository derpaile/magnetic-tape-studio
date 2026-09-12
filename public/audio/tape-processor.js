/* Stereo, interpolated, three-head tape delay. Runs on the audio rendering thread. */
class TapeProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'time', defaultValue: .22, minValue: .055, maxValue: .7, automationRate: 'k-rate' },
      { name: 'feedback', defaultValue: .43, minValue: 0, maxValue: 1.08, automationRate: 'k-rate' },
      { name: 'mix', defaultValue: .35, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'age', defaultValue: .32, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'wow', defaultValue: .28, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'drive', defaultValue: .25, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'tone', defaultValue: .55, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'enabled', defaultValue: 1, minValue: 0, maxValue: 1, automationRate: 'k-rate' }
    ];
  }
  constructor() {
    super();
    this.size = Math.ceil(sampleRate * 3);
    this.tape = [new Float32Array(this.size), new Float32Array(this.size)];
    this.pos = 0; this.phase = 0; this.delay = .22 * sampleRate;
    this.lp = [0, 0]; this.dc = [0, 0]; this.last = [0, 0];
    this.heads = [1, 0, 1]; this.headLevels = [1, 0, 1];
    this.port.onmessage = ({data}) => {
      if (data.heads) this.heads = data.heads;
      if (data.clear) { this.tape.forEach(c => c.fill(0)); this.lp.fill(0); this.dc.fill(0); this.last.fill(0); }
    };
  }
  process(inputs, outputs, p) {
    const out = outputs[0], input = inputs[0];
    const enabled = p.enabled[0], mix = p.mix[0] * enabled;
    const drive = 1 + p.drive[0] * 3.8;
    const cutoff = 1400 + p.tone[0] * 8500 * (1 - p.age[0] * .8);
    const alpha = 1 - Math.exp(-2 * Math.PI * cutoff / sampleRate);
    const target = p.time[0] * sampleRate;
    for (let i = 0; i < out[0].length; i++) {
      this.delay += (target - this.delay) * .000075;
      this.phase += 1 / sampleRate;
      const flutter = (Math.sin(this.phase * 2 * Math.PI * .63) * .0018 + Math.sin(this.phase * 2 * Math.PI * 7.13) * .00022) * p.wow[0] * sampleRate;
      let total = 0;
      for (let h = 0; h < 3; h++) { this.headLevels[h] += (this.heads[h] - this.headLevels[h]) * .001; total += this.headLevels[h]; }
      for (let c = 0; c < out.length; c++) {
        const ch = c % 2, dry = input[ch]?.[i] ?? input[0]?.[i] ?? 0;
        let wet = 0, returned = 0;
        for (let h = 0; h < 3; h++) {
          const delay = Math.max(2, this.delay * (h + 1) + flutter * (h + 1));
          const r = (this.pos - delay + this.size * 2) % this.size;
          const a = Math.floor(r), frac = r - a;
          const tap = this.tape[ch][a] * (1 - frac) + this.tape[ch][(a + 1) % this.size] * frac;
          const head = tap * this.headLevels[h];
          returned += head;
          wet += head * (h === 1 ? 1 : ((h === 0 && c === 0) || (h === 2 && c === 1)) ? 1.12 : .88);
        }
        wet /= Math.max(1, total);
        this.lp[ch] += alpha * (returned / Math.max(1, total) - this.lp[ch]);
        const hp = this.lp[ch] - this.last[ch] + .996 * this.dc[ch];
        this.last[ch] = this.lp[ch]; this.dc[ch] = hp;
        const written = dry * .7 + hp * p.feedback[0];
        this.tape[ch][this.pos] = Math.tanh(written * drive) / drive;
        out[c][i] = dry * Math.cos(mix * Math.PI / 2) + wet * Math.sin(mix * Math.PI / 2);
      }
      this.pos = (this.pos + 1) % this.size;
    }
    return true;
  }
}
registerProcessor('magnetic-tape', TapeProcessor);

/* Capture uncompressed stereo PCM, with an acknowledged stop and bounded duration. */
class CaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super(); this.active = false; this.count = 0; this.total = 0;
    this.chunk = [new Float32Array(8192), new Float32Array(8192)];
    this.port.onmessage = ({data}) => {
      if (data === 'start') { this.count = 0; this.total = 0; this.active = true; }
      if (data === 'stop') this.finish();
    };
  }
  flush() {
    if (!this.count) return;
    const left = this.chunk[0].slice(0, this.count), right = this.chunk[1].slice(0, this.count);
    this.port.postMessage({ type: 'chunk', left, right }, [left.buffer, right.buffer]);
    this.count = 0;
  }
  finish() { if (!this.active) return; this.active = false; this.flush(); this.port.postMessage({type:'done', frames:this.total}); }
  process(inputs, outputs) {
    const input = inputs[0], output = outputs[0];
    for (let c = 0; c < output.length; c++) if (input[c] || input[0]) output[c].set(input[c] || input[0]);
    if (this.active) for (let i = 0; i < output[0].length; i++) {
      this.chunk[0][this.count] = input[0]?.[i] || 0;
      this.chunk[1][this.count] = input[1]?.[i] ?? input[0]?.[i] ?? 0;
      this.count++; this.total++;
      if (this.count === 8192) this.flush();
      if (this.total >= sampleRate * 600) { this.finish(); break; }
    }
    return true;
  }
}
registerProcessor('magnetic-capture', CaptureProcessor);
