import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  hashPassword,
  setSessionCookie,
  FLOORS,
  type SessionUser,
} from "@/lib/auth";

const signupSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  floor: z.enum(FLOORS as unknown as [string, ...string[]]),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const data = signupSchema.parse(body);

    const existing = await db.user.findUnique({ where: { email: data.email } });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(data.password);
    // Public signup is ALWAYS pharmacist role — admin accounts can only be
    // created by an existing admin via the /api/auth/admin/create endpoint.
    const user = await db.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash,
        floor: data.floor,
        role: "pharmacist",
      },
    });

    const sessionUser: SessionUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      floor: user.floor,
      role: user.role as "pharmacist" | "admin",
    };
    await setSessionCookie(sessionUser);

    return NextResponse.json({ user: sessionUser }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    console.error("Signup failed:", error);
    return NextResponse.json(
      { error: "Failed to create account" },
      { status: 500 }
    );
  }
}
