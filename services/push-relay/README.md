# SmplWise push relay (CR-027)

A small stateless Cloudflare Worker that lets every self-hosted SmplWise Arx server send push notifications to the
SmplWise Arx phone app, without any customer ever holding our Apple or Google keys. Contract:
`docs/api/mobile-presence-contract.md` section 8. Design: `docs/changes/CR-027-MOBILE-PRESENCE-PUSH.md` section 6.

What it stores: `sha256(relay_token) → {platform, push_token, bundle_id, created_at}` in Workers KV (expires after 180
days without use). What it never sees: notification text, user names, server addresses (only an opaque server id).

Status: written and typechecked (`npm run typecheck`), **not yet deployed or run against APNs / FCM** - that needs the
owner's Apple Developer Program membership and a Firebase project (below). `fake_relay.py` is a local stand-in for
development; the backend tests use their own in-process fake.

## 1. One-time setup (the owner, about 30 minutes)

1. **Cloudflare account** (the one that runs the tunnels) → Workers & Pages. Install the tooling on a machine with Node 20+:
   `cd services/push-relay && npm install`, then `npx wrangler login` (opens the browser).
2. **KV namespace**: `npx wrangler kv namespace create RELAY_KV` → paste the printed `id` into `wrangler.toml`.
3. **Apple** (iOS): in the Apple Developer portal → Keys → create an **APNs Auth Key** (.p8), note the **Key ID** and the
   **Team ID**; the app's bundle id is `com.smplwise.arx.app` (confirm with the iOS handoff). Store the .p8 in the
   password manager. Then:
   ```
   npx wrangler secret put APNS_KEY_P8      # paste the whole .p8 file content (header lines are fine)
   npx wrangler secret put APNS_KEY_ID
   npx wrangler secret put APNS_TEAM_ID
   npx wrangler secret put APNS_BUNDLE_ID   # com.smplwise.arx.app
   ```
   `APNS_ENV` in `wrangler.toml` is `production`; for Xcode development builds deploy a second Worker (`--name
   smplwise-push-relay-sandbox`) with `APNS_ENV = "sandbox"`, or switch the var while testing.
4. **Google** (Android, later): Firebase console → the project of the Android app → Project settings → Service accounts →
   *Generate new private key* (a JSON file). `npx wrangler secret put FCM_SERVICE_ACCOUNT` and paste the whole file.
   Never commit it (`.gitignore` blocks `*service-account*.json`).
5. **Server keys**: one key per Arx installation, `<server id>:<secret>` pairs, comma separated. Generate a secret per
   customer (`openssl rand -base64 32`), then `npx wrangler secret put SERVER_KEYS` with e.g.
   `efrat:<secret1>,office2:<secret2>`. The server id is what the phone groups notifications by; keep it short and
   stable. Give each installation its own secret: in the add-on options `push_relay_url = https://<worker>.workers.dev`
   (or the custom domain) and `push_relay_key = <its secret>`. Rotating a key = replace the pair and update that one
   add-on.
6. **Deploy**: `npm run deploy`. Check `https://<worker>/v1/health` → `{"ok":true,"apns":true,"fcm":false}`.
   Optional custom domain (e.g. `push.smplwise.com`): Workers → the Worker → Settings → Domains.

## 2. Operations

- `npm run tail` streams the Worker's logs (no tokens are ever logged).
- Limits (per `src/index.ts`): registrations 60 / h per address; pushes 60 / min and 500 / day per device, 6 000 / h per
  server; a server that keeps naming unknown relay tokens is slowed down (200 / h). A relay token answered `404` / `410`
  is dropped by the Arx server at once (its device re-registers on the next app launch).
- The app registers on every launch (idempotent per push token); a token nobody pushed to for 180 days expires.
- Nothing here is customer data: the KV holds platform tokens only. Deleting the namespace logs every phone out of push
  until the next app launch - no other effect.

## 3. Local development

`python services/push-relay/fake_relay.py --port 8787` serves the same routes with no APNs / FCM behind it and lists what
arrived at `GET /v1/pushes` (the app mock can poll it and raise a local notification). The backend tests
(`smplwise_vms/backend/tests/test_mobile_push.py`) use an in-process `httpx.MockTransport` instead.

## 4. Files

| File | What |
|---|---|
| `src/index.ts` | the routes, KV storage, rate limits, the server-key check |
| `src/apns.ts` | APNs HTTP/2 with an ES256 provider token (Web Crypto), the generic payload (`mutable-content: 1`) |
| `src/fcm.ts` | FCM HTTP v1 with a service-account OAuth2 token (RS256), a data-only message |
| `src/crypto.ts` | base64url, SHA-256, JWS signing, constant-time compare |
| `src/env.d.ts` | the Worker bindings / secrets (typed locally; compatible with `@cloudflare/workers-types`) |
| `wrangler.toml` | the Worker name, the KV binding, the non-secret vars |
| `fake_relay.py` | the local stand-in |
