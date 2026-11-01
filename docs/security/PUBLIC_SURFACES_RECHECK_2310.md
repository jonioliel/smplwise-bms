# Public surfaces re-check before document links (`reports.documents`) - PUBSURF-2310

## סיכום קצר לבעלים (עברית)

1. **לא נעשתה סקירה חדשה מאפס.** עברנו על כל הממצאים של סקירת Fable מ-21.10 (36 ממצאים), סקירת קישורי המסמכים מ-23.10 (9 ממצאים)
   וסקירת דוח הטמפרטורה (ענף נפרד, 6 ממצאים), ובדקנו כל אחד מול הקוד של main היום ומול הבדיקות שרצו בפועל.
2. **מצב סקירת 21.10:** 18 תוקנו, 17 התקבלו כסיכון מקובל או שהם הערות מידע שעדיין נכונות, 1 פתוח (P-02: אין רישום ביומן כשמשתמש
   "מפתחות גישה בלבד" חוזר בשקט לסיסמה; נמוך, לא קשור לקישורי מסמכים).
3. **מצב סקירת המסמכים 23.10:** 4 תוקנו (אחד מהם, L-04, תוקן בענף הזה), 5 התקבלו. אין ממצא פתוח בקוד.
4. **תוקנו בענף הזה (בדיקה נכשלת קודם, אחר כך תיקון):** (א) לא נוצר קישור מסמך כשמודול הקריאות כבוי; (ב) תשובות המסמך אומרות
   במפורש ל-Cloudflare "אל תשמור" (חגורה נוספת בלבד - לא מחליפה את הבדיקה החיה).
5. **פסק דין: כן, בתנאים.** מותר להפעיל `reports.documents` אחרי מיזוג הענף הזה רק אם: (1) בדקת בעצמך את כלל ה-Cloudflare (הבדיקה
   המדויקת בסעיף 5); (2) ענף דוח הטמפרטורה (TEMPREPORT-2310) מוזג קודם, כי ב-main היום קובץ ה-PDF שיוצא בקישור כולל שמות אנשי צוות
   וסיבות תחזוקה; (3) הבדיקות עוברות בשער הגרסה; (4) `reports.email` נשאר כבוי. פירוט בסעיף 6.

## 0. Scope, sources and method

Owner task 2026-10-31: re-check the public surfaces before `reports.documents` (OFF) is switched on. Base: `origin/main` = v2.29.0
(`72c06e88e`). Branch `chore/PUBSURF-2310`. Nothing live was touched: no Cloudflare, no tunnel, no Home Assistant, no phone, no WhatsApp.

De-duplicated against the reviews that already exist (nothing is re-reviewed from scratch):

| Source | Where | Findings |
|---|---|---|
| R1 - Fable review of the public surfaces, HMAC rotation, door automation, passkeys-only | `docs/security/FABLE_REVIEW_REPORT_2026-10-21.md` (package `FABLE_REVIEW_PACKAGE_2026-10-20.md`, `02a252636`) | 36 (D-01..D-14, R-01, H-01..H-09, A-01..A-10 without A-08, P-01..P-03) |
| R2 - security review of the public document links | `private/planning/SECURITY_REVIEW_DOCLINKS_2026-10-23.md` (not in Git; summary in `DOCLINKS_CLOUDFLARE_CACHE_RULE.md` and commits `be4b831d7`, `651c7c09a`) | 9 (M-01, M-02, L-01..L-04, I-01..I-03) + preconditions P1..P7 |
| R3 - TEMPREPORT-2310 review | `docs/security/REVIEW_TEMPREPORT_2310.md` on `origin/pilot/TEMPREPORT-2310` (`e979998b9`), **not on main** | 6 (S1..S6) |
| Package residuals | `FABLE_REVIEW_PACKAGE_2026-10-20.md` section 5 | PUB-01..PUB-12 |

`private/planning/FABLE_REVIEW_3_2026-10-21.md` (review 3) covers the WisKey door path and the bridge activation, not the public listener; it
is not re-traced here.

Method: every status below was established by reading the code (file:line at `72c06e88e`; this branch shifts `out_documents.py` lines after
`config()` by six) and, where a test is named, by running that test file on the workstation (section 7). Commit messages were used only to find the
code. "Fixed" = the code closes the finding and a named test pins it. "Accepted" = by design / owner decision / an info item that still
holds. "Open" = still present.

