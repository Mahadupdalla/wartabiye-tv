#!/usr/bin/env python3
"""Offline test of scripts/testflight.py against a fake App Store Connect API (no Apple account needed).

Checks: the signed token (ES256, key id, issuer, audience), registering the bundle id and its capabilities,
the "create the app first" message, waiting for processing, export compliance, the internal group and the tester.
  python3 test/testflight.mock.py
"""
import json
import os
import subprocess
import sys
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlparse

import jwt
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPT = os.path.join(HERE, '..', 'scripts', 'testflight.py')
key = ec.generate_private_key(ec.SECP256R1())
pem = key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption())
pub = key.public_key()

S = {'bundle': None, 'caps': set(), 'app': False, 'polls': 0, 'groups': [], 'testers': [], 'patched': None, 'calls': [],
     'app_loc': [], 'build_loc': []}


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def send(self, code, obj=None):
        b = json.dumps(obj).encode() if obj is not None else b''
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def auth(self):
        tok = self.headers.get('Authorization', '')[7:]
        claims = jwt.decode(tok, pub, algorithms=['ES256'], audience='appstoreconnect-v1')
        assert claims['iss'] == 'issuer-1' and jwt.get_unverified_header(tok)['kid'] == 'KEY123', claims
        assert claims['exp'] - claims['iat'] <= 1200

    def body(self):
        n = int(self.headers.get('Content-Length') or 0)
        return json.loads(self.rfile.read(n)) if n else None

    def handle_any(self, m):
        self.auth()
        u = urlparse(self.path); q = {k: v[0] for k, v in parse_qs(u.query).items()}; p = u.path
        S['calls'].append((m, p))
        b = self.body()
        if m == 'GET' and p == '/v1/bundleIds':
            return self.send(200, {'data': [S['bundle']] if S['bundle'] else []})
        if m == 'POST' and p == '/v1/bundleIds':
            assert b['data']['attributes'] == {'identifier': 'com.wartabiyetv.app', 'name': 'Wartabiye TV', 'platform': 'IOS'}
            S['bundle'] = {'id': 'B1', 'attributes': {'identifier': 'com.wartabiyetv.app'}}
            return self.send(201, {'data': S['bundle']})
        if m == 'POST' and p == '/v1/bundleIdCapabilities':
            c = b['data']['attributes']['capabilityType']
            if c in S['caps']:
                return self.send(409, {'errors': []})
            S['caps'].add(c)
            return self.send(201, {'data': {}})
        if m == 'GET' and p == '/v1/apps':
            assert q['filter[bundleId]'] == 'com.wartabiyetv.app'
            return self.send(200, {'data': [{'id': 'A1', 'attributes': {'bundleId': 'com.wartabiyetv.app', 'name': 'Wartabiye TV'}}] if S['app'] else []})
        if m == 'GET' and p == '/v1/builds':
            assert q['filter[app]'] == 'A1' and q['filter[version]'] == '57'
            S['polls'] += 1
            st = 'PROCESSING' if S['polls'] < 2 else 'VALID'
            return self.send(200, {'data': [{'id': 'BLD', 'attributes': {'version': '57', 'processingState': st, 'usesNonExemptEncryption': None, 'uploadedDate': '2026-11-11T12:00:00Z'}}]})
        if m == 'PATCH' and p == '/v1/builds/BLD':
            S['patched'] = b['data']['attributes']
            return self.send(200, {'data': {}})
        if m == 'GET' and p == '/v1/apps/A1/betaGroups':
            return self.send(200, {'data': S['groups']})
        if m == 'POST' and p == '/v1/betaGroups':
            a = b['data']['attributes']
            assert a == {'name': 'Wartabiye TV', 'isInternalGroup': True, 'hasAccessToAllBuilds': True}, a
            g = {'id': 'G1', 'attributes': a}
            S['groups'].append(g)
            return self.send(201, {'data': g})
        if m == 'GET' and p == '/v1/betaTesters':
            return self.send(200, {'data': [t for t in S['testers'] if t['email'] == q['filter[email]']]})
        if m == 'POST' and p == '/v1/betaTesters':
            a = b['data']['attributes']
            S['testers'].append({'id': 'T1', 'email': a['email'], 'relationships': {'betaGroups': b['data']['relationships']['betaGroups']}})
            return self.send(201, {'data': {}})
        if m == 'GET' and p == '/v1/apps/A1/betaAppLocalizations':
            return self.send(200, {'data': S['app_loc']})
        if m == 'POST' and p == '/v1/betaAppLocalizations':
            a = b['data']['attributes']
            assert b['data']['relationships']['app']['data']['id'] == 'A1'
            S['app_loc'].append({'id': 'L1', 'attributes': a})
            return self.send(201, {'data': S['app_loc'][-1]})
        if m == 'PATCH' and p == '/v1/betaAppLocalizations/L1':
            S['app_loc'][0]['attributes'].update(b['data']['attributes'])
            return self.send(200, {'data': S['app_loc'][0]})
        if m == 'GET' and p == '/v1/builds/BLD/betaBuildLocalizations':
            return self.send(200, {'data': S['build_loc']})
        if m == 'POST' and p == '/v1/betaBuildLocalizations':
            assert b['data']['relationships']['build']['data']['id'] == 'BLD'
            S['build_loc'].append({'id': 'W1', 'attributes': b['data']['attributes']})
            return self.send(201, {'data': S['build_loc'][-1]})
        if m == 'PATCH' and p == '/v1/betaBuildLocalizations/W1':
            S['build_loc'][0]['attributes'].update(b['data']['attributes'])
            return self.send(200, {'data': S['build_loc'][0]})
        return self.send(404, {'errors': [{'detail': 'unexpected ' + m + ' ' + p}]})

    def do_GET(self): self.handle_any('GET')
    def do_POST(self): self.handle_any('POST')
    def do_PATCH(self): self.handle_any('PATCH')


