import { validateWav } from "@/lib/audio";
import { AppError, errorResponse } from "@/lib/server/errors";
import { assertOrigin, boundedBody } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";
import { transcribe } from "@/lib/server/providers";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    await rateLimit(request, "transcribe", 8);
    if (request.headers.get("content-type")?.split(";")[0] !== "audio/wav")
      throw new AppError(
        "invalid_type",
        "Please record your question with the microphone button.",
        415,
      );
    const bytes = await boundedBody(request, 1_000_000);
    try {
      validateWav(bytes);
    } catch {
      throw new AppError(
        "invalid_audio",
        "Please record a question between one and thirty seconds.",
        422,
      );
    }
    return Response.json(
      { transcript: await transcribe(bytes, request.signal) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
