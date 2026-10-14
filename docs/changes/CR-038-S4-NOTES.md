# CR-038 slice 4 - contacts, handler links, the public handler page: implementation notes

Branch `pilot/TICKETS-s4`, cut from `origin/pilot/TICKETS-s1` (02f6a57a); merged `origin/pilot/TICKETS-public-core` (fdd48aa3, final)
and `origin/pilot/TICKETS-s2` (45208163, which carries s1 11f21002). Spec: `docs/changes/CR-038-TICKETS-MODULE.md` section 20 row 4,
with sections 7.2, 8, 9.7, 10.1-10.7, 11.2, 14.1-14.2, 15.1-15.2, 17 and decisions D3, D5, D6, D12, D14, D16, D23, D25, D26, D33;
the code review's wiring checklist (W1-W22) and the public-core notes' wiring items. Migration **0080** (0081 is slice 5b's, 0082
slice 5a's). Owner decision of 2026-10-14 (the Hebrew name "בקשת שירות"): every text of this slice is tokenised or uses the new
words; none writes the old ones.

## 1. What slice 4 delivers

**Directory of people who are not users** (`ticket_contacts`, `ticket_contact_departments`; `services/tickets/contacts.py`,
`routers/tickets_contacts.py`). Persons and vendors (a person may work for a vendor). Create / edit / erase / export need
`tickets.configure` (installation scope, audited); the list is readable by `tickets.configure` or by the managers of the departments a
contact is allowed in, with the FULL phone / e-mail only for `tickets.configure` or `tickets.external` holders (others see the last
four digits). Phones are stored as E.164 digits plus a keyed match index (`phone_key` = HMAC under the module key, `phone_key_id`).
A row that names an internal user can never receive a link (409 `assignee_not_allowed`, Q4 / D16). A phone / e-mail change revokes
the contact's live links at once (`contact_changed`, the ticket waits for its manager); erase writes a tombstone, revokes the links
and can rewrite the frozen names in the history; export returns the row and what the person wrote through links (15.2).

**Sending a ticket outside** (`services/tickets/external.py`; `POST /tickets/{id}/assign {assignee: {kind: contact}}`,
`POST /tickets/{id}/assign/preview`). Gates in order, all before any write: manager rights AND `tickets.external` (audited 403s);
the handler page ready (`access.public_ready`: add-on option `tickets_public`, its listener, a public address - else 409
`public_link_unavailable`); the contact allowed; "require a code" raise-only (contact OR vendor OR the assignment); the D6
code-channel rule; "share the device history" only where a snapshot exists and never for lock / alarm panel / cover / camera
(422 `share_history: not_allowed`). Then: the current assignment ends (`reassigned`) and its link is revoked; a contact assignment
(channel `manual`); a link (generation 1) minted under the current module key; timeline and audit rows; the SLA dues recomputed
(slice 2's `sla.refresh`); the dispatcher is asked to prepare the message - in slice 4 nothing is queued or sent.

**Handler links** (`ticket_links` + sessions, codes, failures, access log, redeem ids; `services/tickets/handler_links.py`,
`store_links.py`). The token is derived (`links.derive_token(key, id, generation)`), stored only as `token_hash`. D5 durations come
from slice 2's `policy.resolve` (installation values with department overrides): first expiry = min(cap, now + max(sliding,
resolve window + 1 day)); the expiry slides on the handler's actions, a resend and a reminder - never on an open; close / cancel
gives the read-only grace (grace 0 revokes); reassign / return / "not mine" / manual / key rotation / contact change / erase revoke
at once; reopen kills a grace link. A LOWER cap (installation or department) pulls live links in, counted from the start of the
link's current generation (`generation_at`). `sent_at` / `sent_via` record when and how the current generation first left
(`mark_sent`; an e-mail send stays `email` - D6).

