import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

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
  date: z.string().min(1, "Date is required"),
  items: z.array(
    z.object({
      drugId: z.string().min(1),
      quantity: z.number().int().min(1),
    })
  ).min(1, "At least one drug is required"),
});

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const { id: patientId } = await params;
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const data = batchSchema.parse(body);

    // Verify patient exists.
    const patient = await db.patient.findUnique({
      where: { id: patientId },
      select: { id: true, name: true }, // only fetch what we need
    });
    if (!patient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    // Fetch all drug snapshots in ONE query (not N queries).
    const drugIds = data.items.map((it) => it.drugId);
    const drugs = await db.drug.findMany({
      where: { id: { in: drugIds } },
      select: { id: true, item: true, unitPrice: true }, // only needed fields
    });
    const drugMap = new Map(drugs.map((d) => [d.id, d]));

    // Validate all drugs exist.
    const missing = drugIds.filter((id) => !drugMap.has(id));
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Drug(s) not found: ${missing.join(", ")}` },
        { status: 404 }
      );
    }

    // Create the day + all items in a single transaction.
    const result = await db.$transaction(async (tx) => {
      // Upsert the prescription day (one per patient per date).
      const day = await tx.dailyPrescription.upsert({
        where: {
          patientId_date: {
            patientId,
            date: new Date(data.date),
          },
        },
        create: {
          patientId,
          date: new Date(data.date),
        },
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
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    console.error("Batch prescription failed:", error);
    return NextResponse.json(
      { error: "Failed to create prescription" },
      { status: 500 }
    );
  }
}
