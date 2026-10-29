import { afterEach, describe, expect, it, vi } from "vitest";
import { introduction, personalStories, systemPrompt } from "@/lib/profile";
import { approvedStories } from "@/lib/stories";
import { chatSchema } from "@/lib/contracts";
import { POST } from "@/app/api/introduction/route";
import { verifySpeech } from "@/lib/server/speech-token";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("evidence-based personal stories and pacing", () => {
  it("includes the supplied internship evidence without inventing a failure", () => {
    expect(personalStories).toHaveLength(3);
    expect(personalStories.map((s) => s.topic)).toEqual([
      "challenge",
      "teamwork",
      "learning",
    ]);
    expect(systemPrompt()).toContain("Magna International");
    expect(systemPrompt()).toContain("Qualcomm");
    expect(systemPrompt()).toContain("25–55 words");
    expect(systemPrompt("detail")).toContain("70–120 words");
    expect(systemPrompt("example")).toContain(
      "must not turn it into an invented anecdote",
    );
  });
  it("excludes unapproved, incomplete, or invalid story records", () => {
    expect(
      approvedStories([
        { ...personalStories[0], approved: false },
        { title: "Made up" },
        null,
      ]),
    ).toEqual([]);
  });
  it("defaults to concise responses and rejects unknown pacing modes", () => {
    const messages = [{ role: "user", content: "Hello" }];
    expect(chatSchema.parse({ messages }).style).toBe("brief");
    expect(chatSchema.safeParse({ messages, style: "unlimited" }).success).toBe(
      false,
    );
  });
  it("returns a grounded interview introduction with authorized speech, without a model call", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-introduction-key");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const response = await POST(
      new Request("https://echo.test/api/introduction", {
        method: "POST",
        headers: { Origin: "https://echo.test" },
      }),
    );
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.answer).toBe(introduction);
    expect(verifySpeech(data.answer, data.speechToken)).toBe(true);
    expect(introduction.split(/\s+/).length).toBeGreaterThanOrEqual(100);
    expect(introduction.split(/\s+/).length).toBeLessThanOrEqual(140);
    expect(fetch).not.toHaveBeenCalled();
  });
});
