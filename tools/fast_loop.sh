#!/usr/bin/env bash
# The 5-minute source check, day and night (owner's rule, 8 Nov 2026: 24/7, no overnight pause).
#
# GitHub's own "*/5" schedule does not fire on this repository (on 8 Nov 2026 it did not start a single run all day), so
# .github/workflows/fast-sources.yml runs this loop instead: ONE job checks every source at :00, :05, :10 ... (wall clock,
# so UTC and Africa/Nairobi give the same minutes), for about 5.5 hours, then the workflow starts the next job. The
# workflow's concurrency group keeps exactly one loop running; a second start waits in the queue and never runs a check
# at the same time.
#
# Each check: cheap feed reads only (no AI), also the LIVE News wire and Video News feeds (tools/live_feeds_cycle.sh). New, genuinely fresh stories are handed to the news task (branch world-feed);
# when nothing is new the check simply ends. A failed check is logged and the next one retries in 5 minutes.
#
#   LOOP_MINUTES   how long this job keeps checking (default 330)
#   FORCE          "true" = check even outside operating hours (data/schedule.json "hours"; "24/7" = always open)
#   GH_TOKEN, REPO the job's token and owner/name (set by the workflow)
set -u
cd "$GITHUB_WORKSPACE"
LOOP_MINUTES=${LOOP_MINUTES:-330}
FORCE=${FORCE:-false}
REMOTE="https://x-access-token:${GH_TOKEN}@github.com/${REPO}.git"
BOT=(-c user.name=wartabiye-bot -c user.email=41898282+github-actions[bot]@users.noreply.github.com)
end=$(( $(date +%s) + LOOP_MINUTES * 60 ))
mkdir -p /tmp/fast
n=0

restore_state() {
  # previous monitor state (branch fast-feed): seen ids, tracked stories, run log
  if git fetch -q origin fast-feed 2>/dev/null; then
    for f in state.json candidates.json alerts.txt; do git show origin/fast-feed:$f > /tmp/fast/$f 2>/dev/null || rm -f /tmp/fast/$f; done
  fi
}

