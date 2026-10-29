import { speakSchema } from "@/lib/contracts";
import { AppError, errorResponse } from "@/lib/server/errors";
import { assertOrigin, readJson } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";
import { synthesize } from "@/lib/server/providers";
import { verifySpeech } from "@/lib/server/speech-token";
import { speechParts } from "@/lib/speech-parts";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const parsed = speakSchema.safeParse(await readJson(request));
    if (!parsed.success)
      throw new AppError(
        "invalid_request",
        "This answer couldn't be played.",
        400,
      );
    await rateLimit(request, parsed.data.part === undefined ? "speak" : "speech-part", parsed.data.part === undefined ? 18 : 60);
    if (!verifySpeech(parsed.data.text, parsed.data.token))
      throw new AppError(
        "speech_expired",
        "This audio link has expired. Ask the question again to hear a fresh answer.",
        403,
      );
    const text = parsed.data.part === undefined
      ? parsed.data.text
      : speechParts(parsed.data.text)[parsed.data.part];
    if (!text) throw new AppError("invalid_request", "This audio part is unavailable.", 400);
    const bytes = await synthesize(text, request.signal);
    return new Response(bytes, {
      headers: {
        "Content-Type": "audio/wav",
        "Cache-Control": "no-store",
        "Content-Length": String(bytes.byteLength),
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
