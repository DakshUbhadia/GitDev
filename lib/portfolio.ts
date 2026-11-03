import { getSetting, readSnapshot, setSetting, writeSnapshot, type CachedSnapshot } from "@/lib/database";
import { fetchGithubSnapshot } from "@/lib/github";
import { buildLanguageStats, calculateStreak, validateUsername } from "@/lib/logic";
import type { Portfolio } from "@/lib/types";

const DEFAULT_TTL_MINUTES = 20;

function isFresh(fetchedAt: string) {
  const configured = Number(process.env.CACHE_TTL_MINUTES ?? DEFAULT_TTL_MINUTES);
  const ttl = Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TTL_MINUTES;
  return Date.now() - new Date(fetchedAt).getTime() < ttl * 60_000;
}

function aggregate(snapshot: CachedSnapshot, stale = false): Portfolio {
  return {
    profile: snapshot.profile,
    repositories: snapshot.repositories,
    contributions: snapshot.contributions,
    totalStars: snapshot.repositories.reduce((sum, repository) => sum + repository.stars, 0),
    currentStreak: calculateStreak(snapshot.contributions),
    topLanguages: buildLanguageStats(snapshot.repositories),
    fetchedAt: snapshot.fetchedAt,
    stale,
    source: snapshot.source,
  };
}

export function getDefaultUsername() {
  return getSetting("github_username") ?? process.env.GITHUB_USERNAME ?? "octocat";
}

export async function getPortfolio(rawUsername: unknown, forceRefresh = false): Promise<Portfolio> {
  const username = validateUsername(rawUsername);
  const cached = readSnapshot(username);
  if (cached && !forceRefresh && isFresh(cached.fetchedAt)) return aggregate(cached);
  try {
    const fresh = await fetchGithubSnapshot(username);
    writeSnapshot(fresh);
    setSetting("github_username", fresh.profile.username);
    return aggregate(fresh);
  } catch (error) {
    if (cached) return aggregate(cached, true);
    throw error;
  }
}
