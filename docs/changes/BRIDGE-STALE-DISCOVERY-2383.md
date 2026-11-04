# BRIDGE-STALE-DISCOVERY-2383 - a stale Supervisor discovery put an old pairing code back into the bridge

Branch `fix/BRIDGE-STALE-DISCOVERY-2383`, cut from `origin/main` (2.38.2 + a registry merge), then `origin/main` 2.39.0 merged in.
Target: hotfix **2.39.1** (the branch name keeps its original 2383 tag). No add-on version bump, no tag, no merge to main here (the lead
does that). Bridge `smplwise_bridge` 0.10.2 -> **0.10.3**.

## 1. Evidence (lab, read only, 2026-11-04)

Redacted: no addresses, codes, fingerprints or entry ids. Timeline corrected by the coordinator's read-only log audit
(`private/planning/LAB_AUDIT_LOGS_2026-11-04_HE.md`, finding 2); times are local.

| Time | What happened |
|---|---|
| before | The bridge had completed a key rotation with Arx: its rotated key set matched Arx, so bridge -> Arx was fine. But after the first rotation the bridge blanks `pairing_code` in its entry (keyset.py HA-06), and WisKey verifies Arx ONLY against that field: WisKey <-> Arx was broken (`key_rotated` / refused). |
| 09:58 | Home Assistant start. Directory pushes keep answering 200 until 10:05 (no replay damage at this start). |
| ~10:03 | The owner pressed Arx's "צימוד מחדש": a new plain code in Arx, the key set wiped. On the manual WisKey owner profile `announce_discovery` returned early: nothing delivered the new code to the bridge. |
| 10:05:52 | The 401 window starts: the bridge still signs with its rotated key, Arx now holds only the new code. The bridge logged nothing (a refused push was a debug line). |
| 10:07 | Another Home Assistant start (still 401). |
| ~12:00 | Worked around by hand: the bridge integration deleted and re-added with the new code; pushes answer 200 again. |

The stale discovery is a real hazard that is still armed: the Supervisor still holds Arx's ORIGINAL message (posted once by an older
Arx, never deleted, carrying the first pairing code). Home Assistant replays every discovery at each start (section 2); the bridge's
`config_flow.async_step_hassio` then ran `_abort_if_unique_id_configured(updates={addon_url, pairing_code: <discovered>})`, writing that
old code into the existing entry, and the reload's `keyset.KeySet` K-02 (an entry code that is neither the retired code nor a key of the
set is a new pairing) throws the working key set away and signs with the old code -> 401 again. With today's fresh entry (new code, fresh
key store) the next Home Assistant start would do exactly that. Nothing ever deleted the message, and on the manual profile Arx never
re-posted it with a newer code.

So three defects meet here: (1) the stale discovery replay (fixed on both sides below), (2) a re-pair on the manual profile that cannot
reach the bridge and a bridge that does not say its pushes are refused (fixed below), (3) the bridge-key rotation disconnecting WisKey
(section 3a: a safe default now, the real fix needs WisKey).

## 2. Supervisor / Home Assistant facts relied on

Read in the public sources (current `main` / `dev`; the message identity rule also checked at Supervisor tag `2023.01.1`):

| Fact | Source |
|---|---|
| `POST /discovery` is open to any add-on that lists the service under `discovery` in its config (403 otherwise) and answers `{uuid}`. | `supervisor/api/discovery.py` `set_discovery` |
| A message is identified by (add-on, service): `Message.config` and `Message.uuid` are excluded from equality. A second POST from the same add-on for the same service with a DIFFERENT config updates the existing message in place (same uuid) and pushes it to Home Assistant again; an IDENTICAL config is a duplicate (same uuid, nothing pushed). | `supervisor/discovery/__init__.py` `Message`, `Discovery.send` (main: dataclass `compare=False`; 2023.01.1: attrs `eq=False`) |
| `DELETE /discovery/{uuid}`: only the add-on that posted the message (`message.addon != addon.slug` -> 403 "Can't remove discovery message"); an unknown uuid -> 404. The removal is pushed to Home Assistant. | `supervisor/api/discovery.py` `del_discovery`, `_extract_message`; `Discovery.remove` |
| `GET /discovery` and `GET /discovery/{uuid}` carry `@require_home_assistant`: an add-on can neither list nor read messages. | `supervisor/api/discovery.py`; routes in `supervisor/api/__init__.py` `_register_discovery` |
| `/discovery.*` is in the add-on API bypass list (no `hassio_role` needed) - POST and DELETE work with the add-on's own Supervisor token. | `supervisor/api/middleware/security.py` (`api_bypass` pattern) |
| At `EVENT_HOMEASSISTANT_START` Home Assistant lists every discovery message and starts one config flow per message (`source = hassio`, `HassioServiceInfo(config, name, slug, uuid)`). | `homeassistant/components/hassio/discovery.py` `_async_discovery_start_handler`, `async_process_new` |
| On a removal push Home Assistant removes only entries of that service whose `source == hassio` AND `unique_id == <message uuid>`. The bridge's unique_id is its domain, so deleting the message never removes the bridge entry. | `homeassistant/components/hassio/discovery.py` `async_process_del` |
| `ConfigFlow.async_set_unique_id` returns the existing entry with that unique id. | Home Assistant `config_entries.py` |

