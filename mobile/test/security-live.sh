#!/bin/sh
# Server-side protection of the admin, tested from OUTSIDE like a public app user who edits requests:
# every private admin API must refuse a request without the owner's signed-in session (GitHub login + MFA), also with a
# forged session cookie, a forged Origin, a forged GitHub token header or a write method. Hiding buttons is not enough.
#   sh test/security-live.sh [admin-base]
ADMIN="${1:-https://wartabiye-admin.wartabiye.workers.dev}"
fail=0; n=0
probe() { # method path expected-codes [extra curl args...]
  m="$1"; p="$2"; ok="$3"; shift 3
  code=$(curl -s -o /dev/null -w '%{http_code}' -X "$m" "$@" "$ADMIN$p")
  n=$((n+1))
  case " $ok " in *" $code "*) echo "ok   $m $p -> $code";; *) echo "FAIL $m $p -> $code (expected $ok)"; fail=1;; esac
}
for p in /api/me /api/analytics/summary /api/analytics/realtime /api/automation /api/security /api/github/user /api/github/repos/Mahadupdalla/wartabiye-tv/contents/data/news.json /api/unknown; do
  probe GET "$p" "401 403"
  probe GET "$p" "401 403" -H 'Cookie: __Host-wtv_s=forged.session.value' -H 'Authorization: Bearer ghp_forged000000000000000000000000000000'
done
for p in /api/ping /api/security/signout-others /api/automation /api/github/repos/Mahadupdalla/wartabiye-tv/contents/data/news/x.json; do
  probe POST "$p" "401 403 405" -H "Origin: $ADMIN" -H 'Content-Type: application/json' --data '{}'
  probe PUT "$p" "401 403 405" -H "Origin: $ADMIN" -H 'Content-Type: application/json' --data '{"message":"x","content":"eA=="}'
  probe DELETE "$p" "401 403 405" -H "Origin: $ADMIN"
done
# the dashboard pages themselves send a stranger to the sign-in page
probe GET / "302 303"
probe GET /cms/ "302 303"
echo "$n requests checked"
[ $fail = 0 ] && echo "admin API: closed to everyone without the owner's session" || { echo "admin API: SOMETHING ANSWERED WITHOUT A SESSION"; exit 1; }
