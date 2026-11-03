import { NextRequest, NextResponse } from "next/server";
import { GitHubApiError } from "@/lib/github";
import { validateUsername } from "@/lib/logic";
import { getDefaultUsername, getPortfolio } from "@/lib/portfolio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  let rawUsername: string;
  try {
    rawUsername = request.nextUrl.searchParams.get("username") ?? getDefaultUsername();
  } catch (error) {
    console.error("Unable to read the default GitHub username.", error);
    return NextResponse.json({ error: "Unable to load GitHub profile." }, { status: 500 });
  }

  let username: string;
  try {
    username = validateUsername(rawUsername);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid GitHub username.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const refresh = request.nextUrl.searchParams.get("refresh") === "1";
    return NextResponse.json(await getPortfolio(username, refresh));
  } catch (error) {
    if (error instanceof GitHubApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Unable to load GitHub portfolio.", error);
    return NextResponse.json({ error: "Unable to load GitHub profile." }, { status: 500 });
  }
}