Paths are relative to `smplwise_vms/backend/smplwise/` unless they start with `frontend/`, `docs/` or `tests/` (= `smplwise_vms/backend/tests/`).

## 1. Counts

| Review | Fixed | Open | Accepted / holds |
|---|---|---|---|
| R1 public-surface findings (D-01..D-14, R-01, P-01..P-03) | 6 | 1 (P-02) | 11 |
| R1 other scopes (H-*, A-*: bridge channel and door automation - not public) | 12 | 0 | 6 |
| **R1 total (36)** | **18** | **1** | **17** |
| R2 document links (9) | 4 (L-04 in this branch) | 0 | 5 |
| R3 TEMPREPORT (6, applies to main only where noted) | 0 on main (6 on the pilot branch) | 3 apply to main today: S3, S5, S6 - fixed on the pilot branch | 3 n/a on main (S1, S2, S4: the harvested feature is not on main) |

## 2. Traceability - R1 (2026-10-21), public-surface findings

| ID | Sev | Status on main | Evidence (code) | Pinned by (test) |
|---|---|---|---|---|
| D-01 | med | **Fixed** (`e50a423e8`), then superseded by R2 M-02: HTML cannot be minted at all | `services/tickets/out_documents.py:41` `MEDIA_TYPES` PDF only; tripwire hardened `:51-71`; `escape_text` `:76-81` | `test_fablefix_295_html_documents.py::test_every_review_probe_is_refused_by_the_tripwire`, `::test_escape_text_makes_hostile_names_inert_and_never_trips_the_tripwire`; `test_doclinksec_295.py::test_mint_accepts_pdf_only` |
| D-02 | low | **Fixed** (`e50a423e8`) | `frontend/src/public-ticket/doc/doc-page.ts:104-109` (bytes re-wrapped as `application/octet-stream`); server side `services/tickets/public_documents.py` `file_media_type` | `test_fablefix_295_html_documents.py::test_an_html_document_is_downloaded_as_opaque_bytes_and_a_pdf_keeps_its_type`; `frontend/tests/unit-public-doc.spec.ts` (section 7) |
| D-03 | low | **Accepted** (bearer link; reviewer: "acceptable; document it") | `out_documents.py:239-256` compare-and-set; opens per link 1..20 (`settings_doc.py:511`) | `test_vendorq_294_documents.py::test_the_public_routes_serve_the_snapshot_and_count_the_downloads` |
| D-04 | med | **Fixed** (`08e90548f`, `8881a2412`) | `services/tickets/public_portal.py:65-114` totals + drop times; `services/health_report.py:265,357` | `test_secfix2_pub04_portal_start_worker.py::test_d04_the_drop_counter_survives_a_replaced_worker_and_is_zero_when_off`, `::test_pubcount_drops_in_the_last_hour_reach_the_listener_stats_the_health_card_and_the_notice` |
| D-05 | low | **Accepted** (not blocking; session not UA-bound) | `services/tickets/vendor_portal.py:55` `SESSION_TTL` 30 min absolute; code bound to the network `:438-444` | `test_tickets_vendor_portal.py` |
| D-06 | med | **Accepted / mitigated** - the guard is still synchronous, but its database read is cached for 5 s (`FLAG_TTL_S`, already present at `02a252636`; the review did not note it), so a flood costs one read per 5 s | `guarded_route.py:39-41`; `services/local_identity.py:75,177-189` | `test_secfix2_pub07_guard_first.py::test_the_guard_runs_once_per_request` |
| D-07 | low | **Fixed** (`8881a2412`) - registry keyed by the listener | `public_portal.py:72-74,156` | `test_secfix2_pub04_portal_start_worker.py::test_pubcount_d07_the_registry_is_keyed_by_the_listener_and_a_new_database_replaces_the_old_worker` |
| D-08 | low | **Accepted** (owner defaults 90 days / 10 per vendor, `f0695d41b`) | `services/access_arrival.py` cap | `test_secfix2_pub03_pending_retention.py` |
| D-09 | info | Holds - digest only while the bytes are downloadable | `out_documents.py:233-236`, `_live` `:198-206` | `test_vendorq_294_documents.py` |
| D-10 | info | Holds - domain `doc`, hash-only, `#d.` fragment never a ticket token | `out_documents.py:31-32,167-168`; `frontend/src/public-ticket/state.ts:54` | `test_vendorq_294_documents.py::test_the_token_is_derived_in_its_own_domain_and_only_its_hash_is_stored`; `unit-public-doc.spec.ts` "a document fragment is `#d.<token>` exactly" |
| D-11 | info | Holds | `services/access_arrival.py`, `public_routes.py` | `test_secfix2_pub03_pending_retention.py` |
| D-12 | info | Holds; the cosmetic recommendation (a stable system actor id) is not done - accepted | `services/pending_retention.py:69` | `test_secfix2_pub03_pending_retention.py` |
| D-13 | info | **Fixed** (`101c9988c`) - default `true` | `services/intercom_authority.py:120,129`; stale docstring corrected in this branch (`services/intercom_writes.py:124-126`) | `test_secfix2_unknown_person_404.py` |
| D-14 | info | Holds - exact route match, kinds `token_read` / `file_read`, uniform 404, headers | `services/tickets/public_http.py:91-107,217-218,284-298` | `test_vendorq_294_documents.py::test_the_public_routes_serve_the_snapshot_and_count_the_downloads`; `test_tickets_s4_public.py` |
| R-01 | low | **Accepted / partly fixed** - microphone follows the features that use it (LAZYMIC-295); `camera=(self)` kept by CR-CAMVF-295. Not on the document surface (the public listener sends `camera=(), microphone=()`, `public_http.py:100`) | `remote_channel.py:66-109` | `test_remote_mic_policy.py` |
| P-01 | med | **Fixed** (`405a4fb9d`) - a correct password of a passkeys-only account is booked like a wrong one | `services/local_identity.py:1231-1252` | `test_passkey_only.py::test_on_refuses_the_password_uniformly_and_only_a_passkey_signs_in` |
| P-02 | low | **Open** - no audit row / notice on a silent fallback to password sign-in (`only_effective` false). Not related to documents | `services/local_passkeys.py:178-180`; no `passkey_only_fallback` anywhere | - |
| P-03 | info | Holds | `services/local_passkeys.py` | `test_passkey_only.py` |

