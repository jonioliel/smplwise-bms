# CR-022 — NVR connection in Arx: vendor choice and connection settings stored by Arx, not in the add-on options

**Status:** APPROVED for implementation (owner decisions 2026-10-04, §0). Slice A (this document, the audit amendment,
`DOCS.md`, ADP §4/§7, ROADMAP) and slice B (backend, branch `pilot/nn4-backend`) done; implementation notes and the
deviations from the text below are in §19; the security review fixes in §20; slice C (frontend, `pilot/nn4-frontend`)
integrated with both on `pilot/nn4-integrated` (§21). Slice D (closing) open. **Release:** its own tier-L release as soon as migrations 0050 (CR-020 S2) and
0051 (CR-021) are on `g0/intake`; NN1 P1 (capabilities) merges before the NN4 backend (§12).
**Design source:** the NN4 planning note of 2026-10-03 (private, base `g0/intake` e2089071). **Builds on:** the D4 connection
editor of 0.1.71 (`PUT /nvr/connection`, `services/nvr_system.py`), the AES-GCM pattern of the alarm panel codes
(`services/alarm_codes.py`, key file under `<data>/keys/`), the NVR-less mode (`mode.py`), the setup wizard
(`services/setup_wizard.py`), the CR-020 adapter seam (`services/recorders/`), project backups (`services/backup.py`).
**Amends:** `docs/security/DEPENDENCY_AND_SECRETS_AUDIT.md` §3 ("secrets never live in ... the database") with one narrow,
owner-approved exception (§3 here). **Later amends (slice B/D, not now):** `smplwise_vms/DOCS.md` (NVR options text and the
backup sentence), `docs/architecture/NVR_VENDOR_ADAPTERS.md` §4/§7 (`connection_ref='addon'` becomes redundant).
No device, Home Assistant or lab system was contacted for this document, and `secrets/` was not read.

Paths: `B/` = `smplwise_vms/backend/smplwise/`, `F/` = `frontend/src/`.

## 0. Owner decisions (2026-10-04)

All eight answers take the recommended option of the planning note.

| # | Decision | Effect here |
|---|---|---|
| D1 | First release: **Hikvision** and **"no NVR"** selectable; **Provision-ISR** and **Frigate** shown as "coming soon" (not selectable) | Vendor catalogue §6.1 (`status: available / planned`) |
| D2 | The NVR password is stored **encrypted in the Arx database** (AES-256-GCM), key file in the data folder, **excluded from Arx backups** and from `PROJECT_TABLES` | §3, §4, §9 |
| D3 | After Save: **"restart required"** plus a **Restart** button; no auto-restart | §8 |
| D4 | The old add-on options stay **untouched and ignored** after a one-time import; the option keys are kept for **two releases** | §7 |
| D5 | Permission stays **`system.configure`** (no new permission, no `roles.json` change) | §10 |
| D6 | Saving while the NVR is **offline during installation** is allowed with an **explicit typed confirm** | §6.3, §6.4 |
| D7 | Changing the vendor on an installation **with cameras** requires **"Remove NVR"** first; the cameras stay, **disabled** | §6.5 |
| D8 | Own **tier-L** release after 0050 and 0051 merge; migration **0052** `recorder_connections`; **NN1 P1 merges before the NN4 backend** | §5, §12, §13 |

## 1. Problem

The installer cannot connect the NVR from Arx. Host, ports, user and password live in the add-on options; the setup
wizard sends the installer to the platform's add-on configuration page ("fill in ... Add-ons > Configuration"), which an
operator-facing product must not do (no platform branding on operator screens) and which has no vendor concept. The
0.1.71 editor (`PUT /nvr/connection`) does exist, but it persists by posting the whole options object to the Supervisor
(`/addons/self/options`, then `/addons/self/restart`), a path that was never verified live (§15 R3), and it swaps
`app.state.settings` in-process, so background tasks keep the old connection (half-applied state). On a workstation it
writes a plaintext `<data>/nvr_connection.json`.

The owner wants the installer to **choose the NVR vendor** (Hikvision now, Provision-ISR and Frigate later) and to keep the
connection in Arx's own settings.

## 2. Goal and the one-line answer

Move the storage of the NVR connection from the add-on options into one Arx table, `recorder_connections` (migration 0052),
with the password encrypted; add a server-driven vendor catalogue; overlay the stored connection onto `Settings` **once at
start-up**, so the ~20 modules that read `settings.nvr_*` do not change; import the existing add-on options once,
idempotently; make every change take effect through an explicit restart.

## 3. The secrets exception (resolves the documented contradiction)

### 3.1 The contradiction

`DEPENDENCY_AND_SECRETS_AUDIT.md` §3 says "Secrets never live in the repository or the database", and
`smplwise_vms/DOCS.md` says the NVR credentials are "stored only in the add-on options" and "backups never contain the NVR
... credentials". Decision D2 contradicts the first sentence. Per the precedence order (approved change request first), this
CR is the approval; the contradiction is recorded here and the audit sentence is amended to point at this section, not
deleted. Existing precedents in the database: the bridge shared secret (`settings`, excluded from backups), WisKey station
credentials (0024, plaintext, excluded from backups) and alarm panel codes (AES-GCM, key file). CR-022 follows the
alarm-code pattern, not the WisKey one.

### 3.2 The exception, exactly

1. **Scope:** only `recorder_connections.password_enc` (and, if a future vendor needs a token, `secret_json_enc` in the same
   row). No other secret may enter the database on the strength of this CR; each further case needs its own CR.
2. **Protection:** AES-256-GCM with the `cryptography` library already in the inventory; a fresh 96-bit random nonce per
   encryption; AAD = `"<recorder_id>|<field>"` so a blob cannot be moved to another row or column; stored form
   `v1:<base64(nonce|ciphertext|tag)>`.
