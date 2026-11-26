# ANDROID-PUSH-2550 — Android push without Google (UnifiedPush, server side)

Row of the owner-approved roadmap (25.11, target 2.55: "Android push without Google"). Branch `pilot/ANDROID-PUSH-2550`, base
`origin/main` = v2.53.0 (3b4654f8b). Design record: `docs/changes/CR-012-ANDROID-PUSH.md` section 4C (the UnifiedPush fallback,
acceptance AT198 of T096).

## What existed before this row

- **Browser / PWA Web Push** (CR-008 P3, `services/push.py`): RFC 8291 encryption + VAPID, allow-list of the big browser push
  services. On Android, Chrome's Web Push travels through Google's FCM.
- **Phone app push through the SmplWise relay** (CR-027 phase 2, `services/mobile_push.py`, `services/push-relay/`): the app registers
  its FCM / APNs token with a SmplWise Cloudflare Worker and gives Arx an opaque relay token; Arx sends a content-less wake, the app
  fetches the text. Built and tested with fakes, **never deployed**: it needs the owner's Firebase project, Apple account and the
  relay deploy (PUSH-GOLIVE-KIT-2380, held open by the owner). This path **requires Google Play services** on the phone.
- **Nothing for a phone without Google**: T096 evidence (2026-10-05): "no UnifiedPush code in the backend".

## What this row adds (server side only; everything off by default)

- `services/unifiedpush.py`: the site's push-server list (add-on option `unifiedpush_servers` → `SW_UNIFIEDPUSH_SERVERS`), endpoint
  validation (https, exact host and port on the list, no IP literals, no credentials, no fragment, no control characters, <= 2048
  chars), key validation (P-256 point + 16-byte auth), the content-less body, one Web Push POST (RFC 8291 `aes128gcm` via
  `push.encrypt`, VAPID via `push.vapid_authorization`, `TTL: 3600`, `Urgency`), no redirects followed, and the health state.
