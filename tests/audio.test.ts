import { describe, expect, it } from "vitest";
import { encodeWav, validateWav, SAMPLE_RATE } from "@/lib/audio";
const wav = (seconds = 1, rate = 48000) =>
  new Uint8Array(encodeWav(new Float32Array(seconds * rate).fill(0.25), rate));
describe("browser PCM to provider WAV", () => {
  it.each([16000, 44100, 48000])(
    "resamples %i Hz to valid 16 kHz mono PCM",
    (rate) => {
      const result = wav(1, rate);
      expect(validateWav(result)).toBe(1);
      expect(result.length).toBe(44 + SAMPLE_RATE * 2);
    },
  );
  it("clips out-of-range input to signed PCM and caps capture length", () => {
    const result = new Uint8Array(
      encodeWav(new Float32Array(16000 * 35).fill(5), 16000),
    );
    expect(validateWav(result)).toBe(29);
    expect(new DataView(result.buffer).getInt16(44, true)).toBe(32767);
  });
  it("preserves negative PCM without wraparound", () => {
    const result = encodeWav(new Float32Array(16000).fill(-5), 16000);
    expect(new DataView(result).getInt16(44, true)).toBe(-32768);
  });
  it.each([8000, 0, NaN])("rejects unsupported input sample rate %i", (rate) =>
    expect(() => encodeWav(new Float32Array(100), rate)).toThrow(),
  );
  it.each([0, 0.1])("rejects recordings too short (%f seconds)", (seconds) =>
    expect(() => validateWav(wav(seconds))).toThrow(),
  );
  it.each([0, 8, 22, 24, 28, 32, 34, 40])(
    "rejects tampered WAV header at byte %i",
    (offset) => {
      const result = wav();
      result[offset] = 255;
      expect(() => validateWav(result)).toThrow();
    },
  );
  it("rejects truncated and non-audio payloads", () => {
    expect(() => validateWav(wav().subarray(0, 50))).toThrow();
    expect(() =>
      validateWav(new TextEncoder().encode("this isn't a wav")),
    ).toThrow();
  });
});
