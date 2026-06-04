/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb"
    }
  },
  // Puppeteer + the Sparticuz chromium binary can't be bundled — they're loaded
  // dynamically by the proposal-PDF route and the signProposal server action.
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium", "puppeteer"],
  // The /guides pages read Markdown files from docs/ at server startup. Vercel's
  // file tracer doesn't auto-include arbitrary directories, so we explicitly
  // pull them into the lambda bundle for the two guide routes.
  outputFileTracingIncludes: {
    "/guides": ["./docs/**/*.md"],
    "/guides/[slug]": ["./docs/**/*.md"]
  }
};

export default nextConfig;