## 3. Traceability - R1 other scopes (not public surfaces; summarised)

Read on main (delegated read, spot-checked: `GO_LIVE_PERMITTED` values below read directly). Bridge rotation is live
(`services/bridge_rotation.py:49` `GO_LIVE_PERMITTED = True`); door automation is still gated (`services/door_automation.py:48` = `False`).

| ID | Status | Evidence | Test |
|---|---|---|---|
| H-01 | Fixed (activation slice) | `services/ha_bridge.py:74-151` verify / sign through `bridge_keys`; `services/bridge_keys.py:304-316` `adopt_legacy` clears `bridge.secret` | `test_bridge_key_activation_295.py::test_adopting_clears_the_setting_and_keeps_signing_kidless_for_the_legacy_key`, `test_bridge_key_rotation_295.py::test_go_live_permits_in_the_build` |
| H-02 | Fixed (`13f43996d`) | `bridge_keys.py:363-390` MAC first, one wire code | `test_bridge_key_rotation_295.py::test_h02_every_refusal_before_the_mac_answers_one_wire_code` |
| H-03 | Accepted (documented: hygiene, not leak recovery) | `bridge_keys.py:20-21`, `bridge_rotation.py:24` | `test_bridge_key_activation_295.py::test_h03_the_hygiene_not_recovery_text_is_in_the_card_the_cr_and_the_guide` |
| H-04 | Fixed (persisted high-water) | `bridge_keys.py:15-16,391-404` | `test_bridge_key_activation_295.py::test_h04_replay_after_a_restart_is_refused_by_the_persisted_highwater` |
| H-05 | Fixed | `bridge_rotation.py:598-603` | `test_bridge_key_activation_295.py::test_h05_repair_does_not_retire_k_cur_on_the_peers_word_alone` |
| H-06 | Accepted (CPython limit) | `bridge_rotation.py:437` | - |
| H-07 | Fixed (`secure_delete` + WAL checkpoint) | `bridge_keys.py:277-300` | `test_bridge_key_activation_295.py::test_h07_a_retired_keys_sealed_blob_is_not_left_in_the_database_or_the_wal` |
| H-08 | Holds | `routers/bridge_key.py:32-55`; `services/backup.py:91` | `test_bridge_key_rotation_295.py::test_api_rbac_system_administrator_only` |
| H-09 | Fixed | `bridge_rotation.py:211-232` | `test_bridge_key_activation_295.py::test_h09_commit_answer_signed_under_the_old_key_is_not_believed` |
| A-01 | Fixed; feature gated | `door_automation.py:884-921,1005-1007` corroboration | `test_door_automation_295.py::test_a_spoofed_event_without_a_person_is_refused_and_sends_nothing` |
| A-02 | Fixed; gated | `door_automation.py:1071-1091` | `test_door_automation_295.py::test_the_kill_switch_set_while_the_first_door_is_sent_stops_the_second` |
| A-03 | Fixed; gated | `door_automation.py:70-71,1032-1038` | `test_door_automation_295.py::test_a_door_has_one_installation_wide_cap_across_all_blocks` |
| A-04 | Fixed (owner variant: corroboration is the trust anchor); gated | `door_automation.py:80-82,834-845` | `test_door_automation_295.py::test_manual_detection_is_a_persons_context_or_a_manual_run` |
| A-05 | Accepted (info; `dev_user` never set in the add-on) | `door_automation.py:1134` | - |
| A-06 | Holds | `door_automation.py:97,173` | `test_door_automation_295.py::test_operator_is_never_a_human_and_humans_never_fire` |
| A-07 | Fixed (owner: back up, restore disarmed) | `services/backup.py:61,93`; `_disarm_restored_blocks` | `test_door_automation_295.py::test_a_restore_brings_every_block_back_disarmed_and_never_the_fire_history` |
| A-09 | Fixed (bounded queue, one worker) | `door_automation.py:83-84,1206-1225` | `test_door_automation_295.py::test_events_go_through_one_bounded_queue_and_a_full_queue_counts_drops` |
| A-10 | Accepted (documented DST edges, unknown zone fails closed) | `door_automation.py:217-225` | `test_door_automation_295.py::test_dst_edges_are_safe_and_documented` |

