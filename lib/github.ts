import type { CachedSnapshot } from "@/lib/database";
import type { ContributionDay, Repository } from "@/lib/types";

const GRAPHQL_URL = "https://api.github.com/graphql";
const REST_URL = "https://api.github.com";
const GITHUB_TIMEOUT_MS = 10_000;

export class GitHubApiError extends Error {
  constructor(message: string, public readonly status: 404 | 502) {
    super(message);
    this.name = "GitHubApiError";
  }
}

const query = `
  query Portfolio($login: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $login) {
      login name bio avatarUrl url
      followers { totalCount }
      repositories(first: 100, ownerAffiliations: OWNER, orderBy: {field: UPDATED_AT, direction: DESC}) {
        nodes { id name description stargazerCount forkCount url isFork primaryLanguage { name } }
      }
      contributionsCollection(from: $from, to: $to) {
        contributionCalendar { weeks { contributionDays { date contributionCount contributionLevel } } }
      }
    }
  }
`;

type GraphQLResponse = {
  data?: { user: null | {
    login: string; name: string | null; bio: string | null; avatarUrl: string; url: string;
    followers: { totalCount: number };
    repositories: { nodes: Array<{
      id: string; name: string; description: string | null; stargazerCount: number; forkCount: number;
      url: string; isFork: boolean; primaryLanguage: { name: string } | null;
    }> };
    contributionsCollection: { contributionCalendar: { weeks: Array<{ contributionDays: Array<{
      date: string; contributionCount: number;
      contributionLevel: "NONE" | "FIRST_QUARTILE" | "SECOND_QUARTILE" | "THIRD_QUARTILE" | "FOURTH_QUARTILE";
    }> }> } };
  } };
  errors?: Array<{ message: string }>;
};

function headers(token?: string): HeadersInit {
  return { Accept: "application/vnd.github+json", "User-Agent": "devfolio-mvp", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

function githubFetch(input: string, init: RequestInit = {}) {
  return fetch(input, { ...init, signal: AbortSignal.timeout(GITHUB_TIMEOUT_MS) });
}

function levelFromCount(count: number): ContributionDay["level"] {
  if (!count) return 0;
  if (count <= 2) return 1;
  if (count <= 5) return 2;
  if (count <= 9) return 3;
  return 4;
}

async function fetchGraphQL(username: string, token: string): Promise<CachedSnapshot> {
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - 364);
  const response = await githubFetch(GRAPHQL_URL, {
    method: "POST",
    headers: { ...headers(token), "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { login: username, from: from.toISOString(), to: to.toISOString() } }),
    cache: "no-store",
  });
  const result = (await response.json()) as GraphQLResponse;
  if (!response.ok || result.errors?.length) {
    const upstreamMessage = result.errors?.[0]?.message ?? `GitHub GraphQL returned ${response.status}.`;
    if (response.status === 404 || /could not resolve to a user|not found/i.test(upstreamMessage)) {
      throw new GitHubApiError(`GitHub user "${username}" was not found.`, 404);
    }
    throw new GitHubApiError(upstreamMessage, 502);
  }
  const user = result.data?.user;
  if (!user) throw new GitHubApiError(`GitHub user "${username}" was not found.`, 404);

  const repositories: Repository[] = user.repositories.nodes.filter((repository) => !repository.isFork).map((repository) => ({
    githubId: repository.id,
    name: repository.name,
    description: repository.description ?? "No description provided.",
    stars: repository.stargazerCount,
    forks: repository.forkCount,
    primaryLanguage: repository.primaryLanguage?.name ?? null,
    url: repository.url,
  }));
  const levels = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 } as const;
  const contributions = user.contributionsCollection.contributionCalendar.weeks.flatMap((week) => week.contributionDays.map((day) => ({
    date: day.date, count: day.contributionCount, level: levels[day.contributionLevel],
  })));
  return {
    username: user.login.toLowerCase(),
    profile: {
      username: user.login, name: user.name ?? user.login,
      bio: user.bio ?? "Building in public, one commit at a time.",
      avatarUrl: user.avatarUrl, url: user.url, followers: user.followers.totalCount,
    },
    repositories, contributions, source: "graphql", fetchedAt: new Date().toISOString(),
  };
}

type RestRepo = {
  id: number; name: string; description: string | null; stargazers_count: number; forks_count: number;
  language: string | null; html_url: string; fork: boolean;
};

async function fetchRest(username: string): Promise<CachedSnapshot> {
  const [profileResponse, repositoriesResponse, eventsResponse] = await Promise.all([
    githubFetch(`${REST_URL}/users/${encodeURIComponent(username)}`, { headers: headers(), cache: "no-store" }),
    githubFetch(`${REST_URL}/users/${encodeURIComponent(username)}/repos?per_page=100&sort=updated`, { headers: headers(), cache: "no-store" }),
    githubFetch(`${REST_URL}/users/${encodeURIComponent(username)}/events/public?per_page=100`, { headers: headers(), cache: "no-store" }),
  ]);
  if (profileResponse.status === 404) throw new GitHubApiError(`GitHub user "${username}" was not found.`, 404);
  if (!profileResponse.ok || !repositoriesResponse.ok) {
    throw new GitHubApiError("GitHub could not be reached. Check the token or try again shortly.", 502);
  }
  const profile = await profileResponse.json();
  const repos = (await repositoriesResponse.json()) as RestRepo[];
  const events = eventsResponse.ok ? (await eventsResponse.json()) as Array<{ type: string; created_at: string; payload?: { commits?: unknown[] } }> : [];
  const counts = new Map<string, number>();
  for (const event of events) {
    if (event.type !== "PushEvent") continue;
    const date = event.created_at.slice(0, 10);
    counts.set(date, (counts.get(date) ?? 0) + Math.max(1, event.payload?.commits?.length ?? 1));
  }
  const contributions: ContributionDay[] = [];
  const cursor = new Date();
  cursor.setUTCDate(cursor.getUTCDate() - 364);
  for (let index = 0; index < 365; index += 1) {
    const date = cursor.toISOString().slice(0, 10);
    const count = counts.get(date) ?? 0;
    contributions.push({ date, count, level: levelFromCount(count) });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return {
    username: String(profile.login).toLowerCase(),
    profile: {
      username: profile.login, name: profile.name ?? profile.login,
      bio: profile.bio ?? "Building in public, one commit at a time.",
      avatarUrl: profile.avatar_url, url: profile.html_url, followers: profile.followers,
    },
    repositories: repos.filter((repo) => !repo.fork).map((repo) => ({
      githubId: String(repo.id), name: repo.name, description: repo.description ?? "No description provided.",
      stars: repo.stargazers_count, forks: repo.forks_count, primaryLanguage: repo.language, url: repo.html_url,
    })),
    contributions, source: "rest", fetchedAt: new Date().toISOString(),
  };
}

export async function fetchGithubSnapshot(username: string): Promise<CachedSnapshot> {
  const token = process.env.GITHUB_TOKEN?.trim();
  try {
    return token ? await fetchGraphQL(username, token) : await fetchRest(username);
  } catch (error) {
    if (error instanceof GitHubApiError) throw error;
    if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
      throw new GitHubApiError("GitHub took too long to respond. Try again shortly.", 502);
    }
    throw new GitHubApiError("GitHub could not be reached. Try again shortly.", 502);
  }
}
