#!/usr/bin/env bash
# Saves one entry in data/deploy-status.json on main (shown in /admin/ -> "Daabacaadda iyo PR-yada").
# Usage: bash tools/deploy_status_push.sh deploy|pr --result ... (same arguments as tools/deploy_status.py)
# Never fails the workflow: the status file is information only. Works on a fresh copy of main each try, so it
# never pushes anything else that the job left in its folder.
set -u
cp tools/deploy_status.py /tmp/deploy_status.py
git config user.name "wartabiye-bot"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git rebase --abort >/dev/null 2>&1 || true
for i in 1 2 3 4; do
  git fetch -q origin main && git checkout -q -f -B deploy-status-save origin/main || { sleep 5; continue; }
  cp /tmp/deploy_status.py tools/deploy_status.py
  python3 tools/deploy_status.py "$@" || exit 0
  git add data/deploy-status.json
  git diff --cached --quiet && exit 0
  git commit -q -m "Xaaladda daabacaadda: $1 $3" && git push -q origin HEAD:main && { echo "deploy status saved"; exit 0; }
  sleep $((i * 5))
done
echo "::warning::could not save data/deploy-status.json (the deploy itself is not affected)"
exit 0
