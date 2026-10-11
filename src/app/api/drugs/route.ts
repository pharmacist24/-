import { NextRequest, NextResponse } from "next/server";
import { catalog } from "@/lib/catalog";
import { coerceDrugInput } from "@/lib/drug-validation";

// GET /api/drugs — list all drugs (optionally ?q=search term)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim();
    const drugs = await catalog.list(q);
    return NextResponse.json({ drugs, readOnly: catalog.isReadOnly });
  } catch (error) {
    console.error("GET /api/drugs failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch drugs" },
      { status: 500 }
    );
  }
}

// POST /api/drugs — create a new drug
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }
    const data = coerceDrugInput(body);
    const drug = await catalog.create(data);
    return NextResponse.json({ drug }, { status: 201 });
  } catch (error) {
    console.error("POST /api/drugs failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to create drug";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// DELETE /api/drugs — bulk reset to seed data
export async function DELETE() {
  try {
    const count = await catalog.reset();
    return NextResponse.json({ reset: true, count });
  } catch (error) {
    console.error("DELETE /api/drugs failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to reset catalog";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
