export const dynamic = "force-dynamic";
export function GET() {
  const configured = Boolean(
    process.env.GNANI_API_KEY && process.env.OPENROUTER_API_KEY,
  );
  return Response.json(
    { status: configured ? "ready" : "setup_required" },
    {
      status: configured ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
