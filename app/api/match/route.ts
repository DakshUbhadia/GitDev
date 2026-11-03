import { NextRequest, NextResponse } from "next/server";
import { calculateMatch, validateJobDescription, validateUsername } from "@/lib/logic";
import { getDefaultUsername, getPortfolio } from "@/lib/portfolio";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") throw new Error("Request body must be a JSON object.");
    const input = body as { username?: unknown; jobDescription?: unknown };
    const username = validateUsername(input.username ?? getDefaultUsername());
    validateJobDescription(input.jobDescription);
    const portfolio = await getPortfolio(username);
    return NextResponse.json(calculateMatch(input.jobDescription, portfolio.repositories));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to calculate compatibility.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
