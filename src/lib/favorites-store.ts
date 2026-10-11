"use client";

import { create } from "zustand";

interface FavoritesState {
  /** Favorited drug ids for the current floor. */
  favorites: string[];
  hydrated: boolean;
  loading: boolean;
  floor: string | null;
  loadFavorites: (floor: string) => Promise<void>;
  toggleFavorite: (drugId: string, floor: string) => Promise<boolean>;
  isFavorite: (drugId: string) => boolean;
  clearFavorites: () => void;
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

function cacheKey(floor: string) {
  return `mediprice-favorites-${floor}`;
}

function loadCache(floor: string): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(cacheKey(floor));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed as string[];
  } catch {
    return null;
  }
}

function saveCache(floor: string, favorites: string[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(cacheKey(floor), JSON.stringify(favorites));
  } catch {
    /* ignore */
  }
}

export const useFavoritesStore = create<FavoritesState>()((set, get) => ({
  favorites: [],
  hydrated: false,
  loading: false,
  floor: null,

  loadFavorites: async (floor) => {
    // 1. Instant load from localStorage cache.
    const cached = loadCache(floor);
    if (cached) {
      set({ favorites: cached, hydrated: true, loading: false, floor });
    } else {
      set({ floor, loading: true });
    }
    // 2. Background-sync with API (non-blocking).
    try {
      const data = await handle<{ favorites: string[] }>(
        await fetch(`/api/favorites?floor=${encodeURIComponent(floor)}`, {
          cache: "no-store",
        })
      );
      set({
        favorites: data.favorites ?? [],
        hydrated: true,
        loading: false,
      });
      saveCache(floor, data.favorites ?? []);
    } catch {
      // Keep cached data if API fails.
      set({ hydrated: true, loading: false });
    }
  },

  toggleFavorite: async (drugId, floor) => {
    const isFav = get().favorites.includes(drugId);

    // Optimistic update — flip the star immediately + update cache.
    const newFavs = isFav
      ? get().favorites.filter((f) => f !== drugId)
      : [...get().favorites, drugId];
    set({ favorites: newFavs });
    saveCache(floor, newFavs);

    try {
      if (isFav) {
        await fetch(
          `/api/favorites?drugId=${encodeURIComponent(
            drugId
          )}&floor=${encodeURIComponent(floor)}`,
          { method: "DELETE" }
        );
        return false;
      } else {
        await handle(
          await fetch("/api/favorites", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ drugId, floor }),
          })
        );
        return true;
      }
    } catch (e) {
      // Revert on failure + update cache.
      set((s) => ({
        favorites: isFav
          ? [...s.favorites, drugId]
          : s.favorites.filter((f) => f !== drugId),
      }));
      saveCache(floor, get().favorites);
      throw e;
    }
  },

  isFavorite: (drugId) => get().favorites.includes(drugId),

  clearFavorites: () => set({ favorites: [], hydrated: false, floor: null }),
}));
