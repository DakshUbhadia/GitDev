# Devfolio MVP

A compact developer portfolio dashboard built with Next.js App Router, React, TypeScript, GitHub GraphQL, and SQLite.

## Features

- Live profile header with followers, total stars, current streak, and a language chart.
- 52-week contribution heatmap (complete through GraphQL; public push-event approximation without a token).
- Star-sorted repository cards with six-card client-side pagination.
- **Portfolio Insight:** a server-derived summary of the strongest language and most-starred repository.
- **Match Explanation:** a server-derived explanation accompanying the deterministic compatibility score.
- SQLite snapshot and settings cache with a configurable TTL and stale-cache fallback.

## Run locally

```powershell
npm install
Copy-Item .env.example .env.local
# Replace GITHUB_TOKEN in .env.local, then:
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

`GITHUB_TOKEN` is strongly recommended and required for the complete GitHub contribution calendar. Without it, public profile and repository data load through GitHub REST, and recent activity is approximated from public push events.

Repository metadata currently loads up to 100 owner repositories per GitHub refresh. Repository cards are paginated in the UI for readability.

## API

- `GET /api/profile?username=octocat` returns a cached or freshly fetched portfolio.
- `GET /api/profile?username=octocat&refresh=1` bypasses the TTL.
- `POST /api/match` with `{ "username": "octocat", "jobDescription": "..." }` calculates role fit on the server.

## Match formula

Languages are deduplicated and matched case-insensitively with deterministic framework aliases:

```text
match percentage = matched unique repository languages / all unique repository languages × 100
```

The problem does not define a scoring formula, so this implementation uses a deterministic language-overlap score. The result is rounded and clamped to 0–100; empty language sets score 0. Match Explanation describes the same matched-language result and does not claim to identify every job requirement.

## Database

SQLite is a cache, not the authoritative store. It is created at `data/devfolio.db` by default.

Snapshots use a configurable 20-minute TTL by default. Fresh snapshots avoid GitHub calls, manual refresh bypasses the TTL, and a stale snapshot is returned when GitHub is temporarily unavailable.

- `github_snapshot`: username, profile JSON, repository JSON, contribution JSON, API source, fetched timestamp.
- `user_settings`: key/value settings, including the last successfully loaded username.

## Verify

```powershell
npm test
npm run lint
npm run build
```

The automated suite uses mocked GitHub responses and a temporary SQLite database, so it does not require a token or consume GitHub API quota. It covers:

- GitHub GraphQL and REST response mapping.
- SQLite snapshots, settings, TTL cache hits, and stale-cache fallback.
- Profile aggregation, streaks, language statistics, and match scoring.
- Profile and compatibility API routes, including input validation.
- Server-rendered output for the profile header, contribution graph, repositories, and job compatibility form.
