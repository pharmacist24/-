import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { FLOORS } from "@/lib/auth";
import { dateString, handleApiError, readJson, requireUser } from "@/lib/api";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/patients/[id] — patient detail with all daily prescriptions + items
export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    await requireUser();
    const { id } = await params;
    const patient = await db.patient.findUnique({
      where: { id },
      include: {
        prescriptions: {
          orderBy: { date: "asc" },
          include: { items: { orderBy: { createdAt: "asc" } } },
        },
      },
    });
    if (!patient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    // Compute daily invoices + total.
    const days = patient.prescriptions.map((dp) => {
      const dayTotal = dp.items.reduce(
        (s, it) => s + it.quantity * it.unitPrice,
        0
      );
      return {
        id: dp.id,
        date: dp.date,
        notes: dp.notes,
        items: dp.items.map((it) => ({
          id: it.id,
          drugId: it.drugId,
          drugName: it.drugName,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          lineTotal: it.quantity * it.unitPrice,
        })),
        dayInvoice: dayTotal,
      };
    });

    const totalInvoice = days.reduce((s, d) => s + d.dayInvoice, 0);

    return NextResponse.json({
      patient: {
        id: patient.id,
        patientRef: patient.patientRef,
        name: patient.name,
        floor: patient.floor,
        admissionDate: patient.admissionDate,
        dischargeDate: patient.dischargeDate,
        roomNumber: patient.roomNumber,
        status: patient.status,
        days,
        totalInvoice,
        daysCount: days.length,
      },
    });
  } catch (error) {
    return handleApiError(error, "GET /api/patients/[id]", "Failed to fetch patient");
  }
}

const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  admissionDate: dateString("Invalid admission date").optional(),
  dischargeDate: dateString("Invalid discharge date").or(z.literal("")).nullable().optional(),
  roomNumber: z.string().trim().max(40).optional(),
  status: z.enum(["active", "discharged"]).optional(),
  floor: z.enum(FLOORS, { message: "Select a valid floor" }).optional(),
});

// PUT /api/patients/[id] — update patient
export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    await requireUser();
    const { id } = await params;
    const data = updateSchema.parse(await readJson(request));

    // A missing patient surfaces as Prisma P2025 → 404.
    const patient = await db.patient.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.admissionDate !== undefined
          ? { admissionDate: new Date(data.admissionDate) }
          : {}),
        ...(data.dischargeDate !== undefined
          ? { dischargeDate: data.dischargeDate ? new Date(data.dischargeDate) : null }
          : {}),
        ...(data.roomNumber !== undefined ? { roomNumber: data.roomNumber } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.floor !== undefined ? { floor: data.floor } : {}),
      },
    });

    return NextResponse.json({ patient });
  } catch (error) {
    return handleApiError(error, "PUT /api/patients/[id]", "Failed to update patient");
  }
}

// DELETE /api/patients/[id] — delete patient (cascades to prescriptions + items)
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    await requireUser();
    const { id } = await params;
    await db.patient.delete({ where: { id } });
    return NextResponse.json({ deleted: true, id });
  } catch (error) {
    return handleApiError(error, "DELETE /api/patients/[id]", "Failed to delete patient");
  }
}
