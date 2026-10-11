import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { FLOORS } from "@/lib/auth";
import { dateString, handleApiError, readJson, requireUser, ApiError } from "@/lib/api";

// GET /api/patients?floor=9 — list patients for a floor with aggregated stats.
// Optimized: uses `select` + parallel aggregate queries instead of deep includes.
export async function GET(request: NextRequest) {
  try {
    const session = await requireUser();
    const floor = request.nextUrl.searchParams.get("floor") ?? session.floor;
    if (!(FLOORS as readonly string[]).includes(floor)) {
      throw new ApiError(400, "Invalid floor");
    }

    // 1. Fetch patients (only needed columns, no deep include).
    const patients = await db.patient.findMany({
      where: { floor },
      orderBy: { admissionDate: "desc" },
      select: {
        id: true,
        patientRef: true,
        name: true,
        floor: true,
        admissionDate: true,
        dischargeDate: true,
        roomNumber: true,
        status: true,
      },
    });

    const patientIds = patients.map((p) => p.id);

    // 2. Parallel: count prescriptions + fetch item totals (only needed fields).
    const [dayCounts, items] = await Promise.all([
      db.dailyPrescription.groupBy({
        by: ["patientId"],
        where: { patientId: { in: patientIds } },
        _count: { _all: true },
      }),
      db.prescriptionItem.findMany({
        where: { prescription: { patientId: { in: patientIds } } },
        select: {
          quantity: true,
          unitPrice: true,
          prescription: { select: { patientId: true } },
        },
      }),
    ]);

    // 3. Build lookup maps (O(n) in JS, no further DB round-trips).
    const countMap = new Map<string, number>();
    dayCounts.forEach((d) => countMap.set(d.patientId, d._count._all));

    const totalMap = new Map<string, number>();
    for (const item of items) {
      const pid = item.prescription.patientId;
      totalMap.set(pid, (totalMap.get(pid) ?? 0) + item.quantity * item.unitPrice);
    }

    // 4. Assemble response.
    const result = patients.map((p) => ({
      id: p.id,
      patientRef: p.patientRef,
      name: p.name,
      floor: p.floor,
      admissionDate: p.admissionDate,
      dischargeDate: p.dischargeDate,
      roomNumber: p.roomNumber,
      status: p.status,
      daysCount: countMap.get(p.id) ?? 0,
      totalInvoice: totalMap.get(p.id) ?? 0,
    }));

    return NextResponse.json({ patients: result });
  } catch (error) {
    return handleApiError(error, "GET /api/patients", "Failed to fetch patients");
  }
}

const createSchema = z.object({
  name: z.string().trim().min(1, "Patient name is required").max(120),
  patientRef: z.string().trim().max(60, "Patient ID too long").optional().or(z.literal("")),
  floor: z.enum(FLOORS, { message: "Select a valid floor" }),
  admissionDate: dateString("Admission date is required"),
  roomNumber: z.string().trim().max(40).optional().or(z.literal("")),
  status: z.enum(["active", "discharged"]).optional().default("active"),
});

// POST /api/patients — create a new patient
export async function POST(request: NextRequest) {
  try {
    await requireUser();
    const data = createSchema.parse(await readJson(request));

    const patient = await db.patient.create({
      data: {
        name: data.name,
        patientRef: data.patientRef ?? "",
        floor: data.floor,
        admissionDate: new Date(data.admissionDate),
        roomNumber: data.roomNumber ?? "",
        status: data.status,
      },
    });

    return NextResponse.json({ patient }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "POST /api/patients", "Failed to create patient");
  }
}
