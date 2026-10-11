import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { handleApiError, readJson, requireAdmin } from "@/lib/api";

// GET /api/companies — list all prefilled companies
export async function GET() {
  try {
    const rows = await db.company.findMany({ orderBy: { name: "asc" } });
    return NextResponse.json({ companies: rows });
  } catch (error) {
    return handleApiError(error, "GET /api/companies", "Failed to fetch companies");
  }
}

const schema = z.object({
  name: z.string().trim().min(1, "Company name is required").max(120),
});

// POST /api/companies — add a new prefilled company (admin only)
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const data = schema.parse(await readJson(request));
    const company = await db.company.upsert({
      where: { name: data.name },
      create: { name: data.name },
      update: {},
    });
    return NextResponse.json({ company }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "POST /api/companies", "Failed to add company");
  }
}
