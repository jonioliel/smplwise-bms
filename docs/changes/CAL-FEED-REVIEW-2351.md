# CAL-FEED-REVIEW-2351 - security review of the outgoing iCal feed (contract 15.6 / 15.11)

Branch `sec/CAL-FEED-REVIEW-2351` from `release/2350-train` (1993a207d). Scope: `GET /api/v1/calendar/feed/{token}.ics` (CALCONNECT-2330,
2.33.0) - the only calendar route that answers without a signed-in person - and its management routes `/calendar/feeds*`. 2.33.1 put the
document on `remote_channel.BLOCKED_ON_REMOTE` until this review. No version bump. The owner decided the remote exposure on 02.11 (round 14,
section 6); the screen and the server follow those answers.

Code: `smplwise_vms/backend/smplwise/routers/calendar_feeds.py`, `remote_channel.py` (`ROUTE_GATED_ON_REMOTE`), `services/calendar/model.py`
(three settings), migration `0193_calendar_feed_review.sql` (two columns; built as 0192, re-sequenced to 0193 on the 2.36.0 train after
`0192_ha_labels.sql`; WisKey, not merged, must move to 0194+). Round 14 adds no migration. Tests:
`smplwise_vms/backend/tests/test_calendar_feed_review_2351.py`; screen: `frontend/src/calendars/connect-dialogs.ts`, `connect-model.ts`,
`frontend/src/screens/system-calendars.ts`; `frontend/tests/unit-calendars-feed-remote-2351.spec.ts`, `evidence-calendars-connect-2330.spec.ts`.

## 1. Threat model

| Asset | Where it could leak | Adversary |
|---|---|---|
| Entry times of the selected calendars (always), titles (`detail = titles`) | the feed document | anyone who holds or guesses the address |
| Notes, organisers, on-behalf labels, rooms, attendees (2.35.0: users, residents, guests with sealed name / phone / e-mail, counts) | a careless renderer | same |
| The token (the address IS the credential) | access log, DB-connection labels, audit rows, API answers, caches, Referer | log readers, support bundles, proxies |
| Availability of the add-on | an unauthenticated route that renders up to thousands of entries | anyone who can reach the port or the tunnel |
| Authority drift | a feed that outlives its creator's rights | an ex-employee, a demoted manager |

Entry points: the LAN / Ingress port (as before) and - only if the owner switches it on per feed - the remote channel (Cloudflare tunnel,
`/arx/...`). Out of scope: the subscriber side (Google / Outlook / a phone store the address; Arx cannot protect it there - rotate / revoke
is the answer), iCal IN (CALCONNECT-2330 already guards its fetch), the remote sign-in itself (CR-008).

Non-issues confirmed: **CSRF** - the document is a GET that changes nothing but `last_used_at` and reads no cookie or session (the
management routes are cookie-session routes behind the existing remote CSRF gate). **CORS** - no `Access-Control-Allow-*` header is ever
sent, so a page on another origin cannot read the document (asserted in the tests). **Timing on the lookup** - the token is 256 random
bits and the database is searched by its SHA-256; a timing side channel on a hash prefix gives nothing usable. The fetched hash is
nevertheless re-compared with `hmac.compare_digest` (defence in depth).

## 2. Findings

