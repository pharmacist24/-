import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  getSession,
  hashPassword,
  verifyPassword,
  setSessionCookie,
  type SessionUser,
} from "@/lib/auth";

const schema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
});

// POST /api/auth/change-password — change the current user's password
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const data = schema.parse(body);

    const user = await db.user.findUnique({ where: { id: session.id } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const valid = await verifyPassword(data.currentPassword, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(data.newPassword);
    await db.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    // Refresh the session cookie.
    const sessionUser: SessionUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      floor: user.floor,
      role: user.role as "pharmacist" | "admin",
    };
    await setSessionCookie(sessionUser);

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    console.error("Change password failed:", error);
    return NextResponse.json(
      { error: "Failed to change password" },
      { status: 500 }
    );
  }
}
