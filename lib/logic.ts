import type { ContributionDay, LanguageStat, MatchResult, PortfolioInsight, Repository } from "@/lib/types";

const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: "#3178c6", JavaScript: "#e3b341", Python: "#3572a5", Java: "#b07219",
  Go: "#00add8", Rust: "#dea584", Ruby: "#701516", PHP: "#4f5d95", "C#": "#178600",
  "C++": "#f34b7d", C: "#555555", Swift: "#f05138", Kotlin: "#a97bff", Dart: "#00b4ab",
};

const LANGUAGE_ALIASES: Record<string, string[]> = {
  JavaScript: ["javascript", "js", "node.js", "nodejs", "react", "next.js", "nextjs"],
  TypeScript: ["typescript", "ts"],
  Python: ["python", "py", "django", "flask", "fastapi"],
  Java: ["java", "spring", "spring boot"],
  Go: ["golang", "go"],
  "C#": ["c#", "c sharp", ".net", "dotnet"],
  "C++": ["c++", "cpp"],
  Ruby: ["ruby", "rails", "ruby on rails"],
  PHP: ["php", "laravel"], Rust: ["rust"], Swift: ["swift", "ios"],
  Kotlin: ["kotlin", "android"], Dart: ["dart", "flutter"],
};

export function validateUsername(value: unknown): string {
  if (typeof value !== "string") throw new Error("GitHub username must be a string.");
  const username = value.trim();
  if (!username) throw new Error("GitHub username is required.");
  if (username.length > 39 || !/^[a-z\d](?:[a-z\d-]*[a-z\d])?$/i.test(username)) {
    throw new Error("Enter a valid GitHub username using letters, numbers, or hyphens.");
  }
  if (username.includes("--")) throw new Error("GitHub usernames cannot contain consecutive hyphens.");
  return username;
}

export function formatCacheTime(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "unknown time";
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${hours}:${minutes} UTC`;
}

export function calculateStreak(days: ContributionDay[], today = new Date()): number {
  const counts = new Map(days.map((day) => [day.date, day.count]));
  const cursor = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  if ((counts.get(cursor.toISOString().slice(0, 10)) ?? 0) === 0) cursor.setUTCDate(cursor.getUTCDate() - 1);
  let streak = 0;
  while ((counts.get(cursor.toISOString().slice(0, 10)) ?? 0) > 0) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

export function buildLanguageStats(repositories: Repository[]): LanguageStat[] {
  const counts = new Map<string, number>();
  for (const repository of repositories) {
    if (repository.primaryLanguage) counts.set(repository.primaryLanguage, (counts.get(repository.primaryLanguage) ?? 0) + 1);
  }
  const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name, count]) => ({
    name,
    count,
    percentage: total ? Math.round((count / total) * 100) : 0,
    color: LANGUAGE_COLORS[name] ?? "#718096",
  }));
}

export function buildPortfolioInsight(repositories: Repository[]): PortfolioInsight {
  if (!repositories.length) {
    return {
      strongestLanguage: null,
      mostStarredRepository: null,
      summary: "No public repository data is available yet to generate a portfolio insight.",
    };
  }

  const strongestLanguage = buildLanguageStats(repositories)[0]?.name ?? null;
  const mostStarred = [...repositories].sort((a, b) => b.stars - a.stars || a.name.localeCompare(b.name))[0];
  const mostStarredRepository = { name: mostStarred.name, stars: mostStarred.stars };
  const starLabel = mostStarred.stars === 1 ? "star" : "stars";
  const languageSentence = strongestLanguage
    ? `Strongest portfolio language: ${strongestLanguage}.`
    : "No primary repository language was detected.";

  return {
    strongestLanguage,
    mostStarredRepository,
    summary: `${languageSentence} Most-starred project: ${mostStarred.name} with ${mostStarred.stars} ${starLabel}.`,
  };
}

function containsTerm(text: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(text);
}

export function calculateMatch(jobDescription: unknown, repositories: Repository[]): MatchResult {
  const description = validateJobDescription(jobDescription);

  const portfolioLanguages = [...new Set(
    repositories.map((repository) => repository.primaryLanguage).filter((value): value is string => Boolean(value)),
  )].sort((a, b) => a.localeCompare(b));
  const matchedLanguages = portfolioLanguages.filter((language) => {
    const aliases = LANGUAGE_ALIASES[language] ?? [language.toLowerCase()];
    return aliases.some((alias) => containsTerm(description, alias));
  });
  const unmatchedPortfolioLanguages = portfolioLanguages.filter((language) => !matchedLanguages.includes(language));
  const raw = portfolioLanguages.length ? (matchedLanguages.length / portfolioLanguages.length) * 100 : 0;
  const explanation = portfolioLanguages.length === 0
    ? "No portfolio languages are available to compare with this job description."
    : matchedLanguages.length === 0
      ? `None of your ${portfolioLanguages.length} portfolio languages appear in this job description.`
      : `${matchedLanguages.length} of your ${portfolioLanguages.length} portfolio languages appear in this job description: ${matchedLanguages.join(", ")}.`;
  return {
    percentage: Math.max(0, Math.min(100, Math.round(raw))),
    matchedLanguages,
    portfolioLanguages,
    unmatchedPortfolioLanguages,
    formula: `${matchedLanguages.length} matched / ${portfolioLanguages.length} portfolio languages`,
    explanation,
  };
}

export function validateJobDescription(jobDescription: unknown): string {
  if (typeof jobDescription !== "string") throw new Error("Job description must be a string.");
  const description = jobDescription.trim();
  if (!description) throw new Error("Job description is required.");
  if (description.length > 10_000) throw new Error("Job description must be 10,000 characters or fewer.");
  return description;
}
