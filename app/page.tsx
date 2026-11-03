import Dashboard from "@/components/dashboard";
import { getDefaultUsername, getPortfolio } from "@/lib/portfolio";
import type { Portfolio } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Home() {
  const username = getDefaultUsername();
  let initialPortfolio: Portfolio | null = null;
  let initialError = "";
  try {
    initialPortfolio = await getPortfolio(username);
  } catch (error) {
    initialError = error instanceof Error ? error.message : "Unable to load the portfolio.";
  }
  return <Dashboard initialPortfolio={initialPortfolio} initialUsername={username} initialError={initialError} />;
}
