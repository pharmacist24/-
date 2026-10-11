import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  hashPassword,
  setSessionCookie,
  FLOORS,
  type SessionUser,
} from "@/lib/auth";
import { handleApiError, readJson, ApiError } from "@/lib/api";

const signupSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(200, "Password is too long"),
  floor: z.enum(FLOORS, { message: "Select a valid floor" }),
});

export async function POST(request: NextRequest) {
  try {
    const data = signupSchema.parse(await readJson(request));

    const existing = await db.user.findUnique({ where: { email: data.email } });
    if (existing) {
      throw new ApiError(409, "An account with this email already exists");
    }

    const passwordHash = await hashPassword(data.password);
    // Public signup is ALWAYS pharmacist role — admin accounts are created
    // with scripts/create-admin.ts.
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
      role: "pharmacist",
    };
    await setSessionCookie(sessionUser);

    return NextResponse.json({ user: sessionUser }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "Signup", "Failed to create account");
  }
}