## 4. Traceability - R2 (document links, 2026-10-23), R3 and the package residuals

| ID | Status on main | Evidence | Test |
|---|---|---|---|
| R2 M-01 e-mail carries the bearer link | **Fixed** (`651c7c09a`): a report with a document is refused on the e-mail channel at queue and at send time | `services/tickets/contact_reports.py`, `outbox.NON_RETRYABLE` `document_channel` | `test_vendorq_294_reports.py` (M-01 tests) |
| R2 M-02 HTML mintable | **Fixed** (`651c7c09a`) | `out_documents.py:41` | `test_doclinksec_295.py::test_mint_accepts_pdf_only` |
| R2 L-01 no single-link revoke | **Fixed** (`651c7c09a`) | `routers/tickets_links.py:113-130` (`tickets.configure`, audit without token) | `test_doclinksec_295.py::test_an_operator_revokes_one_document_link` |
| R2 L-02 counted before delivery | Accepted (availability only; raise `document_max_opens`) | `out_documents.py:239-256` | - |
| R2 L-03 write transaction during the download | Accepted (bounded: 16 in flight, 20 / min per token, 2 MiB) | `public_documents.py:94-96` | - |
| R2 L-04 minting not gated by the service module | **Fixed in this branch**. Resolved the UNKNOWN: the vendor path was already gated (`services/temperature_whatsapp.py:113`), the staff dialog link (`services/temperature_report_link.py:62`) was not and could mint a dead link. `out_documents.config` now requires `tickets.enabled` too, so `mint` refuses `documents_off` and `temperature_report_link.available` stops offering the link | `out_documents.py` `config` | `tests/test_pubsurf_2310.py::test_l04_no_document_is_minted_while_the_service_module_is_off` |
| R2 I-01 bearer, forwardable | Accepted (by design; defaults 72 h / 5 opens, temperature links 24 h / 10) | `settings_doc.py:510-511` | - |
| R2 I-02 bytes in the main SQLite file | Accepted. Resolved: the project backup is table-list based and never names `outbound_documents` (`services/backup.py:281-299,651`), so a project backup carries no document. Residual: a Home Assistant add-on snapshot copies `/data`, i.e. the live SQLite file with up to 7 days of live PDFs | `services/backup.py` | - |
| R2 I-03 ticket deletion | Holds (revocation on contact change / erase / failed send / key rotation) | `contacts.py:667`, `routers/tickets_links.py:156` | `test_vendorq_294_documents.py` |
| R2 P4 CDN cache | Code belt **added in this branch**: `CDN-Cache-Control: no-store` and `Cloudflare-CDN-Cache-Control: no-store` on both document answers. The live rule is still UNKNOWN (condition C1) | `public_documents.py` `CDN_NO_STORE` | `tests/test_pubsurf_2310.py::test_p4_both_document_answers_tell_a_cdn_not_to_store_them` |
| R3 S3 staff names / maintenance reasons in a PDF behind a bearer link | **Applies to main** (TEMPLINK dialog link and TEMPVENDOR vendor link): `services/temperature_report.py:218-234` keeps `by_name` and `reason` for maintenance rows. Fixed only on `pilot/TEMPREPORT-2310` (`e979998b9`) | - | `test_tempreport_2310_security.py` (pilot branch) |
| R3 S5 `GET` / `POST /infra/temperature/report/links` cacheable on the ingress path | **Applies to main** (`routers/temperature.py:536-563`, no `Cache-Control`; the POST answer carries the bearer URL). Internal, authenticated route. Fixed on the pilot branch | - | pilot branch |
| R3 S6 privacy documents silent on `outbound_documents` | **Applies to main**; fixed on the pilot branch | - | doc review |
| R3 S1, S2, S4 | n/a on main (the WhatsApp report-link feature is not merged) | - | - |
| PUB-01, PUB-02, PUB-05 | Fixed in 2.9.3 (package section 5, C1-C3) - not re-traced | - | `test_client_ip_trusted_proxy.py`, `test_tickets_s4_public.py`, `test_remote_sourcemaps.py` |
| PUB-03, PUB-04, PUB-07 | See D-04, D-07, D-08, D-11, D-12, D-06 | | |
| PUB-06 (`auth/remote-config` no limiter) | **Open, low** - unchanged (`routers/remote.py:48-60`); remote channel, not the document surface | | |
| PUB-08, PUB-11 | Accepted (package) | | |
| PUB-09 (`remote.csp_enforce`), PUB-10 (trusted-proxy CIDRs), PUB-12 (Cloudflare controls) | Owner actions, UNKNOWN from the repository. PUB-10 and PUB-12 are conditions C1 / C4 below | | |

