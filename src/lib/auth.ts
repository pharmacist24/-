import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

const DEV_JWT_SECRET = "mediprice-dev-secret-change-me";
const COOKIE_NAME = "mediprice_session";
const SESSION_MAX_AGE_DAYS = 7;

export const FLOORS = [
  "10",
  "9",
  "8",
  "6",
  "5",
  "4",
  "3",
  "2",
  "rcu",
  "dialysis",
  "nicu",
] as const;

export type Floor = (typeof FLOORS)[number];

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  floor: string;
  role: "pharmacist" | "admin";
}

export function floorLabel(floor: string): string {
  const map: Record<string, string> = {
    "10": "Floor 10",
    "9": "Floor 9",
    "8": "Floor 8",
    "6": "Floor 6",
    "5": "Floor 5",
    "4": "Floor 4",
    "3": "Floor 3",
    "2": "Floor 2",
    rcu: "RCU",
    dialysis: "Dialysis",
    nicu: "NICU",
  };
  return map[floor] ?? floor;
}

// In production a missing JWT_SECRET would let anyone forge an admin session
// with the public dev secret, so refuse to sign or verify sessions instead.
function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET environment variable is not set");
  }
  return DEV_JWT_SECRET;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signSession(user: SessionUser): string {
  // Sign only the session fields (not whatever extra props the object has).
  const payload: SessionUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    floor: user.floor,
    role: user.role,
  };
  return jwt.sign(payload, jwtSecret(), {
    expiresIn: `${SESSION_MAX_AGE_DAYS}d`,
    algorithm: "HS256",
  });
}

export function verifySession(token: string): SessionUser | null {
  const secret = jwtSecret();
  try {
    const decoded = jwt.verify(token, secret, { algorithms: ["HS256"] });
    if (typeof decoded !== "object" || !decoded.id || !decoded.role) return null;
    return {
      id: decoded.id,
      email: decoded.email,
      name: decoded.name,
      floor: decoded.floor,
      role: decoded.role === "admin" ? "admin" : "pharmacist",
    };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function setSessionCookie(user: SessionUser): Promise<void> {
  const store = await cookies();
  const token = signSession(user);
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export { COOKIE_NAME };
