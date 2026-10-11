import { NextRequest, NextResponse } from "next/server";
import { catalog } from "@/lib/catalog";
import { coerceDrugInput } from "@/lib/drug-validation";
import { handleApiError, readJson, requireAdmin } from "@/lib/api";

// GET /api/drugs — list all drugs (optionally ?q=search term)
export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get("q")?.trim().slice(0, 200);
    const drugs = await catalog.list(q);
    return NextResponse.json({ drugs, readOnly: catalog.isReadOnly });
  } catch (error) {
    return handleApiError(error, "GET /api/drugs", "Failed to fetch drugs");
  }
}

// POST /api/drugs — create a new drug (admin only)
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const data = coerceDrugInput(await readJson(request));
    const drug = await catalog.create(data);
    return NextResponse.json({ drug }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "POST /api/drugs", "Failed to create drug");
  }
}

// DELETE /api/drugs — bulk reset to seed data (admin only)
export async function DELETE() {
  try {
    await requireAdmin();
    const count = await catalog.reset();
    return NextResponse.json({ reset: true, count });
  } catch (error) {
    return handleApiError(error, "DELETE /api/drugs", "Failed to reset catalog");
  }
}
