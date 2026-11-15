#!/bin/bash
# Prepares the owner's separate "Wartabiye Admin" iPhone app for installing from Xcode with the free Apple Account
# (IPHONE-ADMIN-INSTALL.md). Use its own copy of the project, NOT the folder of the public app:
#   git clone https://github.com/Mahadupdalla/wartabiye-tv.git ~/Desktop/wartabiye-admin-ios
#   bash ~/Desktop/wartabiye-admin-ios/mobile/scripts/iphone-admin-install.sh
# It checks the tools, installs the packages, writes mobile/.wtv-admin (bundle id and team, on this Mac only), generates
# the Xcode project (ios/) of the admin app and opens it in Xcode. The public app and its folder are not touched.
set -e
cd "$(dirname "$0")/.."
ok() { printf '  \033[32m✓\033[0m %s\n' "$1"; }
stop() { printf '\n  \033[31m✗ %s\033[0m\n\n' "$1"; exit 1; }

echo "Wartabiye Admin: preparing the admin iPhone app for Xcode"
[ "$(uname)" = Darwin ] || stop "This needs a Mac."
[ -f .wtv-free-signing ] && stop "This folder holds the PUBLIC app (mobile/.wtv-free-signing). Use a separate copy for the admin app: see IPHONE-ADMIN-INSTALL.md step 1."
xcodebuild -version >/dev/null 2>&1 || stop "Xcode is missing: install it from the Mac App Store, open it once, then run this again."
XV=$(xcodebuild -version | head -1 | awk '{print $2}')
[ "${XV%%.*}" -ge 27 ] 2>/dev/null || stop "Xcode $XV is too old: this app needs Xcode 27 or newer (Mac App Store → Updates)."
ok "Xcode $XV"
command -v node >/dev/null || stop "Node.js is missing: install the LTS version from https://nodejs.org, then run this again."
NV=$(node -v | tr -d v); [ "${NV%%.*}" -ge 20 ] || stop "Node.js $NV is too old: install the LTS version from https://nodejs.org."
ok "Node.js $NV"
command -v pod >/dev/null || { command -v brew >/dev/null && brew install cocoapods; } || stop "CocoaPods is missing. In Terminal run:  sudo gem install cocoapods   then run this again."
ok "CocoaPods $(pod --version)"

echo "Installing the app's packages (a few minutes the first time)…"
npm ci --no-audit --no-fund
# the same Personal Team as the public app, if its folder is on the Desktop; the admin app's own bundle id
PUB="$HOME/Desktop/wartabiye-tv-ios/mobile/.wtv-free-signing"
node -e '
  const fs = require("fs"); let m = {}, pub = {};
  try { m = JSON.parse(fs.readFileSync(".wtv-admin", "utf8") || "{}"); } catch (e) {}
  try { pub = JSON.parse(fs.readFileSync(process.argv[1], "utf8") || "{}"); } catch (e) {}
  if (process.argv[2]) m.bundleId = process.argv[2];
  if (!m.bundleId) m.bundleId = "com.wartabiyetv.admin.personal";
  if (!m.teamId && pub.teamId) m.teamId = pub.teamId;
  fs.writeFileSync(".wtv-admin", JSON.stringify(m, null, 1) + "\n");
  console.log("  ✓ Bundle id " + m.bundleId + (m.teamId ? ", team " + m.teamId : ", team: choose it in Xcode (step 4)"));
' "$PUB" "${WTV_IOS_BUNDLE_ID:-}"

echo "Generating the Xcode project…"
WTV_APP=admin npx expo prebuild --platform ios --clean
WS=$(ls -d ios/*.xcworkspace | head -1)
ok "Xcode project ready: mobile/$WS"
open "$WS"
echo
echo "Xcode is opening. Continue with step 4 of mobile/IPHONE-ADMIN-INSTALL.md (choose your Personal Team, then Run)."
