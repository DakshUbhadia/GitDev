import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { fetchGithubSnapshot } from "../lib/github";

const originalFetch = globalThis.fetch;
const originalToken = process.env.GITHUB_TOKEN;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalToken === undefined) delete process.env.GITHUB_TOKEN;
  else process.env.GITHUB_TOKEN = originalToken;
});

describe("GitHub client", () => {
  it("requests and normalizes the GraphQL portfolio payload", async () => {
    process.env.GITHUB_TOKEN = "test-token";
    globalThis.fetch = async (input, init) => {
      assert.equal(String(input), "https://api.github.com/graphql");
      assert.equal(init?.method, "POST");
      assert.equal(new Headers(init?.headers).get("authorization"), "Bearer test-token");
      const body = JSON.parse(String(init?.body));
      assert.equal(body.variables.login, "testdev");
      assert.match(body.query, /contributionsCollection/);
      return new Response(JSON.stringify({
        data: {
          user: {
            login: "testdev",
            name: "Test Developer",
            bio: "Builds things.",
            avatarUrl: "https://example.com/avatar.png",
            url: "https://github.com/testdev",
            followers: { totalCount: 12 },
            repositories: {
              nodes: [
                { id: "1", name: "kept", description: "Original", stargazerCount: 7, forkCount: 2, url: "https://github.com/testdev/kept", isFork: false, primaryLanguage: { name: "TypeScript" } },
                { id: "2", name: "forked", description: null, stargazerCount: 99, forkCount: 9, url: "https://github.com/testdev/forked", isFork: true, primaryLanguage: { name: "JavaScript" } },
              ],
            },
            contributionsCollection: {
              contributionCalendar: {
                weeks: [{ contributionDays: [
                  { date: "2026-11-02", contributionCount: 0, contributionLevel: "NONE" },
                  { date: "2026-11-03", contributionCount: 6, contributionLevel: "THIRD_QUARTILE" },
                ] }],
              },
            },
          },
        },
      }), { status: 200, headers: { "content-type": "application/json" } });
    };

    const snapshot = await fetchGithubSnapshot("testdev");
    assert.equal(snapshot.source, "graphql");
    assert.equal(snapshot.profile.followers, 12);
    assert.equal(snapshot.repositories.length, 1);
    assert.deepEqual(snapshot.repositories[0], {
      githubId: "1",
      name: "kept",
      description: "Original",
      stars: 7,
      forks: 2,
      primaryLanguage: "TypeScript",
      url: "https://github.com/testdev/kept",
    });
    assert.deepEqual(snapshot.contributions.map((day) => day.level), [0, 3]);
  });

  it("falls back to public REST data when no token is configured", async () => {
    delete process.env.GITHUB_TOKEN;
    const today = new Date().toISOString();
    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.endsWith("/users/testdev")) {
        return Response.json({ login: "testdev", name: "Test Developer", bio: null, avatar_url: "https://example.com/avatar.png", html_url: "https://github.com/testdev", followers: 4 });
      }
      if (url.includes("/repos?")) {
        return Response.json([{ id: 10, name: "api", description: null, stargazers_count: 3, forks_count: 1, language: "Go", html_url: "https://github.com/testdev/api", fork: false }]);
      }
      if (url.includes("/events/public?")) {
        return Response.json([{ type: "PushEvent", created_at: today, payload: { commits: [{}, {}] } }]);
      }
      return new Response(null, { status: 404 });
    };

    const snapshot = await fetchGithubSnapshot("testdev");
    assert.equal(snapshot.source, "rest");
    assert.equal(snapshot.repositories[0].primaryLanguage, "Go");
    assert.equal(snapshot.contributions.length, 365);
    assert.equal(snapshot.contributions.at(-1)?.count, 2);
  });

  it("surfaces GraphQL errors instead of caching malformed data", async () => {
    process.env.GITHUB_TOKEN = "bad-token";
    globalThis.fetch = async () => Response.json({ errors: [{ message: "Bad credentials" }] }, { status: 401 });
    await assert.rejects(fetchGithubSnapshot("testdev"), /Bad credentials/);
  });
});
