# Dhageyso Warbixinta: article audio (Cloudflare Worker)

Every article on wartabiyetv.com gets a "Dhageyso Warbixinta" player under its headline and byline (`assets/listen.js`,
called from `assets/app.js` renderStory). The visitor presses Play and hears the whole article, in the language they are
reading, with the newsroom's fixed voice for that language. This Worker makes and stores the audio.

## How it works

1. Play → `GET /v1/listen?id=<article>&lang=<language>` (the browser sends only the article id and the language).
2. The Worker reads the published article itself from the website (`data/story/<id>.json`): the title, the introduction
   and every paragraph and subheading of the body in that language, exactly as the page shows it. Never menus, ads,
   captions, the byline, sources or admin notes. No translation → no audio (never another language instead).
3. `src/text.js` prepares the text for speech (removes HTML, Markdown, links, emoji and stray symbols; writes out %, $, €,
   ranges and numeric dates in the article's language; Somali has its own rules and keeps Somali spelling, including the
   apostrophe). It never rewrites, translates or summarises the article.
4. The speech is split at paragraph and sentence boundaries into parts of at most 2,400 characters, made by the speech
   provider (3 parts at a time), and joined into one MP3 (24 kHz mono, 48 kbit/s, about 360 KB a minute) with fixed pauses
   after the title (0.9 s), the introduction (0.75 s), subheadings and paragraphs.
5. The audio is stored under a hash of the exact speech text, voice and settings. Every later listener gets the stored file
   (`/v1/a/<hash>.mp3`, byte ranges for seeking, browser cache for a year). An edited article has a new hash: new audio is
   made at the next Play and the old file is deleted.

## Voices (Azure AI Speech neural voices)

| Language | Voice | Alternative (VOICE_XX variable) |
|---|---|---|
| Somali | so-SO-UbaxNeural, 6% slower than default | so-SO-MuuseNeural |
| English | en-GB-SoniaNeural | en-GB-RyanNeural, en-US-AndrewNeural |
| Arabic | ar-SA-ZariyahNeural | ar-SA-HamedNeural |
| French | fr-FR-DeniseNeural | fr-FR-HenriNeural |
| German | de-DE-KatjaNeural | de-DE-ConradNeural |
| Italian | it-IT-ElsaNeural | it-IT-DiegoNeural |
| Spanish | es-ES-ElviraNeural | es-ES-AlvaroNeural |
| Dutch | nl-NL-FennaNeural | nl-NL-MaartenNeural |
| Turkish | tr-TR-EmelNeural | tr-TR-AhmetNeural |

Somali: Microsoft's two Somali-trained neural voices. Run **Actions → "Codka Soomaaliga - tijaabo" → Run workflow** to hear
both voices (and ElevenLabs Eleven v3 if configured) on real Wartabiye TV sentences and articles, with a Somali
speech-recognition intelligibility score for each. Change the voice with the repository variable `VOICE_SO`.

## Setup (one time)

1. Azure portal → Create a resource → **Speech** (Azure AI services). Pricing tier Free F0 (0.5 million characters a
   month) or Standard S0 (about $15 per million characters). Any region, e.g. West Europe.
2. GitHub → Settings → Secrets and variables → Actions → New repository secret:
   - `AZURE_SPEECH_KEY` = the resource's KEY 1
   - `AZURE_SPEECH_REGION` = its Location/Region, written like `westeurope`
   (`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are already used by the secure admin.)
3. Actions → **Dhageyso Warbixinta (article audio deploy)** → Run workflow. It tests, deploys, stores the key in
   Cloudflare only, narrates the newest article in Somali and English as a live check, then switches the player on for
   the website. Until this succeeds the website shows no player.

To stop it at once: run the same workflow with mode `off` (the player disappears; articles are untouched).

## Limits and costs (Worker variables in `wrangler.toml`)

- `DAILY_CHAR_LIMIT` (150,000): characters sent to the provider per day, at most about $2.25 a day on S0. Over the limit the
  player says the service is busy; stored audio still plays.
- `IP_LIMIT` (12): new audio files one visitor can start per 10 minutes. Listening to stored audio is never limited.
- `MAX_CHARS` (50,000): longest article narrated, about 60 minutes. The longest article today is about 20,000 characters.
- `KEEP_DAYS` (180): stored audio not re-made for this long is removed, and made again at the next Play.
- Workers KV free plan: 1,000 writes a day (a new audio file uses 4). For more, use Workers Paid or bind an R2 bucket as
  `AUDIO_R2` (the code uses it automatically).

## Tests

    cd workers/tts && npm test                          # Worker: text, Somali rules, cache, long articles, errors, limits
    FAKE_TTS=1 SITE_URL=http://localhost:8000/ node scripts/dev-server.mjs     # local service with test tones
    node tools/listen_test.js http://localhost:8000/ http://localhost:8787 shots   # browser test (site built with that endpoint)
