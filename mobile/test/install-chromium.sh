#!/bin/sh
# Chromium for the Playwright tests, with the Ubuntu packages (fonts, libraries) it needs.
# GitHub's Azure mirror of Ubuntu is sometimes unreachable: refresh the package lists and retry, then try
# Ubuntu's own archive, and only then run with the libraries the runner already has (the tests still run;
# only some fonts may be missing from screenshots). A failure here never skips a test.
set -u
for i in 1 2 3; do
  npx playwright install --with-deps chromium && exit 0
  echo "browser packages failed (attempt $i), retrying in $((i * 20)) s"
  sleep $((i * 20))
  sudo apt-get update -o Acquire::Retries=3 || true
done
echo "Azure mirror unreachable: switching to archive.ubuntu.com"
sudo sed -i 's#http://azure.archive.ubuntu.com/ubuntu#http://archive.ubuntu.com/ubuntu#g' /etc/apt/sources.list /etc/apt/sources.list.d/*.sources 2>/dev/null || true
sudo apt-get update -o Acquire::Retries=3 || true
npx playwright install --with-deps chromium && exit 0
echo "::warning::Ubuntu package mirrors unreachable; the tests run with the browser libraries already on the runner"
npx playwright install chromium
