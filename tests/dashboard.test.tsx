import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import Dashboard, { getRepositoryPage } from "../components/dashboard";
import { makePortfolio } from "./fixtures";

describe("dashboard SSR smoke test", () => {
  it("renders every required MVP section from a portfolio snapshot", () => {
    const html = renderToStaticMarkup(
      <Dashboard
        initialPortfolio={makePortfolio()}
        initialUsername="testdev"
        initialError=""
        currentYear={2026}
      />,
    );

    assert.match(html, /Test Developer/);
    assert.match(html, /Followers/);
    assert.match(html, />42</);
    assert.match(html, /Total stars/);
    assert.match(html, />9</);
    assert.match(html, /Current streak/);
    assert.match(html, /2<em> days/);
    assert.match(html, /Top languages/);
    assert.match(html, /TypeScript/);
    assert.match(html, /Contribution rhythm/);
    assert.match(html, /level-2/);
    assert.match(html, /Portfolio Insight/);
    assert.match(html, /Strongest portfolio language: TypeScript/);
    assert.match(html, /Repository index/);
    assert.match(html, /typed-dashboard/);
    assert.match(html, /A TypeScript dashboard/);
    assert.match(html, /Vibe check/);
    assert.match(html, /id="job-description"/);
    assert.match(html, /Calculate match/);
    assert.match(html, /Cached 04:40 UTC/);
    assert.doesNotMatch(html, /aria-label="Repository pages"/);
  });

  it("paginates repository cards in groups of six without losing star order", () => {
    const portfolio = makePortfolio();
    const repositories = Array.from({ length: 8 }, (_, index) => ({
      ...portfolio.repositories[0],
      githubId: `repo-${index + 1}`,
      name: `repo-${index + 1}`,
      stars: 8 - index,
    }));
    portfolio.repositories = repositories;
    const html = renderToStaticMarkup(
      <Dashboard initialPortfolio={portfolio} initialUsername="testdev" initialError="" currentYear={2026} />,
    );

    assert.match(html, /aria-label="Repository pages"/);
    assert.match(html, /Page 1 of 2/);
    assert.match(html, /repo-6/);
    assert.doesNotMatch(html, /repo-7/);
    const secondPage = getRepositoryPage(repositories, 2);
    assert.equal(secondPage.startIndex, 6);
    assert.deepEqual(secondPage.repositories.map((repository) => repository.name), ["repo-7", "repo-8"]);
  });

  it("renders the setup state when no GitHub snapshot is available", () => {
    const html = renderToStaticMarkup(
      <Dashboard initialPortfolio={null} initialUsername="octocat" initialError="GitHub unavailable" currentYear={2026} />,
    );
    assert.match(html, /Signal interrupted/);
    assert.match(html, /Turn a GitHub profile into a portfolio/);
  });
});
