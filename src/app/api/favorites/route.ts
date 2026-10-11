import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, FLOORS } from "@/lib/auth";

// GET /api/favorites?floor=9 — list favorited drug ids for a floor
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    const { searchParams } = new URL(request.url);
    const floor =
      searchParams.get("floor") ?? session?.floor ?? FLOORS[0];

    if (!FLOORS.includes(floor as never)) {
      return NextResponse.json({ error: "Invalid floor" }, { status: 400 });
    }

    const favorites = await db.favorite.findMany({
      where: { floor },
      select: { drugId: true },
    });
    return NextResponse.json({ favorites: favorites.map((f) => f.drugId) });
  } catch (error) {
    console.error("GET /api/favorites failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch favorites" },
      { status: 500 }
    );
  }
}

// POST /api/favorites — star a drug for a floor
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const { drugId, floor } = body as { drugId?: string; floor?: string };
    if (!drugId || !floor) {
      return NextResponse.json(
        { error: "drugId and floor are required" },
        { status: 400 }
      );
    }
    if (!FLOORS.includes(floor as never)) {
      return NextResponse.json({ error: "Invalid floor" }, { status: 400 });
    }

    const drug = await db.drug.findUnique({ where: { id: drugId } });
    if (!drug) {
      return NextResponse.json({ error: "Drug not found" }, { status: 404 });
    }

    await db.favorite.upsert({
      where: { drugId_floor: { drugId, floor } },
      create: { drugId, floor },
      update: {},
    });
    return NextResponse.json({ starred: true, drugId, floor });
  } catch (error) {
    console.error("POST /api/favorites failed:", error);
    return NextResponse.json(
      { error: "Failed to star drug" },
      { status: 500 }
    );
  }
}

// DELETE /api/favorites?drugId=...&floor=... — unstar a drug for a floor
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const drugId = searchParams.get("drugId");
    const floor =
      searchParams.get("floor") ?? session.floor;

    if (!drugId) {
      return NextResponse.json({ error: "drugId is required" }, { status: 400 });
    }
    if (!FLOORS.includes(floor as never)) {
      return NextResponse.json({ error: "Invalid floor" }, { status: 400 });
    }

    await db.favorite.deleteMany({ where: { drugId, floor } });
    return NextResponse.json({ starred: false, drugId, floor });
  } catch (error) {
    console.error("DELETE /api/favorites failed:", error);
    return NextResponse.json(
      { error: "Failed to unstar drug" },
      { status: 500 }
    );
  }
}
