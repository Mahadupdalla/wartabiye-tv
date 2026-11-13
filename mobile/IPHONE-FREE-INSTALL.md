# Wartabiye TV on your own iPhone, free, with a Mac and Xcode

This installs the **real native Wartabiye TV app** (the same app TestFlight would deliver) on your iPhone, with its own
icon on the Home Screen. No Expo Go, no Safari, no Apple Developer Program, no payment. About 30–45 minutes the first
time, mostly downloads.

## What the free way cannot do

| | Free Apple Account (this guide) | Paid Apple Developer Program (TestFlight) |
|---|---|---|
| Cost | free | US$99 per year |
| The app on your Home Screen | yes, opens on its own | yes |
| News, 9 languages, design, saved articles, search, LIVE | yes | yes |
| How long it keeps opening | **7 days**, then connect the iPhone to the Mac and press Run again (2 minutes) | 90 days per build, new builds arrive by themselves |
| Push notifications (breaking news alerts) | **no**: Apple allows them only for paid accounts | yes |
| wartabiyetv.com links in other apps open the app | **no** (they open in Safari) | yes |
| Install on other people's iPhones | only iPhones plugged into your Mac, at most 3 per week | up to 100 testers by email |

The app has a slightly different internal id here (`com.wartabiyetv.app.personal`), so `com.wartabiyetv.app` stays
free for TestFlight and the App Store later. Both can sit on the same iPhone.

## What you need

* A Mac with the newest macOS that the newest Xcode needs, and about 40 GB free disk space.
* **Xcode 27 or newer** (free, Mac App Store). The app's Expo version needs it; older Xcode fails to build.
* Your iPhone (iOS 16.4 or newer) and its USB cable.
* Your normal Apple ID (the one on your iPhone works).

## 1. Install the tools on the Mac (once)

1. **Xcode:** App Store → search **Xcode** → Get. When it's installed, open it once and accept everything it asks
   (it installs extra parts). Make sure the **iOS** platform is ticked if it asks which platforms to download.
2. **Node.js:** https://nodejs.org → download the **LTS** version → open the file and click through the installer.
3. **Sign in to Xcode:** Xcode → **Settings…** → **Accounts** → **+** → **Apple Account** → sign in with your Apple ID.
   You'll see "(Personal Team)" under your name. That's the free team.

## 2. Get the app's code

Open **Terminal** (Spotlight: press ⌘ Space, type Terminal, Enter) and paste these two lines, pressing Enter after
each:

```
cd ~/Desktop
git clone https://github.com/Mahadupdalla/wartabiye-tv.git
```

(If the Mac offers to install "command line developer tools", click **Install**, wait, and paste the second line again.)

## 3. Prepare the Xcode project

Still in Terminal:

```
bash ~/Desktop/wartabiye-tv/mobile/scripts/iphone-free-install.sh
```

It checks Xcode, Node.js and CocoaPods (the iPhone package tool, it tells you how to install it if missing), downloads
the app's packages, builds the Xcode project and opens it. 5–15 minutes. It ends with "Xcode is opening".

## 4. Sign with your free team

In Xcode:

1. In the left column click the blue **WartabiyeTV** icon at the very top.
2. In the middle, under **TARGETS**, click **WartabiyeTV**, then the **Signing & Capabilities** tab.
3. Tick **Automatically manage signing**. Under **Team** choose **Your Name (Personal Team)**.
4. Bundle Identifier must say `com.wartabiyetv.app.personal`. If Xcode says it is not available, change it to something
   only you would use, e.g. `com.wartabiyetv.app.mahad`.
5. Wait until the red errors under Signing disappear (Xcode makes a free certificate; this needs internet).

## 5. Prepare the iPhone (once)

1. Plug the iPhone into the Mac and unlock it. Tap **Trust** on the iPhone and enter its passcode.
2. **Developer Mode:** on the iPhone, Settings → **Privacy & Security** → scroll to the bottom → **Developer Mode** →
   on → **Restart**. After the restart tap **Turn On** and enter the passcode. (If Developer Mode is not listed yet,
   do step 6 once; the iPhone then shows it.)

## 6. Install

1. At the top of Xcode, in the device menu (next to "WartabiyeTV"), choose **your iPhone** (not a simulator).
2. Press the **▶ Run** button (or ⌘ R). The first build takes 5–15 minutes; the progress is at the top of Xcode.
3. The first time, the iPhone says **"Untrusted Developer"**. On the iPhone: Settings → **General** →
   **VPN & Device Management** → your Apple ID under "Developer App" → **Trust "…"** → Trust.
4. Press **▶ Run** again. Wartabiye TV opens on the iPhone.

Wartabiye TV now has its own icon on your Home Screen. You can unplug the iPhone; the app opens on its own and loads
the news from wartabiyetv.com every time. (The project is set to build the finished "Release" app, so it does not need
the Mac to run.)

## Every 7 days

When the free signature expires the app stops opening (it says it is "no longer available"). Your saved articles and
settings stay. Plug the iPhone into the Mac, open `~/Desktop/wartabiye-tv/mobile/ios/WartabiyeTV.xcworkspace` in Xcode,
choose your iPhone and press **▶ Run**.

## Getting the newest version of the app

In Terminal:

```
cd ~/Desktop/wartabiye-tv && git pull && bash mobile/scripts/iphone-free-install.sh
```

then steps 4 and 6 again.

## If something goes wrong

* **"No account for team" / "Signing requires a development team"**: step 1.3 and step 4.3.
* **"Failed to register bundle identifier" / "not available"**: step 4.4 (choose another ending such as `.mahad2`).
* **"Your maximum App ID limit has been reached"**: free accounts can create 10 app ids per week; wait a few days or
  reuse the id from before.
* **"Developer Mode disabled"**: step 5.2.
* **"Could not launch… Untrusted Developer"**: step 6.3.
* **A build error mentioning Swift, ExpoModulesJSI or "data races"**: Xcode is too old; update it to 27 or newer.
* **"pod: command not found"**: in Terminal run `sudo gem install cocoapods` (it asks for your Mac password), then step 3.
* Anything else: copy the red error text from Xcode (Report navigator, the last icon in the left column) and send it
  to Claude in the project chat.
