/** Local energy-based endpointing. No audio leaves the device until an utterance ends. */
export type Detection = {
  started?: boolean;
  samples?: Float32Array;
  idle?: boolean;
};
export class VoiceActivity {
  private preRoll: Float32Array[] = [];
  private chunks: Float32Array[] = [];
  private active = false;
  private attack = 0;
  private silence = 0;
  private elapsed = 0;
  private idle = 0;
  private noise = 0.002;
  reset() {
    this.preRoll = [];
    this.chunks = [];
    this.active = false;
    this.attack = 0;
    this.silence = 0;
    this.elapsed = 0;
    this.idle = 0;
  }
  push(chunk: Float32Array, rate: number, playback = false): Detection {
    const ms = (chunk.length / rate) * 1000;
    let energy = 0;
    for (const sample of chunk) energy += sample * sample;
    const rms = Math.sqrt(energy / Math.max(1, chunk.length));
    const threshold = playback
      ? 0.035
      : Math.max(0.012, Math.min(0.03, this.noise * 3));
    const speech = rms > threshold;
    if (!this.active && !speech && !playback)
      this.noise = this.noise * 0.98 + Math.min(rms, 0.01) * 0.02;
    if (!this.active) {
      this.preRoll.push(chunk);
      while (
        this.preRoll.length > 1 &&
        this.preRoll.reduce((n, c) => n + c.length, 0) > rate * 0.45
      )
        this.preRoll.shift();
      this.attack = speech ? this.attack + ms : 0;
      this.idle += ms;
      if (this.attack >= 220) {
        this.active = true;
        this.chunks = this.preRoll;
        this.preRoll = [];
        this.elapsed =
          (this.chunks.reduce((n, c) => n + c.length, 0) / rate) * 1000;
        this.idle = 0;
        return { started: true };
      }
      if (this.idle >= 25000 && !playback) {
        this.reset();
        return { idle: true };
      }
      return {};
    }
    this.chunks.push(chunk);
    this.elapsed += ms;
    this.silence = speech ? 0 : this.silence + ms;
    if (this.silence >= 1100 || this.elapsed >= 29000) return this.finish();
    return {};
  }
  finish(): Detection {
    if (!this.active) return {};
    const count = this.chunks.reduce((n, c) => n + c.length, 0);
    const samples = new Float32Array(count);
    let offset = 0;
    for (const chunk of this.chunks) {
      samples.set(chunk, offset);
      offset += chunk.length;
    }
    this.reset();
    return { samples };
  }
}
