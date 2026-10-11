import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// DELETE /api/companies/[id] — remove a prefilled company (admin only)
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }
    const { id } = await params;
    await db.company.delete({ where: { id } });
    return NextResponse.json({ deleted: true, id });
  } catch (error) {
    console.error("DELETE /api/companies/[id] failed:", error);
    return NextResponse.json(
      { error: "Failed to delete company" },
      { status: 500 }
    );
  }
}
