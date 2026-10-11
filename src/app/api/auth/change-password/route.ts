import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { handleApiError, readJson, requireUser, ApiError } from "@/lib/api";

const schema = z.object({
  currentPassword: z.string().min(1, "Current password is required").max(200),
  newPassword: z
    .string()
    .min(6, "New password must be at least 6 characters")
    .max(200, "New password is too long"),
});

// POST /api/auth/change-password — change the current user's password
export async function POST(request: NextRequest) {
  try {
    const session = await requireUser();
    const data = schema.parse(await readJson(request));

    const user = await db.user.findUnique({ where: { id: session.id } });
    if (!user) throw new ApiError(404, "User not found");

    const valid = await verifyPassword(data.currentPassword, user.passwordHash);
    if (!valid) throw new ApiError(400, "Current password is incorrect");

    await db.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(data.newPassword) },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, "Change password", "Failed to change password");
  }
}