Consequences used in the design: (a) a uuid of a message posted by an older Arx can be recovered without listing - one POST of a
harmless config answers the existing message's uuid; (b) there is normally at most ONE `smplwise_bridge` message per add-on, so "post the
new one, then delete the old" usually keeps the same uuid; the code still handles a store that keeps several.

## 3. What changed

### Bridge 0.10.3 (`custom_components/smplwise_bridge`, mirrored by `scripts/sync_integration.py`)

- `config_flow.async_step_hassio`: for an EXISTING entry the new `_discovered_for_existing` decides:
  - nothing would change (same url, code and flag) or the entry is ignored -> abort `already_configured`, no network call;
  - else one signed ping with the DISCOVERED code (`_try_pair`, the same call as a first install); accepted -> the entry is updated and
    reloaded exactly as before (the K-02 re-pair path); refused (401) or unreachable -> abort `already_configured` WITHOUT updates, logged at
    info level without any code.
  - First install (no entry) is unchanged: the confirmation form, or the automatic-install path with its ping.
- Its own refused pushes are seen (new `push_health.py`, wired into `push_directory`): the first 401 from the add-on is a WARNING with
  the fix ("the add-on refuses this bridge's signed updates (401) - the pairing code in this entry is not the add-on's current one ...
  re-pair; if the new code is not delivered automatically, delete this integration and add it again"), repeated at most once an hour while
  it lasts; the recovery is an INFO line. Other failures stay debug lines. New `diagnostics.py` (Settings > Devices & services > SMPLWISE
  Bridge > Download diagnostics): `directory_push = {reason: ok | addon_refused_signature | addon_error | addon_unreachable | unknown,
  status, since, count, last_ok}` and whether the entry holds a pairing code - never the code, a key, the address or a user. On the Arx
  side the same symptom is the `bridge_rejected` row below.
- Version 0.10.3 in `const.py`, `manifest.json`, `www/smplwise-card.js` (and every test pin). The `already_configured` text no longer claims
  that the pairing details were refreshed (en/he).
- Needs one Home Assistant restart to load. **On a manual WisKey owner profile Arx does not copy the bridge** (unchanged rule); there the
  bridge stays on its installed version until the owner installs 0.10.3 - the Arx side below fixes the lab on its own; 0.10.3 is the
  second line of defence.

### Arx add-on

- `services/bridge_discovery.py` (new): Arx keeps the invariant "the Supervisor holds a `smplwise_bridge` message from Arx only while it
  carries Arx's CURRENT plain pairing code that is not adopted into the key set yet (K-01)".
  - Settings row `bridge.discovery_messages` = {uuid: {fp, at}} of every message Arx posted and has not deleted (`fp`: a one-way 16-hex tag
    of the code, never the code); `bridge.discovery_swept_at` = Arx knows the uuid of its message. Both in `backup.SETTINGS_KEEP` (local
    infrastructure state, never restored from an archive).
  - `after_post`: records the uuid answered by the Supervisor, then deletes every OTHER recorded message (post the new one first).
  - `retire`: deletes the recorded messages whose code is no longer current (all of them once the code is adopted); once per installation,
    when no uuid is known, posts `{addon_url}` only (the bridge aborts `invalid_discovery` without touching its entry) to learn the uuid of
    an older Arx's message, then deletes it. 404 = already gone, 403 = not ours (dropped, never retried), anything else is retried later.
  - Process-memory counter of refused directory pushes (`bridge_bad_signature` / `bridge_not_paired` only; clock and replay refusals do
    not count), reset by the next accepted push.
- `services/self_update.py`: the single door to the Supervisor allows `DELETE /discovery/{uuid}` with a 32-hex uuid only
  (`ha_client.delete_discovery`). `GET /discovery*` stays outside (Home Assistant only anyway).
- `services/bridge_install.announce_discovery`: posts when a fresh code waits and announcing is allowed, records the uuid and deletes the
  others; otherwise retires. Triggers: Arx start-up (also on the manual profile now - nothing is copied there), `POST /ha/bridge/install`,
  the WisKey installer step, `POST /system/wiskey-pairing/repair` (always called now; it decides), and **`GET /ha/bridge/pairing?regenerate=true`
  (newly announces)**. After a K-01 adoption by a rotation the next rotation-worker round (`bridge_rotation.worker_pass`, 60 s) deletes the
  message (`retire(sweep=False)`).
- Manual WisKey owner profile (decision for item 2b): the gate exists so that Arx installs nothing into Home Assistant there (no copy, no
  native bundle, no automatic-install flag). Delivering a new code to the EXISTING bridge entry through discovery installs nothing - it is
  the bridge's own K-02 re-pair path - so it is allowed once a bridge is known (`bridge.integration_version` recorded by a ping or a push,
  kept across a re-pair), at a re-pair and at start-up, never with `wiskey_auto_install`. Without a known bridge nothing is announced (a
  discovery would only offer a new integration the owner did not ask for) and the stale message is still deleted. No concrete reason was
  found for the gate to block the code delivery itself.
