"""Article completeness: the editorial standard for a full Wartabiye TV news article, and the safe way to complete an
existing short article (owner's decision of 10 November 2026: "make every news article detailed and complete").

A full article (data/news/<id>.json) has:
  "title"    a clear, accurate headline (under 120 characters)
  "summary"  the introductory paragraph (lede): who, what, where, when, in 1-2 sentences
  "body"     the complete report, in paragraphs separated by a blank line. A line that starts with "## " is a
             subheading (used in longer articles). The body explains what happened, who was involved, where and when,
             why it matters (when verified), background, recent developments, verified statements and reactions, what may
             happen next (clearly marked as not yet confirmed) and ends with a natural concluding paragraph.
The body never ends in the middle of a sentence, never ends with an empty line such as "More details coming soon"
(unless "developing": true: the story is genuinely still developing and the text says what is confirmed and what is
not yet known), and never repeats the same sentence. An article with few verified facts may be short, but then it says
so honestly: "limitedFacts": true and "lengthNote" (internal, Somali: why it is short); it is never padded.

  python3 tools/article_quality.py check <id|file> ...     check articles against the standard (exit 1 on an error)
  python3 tools/article_quality.py check --new [<ref>]     check the article files added since <ref> (default origin/main)
  python3 tools/article_quality.py report [--limit N] [--json] [--all]
                                                           existing articles that are incomplete, editable ones first
                                                           (Somalia first, then newest); --all also lists protected ones
  python3 tools/article_quality.py editable <id>           prints "editable" or "protected: <reason>" (exit 0 / 1)
  python3 tools/article_quality.py expand <file.json>      complete existing articles safely (see expand())
  python3 tools/article_quality.py skip <id> "<reason>"    the news task could not verify more facts: the report leaves it out
                                                           (data/world/article-completion.json)
  python3 tools/article_quality.py test                    offline self-test

PROTECTION (owner's rule: admin changes are never overwritten by the automation). An existing article may be completed
by the news task only when ALL of these hold: "by" is "claude"; it is not sponsored, not a match-result card, not
"locked"; no translation was written or corrected by hand (translations.py "manual"); and the owner never touched it:
  - if it carries "autoHash" (written by this tool), its text fields still have exactly that fingerprint;
  - otherwise every git commit that changed the file is an automatic one (subjects "Wararka ", "Daabac:", "Ciyaaraha:",
    "Faahfaahin"): any commit from /admin/ ("Maamul: ..."), a pull request or a manual commit protects the file for good.
A shallow clone (no history) protects everything. "publishedAt", the photo and every source field are never changed.
"""
import datetime, glob, hashlib, json, os, re, subprocess, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from translations import LANGS, numbers, text_hash  # noqa: E402

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NEWS = os.path.join(root, 'data', 'news')
SKIPS = os.path.join(root, 'data', 'world', 'article-completion.json')
EAT = datetime.timezone(datetime.timedelta(hours=3))

# a new full article: at least this much, unless "limitedFacts" (then the lower limits apply)
MIN_WORDS, MIN_PARAS = 150, 3
MIN_WORDS_LIMITED, MIN_PARAS_LIMITED = 60, 2
SUBHEAD_FROM_WORDS = 350          # longer articles should use "## " subheadings (a warning, not an error)
COMPLETE_WORDS = 120              # report: an existing article below this is "short"
AUTO_SUBJECT = re.compile(r'^(Wararka |Daabac:|Ciyaaraha:|Faahfaahin)')
TEXT_KEYS = ('title', 'summary', 'body', 'category', 'section', 'country', 'publishedAt')
EXPAND_KEYS = {'title', 'summary', 'body', 'verification', 'developing', 'limitedFacts', 'lengthNote', 'expandedAt',
               'updatedAt', 'autoHash'} | set(LANGS)
