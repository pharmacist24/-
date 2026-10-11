import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handleApiError, requireAdmin } from "@/lib/api";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// DELETE /api/dosage-forms/[id] — remove a prefilled dosage form (admin only)
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    await requireAdmin();
    const { id } = await params;
    await db.dosageForm.delete({ where: { id } });
    return NextResponse.json({ deleted: true, id });
  } catch (error) {
    return handleApiError(error, "DELETE /api/dosage-forms/[id]", "Failed to delete dosage form");
  }
}
