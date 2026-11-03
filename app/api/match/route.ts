import { NextRequest, NextResponse } from "next/server";
import { GitHubApiError } from "@/lib/github";
import { calculateMatch, validateJobDescription, validateUsername } from "@/lib/logic";
import { getDefaultUsername, getPortfolio } from "@/lib/portfolio";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  let username: string;
  let jobDescription: string;
  try {
    if (!body || typeof body !== "object") throw new Error("Request body must be a JSON object.");
    const input = body as { username?: unknown; jobDescription?: unknown };
    username = validateUsername(input.username ?? getDefaultUsername());
    jobDescription = validateJobDescription(input.jobDescription);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid compatibility request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const portfolio = await getPortfolio(username);
    return NextResponse.json(calculateMatch(jobDescription, portfolio.repositories));
  } catch (error) {
    if (error instanceof GitHubApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Unable to calculate compatibility.", error);
    return NextResponse.json({ error: "Unable to calculate compatibility." }, { status: 500 });
  }
}
