# GitDev — Focused Change Instructions

> Repository reviewed: `DakshUbhadia/GitDev` (`main`)
> Review date: 2026-11-03
> Goal: make the smallest changes needed to satisfy the assessment cleanly without over-engineering.

## 1. Current architecture — keep it

The existing architecture is appropriate for the 90-minute assessment:

- Next.js App Router + React + TypeScript
- `app/api/profile` for portfolio/profile requests
- `app/api/match` for job-description compatibility
- `lib/github.ts` for GitHub GraphQL/REST access
- `lib/database.ts` for SQLite cache
- `lib/portfolio.ts` for cache orchestration and portfolio aggregation
- `lib/logic.ts` for validation/calculations
- `components/dashboard.tsx` for presentation and interactions

Do **not** split this into separate frontend/backend projects, add an ORM, Redux, authentication, Docker, Redis, or additional infrastructure.

---

# 2. Changes to make, in priority order

## P0 — Replace the hard 9-repository limit with UI pagination

### Current issue

`components/dashboard.tsx` currently sorts repositories and then calls `.slice(0, 9)`.

That means repositories after the first 9 are never shown even though they already exist in the loaded portfolio data.

### Required behavior

Use **client-side pagination only for repository cards**.

Recommended page size:

- `6` repositories per page on desktop
- Keep the existing responsive grid; mobile naturally becomes one card per row.
- Do not paginate the whole dashboard.
- Do not create a separate backend pagination endpoint for this assessment.

### Required state/logic

In `components/dashboard.tsx`:

1. Keep the full repository list sorted by stars.
2. Add a `currentPage` state starting at `1`.
3. Use a fixed `REPOSITORIES_PER_PAGE = 6`.
4. Calculate:
   - total repository count
   - total pages
   - current page start/end indexes
   - paginated repositories for the current page
5. Reset `currentPage` to `1` whenever a different GitHub profile is successfully loaded.
6. When a refresh reloads the same profile, keeping page 1 is also acceptable and simpler.
7. Repository numbering must remain global:
   - page 1: 01–06
   - page 2: 07–12
   - etc.
8. Render pagination controls below the repository grid:
   - Previous
   - `Page X of Y`
   - Next
9. Disable Previous on the first page.
10. Disable Next on the last page.
11. Hide the controls when there is only one page.
12. Keep the existing repository count in the section heading.

### Styling

Add minimal pagination styling to `app/globals.css`:

- centered or right-aligned controls
- visually consistent with existing buttons/borders
- disabled state
- mobile-friendly wrapping if needed

Do not add a pagination library.

### Acceptance criteria

- A user with 1–6 repositories sees no pagination controls.
- A user with 7+ repositories can navigate through every repository present in `portfolio.repositories`.
- Changing username returns the repository list to page 1.
- No repository disappears because of the old `.slice(0, 9)`.
- Cards remain sorted by stars descending.

---

## P0 — Fix the current test/code mismatch around `formatCacheTime`

### Current issue

The current `tests/logic.test.ts` imports and tests `formatCacheTime`, but the current `lib/logic.ts` retrieved from `main` does not define/export that function.

This can cause `npm test` to fail.

The dashboard currently formats the cache timestamp with locale-dependent `toLocaleTimeString(...)`.

### Recommended smallest fix

Implement the expected deterministic timestamp formatter and use it in the dashboard.

Desired behavior based on the existing test:

- valid timestamp -> `HH:MM UTC`
- invalid timestamp -> `unknown time`

Then replace the dashboard's locale-dependent cache-time formatting with that helper.

### Why this is worth fixing

It:

- makes the existing test consistent with production code
- avoids server/browser timezone or locale differences
- makes the displayed cache timestamp deterministic
- is a very small change

### Acceptance criteria

Run:

- `npm test`
- `npm run lint`
- `npm run build`

All three must pass before submission.

---

## P0 — Make the two required extra features explicit

The assessment asks for **two additional features**. The current dashboard already covers the main required features well, but the two extras are not clearly named/presented as independent features.

Implement two lightweight deterministic features. Do **not** add an LLM API.

### Extra Feature 1 — Portfolio Insight

Generate a short server-derived insight from already cached repository data.

Example meaning:

- strongest/most common portfolio language
- most-starred repository
- optional repository count

Example output concept:

> Strongest portfolio language: TypeScript. Most-starred project: GitDev with 12 stars.

Implementation guidance:

- compute it server-side from cached repositories
- add it to the aggregated `Portfolio` response
- show it as a small "Portfolio Insight" block in the UI
- keep it deterministic and easy to explain

Suggested files:

- `lib/types.ts`
- `lib/logic.ts`
- `lib/portfolio.ts`
- `components/dashboard.tsx`

