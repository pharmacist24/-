import { NextRequest, NextResponse } from "next/server";
import { catalog } from "@/lib/catalog";
import { coerceDrugInput } from "@/lib/drug-validation";
import { handleApiError, readJson, requireAdmin } from "@/lib/api";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// PUT /api/drugs/[id] — update an existing drug (admin only)
export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    await requireAdmin();
    const { id } = await params;
    const data = coerceDrugInput(await readJson(request));
    const drug = await catalog.update(id, data);
    return NextResponse.json({ drug });
  } catch (error) {
    return handleApiError(error, "PUT /api/drugs/[id]", "Failed to update drug");
  }
}

// DELETE /api/drugs/[id] — delete a single drug (admin only)
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    await requireAdmin();
    const { id } = await params;
    await catalog.remove(id);
    return NextResponse.json({ deleted: true, id });
  } catch (error) {
    return handleApiError(error, "DELETE /api/drugs/[id]", "Failed to delete drug");
  }
}
