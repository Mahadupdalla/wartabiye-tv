#!/bin/bash
# Prepares the real Wartabiye TV iPhone app for installing from Xcode with a free Apple Account (IPHONE-FREE-INSTALL.md).
# Run on a Mac, from anywhere:  bash mobile/scripts/iphone-free-install.sh
# It checks the tools, installs the app's packages, generates the Xcode project (ios/) and opens it in Xcode.
set -e
cd "$(dirname "$0")/.."
ok() { printf '  \033[32m✓\033[0m %s\n' "$1"; }
stop() { printf '\n  \033[31m✗ %s\033[0m\n\n' "$1"; exit 1; }

echo "Wartabiye TV: preparing the iPhone app for Xcode"
[ "$(uname)" = Darwin ] || stop "This needs a Mac."
xcodebuild -version >/dev/null 2>&1 || stop "Xcode is missing: install it from the Mac App Store, open it once, then run this again."
XV=$(xcodebuild -version | head -1 | awk '{print $2}')
[ "${XV%%.*}" -ge 27 ] 2>/dev/null || stop "Xcode $XV is too old: this app needs Xcode 27 or newer (Mac App Store → Updates)."
ok "Xcode $XV"
command -v node >/dev/null || stop "Node.js is missing: install the LTS version from https://nodejs.org, then run this again."
NV=$(node -v | tr -d v); [ "${NV%%.*}" -ge 20 ] || stop "Node.js $NV is too old: install the LTS version from https://nodejs.org."
ok "Node.js $NV"
if ! command -v pod >/dev/null; then
  if command -v brew >/dev/null; then brew install cocoapods
  else stop "CocoaPods is missing. In Terminal run:  sudo gem install cocoapods   (type your Mac password), then run this again."
  fi
fi
ok "CocoaPods $(pod --version)"

echo "Installing the app's packages (a few minutes the first time)…"
npm ci --no-audit --no-fund
echo "Generating the Xcode project…"
WTV_FREE_SIGNING=1 npx expo prebuild --platform ios --clean
ok "Xcode project ready: mobile/ios/WartabiyeTV.xcworkspace"
open ios/WartabiyeTV.xcworkspace
echo
echo "Xcode is opening. Continue with step 4 of mobile/IPHONE-FREE-INSTALL.md (choose your Personal Team, then Run)."
