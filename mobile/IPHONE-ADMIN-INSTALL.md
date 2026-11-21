# Wartabiye Admin: installing the owner's admin app on your iPhone

The admin app is a separate app from the public Wartabiye TV app. It has the admin sign-in (GitHub plus your 6-digit
code, the same as the dashboard in Safari), the admin dashboard and the App updates screen. The public app has none of
this. You install the admin app once from Xcode with your free Apple Account (Personal Team); after that its changes can
arrive over the air on its own channel ("admin").

Nothing here touches the public app: it has its own folder (`~/Desktop/wartabiye-tv-ios`), its own bundle id and its
own data.

## 1. A separate copy of the project (Terminal, once)

```
git clone https://github.com/Mahadupdalla/wartabiye-tv.git ~/Desktop/wartabiye-admin-ios
```

## 2. Prepare the admin app

```
bash ~/Desktop/wartabiye-admin-ios/mobile/scripts/iphone-admin-install.sh
```

It installs the packages, uses the same Personal Team as your public app, generates the Xcode project of
"Wartabiye Admin" (bundle id `com.wartabiyetv.admin.personal`) and opens it in Xcode.

## 3. Connect the iPhone

Plug the iPhone into the Mac with the cable and unlock it.

## 4. Xcode: team and Run

1. In Xcode, click **WartabiyeAdmin** at the top of the left column, then **Signing & Capabilities**.
2. Under **Team**, choose your Personal Team (your name). Leave "Automatically manage signing" on.
3. At the top, choose your iPhone as the device and press **Run** (the ▶ button).

If Xcode says the bundle id is not available, change the last part of it in Signing & Capabilities (for example
`com.wartabiyetv.admin.mahad`) and press Run again; the next time, run step 2 with
`WTV_IOS_BUNDLE_ID=com.wartabiyetv.admin.mahad` in front so it is kept.

## 5. Open it and sign in

Tap **Wartabiye Admin** on the iPhone, then **Sign in**, and sign in as on the dashboard. After sign-in you get three
tabs: **Dashboard**, **App updates** and **Sign out**.

## Limits of the free Apple Account

- At most 3 of your own apps can be installed from Xcode at the same time (public app + admin app = 2).
- Each of them stops opening after 7 days. Plug the iPhone in, open its folder's Xcode project and press Run again.
  An over-the-air update cannot renew an expired app.
- Apple allows only 10 new app ids per 7 days for a free account.

## Updating the admin app later

- Screen changes: GitHub → Actions → "iPhone app update" → Run workflow → app: **admin**.
- After a change to native parts, run steps 2 and 4 again in `~/Desktop/wartabiye-admin-ios` (first `git pull`).