END_OK = tuple('.!?…"”»\')]۔؟।') + ('.»', '."')
# endings that promise more without saying anything (Somali + the eight translation languages)
PLACEHOLDER = re.compile(r'(faahfaahin(o)? (dheeraad|kale|intaa ka badan)[^.]{0,40}(soo socota|soo socda|kala soco|la socda)'
                         r'|warbixin (dheeraad|kale)[^.]{0,30}soo socota|wixii ku soo kordha (kala|la) soco|nala soco'
                         r'|more (details|information|to follow|soon)|details to follow|stay tuned|developing story\W*$'
                         r'|plus de détails|à suivre|meer details volgen|weitere details folgen|maggiori dettagli'
                         r'|daha fazla ayrıntı|más detalles|مزيد من التفاصيل|التفاصيل لاحقا)', re.I)
DANGLING = re.compile(r'(\b(iyo|oo|ee|ama|laakiin|in|ku|ka|u|la|and|or|the|of|to|with|that|et|ou|und|oder|e|o|ve|y)'
                      r'|[,;:\-–—(])\s*$', re.I)


def paras(body):
    return [p.strip() for p in re.split(r'\n+', str(body or '')) if p.strip()]


def is_head(p):
    return p.startswith('## ')


def words(s):
    return len(re.findall(r'\w+', re.sub(r'(?m)^## ', '', str(s or ''))))


def sentences(body):
    out = []
    for p in paras(body):
        if is_head(p):
            continue
        out += [re.sub(r'\W+', ' ', s).strip().lower() for s in re.split(r'(?<=[.!?؟])\s+', p) if len(s.split()) >= 6]
    return out


def ends_ok(p):
    p = p.rstrip()
    return p.endswith(END_OK) and not p.endswith(('...', '..')) and not DANGLING.search(p.rstrip('.'))


def text_problems(title, summary, body, developing=False, lang='so'):
    """Errors in one language version (problems that are never acceptable in a published article)."""
    err = []
    ps = paras(body)
    if not str(title or '').strip():
        err.append(f'{lang}: no headline')
    if summary and not ends_ok(str(summary)):
        err.append(f'{lang}: the introduction (summary) ends in the middle of a sentence')
    if not ps:
        return err
    if is_head(ps[-1]):
        err.append(f'{lang}: the body ends with a subheading and no text')
    for i, p in enumerate(ps):
        if is_head(p):
            if len(p) > 90 or len(p) < 5:
                err.append(f'{lang}: subheading {i + 1} is not a short heading')
            if i + 1 < len(ps) and is_head(ps[i + 1]):
                err.append(f'{lang}: two subheadings in a row (paragraph {i + 1})')
            continue
        if not ends_ok(p):
            err.append(f'{lang}: paragraph {i + 1} ends in the middle of a sentence: "…{p[-40:]}"')
    last = next((p for p in reversed(ps) if not is_head(p)), '')
    if last and PLACEHOLDER.search(last) and not developing:
        err.append(f'{lang}: the article ends with an empty "more details coming soon" line instead of a conclusion')
    s = sentences(body)
    dup = sorted({x for x in s if s.count(x) > 1})
    if dup:
        err.append(f'{lang}: a sentence is repeated: "{dup[0][:60]}"')
    if summary and ps and re.sub(r'\W+', '', ps[0]).lower() == re.sub(r'\W+', '', str(summary)).lower():
        err.append(f'{lang}: the first paragraph repeats the introduction word for word')
    return err


