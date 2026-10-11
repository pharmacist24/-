import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { handleApiError, readJson, requireUser, ApiError } from "@/lib/api";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const addSchema = z.object({
  drugId: z.string().min(1, "Drug is required"),
  quantity: z.number().int().min(1, "Quantity must be at least 1").max(10000),
});

// POST /api/prescriptions/[id]/items — add a drug to a daily prescription
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    await requireUser();
    const { id: prescriptionId } = await params;
    const data = addSchema.parse(await readJson(request));

    const [prescription, drug] = await Promise.all([
      db.dailyPrescription.findUnique({
        where: { id: prescriptionId },
        select: { id: true },
      }),
      db.drug.findUnique({
        where: { id: data.drugId },
        select: { id: true, item: true, unitPrice: true },
      }),
    ]);
    if (!prescription) throw new ApiError(404, "Prescription not found");
    if (!drug) throw new ApiError(404, "Drug not found");

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
    return handleApiError(error, "POST item", "Failed to add drug");
  }
}

// DELETE /api/prescriptions/[id]/items?itemId=... — remove an item
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    await requireUser();
    const { id: prescriptionId } = await params;
    const itemId = request.nextUrl.searchParams.get("itemId");
    if (!itemId) throw new ApiError(400, "itemId is required");

    const { count } = await db.prescriptionItem.deleteMany({
      where: { id: itemId, prescriptionId },
    });
    if (count === 0) throw new ApiError(404, "Item not found");

    return NextResponse.json({ deleted: true, itemId });
  } catch (error) {
    return handleApiError(error, "DELETE item", "Failed to remove drug");
  }
}
