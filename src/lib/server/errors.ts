export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 500,
  ) {
    super(message);
  }
}
export function errorResponse(error: unknown): Response {
  const known = error instanceof AppError;
  const requestId = crypto.randomUUID();
  // Deliberately excludes bodies, questions, audio, keys and upstream error text.
  console.error(
    JSON.stringify({
      event: "request_failed",
      code: known ? error.code : "internal_error",
      requestId,
    }),
  );
  return Response.json(
    {
      error: {
        code: known ? error.code : "internal_error",
        message: known
          ? error.message
          : "Something went wrong. Please try again.",
        requestId,
      },
    },
    {
      status: known ? error.status : 500,
      headers: {
        "Cache-Control": "no-store",
        ...(known && error.status === 429 ? { "Retry-After": "60" } : {}),
      },
    },
  );
}
