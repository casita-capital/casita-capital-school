// App Version Configuration lock (dynamically assigned at build time in next.config.ts)
export const APP_BUILD_ID =
  process.env.NEXT_PUBLIC_APP_BUILD_ID ||
  process.env.NEXT_PUBLIC_BUILD_ID ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.CF_PAGES_COMMIT_SHA ||
  process.env.GITHUB_SHA ||
  'dev';
