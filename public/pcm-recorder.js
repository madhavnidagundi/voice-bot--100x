/* Capture PCM locally. Audio is uploaded only after the visitor stops recording. */
class PCMRecorder extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(2048);
    this.offset = 0;
    this.port.onmessage = (event) => {
      if (event.data === "flush") {
        this.port.postMessage({ samples: this.buffer.slice(0, this.offset) });
        this.offset = 0;
        this.port.postMessage({ flushed: true });
      }
    };
  }
  process(inputs) {
    const input = inputs[0]?.[0];
    if (input)
      for (let i = 0; i < input.length; i++) {
        this.buffer[this.offset++] = input[i];
        if (this.offset === this.buffer.length) {
          this.port.postMessage({ samples: this.buffer.slice() });
          this.offset = 0;
        }
      }
    return true;
  }
}
registerProcessor("pcm-recorder", PCMRecorder);
