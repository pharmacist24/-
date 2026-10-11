import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const createSchema = z.object({
  date: z.string().min(1, "Date is required"),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

// GET /api/patients/[id]/prescriptions — list all daily prescriptions for a patient
export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const prescriptions = await db.dailyPrescription.findMany({
      where: { patientId: id },
      orderBy: { date: "asc" },
      include: { items: { orderBy: { createdAt: "asc" } } },
    });
    return NextResponse.json({ prescriptions });
  } catch (error) {
    console.error("GET prescriptions failed:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

// POST /api/patients/[id]/prescriptions — create a new daily prescription for a patient
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
    const data = createSchema.parse(body);

    const patient = await db.patient.findUnique({ where: { id: patientId } });
    if (!patient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    // Upsert: one prescription per patient per date.
    const prescription = await db.dailyPrescription.upsert({
      where: { patientId_date: { patientId, date: new Date(data.date) } },
      create: {
        patientId,
        date: new Date(data.date),
        notes: data.notes ?? "",
      },
      update: {
        notes: data.notes ?? "",
      },
      include: { items: true },
    });

    return NextResponse.json({ prescription }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    console.error("POST prescription failed:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
