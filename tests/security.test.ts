import { beforeEach, describe, expect, it, vi } from "vitest";
import { assertOrigin, boundedBody, readJson } from "@/lib/server/http";
import { rateLimit, resetRateLimits } from "@/lib/server/rate-limit";
import { signSpeech, verifySpeech } from "@/lib/server/speech-token";
beforeEach(() => {
  vi.stubEnv("OPENROUTER_API_KEY", "test-server-secret");
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
  resetRateLimits();
});
describe("HTTP security", () => {
  it("allows same-origin, blocks cross-origin and opaque-origin writes", () => {
    expect(() =>
      assertOrigin(
        new Request("https://echo.test/api/chat", {
          headers: { Origin: "https://echo.test" },
        }),
      ),
    ).not.toThrow();
    for (const origin of ["https://evil.test", "null"])
      expect(() =>
        assertOrigin(
          new Request("https://echo.test/api/chat", {
            headers: { Origin: origin },
          }),
        ),
      ).toThrow();
  });
  it("uses the public Host when Next's internal hostname differs", () => {
    expect(() =>
      assertOrigin(
        new Request("http://localhost:3000/api/chat", {
          headers: { Host: "127.0.0.1:3000", Origin: "http://127.0.0.1:3000" },
        }),
      ),
    ).not.toThrow();
    expect(() =>
      assertOrigin(
        new Request("http://localhost:3000/api/chat", {
          headers: { Host: "127.0.0.1:3000", Origin: "http://evil.test" },
        }),
      ),
    ).toThrow();
  });
  it("blocks oversized streamed content even without content-length", async () => {
    const request = new Request("http://local/api", {
      method: "POST",
      body: "a".repeat(100),
    });
    await expect(boundedBody(request, 20)).rejects.toMatchObject({
      status: 413,
    });
  });
  it("rejects bad JSON and wrong media type", async () => {
    await expect(
      readJson(
        new Request("http://local/api", {
          method: "POST",
          body: "bad",
          headers: { "Content-Type": "application/json" },
        }),
      ),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      readJson(new Request("http://local/api", { method: "POST", body: "{}" })),
    ).rejects.toMatchObject({ status: 415 });
  });
  it("enforces per-IP per-endpoint limits", async () => {
    const request = new Request("http://local/api", {
      headers: { "x-forwarded-for": "1.2.3.4" },
    });
    await rateLimit(request, "test", 1);
    await expect(rateLimit(request, "test", 1)).rejects.toMatchObject({
      status: 429,
    });
    await expect(rateLimit(request, "different", 1)).resolves.toBeUndefined();
  });
  it("uses an atomic distributed counter when configured", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-redis");
    const fetch = vi.fn().mockResolvedValue(Response.json({ result: 2 }));
    vi.stubGlobal("fetch", fetch);
    await expect(
      rateLimit(new Request("http://local/api"), "chat", 1),
    ).rejects.toMatchObject({ status: 429 });
    expect(JSON.parse(fetch.mock.calls[0][1].body)[0]).toBe("EVAL");
  });
  it("fails closed on a configured limiter outage", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("unreachable")));
    await expect(
      rateLimit(new Request("http://local/api"), "chat", 1),
    ).rejects.toMatchObject({ status: 503 });
  });
});
describe("signed speech playback", () => {
  it("accepts the generated answer, rejects altered text", () => {
    const token = signSpeech("Hello");
    expect(verifySpeech("Hello", token)).toBe(true);
    expect(verifySpeech("Charge the API for arbitrary text", token)).toBe(
      false,
    );
  });
  it("rejects expired, malformed, and overly long-lived tokens", () => {
    expect(verifySpeech("Hi", signSpeech("Hi", Date.now() - 1000))).toBe(false);
    expect(verifySpeech("Hi", signSpeech("Hi", Date.now() + 7200000))).toBe(
      false,
    );
    for (const token of [
      "bad",
      "123.bad",
      `${Date.now()}.${"a".repeat(64)}.extra`,
    ])
      expect(verifySpeech("Hi", token)).toBe(false);
  });
});
