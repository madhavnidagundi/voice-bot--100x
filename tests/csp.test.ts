import { afterEach, describe, expect, it, vi } from "vitest";
import config from "../next.config";

afterEach(() => vi.unstubAllEnvs());

async function policyFor(environment: "development" | "production") {
  vi.stubEnv("NODE_ENV", environment);
  const routes = await config.headers!();
  return routes
    .find((route) => route.source === "/(.*)")!
    .headers.find((header) => header.key === "Content-Security-Policy")!.value;
}

describe("development and production CSP", () => {
  it("permits React's development debugging helpers", async () => {
    const policy = await policyFor("development");
    expect(policy).toContain(
      "script-src 'self' 'unsafe-inline' 'unsafe-eval';",
    );
  });

  it("keeps eval disabled in production with the other restrictions intact", async () => {
    const policy = await policyFor("production");
    expect(policy).not.toContain("'unsafe-eval'");
    expect(policy).toContain("script-src 'self' 'unsafe-inline';");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("frame-ancestors 'none'");
  });
});
