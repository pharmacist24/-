import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { handleApiError, readJson, requireAdmin } from "@/lib/api";

// GET /api/dosage-forms — list all prefilled dosage forms
export async function GET() {
  try {
    const rows = await db.dosageForm.findMany({ orderBy: { name: "asc" } });
    return NextResponse.json({ dosageForms: rows });
  } catch (error) {
    return handleApiError(error, "GET /api/dosage-forms", "Failed to fetch dosage forms");
  }
}

const schema = z.object({
  name: z.string().trim().min(1, "Dosage form is required").max(80),
});

// POST /api/dosage-forms — add a new prefilled dosage form (admin only)
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const data = schema.parse(await readJson(request));
    const dosageForm = await db.dosageForm.upsert({
      where: { name: data.name },
      create: { name: data.name },
      update: {},
    });
    return NextResponse.json({ dosageForm }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "POST /api/dosage-forms", "Failed to add dosage form");
  }
}