def check_article(n, new=True):
    """-> (errors, warnings). new=True: the full standard for an article the task writes or completes now."""
    nid = n.get('id', '?')
    err, warn = [], []
    body = n.get('body') or ''
    developing = n.get('developing') is True
    err += [f'{nid}: {e}' for e in text_problems(n.get('title'), n.get('summary'), body, developing)]
    if new:
        limited = n.get('limitedFacts') is True
        if limited and not str(n.get('lengthNote') or '').strip():
            err.append(f'{nid}: "limitedFacts" needs a "lengthNote" (why the verified facts are few)')
        mw, mp = (MIN_WORDS_LIMITED, MIN_PARAS_LIMITED) if limited else (MIN_WORDS, MIN_PARAS)
        text_paras = [p for p in paras(body) if not is_head(p)]
        if words(body) < mw or len(text_paras) < mp:
            err.append(f'{nid}: the body has {words(body)} words in {len(text_paras)} paragraph(s); a full article needs at least '
                       f'{mw} words in {mp} paragraphs' + ('' if limited else ' (or "limitedFacts": true + "lengthNote" when the '
                       'verified facts really are that few: never pad)'))
        if len(str(n.get('title') or '')) > 120:
            err.append(f'{nid}: headline longer than 120 characters')
        if words(body) >= SUBHEAD_FROM_WORDS and not any(is_head(p) for p in paras(body)):
            warn.append(f'{nid}: a long article ({words(body)} words) reads better with "## " subheadings')
    so_lines = len(paras(body))
    for lang in LANGS:
        t = n.get(lang)
        if not isinstance(t, dict) or not str(t.get('title') or '').strip():
            continue
        tb = t.get('body') or ''
        if body and not str(tb).strip():
            (err if new else warn).append(f'{nid}/{lang}: the Somali article has a body but this translation has none')
            continue
        if tb and new and len(paras(tb)) != so_lines:
            err.append(f'{nid}/{lang}: {len(paras(tb))} paragraphs/subheadings, the Somali has {so_lines} (keep the same structure)')
        (err if new else warn).extend(f'{nid}/{e}' for e in text_problems(t.get('title'), t.get('summary'), tb, developing, lang))
    return err, warn


def completeness(n):
    """Report on an existing article: the list of reasons it is incomplete (empty = complete)."""
    why = []
    body = n.get('body') or ''
    if not str(body).strip():
        why.append('no-body')
    elif words(body) < COMPLETE_WORDS and n.get('limitedFacts') is not True:
        why.append(f'short ({words(body)} words)')
    e, _ = check_article(n, new=False)
    why += sorted({('truncated' if 'middle of a sentence' in x else 'placeholder-ending' if 'coming soon' in x
                    else 'repeated-sentence' if 'repeated' in x else 'other') for x in e if '/' not in x.split(':')[0]})
    return why


# ---------------------------------------------------------------- protection

def auto_hash(n):
    s = json.dumps({k: n.get(k) for k in TEXT_KEYS}, ensure_ascii=False, sort_keys=True)
    return hashlib.sha1(s.encode('utf-8')).hexdigest()[:12]


_HIST = None


def history():
    """{relative path: [commit subjects]} for data/news, or None in a shallow clone (then nothing is editable)."""
    global _HIST
    if _HIST is not None:
        return _HIST or None
    sh = subprocess.run(['git', 'rev-parse', '--is-shallow-repository'], cwd=root, capture_output=True, text=True).stdout.strip()
    if sh != 'false':
        _HIST = {}
        return None
    out = subprocess.run(['git', 'log', '--format=\x01%H %s', '--name-only', '--', 'data/news/'], cwd=root,
                         capture_output=True, text=True).stdout
    h = {}
    for block in out.split('\x01')[1:]:
        lines = block.split('\n')
        sha, _, subj = lines[0].partition(' ')
        for f in lines[1:]:
            if f.strip():
                h.setdefault(f.strip(), []).append((sha, subj))
    _HIST = h
    return h


def protected(n, rel=None):
    """None when the task may complete this article, else the reason it is protected."""
    nid = n.get('id') or ''
    if n.get('by') != 'claude':
        return f'written by "{n.get("by")}"'
    if n.get('sponsored') or n.get('locked') or n.get('result'):
        return 'sponsored, locked or a result card'
    for lang in LANGS:
        t = n.get(lang)
        if isinstance(t, dict) and t.get('title') and (t.get('status') == 'manual' or (t.get('hash') and t['hash'] != text_hash(t))):
            return f'the {lang} translation was edited by hand'
    if n.get('autoHash'):
        return None if n['autoHash'] == auto_hash(n) else 'edited in /admin/ after the task wrote it'
    h = history()
    if h is None:
        return 'no git history (shallow clone): run git fetch --unshallow origin'
    rel = rel or f'data/news/{nid}.json'
    for sha, subj in h.get(rel, []):
        if AUTO_SUBJECT.match(subj) or (not subj.startswith('Maamul') and translations_only(sha, rel)):
            continue  # automatic, or a site-wide code change that only added translations (e.g. a new language)
        return f'changed by hand: "{subj[:60]}"'
    return None