Do not create a separate API route.

### Extra Feature 2 — Match Explanation

Enhance the existing compatibility result with a short human-readable explanation.

Example meaning:

> 2 of your 4 portfolio languages appear in this job description: TypeScript and Python.

Optionally also show portfolio languages that were not mentioned in the job description, clearly labeled as:

> Portfolio languages not mentioned in this JD

Do **not** call them "missing job requirements", because the current matching algorithm does not extract every technology required by the job description.

Implementation guidance:

- generate the explanation server-side in `calculateMatch`
- add an `explanation` field to `MatchResult`
- render it under the percentage
- keep the current deterministic formula unchanged

Suggested files:

- `lib/types.ts`
- `lib/logic.ts`
- `components/dashboard.tsx`
- relevant tests

### Acceptance criteria

The UI visibly contains two identifiable extras:

1. **Portfolio Insight**
2. **Match Explanation**

Also list both under Features in `README.md`.

---

# 3. GitHub repository-fetch scope

## Current state

Both current GitHub paths are capped at 100 repositories:

- GraphQL: `repositories(first: 100, ...)`
- REST: `?per_page=100`

### Decision for this assessment

Do **not** spend assessment time implementing GitHub API cursor/page traversal unless everything else is already complete.

The important pagination requested here is **display pagination for repository cards**.

Keep:

- one cached portfolio snapshot
- one profile API response
- client-side repository-card pagination

### Document the limitation

Add a short README note:

> Repository metadata currently loads up to 100 owner repositories per GitHub refresh. Repository cards are paginated in the UI for readability.

This is preferable to introducing more GitHub paging/cache complexity under a 90-minute constraint.

If asked in the viva, say:

> "I separated data-fetch pagination from presentation pagination. For the assessment I load up to 100 repositories in one snapshot and paginate only the cards in the UI. In production I would follow GraphQL cursors or REST Link headers to collect larger accounts."

---

# 4. Keep the existing caching design

No architectural rewrite is needed.

Current behavior is good:

1. Validate username.
2. Read SQLite snapshot.
3. If cache is fresh, return it.
4. Otherwise fetch GitHub.
5. Cache the fresh result.
6. If GitHub fails and stale cache exists, return stale cache.

Keep the configurable TTL and stale-cache fallback.

Do not normalize every repository into a new relational table. JSON snapshot caching is sufficient for this task.

---

# 5. Keep the current match formula

The current formula is simple, deterministic, and explainable:

`matched unique portfolio languages / all unique portfolio languages × 100`

Do not replace it with embeddings, an LLM, fuzzy NLP, or a complicated scoring system.

Keep:

- case-insensitive matching
- aliases
- unique languages
- 0–100 clamping
- server-side calculation

In the README and viva, explicitly state that the problem did not define a scoring formula, so this implementation uses a deterministic language-overlap score.

---

# 6. Error handling — small improvement only

The current route handlers broadly return HTTP 400 for caught errors.

If time remains, improve only the obvious cases:

- invalid request/input -> 400
- GitHub user not found -> 404
- unexpected GitHub/upstream error -> 502 or 500

This is a lower priority than pagination, tests, and the two extra features.

Do not build custom error classes unless already necessary.

---

# 7. Contribution data — keep current GraphQL-first approach

The existing approach is acceptable:

- with `GITHUB_TOKEN`: GraphQL contribution calendar
- without token: REST/public-event approximation

For the assessment demo, configure `GITHUB_TOKEN` so the contribution calendar is complete.

Keep the fallback because it demonstrates graceful degradation.

Do not expose the token to the browser.

`.gitignore` already ignores `.env*` except `.env.example`, which is correct.

---

# 8. README updates

Update `README.md` after implementation.

Add/clarify:

- repository-card pagination
- Portfolio Insight
- Match Explanation
- up-to-100 repository fetch limitation
- GraphQL contribution calendar requires a token
- REST fallback is an activity approximation
- cache TTL and stale-cache behavior
- match formula
- verification commands

Keep the README short.

---

# 9. Tests to add/update

Do not build a large test suite. Add only high-value coverage.

## Pagination

At minimum verify behavior conceptually or through the existing render-test approach:

- <= 6 repos -> no pagination
- 7+ repos -> page controls exist
- next page displays later repositories
- page resets when a new profile is loaded

If UI interaction testing would require adding a new test library, skip complex interaction tests and manually verify pagination instead. Do not add a large dependency just for this.

## Match Explanation

Test:

- explanation uses the same matched-language result as the percentage
- empty portfolio behaves safely
- no matches behaves safely

## Portfolio Insight

Test:

- selects the expected most common language
- selects the most-starred repository
- empty repository list returns a sensible fallback

## Existing tests

