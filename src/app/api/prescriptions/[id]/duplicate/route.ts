import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST /api/prescriptions/[id]/duplicate
// Duplicates the source day's items into a NEW day (next calendar day by
// default, or a ?date=YYYY-MM-DD query param). The new day becomes editable.
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }
    const { id: sourcePrescriptionId } = await params;

    const source = await db.dailyPrescription.findUnique({
      where: { id: sourcePrescriptionId },
      include: { items: true },
    });
    if (!source) {
      return NextResponse.json(
        { error: "Source prescription not found" },
        { status: 404 }
      );
    }

    // Determine the new day's date: next calendar day after the source.
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");
    let newDate: Date;
    if (dateParam) {
      newDate = new Date(dateParam);
    } else {
      const src = new Date(source.date);
      newDate = new Date(src.getTime() + 24 * 60 * 60 * 1000);
    }

    // Upsert a new daily prescription for the new date (unique[patientId,date]).
    const newPrescription = await db.dailyPrescription.upsert({
      where: {
        patientId_date: {
          patientId: source.patientId,
          date: newDate,
        },
      },
      create: {
        patientId: source.patientId,
        date: newDate,
        notes: source.notes,
      },
      update: {
        notes: source.notes,
      },
    });

    // Copy all items from the source into the new day (fresh IDs, snapshots
    // of drugName + unitPrice so the duplicate is independently editable).
    if (source.items.length > 0) {
      await db.prescriptionItem.createMany({
        data: source.items.map((it) => ({
          prescriptionId: newPrescription.id,
          drugId: it.drugId,
          drugName: it.drugName,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
        })),
      });
    }

    const result = await db.dailyPrescription.findUnique({
      where: { id: newPrescription.id },
      include: { items: true },
    });

    return NextResponse.json({ prescription: result }, { status: 201 });
  } catch (error) {
    console.error("Duplicate prescription failed:", error);
    return NextResponse.json(
      { error: "Failed to duplicate prescription" },
      { status: 500 }
    );
  }
}
