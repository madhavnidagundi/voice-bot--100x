import {
  answerSchema,
  type Answer,
  type AnswerStyle,
  type ChatMessage,
} from "@/lib/contracts";
import { systemPrompt } from "@/lib/profile";
import { AppError } from "./errors";
import { providerFetch, requireKey } from "./http";
export async function generateAnswer(
  messages: ChatMessage[],
  signal?: AbortSignal,
  style: AnswerStyle = "brief",
): Promise<Answer> {
  const response = await providerFetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      signal,
      headers: {
        Authorization: `Bearer ${requireKey("OPENROUTER_API_KEY")}`,
        "Content-Type": "application/json",
        "X-OpenRouter-Title": "Echo - 100x personal voice agent",
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
        temperature: 0.35,
        max_tokens: style === "brief" ? 400 : 650,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt(style) },
          ...messages,
        ],
      }),
    },
  );
  try {
    const data = await response.json();
    if (data.choices?.[0]?.finish_reason !== "stop")
      throw new Error("Incomplete response");
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new Error("Missing content");
    return answerSchema.parse(JSON.parse(content));
  } catch {
    throw new AppError(
      "invalid_answer",
      "I couldn't finish that answer. Please ask again.",
      502,
    );
  }
}
export async function transcribe(
  bytes: Uint8Array,
  signal?: AbortSignal,
): Promise<string> {
  const form = new FormData();
  form.set(
    "audio_file",
    new Blob([new Uint8Array(bytes)], { type: "audio/wav" }),
    "question.wav",
  );
  form.set("language_code", "en-IN");
  form.set("format", "transcribe");
  const response = await providerFetch("https://api.vachana.ai/stt/v3", {
    method: "POST",
    signal,
    headers: { "X-API-Key-ID": requireKey("GNANI_API_KEY") },
    body: form,
  });
  try {
    const data = await response.json();
    if (data.success !== true || typeof data.transcript !== "string")
      throw new Error("invalid");
    if (!data.transcript.trim())
      throw new AppError(
        "no_speech",
        "I didn't catch any speech. Please try again or type your question.",
        422,
      );
    if (data.transcript.length > 2000)
      throw new AppError(
        "long_transcript",
        "Please ask a shorter question.",
        422,
      );
    return data.transcript.trim();
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      "invalid_transcript",
      "I couldn't understand this recording. Please try again.",
      502,
    );
  }
}
export async function synthesize(
  text: string,
  signal?: AbortSignal,
): Promise<ArrayBuffer> {
  const response = await providerFetch(
    "https://api.vachana.ai/api/v1/tts/inference",
    {
      method: "POST",
      signal,
      headers: {
        "X-API-Key-ID": requireKey("GNANI_API_KEY"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        voice: process.env.GNANI_TTS_VOICE || "Shlok",
        model: process.env.GNANI_TTS_MODEL || "timbre-v2.5",
        language: "en-IN",
        speed: 1,
        audio_config: {
          sample_rate: 24000,
          num_channels: 1,
          sample_width: 2,
          encoding: "linear_pcm",
          container: "wav",
        },
      }),
    },
  );
  const bytes = await response.arrayBuffer();
  const head = new TextDecoder().decode(bytes.slice(0, 12));
  if (
    bytes.byteLength < 44 ||
    bytes.byteLength > 12_000_000 ||
    !head.startsWith("RIFF") ||
    head.slice(8) !== "WAVE"
  )
    throw new AppError(
      "invalid_audio",
      "Voice playback is unavailable. You can still read the answer.",
      502,
    );
  return bytes;
}
