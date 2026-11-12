# Wartabiye TV on iPhone through TestFlight

The iPhone app is the real native app built from `mobile/` (the same React Native code as the Android app). GitHub's
Mac machines build it, test it on iPhone simulators and, once the owner's Apple secrets exist, sign it and upload it to
App Store Connect. Workflow: `.github/workflows/ios-testflight.yml` (Actions → **iPhone app (simulator test + TestFlight)**).

Only the owner can do the steps below, because they need the owner's own Apple ID and payment. Nothing in this
repository pays for anything or submits the app for App Store review.

## 1. Join the Apple Developer Program (US$99 per year)

1. On an iPhone, iPad or Mac: install **Apple Developer** from the App Store, sign in with your Apple ID (two-factor
   authentication must be on), tap **Account → Enroll now**. Or use https://developer.apple.com/programs/enroll/.
2. Choose **Individual** (fastest; the App Store shows your own name as the seller) or **Organization** (shows
   "Wartabiye TV" as the seller, but needs a free D-U-N-S number for the company and takes longer).
3. Pay the fee. Apple usually confirms within 48 hours by email.

## 2. Note your Team ID

https://developer.apple.com/account → **Membership details** → **Team ID** (10 letters and digits, e.g. `A1B2C3D4E5`).

## 3. Register the app identifier

https://developer.apple.com/account/resources/identifiers/list → **+** → **App IDs** → **App** → Continue:

* Description: `Wartabiye TV`
* Bundle ID: **Explicit**, `com.wartabiyetv.app`
* Capabilities: tick **Push Notifications** and **Associated Domains**
* Continue → Register

(The workflow also tries to register it, but App Store Connect needs it before step 4.)

## 4. Create the app in App Store Connect

https://appstoreconnect.apple.com/apps → **+** → **New App**:

* Platforms: **iOS**
* Name: `Wartabiye TV` (if Apple says the name is taken, use e.g. `Wartabiye TV News`)
* Primary language: English (U.K.) (App Store Connect has no Somali; the app itself still opens in Somali)
* Bundle ID: `com.wartabiyetv.app`
* SKU: `wartabiye-tv`
* User access: Full Access → **Create**

## 5. Create an App Store Connect API key

https://appstoreconnect.apple.com/access/integrations/api → **Team Keys** (the first time: **Request Access** and
accept) → **+**:

* Name: `GitHub TestFlight`
* Access: **Admin** (needed so the build machine may create the signing certificate and profile for you)
* **Generate**, then **Download API Key**. The `.p8` file can be downloaded only once: keep it safe.
* Note the **Key ID** (next to the key) and the **Issuer ID** (above the list).

## 6. Add five secrets to GitHub

https://github.com/Mahadupdalla/wartabiye-tv/settings/secrets/actions → **New repository secret**, one at a time:

| Name | Value |
|---|---|
| `APPLE_TEAM_ID` | the Team ID from step 2 |
| `ASC_KEY_ID` | the Key ID from step 5 |
| `ASC_ISSUER_ID` | the Issuer ID from step 5 |
| `ASC_KEY_P8` | open the `.p8` file in a text editor and paste **everything**, including the `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----` lines |
| `TESTFLIGHT_TESTER_EMAIL` | the email of your Apple ID (where the TestFlight invitation goes) |

Secrets are encrypted by GitHub; nobody (including Claude) can read them back, and they never go into the app.

## 7. Build and upload

https://github.com/Mahadupdalla/wartabiye-tv/actions/workflows/ios-testflight.yml → **Run workflow** → branch `main`
→ **Run workflow**. It takes about 30 to 60 minutes. Afterwards every change to the app on `main` uploads a new build
automatically. The run's **Summary** says what happened:

* `Uploaded build N to App Store Connect`, then `processed by Apple (VALID)`
* `available to the internal TestFlight group "Wartabiye TV"` and `Tester ...: invited`
* `TestFlight texts set` (the description, privacy policy, feedback address and "What to Test" from
  `mobile/store/testflight.json`; edit that file to change them)
* or the exact step that is still missing (for example "No App Store Connect app yet").

## 8. Install it on your iPhone

1. Install **TestFlight** from the App Store (Apple's official app).
2. Open the email "Wartabiye TV is now available to test" on the iPhone → **View in TestFlight** → **Accept** →
   **Install**. (Signed in to TestFlight with the same Apple ID, the app also simply appears in the list.)
3. Open **Wartabiye TV** from the home screen.

Internal testers (up to 100 people of your App Store Connect team) need **no Apple review**. A build can be tested for
90 days; newer builds arrive in TestFlight automatically.

## Later (optional)

* **A public TestFlight link for anyone** (up to 10,000 testers): App Store Connect → TestFlight → External Testing →
  add a group, add the build and turn on the public link. The first build of an external group goes through Apple's
  Beta App Review (usually a day) and needs a privacy policy URL (`https://www.wartabiyetv.com/asturnaanta/`).
* **Push notifications on iPhone**: the app sends alerts through Expo. Create a free Expo account, run
  `npx eas-cli init` in `mobile/`, put the project id in the repository variable `EAS_PROJECT_ID`, then
  `npx eas-cli credentials` → iOS → Push Notifications → let it create the Apple push key with your Apple account.
* **wartabiyetv.com links opening the iPhone app** (Universal Links): needs the Team ID in the website file
  `.well-known/apple-app-site-association`. The Team ID is not a secret; give it to Claude to add the file.
* **App Store release**: screenshots, description, age rating and App Review. Not done by this workflow.
