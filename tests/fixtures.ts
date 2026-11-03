import type { CachedSnapshot } from "../lib/database";
import type { ContributionDay, Portfolio } from "../lib/types";

function utcDate(daysAgo: number) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

export function makeSnapshot(fetchedAt = new Date().toISOString()): CachedSnapshot {
  const contributions: ContributionDay[] = [
    { date: utcDate(2), count: 0, level: 0 },
    { date: utcDate(1), count: 2, level: 1 },
    { date: utcDate(0), count: 4, level: 2 },
  ];

  return {
    username: "testdev",
    profile: {
      username: "testdev",
      name: "Test Developer",
      bio: "Ships useful software.",
      avatarUrl: "https://avatars.githubusercontent.com/u/1?v=4",
      url: "https://github.com/testdev",
      followers: 42,
    },
    repositories: [
      {
        githubId: "repo-1",
        name: "typed-dashboard",
        description: "A TypeScript dashboard.",
        stars: 5,
        forks: 2,
        primaryLanguage: "TypeScript",
        url: "https://github.com/testdev/typed-dashboard",
      },
      {
        githubId: "repo-2",
        name: "data-service",
        description: "A Python data service.",
        stars: 3,
        forks: 1,
        primaryLanguage: "Python",
        url: "https://github.com/testdev/data-service",
      },
      {
        githubId: "repo-3",
        name: "component-kit",
        description: "Reusable UI components.",
        stars: 1,
        forks: 0,
        primaryLanguage: "TypeScript",
        url: "https://github.com/testdev/component-kit",
      },
    ],
    contributions,
    source: "graphql",
    fetchedAt,
  };
}

export function makePortfolio(): Portfolio {
  const snapshot = makeSnapshot("2026-11-03T04:40:00.000Z");
  return {
    profile: snapshot.profile,
    repositories: snapshot.repositories,
    contributions: snapshot.contributions,
    totalStars: 9,
    currentStreak: 2,
    topLanguages: [
      { name: "TypeScript", count: 2, percentage: 67, color: "#3178c6" },
      { name: "Python", count: 1, percentage: 33, color: "#3572a5" },
    ],
    insight: {
      strongestLanguage: "TypeScript",
      mostStarredRepository: { name: "typed-dashboard", stars: 5 },
      summary: "Strongest portfolio language: TypeScript. Most-starred project: typed-dashboard with 5 stars.",
    },
    fetchedAt: snapshot.fetchedAt,
    stale: false,
    source: "graphql",
  };
}
