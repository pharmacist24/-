import { NextRequest, NextResponse } from "next/server";
import { catalog } from "@/lib/catalog";
import { coerceDrugInput } from "@/lib/drug-validation";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// PUT /api/drugs/[id] — update an existing drug
export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const data = coerceDrugInput(body);
    const drug = await catalog.update(id, data);
    return NextResponse.json({ drug });
  } catch (error) {
    console.error("PUT /api/drugs/[id] failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to update drug";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// DELETE /api/drugs/[id] — delete a single drug
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    await catalog.remove(id);
    return NextResponse.json({ deleted: true, id });
  } catch (error) {
    console.error("DELETE /api/drugs/[id] failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to delete drug";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
