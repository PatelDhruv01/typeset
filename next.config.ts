import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // puppeteer-core and @sparticuz/chromium resolve a real Chromium binary from
  // disk at runtime. Bundling them breaks that resolution, so they must stay
  // external to the server build. (Used from Phase 2 onward.)
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium"],

  // The render route reads font and KaTeX files off disk to inline them as
  // data: URIs. Next traces imports, not runtime fs reads, so these have to be
  // named explicitly or the deployed function would ship without them and every
  // PDF would come out in a fallback face.
  outputFileTracingIncludes: {
    "/api/render": [
      "./public/fonts/**/*",
      "./public/katex/**/*",
      "./public/pagedjs/**/*",
    ],
  },

  // Surfacing type errors at build time is the point of having them.
  // (Next 16 removed the `eslint` config key along with `next lint`; linting
  // now runs as its own step via `npm run lint` and in CI.)
  typescript: { ignoreBuildErrors: false },
};

export default nextConfig;
