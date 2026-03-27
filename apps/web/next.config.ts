import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@baker-street/db"],
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
