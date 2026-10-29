import { createHmac, timingSafeEqual } from "node:crypto";
import { requireKey } from "./http";
export function signSpeech(
  text: string,
  expires = Date.now() + 60 * 60 * 1000,
): string {
  const signature = createHmac("sha256", requireKey("OPENROUTER_API_KEY"))
    .update(`${expires}:${text}`)
    .digest("hex");
  return `${expires}.${signature}`;
}
export function verifySpeech(text: string, token: string): boolean {
  const [expires, signature, extra] = token.split(".");
  if (
    extra ||
    !/^\d{13}$/.test(expires ?? "") ||
    !/^[a-f0-9]{64}$/.test(signature ?? "") ||
    Number(expires) < Date.now() ||
    Number(expires) > Date.now() + 61 * 60 * 1000
  )
    return false;
  const expected = signSpeech(text, Number(expires)).split(".")[1];
  return timingSafeEqual(
    Buffer.from(signature, "hex"),
    Buffer.from(expected, "hex"),
  );
}
