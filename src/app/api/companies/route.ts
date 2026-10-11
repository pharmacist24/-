import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

// GET /api/companies — list all prefilled companies
export async function GET() {
  try {
    const companies = await db.company.findMany({
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ companies });
  } catch (error) {
    console.error("GET /api/companies failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch companies" },
      { status: 500 }
    );
  }
}

const companySchema = z.object({
  name: z.string().trim().min(1, "Company name is required").max(120),
});

// POST /api/companies — add a new prefilled company (admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const data = companySchema.parse(body);

    const company = await db.company.upsert({
      where: { name: data.name },
      create: { name: data.name },
      update: {},
    });
    return NextResponse.json({ company }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    console.error("POST /api/companies failed:", error);
    return NextResponse.json({ error: "Failed to add company" }, { status: 500 });
  }
}
