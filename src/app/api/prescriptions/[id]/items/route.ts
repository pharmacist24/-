import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const addSchema = z.object({
  drugId: z.string().min(1, "Drug is required"),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
});

// POST /api/prescriptions/[id]/items — add a drug to a daily prescription
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }
    const { id: prescriptionId } = await params;
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const data = addSchema.parse(body);

    const prescription = await db.dailyPrescription.findUnique({
      where: { id: prescriptionId },
    });
    if (!prescription) {
      return NextResponse.json(
        { error: "Prescription not found" },
        { status: 404 }
      );
    }

    const drug = await db.drug.findUnique({ where: { id: data.drugId } });
    if (!drug) {
      return NextResponse.json({ error: "Drug not found" }, { status: 404 });
    }

    const item = await db.prescriptionItem.create({
      data: {
        prescriptionId,
        drugId: drug.id,
        drugName: drug.item,
        quantity: data.quantity,
        unitPrice: drug.unitPrice ?? 0,
      },
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    console.error("POST item failed:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

// DELETE /api/prescriptions/[id]/items?itemId=... — remove an item
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }
    const { id: prescriptionId } = await params;
    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get("itemId");
    if (!itemId) {
      return NextResponse.json({ error: "itemId is required" }, { status: 400 });
    }

    await db.prescriptionItem.deleteMany({
      where: { id: itemId, prescriptionId },
    });

    return NextResponse.json({ deleted: true, itemId });
  } catch (error) {
    console.error("DELETE item failed:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
