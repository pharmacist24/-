"use client";

import type { Drug } from "@/lib/drug-data";

// Typed shape returned by the API (Drug + timestamps).
export interface DrugRecord extends Drug {
  createdAt?: string;
  updatedAt?: string;
}

const API_BASE = "/api/drugs";

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

export type NewDrug = Omit<Drug, "id">;

export const drugsApi = {
  async list(): Promise<{ drugs: Drug[]; readOnly: boolean }> {
    const res = await fetch(API_BASE, { cache: "no-store" });
    const data = await handle<{ drugs: Drug[]; readOnly: boolean }>(res);
    return { drugs: data.drugs, readOnly: Boolean(data.readOnly) };
  },

  async create(data: NewDrug): Promise<Drug> {
    const res = await fetch(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await handle<{ drug: Drug }>(res);
    return json.drug;
  },

  async update(id: string, data: NewDrug): Promise<Drug> {
    const res = await fetch(`${API_BASE}/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await handle<{ drug: Drug }>(res);
    return json.drug;
  },

  async remove(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    await handle<{ deleted: boolean }>(res);
  },

  async reset(): Promise<number> {
    const res = await fetch(API_BASE, { method: "DELETE" });
    const json = await handle<{ count: number }>(res);
    return json.count;
  },
};
