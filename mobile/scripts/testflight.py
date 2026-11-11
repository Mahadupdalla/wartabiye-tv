#!/usr/bin/env python3
"""App Store Connect steps for the Wartabiye TV iPhone app, through Apple's official App Store Connect API.

Used by .github/workflows/ios-testflight.yml with the owner's API key (GitHub secrets). It never buys anything and
never submits the app for App Store review.

  python3 testflight.py check                      the key works, the bundle id and the App Store Connect app exist
  python3 testflight.py bundle-id                  registers com.wartabiyetv.app (push + associated domains) if missing
  python3 testflight.py testflight <build-number>  waits until Apple has processed the uploaded build, puts it in the
                                                   internal TestFlight group "Wartabiye TV" and invites the tester

Environment: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH (the .p8 file), optional TESTFLIGHT_TESTER_EMAIL,
TESTFLIGHT_TESTER_NAME, GITHUB_STEP_SUMMARY. Needs `pip install pyjwt cryptography`.
"""
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

API = os.environ.get('ASC_API_BASE', 'https://api.appstoreconnect.apple.com')  # changed only by the mock test
BUNDLE = os.environ.get('WTV_BUNDLE_ID', 'com.wartabiyetv.app')
APP_NAME = 'Wartabiye TV'
GROUP = 'Wartabiye TV'


class AscError(Exception):
    def __init__(self, status, body):
        super().__init__(f'HTTP {status}: {body[:600]}')
        self.status = status


def token():
    import jwt  # pyjwt
    key = open(os.environ['ASC_KEY_PATH']).read()
    now = int(time.time())
    return jwt.encode({'iss': os.environ['ASC_ISSUER_ID'], 'iat': now, 'exp': now + 1100, 'aud': 'appstoreconnect-v1'},
                      key, algorithm='ES256', headers={'kid': os.environ['ASC_KEY_ID'], 'typ': 'JWT'})


_tok = {'v': None, 't': 0}


