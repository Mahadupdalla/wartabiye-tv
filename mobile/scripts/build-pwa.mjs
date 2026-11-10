// Builds the installable web app (PWA) from the SAME React Native code as the Android and iOS apps, into ../app/,
// which GitHub Pages serves at https://www.wartabiyetv.com/app/. Run: npm run build:pwa  (then commit ../app)
// The web app reads the news from the website itself (same origin: /api/v1/ and /data/), so it is always the same content.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const out = path.resolve(root, '..', 'app');
const env = { ...process.env, WTV_WEB_BASE: '/app', EXPO_PUBLIC_CONTENT_BASE: 'https://www.wartabiyetv.com/' };
delete env.EXPO_PUBLIC_POLL_MS;
fs.rmSync(out, { recursive: true, force: true });
execFileSync('npx', ['expo', 'export', '-p', 'web', '--output-dir', out, '--clear'], { cwd: root, stdio: 'inherit', env });

// only the Ionicons font is used: leave out the other icon fonts (about 5 MB)
const fonts = path.join(out, 'assets', 'node_modules', '@expo', 'vector-icons', 'build', 'vendor', 'react-native-vector-icons', 'Fonts');
if (fs.existsSync(fonts)) for (const f of fs.readdirSync(fonts)) if (!f.startsWith('Ionicons.')) fs.rmSync(path.join(fonts, f));
for (const f of ['pwa-192.png', 'pwa-512.png', 'pwa-maskable-512.png']) fs.copyFileSync(path.join(root, 'assets', f), path.join(out, f));
fs.copyFileSync(path.join(root, 'pwa', 'manifest.webmanifest'), path.join(out, 'manifest.webmanifest'));
const version = crypto.createHash('sha1').update(fs.readFileSync(path.join(out, 'index.html'))).digest('hex').slice(0, 10);
fs.writeFileSync(path.join(out, 'sw.js'), fs.readFileSync(path.join(root, 'pwa', 'sw.js'), 'utf8').replace('__VERSION__', version));

let html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
const head = [
  '<link rel="manifest" href="/app/manifest.webmanifest">',
  '<meta name="theme-color" content="#0263b3">',
  '<link rel="apple-touch-icon" href="/app/pwa-192.png">',
  '<meta name="apple-mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-title" content="Wartabiye TV">',
  '<meta name="description" content="Wartabiye TV: wararka Soomaaliya, caalamka iyo ciyaaraha, sagaal luqadood.">',
].join('\n    ');
html = html.replace('</head>', '    ' + head + '\n  </head>').replace(/<title>[^<]*<\/title>/, '<title>Wartabiye TV</title>');
fs.writeFileSync(path.join(out, 'index.html'), html);
// Pages must not run the files through Jekyll (folders starting with "_" such as _expo would be dropped)
fs.writeFileSync(path.join(out, '.nojekyll'), '');
console.log('PWA built in', out, '(service worker version', version + ')');