def translations_only(sha, rel):
    """True when commit sha changed nothing in rel except whole translation blocks (en, ar, ...)."""
    def at(ref):
        r = subprocess.run(['git', 'show', f'{ref}:{rel}'], cwd=root, capture_output=True, text=True)
        try: return json.loads(r.stdout) if r.returncode == 0 else None
        except ValueError: return None
    a, b = at(sha + '^'), at(sha)
    if a is None or b is None:
        return False  # the commit created the file: whoever made that commit wrote the article
    return all(a.get(k) == b.get(k) for k in set(a) | set(b) if k not in LANGS)


# ---------------------------------------------------------------- commands

def load(p):
    return json.load(open(p, encoding='utf-8'))


def save(p, n):
    with open(p, 'w', encoding='utf-8') as f:
        json.dump(n, f, ensure_ascii=False, indent=2)
        f.write('\n')


def path_of(x):
    if os.path.isfile(x):
        return x
    return os.path.join(NEWS, x + '.json')


def new_files(ref='origin/main'):
    r = subprocess.run(['git', 'diff', '--name-only', '--diff-filter=A', ref, '--', 'data/news/'], cwd=root, capture_output=True, text=True)
    u = subprocess.run(['git', 'ls-files', '--others', '--exclude-standard', 'data/news/'], cwd=root, capture_output=True, text=True)
    return sorted({os.path.join(root, f) for f in (r.stdout + u.stdout).split() if f.endswith('.json')})


def cmd_check(args):
    files = new_files(args[1] if len(args) > 1 else 'origin/main') if args[:1] == ['--new'] else [path_of(a) for a in args]
    bad = 0
    for f in files:
        n = load(f)
        if n.get('by') == 'admin' or n.get('by') == 'auto-results':
            continue
        e, w = check_article(n, new=True)
        for x in w:
            print('warning:', x)
        for x in e:
            print('ERROR:', x)
        bad += bool(e)
    print(f'{len(files)} article(s) checked, {bad} incomplete' if bad else f'OK: {len(files)} article(s) complete')
    return 1 if bad else 0


def cmd_report(args):
    lim = int(args[args.index('--limit') + 1]) if '--limit' in args else 0
    skipped = skips()
    rows = []
    for f in sorted(glob.glob(os.path.join(NEWS, '*.json'))):
        n = load(f)
        why = completeness(n)
        if not why or ((n.get('id') or os.path.basename(f)[:-5]) in skipped and '--all' not in args):
            continue
        p = protected(n, os.path.relpath(f, root))
        if p and '--all' not in args:
            continue
        rows.append({'id': n.get('id') or os.path.basename(f)[:-5], 'section': n.get('section'), 'country': n.get('country'),
                     'published': n.get('published', True) is not False, 'publishedAt': n.get('publishedAt'), 'why': why,
                     'words': words(n.get('body')), 'protected': p, 'source': n.get('source'), 'sourceUrl': n.get('sourceUrl'),
                     'sourceRights': n.get('sourceRights'), 'title': n.get('title')})
    rows.sort(key=lambda r: (r['protected'] is not None, not r['published'], r['country'] != 'so', r['section'] != 'somalia',
                             -(datetime.datetime.fromisoformat(r['publishedAt']).timestamp() if r['publishedAt'] else 0)))
    if lim:
        rows = rows[:lim]
    if '--json' in args:
        print(json.dumps(rows, ensure_ascii=False, indent=1))
    else:
        for r in rows:
            print(f"{r['id']}  [{r['section']}/{r['country'] or '-'}]  {', '.join(r['why'])}" + (f"  PROTECTED: {r['protected']}" if r['protected'] else ''))
    print(f'{len(rows)} incomplete article(s) listed', file=sys.stderr)
    return 0


def skips():
    try: return load(SKIPS).get('skipped') or {}
    except (OSError, ValueError): return {}


def cmd_skip(nid, reason):
    try: d = load(SKIPS)
    except (OSError, ValueError): d = {}
    d.setdefault('skipped', {})[nid] = {'at': datetime.datetime.now(EAT).replace(microsecond=0).isoformat(), 'reason': reason}
    os.makedirs(os.path.dirname(SKIPS), exist_ok=True)
    save(SKIPS, d)
    print(f'{nid}: left out of the completion list ({reason})')
    return 0


