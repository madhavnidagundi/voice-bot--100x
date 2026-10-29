import { introduction } from "@/lib/profile";
import { errorResponse } from "@/lib/server/errors";
import { assertOrigin } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";
import { signSpeech } from "@/lib/server/speech-token";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    await rateLimit(request, "introduction", 12);
    return Response.json(
      {
        answer: introduction,
        speechToken: signSpeech(introduction),
        followUps: [
          "What is your biggest strength?",
          "Tell me about Local Interviewer.",
          "What would you like to learn next?",
        ],
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