## 5. The document-link surface, attacker view

The surface: the link `<public base>/<prefix>/#d.<token>`; the page (`frontend/src/public-ticket/doc/`, lazy chunk of the public bundle);
two routes on the public listener (container port 18093, only when the add-on option `tickets_public` is on): `GET /t/api/doc` (metadata)
and `GET /t/api/doc/file` (the bytes); the setting `reports.documents` (OFF) and, on top, `tickets.enabled`. Producers on main:
`services/temperature_whatsapp.py:330` (vendor report, needs `reports.to_contacts`) and `services/temperature_report_link.py:62` (staff dialog
link, needs `report_link_enabled`). Service requests themselves mint no document today.

**Without a link.** The attacker can reach the two routes through the tunnel.
- Guessing: the token is HMAC-SHA256 under the module key over `doc|<128-bit random id>|1`, 32 base64url characters = 192 bits
  (`out_documents.py:167-168`, `links.derive_token`). Unknown tokens cost one indexed read by `sha256(token)` and count against 20 / min
  per client network (/24, /64) and 300 / min installation-wide (`ratelimit.py:418-419`); no per-token key is created for an unknown
  token, so a 429 never reveals validity. Guessing is infeasible.
- Enumeration / oracles: every dead state (unknown, expired, revoked, used up, purged, documents off, module off, key gone, no token,
  malformed token, wrong method, HEAD/OPTIONS) is the byte-identical `{"code":"link_unavailable"}` 404 (`public_http.py:103`,
  `final_headers`). There is no path parameter and no id in the URL.
- Cross-site: the token travels in the `X-Ticket-Token` header (a cross-site page cannot set it without a preflight, and the listener
  sends no CORS header); no cookie is read or set on these routes; so a cross-site request cannot burn a download.
- Cache: the origin sends `private, no-store` (file) / `no-store` (meta) and, since this branch, `CDN-Cache-Control` and
  `Cloudflare-CDN-Cache-Control: no-store`; no `ETag` / `Last-Modified` / `Accept-Ranges`; `Range` and conditional request headers are
  stripped (`public_http.py:88,106`). **The one way an attacker without a link could get a document is a CDN rule that caches
  `/t/api/doc/file` by URL** ("Cache Everything" with an Edge TTL override that ignores origin headers): every document has the same URL.
  This is condition C1.