def expand(src, now=None):
    """Complete existing short articles. src = {"<id>": {"body": ..., "summary"?: ..., "title"?: ..., "verification": ...,
    "developing"?: bool, "limitedFacts"?: bool, "lengthNote"?: str, "translations": {"en": {"title","summary","body",
    "imageAlt"?}, ... all eight}}}. Refused (file unchanged) when the article is protected, when the result breaks the
    standard, or when the digits of a translation differ from the Somali. publishedAt, the photo and the source record are
    never touched; "expandedAt" and "updatedAt" record when it was completed."""
    data = load(src)
    now = now or datetime.datetime.now(EAT).replace(microsecond=0).isoformat()
    done = refused = 0
    for nid, x in data.items():
        p = os.path.join(NEWS, nid + '.json')
        if not re.fullmatch(r'[a-z0-9-]+', nid) or not os.path.isfile(p):
            print(f'{nid}: no such article, refused'); refused += 1; continue
        n = load(p)
        why = protected(n, os.path.relpath(p, root))
        if why:
            print(f'{nid}: protected ({why}), refused'); refused += 1; continue
        m = json.loads(json.dumps(n))
        for k in ('title', 'summary', 'body', 'lengthNote'):
            if isinstance(x.get(k), str) and x[k].strip():
                m[k] = x[k].strip()
        for k in ('developing', 'limitedFacts'):
            if k in x:
                if x[k] is True: m[k] = True
                else: m.pop(k, None)
        if str(x.get('verification') or '').strip():
            m['verification'] = x['verification'].strip()
        tr = x.get('translations') or {}
        so_all = ' '.join(str(m.get(k) or '') for k in ('title', 'summary', 'body'))
        bad = [l for l in LANGS if not isinstance(tr.get(l), dict) or not str(tr[l].get('title') or '').strip()
               or not str(tr[l].get('body') or '').strip()]
        if bad:
            print(f'{nid}: missing translations {bad} (all eight are needed, with the body), refused'); refused += 1; continue
        nums = [l for l in LANGS if numbers(so_all) != numbers(' '.join(str(tr[l].get(k) or '') for k in ('title', 'summary', 'body')))]
        if nums:
            print(f'{nid}: digits differ from the Somali in {nums}, refused'); refused += 1; continue
        for l in LANGS:
            old_alt = (n.get(l) or {}).get('imageAlt') if isinstance(n.get(l), dict) else None
            b = {k: str(tr[l][k]).strip() for k in ('title', 'summary', 'body', 'imageAlt') if str(tr[l].get(k) or '').strip()}
            if 'imageAlt' not in b and old_alt:
                b['imageAlt'] = old_alt
            b['status'] = 'auto'
            b['hash'] = text_hash(b)
            m[l] = b
        e, w = check_article(m, new=True)
        if e:
            print(f'{nid}: refused, the completed article still breaks the standard:\n  ' + '\n  '.join(e)); refused += 1; continue
        for k in ('publishedAt', 'image', 'source', 'sourceUrl', 'originalTitle', 'worldSource', 'by', 'published', 'category', 'section', 'country'):
            if m.get(k) != n.get(k):
                print(f'{nid}: "{k}" may not change, refused'); refused += 1; break
        else:
            m['expandedAt'] = now
            m['updatedAt'] = now
            m['autoHash'] = auto_hash(m)
            save(p, m); done += 1
            print(f'{nid}: completed ({words(n.get("body"))} -> {words(m["body"])} words)' + (f'; warnings: {w}' if w else ''))
    print(f'{done} article(s) completed, {refused} refused')
    return 1 if refused and not done else 0


def allowed_change(a, b):
    """For translations.py verify: True when b is a valid completion of the existing article a by expand()."""
    if not b.get('expandedAt') or b.get('expandedAt') == a.get('expandedAt'):
        return False
    if protected(a) is not None:
        return False
    if any(a.get(k) != b.get(k) for k in set(a) | set(b) if k not in EXPAND_KEYS):
        return False
    return b.get('autoHash') == auto_hash(b) and not check_article(b, new=True)[0]


