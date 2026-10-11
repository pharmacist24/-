import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handleApiError, parseDate, requireUser, ApiError } from "@/lib/api";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// POST /api/prescriptions/[id]/duplicate
// Duplicates the source day's items into a NEW day (next calendar day by
// default, or a ?date=YYYY-MM-DD query param). The new day becomes editable.
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    await requireUser();
    const { id: sourcePrescriptionId } = await params;

    const source = await db.dailyPrescription.findUnique({
      where: { id: sourcePrescriptionId },
      include: { items: true },
    });
    if (!source) throw new ApiError(404, "Source prescription not found");

    // Determine the new day's date: next calendar day after the source.
    const dateParam = request.nextUrl.searchParams.get("date");
    const newDate = dateParam
      ? parseDate(dateParam)
      : new Date(source.date.getTime() + DAY_MS);

    // All-or-nothing, and never append a second copy of the items onto a day
    // that already has drugs (e.g. a double-click on "Duplicate").
    const result = await db.$transaction(async (tx) => {
      const existing = await tx.dailyPrescription.findUnique({
        where: { patientId_date: { patientId: source.patientId, date: newDate } },
        select: { id: true, _count: { select: { items: true } } },
      });
      if (existing && existing._count.items > 0) {
        throw new ApiError(409, "A prescription with drugs already exists for that day");
      }

      const target =
        existing ??
        (await tx.dailyPrescription.create({
          data: { patientId: source.patientId, date: newDate, notes: source.notes },
          select: { id: true, _count: { select: { items: true } } },
        }));

      // Copy all items (fresh IDs, snapshots of drugName + unitPrice so the
      // duplicate is independently editable).
      if (source.items.length > 0) {
        await tx.prescriptionItem.createMany({
          data: source.items.map((it) => ({
            prescriptionId: target.id,
            drugId: it.drugId,
            drugName: it.drugName,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
          })),
        });
      }

      return tx.dailyPrescription.update({
        where: { id: target.id },
        data: { notes: source.notes },
        include: { items: true },
      });
    });

    return NextResponse.json({ prescription: result }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "Duplicate prescription", "Failed to duplicate prescription");
  }
}
