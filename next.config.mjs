/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb"
    }
  },
  // The /guides pages read Markdown files from docs/ at server startup. Vercel's
  // file tracer doesn't auto-include arbitrary directories, so we explicitly
  // pull them into the lambda bundle for the two guide routes.
  outputFileTracingIncludes: {
    "/guides": ["./docs/**/*.md"],
    "/guides/[slug]": ["./docs/**/*.md"]
  }
};

export default nextConfig;