def test():
    good = {'id': 't', 'by': 'claude', 'title': 'Cinwaan', 'summary': 'Dowladda ayaa maanta sheegtay go\'aan cusub.',
            'body': '## Waxa dhacay\n\n' + ' '.join(['Wasaaradda ayaa sheegtay in shirka uu socday saddex saacadood oo uu ku dhammaaday heshiis.'] * 1)
            + '\n\n' + 'Xildhibaannada ayaa ka dooday sharciga cusub ee dakhliga, waxayna isku raaceen in la ansixiyo bisha soo socota. ' * 1
            + '\n\n' + 'Falanqeeyayaasha ayaa qaba in go\'aanku uu saameyn ku yeelan doono ganacsatada yaryar ee magaalada iyo agagaarkeeda. '
            + 'Ma jirto weli taariikh rasmi ah oo la shaaciyay. Dowladdu waxay ballan qaaday in ay faahfaahin rasmi ah bixin doonto marka sharciga la ansixiyo. '
            + 'Hay\'adaha bulshada ayaa soo dhoweeyay tallaabada, iyagoo sheegay in ay sugayaan sida loo fulin doono. '
            + 'Ganacsatada ayaa iyaguna sheegay in ay rajeynayaan in canshuuraha cusub aysan culeys dheeraad ah ku keenin.'
            + '\n\n' + 'Golaha Wasiirrada ayaa la filayaa in uu arrinta mar kale eego toddobaadka soo socda, kadib marka guddiyada baarlamaanku ay soo gudbiyaan warbixintooda. '
            + 'Illaa iyo hadda, dowladdu ma sheegin inta lacag ah ee laga filayo canshuurta cusub, waxayna sheegtay in tirada la shaacin doono marka miisaaniyadda la soo bandhigo.'}
    e, _ = check_article(good)
    assert not e, e
    trunc = dict(good, body=good['body'] + '\n\nWasiirka ayaa sheegay in')
    assert any('middle of a sentence' in x for x in check_article(trunc)[0])
    ph = dict(good, body=good['body'] + '\n\nFaahfaahin dheeraad ah ayaa soo socota.')
    assert any('coming soon' in x for x in check_article(ph)[0])
    assert not any('coming soon' in x for x in check_article(dict(ph, developing=True))[0])
    short = dict(good, body='Wasiirka ayaa sheegay in shirku dhammaaday.')
    assert any('words in' in x for x in check_article(short)[0])
    assert any('lengthNote' in x for x in check_article(dict(short, limitedFacts=True))[0])
    rep = dict(good, body=good['body'] + '\n\nXildhibaannada ayaa ka dooday sharciga cusub ee dakhliga, waxayna isku raaceen in la ansixiyo bisha soo socota.')
    assert any('repeated' in x for x in check_article(rep)[0])
    tr = dict(good, en={'title': 'T', 'summary': 'S.', 'body': 'One paragraph only.'})
    assert any('paragraphs/subheadings' in x for x in check_article(tr)[0])
    assert completeness({'id': 'x', 'title': 'a', 'summary': 'b.', 'body': ''}) == ['no-body']
    assert protected({'id': 'x', 'by': 'admin'})
    h = dict(good); h['autoHash'] = auto_hash(h)
    assert protected(h) is None
    assert protected(dict(h, body=h['body'] + ' Admin.'))
    assert protected(dict(h, en={'title': 'x', 'status': 'manual'}))
    print('OK: article_quality self-test')
    return 0


if __name__ == '__main__':
    a = sys.argv[1:]
    c = a[0] if a else ''
    if c == 'check' and len(a) > 1:
        sys.exit(cmd_check(a[1:]))
    if c == 'report':
        sys.exit(cmd_report(a[1:]))
    if c == 'editable' and len(a) > 1:
        n = load(path_of(a[1]))
        p = protected(n, os.path.relpath(path_of(a[1]), root))
        print('editable' if not p else f'protected: {p}')
        sys.exit(1 if p else 0)
    if c == 'expand' and len(a) > 1:
        sys.exit(expand(a[1]))
    if c == 'skip' and len(a) > 2:
        sys.exit(cmd_skip(a[1], a[2]))
    if c == 'test':
        sys.exit(test())
    print(__doc__)
    sys.exit(2)
