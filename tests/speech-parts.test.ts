import { expect, it, vi } from "vitest";
import { speechParts } from "@/lib/speech-parts";
import { introduction } from "@/lib/profile";
import { POST } from "@/app/api/speak/route";
import { signSpeech } from "@/lib/server/speech-token";
import { encodeWav } from "@/lib/audio";

it("preserves the complete introduction in ordered, bounded sentence groups", () => {
  const parts = speechParts(introduction);
  expect(parts.length).toBeGreaterThan(1);
  expect(parts.length).toBeLessThanOrEqual(6);
  expect(parts.join(" ")).toBe(introduction);
  expect(parts[0].length).toBeLessThan(introduction.length / 2);
  expect(speechParts("I used version 3.14 without punctuation").join(" ")).toBe("I used version 3.14 without punctuation");
});

it("authorizes the full answer before synthesizing a selected part", async () => {
  vi.stubEnv("OPENROUTER_API_KEY", "test-key");
  vi.stubEnv("GNANI_API_KEY", "test-key");
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
  const fetch = vi.fn().mockResolvedValue(new Response(encodeWav(new Float32Array(1600), 16000)));
  vi.stubGlobal("fetch", fetch);
  const send = (text: string, part: number) => POST(new Request("https://echo.test/api/speak", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, part, token: signSpeech(introduction) }),
  }));
  try {
    expect((await send(introduction, 0)).status).toBe(200);
    expect(JSON.parse(fetch.mock.calls[0][1].body).text).toBe(speechParts(introduction)[0]);
    expect((await send("Injected text", 0)).status).toBe(403);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect((await send(introduction, 5)).status).toBe(400);
  } finally { vi.unstubAllGlobals(); vi.unstubAllEnvs(); }
});
