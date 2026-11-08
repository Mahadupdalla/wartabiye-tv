#!/usr/bin/env bash
# One update of the LIVE News wire and Video News feeds (tools/live_feeds.py): official publisher RSS headlines and
# official YouTube channels. Run by the 5-minute source check loop (tools/fast_loop.sh) at every 5-minute mark, and by
# .github/workflows/live-feeds.yml when started by hand or when its settings change. GitHub's own "*/5" schedule does not
# fire on this repository, which is why the LIVE News sources were last updated at 23:09 on 8 Nov 2026.
#
# Output: branch "live-data" (read by the site from raw.githubusercontent.com, no Pages rebuild needed) and, about once
# an hour, a copy in data/live-feeds/ on main as a fallback.
#   needs GH_TOKEN and REPO; run from the repository checkout
set -u
REMOTE="https://x-access-token:${GH_TOKEN}@github.com/${REPO}.git"
BOT=(-c user.name=wartabiye-bot -c user.email=41898282+github-actions[bot]@users.noreply.github.com)
OUT=/tmp/live-out
mkdir -p "$OUT"
if [ ! -s "$OUT/feeds-status.json" ]; then
  # previous data (kept between checks inside one loop; read from the branch at the start)
  ( rm -rf /tmp/live-prev && mkdir /tmp/live-prev && cd /tmp/live-prev && git init -q && git fetch -q --depth=1 "$REMOTE" live-data \
    && git checkout -q FETCH_HEAD -- . && cp -f ./*.json "$OUT"/ ) 2>/dev/null || echo "live feeds: first run"
fi
python3 tools/live_feeds.py "$OUT" || { echo "live feeds: update failed (logged; the next check retries)"; exit 1; }
( cd "$OUT" && rm -rf .git && git init -q -b live-data && git add video-feed.json live-wire.json feeds-status.json \
  && git "${BOT[@]}" commit -q -m "Live feeds $(date -u +%FT%TZ)" && git push -q -f "$REMOTE" live-data ) || { echo "live feeds: could not save branch live-data"; exit 1; }
# hourly copy on the website itself (fallback when raw.githubusercontent.com cannot be reached)
mkdir -p data/live-feeds
age=$(python3 -c "import json,datetime as D;t=json.load(open('data/live-feeds/feeds-status.json'))['checkedAt'];print(int((D.datetime.now(D.timezone.utc)-D.datetime.fromisoformat(t.replace('Z','+00:00'))).total_seconds()))" 2>/dev/null || echo 999999)
if [ "$age" -ge 3300 ]; then
  cp "$OUT/video-feed.json" "$OUT/live-wire.json" "$OUT/feeds-status.json" data/live-feeds/
  git add data/live-feeds
  if ! git diff --cached --quiet && git "${BOT[@]}" commit -q -m "Muuqaal iyo wararka tooska: nuqul saacadle ah"; then
    for i in 1 2 3; do git pull -q --rebase origin main && git push -q origin HEAD:main && break; sleep 5; done
    gh api -X POST "repos/${REPO}/pages/builds" -q .status >/dev/null 2>&1 || true
  fi
fi
echo "live feeds: updated $(python3 -c "import json;print(json.load(open('$OUT/live-wire.json')).get('updatedAt'))")"
