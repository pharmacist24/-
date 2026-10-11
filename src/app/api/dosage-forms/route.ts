import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

// GET /api/dosage-forms — list all prefilled dosage forms
export async function GET() {
  try {
    const forms = await db.dosageForm.findMany({
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ dosageForms: forms });
  } catch (error) {
    console.error("GET /api/dosage-forms failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch dosage forms" },
      { status: 500 }
    );
  }
}

const formSchema = z.object({
  name: z.string().trim().min(1, "Dosage form is required").max(80),
});

// POST /api/dosage-forms — add a new prefilled dosage form (admin only)
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
    const data = formSchema.parse(body);

    const form = await db.dosageForm.upsert({
      where: { name: data.name },
      create: { name: data.name },
      update: {},
    });
    return NextResponse.json({ dosageForm: form }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    console.error("POST /api/dosage-forms failed:", error);
    return NextResponse.json(
      { error: "Failed to add dosage form" },
      { status: 500 }
    );
  }
}
