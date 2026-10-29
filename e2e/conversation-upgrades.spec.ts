import { test, expect, type Page } from "@playwright/test";
import { encodeWav } from "../src/lib/audio";
const reply = {
  answer:
    "At Magna International, I worked with the team on middleware for different edge hardware. Collaborative learning helped me take accountability for my work.",
  followUps: ["What did you learn about testing?"],
  speechToken: "browser-test-token",
};
const audio = Buffer.from(
  encodeWav(
    new Float32Array(16000 * 8).map(
      (_, i) => Math.sin((i * 2 * Math.PI * 440) / 16000) * 0.01,
    ),
    16000,
  ),
);
test.beforeEach(async ({ page }) => {
  await page.route("**/api/chat", (r) => r.fulfill({ json: reply }));
  await page.route("**/api/introduction", (r) =>
    r.fulfill({
      json: {
        ...reply,
        answer:
          "Hi, I'm Madhav, a Computer Science and AI student at KLE Tech in Hubli.",
      },
    }),
  );
  await page.route("**/api/speak", (r) =>
    r.fulfill({ contentType: "audio/wav", body: audio }),
  );
  await page.route("**/api/transcribe", (r) =>
    r.fulfill({ json: { transcript: "Tell me about your internship." } }),
  );
});
async function controlledMicrophone(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: async () => {
        const context = new AudioContext();
        await context.resume();
        const oscillator = context.createOscillator();
        oscillator.frequency.value = 220;
        const gain = context.createGain();
        gain.gain.value = 0;
        const destination = context.createMediaStreamDestination();
        oscillator.connect(gain);
        gain.connect(destination);
        oscillator.start();
        Object.assign(window, {
          voiceTest: {
            speak: () => {
              gain.gain.value = 0.2;
              setTimeout(() => {
                gain.gain.value = 0;
              }, 800);
            },
            ended: () =>
              destination.stream
                .getTracks()
                .every((track) => track.readyState === "ended"),
          },
        });
        return destination.stream;
      },
    });
  });
}
async function saySomething(page: Page) {
  // Allow the echo-tail guard to elapse, then deliver actual PCM through AudioWorklet.
  await page.waitForTimeout(400);
  await page.evaluate(() =>
    (
      window as unknown as { voiceTest: { speak: () => void } }
    ).voiceTest.speak(),
  );
}
test("quick introduction bypasses model generation and can be interrupted manually", async ({
  page,
}) => {
  let chats = 0;
  page.on("request", (r) => {
    if (r.url().endsWith("/api/chat")) chats++;
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Hear my 1-minute introduction" })
    .click();
  await expect(page.getByRole("log")).toContainText("Hi, I'm Madhav");
  await expect(
    page.getByRole("heading", { name: "Here's a little about me." }),
  ).toBeVisible();
  expect(chats).toBe(0);
  await page.getByRole("button", { name: "Interrupt & ask" }).click();
  await expect(
    page.getByRole("button", { name: "Finish recording" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Start a new conversation" }).click();
});
test("answer expansion preserves context and requests the selected pacing", async ({
  page,
}) => {
  const payloads: { style: string; messages: unknown[] }[] = [];
  await page.route("**/api/chat", (r) => {
    payloads.push(r.request().postDataJSON());
    return r.fulfill({ json: reply });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Turn spoken answers off" }).click();
  await page.getByRole("button", { name: "My story", exact: true }).click();
  await page.getByRole("button", { name: "Tell me more", exact: true }).click();
  await expect.poll(() => payloads.length).toBe(2);
  await expect(page.getByRole("log")).toContainText("2 answers");
  await page
    .getByRole("button", { name: "Give me an example", exact: true })
    .click();
  await expect.poll(() => payloads.length).toBe(3);
  expect(payloads.map((p) => p.style)).toEqual(["brief", "detail", "example"]);
  expect(payloads[2].messages).toHaveLength(5);
});
test("hands-free sends after silence, supports speech interruption, and releases the microphone", async ({
  page,
}) => {
  await controlledMicrophone(page);
  let transcriptions = 0;
  page.on("request", (r) => {
    if (r.url().endsWith("/api/transcribe")) transcriptions++;
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Hands-free", exact: true }).click();
  await page
    .getByRole("button", { name: "Start hands-free", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Stop hands-free", exact: true }),
  ).toBeVisible();
  await saySomething(page);
  await expect(page.getByRole("log")).toContainText(reply.answer);
  await expect(
    page.getByRole("heading", { name: "Here's a little about me." }),
  ).toBeVisible();
  await saySomething(page);
  await expect(
    page.getByRole("heading", { name: "I'm listening." }),
  ).toBeVisible();
  await expect.poll(() => transcriptions).toBe(2);
  await expect(page.getByRole("log")).toContainText("2 answers");
  await page.getByRole("button", { name: "End voice session" }).click();
  expect(
    await page.evaluate(() =>
      (
        window as unknown as { voiceTest: { ended: () => boolean } }
      ).voiceTest.ended(),
    ),
  ).toBe(true);
  await expect(
    page.getByRole("button", { name: "Start hands-free", exact: true }),
  ).toBeVisible();
});
test("leaving the tab releases hands-free capture", async ({ page }) => {
  await controlledMicrophone(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Hands-free", exact: true }).click();
  await page
    .getByRole("button", { name: "Start hands-free", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Stop hands-free", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      value: true,
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(
    page.getByRole("region", { name: "Interview room" }).getByRole("alert"),
  ).toContainText("Microphone stopped");
  expect(
    await page.evaluate(() =>
      (
        window as unknown as { voiceTest: { ended: () => boolean } }
      ).voiceTest.ended(),
    ),
  ).toBe(true);
});


test("starts the first audio part before the next is ready and reuses cached playback", async ({ page }) => {
  let calls = 0;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/introduction", r => r.fulfill({ json: {
    ...reply,
    answer: "I worked with a team at Magna International building middleware for deploying AI models across different edge hardware platforms. I learned about testing and collaboration.",
  } }));
  await page.route("**/api/speak", async r => {
    calls++;
    if (r.request().postDataJSON().part === 1) await gate;
    await r.fulfill({ contentType: "audio/wav", body: audio });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Hear my 1-minute introduction" }).click();
  await expect.poll(() => calls).toBe(2);
  await expect(page.getByRole("button", { name: "Interrupt & ask" })).toBeVisible();
  await page.getByRole("button", { name: "Stop audio", exact: true }).click();
  release();
  await page.getByRole("button", { name: "Play this answer" }).click();
  await expect(page.getByRole("button", { name: "Interrupt & ask" })).toBeVisible();
  // Only the cancelled second part needs another request; the first is cached.
  await expect.poll(() => calls).toBe(3);
  await page.getByRole("button", { name: "Start a new conversation" }).click();
});