cycle() {
  cd "$GITHUB_WORKSPACE"
  # the newest main: new articles (for "published / held" tracking), source list changes, monitor fixes
  git fetch -q origin main && git reset -q --hard origin/main || echo "could not update main, checking with the current copy"
  cp /tmp/fast/alerts.txt /tmp/alerts-before.txt 2>/dev/null || : > /tmp/alerts-before.txt
  state=$(python3 tools/fast_monitor.py hours)
  if [ "$state" != open ] && [ "$FORCE" != true ]; then
    echo "$(TZ=Africa/Nairobi date '+%F %H:%M') Africa/Nairobi: outside operating hours, no source checked"; return 0
  fi
  # LIVE News wire + Video News feeds (official publisher RSS / YouTube), same 5-minute clock
  cp tools/live_feeds_cycle.sh /tmp/live_feeds_cycle.sh && bash /tmp/live_feeds_cycle.sh || echo "live feeds failed this time (the next check retries)"
  python3 tools/fast_monitor.py run --state /tmp/fast $([ "$FORCE" = true ] && echo --force) || { echo "check failed (logged; the next check retries)"; return 1; }

  # state and candidates: branch fast-feed, one commit, no history
  ( cd /tmp/fast && rm -rf .git && git init -q -b fast-feed && git add state.json candidates.json fast-status.json alerts.txt README.txt \
    && git "${BOT[@]}" commit -q -m "5-minute monitor $(date -u +%FT%TZ)" && git push -q -f "$REMOTE" fast-feed ) || echo "could not save fast-feed"

  # fresh articles -> the news task's list (branch world-feed); nothing new = nothing to do, no AI is started
  if python3 -c "import json,sys;sys.exit(0 if json.load(open('/tmp/fast/candidates.json'))['items'] else 1)"; then
    for i in 1 2 3; do
      ( rm -rf /tmp/wf && mkdir /tmp/wf && cd /tmp/wf && git init -q
        { git fetch -q "$REMOTE" world-feed && git checkout -q -b world-feed FETCH_HEAD; } || git checkout -q -b world-feed
        python3 "$GITHUB_WORKSPACE/tools/fast_monitor.py" handoff --fast /tmp/fast/candidates.json --world /tmp/wf/candidates.json
        git add candidates.json
        git diff --cached --quiet && { echo "world-feed list already up to date"; exit 0; }
        git "${BOT[@]}" commit -q -m "5-minute monitor hand-off $(date -u +%FT%TZ)" && git push -q "$REMOTE" world-feed ) && break
      sleep 5
    done
  else
    echo "nothing fresh to hand over"
  fi

  # the admin copy (/admin/ -> Ilaha wararka -> Ilaha degdegga ah): about once an hour, or at once when an alert starts or ends
  old=$(python3 -c "import json;print(json.load(open('data/world/fast-status.json')).get('updatedAt',''))" 2>/dev/null || true)
  age=$(python3 -c "import datetime;o='$old';print(9999 if not o else int((datetime.datetime.now(datetime.timezone.utc)-datetime.datetime.fromisoformat(o)).total_seconds()//60))")
  if [ "$age" -ge 55 ] || ! cmp -s /tmp/alerts-before.txt /tmp/fast/alerts.txt; then
    cp /tmp/fast/fast-status.json data/world/fast-status.json
    if git add data/world/fast-status.json && git "${BOT[@]}" commit -q -m "Ilaha degdegga ah: xaaladda"; then
      for i in 1 2 3; do git pull -q --rebase origin main && git push -q origin HEAD:main && break; sleep 5; done
    fi
  fi

  # admin alert (GitHub issue) when a source is unavailable or delayed; closes itself when the sources are back
  if ! cmp -s /tmp/alerts-before.txt /tmp/fast/alerts.txt; then
    title="Ilaha wararka: digniin (source monitor alert)"
    num=$(gh issue list --state open --search "\"$title\" in:title" --json number -q '.[0].number' 2>/dev/null || true)
    if [ -s /tmp/fast/alerts.txt ]; then
      { echo "The 5-minute source monitor found a problem ($(TZ=Africa/Nairobi date '+%F %H:%M') Africa/Nairobi):"; echo; sed 's/^/- /' /tmp/fast/alerts.txt; echo
        echo "Details: /admin/ → Ilaha wararka → Ilaha degdegga ah, or branch fast-feed (README.txt). This issue closes by itself when the sources are back."; } > /tmp/body.md
      if [ -n "$num" ]; then gh issue comment "$num" -F /tmp/body.md; else gh issue create --title "$title" -F /tmp/body.md; fi
    elif [ -n "$num" ]; then
      gh issue close "$num" -c "All monitored sources are working again ($(TZ=Africa/Nairobi date '+%F %H:%M') Africa/Nairobi)."
    fi || echo "could not write the alert issue"
  fi
  return 0
}

restore_state
while :; do
  n=$((n + 1))
  echo "::group::check $n, $(TZ=Africa/Nairobi date '+%F %H:%M:%S') Africa/Nairobi"
  cycle; rc=$?
  echo "::endgroup::"
  line=$(head -3 /tmp/fast/README.txt 2>/dev/null | sed -n 2p)
  echo "- check $n $(TZ=Africa/Nairobi date '+%H:%M') Africa/Nairobi: $([ $rc = 0 ] && echo ok || echo FAILED) ${line}" >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
  # next check at the next 5-minute mark of the clock (:00, :05, :10 ...), 5 seconds after it
  wait_s=$(( 300 - $(date +%s) % 300 + 5 ))
  [ $(( $(date +%s) + wait_s + 240 )) -lt "$end" ] || break
  sleep "$wait_s"
done
echo "loop finished after $n checks; the workflow starts the next loop"
