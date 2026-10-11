import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handleApiError, requireAdmin } from "@/lib/api";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// DELETE /api/companies/[id] — remove a prefilled company (admin only)
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    await requireAdmin();
    const { id } = await params;
    await db.company.delete({ where: { id } });
    return NextResponse.json({ deleted: true, id });
  } catch (error) {
    return handleApiError(error, "DELETE /api/companies/[id]", "Failed to delete company");
  }
}