| # | Finding | Severity | Fix | Test (`test_calendar_feed_review_2351.py`) |
|---|---|---|---|---|
| F1 | Token design: 32 random bytes (`token_urlsafe`), SHA-256 stored, shown once, rotate / revoke immediate - **sound**; but no token issue time, so no age limit was possible | Info | `token_set_at` column (create / rotate); answers carry `token_set_at` and `expires_at` | `test_token_is_256_bit_hashed_shown_once_and_rotation_restarts_its_age` |
| F2 | Nothing personal leaves: the renderer reads only start / end / title. No regression guard existed for the 2.35.0 attendees (users, residents, guests with sealed contacts) | Info (guard) | Renderer documented as never reading `cal_attendees` / `cal_guest_details`; the SELECT narrowed to the columns used | `test_attendees_guests_notes_and_labels_never_reach_either_detail_level` - both levels, property allow-list, no names / phones / e-mail / counts / notes / labels / rooms / organiser |
| F3 | ICS escaping removed C0 controls only: DEL, C1 (U+0085 NEL), U+2028 / U+2029 passed; titles not capped in the feed (imported / legacy rows are not trusted) | Low | `_esc` drops C0, DEL, C1, U+2028/2029, BOM; escapes `\ ; ,`; caps at 200 characters; folding on octets unchanged | `test_titles_cannot_inject_lines_or_properties_and_are_capped` |
| F4 | Size: 5000 entries but no byte cap | Low | `MAX_DOC_BYTES` (2 MB): the document stops at the last whole entry and stays valid | `test_the_document_is_capped_in_bytes_and_stays_valid` |
| F5 | Rate limiting only per token and only AFTER a successful lookup: unknown-token guessing was unlimited (a database read per request), and the contract (13.5) says "per token and IP" | Medium | Per-client-address budget (`feed_address_rate_per_min`, default 120) counted BEFORE format / lookup, so a miss costs the same as a hit and 404 / 429 tell nothing about validity; per-feed budget now the setting `feed_rate_per_min` (default 30). Remote: the address is `CF-Connecting-IP` | `test_per_address_budget_counts_misses_before_the_lookup_and_per_feed_budget_holds` |
| F6 | Authority drift: a feed kept publishing after its creator was deactivated, lost `calendar.connect`, lost `edit` in a calendar | **High** | `_creator_calendars`: at every request the creator must exist, be active and not disabled, hold `calendar.connect`, and hold `edit`+ in each calendar (not archived); calendars that fail drop out; none left = the uniform 404 | `test_a_feed_follows_its_creators_current_authority` |
| F7 | No expiry: an address leaked to a subscriber worked forever | Medium | Round 14 (3C): every address gets its own expiry when it is issued (create / rotate = "renew link") from the setting `feed_max_age_days` (default 365, 0 = no limit, up to 3650); past it the uniform 404 until renewed. Addresses issued before round 14 keep no expiry; a later change of the setting never shortens an address already out | F1 test; `test_round14_new_links_get_the_default_expiry_and_a_setting_change_never_shortens_an_issued_one`, `test_round14_existing_links_keep_their_expiry` |
| F8 | Caching: `private, max-age=300` let a client / proxy keep serving a revoked feed for 5 min; no `Referrer-Policy` | Low | `Cache-Control: private, no-store`, `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex, nofollow`, `nosniff`; no cookie, no CORS | `test_document_headers` |
| F9 | **Token in logs**: uvicorn's access line records the full path (= the token) in the add-on log; the request's DB-connection label (slow-hold / busy log lines, lock statistics) also carried the full path | **High** | `RedactFeedToken` log filter on `uvicorn.access`, `uvicorn.error`, `smplwise` (`/calendar/feed/REDACTED`); the document's own read connection with a token-free label | `test_access_log_lines_are_redacted_and_the_connection_label_has_no_token` |
| F10 | Hash compare by SQL equality only | Info | `hmac.compare_digest` after the indexed lookup | `test_the_stored_hash_is_compared_in_constant_time` |
| F11 | Remote exposure was all-or-nothing (blocked at the edge) | Design | Per-feed `remote_enabled` (default 0). Round 14: ON needs an administrator or the creator holding `manage` in every calendar of the feed (OFF: creator or admin); while ON the document is busy-only on every channel (`test_round14_*`). The edge (`ROUTE_GATED_ON_REMOTE`) passes only an exact `GET /api/v1/calendar/feed/<43 chars>.ics`; every other method / shape stays edge-blocked; the route answers the uniform 404 unless that feed's switch is on. `PUT /calendar/feeds/{id}/remote {enabled}`: creator or admin, LOCAL session only (403 `local_only` remotely), feed live, audited `calendar.feed.remote`; revoke clears it | `test_remote_is_off_by_default_switched_per_feed_from_a_local_session_and_audited`, `test_edge_gate_shape`, `test_migration_0193_columns`; `test_remote_access.py` unchanged and green |
| F12 | Audit: create / rotate / revoke audited with ids only, the token never in an audit row - **sound**; document reads are not audited (volume) - `last_used_at` (10-minute granularity) is the trace | Info | the remote switch is audited (F11) | F1 + F11 tests |

## 3. Residual risks

1. The address is a bearer credential: whoever holds it reads the feed. Subscriber apps (Google, Outlook, phones) store it outside Arx;
   Google fetches from its own servers, so a remote-enabled feed subscribed in Google is readable by Google. Mitigation: `busy` by default,
   rotate / revoke, the optional age limit.
2. `titles` publishes entry titles, which people may write personal data into ("פגישה עם ..."). It is the creator's explicit choice per
   feed; the UI hint should say so.
3. On the remote channel the per-address budget trusts `CF-Connecting-IP` (set by the tunnel). If the remote port were reachable without the
   tunnel, the header could be forged; the per-feed budget and the 256-bit token still hold.
4. Rate-limit buckets are in memory (reset on restart; one process). Acceptable for a read-only document.
5. Document reads are not individually audited; `last_used_at` only.
6. ~~No screen for the remote switch yet~~ - round 14: the toggle is in "פידים יוצאים" (section 6).
7. The per-address expiry lives in the settings row `calendar.feed_expiry` (JSON `{feed id: ISO instant | null}`), not in a cal_feeds
   column, so round 14 needs no migration. It is written in the same transaction as the feed row; a revoked feed's entry is dropped;
   an unreadable entry fails closed (expired). A later migration on cal_feeds may fold it into a column.

## 4. Proposal: exposing a feed on the remote channel (NOT enabled)

Implemented but OFF: every existing and new feed has `remote_enabled = 0`, so the tunnel answers 404 exactly as 2.33.1 did. Conditions this
review attaches to switching a feed on:
- only from a local session, by the feed's creator or an administrator; audited;
- recommended: `detail = busy`, and `feed_max_age_days` set (e.g. 180) so a leaked address dies on its own;
- the creator's authority is re-checked on every request (F6) and the token never reaches a log (F9);
- revoke clears the switch; rotate keeps it (the new address replaces the old for the same subscribers).

