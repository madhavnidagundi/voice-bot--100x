import { speakSchema } from "@/lib/contracts";
import { AppError, errorResponse } from "@/lib/server/errors";
import { assertOrigin, readJson } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";
import { synthesize } from "@/lib/server/providers";
import { verifySpeech } from "@/lib/server/speech-token";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    await rateLimit(request, "speak", 18);
    const parsed = speakSchema.safeParse(await readJson(request));
    if (!parsed.success)
      throw new AppError(
        "invalid_request",
        "This answer couldn't be played.",
        400,
      );
    if (!verifySpeech(parsed.data.text, parsed.data.token))
      throw new AppError(
        "speech_expired",
        "This audio link has expired. Ask the question again to hear a fresh answer.",
        403,
      );
    const bytes = await synthesize(parsed.data.text, request.signal);
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
