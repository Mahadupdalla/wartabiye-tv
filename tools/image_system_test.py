"""Tests for the WARTABIYE TV image system (tools/image_system.py). Offline: the image providers are replaced by fixed
candidate lists and the downloads by local test pictures, so the result never depends on the network.

  python3 tools/image_system_test.py          (also run by the publish workflow before anything is published)

Ten story types (Somali politics, international politics, security, sports, business, breaking news, technology, a
specific person, a specific city, no suitable image) plus reuse prevention, near-identical copies, licence status,
unique file names, the category graphic, the public credit and that no article ever gets another article's photo."""
import json, os, shutil, sys, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import image_system as IS  # noqa: E402
from PIL import Image, ImageDraw  # noqa: E402

REAL_ROOT = IS.root
tmp = tempfile.mkdtemp(prefix='wtv-img-')
for d in ('data/news', 'img/news/w480', 'img/category'):
    os.makedirs(os.path.join(tmp, d), exist_ok=True)
for f in os.listdir(os.path.join(REAL_ROOT, 'img', 'category')):
    if f.endswith('.jpg'):
        shutil.copy(os.path.join(REAL_ROOT, 'img', 'category', f), os.path.join(tmp, 'img', 'category', f))
shutil.copy(os.path.join(REAL_ROOT, 'data', 'image-sources.json'), os.path.join(tmp, 'data', 'image-sources.json'))
IS.root, IS.NEWS = tmp, os.path.join(tmp, 'data', 'news')
IS.REGISTRY, IS.REPORT = os.path.join(tmp, 'data', 'image-registry.json'), os.path.join(tmp, 'data', 'image-report.json')
IS.SETTINGS, IS.SOURCES = os.path.join(tmp, 'data', 'image-settings.json'), os.path.join(tmp, 'data', 'image-sources.json')

# ---- local test pictures (each URL -> a distinct picture) and a fake downloader
PICS = {}


