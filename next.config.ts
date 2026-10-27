import type { NextConfig } from 'next';

const buildId =
  process.env.NEXT_PUBLIC_BUILD_ID ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.CF_PAGES_COMMIT_SHA ||
  process.env.GITHUB_SHA ||
  `build-${Date.now()}`;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@mui/x-date-pickers'],
  env: {
    NEXT_PUBLIC_APP_BUILD_ID: buildId,
  },
  generateBuildId: async () => buildId,
};

export default nextConfig;
