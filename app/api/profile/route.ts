import { NextRequest, NextResponse } from "next/server";
import { getDefaultUsername, getPortfolio } from "@/lib/portfolio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const username = request.nextUrl.searchParams.get("username") ?? getDefaultUsername();
    const refresh = request.nextUrl.searchParams.get("refresh") === "1";
    return NextResponse.json(await getPortfolio(username, refresh));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load GitHub profile.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