Resolve the `formatCacheTime` mismatch first, then verify:

- `npm test`
- `npm run lint`
- `npm run build`

---

# 10. File-by-file change map

## `components/dashboard.tsx`

Change:

- remove `.slice(0, 9)`
- add repository pagination state
- derive current page repositories
- reset page after successful profile load
- add Previous / Page X of Y / Next controls
- preserve global repository numbering
- display Portfolio Insight
- display Match Explanation
- use deterministic cache timestamp formatter if implemented

Do not:

- add global state management
- split the dashboard into many new components unless readability becomes genuinely poor

## `app/globals.css`

Add only:

- pagination container
- pagination buttons
- disabled state
- page indicator
- minimal styling for the two new insight/explanation blocks if needed

## `lib/types.ts`

Add only fields needed for:

- portfolio insight
- match explanation

Avoid creating unnecessary domain classes/interfaces.

## `lib/logic.ts`

Add/update:

- deterministic cache timestamp helper expected by the current test
- portfolio insight helper
- match explanation returned from `calculateMatch`

Keep the existing match algorithm.

## `lib/portfolio.ts`

Add the server-calculated Portfolio Insight to the aggregated portfolio response.

Keep cache orchestration unchanged.

## `lib/github.ts`

No mandatory architectural change.

Leave the 100-repository limit for this timed assessment and document it.

## `app/api/profile/route.ts`

No mandatory change other than optional status-code cleanup.

## `app/api/match/route.ts`

No architectural change needed. It should continue to perform compatibility work server-side.

## `README.md`

Document:

- pagination
- two extra features
- repository fetch limit
- architecture/tradeoffs

## `tests/*`

Update only what is needed to:

- fix the current utility mismatch
- cover new deterministic business logic
- preserve existing GitHub/cache/match behavior

---

# 11. Do not change these things

Avoid the following before submission:

- separate Express backend
- authentication / OAuth
- Prisma or another ORM
- Redux/Zustand
- Redis
- Docker
- WebSockets
- server-side repository-card pagination
- infinite scrolling
- an LLM API
- microservices
- a complete UI redesign
- sophisticated NLP
- database normalization for repositories

They add risk without improving mandatory requirement coverage.

---

# 12. Recommended implementation order

1. Fix `formatCacheTime` test/code mismatch.
2. Replace `.slice(0, 9)` with client-side repository-card pagination.
3. Verify pagination manually with more than 6 mock/real repositories.
4. Add server-derived Portfolio Insight.
5. Add server-derived Match Explanation.
6. Add/update focused tests.
7. Update README.
8. Run `npm test`.
9. Run `npm run lint`.
10. Run `npm run build`.
11. Start the app from a clean terminal and perform one complete manual flow.
12. Commit changes incrementally with meaningful messages.

Suggested commit boundaries:

- `fix: make cache timestamp formatting deterministic`
- `feat: paginate repository cards`
- `feat: add portfolio insight and match explanation`
- `test: cover portfolio insights and compatibility output`
- `docs: update assessment architecture and limitations`

Do not manufacture or rewrite earlier Git history. Just make meaningful commits for the work you actually perform from this point onward.

---

# 13. Final manual acceptance checklist

Before submission verify all of the following:

- [ ] Valid GitHub username loads.
- [ ] Invalid/nonexistent username shows a useful error.
- [ ] Followers display.
- [ ] Total stars display.
- [ ] Current streak displays.
- [ ] Top Languages visualization displays.
- [ ] Contribution heatmap displays.
- [ ] Repository cards show name, description, stars, forks, language.
- [ ] Repository cards are paginated.
- [ ] Every repository in the loaded snapshot can be reached through pagination.
- [ ] Page resets when a different GitHub profile is loaded.
- [ ] Job description is required.
- [ ] Compatibility score is calculated server-side.
- [ ] Match Percentage badge appears.
- [ ] Match Explanation appears.
- [ ] Portfolio Insight appears.
- [ ] SQLite cache is created and reused.
- [ ] Refresh bypasses TTL.
- [ ] Stale-cache fallback still works.
- [ ] GitHub token is not committed.
- [ ] `npm test` passes.
- [ ] `npm run lint` passes.
- [ ] `npm run build` passes.
- [ ] README matches actual behavior.
- [ ] Public GitHub repository contains the final allowed commits before the assessment deadline.

---

# Final architecture after changes

The target should remain:

Browser / React dashboard  
→ Next.js Route Handlers  
→ server-side portfolio + matching logic  
→ GitHub GraphQL/REST  
→ SQLite snapshot cache

Repository-card pagination should remain a **presentation concern in the React dashboard**, not a new backend subsystem.

That is the smallest architecture that remains fully defensible in the viva.
