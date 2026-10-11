import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api — health check (useful for Vercel / uptime monitors).
export async function GET() {
  const startedAt = Date.now();
  let database: "ok" | "unconfigured" | "error" = "unconfigured";
  if (process.env.DATABASE_URL) {
    try {
      await db.$queryRaw`SELECT 1`;
      database = "ok";
    } catch (error) {
      console.error("Health check DB ping failed:", error);
      database = "error";
    }
  }
  return NextResponse.json(
    { status: database === "error" ? "degraded" : "ok", database, latencyMs: Date.now() - startedAt },
    { status: database === "error" ? 503 : 200, headers: { "Cache-Control": "no-store" } }
  );
}