srv = HTTPServer(('127.0.0.1', 0), H)
threading.Thread(target=srv.serve_forever, daemon=True).start()
tmp = tempfile.mkdtemp()
kp = os.path.join(tmp, 'AuthKey.p8'); open(kp, 'wb').write(pem)
summ = os.path.join(tmp, 'summary.md')
env = dict(os.environ, ASC_API_BASE=f'http://127.0.0.1:{srv.server_port}', ASC_KEY_ID='KEY123', ASC_ISSUER_ID='issuer-1',
           ASC_KEY_PATH=kp, GITHUB_STEP_SUMMARY=summ, TESTFLIGHT_TESTER_EMAIL='tester@example.com', TESTFLIGHT_TESTER_NAME='Test Person',
           WTV_POLL_SECONDS='0')


def run(*a):
    r = subprocess.run([sys.executable, SCRIPT, *a], env=env, capture_output=True, text=True, timeout=60)
    print('$ testflight.py', ' '.join(a), '->', r.returncode)
    print(r.stdout.strip()); print(r.stderr.strip())
    return r.returncode


ok = True
def check(cond, what):
    global ok
    print(('PASS ' if cond else 'FAIL ') + what)
    ok = ok and cond


check(run('check') == 2, 'check without an App Store Connect app says to create it (exit 2)')
check('New App' in open(summ).read(), 'the summary explains how to create the app')
check(run('bundle-id') == 0 and S['bundle'] and S['caps'] == {'PUSH_NOTIFICATIONS', 'ASSOCIATED_DOMAINS'}, 'bundle id registered with push + associated domains')
check(run('bundle-id') == 0, 'registering again is harmless (409 = already on)')
S['app'] = True
check(run('check') == 0, 'check passes once the app exists')
check(run('testflight', '57') == 0, 'testflight: waits for processing, then succeeds')
check(S['polls'] >= 2, 'it polled until Apple finished processing')
check(S['patched'] == {'usesNonExemptEncryption': False}, 'export compliance answered')
check(len(S['groups']) == 1, 'internal group "Wartabiye TV" created')
check(len(S['testers']) == 1 and S['testers'][0]['relationships']['betaGroups']['data'][0]['id'] == 'G1', 'tester invited into the group')
al = S['app_loc'][0]['attributes'] if S['app_loc'] else {}
check(al.get('locale') == 'en-GB' and 'nine languages' in al.get('description', '') and al.get('feedbackEmail') == 'tester@example.com'
      and al.get('privacyPolicyUrl', '').startswith('https://www.wartabiyetv.com/'), 'TestFlight app description, privacy policy and feedback address set')
check(bool(S['build_loc']) and 'Settings' in S['build_loc'][0]['attributes'].get('whatsNew', ''), '"What to Test" set for the build')
check(run('testflight', '57') == 0 and len(S['groups']) == 1 and len(S['testers']) == 1
      and len(S['app_loc']) == 1 and len(S['build_loc']) == 1, 'second run creates no duplicates')
srv.shutdown()
print('ALL PASS' if ok else 'SOME FAILED')
sys.exit(0 if ok else 1)
