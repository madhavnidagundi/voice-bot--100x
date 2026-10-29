import { test, expect } from "@playwright/test";
const reply = {
  answer:
    "I'm Madhav. I'm studying Computer Science with AI at KLE Tech in Hubli. I like working on useful AI projects.",
  followUps: ["What have you built?", "Why do you like AI?"],
  speechToken: "mock-token-for-browser-test",
};
test.beforeEach(async ({ page }) => {
  await page.route("**/api/health", (route) =>
    route.fulfill({ json: { status: "ready" } }),
  );
  await page.route("**/api/chat", (route) => route.fulfill({ json: reply }));
  await page.route("**/api/speak", (route) =>
    route.fulfill({
      status: 503,
      json: {
        error: {
          message: "Voice is unavailable. You can read the answer below.",
        },
      },
    }),
  );
});
test("sample question, context-aware follow-up, transcript export, and new conversation", async ({
  page,
}) => {
  const payloads: unknown[] = [];
  await page.route("**/api/chat", (route) => {
    payloads.push(route.request().postDataJSON());
    return route.fulfill({ json: reply });
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Meet the person",
  );
  await page.getByRole("button", { name: "Turn spoken answers off" }).click();
  await page.getByRole("button", { name: "My story" }).click();
  await expect(page.getByRole("log")).toContainText(reply.answer);
  await page
    .getByRole("button", { name: "What have you built?", exact: true })
    .click();
  await expect.poll(() => payloads.length).toBe(2);
  expect((payloads[1] as { messages: unknown[] }).messages).toHaveLength(3);
  await expect(page.getByRole("log")).toContainText("2 answers");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save conversation" }).click();
  expect((await downloadPromise).suggestedFilename()).toBe(
    "echo-conversation.txt",
  );
  await page.getByRole("button", { name: "Start a new conversation" }).click();
  await expect(page.getByRole("log")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Save conversation" }),
  ).toBeDisabled();
});
test("typed question and graceful speech failure preserve the answer", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Your question" })
    .fill("Tell me about yourself");
  await page.getByRole("textbox", { name: "Your question" }).press("Enter");
  await expect(page.getByRole("log")).toContainText(reply.answer);
  await expect(
    page.getByRole("region", { name: "Interview room" }).getByRole("alert"),
  ).toContainText("Voice is unavailable");
  await expect(
    page.getByRole("button", { name: "Play this answer" }),
  ).toBeEnabled();
});
test("failed chat restores the editable question for retry", async ({
  page,
}) => {
  await page.route("**/api/chat", (route) =>
    route.fulfill({
      status: 429,
      json: { error: { message: "Please wait a minute before trying again." } },
    }),
  );
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Your question" })
    .fill("What motivates you?");
  await page.getByRole("button", { name: "Send question" }).click();
  await expect(
    page.getByRole("region", { name: "Interview room" }).getByRole("alert"),
  ).toContainText("wait a minute");
  await expect(
    page.getByRole("textbox", { name: "Your question" }),
  ).toHaveValue("What motivates you?");
  await expect(page.getByRole("log")).toHaveCount(0);
});
test("microphone denial offers typed input", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: () =>
        Promise.reject(new DOMException("Denied", "NotAllowedError")),
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Let's talk" }).click();
  await expect(
    page.getByRole("region", { name: "Interview room" }).getByRole("alert"),
  ).toContainText("Microphone access is off");
  await expect(
    page.getByRole("textbox", { name: "Your question" }),
  ).toBeEnabled();
});
test("help dialog, profile disclosure, and responsive layout", async ({
  page,
}) => {
  await page.goto("/");
  await page.screenshot({
    path: `artifacts/room-${test.info().project.name}.png`,
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "How it works" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("tab", { name: "About this agent" }).click();
  await expect(page.getByRole("tabpanel")).toContainText("AI representation");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("plays synthesized audio, stops it, and replays an answer", async ({
  page,
}) => {
  const { encodeWav } = await import("../src/lib/audio");
  const samples = new Float32Array(16000 * 3);
  for (let i = 0; i < samples.length; i++)
    samples[i] = Math.sin((i * 2 * Math.PI * 440) / 16000) * 0.05;
  const bytes = Buffer.from(encodeWav(samples, 16000));
  await page.route("**/api/speak", (route) =>
    route.fulfill({ contentType: "audio/wav", body: bytes }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "My story" }).click();
  await expect(page.getByRole("button", { name: "Stop audio" })).toBeVisible();
  await page.getByRole("button", { name: "Stop audio" }).click();
  await expect(
    page.getByRole("button", { name: "Ask another question" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Play this answer" }).click();
  await expect(page.getByRole("button", { name: "Stop audio" })).toBeVisible();
  await page.getByRole("button", { name: "Turn spoken answers off" }).click();
  await expect(
    page.getByRole("button", { name: "Ask another question" }),
  ).toBeVisible();
});
test("new conversation cancels a pending response", async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/chat", async (route) => {
    await gate;
    await route.fulfill({ json: reply }).catch(() => {});
  });
  await page.goto("/");
  await page.getByRole("button", { name: "My superpower" }).click();
  await expect(page.getByRole("button", { name: "Thinking…" })).toBeVisible();
  await page.getByRole("button", { name: "Start a new conversation" }).click();
  release();
  await expect(page.getByRole("log")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Let's talk" })).toBeVisible();
});
test("records a provider-compatible WAV and reviews transcription before sending", async ({
  page,
}) => {
  let receivedWav = false;
  await page.route("**/api/transcribe", (route) => {
    const bytes = route.request().postDataBuffer();
    receivedWav = Boolean(
      bytes &&
      bytes.subarray(0, 4).toString() === "RIFF" &&
      bytes.length > 16000,
    );
    return route.fulfill({ json: { transcript: "What is your superpower?" } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Turn spoken answers off" }).click();
  await page.getByRole("button", { name: "Let's talk" }).click();
  await expect(
    page.getByRole("button", { name: "Finish recording" }),
  ).toBeVisible();
  // A real capture interval gives Chromium's synthetic microphone enough PCM frames.
  await page.waitForTimeout(1600);
  await page.getByRole("button", { name: "Finish recording" }).click();
  await expect(
    page.getByRole("textbox", { name: "Your question" }),
  ).toHaveValue("What is your superpower?");
  expect(receivedWav).toBe(true);
  await expect(page.getByRole("log")).toHaveCount(0);
  await page
    .getByRole("textbox", { name: "Your question" })
    .fill("What is your biggest strength?");
  await page.getByRole("button", { name: "Send question" }).click();
  await expect(page.getByRole("log")).toContainText(
    "What is your biggest strength?",
  );
});
