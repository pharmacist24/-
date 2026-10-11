import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/patients/[id]/drug-summary
// Returns the patient info + an aggregated list of every drug used across
// all prescription days (deduplicated by drugId, with total quantity and
// total cost). Used by the printable A4 drug summary view.
export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const patient = await db.patient.findUnique({
      where: { id },
      include: {
        prescriptions: {
          orderBy: { date: "asc" },
          include: { items: true },
        },
      },
    });
    if (!patient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    // Aggregate all items across days, grouped by drugId.
    const agg = new Map<
      string,
      {
        drugId: string;
        drugName: string;
        unitPrice: number;
        totalQuantity: number;
        totalCost: number;
        daysUsed: number;
      }
    >();

    for (const day of patient.prescriptions) {
      const seenThisDay = new Set<string>();
      for (const it of day.items) {
        const existing = agg.get(it.drugId);
        if (existing) {
          existing.totalQuantity += it.quantity;
          existing.totalCost += it.quantity * it.unitPrice;
          if (!seenThisDay.has(it.drugId)) {
            existing.daysUsed += 1;
            seenThisDay.add(it.drugId);
          }
        } else {
          agg.set(it.drugId, {
            drugId: it.drugId,
            drugName: it.drugName,
            unitPrice: it.unitPrice,
            totalQuantity: it.quantity,
            totalCost: it.quantity * it.unitPrice,
            daysUsed: 1,
          });
          seenThisDay.add(it.drugId);
        }
      }
    }

    const drugList = Array.from(agg.values()).map((d) => ({
      drugId: d.drugId,
      drugName: d.drugName,
      unitPrice: d.unitPrice,
      totalQuantity: d.totalQuantity,
      totalCost: d.totalCost,
      daysUsed: d.daysUsed,
    }));

    const grandTotal = drugList.reduce((s, d) => s + d.totalCost, 0);

    return NextResponse.json({
      patient: {
        id: patient.id,
        patientRef: patient.patientRef,
        name: patient.name,
        floor: patient.floor,
        admissionDate: patient.admissionDate,
        roomNumber: patient.roomNumber,
        status: patient.status,
      },
      drugList: drugList.sort((a, b) => a.drugName.localeCompare(b.drugName)),
      grandTotal,
      daysCount: patient.prescriptions.length,
    });
  } catch (error) {
    console.error("GET drug-summary failed:", error);
    return NextResponse.json(
      { error: "Failed to generate drug summary" },
      { status: 500 }
    );
  }
}
