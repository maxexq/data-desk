// Which deployment this build is. Filled in at build time by vite.config.ts.
declare const __DEPLOY__: { env: 'production' | 'staging' | 'preview' | 'local'; branch: string; commit: string };

export const DEPLOY = __DEPLOY__;

/** Text for the taskbar badge; production shows none so players never see it. */
export const deployBadge = (): string | null => {
  if (DEPLOY.env === 'production') return null;
  if (DEPLOY.env === 'preview') return `PREVIEW ${DEPLOY.branch}`;
  return DEPLOY.env.toUpperCase();
};
