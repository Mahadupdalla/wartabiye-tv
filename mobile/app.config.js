// app.json plus build-time settings that are not secrets:
//   WTV_WEB_BASE          "/app" when the web app is built for https://www.wartabiyetv.com/app/ (scripts/build-pwa.mjs)
//   EAS_PROJECT_ID        the Expo project id (from `npx eas-cli init`), needed for push notifications on phones
//   APPLE_TEAM_ID         the owner's Apple Developer Team ID (10 characters), for signed iPhone builds (TestFlight)
//   WTV_IOS_BUILD_NUMBER  the iPhone build number (CFBundleVersion); every TestFlight upload needs a higher one
//   WTV_IOS_RELEASE       "1" for TestFlight / App Store builds: iPhone push uses Apple's production service
//   WTV_FREE_SIGNING      "1" for installing from Xcode with a free Apple Account ("Personal Team", IPHONE-FREE-INSTALL.md):
//                         drops what free teams cannot sign (push notifications, wartabiyetv.com links) and uses the
//                         bundle id com.wartabiyetv.app.personal (or WTV_IOS_BUNDLE_ID), keeping com.wartabiyetv.app
//                         free for the paid Apple Developer team and TestFlight
//   WTV_EXPO_GO           "1" when the Expo Go preview is published (.github/workflows/expo-go.yml): the code is sent to
//                         Expo's update service for the Expo Go app of the newest SDK (needs EAS_PROJECT_ID)
// The iPhone workflow (.github/workflows/ios-testflight.yml) sets APPLE_TEAM_ID and the two WTV_IOS_ settings.
const PUSH_PLUGIN = 'expo-notifications';

// Free Apple Accounts ("Personal Team") cannot sign push notifications or associated domains: remove both entitlements
// last, after every other plugin (expo-notifications adds aps-environment on its own)
// Xcode's Run button builds Release in this mode: the app carries its own code and opens without a computer (a Debug build
// would wait for a development server on the Mac)
function withReleaseRun(config) {
  const { withDangerousMod } = require('expo/config-plugins');
  const fs = require('fs');
  const path = require('path');
  return withDangerousMod(config, ['ios', async c => {
    const dir = path.join(c.modRequest.platformProjectRoot, `${c.modRequest.projectName}.xcodeproj`, 'xcshareddata', 'xcschemes');
    for (const f of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
      const file = path.join(dir, f);
      const x = fs.readFileSync(file, 'utf8');
      fs.writeFileSync(file, x.replace(/(<LaunchAction[^>]*buildConfiguration\s*=\s*")Debug"/, '$1Release"'));
    }
    return c;
  }]);
}

function withoutPaidEntitlements(config) {
  const { withEntitlementsPlist } = require('expo/config-plugins');
  return withEntitlementsPlist(config, c => {
    delete c.modResults['aps-environment'];
    delete c.modResults['com.apple.developer.associated-domains'];
    return c;
  });
}

// Apple's privacy manifest: which "required reason" system APIs the app and its libraries use, and why. Without it
// App Store Connect rejects the upload (ITMS-91053). The app does not track and collects no data linked to a person:
// the optional anonymous page views (Settings) carry no name and no device id.
const PRIVACY_MANIFEST = {
  NSPrivacyTracking: false,
  NSPrivacyTrackingDomains: [],
  NSPrivacyCollectedDataTypes: [],
  NSPrivacyAccessedAPITypes: [
    // settings, saved articles and offline copies (AsyncStorage, expo-constants, React Native)
    { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults', NSPrivacyAccessedAPITypeReasons: ['CA92.1'] },
    // the image cache and offline copies check file dates
    { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp', NSPrivacyAccessedAPITypeReasons: ['C617.1', '0A2A.1', '3B52.1'] },
    // React Native measures time since start for animations and performance
    { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategorySystemBootTime', NSPrivacyAccessedAPITypeReasons: ['35F9.1'] },
    // the image cache checks free space before keeping photos
    { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryDiskSpace', NSPrivacyAccessedAPITypeReasons: ['E174.1', '85F4.1'] },
  ],
};

module.exports = ({ config }) => {
  const env = process.env;
  const ios = { ...(config.ios || {}), privacyManifests: PRIVACY_MANIFEST };
  if (env.WTV_IOS_BUILD_NUMBER) ios.buildNumber = String(env.WTV_IOS_BUILD_NUMBER);
  if (env.APPLE_TEAM_ID) ios.appleTeamId = env.APPLE_TEAM_ID;
  // iPhone push: Apple's production service for TestFlight / App Store builds, the development one otherwise
  const free = env.WTV_FREE_SIGNING === '1';
  if (free) {
    ios.bundleIdentifier = env.WTV_IOS_BUNDLE_ID || `${ios.bundleIdentifier}.personal`;
    delete ios.associatedDomains;
    const modes = ((ios.infoPlist || {}).UIBackgroundModes || []).filter(m => m !== 'remote-notification');
    ios.infoPlist = { ...(ios.infoPlist || {}), UIBackgroundModes: modes };
    if (!modes.length) delete ios.infoPlist.UIBackgroundModes;
  }
  const isPush = p => p === PUSH_PLUGIN || (Array.isArray(p) && p[0] === PUSH_PLUGIN);
  const plugins = (config.plugins || []).filter(p => !(free && isPush(p))).map(p => {
    if (env.WTV_IOS_RELEASE !== '1') return p;
    if (p === PUSH_PLUGIN) return [PUSH_PLUGIN, { mode: 'production' }];
    if (Array.isArray(p) && p[0] === PUSH_PLUGIN) return [PUSH_PLUGIN, { ...(p[1] || {}), mode: 'production' }];
    return p;
  });
  if (free) plugins.push(withoutPaidEntitlements, withReleaseRun);
  const expoGo = env.WTV_EXPO_GO === '1' && env.EAS_PROJECT_ID
    ? { updates: { url: `https://u.expo.dev/${env.EAS_PROJECT_ID}` }, runtimeVersion: { policy: 'sdkVersion' } }
    : {};
  return {
    ...config,
    ...expoGo,
    ...(env.EXPO_OWNER ? { owner: env.EXPO_OWNER } : {}),
    ios,
    plugins,
    experiments: { ...(config.experiments || {}), baseUrl: env.WTV_WEB_BASE || '' },
    extra: {
      ...(config.extra || {}),
      eas: { ...((config.extra || {}).eas || {}), ...(env.EAS_PROJECT_ID ? { projectId: env.EAS_PROJECT_ID } : {}) },
    },
  };
};
