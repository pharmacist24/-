"use client";

import { create } from "zustand";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  floor: string;
  role: "pharmacist" | "admin";
}

interface AuthState {
  user: SessionUser | null;
  hydrated: boolean;
  loading: boolean;
  hydrate: () => Promise<void>;
  signup: (data: {
    name: string;
    email: string;
    password: string;
    floor: string;
  }) => Promise<SessionUser>;
  login: (email: string, password: string) => Promise<SessionUser>;
  logout: () => Promise<void>;
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  hydrated: false,
  loading: false,

  hydrate: async () => {
    set({ loading: true });
    try {
      const data = await handle<{ user: SessionUser | null }>(
        await fetch("/api/auth/me", { cache: "no-store" })
      );
      set({ user: data.user, hydrated: true, loading: false });
    } catch {
      set({ user: null, hydrated: true, loading: false });
    }
  },

  signup: async (data) => {
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await handle<{ user: SessionUser }>(res);
    set({ user: json.user });
    return json.user;
  },

  login: async (email, password) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const json = await handle<{ user: SessionUser }>(res);
    set({ user: json.user });
    return json.user;
  },

  logout: async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    set({ user: null });
  },
}));

// Floors used by the UI
export const FLOOR_OPTIONS = [
  { value: "10", label: "Floor 10" },
  { value: "9", label: "Floor 9" },
  { value: "8", label: "Floor 8" },
  { value: "6", label: "Floor 6" },
  { value: "5", label: "Floor 5" },
  { value: "4", label: "Floor 4" },
  { value: "3", label: "Floor 3" },
  { value: "2", label: "Floor 2" },
  { value: "rcu", label: "RCU" },
  { value: "dialysis", label: "Dialysis" },
  { value: "nicu", label: "NICU" },
];

export function floorLabel(floor: string): string {
  return FLOOR_OPTIONS.find((f) => f.value === floor)?.label ?? floor;
}