- "חיבור Arx ל-WisKey": the "גשר Arx" line shows `bridge_rejected` ("Arx דוחה את העדכונים... הגשר חותם בקוד צימוד אחר") or, after a
  re-pair, `bridge_rejected_after_repair` ("הקוד החדש לא הגיע לגשר"), each with its fix; the re-pair is offered for `bridge_rejected`.
  Facts: refused count / since / code, number of recorded messages, sweep done, discovery path open.
- Texts: the re-pair steps when announced say the existing bridge checks the code and takes it without a confirmation; Settings › "גשר
  Arx" says per case whether a new code is sent automatically (`announce_path`) and what happened after "אשר יצירה" (`announced`); no
  "Home Assistant" in the new texts.

### 3a. Rotation vs WisKey (analysis and the safe default implemented here)

The conflict, read in both code bases: WisKey (`trusted_actions/existing_bridge_auth.py`, `direct_bridge_origin.py`) verifies every
signature from Arx against `entry.data["pairing_code"]` of the loaded `smplwise_bridge` entry, with a kid-less v1 envelope. The bridge-key
rotation (CR-WISKEY-HMAC-ROTATION-295) moves the channel to `g1-...` keys, after which (a) Arx refuses to sign to WisKey with a rotated key
(`bridge_key_rotated`) and (b) the bridge blanks `pairing_code` in its entry once the old key is retired (keyset.py HA-06, so no retired
secret lingers in `core.config_entries`). Either alone disconnects WisKey; this is what broke WisKey <-> Arx in the lab before the re-pair.

Options:
1. Rotation off whenever WisKey is present, with a clear reason - safe, small, loses only the hygiene rotation where WisKey is used.
2. A warning before enabling it - not enough alone: the worker starts later rotations by itself, and the first one is one click.
3. Deliver the current key to WisKey - needs WisKey to accept a key id (kid-aware verification) or a provisioning path from the bridge;
   WisKey's `DIRECT_API_V1.md` says "the transport does not provision keys" and "`kid` is not a field in this v1 command envelope".
   Already requested from WisKey (WISKEY-PAIRING-2382 section 3); nothing to build on the Arx side until it exists.

