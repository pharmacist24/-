import { z } from "zod";

// Shared validation schema for drug records (used by API routes).
export const drugInputSchema = z.object({
  item: z.string().trim().min(1, "Drug brand name is required").max(160, "Brand name is too long"),
  genericName: z.string().trim().max(160, "Generic name is too long").optional().or(z.literal("")),
  dosageForm: z.string().trim().min(1, "Dosage form is required"),
  unitPrice: z.number().nullable().refine(
    (v) => v === null || (typeof v === "number" && v >= 0),
    "Unit price must be a non-negative number"
  ),
  company: z.string().trim().max(120, "Company name is too long").optional().or(z.literal("")),
  priceOfPack: z
    .number()
    .nullable()
    .refine(
      (v) => v === null || (typeof v === "number" && v >= 0),
      "Pack price must be a non-negative number"
    ),
  noOfTabPerPack: z.string().trim().max(200, "Too long").optional().or(z.literal("")),
});

export type DrugInput = z.infer<typeof drugInputSchema>;

// Coerce loose JSON input (strings/numbers) into the strict shape.
export function coerceDrugInput(raw: unknown): DrugInput {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const toNum = (v: unknown): number | null => {
    if (v === null || v === undefined || v === "") return null;
    if (typeof v === "number") return Number.isNaN(v) ? null : v;
    const n = Number(String(v).replace(/,/g, "").trim());
    return Number.isNaN(n) ? null : n;
  };
  return drugInputSchema.parse({
    item: obj.item,
    genericName: obj.genericName ?? "",
    dosageForm: obj.dosageForm,
    unitPrice: toNum(obj.unitPrice),
    company: obj.company ?? "",
    priceOfPack: toNum(obj.priceOfPack),
    noOfTabPerPack: obj.noOfTabPerPack ?? "",
  });
}
