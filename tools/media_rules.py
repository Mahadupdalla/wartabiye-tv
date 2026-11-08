"""Rules shared by the build and check tools for Video News, LIVE TV and LIVE Sports.

Only players from official, authorised providers are accepted. The same allow-list is applied again in the browser
(assets/media.js), so a wrong link typed in /admin/ is never turned into a player."""
import re
from datetime import datetime, timezone

YT = re.compile(r'(?:youtu\.be/|[?&]v=|/embed/|/shorts/|/live/)([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])')
YT_CHANNEL = re.compile(r'youtube\.com/channel/(UC[A-Za-z0-9_-]{22})')
PROVIDERS = [
    ('youtube', YT),
    ('youtube-channel', YT_CHANNEL),
    ('vimeo-event', re.compile(r'^https://vimeo\.com/event/(\d+)')),
    ('vimeo', re.compile(r'^https://(?:www\.|player\.)?vimeo\.com/(?:video/)?(\d+)')),
    ('dailymotion', re.compile(r'^https://(?:www\.dailymotion\.com/video/|dai\.ly/|geo\.dailymotion\.com/player\.html\?video=)([A-Za-z0-9]+)')),
    ('facebook', re.compile(r'^https://(?:www\.|web\.|m\.)?(?:facebook\.com/[^\s]+/videos/|facebook\.com/watch/?\?v=|fb\.watch/)([A-Za-z0-9_.-]+)')),
    ('cloudflare', re.compile(r'^https://(?:customer-[a-z0-9]+\.cloudflarestream\.com|iframe\.videodelivery\.net)/([a-f0-9]{32})')),
    ('hls', re.compile(r'^https://\S+\.m3u8(?:\?\S*)?$', re.I)),
    ('file', re.compile(r'^(?:https://|videos/)\S+\.(?:mp4|webm)(?:\?\S*)?$', re.I)),
]


def provider(url):
    """(provider, id) for a link from an accepted provider, else (None, None)."""
    u = str(url or '').strip()
    if not u:
        return None, None
    for name, rx in PROVIDERS:
        if name.startswith('youtube') and not re.match(r'^https://(?:www\.|m\.)?(?:youtube\.com|youtu\.be|youtube-nocookie\.com)/', u):
            continue
        m = rx.search(u)
        if m:
            return name, (m.group(1) if m.groups() else u)
    return None, None


def parse_time(s):
    try:
        d = datetime.fromisoformat(str(s).replace('Z', '+00:00'))
        return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
    except Exception:
        return None


def stream_authorised(s):
    """A sports stream is shown only when the admin confirmed the broadcasting rights, named the rights holder and
    wrote down the authorisation (contract, licence or written permission)."""
    return bool(s.get('rightsConfirmed') is True and str(s.get('rightsHolder') or '').strip()
                and str(s.get('authorization') or '').strip() and provider(s.get('url'))[0])