Implemented: option 1 as the default, with the reason everywhere it is visible. `bridge_rotation.wiskey_present()` = the service feed
reported a WisKey version, OR `custom_components/hikvision_intercom` exists in Home Assistant's config directory, OR the manual WisKey owner
profile is there. While it is true no rotation starts - not by the administrator's click (`RotationRefused("wiskey_present")`, 409 with a
Hebrew message, audited as before), not by the worker (`auto_due`); the key card shows `blocked_by = wiskey_present` ("חסום כל עוד WisKey
מותקן", he/en/ar/ru) and `automatic = off`; "חיבור Arx ל-WisKey" shows the rotation line as `rotation_blocked_wiskey` (ok) instead of the
`rotation_risk` warning. A rotation already running is driven to its end (never cut in half). The `bridge.key_rotation` switch itself is
not rewritten. When WisKey verifies a kid, `wiskey_present()` becomes "WisKey present and not kid-aware" (a WisKey capability), and the block
lifts by itself. An installation whose key is already rotated keeps the existing fix: "צימוד מחדש" (rotation paused by default).

### Finding (reported, not changed)

`self_update._check_discovery` admits only `addon_url` / `pairing_code` with string values, so the automatic-install announcement
(`wiskey_auto_install: true`, WISKEY-ADOPT-2272) has never left Arx: it raised `ProbeRefused` out of `announce_discovery` (a 500 on a
re-pair with the switch on). Now it fails cleanly (`last_error = discovery:call_refused`). Whether the door should admit the flag is an
owner/lead decision (it would switch on an automatic-install path that has never run).

## 4. Limits

- An add-on cannot list messages. The recovery relies on the (add-on, service) identity rule above; a Supervisor that kept several
  messages for the same add-on and service would leave the older ones unknown to Arx (the 0.10.3 bridge still refuses their codes).
- A fresh, not yet applied code and a Home Assistant start while Arx is unreachable: the 0.10.3 bridge leaves the entry as it is
  (`cannot_connect`); the message stays and is applied at the next Home Assistant start or the next re-pair (an identical re-post is a
  Supervisor duplicate and is not pushed).
- The refused-push row lives in process memory: an Arx restart forgets it until the next refused push (the bridge pushes every 60 s).
- The bridge's push health also lives in memory (a Home Assistant restart starts it at `unknown`); the warning is in Home Assistant's log.
- `wiskey_present()` is a presence test, not a version test: a WisKey that later becomes kid-aware still blocks the rotation until the
  capability check above is added.

## 5. Owner procedure (Hebrew)

### א. התקנה שעדיין במצב התקול (השורה "גשר Arx" אדומה, עדכוני הגשר נדחים)

1. עדכנו את Arx ל־2.39.1. בעלייה Arx מטפל בעצמו בהודעת הגילוי הישנה: מוחק אותה, או מעדכן אותה לקוד הנוכחי כשהגשר כבר מוכר. אין מה ללחוץ.
2. ב־Arx: הגדרות › מתגי מסכי כניסה › "חיבור Arx ל־WisKey". אם השורה "גשר Arx" עדיין אדומה ("Arx דוחה את העדכונים"): לחצו "צימוד מחדש"
   והשאירו מסומן את "לכבות את החלפת מפתח הגשר".
   - אם כתוב שהקוד נשלח לגשר: המתינו דקה. השורה "גשר Arx" תהפוך לירוקה.
   - אם מוצגים קוד ושלבים: בתשתית המערכת › הגדרות › מכשירים ושירותים › SMPLWISE Bridge › מחיקה (רשמו קודם את האפשרויות שלה),
     ואז הוספת אינטגרציה › SMPLWISE Bridge עם הכתובת והקוד שמוצגים ב־Arx.
3. הפעילו מחדש את תשתית המערכת פעם אחת. אחרי ההפעלה השורה "גשר Arx" צריכה להישאר ירוקה (זו הבדיקה שהקוד הישן לא חזר).
4. לחצו "בדיקה מול WisKey" וודאו שהתוצאה "מצומד".

### ב. התקנה שכבר תוקנה ידנית (כמו המעבדה ב־04.11: הגשר נמחק והוסף מחדש עם הקוד החדש, העדכונים מתקבלים)

ההחלטה: **לא ללחוץ "צימוד מחדש"**. ההודעה הישנה עדיין יושבת בתשתית ותחזיר את הקוד הישן בהפעלה מחדש הבאה של תשתית המערכת, אבל
Arx 2.39.1 מטפל בה בעצמו בעלייה: כשהגשר מוכר ל־Arx והקוד הנוכחי עוד לא הוחלף במפתח מתחלף, הוא מעדכן את אותה הודעה לקוד הנוכחי
(הקוד שכבר נמצא בגשר - לגשר אין מה לשנות); אחרת הוא מוחק אותה. צימוד מחדש היה רק יוצר קוד חדש שצריך להגיע שוב לגשר - סיכון בלי תועלת.

1. **אל תפעילו מחדש את תשתית המערכת לפני ש־Arx 2.39.1 מותקן ועלה.** (עדכון Arx מפעיל מחדש רק את Arx, לא את התשתית.)
2. עדכנו את Arx ל־2.39.1 והמתינו שיעלה. אין מה ללחוץ.
3. ב־Arx: "חיבור Arx ל־WisKey" - השורה "גשר Arx" ירוקה, ו"בדיקה מול WisKey" נותנת "מצומד".
4. רק עכשיו מותר להפעיל מחדש את תשתית המערכת (כשנוח). אחרי ההפעלה בדקו שוב את שתי השורות. אם "גשר Arx" אדומה - סעיף א שלב 2.

הערה טכנית: אם בהוספה הידנית הוקלדה לגשר כתובת אחרת מכתובת ברירת המחדל של Arx, ההודעה המעודכנת תחליף בגשר את הכתובת לכתובת
של Arx ותטען מחדש את רשומת הגשר (לא את התשתית). הקוד לא משתנה.

### ג. בשני המקרים, בהתקנה ידנית של WisKey

Arx לא מעתיק את הגשר בהתקנה ידנית. כשנוח, העתיקו את `custom_components/smplwise_bridge` בגרסה 0.10.3 מחבילת הגרסה והפעילו מחדש את
תשתית המערכת. זו שכבת הגנה נוספת (הגשר מסרב לקוד שלא מאומת מול Arx, ורושם אזהרה ביומן כש־Arx דוחה את העדכונים שלו); התיקון של Arx עובד
גם בלעדיה.

### ד. החלפת מפתח הגשר

מ־2.39.1 Arx לא מתחיל החלפת מפתח גשר כל עוד WisKey מותקן (לא בלחיצה ולא אוטומטית); בכרטיס מפתח הגשר מופיע "חסום כל עוד WisKey מותקן".
אין צורך לכבות דבר. ההחלפה תחזור כש־WisKey יידע לאמת מפתח מתחלף.

## 6. Tests

- `smplwise_vms/backend/tests/test_bridge_stale_discovery_2383.py` (new): the bridge's REAL config flow under a minimal Home Assistant stub
  (first install unchanged, stale code refused without update or reload and without a code in the log, current code applied, no-change
  short cut, unreachable / ignored, replay with stale + new messages in both orders, the K-02 mechanism); a fake Supervisor with the real
  identity / delete rules against Arx (uuid recorded, re-pair updates in place, K-01 deletion in the worker round, one-time recovery of an
  older Arx's message with a foreign add-on's message untouched, the lab state on a manual profile end to end through the real Arx app,
  manual profile without a known bridge, repair announced on a manual profile, failed / gone / forbidden deletes, a store that keeps every
  post, no token, backup keep-list, the automatic-install finding); the allow-list and answer mapping; the diagnostics rows; the bridge's
  push health (one warning with the fix, hourly reminder, recovery line) and its diagnostics without secrets; no rotation (click, worker,
  route) while WisKey is present by component directory or by the service feed, and the pairing block's rotation line.
- Updated: version pins 0.10.2 -> 0.10.3 (15 files), `test_self_update_s3` allow-list, the two K-01 harness tests (the only post left
  after a rotation is the one-time, code-free recovery post).
- Frontend: `tests/unit-bridge-stale-discovery-2383.spec.ts` (node only), `tsc --noEmit`.

## 7. Rollback

Revert the branch commits. The two new settings rows are ignored by an older Arx; a bridge 0.10.3 entry keeps working with an older Arx
(the ping it sends is the existing one).

## 8. Release gate receipt (2.39.1)

Gate 2 of `2affd5834` (fast tier, 67 min): one failure, `tests/test_fake_doorwin_closed_rule_sr1.py::test_program_writes_are_pinned`, and
it fails on main v2.39.0 as well. The SR-1 pin of door-program write sites did not list the four sites WISKEY-DOOR-TECH-2390 added in
2.39.0 (`wiskey_door_tech.py` sends `technical_program_save` / `_action`; `wiskey_channels.py` lists them in the closed `door_technical`
guard). Reviewed by the lead against SR-1: an administrator's confirmed, audited, single-shot action from the stations drawer, no
Arx timer, neither module timer-shaped; the pin now lists them (test-only change). The 2.39.0 gates did not select this whole-package
scanner test (a selection miss, which the nightly full tier on main covers).