- Denial of service: bounded by the edge (16 in flight, body-less routes) and the per-network limits; the installation-wide failure budget
  can be exhausted by a flood, making real holders see 429 for up to a minute (availability only, as for ticket links).

**With a link** (the recipient, or anyone the message reached: a forwarded WhatsApp message, an unlocked phone, a chat backup; the WhatsApp
provider also sees the URL with its fragment).
- Can: read the metadata (file name, type, size, expiry, downloads left, digest, the organisation's public name / logo / theme - never the
  recipient, module or source; `out_documents.py:233-236`, `public_documents.py:52-57`) and download the PDF until it expires or the
  downloads are used up: 72 h / 5 by default for vendor reports (ceilings 168 h / 20 in code and in the table CHECK), 24 h / 10 for
  temperature links. Per token: `file_read` 20 / min and 60 / h, `token_read` 60 / min.
- Can: burn the real recipient's downloads (D-03, accepted).
- Cannot: list or reach any other document, ticket, RFQ or consent link (domain separation, D-10); change anything except the download
  counter; get the file rendered as HTML on the customer's hostname (PDF only, `attachment`, `nosniff`, CSP `default-src 'none'`, the page
  hands the bytes over as `application/octet-stream`).
- What the PDF itself contains is the data-minimisation question: on main today a temperature PDF behind a link includes, for maintenance
  windows, the staff member's display name and the free-text reason (R3 S3). That is condition C2.

**Token handling and logging.** Only `sha256(token)` is stored (UNIQUE index); the token is derived again when the URL is built
(`token_of`) and never written to a log, an audit row or an API answer other than the one-time creation answer of the staff dialog
(`routers/temperature.py:550-563`, internal and authenticated). The page reads the fragment once, removes it with `history.replaceState`
and keeps the token in memory only (never sessionStorage in `#d.` mode). The listener's request log writes the route template, status and
timings only (`services/tickets/public_log.py:1-20`). Audit rows `report.document.mint` / `.open` / `.revoke` carry the document id,
module, counts and expiry - no token, URL, IP or content.

**Revocation.** One link (`POST /api/v1/tickets/documents/{id}/revoke`, `tickets.configure`), one staff link
(`DELETE /infra/temperature/report/links/{id}`), every link of a contact on number change / erase, a failed / cancelled send, a module key
rotation (all links), `reports.documents` off or (since this branch) `tickets.enabled` off - both make every link the uniform 404 at once.
Not revoked at once: links of a deactivated system user (expire on their own; R3 residual 2).

**Expiry and storage.** The janitor nulls the bytes at expiry / revocation / downloads used up and drops the row 90 days later
(`out_documents.py:286-292`); live store capped at 64 MiB, 2 MiB per document.

**Gaps found in this re-check.**
- Fixed here (small, test-first): L-04 (module gate) and the P4 CDN header belt.
- Larger / elsewhere: R3 S3, S5, S6 (fixed on `pilot/TEMPREPORT-2310`; not duplicated here to avoid a conflicting second fix); P-02 and
  PUB-06 (not on the document surface); the HA add-on snapshot carrying live PDFs (I-02 residual; accept, or exclude the table from the
  snapshot later); no revocation on user deactivation (R3 residual 2).

## 6. Verdict

**Yes, with conditions.** After this branch merges, `reports.documents` may be switched on in a release when all of these hold:

- **C1 - Cloudflare cache rule verified live by the owner** (from a machine outside the building, no token needed, nothing is changed):
  1. In the Cloudflare dashboard of the public hostname, Caching > Cache Rules and Rules > Page Rules: no rule with "Cache Everything",
     "Eligible for cache" or an Edge / Browser Cache TTL override covers `/<prefix>/*` (default `/support/*`) or `/t/*`; a Cache Rule
     "Bypass cache" exists for `/<prefix>/api/*` (or at least `/<prefix>/api/doc*`); `X-Ticket-Token` is not part of any custom cache key.
  2. Run twice, a few seconds apart: `curl -s -o /dev/null -D - https://<public host>/<prefix>/api/doc/file` (no token header).
     Both answers must be `404` and `cf-cache-status` must be `DYNAMIC` or `BYPASS` or absent - never `HIT`, `MISS`, `EXPIRED` or
     `REVALIDATED` (a `MISS` means the answer was eligible to be stored).
  3. Same check for `https://<public host>/<prefix>/api/doc`.
  4. Record date + result (without the host name) in the release's security notes (`DOCLINKS_CLOUDFLARE_CACHE_RULE.md`).
