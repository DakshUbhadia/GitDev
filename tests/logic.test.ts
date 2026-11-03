import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPortfolioInsight, calculateMatch, calculateStreak, formatCacheTime, validateJobDescription, validateUsername } from "../lib/logic";
import type { ContributionDay, Repository } from "../lib/types";

const repositories = ["Python", "JavaScript", "Java", "Go"].map((language, index): Repository => ({
  githubId: String(index), name: language, description: "", stars: 0, forks: 0,
  primaryLanguage: language, url: "https://github.com",
}));

describe("compatibility matching", () => {
  it("uses the documented unique-language formula", () => {
    const result = calculateMatch("Python and Node.js experience required", repositories);
    assert.equal(result.percentage, 50);
    assert.deepEqual(result.matchedLanguages, ["JavaScript", "Python"]);
    assert.deepEqual(result.unmatchedPortfolioLanguages, ["Go", "Java"]);
    assert.equal(result.explanation, "2 of your 4 portfolio languages appear in this job description: JavaScript, Python.");
  });
  it("rejects blank and oversized input", () => {
    assert.throws(() => calculateMatch("   ", repositories), /required/);
    assert.throws(() => calculateMatch("x".repeat(10_001), repositories), /10,000/);
    assert.throws(() => validateJobDescription(42), /must be a string/);
  });
  it("deduplicates languages and handles an empty portfolio", () => {
    assert.equal(calculateMatch("PYTHON", [...repositories, repositories[0]]).percentage, 25);
    const emptyResult = calculateMatch("Python", []);
    assert.equal(emptyResult.percentage, 0);
    assert.equal(emptyResult.explanation, "No portfolio languages are available to compare with this job description.");
  });
  it("explains a zero-match result without claiming missing job requirements", () => {
    const result = calculateMatch("COBOL experience required", repositories);
    assert.equal(result.percentage, 0);
    assert.equal(result.explanation, "None of your 4 portfolio languages appear in this job description.");
    assert.deepEqual(result.unmatchedPortfolioLanguages, ["Go", "Java", "JavaScript", "Python"]);
  });
});

describe("portfolio utilities", () => {
  it("counts through yesterday when today is inactive", () => {
    const days: ContributionDay[] = [
      { date: "2026-10-31", count: 1, level: 1 }, { date: "2026-11-01", count: 3, level: 2 },
      { date: "2026-11-02", count: 2, level: 1 }, { date: "2026-11-03", count: 0, level: 0 },
    ];
    assert.equal(calculateStreak(days, new Date("2026-11-03T09:00:00Z")), 3);
  });
  it("validates GitHub usernames", () => {
    assert.equal(validateUsername(" octocat "), "octocat");
    assert.throws(() => validateUsername("bad--name"), /consecutive/);
    assert.throws(() => validateUsername(""), /required/);
    assert.throws(() => validateUsername("a".repeat(40)), /valid GitHub username/);
    assert.throws(() => validateUsername(123), /must be a string/);
  });
  it("formats cache timestamps identically in every locale", () => {
    assert.equal(formatCacheTime("2026-11-03T04:40:00.000Z"), "04:40 UTC");
    assert.equal(formatCacheTime("invalid"), "unknown time");
  });
  it("builds a deterministic portfolio insight", () => {
    const insight = buildPortfolioInsight([
      { ...repositories[0], name: "python-small", stars: 2 },
      { ...repositories[0], githubId: "python-2", name: "python-star", stars: 8 },
      { ...repositories[1], name: "web", stars: 4 },
    ]);
    assert.equal(insight.strongestLanguage, "Python");
    assert.deepEqual(insight.mostStarredRepository, { name: "python-star", stars: 8 });
    assert.equal(insight.summary, "Strongest portfolio language: Python. Most-starred project: python-star with 8 stars.");
  });
  it("returns a useful portfolio insight when no repositories exist", () => {
    const insight = buildPortfolioInsight([]);
    assert.equal(insight.strongestLanguage, null);
    assert.equal(insight.mostStarredRepository, null);
    assert.match(insight.summary, /No public repository data/);
  });
});
