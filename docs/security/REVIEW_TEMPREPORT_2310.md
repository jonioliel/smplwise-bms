# Security review - TEMPREPORT: the temperature report as a temporary link in the WhatsApp message (TEMPREPORT-2310)

Date: 2026-10-30. Branch `pilot/TEMPREPORT-2310` = `origin/release/2290-train` @ a9e64cd96 + merge of `origin/pilot/TEMPREPORT-HARVEST-2290`
@ ab7245420 (the rescued TEMPREPORT-297 work, `docs/changes/CR-TEMPREPORT-297.md`). Owner decision 2026-10-30 (answer 4A): review, fix, then
train 3. No device, Home Assistant, go2rtc, NVR or real WhatsApp account was contacted; every send in the tests goes to the in-process fake
transport with invented numbers.

Requirements read: `docs/changes/CR-TEMPREPORT-297.md`, `CR-INFRA-TEMPERATURE.md` sections 9, 12, 14, `CR-TEMPVENDOR-295.md`,
`docs/security/TICKETS_PUBLIC_SURFACE_REVIEW_CHECKLIST.md`, `DOCLINKS_CLOUDFLARE_CACHE_RULE.md`, `HA_IDENTITY_RBAC_HE.md`.
Paths below are relative to `smplwise_vms/backend/smplwise/` unless stated otherwise.

## 1. Merge and migrations

One conflict: `contracts/API_INVENTORY.md` (the version line, 2.28.0 on the harvest branch vs 2.29.0 on the train). Resolved by regenerating
the inventory with `scripts/api_inventory.py` on the merged tree. **No migration** on the harvest branch (it reuses `outbound_documents`,
mig 0128, and the JSON installation settings of the temperature module), so nothing was renumbered.

## 2. What the feature is (as harvested)

A system user who receives the ordinary WhatsApp temperature report (one-off or scheduled) gets, besides the text summary, a temporary link
to a PDF of HIS units. The PDF is minted per recipient and per send into `outbound_documents` and served by the EXISTING public document
routes (`GET /t/api/doc`, `GET /t/api/doc/file` on the public listener) - no new public route. New internal route: `DELETE
/api/v1/infra/temperature/report/links` (revoke all).

## 3. Checklist (what was checked and found sound)

| Area | Result | Evidence |
|---|---|---|
| Token entropy | OK - HMAC-SHA256 under the tickets module key, domain `doc`, document id 128-bit random; 32 base64url characters (192 bits) | `services/tickets/links.py` `derive_token`, `out_documents.mint` |
| Token storage | OK - only `sha256(token)` is stored (UNIQUE index, one lookup); the token is derived again when the URL is built and never logged or audited | `out_documents.py`; `test_the_summary_carries_a_live_link_to_the_recipients_pdf` |
| Token transport | OK - `#d.<token>` in the URL fragment (never sent to a server, a proxy log or a WhatsApp link-preview fetch); the page sends it as `X-Ticket-Token` | `out_documents.url` |
| Expiry | OK - `report_link_hours` (24, 1-168, clamped again to `HOURS_CEILING`), `report_link_max_opens` (10, 1-20), compare-and-set on the download count | `test_the_lifetime_and_the_downloads_are_settings_and_replay_ends_at_the_limit`, `test_an_expired_link_is_the_uniform_404` |
| Revocation (single) | OK - `DELETE /report/links/{id}`; creator or manager, anything else the same 404 | `test_revoking_one_link_and_all_links_from_settings` |
| Revocation (all) | finding S4 (fixed) | below |
| Enumeration / rate limiting | OK (unchanged public listener) - per-token / per-network / installation limits, one uniform 404 for unknown, expired, revoked, used-up or documents-off | `public_http.py` route rules `token_read`, `file_read`; `TICKETS_PUBLIC_SURFACE_REVIEW_CHECKLIST.md` |
| Remote channel | OK - the new `DELETE /report/links` needs a remote session (401 without one) like every internal route; the public document routes are on the public listener, not the remote channel | `tests/test_remote_access.py::test_every_route_needs_a_remote_session` (run, see section 6) |
| CSRF | OK - the remote channel refuses a state-changing request with the session cookie and no same-origin proof (`csrf_refused`, audited); ingress requests are authenticated by Home Assistant; the frontend calls the route with `fetch` from the same origin | `remote_channel.py` `csrf_reason`; `test_remote_access.py` `test_csrf_*` |
| Scope (what the PDF shows) | OK for units - the RECIPIENT's own scope (`_visible_units(recipient)`), never the sender's; door data only where he sees the door sensor. Finding S3 (fixed) for people in the events list | `test_a_recipient_who_sees_no_unit_gets_nothing` |
| Who may send a link | OK - the sender (one-off sender or schedule creator) must hold `infra.temperature.report_link_send` at SEND time; fails closed for an unknown / deactivated user (`principal_of` None) | `test_a_sender_without_the_send_permission_sends_the_plain_summary` |
| To whom | OK - only active system users with a resolved number and the user's OWN opt-in (`consent == granted`); at most 30 recipients per send | `temperature_whatsapp.recipients`, `_check_recipients`, `resolve_number` |
| No forwarding | OK - a link minted inside a report send (`source_id` set) is refused by the manual WALINK send (404 `link_not_found`) | `test_a_report_link_is_never_forwarded_by_the_manual_link_send` |
| Audit | OK - `infra.temperature.report.document.send` (sender id, recipient id + display name, outcome, expiry, downloads limit), `report.document.mint` / `.open` (count), `.link.revoke` / `.revoke_all` (count); never the number, the text, the link or the token | `test_the_audit_row_names_sender_recipient_and_time_but_never_the_number_or_the_link` |
| Log redaction | OK - the WhatsApp adapter logs only the outbox id, outcome and code; nothing logs the text (which now holds the bearer link) | `services/tickets/channel_whatsapp.py` lines 235-251 |
| Caching | public routes OK (`private, no-store`, no ETag / Range; Cloudflare bypass rule `DOCLINKS_CLOUDFLARE_CACHE_RULE.md`); internal link routes: finding S5 (fixed) | |
| Default OFF | finding S1 (fixed): the feature now has its own switch, OFF; still also needs `reports.documents` (OFF) | |
| Privacy docs | finding S6 (fixed): `outbound_documents` was not in the data-processing / retention summaries | |

