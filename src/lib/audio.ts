export const SAMPLE_RATE = 16000;
export const MAX_RECORD_SECONDS = 29;
export function encodeWav(
  samples: Float32Array,
  inputRate: number,
): ArrayBuffer {
  if (!Number.isFinite(inputRate) || inputRate < SAMPLE_RATE)
    throw new Error("Unsupported sample rate");
  const ratio = inputRate / SAMPLE_RATE;
  const count = Math.min(
    Math.floor(samples.length / ratio),
    MAX_RECORD_SECONDS * SAMPLE_RATE,
  );
  const buffer = new ArrayBuffer(44 + count * 2);
  const view = new DataView(buffer);
  const str = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++)
      view.setUint8(offset + i, s.charCodeAt(i));
  };
  str(0, "RIFF");
  view.setUint32(4, 36 + count * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  str(36, "data");
  view.setUint32(40, count * 2, true);
  for (let i = 0; i < count; i++) {
    const start = Math.floor(i * ratio),
      end = Math.min(Math.floor((i + 1) * ratio), samples.length);
    let sum = 0;
    for (let j = start; j < end; j++) sum += samples[j];
    const value = Math.max(-1, Math.min(1, sum / Math.max(1, end - start)));
    view.setInt16(
      44 + i * 2,
      Math.round(value * (value < 0 ? 32768 : 32767)),
      true,
    );
  }
  return buffer;
}
export function validateWav(bytes: Uint8Array): number {
  const bad = () => {
    throw new Error(
      "Use a mono 16 kHz WAV recording between 0.25 and 30 seconds.",
    );
  };
  if (bytes.length < 44) return bad();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const str = (o: number, n: number) =>
    String.fromCharCode(...bytes.subarray(o, o + n));
  if (
    str(0, 4) !== "RIFF" ||
    str(8, 4) !== "WAVE" ||
    view.getUint32(4, true) + 8 !== bytes.length
  )
    return bad();
  let format = false,
    dataSize = 0,
    dataCount = 0;
  let offset = 12;
  for (; offset + 8 <= bytes.length;) {
    const size = view.getUint32(offset + 4, true);
    const start = offset + 8;
    if (start + size > bytes.length) return bad();
    if (str(offset, 4) === "fmt ") {
      if (
        format ||
        size < 16 ||
        view.getUint16(start, true) !== 1 ||
        view.getUint16(start + 2, true) !== 1 ||
        view.getUint32(start + 4, true) !== SAMPLE_RATE ||
        view.getUint32(start + 8, true) !== SAMPLE_RATE * 2 ||
        view.getUint16(start + 12, true) !== 2 ||
        view.getUint16(start + 14, true) !== 16
      )
        return bad();
      format = true;
    }
    if (str(offset, 4) === "data") {
      dataSize += size;
      dataCount++;
    }
    offset = start + size + (size % 2);
    if (offset > bytes.length) return bad();
  }
  const seconds = dataSize / (SAMPLE_RATE * 2);
  if (
    offset !== bytes.length ||
    !format ||
    dataCount !== 1 ||
    dataSize % 2 ||
    seconds < 0.25 ||
    seconds > 30
  )
    return bad();
  return seconds;
}
