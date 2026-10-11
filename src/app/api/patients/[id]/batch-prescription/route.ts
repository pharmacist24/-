import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { dateString, handleApiError, readJson, requireUser, ApiError } from "@/lib/api";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/patients/[id]/batch-prescription
 *
 * Creates a full prescription day + all drug items in a SINGLE database
 * transaction. Replaces the old N+1 pattern of:
 *   1. POST /api/patients/{id}/prescriptions (create day)
 *   2. For each item: POST /api/prescriptions/{dayId}/items (create item)
 *
 * Now: one HTTP request → one DB transaction → one response.
 */
const batchSchema = z.object({
  date: dateString("Date is required"),
  items: z
    .array(
      z.object({
        drugId: z.string().min(1),
        quantity: z.number().int().min(1, "Quantity must be at least 1").max(10000),
      })
    )
    .min(1, "At least one drug is required")
    .max(200, "Too many drugs in one prescription"),
});

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    await requireUser();
    const { id: patientId } = await params;
    const data = batchSchema.parse(await readJson(request));

    // Verify patient exists.
    const patient = await db.patient.findUnique({
      where: { id: patientId },
      select: { id: true },
    });
    if (!patient) throw new ApiError(404, "Patient not found");

    // Fetch all drug snapshots in ONE query (not N queries).
    const drugIds = [...new Set(data.items.map((it) => it.drugId))];
    const drugs = await db.drug.findMany({
      where: { id: { in: drugIds } },
      select: { id: true, item: true, unitPrice: true },
    });
    const drugMap = new Map(drugs.map((d) => [d.id, d]));

    const missing = drugIds.filter((id) => !drugMap.has(id));
    if (missing.length > 0) {
      throw new ApiError(404, `Drug(s) not found: ${missing.join(", ")}`);
    }

    // Create the day + all items in a single transaction.
    const date = new Date(data.date);
    const result = await db.$transaction(async (tx) => {
      // Upsert the prescription day (one per patient per date).
      const day = await tx.dailyPrescription.upsert({
        where: { patientId_date: { patientId, date } },
        create: { patientId, date },
        update: {},
      });

      // Batch-create all items in a single INSERT.
      await tx.prescriptionItem.createMany({
        data: data.items.map((it) => {
          const drug = drugMap.get(it.drugId)!;
          return {
            prescriptionId: day.id,
            drugId: it.drugId,
            drugName: drug.item, // snapshot
            quantity: it.quantity,
            unitPrice: drug.unitPrice ?? 0, // snapshot
          };
        }),
      });

      return day;
    });

    return NextResponse.json(
      { prescription: { id: result.id }, itemsCount: data.items.length },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error, "Batch prescription", "Failed to create prescription");
  }
}
