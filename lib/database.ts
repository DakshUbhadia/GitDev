import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import type { ContributionDay, GithubProfile, Repository } from "@/lib/types";

type SnapshotRow = {
  username: string;
  profile_json: string;
  repositories_json: string;
  contributions_json: string;
  source: "graphql" | "rest";
  fetched_at: string;
};

export type CachedSnapshot = {
  username: string;
  profile: GithubProfile;
  repositories: Repository[];
  contributions: ContributionDay[];
  source: "graphql" | "rest";
  fetchedAt: string;
};

let database: Database.Database | null = null;

function getDatabase() {
  if (database) return database;
  const configured = process.env.DATABASE_PATH ?? "./data/devfolio.db";
  const filename = path.resolve(/* turbopackIgnore: true */ process.cwd(), configured);
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  database = new Database(filename);
  database.pragma("journal_mode = WAL");
  database.exec(`
    CREATE TABLE IF NOT EXISTS github_snapshot (
      username TEXT PRIMARY KEY,
      profile_json TEXT NOT NULL,
      repositories_json TEXT NOT NULL,
      contributions_json TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'graphql',
      fetched_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS user_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  return database;
}

export function readSnapshot(username: string): CachedSnapshot | null {
  const row = getDatabase().prepare("SELECT * FROM github_snapshot WHERE username = ?").get(username.toLowerCase()) as SnapshotRow | undefined;
  if (!row) return null;
  return {
    username: row.username,
    profile: JSON.parse(row.profile_json),
    repositories: JSON.parse(row.repositories_json),
    contributions: JSON.parse(row.contributions_json),
    source: row.source,
    fetchedAt: row.fetched_at,
  };
}

export function writeSnapshot(snapshot: CachedSnapshot) {
  getDatabase().prepare(`
    INSERT INTO github_snapshot
      (username, profile_json, repositories_json, contributions_json, source, fetched_at)
    VALUES (@username, @profile, @repositories, @contributions, @source, @fetchedAt)
    ON CONFLICT(username) DO UPDATE SET
      profile_json = excluded.profile_json,
      repositories_json = excluded.repositories_json,
      contributions_json = excluded.contributions_json,
      source = excluded.source,
      fetched_at = excluded.fetched_at
  `).run({
    username: snapshot.username.toLowerCase(),
    profile: JSON.stringify(snapshot.profile),
    repositories: JSON.stringify(snapshot.repositories),
    contributions: JSON.stringify(snapshot.contributions),
    source: snapshot.source,
    fetchedAt: snapshot.fetchedAt,
  });
}

export function setSetting(key: string, value: string) {
  getDatabase().prepare(`
    INSERT INTO user_settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, value);
}

export function getSetting(key: string): string | null {
  const row = getDatabase().prepare("SELECT value FROM user_settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function closeDatabase() {
  if (!database) return;
  database.close();
  database = null;
}
