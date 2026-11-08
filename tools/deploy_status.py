"""Writes data/deploy-status.json, which the admin dashboard shows under "Daabacaadda iyo PR-yada" (deploy status):
the last website publication (success or failure, with a link to the log), and what happened to each recent pull
request (merged automatically, waiting for the owner, tests failed ...). Written by the GitHub workflows only.

  python3 tools/deploy_status.py deploy --result success|failure --commit SHA --title "..." --run URL [--live SHA]
  python3 tools/deploy_status.py pr --number 47 --title "..." --url URL --result merged|waiting-for-owner|... \
                                    [--reason "..."]... [--run URL]
  python3 tools/deploy_status.py test
"""
import argparse, datetime, json, os, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATH = os.path.join(ROOT, 'data', 'deploy-status.json')
KEEP = 20
DEPLOY_TEXT = {'success': 'Bogga waa la daabacay (live)', 'failure': 'Daabacaaddu way fashilantay: eeg log-ka',
               'cancelled': 'Daabacaadda waa la joojiyay'}
PR_TEXT = {
    'merged': 'Si otomaatig ah ayaa loo merge-gareeyay (low risk, tijaabooyinka way guuleysteen)',
    'waiting-for-owner': 'Waxay u baahan tahay ogolaanshahaaga (sensitive)',
    'waiting-for-approval': 'Tijaabooyinka way guuleysteen; waxay sugaysaa calaamadda "auto-merge" (ogolaanshahaaga)',
    'tests-failed': 'Tijaabooyinka way fashilmeen: lama merge-gareyn',
    'changes-requested': 'Dib-u-eegis ayaa isbeddel codsatay: lama merge-gareyn',
    'merge-failed': 'Merge-ku wuu fashilmay (tusaale: isku dhac / conflict)',
    'not-mergeable': 'Lama merge-gareyn karo (draft, fork ama "do-not-merge")',
}


def now():
    return datetime.datetime.now(datetime.timezone.utc).astimezone(datetime.timezone(datetime.timedelta(hours=3))).isoformat(timespec='seconds')


def load(path):
    try:
        d = json.load(open(path, encoding='utf-8'))
        return d if isinstance(d, dict) else {}
    except Exception:
        return {}


def save(path, d):
    with open(path, 'w', encoding='utf-8') as fh:
        json.dump(d, fh, ensure_ascii=False, indent=2)
        fh.write('\n')


def record_deploy(d, result, commit, title, run, live=None):
    e = {'at': now(), 'result': result, 'text': DEPLOY_TEXT.get(result, result), 'commit': (commit or '')[:12],
         'title': (title or '')[:140], 'run': run or ''}
    if live:
        e['liveCommit'] = live[:12]
    d['lastDeploy'] = e
    if result == 'success':
        d['lastSuccessAt'] = e['at']
    else:
        d['lastFailureAt'] = e['at']
    d['deploys'] = ([e] + [x for x in d.get('deploys', []) if isinstance(x, dict)])[:KEEP]
    return d


def record_pr(d, number, title, url, result, reasons=(), run=None):
    e = {'at': now(), 'number': int(number), 'title': (title or '')[:140], 'url': url or '', 'result': result,
         'text': PR_TEXT.get(result, result), 'reasons': list(reasons)[:15], 'run': run or ''}
    rest = [x for x in d.get('pullRequests', []) if isinstance(x, dict) and x.get('number') != e['number']]
    d['pullRequests'] = ([e] + rest)[:KEEP]
    d['needsOwner'] = [{'number': x['number'], 'title': x['title'], 'url': x['url'], 'text': x['text']}
                       for x in d['pullRequests'] if x.get('result') in ('waiting-for-owner', 'waiting-for-approval')]
    return d


def test():
    tmp = os.path.join(tempfile.mkdtemp(), 's.json')
    d = record_deploy(load(tmp), 'success', 'abcdef1234567890', 'News', 'https://x/run/1', 'abcdef1234567890')
    d = record_deploy(d, 'failure', '1234', 'Broken', 'https://x/run/2')
    assert d['lastDeploy']['result'] == 'failure' and d['lastSuccessAt'] and len(d['deploys']) == 2
    d = record_pr(d, 47, 'A', 'u', 'waiting-for-owner', ['admin/config.yml: admin'])
    d = record_pr(d, 48, 'B', 'u', 'merged')
    assert [x['number'] for x in d['needsOwner']] == [47]
    d = record_pr(d, 47, 'A', 'u', 'merged')
    assert d['needsOwner'] == [] and [x['number'] for x in d['pullRequests']] == [47, 48]
    for i in range(30):
        d = record_deploy(d, 'success', str(i), 't', 'r')
    assert len(d['deploys']) == KEEP
    save(tmp, d)
    assert load(tmp) == d
    print('deploy_status: all tests passed')


if __name__ == '__main__':
    if sys.argv[1:2] == ['test']:
        test(); sys.exit(0)
    p = argparse.ArgumentParser()
    p.add_argument('kind', choices=['deploy', 'pr'])
    p.add_argument('--result', required=True)
    p.add_argument('--commit'); p.add_argument('--title'); p.add_argument('--run'); p.add_argument('--live')
    p.add_argument('--number'); p.add_argument('--url'); p.add_argument('--reason', action='append', default=[])
    a = p.parse_args()
    d = load(PATH)
    if a.kind == 'deploy':
        record_deploy(d, a.result, a.commit, a.title, a.run, a.live)
    else:
        record_pr(d, a.number, a.title, a.url, a.result, a.reason, a.run)
    d['updatedAt'] = now()
    save(PATH, d)
    print(json.dumps(d.get('lastDeploy') if a.kind == 'deploy' else d['pullRequests'][0], ensure_ascii=False))
