import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession, FLOORS } from "@/lib/auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/patients/[id] — patient detail with all daily prescriptions + items
export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
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
    console.error("GET /api/patients/[id] failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch patient" },
      { status: 500 }
    );
  }
}

const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  admissionDate: z.string().min(1).optional(),
  dischargeDate: z.string().nullable().optional(),
  roomNumber: z.string().trim().max(40).optional(),
  status: z.enum(["active", "discharged"]).optional(),
  floor: z.enum(FLOORS as unknown as [string, ...string[]]).optional(),
});

// PUT /api/patients/[id] — update patient
export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }
    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const data = updateSchema.parse(body);

    const existing = await db.patient.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

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
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    console.error("PUT /api/patients/[id] failed:", error);
    return NextResponse.json(
      { error: "Failed to update patient" },
      { status: 500 }
    );
  }
}

// DELETE /api/patients/[id] — delete patient (cascades to prescriptions + items)
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }
    const { id } = await params;
    await db.patient.delete({ where: { id } });
    return NextResponse.json({ deleted: true, id });
  } catch (error) {
    console.error("DELETE /api/patients/[id] failed:", error);
    return NextResponse.json(
      { error: "Failed to delete patient" },
      { status: 500 }
    );
  }
}
