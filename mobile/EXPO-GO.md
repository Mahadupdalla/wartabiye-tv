# Wartabiye TV on your iPhone through Expo Go (free)

Expo Go is a free app from Expo in the App Store. It runs the app's real code (the same code as the
Android and TestFlight apps) without the Apple Developer Program. Limits: push notifications don't work in
Expo Go, and Expo Go only runs the newest Expo version. The workflow checks this and writes the result in its
Summary. Workflow: `.github/workflows/expo-go.yml` (Actions → **iPhone preview in Expo Go**).

## Once: about 10 minutes, free

1. **On the iPhone:** install **Expo Go** from the App Store.
2. **Free Expo account:** https://expo.dev/signup (an email and a password; no payment).
3. **Create the project:** https://expo.dev → **Create a project** → name `Wartabiye TV`, slug `wartabiye-tv` →
   **Create**. On the project page, copy the **ID** (looks like `1a2b3c4d-....`).
4. **Give GitHub the project ID** (not a secret):
   https://github.com/Mahadupdalla/wartabiye-tv/settings/variables/actions → **New repository variable** →
   name `EAS_PROJECT_ID`, value the ID → **Add variable**.
5. **Give GitHub a key for your Expo account:** https://expo.dev/settings/access-tokens → **Create token** →
   name `GitHub` → **Create** → copy it. Then
   https://github.com/Mahadupdalla/wartabiye-tv/settings/secrets/actions → **New repository secret** →
   name `EXPO_TOKEN`, paste → **Add secret**. (Nobody, including Claude, can read it back.)
6. **Publish:** https://github.com/Mahadupdalla/wartabiye-tv/actions/workflows/expo-go.yml → **Run workflow** →
   branch `main` → **Run workflow** (about 5 minutes). Every later change on `main` republishes by itself.

## Open it on the iPhone

Open https://github.com/Mahadupdalla/wartabiye-tv/releases/tag/expo-go on another screen and scan the QR code with
the iPhone **Camera**, or open that page on the iPhone and tap the `exp://` link. Expo Go opens Wartabiye TV.
Later, it's listed under **Recently opened** in Expo Go.

The project ID also lets the Android and TestFlight builds receive push notifications through Expo.
