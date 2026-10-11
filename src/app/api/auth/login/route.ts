import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword, setSessionCookie, type SessionUser } from "@/lib/auth";
import { handleApiError, readJson, ApiError } from "@/lib/api";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Password is required").max(200),
});

// bcrypt hash of a random string, compared against when the email is unknown
// so response time doesn't reveal which emails have accounts.
const DUMMY_HASH = "$2b$10$XOzRHiaUYCtmg4CDKNW50u7ItJ/UYXhfnCVfA3WTfayZS/WPBj4Um";

export async function POST(request: NextRequest) {
  try {
    const data = loginSchema.parse(await readJson(request));

    const user = await db.user.findUnique({ where: { email: data.email } });
    const valid = await verifyPassword(data.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !valid) {
      throw new ApiError(401, "Invalid email or password");
    }

    const sessionUser: SessionUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      floor: user.floor,
      role: user.role === "admin" ? "admin" : "pharmacist",
    };
    await setSessionCookie(sessionUser);

    return NextResponse.json({ user: sessionUser });
  } catch (error) {
    return handleApiError(error, "Login", "Failed to sign in");
  }
}
