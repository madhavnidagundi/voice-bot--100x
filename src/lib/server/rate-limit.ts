import { createHash } from "node:crypto";
import { AppError } from "./errors";
const buckets = new Map<string, { count: number; reset: number }>();
export async function rateLimit(
  request: Request,
  scope: string,
  limit: number,
  windowSeconds = 60,
) {
  const ip = (
    request.headers.get(
      process.env.VERCEL ? "x-vercel-forwarded-for" : "x-forwarded-for",
    ) || "local"
  )
    .split(",")[0]
    .trim();
  const digest = createHash("sha256").update(ip).digest("hex").slice(0, 24);
  const now = Date.now();
  const window = Math.floor(now / (windowSeconds * 1000));
  const key = `echo:${scope}:${digest}:${window}`;
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (redisUrl || redisToken) {
    if (!redisUrl || !redisToken || !redisUrl.startsWith("https://"))
      throw new AppError(
        "limiter_configuration",
        "The demo is temporarily unavailable.",
        503,
      );
    try {
      const response = await fetch(redisUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${redisToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([
          "EVAL",
          "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n",
          "1",
          key,
          String(windowSeconds + 1),
        ]),
        signal: AbortSignal.timeout(4000),
        cache: "no-store",
      });
      if (!response.ok) throw new Error("limiter");
      const data = await response.json();
      if (!Number.isInteger(data.result)) throw new Error("limiter");
      if (data.result > limit)
        throw new AppError(
          "rate_limited",
          "You've asked quite a few questions. Please wait a minute and try again.",
          429,
        );
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        "limiter_unavailable",
        "Please try again in a moment.",
        503,
      );
    }
    return;
  }
  for (const [id, bucket] of buckets)
    if (bucket.reset <= now) buckets.delete(id);
  if (buckets.size >= 10000 && !buckets.has(key))
    throw new AppError(
      "rate_limited",
      "The demo is busy. Please try again in a minute.",
      429,
    );
  const bucket = buckets.get(key) || {
    count: 0,
    reset: (window + 1) * windowSeconds * 1000,
  };
  bucket.count++;
  buckets.set(key, bucket);
  if (bucket.count > limit)
    throw new AppError(
      "rate_limited",
      "Please wait a minute before trying again.",
      429,
    );
}
export function resetRateLimits() {
  buckets.clear();
}
