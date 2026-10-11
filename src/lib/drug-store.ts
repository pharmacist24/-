"use client";

import { create } from "zustand";
import { SEED_DRUGS, type Drug } from "@/lib/drug-data";
import { drugsApi, type NewDrug } from "@/lib/drugs-api";

const CACHE_KEY = "mediprice-drug-catalog-v1";
// Cache TTL: refetch from API if older than this (5 minutes).
const CACHE_TTL_MS = 5 * 60 * 1000;

interface CachedCatalog {
  drugs: Drug[];
  readOnly: boolean;
  cachedAt: number;
}

function loadCache(): CachedCatalog | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedCatalog;
    if (!parsed.drugs || !Array.isArray(parsed.drugs)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveCache(drugs: Drug[], readOnly: boolean) {
  if (typeof window === "undefined") return;
  try {
    const cache: CachedCatalog = { drugs, readOnly, cachedAt: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* ignore quota errors */
  }
}

interface DrugStoreState {
  drugs: Drug[];
  hydrated: boolean;
  loading: boolean;
  error: string | null;
  readOnly: boolean;
  /** Last time the catalog was fetched from the API. */
  lastFetchedAt: number | null;
  /** Load drugs: instant from localStorage cache, then background-sync with API. */
  loadDrugs: () => Promise<void>;
  /** Force-refresh from the API (used after mutations that change server state). */
  refreshFromApi: () => Promise<void>;
  /** Add a new drug (persisted to DB + local cache). Returns the created drug. */
  addDrug: (data: NewDrug & { id?: string }) => Promise<Drug>;
  /** Update an existing drug by id (persisted to DB + local cache). */
  updateDrug: (id: string, data: NewDrug) => Promise<void>;
  /** Delete a drug by id (persisted to DB + local cache). */
  deleteDrug: (id: string) => Promise<void>;
  /** Reset the catalog back to the original seed data (DB-side). */
  resetToSeed: () => Promise<void>;
}

export const useDrugStore = create<DrugStoreState>()((set, get) => ({
  // Start with seed so the very first SSR/CSR paint isn't empty.
  drugs: SEED_DRUGS,
  hydrated: false,
  loading: false,
  error: null,
  readOnly: false,
  lastFetchedAt: null,

  loadDrugs: async () => {
    // 1. Instant load from localStorage cache (if fresh enough or even stale).
    const cache = loadCache();
    if (cache) {
      set({
        drugs: cache.drugs,
        readOnly: cache.readOnly,
        hydrated: true,
        loading: false,
      });
      // If the cache is still fresh (< 5 min), don't even hit the API.
      if (Date.now() - cache.cachedAt < CACHE_TTL_MS) {
        return;
      }
    }
    // 2. Background-sync with the API (non-blocking).
    void get().refreshFromApi();
  },

  refreshFromApi: async () => {
    set({ loading: true, error: null });
    try {
      const { drugs, readOnly } = await drugsApi.list();
      set({
        drugs,
        readOnly,
        hydrated: true,
        loading: false,
        lastFetchedAt: Date.now(),
      });
      saveCache(drugs, readOnly);
    } catch (e) {
      set((state) => ({
        loading: false,
        hydrated: true,
        error: e instanceof Error ? e.message : "Failed to load drugs",
        // Keep existing drugs (from cache or seed) so the UI stays usable.
        drugs: state.drugs,
      }));
    }
  },

  addDrug: async (data) => {
    const drug = await drugsApi.create(data);
    set((state) => {
      const drugs = [drug, ...state.drugs];
      saveCache(drugs, state.readOnly);
      return { drugs };
    });
    return drug;
  },

  updateDrug: async (id, data) => {
    const updated = await drugsApi.update(id, data);
    set((state) => {
      const drugs = state.drugs.map((d) => (d.id === id ? updated : d));
      saveCache(drugs, state.readOnly);
      return { drugs };
    });
  },

  deleteDrug: async (id) => {
    await drugsApi.remove(id);
    set((state) => {
      const drugs = state.drugs.filter((d) => d.id !== id);
      saveCache(drugs, state.readOnly);
      return { drugs };
    });
  },

  resetToSeed: async () => {
    await drugsApi.reset();
    // After reset, force-refresh from the freshly-reset DB.
    await get().refreshFromApi();
  },
}));
