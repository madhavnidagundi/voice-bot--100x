import { AppError } from "./errors";
export function assertOrigin(request: Request) {
  const origin = request.headers.get("origin");
  // Next's internal URL can use localhost while the browser uses 127.0.0.1.
  // Host is the browser-visible authority, preserved by Vercel's ingress.
  const expected = new URL(request.url);
  const host = request.headers.get("host");
  if (host) expected.host = host;
  if (
    (origin && origin !== expected.origin) ||
    request.headers.get("sec-fetch-site") === "cross-site"
  ) {
    throw new AppError(
      "forbidden",
      "Please use this app directly to continue.",
      403,
    );
  }
}
export async function boundedBody(
  request: Request,
  max: number,
): Promise<Uint8Array> {
  const declared = request.headers.get("content-length");
  if (declared && Number(declared) > max)
    throw new AppError("too_large", "This request is too large.", 413);
  if (!request.body)
    throw new AppError("invalid_request", "The request is empty.", 400);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > max) {
        await reader.cancel();
        throw new AppError("too_large", "This request is too large.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}
export async function readJson(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new AppError("invalid_type", "Send a JSON request.", 415);
  try {
    return JSON.parse(
      new TextDecoder().decode(await boundedBody(request, 40000)),
    );
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("invalid_json", "This request could not be read.", 400);
  }
}
export async function providerFetch(
  url: string,
  init: RequestInit,
  timeoutMs = 42000,
): Promise<Response> {
  try {
    const response = await fetch(url, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.any([
        AbortSignal.timeout(timeoutMs),
        ...(init.signal ? [init.signal] : []),
      ]),
    });
    if (response.ok) return response;
    if (response.status === 429)
      throw new AppError(
        "provider_busy",
        "The voice service is busy. Please try again in a moment.",
        429,
      );
    if ([401, 402, 403].includes(response.status))
      throw new AppError(
        "provider_configuration",
        "The service is temporarily unavailable. You can try again later.",
        503,
      );
    throw new AppError(
      "provider_error",
      "The service couldn't complete this request. Please try again.",
      502,
    );
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error(
      JSON.stringify({
        event: "provider_transport_failed",
        name: error instanceof Error ? error.name : "unknown",
        code:
          error instanceof Error &&
          error.cause &&
          typeof error.cause === "object" &&
          "code" in error.cause
            ? String(error.cause.code)
            : undefined,
        aborted: init.signal?.aborted ?? false,
      }),
    );
    throw new AppError(
      "provider_unreachable",
      "The service took too long to respond. Please try again.",
      504,
    );
  }
}
export function requireKey(name: "OPENROUTER_API_KEY" | "GNANI_API_KEY") {
  const key = process.env[name]?.trim();
  if (!key || key.startsWith("YOUR_"))
    throw new AppError(
      "not_configured",
      "This demo is being set up. Please try again shortly.",
      503,
    );
  return key;
}
