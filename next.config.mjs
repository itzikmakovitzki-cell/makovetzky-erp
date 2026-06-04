/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      // 70mb leaves headroom over the 64mb WhatsApp media cap so we can
      // reject the file gracefully at the action level instead of the proxy
      // truncating mid-upload.
      bodySizeLimit: "70mb"
    }
  },
  // Puppeteer + the Sparticuz chromium binary can't be bundled — they're loaded
  // dynamically by the proposal-PDF route and the signProposal server action.
  serverExternalPackages: [
    "puppeteer-core",
    "@sparticuz/chromium-min",
    "puppeteer"
  ],
  // The /guides pages read Markdown files from docs/ at server startup. Vercel's
  // file tracer doesn't auto-include arbitrary directories, so we explicitly
  // pull them into the lambda bundle for the two guide routes.
  outputFileTracingIncludes: {
    "/guides": ["./docs/**/*.md"],
    "/guides/[slug]": ["./docs/**/*.md"]
  }
};

export default nextConfig;
