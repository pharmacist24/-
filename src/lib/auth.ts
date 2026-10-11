import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

const JWT_SECRET = process.env.JWT_SECRET || "mediprice-dev-secret-change-me";
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
  return jwt.sign(user, JWT_SECRET, { expiresIn: `${SESSION_MAX_AGE_DAYS}d` });
}

export function verifySession(token: string): SessionUser | null {
  try {
    return jwt.verify(token, JWT_SECRET) as SessionUser;
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
