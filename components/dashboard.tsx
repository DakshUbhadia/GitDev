"use client";

import Image from "next/image";
import { FormEvent, useMemo, useState } from "react";
import { ArrowIcon, ForkIcon, RefreshIcon, StarIcon } from "@/components/icons";
import { formatCacheTime } from "@/lib/logic";
import type { MatchResult, Portfolio, Repository } from "@/lib/types";

type Props = { initialPortfolio: Portfolio | null; initialUsername: string; initialError: string; currentYear: number };

export const REPOSITORIES_PER_PAGE = 6;

export function getRepositoryPage(repositories: Repository[], requestedPage: number) {
  const sortedRepositories = [...repositories].sort((a, b) => b.stars - a.stars || a.name.localeCompare(b.name));
  const totalPages = Math.max(1, Math.ceil(sortedRepositories.length / REPOSITORIES_PER_PAGE));
  const currentPage = Math.min(Math.max(1, Math.trunc(requestedPage) || 1), totalPages);
  const startIndex = (currentPage - 1) * REPOSITORIES_PER_PAGE;
  return {
    repositories: sortedRepositories.slice(startIndex, startIndex + REPOSITORIES_PER_PAGE),
    currentPage,
    totalPages,
    startIndex,
  };
}

function number(value: number) {
  return new Intl.NumberFormat("en", { notation: value > 999 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value);
}

function ContributionGraph({ portfolio }: { portfolio: Portfolio }) {
  const total = portfolio.contributions.reduce((sum, day) => sum + day.count, 0);
  return (
    <section className="panel activity-panel" aria-labelledby="activity-title">
      <div className="section-heading">
        <div><p className="eyebrow">Ship log / last 12 months</p><h2 id="activity-title">Contribution rhythm</h2></div>
        <p className="activity-total"><strong>{number(total)}</strong> contributions</p>
      </div>
      <div className="heatmap-scroll" role="img" aria-label={`${total} contributions in the last year`}>
        <div className="heatmap-grid">
          {portfolio.contributions.map((day) => <span className={`heat-cell level-${day.level}`} key={day.date} title={`${day.date}: ${day.count} contribution${day.count === 1 ? "" : "s"}`} />)}
        </div>
      </div>
      <div className="heatmap-footer">
        <span>{portfolio.source === "graphql" ? "GitHub contribution calendar" : "Public push activity (add a token for the full calendar)"}</span>
        <span className="legend">Less <i className="level-0"/><i className="level-1"/><i className="level-2"/><i className="level-3"/><i className="level-4"/> More</span>
      </div>
    </section>
  );
}

function LanguageChart({ portfolio }: { portfolio: Portfolio }) {
  const visible = portfolio.topLanguages.slice(0, 5);
  const chart = visible.reduce<{ cursor: number; stops: string[] }>((state, item) => {
    const end = state.cursor + item.percentage;
    return { cursor: end, stops: [...state.stops, `${item.color} ${state.cursor}% ${end}%`] };
  }, { cursor: 0, stops: [] });
  const stops = chart.cursor < 100 ? [...chart.stops, `#dcded4 ${chart.cursor}% 100%`] : chart.stops;
  return (
    <div className="language-card">
      <div className="donut" style={{ background: `conic-gradient(${stops.join(",")})` }}><div><strong>{portfolio.topLanguages.length}</strong><span>languages</span></div></div>
      <div className="language-list">
        <p className="eyebrow">Top languages</p>
        {visible.length ? visible.map((language) => (
          <div className="language-row" key={language.name}><span><i style={{ background: language.color }} />{language.name}</span><strong>{language.percentage}%</strong></div>
        )) : <p className="muted">No repository languages yet.</p>}
      </div>
    </div>
  );
}

export default function Dashboard({ initialPortfolio, initialUsername, initialError, currentYear }: Props) {
  const [portfolio, setPortfolio] = useState(initialPortfolio);
  const [username, setUsername] = useState(initialUsername);
  const [usernameInput, setUsernameInput] = useState(initialUsername);
  const [error, setError] = useState(initialError);
  const [loading, setLoading] = useState(false);
  const [jobDescription, setJobDescription] = useState("");
  const [match, setMatch] = useState<MatchResult | null>(null);
  const [matching, setMatching] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const repositoryPage = useMemo(
    () => getRepositoryPage(portfolio?.repositories ?? [], currentPage),
    [portfolio, currentPage],
  );

  async function loadPortfolio(requested: string, refresh = false) {
    setLoading(true); setError(""); setMatch(null);
    try {
      const params = new URLSearchParams({ username: requested });
      if (refresh) params.set("refresh", "1");
      const response = await fetch(`/api/profile?${params}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to load profile.");
      setPortfolio(data); setUsername(data.profile.username); setUsernameInput(data.profile.username); setCurrentPage(1);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load profile.");
    } finally { setLoading(false); }
  }

  async function submitUsername(event: FormEvent) { event.preventDefault(); await loadPortfolio(usernameInput); }

  async function checkMatch(event: FormEvent) {
    event.preventDefault(); setMatching(true); setError("");
    try {
      const response = await fetch("/api/match", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, jobDescription }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to calculate match.");
      setMatch(data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to calculate match.");
    } finally { setMatching(false); }
  }

  return (
    <main>
      <nav className="topbar" aria-label="Portfolio controls">
        <a className="brand" href="#top" aria-label="Devfolio home"><span>DF</span> DEVFOLIO</a>
        <form className="username-form" onSubmit={submitUsername}>
          <label htmlFor="username">github.com/</label>
          <input id="username" value={usernameInput} onChange={(event) => setUsernameInput(event.target.value)} maxLength={39} />
          <button type="submit" disabled={loading}>Load profile</button>
        </form>
      </nav>
      <div className="dashboard-shell" id="top">
        {error && <div className="error-banner" role="alert"><strong>Signal interrupted.</strong> {error}</div>}
        {!portfolio ? (
          <section className="empty-state"><p className="eyebrow">Developer intelligence / live</p><h1>Turn a GitHub profile into a portfolio.</h1><p>Enter a public GitHub username above. Add a token in <code>.env.local</code> to unlock the complete contribution calendar.</p></section>
        ) : (<>
          <header className="profile-hero">
            <div className="profile-main">
              <Image className="avatar" src={portfolio.profile.avatarUrl} alt={`${portfolio.profile.name} avatar`} width={112} height={112} unoptimized />
              <div><div className="profile-kicker"><span className="live-dot" /> GitHub portfolio / live snapshot</div><h1>{portfolio.profile.name}</h1><a className="handle" href={portfolio.profile.url} target="_blank" rel="noreferrer">@{portfolio.profile.username} <ArrowIcon /></a><p className="bio">{portfolio.profile.bio}</p></div>
            </div>
            <div className="hero-actions">
              {match && <div className="match-badge"><span>Role fit</span><strong>{match.percentage}%</strong></div>}
              <button className="refresh-button" type="button" onClick={() => loadPortfolio(username, true)} disabled={loading}><RefreshIcon className={loading ? "spin" : ""} /> {loading ? "Syncing" : "Refresh data"}</button>
              <time className="cache-note" dateTime={portfolio.fetchedAt}>{portfolio.stale ? "Stale cache — GitHub unavailable" : `Cached ${formatCacheTime(portfolio.fetchedAt)}`}</time>
            </div>
          </header>
          <section className="overview-grid" aria-label="Profile overview">
            <div className="metrics-grid">
              <article className="metric"><span>Followers</span><strong>{number(portfolio.profile.followers)}</strong><small>people watching the work</small></article>
              <article className="metric"><span>Total stars</span><strong>{number(portfolio.totalStars)}</strong><small>across public repositories</small></article>
              <article className="metric accent"><span>Current streak</span><strong>{portfolio.currentStreak}<em> days</em></strong><small>consecutive active days</small></article>
            </div>
            <LanguageChart portfolio={portfolio} />
          </section>
          <ContributionGraph portfolio={portfolio} />
          <section className="portfolio-insight" aria-labelledby="portfolio-insight-title">
            <div><p className="eyebrow">Extra feature 01</p><h2 id="portfolio-insight-title">Portfolio Insight</h2></div>
            <p>{portfolio.insight.summary}</p>
          </section>
          <section className="content-grid">
            <div className="repository-section">
              <div className="section-heading repo-heading"><div><p className="eyebrow">Selected work</p><h2>Repository index</h2></div><span>{portfolio.repositories.length} public originals</span></div>
              <div className="repository-grid">
                {repositoryPage.repositories.map((repository, index) => (
                  <a className="repo-card" href={repository.url} target="_blank" rel="noreferrer" key={repository.githubId}>
                    <div className="repo-number">{String(repositoryPage.startIndex + index + 1).padStart(2, "0")}</div><h3>{repository.name}</h3><p>{repository.description}</p>
                    <div className="repo-meta"><span className="repo-language"><i />{repository.primaryLanguage ?? "Unspecified"}</span><span><StarIcon />{number(repository.stars)}</span><span><ForkIcon />{number(repository.forks)}</span></div>
                    <ArrowIcon className="repo-arrow" size={22} />
                  </a>
                ))}
              </div>
              {repositoryPage.totalPages > 1 && (
                <nav className="repo-pagination" aria-label="Repository pages">
                  <button type="button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={repositoryPage.currentPage === 1}>Previous</button>
                  <span>Page {repositoryPage.currentPage} of {repositoryPage.totalPages}</span>
                  <button type="button" onClick={() => setCurrentPage((page) => Math.min(repositoryPage.totalPages, page + 1))} disabled={repositoryPage.currentPage === repositoryPage.totalPages}>Next</button>
                </nav>
              )}
            </div>
            <aside className="match-panel" id="vibe-check">
              <p className="eyebrow">Tech stack compatibility</p><h2>Vibe check</h2><p>Paste a job description. The server compares its terms with languages found in cached repositories.</p>
              <form onSubmit={checkMatch}>
                <label htmlFor="job-description">Job description</label>
                <textarea id="job-description" value={jobDescription} onChange={(event) => setJobDescription(event.target.value)} placeholder="We’re looking for an engineer fluent in TypeScript, React, Python…" maxLength={10000} rows={9} required />
                <div className="form-footer"><span>{jobDescription.length.toLocaleString()} / 10,000</span><button disabled={matching}>{matching ? "Comparing…" : "Calculate match"}<ArrowIcon /></button></div>
              </form>
              {match && <div className="match-result" aria-live="polite"><div><span>Match percentage</span><strong>{match.percentage}%</strong></div><div className="match-track"><i style={{ width: `${match.percentage}%` }} /></div><p>{match.formula}</p><div className="match-explanation"><strong>Match Explanation</strong><span>{match.explanation}</span></div><div className="match-tags">{match.matchedLanguages.length ? match.matchedLanguages.map((item) => <span key={item}>{item}</span>) : <small>No language matches found.</small>}</div>{match.unmatchedPortfolioLanguages.length > 0 && <div className="unmatched-languages"><small>Portfolio languages not mentioned in this JD</small><span>{match.unmatchedPortfolioLanguages.join(", ")}</span></div>}</div>}
              <small className="formula-note">Formula: matched unique portfolio languages ÷ all unique portfolio languages × 100.</small>
            </aside>
          </section>
        </>)}
      </div>
      <footer><span>DEVFOLIO / {currentYear}</span><span>GitHub GraphQL · Next.js · SQLite</span></footer>
    </main>
  );
}
