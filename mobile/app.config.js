// app.json plus two build-time settings that are not secrets:
//   WTV_WEB_BASE    "/app" when the web app is built for https://www.wartabiyetv.com/app/ (scripts/build-pwa.mjs)
//   EAS_PROJECT_ID  the Expo project id (from `npx eas-cli init`), needed for push notifications on phones
module.exports = ({ config }) => ({
  ...config,
  experiments: { ...(config.experiments || {}), baseUrl: process.env.WTV_WEB_BASE || '' },
  extra: {
    ...(config.extra || {}),
    eas: { ...((config.extra || {}).eas || {}), ...(process.env.EAS_PROJECT_ID ? { projectId: process.env.EAS_PROJECT_ID } : {}) },
  },
});
