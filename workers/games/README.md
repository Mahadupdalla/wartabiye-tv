# Wartabiye TV Games: online rooms

Private rooms so friends can play **Four Homes** together, each on their own phone.

- A room is a 6-letter code. The host creates it and shares the code or the invite link; nobody can join without it.
- No chat, no free text (only a short name of letters and numbers) and a fixed list of emoji reactions.
- No accounts, no public lobby, no matchmaking with strangers. Rooms are removed 6 hours after the last move.
- The host's device runs the game and the robots; the server only relays moves and keeps the last state so a friend
  whose connection drops can come back.

Runs on Cloudflare Workers + Durable Objects (free plan). `.github/workflows/games-deploy.yml` tests and deploys it on
every change on `main`, using the same `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets as the admin
dashboard, then writes the address to `data/games-online.json` for the website. Nothing extra to set up.

Local test: `npm install && npm test` (starts `wrangler dev` and plays a short session).
