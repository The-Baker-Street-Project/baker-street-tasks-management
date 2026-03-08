import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@baker-street/db"],
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
