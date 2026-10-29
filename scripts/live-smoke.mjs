import { mkdir, writeFile } from "node:fs/promises";
import { encodeWav } from "../src/lib/audio.ts";
const base = process.env.SMOKE_URL || "http://127.0.0.1:3000";
const evidence = { at: new Date().toISOString(), target: base, checks: [] };
async function check(label, run) {
  const start = Date.now();
  try {
    const details = await run();
    evidence.checks.push({
      label,
      passed: true,
      ms: Date.now() - start,
      ...details,
    });
    console.log(`PASS ${label}`);
    return details;
  } catch (error) {
    evidence.checks.push({
      label,
      passed: false,
      ms: Date.now() - start,
      error: error.message,
    });
    console.error(`FAIL ${label}: ${error.message}`);
    process.exitCode = 1;
  }
}
async function post(path, body, type = "application/json") {
  const response = await fetch(`${base}/api/${path}`, {
    method: "POST",
    headers: { "Content-Type": type, Origin: base },
    body: type === "application/json" ? JSON.stringify(body) : body,
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(
      `HTTP ${response.status}: ${payload.error?.code || "request_failed"}`,
    );
  }
  return response;
}
await check("health", async () => {
  const r = await fetch(`${base}/api/health`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return {};
});
let first;
const questions = [
  "What should we know about your life story in a few sentences?",
  "What's your number one superpower?",
  "What are the top three areas you'd like to grow in?",
  "What misconception do your coworkers have about you?",
  "How do you push your boundaries and limits?",
];
for (let i = 0; i < questions.length; i++)
  await check(`interview_question_${i + 1}`, async () => {
    const data = await (
      await post("chat", {
        messages: [{ role: "user", content: questions[i] }],
      })
    ).json();
    if (
      typeof data.answer !== "string" ||
      !data.answer.length ||
      !Array.isArray(data.followUps) ||
      !data.speechToken
    )
      throw new Error("Invalid answer contract");
    if (i === 0) {
      first = data;
      if (!/Madhav/i.test(data.answer) || !/KLE|Hubli/i.test(data.answer))
        throw new Error("Missing supplied background");
    }
    // Records only metadata, never credentials, audio, or personal response content.
    return {
      answerCharacters: data.answer.length,
      answerWords: data.answer.trim().split(/\s+/).length,
      followUpCount: data.followUps.length,
    };
  });
await check("unknown_background_honesty", async () => {
  const data = await (
    await post("chat", {
      messages: [
        {
          role: "user",
          content: "What was your exact salary at your last employer?",
        },
      ],
    })
  ).json();
  if (
    !/haven't|not shared|don't have|not provided|don't know|no information|not.*added|haven’t|don’t|not.*information/i.test(
      data.answer,
    )
  )
    throw new Error("Manually review uncertainty handling");
  return { answerCharacters: data.answer.length };
});
let internshipAnswer;
const internshipQuestion = "What did you learn from working with your team at Magna International?";
await check("internship_brief_answer", async () => {
  const data = await (await post("chat", { messages: [{ role: "user", content: internshipQuestion }], style: "brief" })).json();
  if (!/Magna|middleware|hardware|collaborat/i.test(data.answer)) throw new Error("Missing internship evidence");
  internshipAnswer = data.answer;
  return { answerWords: data.answer.trim().split(/\s+/).length };
});
if (internshipAnswer) for (const style of ["detail", "example"]) await check(`internship_${style}_follow_up`, async () => {
  const data = await (await post("chat", { style, messages: [
    { role: "user", content: internshipQuestion },
    { role: "assistant", content: internshipAnswer },
    { role: "user", content: style === "detail" ? "Tell me more about that." : "Can you give me a real example of that?" }
  ] })).json();
  if (!/Magna|middleware|hardware|testing|document/i.test(data.answer)) throw new Error("Follow-up lost its context");
  return { answerWords: data.answer.trim().split(/\s+/).length };
});
await check("missing_failure_story_honesty", async () => {
  const data = await (await post("chat", { style: "example", messages: [{ role: "user", content: "Tell me a specific failure you experienced at Magna and exactly how you fixed it." }] })).json();
  if (!/haven't|haven’t|not.*shared|not.*provided|don't have|don’t have|no specific|haven.*document|not.*detail/i.test(data.answer)) throw new Error("Manually review missing-story handling");
  return { answerWords: data.answer.trim().split(/\s+/).length };
});
await check("quick_introduction_and_speech", async () => {
  const data = await (await post("introduction", {})).json();
  if (!/Madhav/.test(data.answer) || !/Magna/.test(data.answer)) throw new Error("Missing introduction facts");
  const audio = await (await post("speak", { text: data.answer, token: data.speechToken })).arrayBuffer();
  if (new TextDecoder().decode(audio.slice(0, 4)) !== "RIFF") throw new Error("Expected introduction WAV");
  return { answerWords: data.answer.trim().split(/\s+/).length, audioBytes: audio.byteLength };
});
if (first) {
  let synthesized;
  await check("gnani_speech_synthesis", async () => {
    const r = await post("speak", {
      text: first.answer,
      token: first.speechToken,
    });
    synthesized = await r.arrayBuffer();
    if (!new TextDecoder().decode(synthesized.slice(0, 4)).startsWith("RIFF"))
      throw new Error("Expected WAV");
    return {
      audioBytes: synthesized.byteLength,
      contentType: r.headers.get("content-type"),
    };
  });
  if (synthesized)
    await check("gnani_speech_to_text_round_trip", async () => {
      const view = new DataView(synthesized);
      const bytes = new Uint8Array(synthesized);
      const tag = (offset) =>
        new TextDecoder().decode(bytes.slice(offset, offset + 4));
      let rate = 24000,
        channels = 1,
        dataStart = 0,
        dataSize = 0;
      for (let offset = 12; offset + 8 <= bytes.length;) {
        const size = view.getUint32(offset + 4, true);
        if (tag(offset) === "fmt ") {
          channels = view.getUint16(offset + 10, true);
          rate = view.getUint32(offset + 12, true);
        }
        if (tag(offset) === "data") {
          dataStart = offset + 8;
          dataSize = size;
          break;
        }
        offset += 8 + size + (size % 2);
      }
      if (!dataStart) throw new Error("WAV missing data");
      const count = Math.min(Math.floor(dataSize / (channels * 2)), rate * 12);
      const floats = new Float32Array(count);
      for (let i = 0; i < count; i++)
        floats[i] = view.getInt16(dataStart + i * channels * 2, true) / 32768;
      const transcript = await (
        await post("transcribe", encodeWav(floats, rate), "audio/wav")
      ).json();
      if (!transcript.transcript?.trim()) throw new Error("Empty transcript");
      return {
        transcriptCharacters: transcript.transcript.length,
        syntheticAudio: true,
      };
    });
}
await mkdir(new URL("../artifacts/", import.meta.url), { recursive: true });
await writeFile(
  new URL("../artifacts/live-check.json", import.meta.url),
  JSON.stringify(evidence, null, 2),
);
console.log(
  "Evidence written to artifacts/live-check.json. Physical microphone/speakers are outside this check.",
);
