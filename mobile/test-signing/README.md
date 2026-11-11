# Test-build signing key

This key only signs the **test** APK that CI publishes on the `android-test-build` pre-release
(password `testtest`). It is public on purpose. Because every test build uses the same key, a phone
can install a new test build over the old one.

It cannot publish anything. Google Play builds are signed with the owner's upload key, which lives
in the repository secrets (`ANDROID_KEYSTORE_BASE64` and so on) and is never committed.
