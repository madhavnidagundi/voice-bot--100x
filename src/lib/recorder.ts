import { encodeWav, MAX_RECORD_SECONDS } from "./audio";
export class VoiceRecorder {
  private context?: AudioContext;
  private stream?: MediaStream;
  private source?: MediaStreamAudioSourceNode;
  private node?: AudioWorkletNode;
  private gain?: GainNode;
  private chunks: Float32Array[] = [];
  private cancelled = false;
  private samples = 0;
  private flush?: () => void;
  async start(
    onLevel: (level: number) => void,
    onSamples?: (samples: Float32Array, rate: number) => void,
  ) {
    if (!navigator.mediaDevices?.getUserMedia || !window.AudioContext)
      throw new Error(
        "Voice recording isn't supported in this browser. Please type your question below.",
      );
    this.context = new AudioContext();
    await this.context.resume();
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    if (this.cancelled) {
      await this.dispose();
      return false;
    }
    await this.context.audioWorklet.addModule("/pcm-recorder.js");
    if (this.cancelled) {
      await this.dispose();
      return false;
    }
    this.source = this.context.createMediaStreamSource(this.stream);
    this.node = new AudioWorkletNode(this.context, "pcm-recorder");
    this.node.port.onmessage = (event) => {
      if (event.data.flushed) {
        this.flush?.();
        return;
      }
      const chunk: Float32Array = event.data.samples;
      if (!chunk || this.cancelled) return;
      if (
        !onSamples &&
        this.samples + chunk.length <=
          this.context!.sampleRate * (MAX_RECORD_SECONDS + 1)
      ) {
        this.chunks.push(chunk);
        this.samples += chunk.length;
      }
      let sum = 0;
      for (const value of chunk) sum += value * value;
      onLevel(Math.min(1, Math.sqrt(sum / Math.max(chunk.length, 1)) * 6));
      onSamples?.(chunk, this.context!.sampleRate);
    };
    this.gain = this.context.createGain();
    this.gain.gain.value = 0;
    this.source.connect(this.node);
    this.node.connect(this.gain);
    this.gain.connect(this.context.destination);
    return true;
  }
  async stop(): Promise<ArrayBuffer> {
    const rate = this.context?.sampleRate || 48000;
    if (this.node)
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(resolve, 250);
        this.flush = () => {
          clearTimeout(timeout);
          resolve();
        };
        this.node!.port.postMessage("flush");
      });
    const samples = new Float32Array(this.samples);
    let offset = 0;
    for (const chunk of this.chunks) {
      samples.set(chunk, offset);
      offset += chunk.length;
    }
    await this.dispose();
    if (samples.length / rate < 0.5)
      throw new Error(
        "That was a little short. Please record for at least one second.",
      );
    let energy = 0;
    for (const value of samples) energy += value * value;
    if (Math.sqrt(energy / samples.length) < 0.002)
      throw new Error(
        "I couldn't hear any speech. Check your microphone or type a question.",
      );
    return encodeWav(samples, rate);
  }
  async cancel() {
    this.cancelled = true;
    await this.dispose();
  }
  private async dispose() {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.source?.disconnect();
    this.node?.disconnect();
    this.gain?.disconnect();
    if (this.context && this.context.state !== "closed")
      await this.context.close().catch(() => {});
    this.chunks = [];
    this.samples = 0;
  }
}
