export type Repository = {
  githubId: string;
  name: string;
  description: string;
  stars: number;
  forks: number;
  primaryLanguage: string | null;
  url: string;
};

export type ContributionDay = {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
};

export type GithubProfile = {
  username: string;
  name: string;
  bio: string;
  avatarUrl: string;
  url: string;
  followers: number;
};

export type LanguageStat = {
  name: string;
  count: number;
  percentage: number;
  color: string;
};

export type Portfolio = {
  profile: GithubProfile;
  repositories: Repository[];
  contributions: ContributionDay[];
  totalStars: number;
  currentStreak: number;
  topLanguages: LanguageStat[];
  fetchedAt: string;
  stale: boolean;
  source: "graphql" | "rest";
};

export type MatchResult = {
  percentage: number;
  matchedLanguages: string[];
  portfolioLanguages: string[];
  formula: string;
};
