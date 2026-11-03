import type { NextConfig } from "next";
import path from "node:path";

const projectRoot = path.resolve(process.cwd());

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  outputFileTracingRoot: projectRoot,
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
