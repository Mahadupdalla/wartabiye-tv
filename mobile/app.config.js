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
//
// Free mode is also switched on by the file .wtv-free-signing (written by scripts/iphone-free-install.sh on the Mac, not
// committed), so every step that reads this config on that Mac (prebuild, and Xcode's own build steps, which do not
// see the script's environment) builds the same app. The file holds the bundle id and team of the copy already on the
// iPhone, so a new build installs over it with the same id: its saved articles and settings stay.
//
// Over-the-air updates (free mode): the app asks Expo's update service (EAS Update, channel "personal") for newer
// JavaScript when it starts and uses it from the next start. .github/workflows/iphone-ota.yml publishes main there.
// An update only reaches builds with the same runtime version, made from the app version and a fingerprint of the
// native parts (packages and plugins): after a native change the old build ignores new updates until it is rebuilt.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const PUSH_PLUGIN = 'expo-notifications';
const FREE_MARKER = path.join(__dirname, '.wtv-free-signing');
const PUBLIC_EAS_PROJECT_ID = 'ec499f36-c73d-45f2-8675-cad04e52ccd2'; // the public id of the "wartabiye-tv" project on expo.dev
const OTA_CHANNEL = 'personal';

function readMarker() {
  try { return JSON.parse(fs.readFileSync(FREE_MARKER, 'utf8') || '{}'); } catch (e) { return fs.existsSync(FREE_MARKER) ? {} : null; }
}

/** "1.2.0-n<hash>": the app version plus a short fingerprint of everything native (packages and config plugins) */
function nativeRuntime(config) {
  const pkg = require('./package.json');
  const deps = Object.entries(pkg.dependencies || {}).sort(([a], [b]) => (a < b ? -1 : 1));
  const plugins = (config.plugins || []).map(p => (Array.isArray(p) ? p : [p]));
  const h = crypto.createHash('sha256').update(JSON.stringify([deps, plugins, config.ios?.infoPlist || {}])).digest('hex').slice(0, 10);
  return `${config.version}-n${h}`;
}

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
  const marker = readMarker();
  const free = env.WTV_FREE_SIGNING === '1' || !!marker;
  if (free && !env.APPLE_TEAM_ID && marker?.teamId) ios.appleTeamId = marker.teamId;
  const runtimeVersion = free ? nativeRuntime(config) : undefined;
  if (free) {
    ios.bundleIdentifier = env.WTV_IOS_BUNDLE_ID || marker?.bundleId || `${ios.bundleIdentifier}.personal`;
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
  const ota = free && !expoGo.updates
    ? {
        runtimeVersion,
        updates: {
          url: `https://u.expo.dev/${env.EAS_PROJECT_ID || PUBLIC_EAS_PROJECT_ID}`,
          enabled: true,
          checkAutomatically: 'ON_LOAD',
          fallbackToCacheTimeout: 0, // never wait at start: the new code is used from the next start
          requestHeaders: { 'expo-channel-name': OTA_CHANNEL },
        },
      }
    : {};
  return {
    ...config,
    ...expoGo,
    ...ota,
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
