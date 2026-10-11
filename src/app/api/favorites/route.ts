import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession, FLOORS } from "@/lib/auth";
import { handleApiError, readJson, requireUser, ApiError } from "@/lib/api";

function validFloor(floor: string): string {
  if (!(FLOORS as readonly string[]).includes(floor)) {
    throw new ApiError(400, "Invalid floor");
  }
  return floor;
}

// GET /api/favorites?floor=9 — list favorited drug ids for a floor
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    const floor = validFloor(
      request.nextUrl.searchParams.get("floor") ?? session?.floor ?? FLOORS[0]
    );
    const favorites = await db.favorite.findMany({
      where: { floor },
      select: { drugId: true },
    });
    return NextResponse.json({ favorites: favorites.map((f) => f.drugId) });
  } catch (error) {
    return handleApiError(error, "GET /api/favorites", "Failed to fetch favorites");
  }
}

const starSchema = z.object({
  drugId: z.string().min(1, "drugId is required"),
  floor: z.enum(FLOORS, { message: "Invalid floor" }),
});

// POST /api/favorites — star a drug for a floor
export async function POST(request: NextRequest) {
  try {
    await requireUser();
    const { drugId, floor } = starSchema.parse(await readJson(request));

    const drug = await db.drug.findUnique({ where: { id: drugId }, select: { id: true } });
    if (!drug) throw new ApiError(404, "Drug not found");

    await db.favorite.upsert({
      where: { drugId_floor: { drugId, floor } },
      create: { drugId, floor },
      update: {},
    });
    return NextResponse.json({ starred: true, drugId, floor });
  } catch (error) {
    return handleApiError(error, "POST /api/favorites", "Failed to star drug");
  }
}

// DELETE /api/favorites?drugId=...&floor=... — unstar a drug for a floor
export async function DELETE(request: NextRequest) {
  try {
    const session = await requireUser();
    const { searchParams } = request.nextUrl;
    const drugId = searchParams.get("drugId");
    if (!drugId) throw new ApiError(400, "drugId is required");
    const floor = validFloor(searchParams.get("floor") ?? session.floor);

    await db.favorite.deleteMany({ where: { drugId, floor } });
    return NextResponse.json({ starred: false, drugId, floor });
  } catch (error) {
    return handleApiError(error, "DELETE /api/favorites", "Failed to unstar drug");
  }
}