- **C2 - `pilot/TEMPREPORT-2310` (or at least its S3, S5, S6 fixes) is merged first**, so a PDF behind a bearer link carries no staff
  names or maintenance reasons by default and the link routes answer `private, no-store`. Alternative accepted by policy: the owner
  explicitly accepts S3 for the temperature reports in writing.
- **C3 - the release gate runs the document test files green on the release head** (section 7 list, including `test_temprep_295.py`,
  which needs `fpdf` and runs on the runner only), not a stale run.
- **C4 - deployment facts**: `public.base_url` set and probed; `public.trusted_proxy_cidrs` matches the tunnel peer (otherwise every
  request shares one rate-limit bucket - PUB-10). `reports.email` stays OFF (no e-mail carries a document; enforced in code since M-01,
  but keep the switch off until a redeem-style document link exists).
- **C5 - operator settings chosen deliberately**: `reports.document_hours` / `document_max_opens` (suggestion for HACCP: 24 h / 2) and the
  emergency stop named in the operator guide (switch `reports.documents` off, or revoke one link).
- Recommended, not blocking: a real-phone check (Android and iOS WhatsApp in-app browser) that the download saves the PDF (R2 P7).

## 7. Tests run (this branch, workstation, file by file, one worker)

Workstation venv (Python 3.12), `python -m pytest -p no:cacheprovider tests/<file>.py`, one file at a time, one worker, BelowNormal
priority, 2026-10-31, on this branch with the fixes applied. Fakes only. The two new tests were first run on `72c06e88e` without the fix:
2 failed (as intended), then green.

| File | Result |
|---|---|
| `tests/test_pubsurf_2310.py` (new) | 2 passed |
| `tests/test_vendorq_294_documents.py` | 26 passed |
| `tests/test_doclinksec_295.py` | 2 passed |
| `tests/test_fablefix_295_html_documents.py` | 41 passed |
| `tests/test_vendorq_294_reports.py` | 26 passed |
| `tests/test_templink_295.py` | 16 passed |
| `tests/test_walink_295.py` | 16 passed |
| `tests/test_tempvendor_295.py` | 26 passed |
| `tests/test_infra_temperature_report.py` | 15 passed |
| `tests/test_tickets_s4_public.py` | 27 passed |
| `tests/test_tickets_vendor_portal.py` | 61 passed |
| `tests/test_passkey_only.py` | 10 passed |
| `tests/test_secfix2_pub07_guard_first.py` | 35 passed |
| `tests/test_secfix2_unknown_person_404.py` | 20 passed |
| `tests/test_secfix2_pub04_portal_start_worker.py` | 10 passed |
| `tests/test_secfix2_pub03_pending_retention.py` | 21 passed |
| `tests/test_remote_mic_policy.py` | 17 passed |
| `tests/test_remote_access.py` | 66 passed |
| `tests/test_bridge_key_activation_295.py` | 30 passed |
| `tests/test_bridge_key_rotation_295.py` | 45 passed |
| `tests/test_door_automation_295.py` | 92 passed |
| **Backend total, 21 files** | **604 passed, 0 failed, 0 skipped** (one Starlette TestClient deprecation warning per file) |
| `frontend/tests/unit-public-doc.spec.ts` (`npx playwright test -c playwright.unit.config.ts`, Node 24, 1 worker) | 6 passed |

NOT_RUN: `test_temprep_295.py` (needs `fpdf`, runner only), `test_client_ip_trusted_proxy.py`, `test_remote_sourcemaps.py` (PUB-01 /
PUB-05, not re-traced), the full backend suite, every UI e2e / pixel suite, anything on the runner, anything live (Cloudflare, tunnel,
phone). Real-browser behaviour of the `blob:` download is not verified.

## 8. Changes in this branch

- `services/tickets/out_documents.py` - `config()["enabled"]` = `reports.documents` AND `tickets.enabled` (L-04).
- `services/tickets/public_documents.py` - `CDN_NO_STORE` headers on both document answers (P4 belt).
- `services/intercom_writes.py` - docstring: the uniform-404 switch is on by default (D-13).
- `tests/test_pubsurf_2310.py` - two tests, written first and seen failing on `72c06e88e` before the fix.

No migration, no setting added, no default changed. Rollback: revert the branch.
