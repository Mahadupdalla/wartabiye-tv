# Wartabiye TV app (Android, iPhone and web app)

The Wartabiye TV mobile app, built with React Native and Expo. The same code builds three things:

| | What it is | Where |
|---|---|---|
| **Android app** | Native app (APK for testing, AAB for Google Play) | `.github/workflows/mobile-app.yml` builds it on every change and opens it on an Android emulator. Test APK: `https://github.com/Mahadupdalla/wartabiye-tv/releases/download/android-test-build/wartabiye-tv.apk` (updated from main); AAB under *Actions → Mobile app → Artifacts* |
| **iPhone app** | Native app (TestFlight / App Store) | Needs an Apple Developer account, see [iPhone](#iphone-testflight) |
| **Web app (PWA)** | Installable from the browser ("Add to Home screen") | `https://www.wartabiyetv.com/app/` (folder `../app`, built by `npm run build:pwa`) |

## One connected platform: the website and the app show the same news

The app has **no database of its own and no news automation of its own.** It reads only the files the website publishes:

```
/admin/  or  the Claude news task  →  data/news/<id>.json
        → publish workflow: tools/build_news.py → data/news.json  (the website)
                            tools/build_app_api.py → api/v1/       (the app: same articles, smaller files)
        → GitHub Pages: website and app content go live in the same commit
        → tools/push_send.py: one push alert per new story (website bell + app), only after the site is live
```

* `api/v1/meta.json` (about 1 KB): the app checks it every minute while it is open, and as soon as it is opened again.
  Only when the website published, edited or removed something does it download the new list.
* `api/v1/feed/<lang>.json`: every published article in that language, newest first (by the publisher's time).
* `api/v1/a/<id>.json`: the full article in every language it exists in, with the photo credit and licence.
* `api/v1/ids.json`: every published article and its `rev`. An edit in /admin/ changes `rev`, so the app reloads the
  article (also saved offline copies). An unpublished article disappears from the feeds, its file is deleted, and the
  app deletes its offline copy and says "this article is no longer published".
* If `api/v1` cannot be reached (e.g. before the first publish that creates it), the app reads `data/news.json` itself
  with the same rules, so it always shows what the website shows.
* LIVE News reads the same LIVE updates file as the website (`live-updates.json` on branch `live-data`) plus every
  story of the last 24 hours. "LIVE" is red only while the newest update is under 60 minutes old.

No app update is needed for new news, edits, new images or new adverts. Synchronising the app costs **no AI calls**:
it only reads static files (`tools/build_app_api.py` is plain Python, run inside the existing publish workflow).

## Screens

Home (all news: ticker, top story, LIVE, Somalia, World, Sport, latest), LIVE News, Videos (Muuqaallo), Saved, Menu,
Soomaaliya / Caalamka / Ciyaaraha, Breaking News, the article reader, Search, Notifications, Settings and
Xayeysiimaha (advertising). Nine languages (Somali by default; Arabic right-to-left). Light mode by default, dark mode
in Settings. Interface text comes from the website's own `assets/i18n.js` (`npm run sync-i18n`); app-only screens
use `src/i18n/app.ts`. Articles are shown only in a language they have really been translated into; automatic
translations are labelled, exactly as on the website.

## Readers stay inside the app

Every link goes through `src/lib/links.ts`:

* A wartabiyetv.com address opens the matching app screen: `/war/<id>.html` the article, `/soomaaliya/`, `/caalamka/`,
  `/ciyaaraha/` the sections, `/wararka-tooska/` LIVE, `/muuqaal/` and `/toos/` Videos. About us, Contact us, Privacy,
  Editorial ethics, Corrections and the advertising pages open as the website's own page **inside the app**
  (`app/page/[slug].tsx`, without the website's header and footer, in the reader's language and theme).
* Links from outside the app use the same map (`app/+native-intent.tsx`): Android App Links (`app.json` intent filter,
  verified by `/.well-known/assetlinks.json` on the website), iPhone Universal Links (`associatedDomains`; needs the
  Apple Team ID in `/.well-known/apple-app-site-association` once the Apple Developer account exists), `wartabiye://`
  links and notification taps.
* Other websites the reader chooses to open (a news source, a photo credit, an advertiser, Facebook / YouTube / TikTok)
  open in the app's own browser screen (`app/browser.tsx`) with a Back button. Only the share buttons (WhatsApp,
  Facebook, X, Telegram, LinkedIn) hand the link to those apps, and e-mail links open the mail app.
* `/admin/` and the admin Worker are never opened by the app (`test/links.test.mjs`).

## Commands

```bash
cd mobile
npm ci
npm start                 # Expo dev server (Expo Go / development build)
npm run web               # the web app in the browser
npm run typecheck
npm test                  # sync test + app checks (needs python3 and Playwright's Chromium)
npm run test:live         # app checks against https://www.wartabiyetv.com/
npm run build:pwa         # rebuild ../app (the web app) after changing the app's code, then commit ../app
npm run sync-i18n         # copy the website's interface text again after assets/i18n.js changes
```

Android on your own computer (Android Studio + JDK 17): `npx expo prebuild --platform android && cd android && ./gradlew assembleRelease`.

## Tests

* `test/sync.e2e.mjs`: on a private copy of the content, runs the real publish steps and checks in the running app that
  a new article, an edit, a replaced image and an unpublished article all reach the app **without reinstalling or
  reloading it**, and that opened articles stay readable offline.
* `test/app.e2e.mjs`: nine languages, Arabic right-to-left, sections, LIVE, bookmarks after restart, search, 320 / 390 /
  768 / 1280 px screens, dark mode, photo credit and licence, and that the app's code holds no admin address, token,
  GitHub key or AI service.
* `test/android-smoke.sh`: installs the real APK on an Android emulator, checks it shows the live website's newest
  headline, and that `https://www.wartabiyetv.com/war/<id>.html`, `/caalamka/`, `/xiriir/` and `wartabiye://war/<id>`
  open inside the app (the app stays in front, no browser), without crashing.
* `test/ios-smoke.sh`: the iPhone app built for the iOS Simulator (`ios` job), opened on an iPhone simulator: live news,
  an article link, the World section and the Contact page inside the app.
* `test/links.test.mjs`: which screen every website address opens; the admin never.
* `test/security-live.sh`: every private admin API refuses requests without the owner's session, also with a forged
  cookie, a forged token, a forged Origin and write methods. The `android` job also scans the APK's code for admin
  addresses, keys and tokens.
* `../workers/push/test/worker.test.mjs`: app push registration, Expo delivery, categories, no repeats, dead tokens.
* `../workers/admin/test/worker.test.mjs`: app visits in the owner's statistics.

## What still needs the owner (accounts and keys the code cannot create)

| Item | Why | Cost |
|---|---|---|
| **Expo account** + `npx eas-cli init` in `mobile/` | Gives the project id push tokens need. Put it in the repository variable `EAS_PROJECT_ID` (Settings → Secrets and variables → Actions → Variables) | Free |
| **Firebase project** (Android push) | Expo sends Android notifications through Firebase Cloud Messaging: upload the FCM V1 service-account key with `npx eas-cli credentials` | Free |
| **Push Worker deployed** (`workers/push/README.md`) and push switched on in /admin/ → Ogeysiisyada | The same Worker serves the website bell and the app. The app shows "not switched on yet" until then | Free (Cloudflare free plan) |
| **Google Play Developer account** | To publish the AAB. Then add the upload key as secrets `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` | US$25 once |
| **Apple Developer Program** | iPhone builds, TestFlight, App Store, iPhone push (APNs key) | US$99 per year |
| `.well-known/assetlinks.json` (Android) and `apple-app-site-association` (iPhone) on the website | So `https://www.wartabiyetv.com/war/...` links open straight in the app. Needs the signing key fingerprint / Apple Team ID | Free |

Until the Play upload key exists, the APK and AAB from GitHub Actions are signed with a **test key**: the APK installs on
any Android phone (allow "install unknown apps"), but Google Play will not accept that AAB.

## iPhone (TestFlight)

`.github/workflows/ios-testflight.yml` builds the iPhone app on GitHub's Macs, drives it on iPhone SE and Pro Max
simulators against the live website (9 languages, articles, bookmarks, search, sections), and builds it for real
iPhones. With the owner's Apple Developer secrets it signs the build, uploads it to App Store Connect and invites the
tester in TestFlight. The owner's steps (enrolment, App Store Connect app, API key, GitHub secrets) are in
[IOS-TESTFLIGHT.md](IOS-TESTFLIGHT.md). Bundle id: `com.wartabiyetv.app`.

## Privacy and security

The app only **reads public files**. It holds no admin password, GitHub token, API key or publishing permission, and
cannot call the admin's private API (that needs the owner's GitHub login and MFA). It stores settings, saved articles and
offline copies on the phone only. If allowed in Settings, it sends the same anonymous page views as the website
(page and language; no name, no device id), counted in /admin/ → Analytics under the source "Wartabiye TV app".
The push token and chosen categories are stored only in the push Worker.

## Advertising

Sponsored placements come from /admin/ → Xayeysiisyada, the same as the website, inside their dates and always labelled
"ADVERTISEMENT". No ad network or paid ad service is used or switched on.
