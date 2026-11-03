import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateMatch, calculateStreak, formatCacheTime, validateJobDescription, validateUsername } from "../lib/logic";
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
  });
  it("rejects blank and oversized input", () => {
    assert.throws(() => calculateMatch("   ", repositories), /required/);
    assert.throws(() => calculateMatch("x".repeat(10_001), repositories), /10,000/);
    assert.throws(() => validateJobDescription(42), /must be a string/);
  });
  it("deduplicates languages and handles an empty portfolio", () => {
    assert.equal(calculateMatch("PYTHON", [...repositories, repositories[0]]).percentage, 25);
    assert.equal(calculateMatch("Python", []).percentage, 0);
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
});