**The manager's link actions** (`POST /tickets/{id}/link/copy|new|revoke|resend`): copy returns the URL once (`no-store`, audited
without the URL; marks `manual`); new = a new generation under the current key (old token, sessions and codes dead, the failure
window clean, the running listener's per-recipient code count forgotten); revoke at once; resend = 409 `channel_unavailable` until
5b. The ticket detail carries a `link` block for managers only (state, expiry or grace, opens, devices, updates, code lock, `can`) -
never the token or the URL.

**The public routes over the real store** (`services/tickets/public_store.py`, `handler_actions.py`, `public_routes.py`): the
public-core ports implemented on SQLite - `SqlLinkStore` (ONE indexed statement in every state, W1; `fold()` decides revoked /
grace / expiry, W2), `SqlRedeemStore` (one `UPDATE ... RETURNING`, W4), `SqlRequestLog` / claim + finish inside the effect's
transaction (W5), `SqlCodeStore` (replace + compare-and-set consume, generation-scoped, W7 / W8), `NoCodeChannel` (code send 503
until 5b / 7), `SqlPhotoSink` (attachment + timeline + audit + request row in ONE transaction; opens only this ticket's visible
photos, W10). Writes: status (the link row of `model.STATUS_MOVES`), note, ETA, return ("not mine" / "cannot handle" with a
required reason - revokes at once), photo; each re-reads the link inside the transaction (a link that stopped serving is the uniform
404; the grace is 409 `read_only`), claims the request id (scope `link:<id>:<generation>`), writes the effect, slides the expiry,
spends the write budget only for a stored effect (W18), recomputes the SLA dues.

**The handler page** (`frontend/public-ticket.html`, `src/public-ticket/`; built to `smplwise_vms/www-public/`, OUTSIDE `www/`, W16).
Vanilla TypeScript, text-node-only DOM (no innerHTML, no link is ever built - W20), no inline script or style, no `data:` URLs (the
listener's CSP), 17 KB of script + 2.5 KB of style gzipped (budget 60 KB). Four languages (he / en / ar / ru; RTL for Hebrew and
Arabic; the contact's language, a picker, and before any ticket answers the stored choice or the browser's language); the module
name from the server's `labels` with gender agreement (D33). Screens: the page (status buttons, ETA chips in the building's time zone,
note, photos from the camera or the gallery, the timeline), the code screen, the read-only grace ("closed, thank you" + until when),
"not mine" with its required reason and the confirmation from the answer itself, the uniform "unavailable", the redeem screen, the
finished screen. The token arrives in the fragment, leaves the address bar at once and lives in this tab only; an update keeps its
request ids until confirmed (a retry is the same request).

**The listener's wiring** (`services/tickets/public_runtime.py`, `main.py`, `config.py`, `config.yaml`): add-on option `tickets_public`
(off by default; port 18093/tcp declared and unmapped - the tunnel reaches it), started in its own thread only with the option on,
stopped at shutdown; the janitor refreshes the module switch, flushes counters, prunes codes / sessions / access rows and retires
unreferenced keys; `PUT /settings` of `tickets.enabled` switches it at once; trusted proxies and the client-address header follow a
settings change without a restart (W13); `GET /tickets/health` (system.configure); `POST /tickets/address/probe` (local only,
6 / minute, SSRF-safe, reports whether the listener saw the probe's nonce and whether the proxy header arrived - never the body,
W21); `POST /tickets/key/rotate` (confirm; every live link revoked and every phone key re-derived in one transaction).
The Dockerfile copies `www-public` and names it in `SW_WWW_PUBLIC_DIR`; `npm run build:addon` builds both bundles; the release checker
refuses an add-on tree without `www-public`.

**Internal screens**: Settings › the module › "ספקים ואנשי קשר" (`tickets/contacts-directory.ts`), the "דף המטפלים" card on the
general tab (`tickets/public-settings.ts`; the link lifetime card is slice 2's), the assign dialog's user / contact / vendor switch
with the contact picker, require-code, share-history, the outgoing text and every refusal (`tickets/external-assign.ts`), the link
panel in the handler block (`tickets/link-panel.ts`), timeline lines for the link events. API in `api/tickets-s4.ts` (+ demo store).

## 2. Deviations and decisions (recorded, not silently resolved)

1. **Code hash includes the generation** (public-core final) - differs from spec 7.2's HMAC(k, link | code).
2. **`tickets/` is a restorable root** (spec / wiring item 8) although ticket tables are not project tables today: inert, documented;
   `secrets/` is refused by name in `backup.restorable` (W11).
3. **Module key creation** only on the module-on paths (the settings switch, start-up with the module on), never on a request path,
   and never while a row depends on a missing key (W12). Rotation stages a key, rewrites every dependent row in one transaction, then
   commits; the janitor retires a key no live row names.
4. **No message channel in slice 4**: `DISPATCH = ManualDispatch()` (channel `manual`, the manager copies the link); `resend` is 409
   `channel_unavailable`; a code-protected assignment is refused with 409 `code_channel_unavailable` (D6: no channel can carry the
   code) - 5b / 7 replace both seams.
5. **New `ticket_links` columns `generation_at`, `sent_at`** (beyond the public-core list): the cap base of a new generation and the
   send time slice 6's "link not opened" needs.
6. **The handler's writes and the external assignment call `sla.refresh`** (slice 2's "dues at every change").
7. **Key rotation has an API, not a screen** (system.configure + confirm); a Settings button is a follow-up.
8. **Hebrew grammar with the new name**: my texts avoid "ה" + token (the two-word name would read "הבקשת שירות"); slices 1-2 still have
   such texts (e.g. `text.ts` `cancelTicket`, `access.py` "ה{ticket} לא נמצאה", `service.py`) - see section 6.

## 3. Wiring-trap checklist (W1-W22)