- `services/mobile_push.py`: a device registers either a relay token or a UnifiedPush endpoint (`register_unifiedpush`; one route per
  device, one endpoint per phone); the `app` channel plans per device by its route (relay configured / endpoint's server still listed),
  with the same reach, policy, mutes, quiet hours, night window, rate limit, stored 24 h message, retries on 429 / 5xx / network,
  404 / 410 = endpoint gone (registration dropped), site-setup errors (server taken off the list, UnifiedPush switched off) keep the
  registration and count no failure; the test push uses the device's route; `unifiedpush_config` for `presence/config`.
- `services/presence.py`: every sign-out / revoke / "sign out everywhere" path clears the endpoint and keys with the relay token;
  the device view gains `push.kind` (additive).
- `routers/mobile_notifications.py`: `POST notifications/devices` accepts `kind: "unifiedpush"` + `endpoint` / `p256dh` / `auth`
  (additive; no `kind` = the v2 relay body); new refusals `409 unifiedpush_off`, `400 unifiedpush_endpoint_refused`,
  `400 push_keys_invalid`, `400 invalid_push_kind`. The audit row records the kind, never the endpoint.
- `routers/presence.py`: `GET presence/config` member `unifiedpush: {enabled, vapid_public_key}` (additive; the VAPID pair is created
  on first need through `write_aside`).
- `routers/notifications.py` + `wire/notifications.py`: `GET notify/stats` member `app_unifiedpush` (off / invalid / ok + counters,
  never a host name); `frontend/src/api/generated/wire-notifications.ts` regenerated (`scripts/gen_wire_types.py`). No UI change.
- Migration `0227_mobile_unifiedpush.sql`: three nullable columns on `mobile_devices` + a partial index (additive; renumber at the
  train if another branch takes 0227).
- Add-on option `unifiedpush_servers: str?` (`config.yaml`, `self_update.OPTION_TYPES`, `config.py`), `smplwise_vms/DOCS.md`
  (option + section "Phone app push without Google"), contract `docs/api/mobile-presence-contract.md` section 7.4 (v2.3 addition).

Privacy: the push server sees an encrypted ~200-byte blob, time and size; the app fetches the text from the customer's own server.
The endpoint (a capability URL) is never returned by the API, never logged, never in the audit, not in the personal-data export
(`local_privacy` lists its own columns).

## What is NOT built here (waits on others)

- **The Android app's UnifiedPush connector** (app team): `org.unifiedpush.android:connector`, register with the VAPID key from
  `presence/config`, send `kind: "unifiedpush"`, handle `onMessage` (decrypt is done by the connector) → fetch → notification,
  `onNewEndpoint` → re-register, `onUnregistered` → `DELETE notifications/devices/{id}`. Contract section 7.4.
- **A push server and a distributor** (owner / installer): no account is needed for either, but the owner must pick one (questions
  below) and set the option. Nothing is created by this row.
- iOS is out of scope (no UnifiedPush on iOS; APNs needs the Apple account - PUSH-GOLIVE-KIT-2380).

## Tests

Runner (Linux, `~/work/p2520_androidpush_run.sh`, branch head 459b86cd1; backend one pytest process per file, `SW_WIRE_STRICT=1`):

| Check | Exit | Result |
|---|---|---|
| `scripts/gen_wire_types.py --check` | 0 | generated types match |
| `scripts/wire_ratchet.py` | 0 | 897 unmodelled routes = baseline (no new unmodelled route) |
| `tests/test_android_push_2550.py` (new) | 0 | 34 passed |
| `tests/test_mobile_push.py` | 0 | 53 passed |
| `tests/test_notices_push_295.py` / `test_tickets_app_push.py` / `test_notify_recipient_lang_2520.py` | 0 | 15 / 8 / 13 passed |
| `tests/test_xsecfix_297.py` / `test_presence.py` / `test_presence_contract_v22.py` | 0 | 48 / 21 / 63 passed |
| `tests/test_docs_config_consistency.py` / `test_fleet_report_215.py` / `test_frigate_addon_option.py` / `test_self_update_s3_fixes.py` | 0 | 7 / 51 / 3 / 25 passed |
| `tests/test_singletons_registered.py` / `test_migrations.py` / `test_no_ip_literals.py` | 0 | 4 / 4 / 2 passed |
| `tests/test_wire_ratchet_2480.py` / `test_wire_consumption_2450.py` / `test_error_contract_inventory_2490.py` | 0 | 7 / 13 / 7 passed |
| `tests/test_push.py` / `test_local_privacy.py` | 0 | 12 / 18 passed |
| frontend `npx tsc --noEmit -p tsconfig.json` | 0 | clean |
| `ruff check` (changed files) | 1 at 459b86cd1 | one F811 on the imported fixture in the new test; fixed (`noqa: F811`) in f270676cb: `ruff check` of the same files plus `services/push.py` exit 0 ("All checks passed") |

NOT_RUN: the full backend suite and the frontend unit / evidence / pixel suites (no UI change); any run against a real push server,
a real distributor or a real phone.

## רשימת צעדים לבעלים (Hebrew owner checklist)

אין צורך ליצור שום חשבון או מפתח. הכול כבוי עד הצעד השני.

1. לבחור שרת דחיפה: ntfy בהתקנה עצמית ליד ה-Home Assistant של הלקוח (מומלץ), או השרת הציבורי ntfy.sh.
2. להזין את שם השרת בהגדרות התוסף, בשדה `unifiedpush_servers` (שם שרת בלבד, בלי `https://` ובלי כתובת IP; כמה שרתים מופרדים
   בפסיק), לשמור ולאתחל את התוסף (לא את Home Assistant).
3. לבדוק במסך הסטטיסטיקה של ההתראות שמצב UnifiedPush הוא `ok` (`invalid` = השם לא תקין).
4. בטלפון (אחרי שצוות האפליקציה יוסיף את התמיכה): להתקין ntfy מ-F-Droid, לבחור בו את שרת הדחיפה, לפטור אותו מחיסכון בסוללה,
   ולהפעיל התראות באפליקציית Arx.

## Open questions (owner; recommendation first)

1. Which push server for UnifiedPush: (a) a self-hosted ntfy next to the customer's Home Assistant, reached through the same
   Cloudflare tunnel [recommended - no third party at all]; (b) the public ntfy.sh (no account, but a third party sees timing and
   rate limits apply); (c) not now.
2. Which distributor do we tell customers to install: (a) ntfy from F-Droid [recommended]; (b) let each user choose.
3. Who adds the connector to the Android app: (a) the existing app team in its next build, per contract section 7.4 [recommended];
   (b) later, after the relay path goes live.
