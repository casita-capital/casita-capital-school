// App Version Configuration lock
export const APP_BUILD_ID =
  process.env.NEXT_PUBLIC_BUILD_ID ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  `1.0.${Math.floor(Date.now() / 1000)}`;
