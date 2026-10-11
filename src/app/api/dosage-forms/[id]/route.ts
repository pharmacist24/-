import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// DELETE /api/dosage-forms/[id] — remove a prefilled dosage form (admin only)
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }
    const { id } = await params;
    await db.dosageForm.delete({ where: { id } });
    return NextResponse.json({ deleted: true, id });
  } catch (error) {
    console.error("DELETE /api/dosage-forms/[id] failed:", error);
    return NextResponse.json(
      { error: "Failed to delete dosage form" },
      { status: 500 }
    );
  }
}