| # | Status here | Where |
|---|---|---|
| W1 | one statement on the token-hash index in every state (`EXPLAIN QUERY PLAN`) | `test_tickets_s4_wiring.py::test_w1_*` |
| W2 | revoked folds assignment end / move-on, grace, closed without grace, purge | `test_w2_*` (4 tests) |
| W3 | switch refreshed at `PUT /settings` and in the janitor; closed until the first refresh | `test_w3_*` |
| W4 | redeem release one `UPDATE ... RETURNING`, 3 uses under concurrency | `test_w4_*` |
| W5 | crash inside the photo / write transaction leaves nothing (real SQLite) | `test_w5_*` |
| W6 | port writes are one short transaction; the image is stored before `record` | public-core tests + `SqlPhotoSink` |
| W7 | new code ends the older; consume compare-and-set | `test_w7_*` |
| W8 | old-generation code never verifies | `test_w8_*` |
| W9 | digits never stored | `test_w9_*` |
| W10 / W19 | only this ticket's visible photos, confined paths | `test_w10_w19_*`, public tests |
| W11 | disjoint backup roots, `secrets/` never restored | `test_w11_*` |
| W12 | lost key never replaced while rows depend on it; only module-on paths mint | `test_w12_*` (2 tests) |
| W13 | client-address header validated and applied live; proxies live | `test_w13_*`, `test_tickets_s4_assign.py` |
| W14 / W15 | listener in a worker thread, own limiter scope, guarded janitor | `test_w14_*` |
| W16 | shell from `www-public`, the main app serves no public route | `test_w16_*`, `unit-public-ticket.spec.ts` |
| W17 | no Body / Form / File / UploadFile in the slice-4 public modules | `test_w17_*` |
| W18 | budget spent by stored effects only | `test_tickets_s4_public.py::test_the_write_budget_is_spent_by_stored_effects_only` |
| W20 | no link built, text-node DOM; Playwright: a typed URL stays text, no `<a>` | `unit-public-ticket.spec.ts`, `evidence-public-ticket.spec.ts` |
| W21 | probe refuses private targets, never shows the body, local only, rate-limited | `test_w21_*` (3 tests) |
| W22 | install guide (port unmapped, Cloudflare rules, Rocket Loader off) | slice 8 |

## 4. Tests

Backend (local, Windows, Python 3.12): `test_tickets_s4_public.py` 24, `test_tickets_s4_directory.py` 38, `test_tickets_s4_assign.py`
35, `test_tickets_s4_wiring.py` 38, plus `test_tickets_s2.py`, `test_tickets_admin.py`, `test_release_check.py` after the slice-2 merge -
all passed. The full backend suite runs on the runner (see the final report). Frontend: `tsc --noEmit` clean; unit specs
(`unit-public-ticket`, `unit-tickets-naming`, `unit-tickets-durations`) passed; `evidence-public-ticket.spec.ts` (8) and
`evidence-tickets-s4.spec.ts` (10) passed with `playwright.public.config.ts` - no server at all (the built bundles are served by route
interception; the handler page under the listener's real CSP, any CSP violation or horizontal overflow fails). Images:
`docs/design/evidence/tickets-s4/` (handler page he / en / ar / ru, desktop wrapper and phone, light / dark, every state; the internal
screens in classic / domus, light / dark).

## 5. For the next slices

- **5b (messages)**: replace `external.DISPATCH` (`LinkDispatch`: `channel`, `queue` inside the caller's transaction, `code_ready`) and
  the public app's code channel (`public_store.NoCodeChannel` -> a `CodeSender` over the outbox; `send(link, code_id, channel)` never
  takes digits, W9). When a link message is accepted call `handler_links.mark_sent(conn, link_id, via, at)`; resend calls
  `handler_links.extend`. Turn `link_block(...)["can"]["resend"]` on. STARTERS in `external.py` are placeholders for 5b's templates.
- **6 (SLA monitor)**: "link not opened" = `sent_at` set and (`last_opened_at` is null or < `sent_at`); `notify_bridge.contact_changed`
  is the hook for `ticket.contact_changed`.
- **7 (codes)**: the code tables / failures / sessions are generation-scoped; `external._reset_codes` shows the in-transaction reset.
- **9**: `public_runtime.RUNTIME` (ready / missing / health), `store_links` for any new link query; tokens only through
  `links.derive_token` + `KEYS.get(key_id)`.

## 6. Owner rename (2026-10-14) - texts

None of this slice's visible texts contains "קריאה / קריאות / קריאת". Still present elsewhere (not this slice's): the server default
name (`services/tickets/naming.py` DEFAULTS, `frontend/src/tickets/naming.ts` DEFAULT_TICKET_NAMES); the test mock's default name and
the role name "ניהול קריאות" (`frontend/tests/tickets-mocks.ts`); slices 1-2 texts with "ה" + token (render as "הבקשת שירות").

## 7. Security notes

- Token-authorised media: `GET /t/api/photo/<id>` answers only this link's ticket's photos marked for the handler, re-encoded,
  `no-store`; the page shows them through `blob:` URLs (CSP `img-src 'self' blob:`).
- The copy route's answer is the only place a URL appears; it is never audited or logged, `Cache-Control: no-store`.
- Unverified here: a real Cloudflare tunnel in front of the listener, the Linux add-on runtime (PIL decoders, `RETURNING` on the image's
  SQLite), photo uploads from real phones (HEIC refused, EXIF stripped by re-encoding).
