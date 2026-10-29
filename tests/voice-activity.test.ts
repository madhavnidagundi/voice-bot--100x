import { describe, expect, it } from "vitest";
import { VoiceActivity, type Detection } from "@/lib/voice-activity";
const rate = 16000;
function feed(
  detector: VoiceActivity,
  amplitude: number,
  milliseconds: number,
  playback = false,
) {
  const events: Detection[] = [];
  for (let time = 0; time < milliseconds; time += 20)
    events.push(
      detector.push(new Float32Array(320).fill(amplitude), rate, playback),
    );
  return events;
}
describe("local speech endpointing", () => {
  it("ignores background noise and brief clicks", () => {
    const d = new VoiceActivity();
    expect(feed(d, 0.003, 1500).some((e) => e.started)).toBe(false);
    expect(feed(d, 0.2, 100).some((e) => e.started)).toBe(false);
    expect(feed(d, 0, 1500).some((e) => e.samples)).toBe(false);
  });
  it("starts on sustained speech, retains onset, waits through short pauses, and emits after silence", () => {
    const d = new VoiceActivity();
    feed(d, 0, 400);
    expect(feed(d, 0.1, 500).filter((e) => e.started)).toHaveLength(1);
    expect(feed(d, 0, 500).some((e) => e.samples)).toBe(false);
    feed(d, 0.1, 400);
    const utterance = feed(d, 0, 1200).find((e) => e.samples)?.samples;
    expect(utterance).toBeDefined();
    expect(utterance!.some((s) => s === Math.fround(0.1))).toBe(true);
    expect(utterance!.length / rate).toBeGreaterThan(2);
  });
  it("uses a higher threshold during playback but permits an interruption", () => {
    const d = new VoiceActivity();
    expect(feed(d, 0.02, 1000, true).some((e) => e.started)).toBe(false);
    expect(feed(d, 0.08, 300, true).some((e) => e.started)).toBe(true);
  });
  it("ends long questions within the provider duration limit", () => {
    const event = feed(new VoiceActivity(), 0.1, 29500).find((e) => e.samples);
    expect(event?.samples?.length).toBeLessThanOrEqual(16000 * 29);
  });
  it("releases an idle session without emitting empty speech", () => {
    const events = feed(new VoiceActivity(), 0.001, 25100);
    expect(events.filter((e) => e.idle)).toHaveLength(1);
    expect(events.some((e) => e.samples)).toBe(false);
  });
  it("reset clears an interrupted capture and finish never emits silence-only input", () => {
    const d = new VoiceActivity();
    feed(d, 0.1, 600);
    d.reset();
    expect(d.finish()).toEqual({});
    expect(feed(d, 0, 2000).some((e) => e.samples)).toBe(false);
  });
});
