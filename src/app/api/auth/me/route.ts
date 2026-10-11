import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

// GET /api/auth/me — current session user (or null)
export async function GET() {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ user: null });
  }
  return NextResponse.json({ user });
}
