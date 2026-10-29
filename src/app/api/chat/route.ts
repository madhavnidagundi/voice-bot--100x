import { chatSchema } from "@/lib/contracts";
import { AppError, errorResponse } from "@/lib/server/errors";
import { assertOrigin, readJson } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";
import { generateAnswer } from "@/lib/server/providers";
import { signSpeech } from "@/lib/server/speech-token";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    await rateLimit(request, "chat", 12);
    const parsed = chatSchema.safeParse(await readJson(request));
    if (!parsed.success)
      throw new AppError(
        "invalid_request",
        "Please send a question of up to 2,000 characters.",
        400,
      );
    const result = await generateAnswer(
      parsed.data.messages,
      request.signal,
      parsed.data.style,
    );
    return Response.json(
      { ...result, speechToken: signSpeech(result.answer) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
