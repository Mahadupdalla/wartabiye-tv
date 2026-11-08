// Makes a new VAPID key pair for the push Worker. Run once: node make-keys.mjs
// The PUBLIC key goes into wrangler.toml (VAPID_PUBLIC_KEY) and into /admin/ -> Ogeysiisyada -> Settings.
// The PRIVATE key is a secret: paste it only into `npx wrangler@3 secret put VAPID_PRIVATE_JWK`. Never commit it.
const { subtle } = globalThis.crypto;
const kp = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const jwk = await subtle.exportKey('jwk', kp.privateKey);
const raw = new Uint8Array(await subtle.exportKey('raw', kp.publicKey));
const pub = Buffer.from(raw).toString('base64url');
console.log('VAPID_PUBLIC_KEY (public, put in wrangler.toml and /admin/):\n' + pub + '\n');
console.log('VAPID_PRIVATE_JWK (SECRET, only for `wrangler secret put VAPID_PRIVATE_JWK`):\n' + JSON.stringify({ kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y, d: jwk.d }));
