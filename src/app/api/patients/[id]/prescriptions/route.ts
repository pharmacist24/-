import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { dateString, handleApiError, readJson, requireUser, ApiError } from "@/lib/api";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const createSchema = z.object({
  date: dateString("Date is required"),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

// GET /api/patients/[id]/prescriptions — list all daily prescriptions for a patient
export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    await requireUser();
    const { id } = await params;
    const prescriptions = await db.dailyPrescription.findMany({
      where: { patientId: id },
      orderBy: { date: "asc" },
      include: { items: { orderBy: { createdAt: "asc" } } },
    });
    return NextResponse.json({ prescriptions });
  } catch (error) {
    return handleApiError(error, "GET prescriptions", "Failed to fetch prescriptions");
  }
}

// POST /api/patients/[id]/prescriptions — create a new daily prescription for a patient
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    await requireUser();
    const { id: patientId } = await params;
    const data = createSchema.parse(await readJson(request));

    const patient = await db.patient.findUnique({
      where: { id: patientId },
      select: { id: true },
    });
    if (!patient) throw new ApiError(404, "Patient not found");

    // Upsert: one prescription per patient per date.
    const date = new Date(data.date);
    const prescription = await db.dailyPrescription.upsert({
      where: { patientId_date: { patientId, date } },
      create: { patientId, date, notes: data.notes ?? "" },
      update: { notes: data.notes ?? "" },
      include: { items: true },
    });

    return NextResponse.json({ prescription }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "POST prescription", "Failed to create prescription");
  }
}