3. **Key:** its own key file `<data>/keys/connections.key` (32 random bytes, mode 0600, created atomically: temp file +
   `os.link`/rename, losing the race reads the winner's file), same recipe as `alarm_codes._load_or_create_key`. Not shared
   with the alarm key. `alarm_codes.py` is **not** edited in this CR; extracting a shared `secret_box.py` is a later clean-up.
4. **Never leaves the server:** no API response, audit detail, log line, error payload, exception text, `Settings` repr,
   `/me`, `/health`, diagnostic bundle or Arx backup carries the password, the ciphertext or the key. The plaintext exists only
   inside `connection_store.load_effective()` at start-up and inside the connection test for the in-flight request.
5. **Backups:** the table is not in `PROJECT_TABLES`; the key file is outside every archive (§9).

### 3.3 Threat model and honest limits

| Threat | Covered? |
|---|---|
| The database file alone leaks (copied, attached to a support request, read through a future SQL bug) | **Yes** - ciphertext only; the key is a separate file |
| An Arx project backup archive leaks or is uploaded to another installation | **Yes** - neither the table nor the key is in the archive |
| A non-admin user, a remote-channel session or a custom role asks for the connection | **Yes** - `system.configure` only, routes absent from the remote channel (§10) |
| A blob is copied to another row or column | **Yes** - AAD binding fails decryption |
| Someone reads the **whole `/data` volume** (host shell, a platform add-on backup, a stolen disk) | **No.** The key lives beside the database; whoever reads both reads the password. This is the same exposure class as today's `options.json`, which the Supervisor also keeps in clear and includes in the platform's own add-on backups |
| A compromised Arx process | **No.** The running process can decrypt by design |
| go2rtc's own configuration | **No change.** The credentials are already copied into the `smplwise_*` stream source URLs (existing behaviour, `services/go2rtc.hikvision_rtsp_url`); go2rtc holds them in its own store |

The CR therefore claims protection against database and backup leaks, **not** against a reader of the full data folder. No
text in the UI or the documents may claim more.

## 4. Data model (migration 0052)

`0052_recorder_connections.sql`. One row per recorder connection, keyed by recorder id, so multi-recorder (NN1 P5) reuses
the table instead of adding another:

| Column | Type | Notes |
|---|---|---|
| `recorder_id` | TEXT PK | `nvr-1` today (`recorders/registry.DEFAULT_RECORDER`); no FK so the row survives a `recorders` replace |
| `vendor` | TEXT NOT NULL | CHECK in (`hikvision`, `provision_isr`, `frigate`, `none`); `none` = the installer explicitly chose "no NVR" |
| `host` | TEXT | host name or IP only (no scheme, path, port, user info); NULL when `vendor='none'` |
| `http_port`, `rtsp_port` | INTEGER | 1-65535, CHECK |
| `username` | TEXT | not a secret, but returned only to `system.configure` holders |
| `password_enc` | TEXT | `v1:` blob; NULL = no password stored |
| `secret_json_enc` | TEXT | reserved for a vendor token; NULL in this CR |
| `extra_json` | TEXT NOT NULL DEFAULT `'{}'` | vendor-specific **non-secret** fields (e.g. ONVIF port, https flag), so a new vendor needs no migration |
| `enabled` | INTEGER NOT NULL DEFAULT 1 | |
| `state` | TEXT NOT NULL DEFAULT `'ok'` | `ok` / `incomplete` (host without password, typically from import) |
| `revision` | INTEGER NOT NULL | +1 on every save; drives the restart flag (§8) |
| `source` | TEXT NOT NULL | `ui` / `addon_import` |
| `updated_at`, `updated_by` | TEXT | ISO time; principal id or `system` |

No change to existing tables, no back-fill (the import is code, §7, so a key problem never blocks migrations). Rollback:
older code ignores the table. `Settings` gains `nvr_vendor` (default `hikvision` for legacy options) and `nvr_extra`.

Settings key `nvr.legacy_import_done` (in the `settings` table) records that the import ran; it joins `SETTINGS_KEEP` so a
restore never resets it.

**Coordination:** the NN1 plan had reserved 0052 (`recorders` columns) and 0053 (`recorder_credentials`). This table
supersedes `recorder_credentials` (it is the same table, vendor-agnostic): NN1 P4 moves to 0053 and drops its credentials
table (coordinator to confirm, §16).

## 5. Effective settings and precedence

`connection_store.load_effective(settings, conn)` is called **once** in the `main.py` lifespan, after migrations and before
any background worker starts; it returns `dataclasses.replace(settings, nvr_host=..., nvr_vendor=..., ...)` and sets
`app.state.settings` once. It is the **only** place that decides where the connection comes from:

1. a `recorder_connections` row (vendor `none` => NVR-less mode `ha_only`; unreadable password => state
   `connection_unreadable`, NVR treated as not configured, start-up continues);
2. else the add-on options / `NVR_*` environment, through the one-time import (§7);
3. else the existing development placeholder / `ha_only`.

`mode.installation_mode` and `mode.nvr_ready` stay thin functions of the effective settings; NN1's capability derivation
calls the same accessor. The workstation file `<data>/nvr_connection.json` is removed (one code path; `NVR_*` environment
variables remain a development and test fallback only).

## 6. Vendor selection, API and the connection test

### 6.1 Vendor catalogue

`B/services/recorders/registry.py`: `VENDORS` gains a `VendorSpec` next to each constructor
(`id, label, status, default_ports, fields[]`, each field `{key, label, kind, required, secret}`). Statuses: `available`
(selectable), `planned` (listed as "coming soon", not selectable). First release (D1): `hikvision` available,
`provision_isr` planned, `frigate` planned, plus the pseudo-choice `none` ("ללא NVR"). The form is rendered from `fields`,
so a new vendor needs its adapter and a spec, no UI rework. `adapter_for` refuses a vendor without an adapter.

### 6.2 API (new router `B/routers/nvr_connection.py`)

All routes: `system.configure`; permission check (401/403, audited) **before** body validation or any device I/O; strict
pydantic models with `extra=forbid`; the existing `body_limit.py` size cap; absent from the remote channel.

| Route | Purpose | Body | Answer |
|---|---|---|---|
| `GET /api/nvr/vendors` | Catalogue | - | `[{id, label, status, default_ports, fields}]` |
| `GET /api/nvr/connection` | Current connection (path and keys compatible with 0.1.71) | - | `{vendor, host, http_port, rtsp_port, username, extra, has_password, state, source, revision, updated_at, updated_by, pending_restart, legacy_options_differ}` - **never** the password or ciphertext |
| `PUT /api/nvr/connection` | Save | `{vendor, host, http_port, rtsp_port, username, password?, keep_password?, extra?, save_untested?, confirm_text?, if_revision}` | `{saved:true, restart_required:true, revision}`; 422 `revision_required` when `if_revision` is absent, 409 `stale` on a mismatch (also re-checked after the test, §20) |
| `POST /api/nvr/connection/test` | Test a candidate (§6.3) | as PUT, plus `use_stored_password` | `{ok, code, model?, firmware?, channels?}` |
| `DELETE /api/nvr/connection` | "Remove NVR" (§6.5) | `{confirm_text, if_revision}` | `{removed:true, restart_required:true, revision}`; 422 `revision_required` / 409 `stale` as PUT |
| `POST /api/system/restart` | Restart Arx (§8) | `{confirm:true}` | `202`; outside the add-on 409 `restart_manual` |

Validation: `host` matches a host-name / IPv4 / bracket-less IPv6 pattern, at most 253 characters, no scheme, path, port,
`@` or whitespace (422 `host_invalid`); ports 1-65535 (422 `port_invalid`); vendor must be `available` or `none` (422
`vendor_not_available`); `password` at most 128 characters, write-only. Omitting `password` with `keep_password:true` (PUT) or sending
`use_stored_password:true` (test) uses the stored one **only when vendor, host, HTTP port and RTSP port equal the stored row**
(before any save: the legacy connection the process runs with). Any change of the destination needs the password typed again:
422 `password_required` with `details.reason = "destination_changed"`, audited. *Deviation, decided by the lead after the
security review (F2, 2026-10-04):* the earlier text allowed a kept password with a changed host ("the admin is the same trust
level as the stored secret"); that let any system-administrator session send the stored secret to an arbitrary address, so the
password was not really write-only.

During slices B-C the old routes in `routers/nvr_write.py` stay untouched (CR-020 S2 edits that file); the new router owns
the `/nvr/connection` path once mounted, with compatible response keys, and the old handlers are deleted in a follow-up
commit after S2 merges (§13).

### 6.3 Connection test (no device writes)

- Hikvision: `GET /ISAPI/System/deviceInfo`, then (optional) the channel listing; through the adapter's read-only
  `health()` / `list_channels()`. **GET only**; the fake NVR's request log must show zero non-GET requests.
- **SSRF source policy:** the host is checked by `source_policy.host_refused` before any connection: loopback, link-local
  and cloud metadata addresses, the Supervisor, the Arx host itself and unspecified addresses are refused (`host_refused`);
  RFC 1918 addresses and names are allowed (an NVR is on the LAN). Names are resolved and every resolved address is checked;
  the connection goes to the checked address (no second resolution); a name that does not resolve is not connected at all
  (`source_unavailable`). The ports of the platform's own services (8123, 1984, 8554, 8555, 4357, 8099) are refused on any
  host (422 `port_refused`). `follow_redirects=False`; timeouts 5 s connect, 5 s per read, one 8 s wall-clock deadline for the
  whole test, at most 256 KB read per answer (§20).
- **Rate limit:** 5 tests per minute per user and 20 per minute per installation; excess 429 `rate_limited`, audited.
- **Coarse answers only:** `ok` plus `model`, `firmware`, channel count; failures as `source_unavailable`,
  `source_forbidden` (bad credentials), `source_error`, `host_refused`, `timeout`. No response bodies, headers, resolved
  addresses or exception text are echoed.
- No database write except one audit row `nvr.connection.test` (vendor, outcome code; no host when refused, never a
  password).
- Device I/O runs outside any write transaction (`with unlocked(conn)`), never while holding the SQLite write lock.

### 6.4 Save

Save runs the test server-side first (as today). If it fails with `source_unavailable` or `timeout` and the body carries
`save_untested:true` **and** `confirm_text` equal to the typed confirmation word ("שמור"), the row is saved with
`state='ok'` and an audit flag `untested:true` (D6: NVR offline during installation). `source_forbidden` and `host_refused`
can never be saved untested. Then one short transaction writes the row, `revision+1`, and the audit row. Device I/O is
never inside that transaction.

### 6.5 Remove NVR and vendor change

`DELETE /nvr/connection` (typed confirmation, the word "הסר"): clears `password_enc` and `secret_json_enc`, sets vendor
`none`, host NULL, `revision+1`; every camera of the recorder is set `enabled=0` (rows, maps, anchors, bindings and
permissions kept; NN1 rule); restart required; audit `nvr.connection.remove`. `nvr.legacy_import_done` stays set, so the old
options are **not** re-imported (§7).

A `PUT` that changes `vendor` (other than from `none`) on a recorder that has camera rows is refused 409
`remove_first` (D7). After "Remove NVR" any vendor can be chosen; the cameras stay disabled until rediscovery and the
installer's review (identity matching across vendors is out of scope, ADP §3).

## 7. One-time import of the add-on options

`connection_store.import_legacy(settings, conn)`, inside `load_effective`, runs only when **no row exists**, the setting
`nvr.legacy_import_done` is not set, and the options carry a non-placeholder `nvr_host`:

- Inserts the row: `vendor='hikvision'`, host, ports, user, encrypted password, `source='addon_import'`, `revision=1`;
  host without password => `state='incomplete'` (Settings shows "חסרה סיסמה").
- Sets `nvr.legacy_import_done`, writes audit `nvr.connection.import` with the system actor, logs one INFO line without
  values. One transaction; idempotent (a second start-up finds the row or the flag and does nothing).
- If the key cannot be created or the encryption fails, nothing is written and start-up continues on the options (the
  installation behaves as before); one WARN line, no values.
- After the import the row wins; the options are ignored. When the options still hold a different host, one WARN
  ("legacy add-on NVR options are ignored") and `legacy_options_differ:true` in the GET (Settings shows one neutral line).
- **The options are never written** (D4): a downgrade to 0.1.156 or older keeps working; no Supervisor write is needed.
  The keys stay in `config.yaml` (options + schema) for at least two releases, marked deprecated in the add-on description
  and `DOCS.md`. A "clear the legacy credentials from the add-on options" button is **not** part of this CR (it would need a
  verified Supervisor write, §15 R3).

Existing installations behave identically after the upgrade: same host, same mode, same streams.

## 8. Restart semantics

- Save and Remove never swap `app.state.settings` in-process (ends today's half-applied state). The process keeps
  `loaded_revision`; `GET /nvr/connection`, `/me` (for `system.configure` holders) and `/health` expose
  `connection_pending_restart` when the row revision differs, so the banner survives page reloads and other admins see it.
- The Restart button calls `POST /system/restart` (system_admin, confirmation dialog, at most 1 per 2 minutes - the time of
  the last accepted restart is stored in `settings`, so the guard survives the restart it guards (§20) -, audited
  `system.restart`) which uses the existing `supervisor_post(settings, "/addons/self/restart")` (`hassio_api` default role;
  verified in code, not live, §15). Outside the add-on the answer is 409 `restart_manual` and the screen says to restart the
  service manually. **No auto-restart** (D3): an installer may be mid-wizard.
- After the restart the go2rtc `smplwise_*` streams are rebuilt with the new credentials by the existing stream sync after
  discovery; stale `smplwise_` sources are refreshed, foreign streams are never created, changed or deleted.
- Coordination with CR-021: CR-021 adds its own Supervisor calls (`system_update.py`, platform restart). The add-on restart
  here is a separate, smaller route; if CR-021 has merged first, slice B reuses its Supervisor helper rather than adding a
  second one.

## 9. Backup and restore

- `recorder_connections` is **not** in `PROJECT_TABLES`; `connections.key` is outside `files/`; neither is ever read from an
  archive (a restore cannot smuggle a connection in). Since the security review (F1) this holds for files too: a restore
  writes only the plan files the archive's own rows reference, under `plans/`; an archive member naming `keys/`, a database
  file, `options.json`, an absolute or `..` path, or any unreferenced file is ignored and counted in `files_skipped`, and an
  archive row whose file column points outside `plans/` is skipped. Guard test with a forged archive.
- A new guard test fails if any table with a column named like `password`, `secret`, `token` or `*_enc` enters
  `PROJECT_TABLES` or a diagnostic bundle (covers WisKey and alarm tables too).
- **Replace** restore keeps the row (keep-when-absent semantics, like `KEEP_WHEN_ABSENT`); `nvr.legacy_import_done` is in
  `SETTINGS_KEEP`.
- Restore onto **another** installation: the `recorders` and `cameras` rows travel, the connection does not; the wizard's
  NVR step returns to "todo" and Settings asks for the connection.
- The platform's own add-on backup (includes `/data`) contains the database and the key together; documented in `DOCS.md`
  as the same class as `options.json` today (§3.3).
- Key lost or copied without the database (or the reverse): state `connection_unreadable`, Settings says the password must
  be entered again; start-up never fails on it.

## 10. RBAC, audit, remote channel

- `system.configure` for every route in §6.2 (D5); no `roles.json` change. Tests assert that only `system_admin` holds it and
  that no custom role can carry it (`sensitive_permissions_not_implied` / `SYSTEM_PERMISSIONS`).
- Audit actions: `nvr.connection.update`, `nvr.connection.test`, `nvr.connection.import`, `nvr.connection.remove`,
  `system.restart`. Details: vendor, ports, names of the changed fields, `password_changed`, `untested`; host kept (admin-only
  audit view, as today); never the password, ciphertext or key. Denied attempts audited as everywhere.
- Remote channel (CR-008, `remote_channel.py`): every route of §6.2 answers 404 on the remote path; test.
- `GET /nvr/vendors` is admin-only as well (nothing leaks to non-admins, including which vendors exist).

## 11. UX (operator language)

Rules: no platform branding ("Home Assistant", "add-on", "Ingress", "Supervisor") on any screen of this CR; the restart
target is called "המערכת" and the platform "תשתית המערכת" where unavoidable; clean operator screens (no hint paragraphs,
no badges, short confirmations); RTL with numbers, hosts and ports kept LTR; desktop, tablet and phone.

- **Shared component** `F/components/nvr-connection-form.ts` (new), used by the wizard and by Settings: vendor dropdown
  (planned vendors greyed with "בקרוב"), the vendor's fields, password as write-only ("הוגדרה סיסמה" + "שנה"), buttons
  "בדוק חיבור" / "שמור" / "הסר NVR". The password field is cleared after save; the form never holds the stored password.
- **Test result:** one line: "מחובר · <model> · <n> ערוצים" or a short error ("לא ניתן להתחבר", "שם משתמש או סיסמה שגויים",
  "כתובת לא מותרת").
- **Offline save (D6):** after a failed reachability test, "שמור בכל זאת" opens a dialog that requires typing "שמור".
- **Remove NVR (D7):** dialog requiring typing "הסר"; one line saying the cameras stay disabled.
- **Vendor change with cameras:** the dropdown is locked with one line "יש להסיר את ה-NVR לפני החלפת סוג".
- **Restart banner:** "נדרשת הפעלה מחדש כדי להחיל את השינוי" + button "הפעל מחדש" (confirm dialog); outside the add-on: "יש
  להפעיל מחדש את השירות".
- **Setup wizard:** step "NVR" becomes choose type → fields → test → save; "done" for a tested (or confirmed-untested)
  connection or for an explicit "ללא NVR"; "todo" when nothing was chosen. Every "Add-on options" wording is removed from
  `setup_wizard.py`, `mode.py`, `system-setup.ts`, the no-NVR panel and the user guide.
- **Settings:** the existing connection card in `system-setup.ts` is replaced by the component (minimises the diff NN1 P2
  will make there).

## 12. Dependencies and order

1. CR-020 S2 (migration 0050) and CR-021 (0051) merged on `g0/intake` (migration contiguity per `release_check.py`).
2. NN1 P1 (`pilot/nn1-p1-capabilities`) merged; the NN4 backend rebases on it (shared touch points `mode.py`,
   `setup_wizard.py`, `main.py`, `routers/me.py`).
3. Slice B, then C, then D; B and C ship together in one tier-L release.

## 13. File-conflict map

| File | NN4 change | Other work touching it | Rule |
|---|---|---|---|
| `B/routers/nvr_write.py` | delete old `/nvr/connection` handlers | CR-020 S2 (rollback path) | new router first; delete only after S2 merges, separate commit |
| `B/services/nvr_system.py` | remove Supervisor-options save, keep `connection_view` shape | - | B |
| `B/main.py` | one `load_effective` call in lifespan | CR-020 S2, CR-021 (small edits) | trivial rebase |
| `B/mode.py`, `B/services/setup_wizard.py`, `B/routers/me.py` | effective settings, texts, pending flag | NN1 P1 | NN1 P1 first |
| `B/config.py` | `nvr_vendor`, `nvr_extra`; drop `nvr_connection.json` | - | B |
| `B/services/recorders/registry.py` | `VendorSpec` | CR-020 S2 edits `base.py`, `hikvision.py` (not `registry.py`) | do **not** touch `base.py`, `hikvision.py`, `nvr.py`, `nvr_settings.py` |
| `B/roles.json`, `B/routers/access.py` | none | CR-020 S2, CR-021 | not touched |
| `B/services/backup.py` | `SETTINGS_KEEP` + keep-row on replace | - | B |
| `B/remote_channel.py` | deny the new routes | - | B |
| `B/migrations/0052_recorder_connections.sql` | new | NN1 P4 (planned 0052/0053) | NN1 P4 renumbers to 0053, drops `recorder_credentials` |
| `F/screens/system-setup.ts` | swap card for component | NN1 P2 | component first |
| `F/screens/system-wizard.ts` | vendor step | - | C |
| `F/shell/sw-app.ts`, `F/shell/nav.ts` | no-NVR panel copy only | CR-021 S2-S4 | copy into a constant in a new file, or edit after CR-021 merges |
| `F/screens/system-update.ts` | none | CR-021 | not touched |
| `smplwise_vms/config.yaml`, `smplwise_vms/DOCS.md` | deprecation marks, backup sentence | - | D |
| `docs/architecture/NVR_VENDOR_ADAPTERS.md` | §4/§7 `connection_ref` redundant | CR-020 | D |

## 14. Slices, estimates, models

| Slice | Content | Agent-hours | Model | Tier |
|---|---|---|---|---|
| A - contract (this document) | CR EN + HE summary, security audit amendment EN/HE | 3-4 (done) | Opus | none |
| B - backend | migration 0052, `services/connection_store.py` (crypto, CRUD, import, overlay), `VendorSpec`, `routers/nvr_connection.py`, restart route, pending flag in `/me` and `/health`, wizard logic and texts, `mode.py` messages, backup exclusion + guard test, remote deny, go2rtc refresh test, API inventory, the backend ATs | 12-15 | **Opus** (secrets, crypto, RBAC ordering, SSRF) | **L** |
| C - frontend | `nvr-connection-form.ts`, wizard vendor step, Settings card swap, restart banner, copy changes, forbidden-word scan, fixture backend extension, Playwright desktop/tablet/phone + RTL | 9-12 | **Sonnet**, Opus review of copy and permission states | M alone, **L** released with B |
| D - closing | EN/HE user guide, `NVR_LESS_MODE(_HE).md`, `DOCS.md` (options deprecated, backup sentence, threat-model note), ADP §4/§7, bilingual release notes, test catalogue + `project_status.py --write`, security review record | 3-4 | Sonnet | - |

Total B-D: 24-31 agent-hours, one tier-L release (full backend suite + full Playwright suite on the dist preview,
security review before release per `TEST_POLICY.md`: secrets, permissions, request bodies).
Outside CR-022: Provision-ISR adapter (NN1 P6, blocked on a read-only lab probe) and Frigate plug into `VENDORS` +
`VendorSpec` when ready.

## 15. Risks

| # | Risk | Mitigation |
|---|---|---|
| R1 | The import misreads options and breaks a working installation | Idempotent, transactional import; unit tests on real option shapes; options untouched; downgrade-safe; key failure falls back to options |
| R2 | Key file lost or copied without the database | `connection_unreadable` state, "enter the password again"; never a start-up failure; documented in backup guidance |
| R3 | Supervisor options behaviour unverified (0.1.71 write never exercised live; fate of keys dropped from `schema` unknown) | Design never writes options; keys kept two releases; any clear-options button needs a lab check and its own approval |
| R4 | `supervisor_post("/addons/self/restart")` not verified live on the owner's installation | AT-022-16 on the owner's word; until then the button falls back to the manual-restart message on any Supervisor error |
| R5 | Merge conflicts (`nvr_write.py`, `main.py`, `system-setup.ts`, `sw-app.ts`) | New files, ordering of §12, map of §13 |
| R6 | Picker shows "coming soon" vendors that slip | D1 accepted; entries are data in `VendorSpec`, removable without UI work |
| R7 | Stale go2rtc stream credentials after a change | Refresh-on-restart test; namespace guard |
| R8 | The test endpoint used as a LAN scanner | Admin-only, rate limit, coarse codes, source policy, audit |
| R9 | Overstated protection claims | §3.3 is the only wording allowed; review checks UI and docs text |
| R10 | Restart route as a denial of service | system_admin, confirm, 1 per 2 minutes, audited |

## 16. Acceptance tests

Fixture = `tests/fixtures/fake_devices.py` (fake NVR with a request log) and a fake Supervisor; real = the owner's
installation, only on his word. UI tests need desktop / phone / RTL screenshots of loading, empty, error and ready.

| AT | Slice | Test | Kind |
|---|---|---|---|
| AT-022-01 | B | Encrypt/decrypt round trip; tampered ciphertext, wrong AAD (other row or field) and wrong key all fail closed | unit |
| AT-022-02 | B | The password (and its ciphertext) appears in no API response, audit row, log capture, error payload, `Settings` repr, `/me`, `/health` or diagnostic bundle (canary value scanned everywhere) | fixture |
| AT-022-03 | B | `GET /nvr/connection` shape: `has_password`, no password; compatible keys with 0.1.71 | fixture |
| AT-022-04 | B | Permission matrix: every role except `system_admin` gets 403, audited, **before** validation and with zero NVR requests; no custom role can hold `system.configure` | fixture |
| AT-022-05 | B | PUT validation: bad host forms (scheme, path, `@`, too long), ports, unavailable vendor, `extra` field rejected (422 codes) | fixture |
| AT-022-06 | B | Test endpoint: GET only (fake NVR log has zero non-GET), no DB write except the audit row, coarse codes, no body echoed | fixture |
| AT-022-07 | B | SSRF: loopback, link-local, metadata, Supervisor, self, a name resolving to loopback - all `host_refused`, no connection attempted; RFC 1918 allowed; redirects not followed | fixture |
| AT-022-08 | B | Rate limit 5/min/user → 429 `rate_limited`, audited | fixture |
| AT-022-09 | B | Import: fresh options imported once; second start-up no-op; placeholder host not imported; host without password → `incomplete`; key failure → nothing written, options still used | fixture |
| AT-022-10 | B | After "Remove NVR" the options are **not** re-imported on the next start-up | fixture |
| AT-022-11 | B | Precedence row > options > env; vendor `none` → `ha_only`; unreadable key → `connection_unreadable`, start-up completes | fixture |
| AT-022-12 | B | Save answers `restart_required`, does not change `app.state.settings`; `connection_pending_restart` true until a restart with the new revision | fixture |
| AT-022-13 | B | Offline save: without typed confirm 422 `confirm_required`; with it saved and audited `untested`; `source_forbidden` never saved untested | fixture |
| AT-022-14 | B | Vendor change with cameras → 409 `remove_first`; Remove disables cameras, keeps rows and bindings, clears secrets | fixture |
| AT-022-15 | B | Restart route: system_admin only, confirm required, rate-limited, audited; fake Supervisor receives exactly `/addons/self/restart`; outside the add-on 409 `restart_manual` | fixture |
| AT-022-16 | B | Restart and import verified on the owner's installation (read of `options.json`, one restart) | **real**, owner's word |
| AT-022-17 | B | Backup/bundle contain neither the table nor the key; replace restore keeps the row; restore onto a fresh installation leaves the wizard step "todo"; guard test on secret-like columns | fixture |
| AT-022-18 | B | Remote channel answers 404 for every CR-022 route | fixture |
| AT-022-19 | B | After a credential change and restart, stale `smplwise_*` go2rtc sources are refreshed; foreign streams untouched | fixture |
| AT-022-20 | B | `mode.py` and wizard texts contain no "add-on options" wording; existing `test_nvr_less.py` and `test_nvr_system.py` stay green | fixture |
| AT-022-21 | C | Vendor dropdown from the catalogue (planned vendors not selectable), write-only password cleared after save, test then save, offline-save and remove dialogs with typed words | Playwright |
| AT-022-22 | C | Restart banner survives reload and appears for a second admin; button flow with fake Supervisor | Playwright |
| AT-022-23 | C | Wizard NVR step: Hikvision path and "ללא NVR" path both reach "done"; nothing chosen stays "todo" | Playwright |
| AT-022-24 | C | Forbidden-word scan (platform branding) on all CR-022 screens; RTL, phone, tablet | Playwright |

## 17. Recorded contradictions and deviations

1. **Secrets in the database** (audit §3, `DOCS.md`): resolved by §3 of this CR as a narrow owner-approved exception; the
   audit sentence now points here. `DOCS.md` still describes the released behaviour and changes in slice D, with the release.
2. **ADP §4 `connection_ref='addon'`** becomes redundant; amended in slice D, not silently.
3. **NN1 P4 migration numbers** (0052/0053) collide with this CR; coordinator to renumber (§4).
4. The 0.1.71 Supervisor-options save path is removed, not migrated; it was never verified live.

## 18. Open points (coordinator, not owner)

1. Confirm NN1 P4 renumbering to 0053 and the drop of `recorder_credentials`.
2. If CR-021 merges first, slice B reuses its Supervisor helper for the restart call.

## 19. Slice B implementation notes and deviations (2026-10-03, `pilot/nn4-backend`)

Built: `migrations/0052_recorder_connections.sql`, `services/connection_store.py` (crypto, CRUD, import, overlay),
`services/connection_probe.py` (validation, source policy, GET-only probe, rate limits), `services/addon_restart.py`,
`services/recorders/registry.py` (`VendorSpec`, `catalogue`, `constructor_for`), `routers/nvr_connection.py`, the
`main.py` start-up overlay, `connection_pending_restart` in `/me` and `/health`, wizard NVR step and texts, `mode.py`
texts, backup `SETTINGS_KEEP`, the remote deny list, and `tests/test_nvr_connection.py` (AT-022-01 ... 15, 17 ... 20).
Recorded deviations, none of them widening a permission or a secret's reach:

1. **Old handlers deleted now.** The base of `pilot/nn4-backend` already contains CR-020 S2 (0050) and CR-021 (0051), so the
   0.1.71 `GET/PUT /nvr/connection` handlers in `routers/nvr_write.py`, `nvr_system.supervisor_post/_options`,
   `with_connection`, `save_connection` and the workstation `nvr_connection.json` were removed in slice B (§13 allowed this
   after S2). No code writes the add-on options any more.
2. **Restart answers 202 and calls the Supervisor after the answer is sent** (a FastAPI background task): the restart ends the
   process, so its outcome cannot be returned. An unaccepted restart is logged; the screen (slice C) falls back to
   "restart by hand" when the system does not come back. R4's "fall back on any Supervisor error" is therefore client-side.
   CR-021's `self_update.call` stays allow-listed to its own S1 calls; `addon_restart` has its own single allow-listed call.
3. **The import reads only values that came from the options file** (`Settings.nvr_from_options`); `NVR_*` environment
   values (development, tests) are never imported - they stay a fallback below a stored row.
4. **Unreadable connection = no NVR host** (`capabilities.nvr_host()` returns None): the installation runs NVR-less until the
   password is entered again; `/health` shows `nvr.state = unreadable`, the wizard's NVR step fails with
   `connection_unreadable`. Start-up never fails on it.
5. **NVR step without a host:** `todo` (`nvr_choice_needed`) until a choice, `done` for vendor `none`, `failed` for an
   unreadable row. The camera step stays "not applicable" in the NVR-less mode. An NVR-less installation upgraded from an
   older version therefore shows the NVR step as "todo" once, until "no NVR" is chosen explicitly.
6. **PUT body compatibility:** `user` is accepted as an alias of `username`; an absent `password` keeps the stored one (as in
   0.1.71) when the destination is unchanged (§6.2, §20). *Superseded by §20:* `if_revision` was optional here; it is now
   mandatory on PUT and DELETE. Failure answers: `source_unavailable` / `timeout` /
   `source_error` 503, `source_forbidden` 502, `host_refused` / `host_invalid` / `port_invalid` / `vendor_not_available` /
   `username_required` / `password_required` / `extra_invalid` / `confirm_required` 422, `remove_first` / `stale` 409.
7. **`legacy_options_differ`** is also true after "Remove NVR" while the old options still name a host (they are ignored; the
   neutral note stays honest).
8. **`/health.connection_pending_restart`** is a boolean for every signed-in caller (no connection detail); `/me` carries it for
   `system.configure` holders only.
9. **Source policy additions:** besides `source_policy` (loopback, unspecified, link-local / metadata, multicast, 0/8 in every
   spelling) the test refuses `supervisor`, `hassio`, `homeassistant`, `metadata*` names, the platform network
   172.30.32.0/23, the trusted proxies and this host's own name and addresses. IPv6 literals are stored bare and bracketed
   when a URL is built.
10. **"Diagnostic bundle":** Arx has no diagnostic bundle that reads database tables; the case evidence bundle
    (`services/bundle.py`) packs case files only. The guard test covers every backup table (`PROJECT_TABLES`,
    `ACCESS_TABLES`, `OPTIONAL_TABLES`) for secret-like columns.
11. **Not in slice B (by plan):** the frontend (slice C); `config.yaml` deprecation marks, user guides, `NVR_LESS_MODE(_HE).md`,
    release notes, test catalogue (slice D); AT-022-16 (real installation, owner's word); AT-022-21 ... 24 (Playwright, C).

## 20. Security review fixes (2026-10-04, branch `pilot/nn4-security-fixes`)

The independent review of slice B (findings F1-F16, private review note of 2026-10-03, base `4d89458b`) was answered on
`pilot/nn4-security-fixes`. Regression tests: `tests/test_cr022_security_review.py`; each fails on `4d89458b` and passes after,
except three guards that pass on both. No device, platform or network was contacted.

| # | Finding | Change |
|---|---|---|
| F1 | A restore wrote any `files/<path>` (key, database, options) | Allow-list (`backup.restorable`): referenced plan files under `plans/` only; rows pointing elsewhere skipped; `files_skipped` in the answer |
| F2 | The stored password could be sent to any host | Re-typing required on any change of vendor, host, HTTP or RTSP port (§6.2); a deviation from the earlier CR text |
| F3 | An unresolved name went to httpx (a second, unchecked resolution) | Never connected: `source_unavailable` |
| F4 | Per-operation timeout only, no size cap, 4 GETs | Own client: 5 s connect, 5 s read, 8 s deadline, 256 KB per answer, 2 GETs (deviceInfo, channel list) |
| F5 | The stored name was trusted at run time | Re-checked with the source policy once per start; a refused host = state `refused`, the NVR is treated as not configured |
| F6 | The restart limiter lived in memory | Persisted timestamp `system.addon_restart_at` (in `SETTINGS_KEEP`); a clock that went back never blocks. CR-021's platform restart is untouched (no guard, owner decision) |
| F7 | `host_refused` on PUT not audited | Audited (`nvr.connection.update` / `.test`, denied, reason and vendor, never the host) for `host_refused`, `port_refused`, `destination_changed` |
| F8 | NAT64 / 6to4 / Teredo forms | The IPv4 inside NAT64 (`64:ff9b::/96`, `64:ff9b:1::/48`) and 6to4 (`2002::/16`) is judged like a literal; Teredo `2001::/32` and site-local `fec0::/10` refused; IPv4-mapped was already covered |
| F9 | The machine's own LAN address | Interface addresses (Linux `/proc/net`) refused; the platform's service ports refused on any host |
| F10 | `if_revision` optional, checked before the probe | Mandatory on PUT and DELETE; re-checked under the write lock after the probe |
| F11 | `nvr_connection.json` (plaintext) left behind | Zeroed, flushed and deleted at start-up; idempotent; one INFO line without values |
| F13 | Key file mode, directory flush | Mode tightened to 0600 on read (POSIX); the key directory is fsynced after creation; (c) and (d) accepted as the review proposed |
| F14 | Device text and user name | Control characters stripped from model / firmware; a user name with control characters is 422 `username_invalid` |
| F16 | The import could take `NVR_PASSWORD` from the environment | Only values the options file carried (`Settings.nvr_option_keys`); an invalid host or port is not imported (nothing written, the options stay in use) |
| F12 | `/health.connection_pending_restart` visible to every signed-in user | Kept (a boolean only, deviation 8) |
| F15 | The old Settings card still says the options apply immediately | Slice C replaces it; B and C ship together (§12) |

### 20.1 Contract changes for the frontend (slice C)

| Route | Change | Kind |
|---|---|---|
| `PUT /nvr/connection` | `if_revision` **required** (the `revision` from GET, `0` before any save): absent = 422 `revision_required` (`details.field = "if_revision"`); a mismatch, also one caused by another save while the test ran, = 409 `stale` (`details.revision`) | breaking for a client that omits it |
| `DELETE /nvr/connection` | The body gains `if_revision` (required, same codes) | breaking for a client that omits it |
| `PUT` / `POST .../test` | A kept / stored password with a changed vendor, host, HTTP or RTSP port: 422 `password_required` with `details = {field: "password", reason: "destination_changed"}`; the form clears "הוגדרה סיסמה" and asks for the password | new reason on an existing code |
| `PUT` / `POST .../test` | New 422 `port_refused` (`details.field` = `http_port` or `rtsp_port`): a port of the platform's own services | new code |
| `PUT` / `POST .../test` | New 422 `username_invalid` (`details.field = "username"`): control characters | new code |
| `POST .../test`, `PUT` | An unresolvable name: `{ok:false, code:"source_unavailable"}` (PUT: 503, `can_save_untested:true`) without any connection | behaviour, same shape |
| `GET /nvr/connection`, `/health` (`nvr.state`), `/setup/state` | New state value `refused` (the stored host failed the policy at start-up); wizard problem code `connection_refused` | new value |
| `POST /backups/{name}/restore` | The answer gains `files_skipped` (integer) | additive |
| `POST /system/restart` | 429 `rate_limited` also right after a restart (persisted guard) | behaviour |

UI binding requirement (F14): `model`, `firmware`, `username`, `host` and every other device-sourced string are bound as
**text** only (Lit text bindings, never `unsafeHTML` / `innerHTML`); the password field is never pre-filled.

### 20.2 Open items

1. The platform's internal IPv6 network is not in the refused list: its prefix could not be verified from this repository's
   documents (the review named one from memory). Needs a read-only check on a real installation, on the owner's word.
2. Inside the add-on container the host machine's LAN address is not visible (no host network); the refused service ports
   (F9) are the mitigation. A lookup through the platform's network API was not added (it would be a new outgoing call).
3. F5 is checked once per start; the NVR client still resolves a stored name on each request afterwards (DNS rebinding after
   start-up stays a documented residual; an IP address avoids it). The start-up check resolves the name once (at most 2 s).
4. The legacy-file overwrite (F11) cannot guarantee erasure on copy-on-write or flash storage; the deletion is guaranteed.
5. The 8 s deadline is enforced between reads; a single read is also bounded by the remaining time where the HTTP library
   reads its timeout per receive (best effort), otherwise by the 5 s read timeout.

## 21. Integration of slices B and C with the review fixes (2026-10-04, branch `pilot/nn4-integrated`)

`pilot/nn4-integrated` = `pilot/nn4-security-fixes` (5ea0365b) + a merge of `pilot/nn4-frontend` (52f635cf); no branch rewritten.

1. **Wizard NVR step (the one conflict, `services/setup_wizard.py` `nvr_choice_step`).** Both behaviours kept; the function takes
   `Settings` again. Order for an installation without an NVR host: vendor `none` = `done`; the row this process loaded at
   start-up (stored revision = loaded revision) with state `refused` = `failed` / `connection_refused`; a readable row (in practice
   one saved after the start) = `todo` / `restart_pending`; an unreadable row = `failed` / `connection_unreadable`; no row =
   `todo` / `nvr_choice_needed`. A refused host that is replaced by a new save is "waiting for the restart", not "refused".
   Tests: slice C's `test_a_just_saved_connection_leaves_the_nvr_step_todo_until_the_restart` kept; the F5 test also checks the step.
2. **UI bound to §20.1.** The temporary DELETE fallback (a retry without `if_revision` on a 422 from the pre-review backend)
   is removed; `if_revision` is required in the client types. `password_required` (with or without `details.reason =
   destination_changed`) clears "הוגדרה סיסמה" and asks for the password; `port_refused` / `username_invalid` give one short
   line and mark the named field (`aria-invalid`); `revision_required` is handled like 409 `stale` (the "טען מחדש" prompt, saving
   blocked until then); state `refused` opens the form with its note; the restore answer shows `files_skipped` when non-zero.
   The old settings card (`system-setup.ts`) calls no removed route (it embeds the shared form; F15 closed).
3. **Fixture backend of the live spec.** The connection test now connects only to an address it resolved and checked (F3), so
   `frontend/tests/fixtures/nvr_connection_backend.py` replaces the probe's resolver: the fake NVR's name resolves to its
   documentation-range address (the fake answers it), every other name to nothing. No real DNS lookup, device or platform.
4. **Second security review (private re-review note of 2026-10-04, base `5ea0365b`), fixed on this branch.** Regression tests:
   `tests/test_cr022_security_rereview.py` (each new case failed before the fix).
   - N1 (medium): with no stored destination (no row, a "no NVR" row, no legacy host) no stored or legacy password is used
     at all; "use the stored password" answers 422 `password_required` (test and save).
   - N2: the 8 s deadline is hard. Every socket read and write of the probe is bounded by the time left (the probe's own
     network backend under httpx), also while waiting for the response headers (an endless series of `100 Continue`); the
     probe runs in its own thread and its sockets are shut down if it is still running at the deadline. Tested with a local
     socket server on 127.0.0.1.
   - N3: `Accept-Encoding: identity`; any other `Content-Encoding` is `source_error`; raw bytes are counted against the cap
     (nothing is inflated before the cap).
   - N9: the probe client ignores proxy settings of the environment (`trust_env=False`). N6: the whole local-use NAT64 range
     `64:ff9b:1::/48` is refused (the well-known `64:ff9b::/96` is still judged by its embedded IPv4).
   - N4: the per-request read-timeout tweak (read only once by the HTTP library) and its wrong comment are removed.
   - Information only, recorded as open items: N5 (the legacy-file wipe follows a symbolic link; a symbolic link already
     inside `plans/` passes the restore's path check - both need write access to the system's files), N7 (bidirectional and
     zero-width characters are not removed from device text or the user name; visual only), N8 (the start-up host check
     resolves DNS inside the start-up write transaction, up to about 4 s when DNS is down).
5. **Not changed by the integration:** `smplwise_vms/DOCS.md`, the migration, the API inventory, the version. The open items of
   §20.2 stay open (owner decisions).