def call(method, path, body=None, query=None):
    if not _tok['v'] or time.time() - _tok['t'] > 900:
        _tok['v'], _tok['t'] = token(), time.time()
    url = API + path + ('?' + urllib.parse.urlencode(query) if query else '')
    req = urllib.request.Request(url, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={'Authorization': 'Bearer ' + _tok['v'], 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raise AscError(e.code, e.read().decode(errors='replace'))


def summary(line):
    print(line)
    p = os.environ.get('GITHUB_STEP_SUMMARY')
    if p:
        with open(p, 'a') as f:
            f.write(line + '\n')


def find_bundle_id():
    r = call('GET', '/v1/bundleIds', query={'filter[identifier]': BUNDLE, 'filter[platform]': 'IOS', 'limit': 5})
    return next((b for b in r.get('data', []) if b['attributes']['identifier'] == BUNDLE), None)


def ensure_bundle_id():
    b = find_bundle_id()
    if not b:
        b = call('POST', '/v1/bundleIds', {'data': {'type': 'bundleIds', 'attributes': {
            'identifier': BUNDLE, 'name': APP_NAME, 'platform': 'IOS'}}})['data']
        summary(f'- Registered the app identifier `{BUNDLE}`')
    for cap in ('PUSH_NOTIFICATIONS', 'ASSOCIATED_DOMAINS'):
        try:
            call('POST', '/v1/bundleIdCapabilities', {'data': {'type': 'bundleIdCapabilities',
                 'attributes': {'capabilityType': cap},
                 'relationships': {'bundleId': {'data': {'type': 'bundleIds', 'id': b['id']}}}}})
            print('capability on:', cap)
        except AscError as e:
            if e.status != 409:  # 409: already on
                raise
    return b


def find_app():
    r = call('GET', '/v1/apps', query={'filter[bundleId]': BUNDLE, 'limit': 5})
    return next((a for a in r.get('data', []) if a['attributes']['bundleId'] == BUNDLE), None)


def cmd_check():
    try:
        b = find_bundle_id()
    except AscError as e:
        summary(f'- The App Store Connect API key was refused ({e}). Check the three ASC_* secrets and that the key has the Admin or App Manager role.')
        return 1
    summary(f'- App Store Connect API key: works')
    summary(f'- App identifier `{BUNDLE}`: ' + ('registered' if b else 'not registered yet (the workflow registers it)'))
    a = find_app()
    if not a:
        summary(f'- **No App Store Connect app for `{BUNDLE}` yet.** Create it: App Store Connect → Apps → + → New App '
                f'(platform iOS, name "{APP_NAME}", bundle ID `{BUNDLE}`, SKU wartabiye-tv). Then run this workflow again.')
        return 2
    summary(f'- App Store Connect app: "{a["attributes"]["name"]}" (Apple ID {a["id"]})')
    return 0


def cmd_bundle_id():
    ensure_bundle_id()
    return 0


def ensure_group(app_id):
    groups = call('GET', f'/v1/apps/{app_id}/betaGroups', query={'limit': 50}).get('data', [])
    g = next((x for x in groups if x['attributes']['name'] == GROUP and x['attributes'].get('isInternalGroup')), None)
    if g:
        return g
    g = call('POST', '/v1/betaGroups', {'data': {'type': 'betaGroups',
             'attributes': {'name': GROUP, 'isInternalGroup': True, 'hasAccessToAllBuilds': True},
             'relationships': {'app': {'data': {'type': 'apps', 'id': app_id}}}}})['data']
    summary(f'- Created the internal TestFlight group "{GROUP}" (gets every new build automatically)')
    return g


def ensure_tester(app_id, group_id, email, name):
    r = call('GET', '/v1/betaTesters', query={'filter[email]': email, 'filter[apps]': app_id, 'include': 'betaGroups', 'limit': 5})
    for t in r.get('data', []):
        in_group = any(g['id'] == group_id for g in t.get('relationships', {}).get('betaGroups', {}).get('data', []) or [])
        if in_group:
            summary(f'- Tester {email}: already in "{GROUP}"')
            return
        call('POST', f'/v1/betaGroups/{group_id}/relationships/betaTesters', {'data': [{'type': 'betaTesters', 'id': t['id']}]})
        summary(f'- Tester {email}: added to "{GROUP}"')
        return
    first, _, last = (name or 'Wartabiye').partition(' ')
    try:
        call('POST', '/v1/betaTesters', {'data': {'type': 'betaTesters',
             'attributes': {'email': email, 'firstName': first, 'lastName': last or 'TV'},
             'relationships': {'betaGroups': {'data': [{'type': 'betaGroups', 'id': group_id}]}}}})
        summary(f'- Tester {email}: invited to "{GROUP}". Apple emails the TestFlight invitation to this address.')
    except AscError as e:
        # internal groups take only people who are users of the App Store Connect team (the account holder is one)
        summary(f'- Could not add {email} to the internal group ({e}). The address must be a user of your App Store '
                f'Connect team (Users and Access); the Account Holder\'s Apple ID always is.')


def cmd_testflight(build_number):
    a = find_app()
    if not a:
        cmd_check()
        return 2
    app_id = a['id']
    build = None
    deadline = time.time() + 75 * 60
    state = 'not visible yet'
    while time.time() < deadline:
        r = call('GET', '/v1/builds', query={'filter[app]': app_id, 'filter[version]': str(build_number), 'limit': 5,
                                             'fields[builds]': 'version,processingState,expired,usesNonExemptEncryption,uploadedDate'})
        build = (r.get('data') or [None])[0]
        state = build['attributes']['processingState'] if build else 'not visible yet'
        print(time.strftime('%H:%M:%S'), 'build', build_number, state, flush=True)
        if build and state in ('VALID', 'FAILED', 'INVALID'):
            break
        time.sleep(float(os.environ.get('WTV_POLL_SECONDS', '30')))
    if not build or state != 'VALID':
        summary(f'- Build {build_number}: **{state}** at Apple. See App Store Connect → TestFlight (and the email Apple sent).')
        return 1
    summary(f'- Build {build_number}: processed by Apple (VALID), uploaded {build["attributes"].get("uploadedDate")}')
    if build['attributes'].get('usesNonExemptEncryption') is None:
        call('PATCH', f'/v1/builds/{build["id"]}', {'data': {'type': 'builds', 'id': build['id'],
             'attributes': {'usesNonExemptEncryption': False}}})
        summary('- Export compliance: answered "no non-exempt encryption" (the app only uses standard HTTPS)')
    g = ensure_group(app_id)
    if not g['attributes'].get('hasAccessToAllBuilds'):
        try:
            call('POST', f'/v1/betaGroups/{g["id"]}/relationships/builds', {'data': [{'type': 'builds', 'id': build['id']}]})
        except AscError as e:
            if e.status != 409:
                raise
    summary(f'- Build {build_number} is available to the internal TestFlight group "{GROUP}"')
    email = os.environ.get('TESTFLIGHT_TESTER_EMAIL', '').strip()
    if email:
        ensure_tester(app_id, g['id'], email, os.environ.get('TESTFLIGHT_TESTER_NAME', '').strip())
    else:
        summary('- No TESTFLIGHT_TESTER_EMAIL secret: add yourself in App Store Connect → TestFlight → "Wartabiye TV" → Testers +')
    summary(f'- TestFlight page of the app: https://appstoreconnect.apple.com/apps/{app_id}/testflight/ios')
    return 0


def main(argv):
    if len(argv) < 2:
        print(__doc__)
        return 64
    for k in ('ASC_KEY_ID', 'ASC_ISSUER_ID', 'ASC_KEY_PATH'):
        if not os.environ.get(k):
            print('missing', k)
            return 64
    if argv[1] == 'check':
        return cmd_check()
    if argv[1] == 'bundle-id':
        return cmd_bundle_id()
    if argv[1] == 'testflight' and len(argv) > 2:
        return cmd_testflight(argv[2])
    print(__doc__)
    return 64


if __name__ == '__main__':
    sys.exit(main(sys.argv))