## 4. Findings

| # | Severity | Finding | Fix | Test (`tests/test_tempreport_2310_security.py` unless noted) |
|---|---|---|---|---|
| S1 | Medium | **One switch for two audiences.** The harvest reused `report_attachment = link` (until then the VENDOR document mode, TEMPVENDOR-295, with no UI) as the switch for links to system users, and put it in Settings under the internal link group with the label "the full report in WhatsApp messages". Turning it on for staff silently also sent PDF links to EXTERNAL vendors (whenever vendor reports are on), and vice versa. Breaks the owner rule "every behaviour is a setting" (one setting per behaviour). | New installation setting `report_link_users` (bool, **OFF**); `user_link_mode()` = it AND `reports.documents`; `wants_document()` uses `link_mode()` (vendor) for a vendor row and `user_link_mode()` + the sender's permission for a user row; `recipients()` reports `user_attachment` from the user switch. Settings shows both switches with separate labels (he/en/ar/ru). | `test_s1_the_user_link_switch_exists_and_is_off_by_default`, `test_s1_the_vendor_mode_alone_gives_system_users_no_link`, `test_s1_the_user_switch_does_not_turn_on_vendor_documents`; `test_tempreport_297.py` updated to the new switch |
| S2 | Medium | **A link outlives the consent and the number it was sent to.** A user who withdraws his WhatsApp opt-in, or whose number changes (the old number may be reassigned to someone else), kept every live report link already sent to that number for up to `report_link_hours` (max 168 h). `revoke_recipient` existed only for vendor contacts. | `out_documents.revoke_sent_to_user()` (user rows with a `source_id` - links sent inside a report - reason `contact_changed`); called from `notify_whatsapp.set_opt_in` when the opt-in is withdrawn or moves to another number, and from `number_change_sweep` when a change is detected. Audited `report.document.revoke_number` (count only). A link the user made himself in the dialog (`source_id` NULL) is left alone. | `test_s2_withdrawing_the_whatsapp_opt_in_revokes_the_links_sent_to_that_user`, `test_s2_a_changed_number_revokes_the_links_sent_to_the_old_number`, `test_s2_confirming_the_same_number_again_keeps_the_link` |
| S3 | Medium | **Not the minimum data behind a bearer link.** The linked PDF (chart + events) includes, for every maintenance window, the display name of the staff member who set it and its free-text reason (up to 120 characters). A WhatsApp link can be forwarded; whoever holds it downloads without an account. The same applied to the vendor link PDF (TEMPVENDOR) and the dialog link (TEMPLINK). | `temperature_report.build(..., people=False)` drops `by_name` and `reason` (the window's kind and times stay). New setting `report_link_people` (bool, **OFF**). Applied to all three PDFs that leave by a public link (WhatsApp user link, vendor link, dialog link); the signed-in in-app download is unchanged. | `test_s3_the_whatsapp_link_pdf_carries_no_staff_name_or_reason_by_default`, `test_s3_the_people_setting_puts_them_back`, `test_s3_the_manual_link_pdf_follows_the_same_setting_but_the_inapp_download_does_not` |
| S4 | Low | **"Revoke all links" was not all.** It revoked only `recipient_kind = 'user'` rows, so the vendor document links of the same module stayed live; it also counted (and marked) already-expired rows, so the reported number was not the number of links actually stopped. | `revoke_all()` covers `user` and `contact` rows of the temperature module and only LIVE ones (not expired, downloads left); a non-manager still revokes only links he created. | `test_s4_revoke_all_covers_vendor_links_and_counts_only_live_ones`, `test_s4_a_non_manager_revoke_all_leaves_other_peoples_vendor_links`; `test_tempreport_297.py::test_revoking_one_link_and_all_links_from_settings` |
| S5 | Low | **Link routes cacheable on the ingress path.** `POST /report/links` returns the bearer URL and `GET /report/links` returns recipients' names; the remote channel adds `no-store` to API answers, but the Home Assistant ingress path did not. | `Cache-Control: private, no-store` on `GET` / `POST /report/links` and `DELETE /report/links`. | `test_s5_the_link_routes_answer_private_no_store` |
| S6 | Low (docs) | **Privacy documents silent.** `outbound_documents` (PDF snapshots, recipient ids, download counts) and the audit row with the recipient's display name were not in the data-processing or retention summaries. | Row U in `docs/privacy/{en,he}/01-data-processing-summary.md`, a retention row in `02-retention-and-access-summary.md` (en, he). `CR-TEMPREPORT-297.md` and checklist row 3.8 amended. | doc review |

## 5. Accepted residual risks and owner items (not changed here)

1. **A bearer link in a WhatsApp chat.** Anyone who can read the recipient's WhatsApp (an unlocked phone, a forwarded message, a chat
   backup) can download the PDF until it expires or is used up. Mitigated by the 24 h / 10 downloads defaults, revoke one / all, and S2/S3.
   The WhatsApp provider sees the URL (with the fragment) - the same as every ticket link today (privacy doc C5, counsel review).
