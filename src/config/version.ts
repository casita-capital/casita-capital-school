// App Version Configuration lock (static version fallback updated on deployments)
export const APP_BUILD_ID =
  process.env.NEXT_PUBLIC_BUILD_ID ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  '2026.09.07-v1';
