// Data-access adapter for the drug catalog.
//
// On Vercel (and any serverless host) a local SQLite file is NOT a viable
// production database — the filesystem is read-only/ephemeral, so writes would
// be lost. We therefore use a hosted Postgres when `DATABASE_URL` points to one
// (provider=postgresql), and otherwise fall back to an in-memory store seeded
// from the imported Excel dataset.
//
// The in-memory fallback keeps the read-only Pharmacist lookup fully functional
// on Vercel without any external dependency. Writes (add/edit/delete) on the
// fallback return a clear "read-only demo" error so the UI fails honestly
// instead of silently losing data.
//
// To enable full CRUD on Vercel:
//   1. Create a free Postgres (Neon / Supabase / Vercel Postgres).
//   2. Set the connection string as the env var DATABASE_URL on the project.
//   3. Redeploy — the adapter automatically switches to Postgres.

import type { Drug } from "@/lib/drug-data";
import { SEED_DRUGS } from "@/lib/drug-data";
import { ApiError } from "@/lib/api";

type DrugRow = Drug;

function isPostgresConfigured(): boolean {
  const url = process.env.DATABASE_URL ?? "";
  // Prisma postgres URLs start with "postgres://" or "postgresql://"
  return /^postgres(ql)?:\/\//i.test(url);
}

// ---- Prisma-backed implementation (used when Postgres is configured) ----
async function prismaList(q?: string): Promise<DrugRow[]> {
  const { db } = await import("@/lib/db");
  // Every search term must match at least one text column (filtered in SQL).
  const terms = (q ?? "").split(/\s+/).filter(Boolean).slice(0, 10);
  const all = await db.drug.findMany({
    where: terms.length
      ? {
          AND: terms.map((t) => ({
            OR: (["item", "genericName", "company", "dosageForm"] as const).map(
              (field) => ({ [field]: { contains: t, mode: "insensitive" as const } })
            ),
          })),
        }
      : undefined,
    orderBy: { item: "asc" },
    // Only select needed columns — don't fetch timestamps.
    select: {
      id: true,
      item: true,
      genericName: true,
      dosageForm: true,
      unitPrice: true,
      company: true,
      priceOfPack: true,
      noOfTabPerPack: true,
    },
  });
  return all as DrugRow[];
}

async function prismaCreate(data: Omit<Drug, "id">): Promise<DrugRow> {
  const { db } = await import("@/lib/db");
  const id = `drug-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const drug = await db.drug.create({
    data: {
      id,
      item: data.item,
      genericName: data.genericName ?? "",
      dosageForm: data.dosageForm,
      unitPrice: data.unitPrice,
      company: data.company ?? "",
      priceOfPack: data.priceOfPack,
      noOfTabPerPack: data.noOfTabPerPack ?? "",
    },
  });
  return drug as DrugRow;
}

async function prismaUpdate(id: string, data: Omit<Drug, "id">): Promise<DrugRow> {
  const { db } = await import("@/lib/db");
  const drug = await db.drug.update({
    where: { id },
    data: {
      item: data.item,
      genericName: data.genericName ?? "",
      dosageForm: data.dosageForm,
      unitPrice: data.unitPrice,
      company: data.company ?? "",
      priceOfPack: data.priceOfPack,
      noOfTabPerPack: data.noOfTabPerPack ?? "",
    },
  });
  return drug as DrugRow;
}

async function prismaRemove(id: string): Promise<void> {
  const { db } = await import("@/lib/db");
  await db.drug.delete({ where: { id } });
}

async function prismaReset(): Promise<number> {
  const { db } = await import("@/lib/db");
  // One transaction so a failed re-seed never leaves the catalog empty.
  return db.$transaction(async (tx) => {
    await tx.drug.deleteMany({});
    await tx.drug.createMany({
      data: SEED_DRUGS.map((d) => ({
        id: d.id,
        item: d.item,
        genericName: d.genericName,
        dosageForm: d.dosageForm,
        unitPrice: d.unitPrice,
        company: d.company,
        priceOfPack: d.priceOfPack,
        noOfTabPerPack: d.noOfTabPerPack,
      })),
    });
    return tx.drug.count();
  });
}

// ---- In-memory fallback (read-only demo) ----
// One in-memory copy per serverless instance. Writes are rejected so data is
// never silently lost.
let memoryStore: DrugRow[] | null = null;
function getMemory(): DrugRow[] {
  if (!memoryStore) {
    // Sort by item asc to match the DB ordering.
    memoryStore = [...SEED_DRUGS].sort((a, b) => a.item.localeCompare(b.item));
  }
  return memoryStore;
}

function memoryList(q?: string): DrugRow[] {
  const all = getMemory();
  if (!q) return all;
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  return all.filter((d) => {
    const haystack = `${d.item} ${d.genericName} ${d.company} ${d.dosageForm}`.toLowerCase();
    return terms.every((t) => haystack.includes(t));
  });
}

const READ_ONLY_ERROR =
  "Database is running in read-only demo mode. Set a Postgres DATABASE_URL env var to enable add/edit/delete.";

// ---- Public adapter API ----
export const catalog = {
  isReadOnly: !isPostgresConfigured(),

  async list(q?: string): Promise<DrugRow[]> {
    if (isPostgresConfigured()) return prismaList(q);
    return memoryList(q);
  },

  async create(_data: Omit<Drug, "id">): Promise<DrugRow> {
    if (isPostgresConfigured()) return prismaCreate(_data);
    throw new ApiError(503, READ_ONLY_ERROR);
  },

  async update(id: string, data: Omit<Drug, "id">): Promise<DrugRow> {
    if (isPostgresConfigured()) return prismaUpdate(id, data);
    throw new ApiError(503, READ_ONLY_ERROR);
  },

  async remove(id: string): Promise<void> {
    if (isPostgresConfigured()) {
      return prismaRemove(id);
    }
    throw new ApiError(503, READ_ONLY_ERROR);
  },

  async reset(): Promise<number> {
    if (isPostgresConfigured()) return prismaReset();
    throw new ApiError(503, READ_ONLY_ERROR);
  },
};