2. **A deactivated or deleted user's links are not revoked at once.** They expire on their own (default 24 h). Revoking on deactivation needs
   a hook in every identity path (Home Assistant users, Arx-only users); proposed as a follow-up if the owner wants it.
3. **No per-sender mint budget.** A send mints one PDF per recipient (at most 30); the shared live-store cap (64 MB) can make later document
   sends `skipped: document_store_full` until the janitor purges. Denial of service by an authorised manager only; recorded.
4. **Public surface precondition unchanged:** `reports.documents` must not be switched on in a release before the public-surface review
   items and the Cloudflare bypass rule (`DOCLINKS_CLOUDFLARE_CACHE_RULE.md`) are verified live (UNKNOWN today).
5. The audit row keeps the recipient's display name (by design in CR-TEMPREPORT-297 section 3, "who it went to"). The user id alone would
   be enough; kept for the owner to decide.

## 6. What was run

Run locally on the workstation on 2026-10-31 (not on the runner), Python 3.12 venv, Node 24:

| Suite | Result |
|---|---|
| `tests/test_tempreport_297.py` + `tests/test_tempreport_2310_security.py` | 30 passed, 0 failed |
| `tests/test_remote_access.py`, `test_notify_whatsapp.py`, `test_templink_295.py`, `test_temprep_295.py`, `test_tempvendor_295.py`, `test_walink_295.py`, `test_doclinksec_295.py`, `test_infra_temperature_report.py`, `test_vendorq_294_documents.py`, `test_vendorq_294_reports.py`, `test_temperature_registry_295.py` | 317 collected: 316 passed, 0 failed, 1 skipped - `test_temprep_295.py` is skipped as a module (`fpdf` is not installed in the local venv): NOT_RUN here, to run on the runner |
| `frontend`: `npx tsc --noEmit` | exit 0 |
| `frontend`: `unit-temperature`, `unit-temperature-phase3`, `unit-tempvendor-295`, `unit-tickets-gate-295` (`playwright.unit.config.ts`) | 32 passed, 0 failed |
| `scripts/api_inventory.py` | regenerated, no change (no route added or removed) |

NOT_RUN: the full backend suite, the UI e2e / pixel suites, and anything on the runner or against a live system.

## 7. Rollback

Revert the branch, or switch `report_link_users` off (or `reports.documents` off: every document link stops answering at once). No schema
change. The two new settings are JSON keys in `infra_temp_settings`; an older build ignores them.

## 8. סיכום לבעלים

1. נבדק הקישור הזמני לדוח הטמפרטורות בוואטסאפ: האסימון חזק, נשמר רק כגיבוב, פג תוקף, ונענה ב-404 אחיד; אין נתיב ציבורי חדש.
2. תוקנו 6 ממצאים: מתג נפרד ועצמאי למשתמשי מערכת (כבוי כברירת מחדל), כך שהפעלה לצוות כבר לא שולחת קישורים גם לספקים.
3. ביטול הסכמה לוואטסאפ או החלפת מספר מבטלים מיד את הקישורים שנשלחו למספר הישן.
4. דוח שנשלח בקישור כבר לא כולל שמות אנשי צוות וסיבות תחזוקה, אלא אם תפעילו זאת בהגדרה; "ביטול כל הקישורים" כולל גם ספקים.
5. נשארו להחלטתך: ביטול קישורים מיד כשמשתמש מושבת, והאם להשאיר את שם הנמען ביומן הביקורת.
