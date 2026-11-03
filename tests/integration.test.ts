import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { NextRequest } from "next/server";
import { makeSnapshot } from "./fixtures";

const originalDatabasePath = process.env.DATABASE_PATH;
const originalFetch = globalThis.fetch;
const testDirectory = mkdtempSync(join(tmpdir(), "devfolio-tests-"));
process.env.DATABASE_PATH = join(testDirectory, "cache.db");

let database: typeof import("../lib/database");
let portfolioService: typeof import("../lib/portfolio");
let profileRoute: typeof import("../app/api/profile/route");
let matchRoute: typeof import("../app/api/match/route");

before(async () => {
  database = await import("../lib/database");
  portfolioService = await import("../lib/portfolio");
  profileRoute = await import("../app/api/profile/route");
  matchRoute = await import("../app/api/match/route");
  database.writeSnapshot(makeSnapshot());
});

after(() => {
  globalThis.fetch = originalFetch;
  database.closeDatabase();
  rmSync(testDirectory, { recursive: true, force: true });
  if (originalDatabasePath === undefined) delete process.env.DATABASE_PATH;
  else process.env.DATABASE_PATH = originalDatabasePath;
});

describe("SQLite cache and portfolio aggregation", () => {
  it("persists repository snapshots and user settings", () => {
    const saved = database.readSnapshot("TESTDEV");
    assert.equal(saved?.profile.username, "testdev");
    assert.equal(saved?.repositories.length, 3);
    database.setSetting("github_username", "testdev");
    assert.equal(database.getSetting("github_username"), "testdev");
    assert.equal(portfolioService.getDefaultUsername(), "testdev");
  });

  it("returns a fresh cache without making a GitHub request", async () => {
    globalThis.fetch = async () => { throw new Error("Network should not be called for a fresh snapshot."); };
    const portfolio = await portfolioService.getPortfolio("testdev");
    assert.equal(portfolio.totalStars, 9);
    assert.equal(portfolio.currentStreak, 2);
    assert.deepEqual(portfolio.topLanguages.map((language) => [language.name, language.count]), [
      ["TypeScript", 2],
      ["Python", 1],
    ]);
    assert.equal(portfolio.stale, false);
  });

  it("returns stale cached data when GitHub refresh fails", async () => {
    database.writeSnapshot(makeSnapshot("2020-01-01T00:00:00.000Z"));
    globalThis.fetch = async () => { throw new Error("GitHub unavailable"); };
    const portfolio = await portfolioService.getPortfolio("testdev");
    assert.equal(portfolio.profile.username, "testdev");
    assert.equal(portfolio.stale, true);
    database.writeSnapshot(makeSnapshot());
  });
});

describe("API routes", () => {
  it("GET /api/profile returns the aggregated cached portfolio", async () => {
    const response = await profileRoute.GET(new NextRequest("http://localhost/api/profile?username=testdev"));
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.profile.followers, 42);
    assert.equal(body.totalStars, 9);
    assert.equal(body.repositories.length, 3);
    assert.equal(body.topLanguages[0].name, "TypeScript");
    assert.equal(body.insight.strongestLanguage, "TypeScript");
    assert.equal(body.insight.mostStarredRepository.name, "typed-dashboard");
  });

  it("GET /api/profile rejects an invalid username", async () => {
    const response = await profileRoute.GET(new NextRequest("http://localhost/api/profile?username=bad--name"));
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /consecutive hyphens/);
  });

  it("POST /api/match calculates compatibility on the server", async () => {
    const request = new NextRequest("http://localhost/api/match", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "testdev", jobDescription: "Seeking TypeScript and React experience." }),
    });
    const response = await matchRoute.POST(request);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.percentage, 50);
    assert.deepEqual(body.matchedLanguages, ["TypeScript"]);
    assert.deepEqual(body.unmatchedPortfolioLanguages, ["Python"]);
    assert.equal(body.formula, "1 matched / 2 portfolio languages");
    assert.equal(body.explanation, "1 of your 2 portfolio languages appear in this job description: TypeScript.");
  });

  it("POST /api/match validates input before accessing GitHub", async () => {
    globalThis.fetch = async () => { throw new Error("Validation should run before data access."); };
    const request = new NextRequest("http://localhost/api/match", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "testdev", jobDescription: "   " }),
    });
    const response = await matchRoute.POST(request);
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, "Job description is required.");
  });
});