## 5. Owner decision needed - סיכום בעברית

סקירת האבטחה של פיד היומן היוצא הושלמה. נמצאו ותוקנו שתי בעיות חמורות: (1) כתובת הפיד הסודית נרשמה ביומן הגישה של התוסף - עכשיו
היא מוסתרת; (2) פיד המשיך לפרסם גם אחרי שהיוצר שלו הושבת או איבד הרשאת עריכה - עכשיו ההרשאה נבדקת בכל בקשה. בנוסף: הגבלת קצב לפי
כתובת גם לניסיונות ניחוש, אפשרות לתוקף לכתובת, ניקוי תווים מסוכנים בכותרות, תקרת גודל, ובלי שמירה במטמון. נבדק שמשתתפים, אורחים,
טלפונים, מיילים והערות לא יוצאים אף פעם בפיד.

נבנתה אפשרות לפתוח פיד מסוים לגישה מרחוק - **כבויה כברירת מחדל**, לכל פיד בנפרד, ורק מגישה מקומית. כרגע אין לה מסך.

1. לאפשר בכלל פתיחת פיד לגישה מרחוק?
   א. כן, לכל פיד בנפרד (כמו שנבנה) ב. לא, להשאיר חסום לגמרי
2. אם כן - להוסיף מתג במסך "פידים יוצאים"?
   א. כן ב. לא, רק דרך מנהל המערכת
3. תוקף ברירת מחדל לכתובת פיד?
   א. ללא הגבלה (כמו היום) ב. 180 יום ג. 365 יום
4. לחייב "תפוס בלבד" בפיד שנפתח מרחוק?
   א. כן ב. לא, היוצר בוחר

## 6. Owner decisions, round 14 (02.11 evening) - implemented

Answers: 1A, 2A, 3C plus "allow changing it in the settings", 4A.

| # | Decision | Server | Screen |
|---|---|---|---|
| 1A | Allow opening a feed for remote access, per feed | `PUT /calendar/feeds/{id}/remote` as built (default off) | - |
| 2A | A toggle next to each feed in "פידים יוצאים", only for people who manage that calendar; turning it on asks for a confirmation that names the consequence | ON: an administrator, or the feed's creator holding `manage` in EVERY calendar of the feed; OFF: the creator or an administrator (less exposure). Local session only, unchanged (403 `local_only`). `GET /calendar/feeds` answers `can_remote` per feed and `local` | "מבחוץ" toggle per feed only when `can_remote`; ON opens an in-dialog confirmation ("הקישור של הפיד יעבוד גם מחוץ לרשת של הבניין ..."), "ביטול" leaves it off; OFF applies at once |
| 2A (rule) | Keep the local-only rule; if it makes the toggle unusable from the normal UI, explain it in Hebrew | Kept. The normal UI (the local address and the Ingress panel) is a local session for the server, so the toggle works there; only the Arx remote channel (`/arx/`) refuses. Note: the Ingress panel counts as local even when the panel itself is opened from outside through the platform's own remote access - the rule is "not through the Arx tunnel", not "physically inside the building" | On the remote channel the toggle is locked and a note says why ("... אפשרית רק מתוך הרשת של הבניין. נכנסת עכשיו מרחוק ...") |
| 3C | Default link expiry 365 days as an installation setting (90 / 180 / 365 / no limit); existing feeds keep their expiry; new links get the default; expiry and "renew link" next to each feed | `feed_max_age_days` default 365 (0 = no limit). Each address gets its expiry when issued (create / rotate), kept in `calendar.feed_expiry`; existing addresses have none; a setting change applies to new and renewed links only | הגדרות › יומנים › התנהגות › סנכרון ופרטיות: "תוקף קישור של פיד יוצא" 90 / 180 / 365 / ללא הגבלה. Per feed: "בתוקף עד dd.mm.yyyy" / "ללא תאריך תפוגה" / expired; the rotate button is now "חידוש קישור" (a new address with the current default; the old one stops) |
| 4A | A feed open for remote access is always busy-only, enforced on the server | While `remote_enabled` is on the document renders busy-only on EVERY channel (the same token serves both), whatever `detail` says; answers carry `detail_effective`; switching off restores the feed's own choice | The chip reads '"תפוס" בלבד · פתוח מבחוץ'; the confirmation says so |

Notes for the lead:
- The toggle permission is narrower than the round-1 build (creator or admin): a creator who holds only `edit` in one of the feed's
  calendars no longer may switch it ON (he still may switch it OFF or revoke).
- "Renew link" is the existing rotate: it changes the address (subscribers must take the new one). No "extend the expiry and keep the
  address" action was added - it would keep a possibly leaked address alive.
- After switching a feed on, the address to give an outside subscriber is the remote address of the installation with the same
  `/api/v1/calendar/feed/<token>.ics` ending; the token is shown only when it is issued, so a feed switched on later may need "חידוש קישור".
- The behaviour tab gains one row in the "סנכרון ופרטיות" group: the settings screen's pixel baselines may need a refresh on the runner.
