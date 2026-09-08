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
  //
  // @sparticuz/chromium is the same problem in a different shape: it resolves
  // its own compressed Chromium binary (bin/*.br) relative to its own install
  // directory at runtime, never through an import Next's tracer can follow.
  // `serverExternalPackages` above stops the bundler from relocating the
  // package, but that is a separate step from Vercel's own output tracing
  // deciding which non-code files actually ship with the function - without
  // this, the package's own JS ships but bin/ does not, and
  // chromium.executablePath() fails with "input directory ... does not
  // exist" the moment the function runs somewhere the package was never
  // installed as a normal dependency, i.e. exactly a fresh Vercel deploy.
  outputFileTracingIncludes: {
    "/api/render": [
      "./public/fonts/**/*",
      "./public/katex/**/*",
      "./public/pagedjs/**/*",
      "./node_modules/@sparticuz/chromium/bin/**/*",
    ],
  },

  // Surfacing type errors at build time is the point of having them.
  // (Next 16 removed the `eslint` config key along with `next lint`; linting
  // now runs as its own step via `npm run lint` and in CI.)
  typescript: { ignoreBuildErrors: false },
};

export default nextConfig;
