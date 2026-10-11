import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { getSession, type SessionUser } from "@/lib/auth";

// Shared helpers for API route handlers: auth guards, body parsing, date
// validation and a single error → HTTP response mapping.

/** Thrown inside a handler to short-circuit with a specific HTTP status. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

/** Returns the signed-in user or throws 401. */
export async function requireUser(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) throw new ApiError(401, "Sign in required");
  return session;
}

/** Returns the signed-in admin or throws 401/403. */
export async function requireAdmin(): Promise<SessionUser> {
  const session = await requireUser();
  if (session.role !== "admin") throw new ApiError(403, "Admin access required");
  return session;
}

/** Parses a JSON request body or throws 400. */
export async function readJson(request: Request): Promise<unknown> {
  const body = await request.json().catch(() => null);
  if (body === null || typeof body !== "object") {
    throw new ApiError(400, "Invalid JSON body");
  }
  return body;
}

/** Zod string that must parse to a valid date. */
export const dateString = (message = "Invalid date") =>
  z
    .string()
    .min(1, message)
    .refine((v) => !Number.isNaN(new Date(v).getTime()), message);

/** Parses a date string or throws 400. */
export function parseDate(value: string, field = "date"): Date {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new ApiError(400, `Invalid ${field}`);
  return d;
}

/**
 * Converts any thrown error into a JSON error response. Validation errors
 * become 400, missing records 404, unique-constraint clashes 409, and
 * everything else a generic 500 (details are logged, not leaked).
 */
export function handleApiError(
  error: unknown,
  context: string,
  fallbackMessage = "Request failed"
): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { error: error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (error.code === "P2002") {
      return NextResponse.json({ error: "Already exists" }, { status: 409 });
    }
  }
  console.error(`${context} failed:`, error);
  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}