def picture(url, seed, w=1600, h=900):
    p = os.path.join(tmp, f'pic{len(PICS)}.jpg')
    im = Image.new('RGB', (w, h), (seed * 37 % 255, seed * 91 % 255, seed * 53 % 255))
    dr = ImageDraw.Draw(im)
    for i in range(24):
        x = (seed * 131 + i * 977) % w
        y = (seed * 71 + i * 613) % h
        dr.rectangle([x, y, x + w // 6, y + h // 5], fill=((i * 50 + seed * 7) % 255, (i * 20) % 255, (255 - i * 9) % 255))
    im.save(p, quality=90)
    PICS[url] = p
    return url


def fake_fetch(url, out=None, tries=1, headers=None, wait=0):
    if out and url in PICS:
        shutil.copy(PICS[url], out)
        return True
    return None


IS.fetch = fake_fetch
fails = []


def check(name, cond, detail=''):
    print(('ok   ' if cond else 'FAIL ') + name + (f'  [{detail}]' if detail and not cond else ''))
    if not cond:
        fails.append(name)


def article(nid, title, summary, category, section='somalia', en=None, breaking=False, by='claude', date='2026-11-21T10:00:00+03:00'):
    n = {'id': nid, 'title': title, 'summary': summary, 'category': category, 'section': section, 'breaking': breaking, 'by': by,
         'publishedAt': date, 'published': True}
    if en:
        n['en'] = {'title': en[0], 'summary': en[1]}
    IS.save(os.path.join(IS.NEWS, nid + '.json'), n)
    return n


def C(ref, title, license, author, provider='commons', width=1600, date='2025-06-01', desc='', **kw):
    page = kw.pop('page', 'https://commons.wikimedia.org/wiki/' + ref.replace(' ', '_') if ref.startswith('File:') else 'https://example.org/' + ref)
    direct = picture('https://upload.example/' + ref, abs(hash(ref)) % 997 + 1)
    typ = {'commons': 'commons', 'openverse': 'openverse', 'unsplash': 'stock', 'pexels': 'stock', 'pixabay': 'stock', 'official': 'official'}[provider]
    return dict({'provider': provider, 'sourceType': typ, 'source': {'commons': 'Wikimedia Commons', 'openverse': 'Flickr', 'unsplash': 'Unsplash',
                 'official': 'The White House'}.get(provider, provider.title()), 'ref': ref, 'title': title, 'description': desc, 'license': license,
                 'author': author, 'pageUrl': page, 'directUrl': direct, 'width': width, 'date': date}, **kw)


def best(n, cands, **kw):
    S, ranked = IS.rank(n, cands, **kw)
    ok = [c for c in ranked if c['score'] is not None]
    return S, ranked, (ok[0] if ok else None)


def why(ranked, ref):
    return '; '.join(next(c for c in ranked if c['ref'] == ref)['rejected'])


# 1. Somali political news: the President, Mogadishu
n1 = article('t1-madaxweyne-xasan-sheekh-muqdisho', 'Madaxweyne Xasan Sheekh Maxamuud oo shir jaraa\'id ku qabtay Muqdisho',
             'Madaxweyne Xasan Sheekh Maxamuud ayaa maanta Muqdisho ka hadlay doorashooyinka.', 'Siyaasadda',
             en=('President Hassan Sheikh Mohamud holds a press conference in Mogadishu', 'President Hassan Sheikh Mohamud spoke in Mogadishu about the elections.'))
c1 = [C('File:William Ruto 2023.jpg', 'William Ruto 2023', 'CC BY 4.0', 'Kenya State House', desc='Kenyan President William Ruto'),
      C('reuters-hsm', 'Hassan Sheikh Mohamud speaks', 'CC BY 4.0', 'REUTERS/Feisal Omar', page='https://www.reuters.com/pictures/hsm'),
      C('File:Hassan Sheikh Mohamud 2022.jpg', 'Hassan Sheikh Mohamud 2022', 'CC BY-SA 4.0', 'Villa Somalia staff', width=2000, date='2022-06-09',
        desc='President Hassan Sheikh Mohamud in Mogadishu')]
S, r, b = best(n1, c1)
check('1 Somali politics: picks the President, in Mogadishu', b and b['ref'] == 'File:Hassan Sheikh Mohamud 2022.jpg', str(b and b['ref']))
check('1 Somali politics: rejects the wrong person', 'wrong person' in why(r, 'File:William Ruto 2023.jpg'), why(r, 'File:William Ruto 2023.jpg'))
check('1 Somali politics: rejects the agency photo', 'news-agency' in why(r, 'reuters-hsm'), why(r, 'reuters-hsm'))
check('1 Somali spellings are understood (Xasan Sheekh -> Hassan Sheikh, Muqdisho -> Mogadishu)',
      'hassan sheikh mohamud' in S['people'] and 'mogadishu' in S['places'], json.dumps(S))
IS.attach(n1['id'], b, 'Madaxweyne Xasan Sheekh Maxamuud')

# 2. International political news: Donald Trump
n2 = article('t2-trump-go-aan-cusub', 'Trump oo saxiixay amar cusub oo ku saabsan ganacsiga', 'Madaxweyne Donald Trump ayaa saxiixay amar cusub.', 'Adduunka',
             'world', en=('Trump signs a new trade order', 'President Donald Trump signed a new order on trade in Washington.'))
c2 = [C('File:Joe Biden presidential portrait.jpg', 'Joe Biden presidential portrait', 'Public domain', 'White House', provider='commons', desc='Official portrait of Joe Biden'),
      C('trump-official', 'President Donald J. Trump official portrait', 'Public domain', 'The White House', provider='official', date='2025-01-20',
        page='https://www.whitehouse.gov/administration/donald-j-trump/')]
S, r, b = best(n2, c2)
check('2 International politics: picks Donald Trump (official, public domain)', b and b['ref'] == 'trump-official', str(b and b['ref']))
check('2 International politics: rejects Joe Biden', 'wrong person' in why(r, 'File:Joe Biden presidential portrait.jpg'))
rec2 = IS.record({'image': 'x', 'imageRights': {'sourceType': 'official', 'source': 'The White House', 'pageUrl': b['pageUrl'], 'license': 'Public domain', 'photographer': 'The White House'}})
check('2 public-domain official photo with a source page is VERIFIED', rec2['status'] == 'VERIFIED', rec2['status'])

# 3. Security news: an operation in Lower Shabelle
n3 = article('t3-howlgal-shabeellaha-hoose', 'Ciidamada xoogga dalka oo howlgal ka fuliyay Shabeellaha Hoose',
             'Ciidamada Xoogga Dalka ayaa howlgal ka sameeyay deegaanno ka tirsan gobolka.', 'Amniga',
             en=('Somali army carries out an operation in Lower Shabelle', 'The Somali National Army carried out an operation in Lower Shabelle, Somalia.'))
c3 = [C('openverse:sna', 'Somali National Army soldiers on patrol in Lower Shabelle, Somalia', 'CC0', 'AMISOM Public Information', provider='openverse',
        page='https://www.flickr.com/photos/amisom/1', official=True, sourceType='official'),
      C('openverse:syria', 'Syrian army soldiers in Damascus, Syria', 'CC BY 2.0', 'someone', provider='openverse', page='https://www.flickr.com/photos/x/2'),
      C('openverse:nc', 'Somali National Army soldiers Somalia', 'CC BY-NC 2.0', 'ISN', provider='openverse', page='https://www.flickr.com/photos/x/3')]
S, r, b = best(n3, c3)
check('3 Security: picks the Somali army photo from the official AMISOM account', b and b['ref'] == 'openverse:sna', str(b and b['ref']))
check('3 Security: rejects the non-commercial licence', 'licence does not allow' in why(r, 'openverse:nc'), why(r, 'openverse:nc'))
check('3 Security: rejects the wrong country', why(r, 'openverse:syria') != '', why(r, 'openverse:syria'))

# 4. Sports news: a football match
n4 = article('t4-arsenal-chelsea', 'Arsenal oo 2-1 kaga adkaatay Chelsea', 'Arsenal ayaa garoonka Emirates Stadium kaga adkaatay Chelsea kulan Premier League.',
             'Ciyaaraha', 'sports', en=('Arsenal beat Chelsea 2-1', 'Arsenal beat Chelsea 2-1 at the Emirates Stadium in the Premier League.'))
c4 = [C('unsplash:ball', 'soccer ball on grass', 'Unsplash License', 'A. Photographer', provider='unsplash', page='https://unsplash.com/photos/ball'),
      C('File:Emirates Stadium Arsenal v Chelsea.jpg', 'Emirates Stadium Arsenal v Chelsea', 'CC BY-SA 2.0', 'Ronnie Macdonald', desc='Arsenal v Chelsea at the Emirates Stadium, London')]
S, r, b = best(n4, c4)
check('4 Sports: picks the photo of the two teams and the stadium, not the generic stock ball', b and b['ref'] == 'File:Emirates Stadium Arsenal v Chelsea.jpg', str(b and b['ref']))

# 5. Business news: Ethiopian Airlines
n5 = article('t5-ethiopian-airlines-duulimaad-cusub', 'Ethiopian Airlines oo duulimaad cusub u furtay Muqdisho', 'Shirkadda Ethiopian Airlines ayaa ka shaqeyn doonta Addis Ababa ilaa Muqdisho.',
             'Dhaqaalaha', en=('Ethiopian Airlines opens a new route to Mogadishu', 'Ethiopian Airlines will fly from Addis Ababa to Mogadishu.'))
c5 = [C('File:Kenya Airways Boeing 787 at Nairobi.jpg', 'Kenya Airways Boeing 787 at Nairobi, Kenya', 'CC BY-SA 4.0', 'Spotter'),
      C('File:Ethiopian Airlines Boeing 787 Addis Ababa.jpg', 'Ethiopian Airlines Boeing 787 at Addis Ababa Bole', 'CC BY-SA 4.0', 'Spotter2')]
S, r, b = best(n5, c5)
check('5 Business: picks the Ethiopian Airlines plane', b and b['ref'] == 'File:Ethiopian Airlines Boeing 787 Addis Ababa.jpg', str(b and b['ref']))
check('5 Business: rejects the other airline in another country', why(r, 'File:Kenya Airways Boeing 787 at Nairobi.jpg') != '')

# 6. Breaking news without a usable photo -> category graphic, never an AI picture
n6 = article('t6-qarax-muqdisho', 'DEGDEG: Qarax ka dhacay Muqdisho', 'Qarax ayaa maanta ka dhacay magaalada Muqdisho.', 'Amniga', breaking=True,
             en=('BREAKING: Explosion in Mogadishu', 'An explosion hit Mogadishu today.'))
c6 = [C('afp-blast', 'Explosion in Mogadishu', 'CC BY 4.0', 'AFP', page='https://www.afp.com/en/photo/1'),
      C('File:Mogadishu skyline 2012.jpg', 'Mogadishu skyline 2012', 'CC BY 2.0', None, date='2012-01-01')]
S, r, b = best(n6, c6)
check('6 Breaking: no candidate passes (agency photo; photo without the author its licence needs)', b is None, str(b and b['ref']))
IS.fallback(n6['id'], 'sawir dhab ah oo qaraxa ah lama helin')
_, x6 = IS.load(n6['id'])
check('6 Breaking: gets the security category graphic, labelled as category graphic', x6['image'] == 'img/category/amniga.jpg' and x6['imageKind'] == 'category'
      and IS.record(x6)['status'] == 'CATEGORY_GRAPHIC', json.dumps({k: x6.get(k) for k in ('image', 'imageKind')}))

# 7. Technology news
n7 = article('t7-iphone-cusub', 'Apple oo soo bandhigtay iPhone cusub', 'Shirkadda Apple ayaa soo bandhigtay iPhone cusub.', 'Teknolojiyadda', 'world',
             en=('Apple unveils a new iPhone', 'Apple unveiled a new iPhone with a faster chip.'))
c7 = [C('pexels:samsung', 'Samsung Galaxy phone on a table', 'Pexels License', 'P. One', provider='pexels', page='https://www.pexels.com/photo/1'),
      C('File:Apple iPhone 17 Pro.jpg', 'Apple iPhone 17 Pro', 'CC BY-SA 4.0', 'Tech Writer', date='2026-09-12', desc='The Apple iPhone 17 Pro smartphone')]
S, r, b = best(n7, c7, keywords=['apple', 'iphone'])
check('7 Technology: picks the actual product', b and b['ref'] == 'File:Apple iPhone 17 Pro.jpg', str(b and b['ref']))
check('7 Technology: rejects the other brand (weak relevance)', why(r, 'pexels:samsung') != '', why(r, 'pexels:samsung'))

# 8. A specific individual: Abiy Ahmed
n8 = article('t8-abiy-axmed', 'Ra\'iisul Wasaare Abiy Axmed oo booqday Jabuuti', 'Ra\'iisul Wasaaraha Itoobiya Abiy Axmed ayaa gaaray Jabuuti.', 'Siyaasadda',
             en=('Prime Minister Abiy Ahmed visits Djibouti', 'Ethiopian Prime Minister Abiy Ahmed arrived in Djibouti.'))
c8 = [C('File:Abiy Ahmed small.jpg', 'Abiy Ahmed', 'CC BY 4.0', 'Office of the PM', width=500),
      C('File:Abiy Ahmed 2024.jpg', 'Prime Minister Abiy Ahmed in 2024', 'CC BY 4.0', 'Office of the PM', width=1800, date='2024-03-02')]
S, r, b = best(n8, c8)
check('8 Person: picks the right person in good quality', b and b['ref'] == 'File:Abiy Ahmed 2024.jpg', str(b and b['ref']))
check('8 Person: rejects the photo that is too small', 'too small' in why(r, 'File:Abiy Ahmed small.jpg'), why(r, 'File:Abiy Ahmed small.jpg'))

# 9. A specific city: Hargeisa
n9 = article('t9-hargeysa-garoon', 'Hargeysa oo laga furay waddo cusub oo garoonka diyaaradaha', 'Waddo cusub ayaa laga furay magaalada Hargeysa.', 'Bulshada',
             en=('New road opens to the airport in Hargeisa', 'A new road to the airport opened in Hargeisa.'))
c9 = [C('File:Aden Adde International Airport Mogadishu.jpg', 'Aden Adde International Airport, Mogadishu', 'CC BY-SA 3.0', 'A'),
      C('File:Hargeisa Egal International Airport.jpg', 'Egal International Airport, Hargeisa', 'CC BY-SA 3.0', 'B')]
S, r, b = best(n9, c9)
check('9 City: picks Hargeisa, rejects Mogadishu', b and b['ref'] == 'File:Hargeisa Egal International Airport.jpg' and 'wrong location' in why(r, 'File:Aden Adde International Airport Mogadishu.jpg'),
      why(r, 'File:Aden Adde International Airport Mogadishu.jpg'))

# 10. No suitable image at all
n10 = article('t10-tuulo-yar', 'Beelaha tuulada Ceel-Garas oo heshiis nabadeed gaaray', 'Odayaasha beelaha ayaa heshiis gaaray.', 'Bulshada')
S, r, b = best(n10, [])
check('10 No image: nothing found', b is None)
IS.fallback(n10['id'])
_, x10 = IS.load(n10['id'])
check('10 No image: society category graphic, no invented source or licence', x10['image'] == 'img/category/bulshada.jpg' and not x10.get('imageSourceUrl')
      and IS.record(x10).get('photographer') is None)

# ---- reuse prevention, near-identical copies, unique names
_, x1 = IS.load(n1['id'])
check('reuse: photo saved under a new, article-specific file name', x1['image'].startswith('img/news/t1-madaxweyne-xasan-sheekh-muqdisho-') and os.path.isfile(os.path.join(tmp, x1['image'])), x1['image'])
check('record: source, page, photographer, licence, retrieval date and hash are kept', all(x1['imageRights'].get(k) for k in ('source', 'pageUrl', 'directUrl', 'photographer', 'license', 'licenseUrl', 'retrievedAt', 'sha256', 'dhash')))
check('record: CC BY-SA with an author = ATTRIBUTION REQUIRED (never VERIFIED)', IS.record(x1)['status'] == 'ATTRIBUTION_REQUIRED', IS.record(x1)['status'])
n11 = article('t11-ganacsi-kale', 'Suuqa Bakaaraha oo qiimuhu kor u kacay', 'Qiimaha cuntada ayaa kor u kacay.', 'Dhaqaalaha')
same = dict(c1[2])
try:
    IS.attach(n11['id'], same, 'x')
    check('reuse: the same photo is refused for an unrelated story', False)
except ValueError as e:
    check('reuse: the same photo is refused for an unrelated story', 'already used by t1-madaxweyne' in str(e), str(e))
# a resized, re-encoded copy from another address
copy_url = 'https://other.example/copy.jpg'
Image.open(PICS[same['directUrl']]).resize((1280, 720)).save(os.path.join(tmp, 'copy.jpg'), quality=70)
PICS[copy_url] = os.path.join(tmp, 'copy.jpg')
try:
    IS.attach(n11['id'], dict(same, directUrl=copy_url, pageUrl='https://commons.wikimedia.org/wiki/File:Copy.jpg'), 'x')
    check('reuse: a resized copy of the same picture is refused', False)
except ValueError as e:
    check('reuse: a resized copy of the same picture is refused', 'near-identical' in str(e) or 'same file' in str(e), str(e))
n12 = article('t12-madaxweyne-safar', 'Madaxweyne Xasan Sheekh Maxamuud oo u ambabaxay Turkiga', 'Madaxweyne Xasan Sheekh ayaa Muqdisho ka ambabaxay.', 'Siyaasadda',
              en=('President Hassan Sheikh Mohamud leaves for Turkey', 'President Hassan Sheikh Mohamud left Mogadishu for Turkey.'))
IS.attach(n12['id'], same, 'Madaxweyne Xasan Sheekh', continuing=(n1['id'],))
_, x12 = IS.load(n12['id'])
check('reuse: allowed only for the same continuing story (--continuing)', x12['image'] != x1['image'] and x12['imageRights'].get('continuing') == [n1['id']])
# replacing a photo: new name, the old file is removed, history kept
old = x12['image']
alt_c = C('File:Hassan Sheikh Mohamud Ankara 2026.jpg', 'Hassan Sheikh Mohamud in Ankara, Turkey', 'CC BY 4.0', 'Presidency of Turkey', date='2026-11-21')
IS.attach(n12['id'], alt_c, 'Madaxweyne Xasan Sheekh oo Ankara jooga')
_, x12 = IS.load(n12['id'])
check('replace: new file name (no cache can show the old photo), old file deleted, history kept',
      x12['image'] != old and not os.path.exists(os.path.join(tmp, old)) and x12['imageRights']['history'][-1]['image'] == old)

# ---- licence status rules
R = lambda **k: IS.record(dict({'image': 'img/news/a.jpg'}, **k))
check('status: CC BY without author -> LICENSE UNCLEAR', R(imageLicense='CC BY 4.0', imageSourceUrl='https://commons.wikimedia.org/wiki/File:A.jpg')['status'] == 'LICENSE_UNCLEAR')
check('status: CC0 with page -> VERIFIED', R(imageLicense='CC0', imageSourceUrl='https://commons.wikimedia.org/wiki/File:A.jpg')['status'] == 'VERIFIED')
check('status: licence without a source page -> LICENSE UNCLEAR', R(imageLicense='CC0', imageCredit='X')['status'] == 'LICENSE_UNCLEAR')
check('status: CC BY-ND -> LICENSE UNCLEAR (no changes allowed)', R(imageLicense='CC BY-ND 4.0', imageCredit='A / Flickr', imageSourceUrl='https://www.flickr.com/p/1')['status'] == 'LICENSE_UNCLEAR')
check('status: Getty credit -> LICENSE UNCLEAR', R(imageLicense='CC BY 4.0', imageCredit='Getty Images', imageSourceUrl='https://www.gettyimages.com/x')['status'] == 'LICENSE_UNCLEAR')
check('status: admin upload without confirmed rights -> EDITOR UPLOAD', R(by='admin')['status'] == 'EDITOR_UPLOAD')
check('status: admin own photo with rights confirmed -> VERIFIED', R(by='admin', imageRights={'sourceType': 'editor', 'license': 'Wartabiye TV', 'rightsConfirmedBy': 'owner'})['status'] == 'VERIFIED')
check('status: AI illustration is never a photo', R(imageKind='ai-illustration', imageRights={'sourceType': 'ai'})['status'] == 'AI_ILLUSTRATION')
leg = R(imageCredit='Partynia / Wikimedia Commons', imageLicense='CC BY 4.0', imageSourceUrl='https://commons.wikimedia.org/wiki/File:BMW_Open.jpg')
check('older articles: photographer and source read from the credit, not invented', leg.get('photographer') == 'Partynia' and leg['source'] == 'Wikimedia Commons' and leg['status'] == 'ATTRIBUTION_REQUIRED')
check('public credit: only source, photographer, licence, link and status reach readers', set(IS.public(IS.record(x1))) <= set(IS.PUBLIC_KEYS) and 'matchScore' not in IS.public(IS.record(x1)))
check('visible credit text', IS.record(x1)['attribution'] == 'Photo: Wikimedia Commons | Photographer: Villa Somalia staff | License: CC BY-SA 4.0', IS.record(x1)['attribution'])

# ---- hold setting and the registry
json.dump({'noPhoto': 'hold'}, open(IS.SETTINGS, 'w'))
n13 = article('t13-hold', 'War kale', 'Qoraal.', 'Siyaasadda')
IS.fallback(n13['id'])
_, x13 = IS.load(n13['id'])
check('setting "hold": the story waits in Sugaya sawir instead', x13.get('imagePending') is True and x13.get('published') is False and not x13.get('image'))
os.remove(IS.SETTINGS)
reg = IS.build_registry()
uses = {u['article'] for e in reg['images'].values() for u in e['uses']}
check('registry: every photo and every use is recorded', {n1['id'], n12['id']} <= uses)
check('registry: the replaced photo of t12 is remembered as an earlier use', any(u['article'] == n12['id'] and not u.get('current') for e in reg['images'].values() for u in e['uses']))

# ---- no article ever gets another article's photo
imgs = {}
for a in IS.articles():
    im = a.get('image')
    if im and not im.startswith('img/category/'):
        check(f'own photo: {a["id"]}', im not in imgs and os.path.basename(im).startswith(a['id']), f'{im} also {imgs.get(im)}')
        imgs[im] = a['id']

# ---- the real site: every category graphic exists, and the current records build
for slug in set(IS.CATEGORY_GRAPHICS.values()) | {'wartabiye'}:
    check(f'category graphic img/category/{slug}.jpg', os.path.isfile(os.path.join(REAL_ROOT, 'img', 'category', slug + '.jpg'))
          and os.path.isfile(os.path.join(REAL_ROOT, 'img', 'category', 'w480', slug + '.webp')))
IS.root, IS.NEWS = REAL_ROOT, os.path.join(REAL_ROOT, 'data', 'news')
IS.SOURCES = os.path.join(REAL_ROOT, 'data', 'image-sources.json')
bad = [a['id'] for a in IS.articles(include_trash=False) if a.get('image') and IS.record(a)['status'] not in IS.STATUSES]
check('every current article image gets a valid status', not bad, ', '.join(bad[:5]))
falsely = [a['id'] for a in IS.articles(include_trash=False) if a.get('image') and IS.record(a)['status'] == 'VERIFIED'
           and not (IS.licence_info(IS.record(a).get('license')) or {}).get('free')]
check('no current article image is marked VERIFIED without a free licence', not falsely, ', '.join(falsely[:5]))
shutil.rmtree(tmp, ignore_errors=True)
if fails:
    print(f'\n{len(fails)} image test(s) failed')
    sys.exit(1)
print('\nIMAGE SYSTEM OK')
