import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // puppeteer-core and @sparticuz/chromium resolve a real Chromium binary from
  // disk at runtime. Bundling them breaks that resolution, so they must stay
  // external to the server build. (Used from Phase 2 onward.)
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium"],

  // Surfacing type errors at build time is the point of having them.
  // (Next 16 removed the `eslint` config key along with `next lint`; linting
  // now runs as its own step via `npm run lint` and in CI.)
  typescript: { ignoreBuildErrors: false },
};

export default nextConfig;
