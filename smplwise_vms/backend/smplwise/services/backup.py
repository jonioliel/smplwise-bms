"""Project backups (T026 / T036): one zip with the project tables as JSON and the plan files. Written before
every version upgrade (rollback safety), once a day, on request, or uploaded by an administrator; restored in
a single transaction. Never contains secrets in the clear (the NVR connection's table and every key file stay out, CR-022 section 9;
the local accounts' password hashes and the HMAC keys in `backup_sensitive.SENSITIVE_SETTINGS` travel only in the section encrypted
with the administrator's backup password, BACKUP-HASH-ENC) and never video. A restore writes only the plan files its own rows reference (`restorable`): an archive member naming a key, the
database, the add-on options or any other path is ignored (CR-022 security review F1)."""
from __future__ import annotations

import asyncio
import datetime as dt
import io
import json
import logging
import re
import sqlite3
import zipfile
from pathlib import Path
from typing import Any

from .. import __version__
from ..config import Settings
from ..db import Database, bump_permission_revision, get_setting, set_setting
from . import backup_sensitive as sens

log = logging.getLogger("smplwise.backup")

FORMAT = 1
PROJECT_TABLES = ["settings", "sites", "buildings", "floors", "plan_assets", "plan_versions", "plan_geometry", "catalog_items", "map_anchors", "recorders", "cameras", "spatial_zones", "floor_images", "floor_image_layout", "shared_spaces", "shared_space_members", "cases", "case_items", "saved_views", "device_layouts", "alarm_zone_overrides", "notify_settings", "notify_policies", "device_bulk_protected", "device_switch_classified"]
# CR-023: every electricity table (meters and billing) is listed ONCE, in services/energy_backup (MAIN_TABLES,
# KEEP_WHEN_ABSENT, FILE_COLUMNS); the restore allow-list below is built from these lists.
from . import energy_backup as _energy_backup  # noqa: E402

PROJECT_TABLES = PROJECT_TABLES + [t for t in _energy_backup.MAIN_TABLES if t not in PROJECT_TABLES]
# CR-WATER78 slice 1: the water meter registry (migration 0150), listed once in services/water_backup (the energy pattern).
from . import water_backup as _water_backup  # noqa: E402

PROJECT_TABLES = PROJECT_TABLES + [t for t in _water_backup.MAIN_TABLES if t not in PROJECT_TABLES]
# NN5-F2 (2.2.0 gap): the Frigate write-class tables. The class approvals (frigate_write_policy), the change log with the data to undo
# (frigate_changes), the alarm-state -> profile mapping (frigate_profile_rules) and the per-user reviewed state with its mirror columns
# (frigate_review_state: mirrored_at / mirror_error) travel with the project. NOT included: frigate_reviews and frigate_sync_state
# (re-polled from Frigate), camera_links (no behaviour yet). A restore never touches Frigate; it only brings back Arx's own records.
FRIGATE_TABLES = ["frigate_write_policy", "frigate_changes", "frigate_profile_rules", "frigate_review_state"]
PROJECT_TABLES = PROJECT_TABLES + [t for t in FRIGATE_TABLES if t not in PROJECT_TABLES]
# DEVTYPE (owner 2026-10-09): the administrator's fixed device types (migration 0073). An archive written before the table keeps the
# current rows (KEEP_WHEN_ABSENT): an older backup must not silently send every fixed type back to the name-based guess.
# 2.4.4 (owner 2026-10-10): the climate-kind override (migration 0040: an administrator's "air conditioning" / "heating" group of a
# climate entity) travels the same way - it was missing from the archive, so a restore onto a new installation lost it.
DEVICE_TYPE_TABLES = ["device_type_override", "device_climate_kind"]
PROJECT_TABLES = PROJECT_TABLES + [t for t in DEVICE_TYPE_TABLES if t not in PROJECT_TABLES]
# CR-029 S0 (Plan Studio 6): each person's own look override of the realistic 3D (plan_view_prefs, migration 0074); the
# installation's dials are the `plan.view` setting (already in `settings`). An archive written before the table keeps them.
PROJECT_TABLES = PROJECT_TABLES + ["plan_view_prefs"]
# CR-029 S3: the stills, room masks and lightmaps of every floor (plan_bakes, migration 0075; files under plans/bakes/). The
# regenerate requests (plan_bake_jobs) are runtime state and stay out. An archive written before the table restores no bake: the
# floors show their live view until an editor bakes again (a replace restore sweeps the files nobody names).
PROJECT_TABLES = PROJECT_TABLES + ["plan_bakes"]
# DOORHARD-295 (owner answer CR-AUTODOORS-295 12.3, 2026-10-21): the "open a door" blocks travel with the project (migration 0133) but a restore
# NEVER revives one: every restored block comes back `disarmed` (reason `restored`) and a person arms it again - see `_disarm_restored_blocks`.
# Their fire history (`door_automation_fires`: the cooldown / cap counters and the block's decisions) is runtime state: never exported, never
# restored (NEVER_EXPORTED_TABLES). The `doors.*` switches (feature, kill, limits) are SETTINGS_KEEP_PREFIXES and are never carried either.
PROJECT_TABLES = PROJECT_TABLES + ["door_automations"]
# CR-MAINT215 slice 2 (owner answer 24.10 q18): the maintenance ledger travels with the project - the tasks (certificates, plans, rounds,
# supplier documents), their history (completions and round runs) and the QR / NFC tags (an opaque token; a scan still needs a signed-in
# person who may see the target). Parents first (records and tags name a task). An archive written before the module KEEPS the current rows.
MAINTENANCE_TABLES = ["maint_tasks", "maint_records", "maint_tags"]
PROJECT_TABLES = PROJECT_TABLES + MAINTENANCE_TABLES
# LOGOS-295 (migration 0166): the company logo, base64 text so it travels as JSON with its stamps (the `brand.*` settings). An archive
# written before the table restores no logo and no error; a replace restore of an archive that has the table brings both back with the same stamps.
PROJECT_TABLES = PROJECT_TABLES + ["brand_assets"]
# USR2 (owner answer Q8): the Arx-only identities' password hashes travel with the access part of a project backup (a restore to a
# new host keeps the users) - the rows hold PHC hashes only, and since BACKUP-HASH-ENC (owner 2026-10-17) the hash column travels
# ONLY inside the encrypted sensitive section (backup_sensitive.py; an export without a backup password leaves it out); sessions, links, the failure counters and the TOTP secrets
# (auth_local_sessions, auth_local_links, auth_local_failures, auth_totp*) are never written to an archive. identity_links: the
# manual "same person" link. Listed right after `users` (they reference it).
# USR2 phase 4: the passkeys' PUBLIC keys (auth_webauthn_credentials) travel the same way; WebAuthn challenges exist in memory only.
ACCESS_TABLES = ["users", "auth_local_credentials", "auth_webauthn_credentials", "identity_links", "groups", "group_members", "bindings", "custom_roles",
                 # CR-033: where stations sit (station scope), which relay each WisKey lock is, and the door grant card's own bindings
                 "intercom_station_placement", "intercom_door_map", "door_grant_bindings"]
# USR2-FIX F9 (CR-USR2 §1a.6 "failure counters never travel in a backup"): the per-account failure counter, the ceiling lock and
# who last unlocked it are columns of auth_local_credentials. They are left out of every archive and ignored in an archive that
# has them (an older one), so a restored row starts with the column defaults (no failures, no lock).
NEVER_EXPORTED_COLUMNS: dict[str, frozenset[str]] = {"auth_local_credentials": frozenset({"failed_count", "last_failed_at", "delay_until", "unlocked_by"})}
# USR2 / USR2-P2B: runtime security state of the Arx-only identities. Never written to an archive and never read from one (a
# `replace` restore leaves the rows alone): the sessions, the links, the failure tiers, the TOTP state and the self-service
# reset codes and their send counters (migration 0097 - a restore must neither revive a code nor hand back a fresh daily budget).
# The archive format is an allow-list (PROJECT_TABLES / ACCESS_TABLES / OPTIONAL_TABLES); this set is the guard that none of them
# is ever added to it, checked at import and again by `snapshot`.
NEVER_EXPORTED_TABLES = frozenset({"auth_local_sessions", "auth_local_links", "auth_local_failures", "auth_totp", "auth_totp_failures",
                                   "auth_local_reset_codes", "auth_local_reset_sends",
                                   # CR-WISKEY-HMAC-ROTATION-295: the bridge HMAC key set (sealed material) and its rotation history
                                   "bridge_keys", "bridge_rotations",
                                   # DOORHARD-295: the door-automation fire history (cooldown / cap counters, decisions) is never in an archive
                                   "door_automation_fires",
                                   # ECCACT-295: durable WisKey intents / relay map / feature registry - a restore must never revive an old intent
                                   "wiskey_fence_intents", "wiskey_relay_map", "wiskey_feature_registry", "wiskey_feature_intents",
                                   # APPREFRESH-295: the phone app's refresh-token families and access tokens (hashes only) - a restore must
                                   # never revive a revoked family or an already-used refresh token
                                   "app_refresh_families", "app_refresh_tokens", "app_access_tokens",
                                   # CR-FLEET215: what this installation sent to the fleet receiver - runtime history of THIS box
                                   "fleet_report_log",
                                   # MAINT215B: the certificate files (the bytes are on the data volume and do not travel) and the reminder log (runtime history)
                                   "maint_files", "maint_reminder_log",
                                   # SUPPLIERDOCS-297: document-reading proposals - short-lived drafts tied to maint_files (which do not travel)
                                   "doc_extractions",
                                   # APPREFRESH2-295: the single-use device-key proof nonces
                                   "app_refresh_nonces",
                                   # APPREFRESH3-295: the device-key pins - a restore must neither drop one (a new key would bind without
                                   # the old key's proof) nor revive one
                                   "app_refresh_device_keys",
                                   # SESSIONEXCH2-295: the app WebView sessions and their one-time codes (hashes only) - a restore must never
                                   # revive a session or a code
                                   "app_web_sessions", "app_session_codes",
                                   # PARTNERAPI113-295: partner tokens (hashes), webhook targets and sealed secrets, queued payloads, the delivery log,
                                   # idempotency answers and the partner links of requests - a restore leaves the partner state of the target box alone
                                   "partner_clients", "partner_tokens", "partner_endpoints", "partner_outbox", "partner_deliveries",
                                   "partner_idempotency", "partner_ticket_links",
                                   # ATTEST232-295: hardware-attestation verdicts - a restore must never manufacture a "verified" device
                                   "app_refresh_attestations"})
# CR-019 section 6.6: switch protection is safety state. A `replace` restore of an archive WITHOUT these tables (one written before
# them) keeps the current rows instead of emptying them - an older backup must never unprotect every switch.
# Frigate: the change log and the reviewed state are history, so an archive written before them does not empty them; the write-class
# policy is NOT kept (an older archive without it leaves every class OFF - the default - never a class that happened to be on).
KEEP_WHEN_ABSENT = frozenset({"door_automations", "device_bulk_protected", "device_switch_classified", "frigate_changes", "frigate_review_state", *DEVICE_TYPE_TABLES, "plan_view_prefs", *MAINTENANCE_TABLES}) | _energy_backup.KEEP_WHEN_ABSENT | _water_backup.KEEP_WHEN_ABSENT
OPTIONAL_TABLES = {"audit": ["audit_log"], "events": ["events"]}
if NEVER_EXPORTED_TABLES & set(PROJECT_TABLES + ACCESS_TABLES + OPTIONAL_TABLES["audit"] + OPTIONAL_TABLES["events"]):
    raise RuntimeError("a never-exported table is listed for backup")
FILE_COLUMNS = {"plan_assets": ["storage_path"], "plan_versions": ["image_path", "stylized_path"], "floor_images": ["path"], "plan_bakes": ["path"], **_energy_backup.FILE_COLUMNS}
NAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,120}\.zip$")
KEEP = {"auto-pre-upgrade": 5, "auto-daily": 7}
SETTINGS_KEEP = {"permission_revision", "instance_id", "installation_id", "app.version", "bridge.secret", "bridge.pairing_code", "bridge.paired_at",
                 "multimedia.ma_direct",  # CR-016 17.3: the Music Assistant server address (its token is a file outside the archive)
                 "nvr.legacy_import_done",  # CR-022 section 7: a restore never re-arms the one-time import of the add-on options
                 "system.addon_restart_at",  # CR-022 review F6: the restart guard is local state, never restored
                 # SEC246 L4 (owner 2026-10-11): the self-update switch is the installation's current policy. A restore never takes it
                 # from an archive (an archive written while it was on - or before 2.4.4 - must not switch installing from Arx back on);
                 # the restore answer and its own `system.update.apply_enabled` audit row say what was kept and what the archive held.
                 "update.apply_enabled",
                 "site.ha_location",  # CR-029 S2: the home's location as last read (services/site_location.py) - re-read on connect, never carried
                 # CR-038 (review C4 / T13): the tickets module's switch, its settings document (public address, link durations, send
                 # hours ...), its display name (D33) and the WhatsApp account mapping describe THIS installation - never exported in a
                 # project backup and never restored from one. The module's tables are not project tables either (slice 1 notes,
                 # docs/changes/CR-038-S1-NOTES.md: a replace restore must not delete departments that open tickets reference).
                 "tickets.enabled", "tickets.settings", "tickets.name", "messaging.whatsapp", "messaging.pacing", "messaging.wa_policy",
                 # TKRULES-291: the rules that open tickets from alerts - a restore never switches a rule on or re-routes one
                 "tickets.rules",
                 # CR-NOTICE106: the notice board's switch and whether its TV links open on the remote channel are this installation's
                 # policy - a restore never switches the module on or opens the boards outside the LAN. The module's tables are not
                 # project tables (the tickets precedent: TV board tokens describe this installation's screens). NOTICESLIDES-295: the same
                 # classification for `notice_slides` / `notice_board_slides` (migration 0172: promo slides, the board photos): operational
                 # tables of the module, not in PROJECT_TABLES, because they hang off `notice_boards` ids that an archive does not carry
                 # (tests/test_notice_slides_295.py pins it).
                 "notices.enabled", "notices.boards.remote",
                 # BUSTIMES-295: the bus-times module's switch and stops describe THIS building (a restore must not switch a third-party feed on or
                 # re-aim it); the catalogue snapshot's status describes the local `transit_*` tables, which an archive does not carry
                 "transit.config", "transit.catalogue",
                 # BUSSTATUS-297: the source health (an outage in progress) is runtime state of this installation, not project data
                 "transit.health",
                 # NOTIFWA: the WhatsApp notification channel's master switch - a restore can never switch WhatsApp sending on
                 "notify.whatsapp",
                 # USR2: the Arx-only identity switch is the installation's own policy - a restore never switches local sign-in on
                 "security.local_identity",
                 # SVCIDENT2: the extended mode of the service identity - a restore never switches it on
                 "security.local_identity_extended",
                 # SVCIDENT3 (review S1 a): the scripts / scenes / automations Arx-only users may run - a restore never widens it
                 "security.local_identity_runnable",
                 # SCHEDIMPACT-295: the bridge's last report that it judges a local person's schedules (its schedule fences) - runtime
                 # state; an archive's "true" must never stand in for the live report (a script schedule would go to a bridge without them)
                 "bridge.schedule_fences",
                 # USR2 phase 2: where links sent by WhatsApp point - an archive never re-aims reset links
                 "security.local_public_url",
                 # USR2 phase 4: passwordless sign-in and the Android app association - an archive never switches them on / re-aims them
                 "security.local_passkey_first", "security.local_passkey_android",
                 # CR-WISKEY-LEASE-REVOCATION-EVENT 7.3: the capture-lease route switch, its lease length and the C03 lookup scope are
                 # this installation's security policy - never taken from an archive, so a restore can never loosen them
                 "access.capture_lease", "access.capture_lease_seconds", "access.lookup_scope",
                 # BACKUP-HASH-ENC: the backup password's minimum length is this installation's policy - never loosened by an archive
                 "backup.password_min",
                 # DATASTORE-295: the monthly restore drill's switch is this installation's own schedule - never exported or restored
                 "backup.drill.monthly",
                 # HARDEN271 item 1 (2.7.0 integration notes, open risk 9): what 2.7.0 added that describes THIS installation.
                 # WA-SEND-FIX: the HMAC key of the phone hashes - restored, every number-based opt-out stops matching; exported,
                 # the key sits in the archive in the clear.
                 "access.messaging.phone_key",
                 # people messaging (its `enabled` switch, WA-SEND-FIX caps / send hours, WA-CONSENT-LINK `consent_by_link`): an
                 # archive never switches messaging or consent by link on and never loosens a cap (the notify.whatsapp precedent)
                 "access.messaging",
                 # WISKEYID: the external-grant switch and its limits are security policy - never loosened by an archive
                 "access.external_grants", "access.external.max_days", "access.external.max_doors",
                 "access.external.phone_fresh_days", "access.external.code_hour", "access.external.local_approvers",
                 # PHYSENTRY070-295: the post-assignment entry tick and its vendor notice (default off) - never switched on by an archive
                 "access.external.arrival_after_grant",
                 # K7: the resume cursor of an interrupted grant re-decision is this database's runtime state, never an archive's
                 "access.external.redecide_cursor",
                 # CR-BULKPEOPLE-295: the bulk people switch is security policy too - never switched on by an archive
                 "access.bulk_people",
                # WKR5ADOPT-295 (W-006): the WisKey-verified people CSV preview switch and its authority binding - never from an archive
                "access.people_csv_preview", "access.people_csv_binding",
                 # STATIONPERM-295: the per-station permission switch is security policy - never changed by an archive
                 "access.station_permissions",
                 # COMPLY108-295: the compliance export switch is security policy - never switched on by an archive
                 "access.compliance_export",
                 # SECFIX2-295 / PUB-03: the retention period and the per-vendor cap of vendor-typed technicians (privacy policy)
                 "access.external.pending_retention_days", "access.external.pending_max_per_vendor",
                 # SVCIDENT2: the bridge's last reported copy of the extended switch is runtime state (re-read on the next push)
                 "bridge.local_identity_extended",
                 # EXTID-295 (CR-USR2 13.6, owner decision 3 of 2026-10-21): the bridge's last report that the service user is restricted -
                 # runtime state; an archive's "true" must never stand in for the live report (it would admit extended items until the next push)
                 "bridge.service_policy_restricted",
                # CR-WISKEY-HMAC-ROTATION-295: the key rotation switch and its reminder are this installation's policy - never from an archive
                "bridge.key_rotation", "bridge.key_rotation.reminder_days",
                # BKPFIX-295: the four WisKey ACR5 read switches (wiskey_acr5.FLAGS) are this installation's go-live decision - never exported
                # in a backup and never switched on by a restore (they stay as the installation has them, default OFF)
                "wiskey.acr5_access_state", "wiskey.acr5_normalize_user", "wiskey.acr5_presence", "wiskey.acr5_feature_plans"}
UPDATE_SWITCH_KEY = "update.apply_enabled"
BACKGROUND_ROOT = "ui_backgrounds/"
# CR-022 section 9: `recorder_connections` (the NVR connection with its encrypted password) is deliberately NOT a backup table:
# never written to an archive, never read from one, and a `replace` restore leaves the row alone (it is not in PROJECT_TABLES).
# Its key file lives in keys/, which never enters an archive (`_rel`).
# CR-022 security review F1: what a restore may write into the data directory. Only the plan files the archive's own rows
# reference (FILE_COLUMNS), under these roots, never the key folder, a database file or the add-on options - whatever the
# archive contains. The same rule drops an archive row whose file column points anywhere else (it could steer a later read).
RESTORABLE_ROOTS = ("plans/", "ui_backgrounds/") + _energy_backup.RESTORABLE_ROOTS  # CR-023: stored bill PDFs and business logos (energy/bills/, energy/assets/); CRY: the background pictures
# CR-038 S4 (spec 7.4, public-core notes wiring item 8, W11): the tickets attachments folder may be written by a restore - a root of
# its own, disjoint from every other module's. The ticket tables are operational data and are not in PROJECT_TABLES, so a project
# archive references no ticket file today: the root is what the spec asks, and it lets a later archive kind carry the photos.
RESTORABLE_ROOTS = RESTORABLE_ROOTS + ("tickets/",)
_NEVER_RESTORED_NAME = re.compile(r"(^options\.json$|\.db$|\.db-|\.sqlite|-wal$|-shm$|-journal$|\.key$)", re.IGNORECASE)
# CR-020 S2C security review finding 4: runtime state of the multi-camera batches (the batch record with who started it and
# the request id, its heartbeat, the device lock). Never exported, never restored, never deleted by a `replace` restore -
# a restore in the middle of a batch must not drop the device lock, and an old archive must not bring back a stale one.
# CR-033 section 9: the door settings (`doors.trusted_path`, default `off`) are never exported and never restored - a restore
# can never loosen them (the installation keeps its own, fail-closed value). Simplification recorded in the wave-1 report: the
# CR's "apply the stricter one" also never tightens from an archive.
# CR-FLEET215: `fleet.*` (the consent switch and the last-attempt state) describes THIS installation - an archive never switches the
# fleet report on, and never carries it to another box. READYFLEET-295: `demo.*` (CR-READY96 demo mode; today `demo.allow_remote`) is kept
# the same way - a restore can never allow a remote demo on a box that did not allow it (stricter than CR-READY96's first note, recorded
# in docs/changes/READYFLEET-295.md). PARTNERAPI113-295: `partner.*` (the partner switches and limits) are this installation's policy.
SETTINGS_KEEP_PREFIXES = ("nvr.batch.", "doors.", "fleet.", "demo.", "partner.")
# SAFE2-295 (2.10.0 release notes, open items): the external-grant card switch (GRANTS3-295 X5, `access.external.cards`) is security policy
# like its siblings above (WISKEYID) - never exported, never taken from an archive, so a restore can never switch card grants on.
SETTINGS_KEEP = SETTINGS_KEEP | {"access.external.cards", "privacy.local_purge", "privacy.local_purge_days", "privacy.personal_export"}  # IDENT146: purge / export policy of THIS installation
# APPREFRESH-295: the phone app's persistent sign-in switch and its lifetimes are security policy - never exported, never restored
SETTINGS_KEEP = SETTINGS_KEEP | {"security.app_refresh", "security.app_refresh_absolute_days", "security.app_refresh_idle_days",
                                 "security.app_refresh_access_minutes", "security.app_refresh_admin_absolute_days",
                                 "security.app_refresh_admin_idle_hours"}
# REL2140 review M-2: the people-count privacy switch and its retention (ZONECOUNT107) are this installation's privacy policy - a restore
# never switches counting on, and never switches it off behind the audited PUT /occupancy/settings; the denied-attempt alert switch
# (DENYALERT133) is policy too, and its cursor is runtime state (an archive's older cursor would replay up to an hour of denials)
SETTINGS_KEEP = SETTINGS_KEEP | {"occupancy.enabled", "occupancy.retention_days", "access.external.denied_alert", "access.external.denied_cursor"}
# APPREFRESH2-295: the device-key mode (off | optional | required) - a restore must never weaken it
SETTINGS_KEEP = SETTINGS_KEEP | {"security.app_refresh_device_key"}
# WKWRITE-295: the anchor of the WisKey people-write lineage (generation + last intent sequence) describes THIS installation's lineage
# file, which lives outside every backup - an archive must never carry it or move it backwards (services/wiskey_write_lineage.py)
SETTINGS_KEEP = SETTINGS_KEEP | {"wiskey.native_write.lineage_anchor"}
# SESSIONEXCH2-295: the WebView session exchange switch and its lifetimes are this box's security state
SETTINGS_KEEP = SETTINGS_KEEP | {"security.app_session_exchange", "security.app_session_idle_minutes", "security.app_session_max_days"}
# APPREFRESH3-295: the key-reset notice wording sits with the rest of the app sign-in policy (kept, never taken from an archive)
SETTINGS_KEEP = SETTINGS_KEEP | {"security.app_refresh_key_reset_notice_title", "security.app_refresh_key_reset_notice_body",
                                 "security.app_refresh_key_released_notice_title", "security.app_refresh_key_released_notice_body"}
# ATTEST232-295: the attestation mode, minimum level and trust roots are security policy - a restore must never weaken or swap them
SETTINGS_KEEP = SETTINGS_KEEP | {"security.app_refresh_attestation", "security.app_refresh_attestation_min_level",
                                 "security.app_refresh_attestation_android_roots"}


def _kept_setting(key: Any) -> bool:
    return isinstance(key, str) and (key in SETTINGS_KEEP or key.startswith(SETTINGS_KEEP_PREFIXES))


MAX_UPLOAD = 200 * 1024 * 1024
DAILY_SECONDS = 24 * 3600


def backups_dir(settings: Settings) -> Path:
    d = settings.data_dir / "backups"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _tables(conn: sqlite3.Connection) -> set[str]:
    return {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'").fetchall()}


def _columns(conn: sqlite3.Connection, table: str) -> list[str]:
    return [r[1] for r in conn.execute(f"PRAGMA table_info({table})").fetchall()]


def schema_version(conn: sqlite3.Connection) -> int:
    if "schema_migrations" not in _tables(conn):
        return 0
    row = conn.execute("SELECT MAX(version) FROM schema_migrations").fetchone()
    return int(row[0] or 0)


def snapshot(conn: sqlite3.Connection, include_access: bool = True, include_audit: bool = False, include_events: bool = False) -> dict[str, list[dict[str, Any]]]:
    existing = _tables(conn)
    tables = PROJECT_TABLES + (ACCESS_TABLES if include_access else []) + (OPTIONAL_TABLES["audit"] if include_audit else []) + (OPTIONAL_TABLES["events"] if include_events else [])
    out = {t: [dict(r) for r in conn.execute(f"SELECT * FROM {t}").fetchall()] for t in tables if t in existing and t not in NEVER_EXPORTED_TABLES}
    for t, cols in NEVER_EXPORTED_COLUMNS.items():
        if t in out:
            out[t] = [{k: v for k, v in r.items() if k not in cols} for r in out[t]]
    if "settings" in out:  # review M3: what a restore never writes back (secrets, identity, pairing) never leaves in an archive either
        out["settings"] = [r for r in out["settings"] if not _kept_setting(r.get("key"))]
    return out


def _file_refs(data: dict[str, list[dict[str, Any]]]) -> list[str]:
    refs: list[str] = []
    for table, cols in FILE_COLUMNS.items():
        for row in data.get(table, []):
            for c in cols:
                v = row.get(c)
                if v and v not in refs:
                    refs.append(str(v))
    # CRY (2026-10-10): the background pictures are referenced by a settings row (`ui.background_images`, the stamp of each uploaded
    # slot), not by a table column: a slot with a stamp travels with the archive and comes back with a restore
    from ..routers.ui_background import STAMPS_KEY, rel_path, stored_stamps

    for row in data.get("settings", []):
        if row.get("key") == STAMPS_KEY:
            for slot, stamp in stored_stamps(row.get("value")).items():
                if stamp and rel_path(slot) not in refs:
                    refs.append(rel_path(slot))
    return refs


def _rel(settings: Settings, ref: str) -> str | None:
    """Zip member name for a stored file reference (paths are kept relative to the data directory)."""
    p = Path(ref)
    if p.is_absolute():
        try:
            p = p.relative_to(settings.data_dir)
        except ValueError:
            return None
    rel = p.as_posix()
    if rel.startswith("../") or "/../" in rel or rel.startswith("/"):
        return None
    if rel == "keys" or rel.startswith("keys/"):
        return None  # private signing keys never enter a backup (T067); a restored installation gets its own key
    return rel


def restorable(rel: str | None) -> bool:
    """True when `rel` (a path relative to the data directory, `/`-separated) is a file a restore may write: under
    RESTORABLE_ROOTS; no absolute path, drive, backslash, NUL, empty / `.` / `..` segment; never a `keys` folder, a database
    file, a key file or `options.json` (review F1)."""
    if not isinstance(rel, str) or not rel or rel.startswith("/") or "\\" in rel or ":" in rel or "\x00" in rel:
        return False
    parts = rel.split("/")
    # `secrets/` (CR-038: the tickets module key `tickets_key.<id>`, the messaging key) is named here too, not only left out of
    # RESTORABLE_ROOTS: a later root added to that list can never let an archive write a key (code review V16)
    if any(p in ("", ".", "..") for p in parts) or any(p.lower() in ("keys", "secrets") for p in parts):
        return False
    if not rel.startswith(RESTORABLE_ROOTS):
        return False
    return _NEVER_RESTORED_NAME.search(parts[-1]) is None


def write_zip(settings: Settings, data: dict[str, list[dict[str, Any]]], kind: str, schema: int, note: str = "", energy_history: bool = False, water_history: bool = False,
              backup_password: str | None = None, min_chars: int = sens.PASSWORD_MIN_CHARS) -> Path:
    """BACKUP-HASH-ENC: the sensitive values (local password hashes, SENSITIVE_SETTINGS) never enter the data files. With a backup
    password they are sealed into `secure/sensitive.bin` (AES-256-GCM, scrypt key; header in the manifest); without one they are
    left out and the manifest says so (`sensitive.state = omitted`)."""
    now = dt.datetime.now(dt.timezone.utc)
    created_at = now.replace(microsecond=0).isoformat().replace("+00:00", "Z")
    data, payload = sens.split(data)
    sealed: tuple[dict[str, Any], bytes] | None = None
    if backup_password is not None:
        sealed = sens.seal(payload, backup_password, {"format": FORMAT, "created_at": created_at, "schema_version": schema}, min_chars)
    stamp = now.strftime("%Y%m%d-%H%M%S")
    out = backups_dir(settings) / f"{kind}-{stamp}.zip"
    n = 1
    while out.exists():
        n += 1
        out = backups_dir(settings) / f"{kind}-{stamp}-{n}.zip"
    files = 0
    missing: list[str] = []
    tmp = out.with_name(out.name + ".tmp")
    with zipfile.ZipFile(tmp, "w", compression=zipfile.ZIP_DEFLATED) as z:
        for table, rows in data.items():
            z.writestr(f"data/{table}.json", json.dumps(rows, ensure_ascii=False))
        for ref in _file_refs(data):
            rel = _rel(settings, ref)
            src = (settings.data_dir / rel) if rel else None
            if rel and src and src.is_file():
                z.write(src, f"files/{rel}")
                files += 1
            else:
                missing.append(ref)
        from . import energy_backup  # CR-023: daily totals always, the energy.db copy only when the setting asks for it

        energy = energy_backup.add_to_zip(settings, z, with_history=energy_history)
        from . import water_backup  # CR-WATER78: daily totals whenever water.db exists, the file only when the setting asks for it

        water = water_backup.add_to_zip(settings, z, with_history=water_history)
        if sealed is not None:
            z.writestr(sens.MEMBER, sealed[1])
        manifest = {
            "format": FORMAT,
            "app_version": __version__,
            "schema_version": schema,
            "created_at": created_at,
            "kind": kind,
            "note": note,
            "tables": {t: len(rows) for t, rows in data.items()},
            "files": files,
            "missing_files": missing[:50],
            "energy": energy,
            "water": water,
            "sensitive": sealed[0] if sealed is not None else sens.omitted_header(payload),
        }
        z.writestr("manifest.json", json.dumps(manifest, ensure_ascii=False, indent=1))
    tmp.replace(out)
    return out


def read_manifest(path: Path) -> dict[str, Any]:
    with zipfile.ZipFile(path) as z:
        if "manifest.json" not in z.namelist():
            raise ValueError("not a SMPLWISE backup (manifest.json missing)")
        m = json.loads(z.read("manifest.json").decode("utf-8"))
    if not isinstance(m, dict) or m.get("format") != FORMAT:
        raise ValueError("unsupported backup format")
    return m


def entry(path: Path) -> dict[str, Any]:
    st = path.stat()
    try:
        m = read_manifest(path)
    except (ValueError, zipfile.BadZipFile, KeyError, json.JSONDecodeError):
        m = {}
    kind = m.get("kind") or ("upload" if path.name.startswith("upload-") else "manual")
    return {
        "name": path.name,
        "bytes": st.st_size,
        "created_at": m.get("created_at") or dt.datetime.fromtimestamp(st.st_mtime, dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "kind": kind,
        "note": m.get("note", ""),
        "app_version": m.get("app_version"),
        "schema_version": m.get("schema_version"),
        "tables": m.get("tables", {}),
        "files": m.get("files", 0),
        "valid": bool(m),
        "sensitive": _sensitive_summary(m),
    }


def _sensitive_summary(m: dict[str, Any]) -> dict[str, Any] | None:
    """What the list shows about the encrypted section: `encrypted` (a password is needed to bring it back), `omitted` (written
    without a password: local account passwords are not in this archive), `legacy` (an archive from before BACKUP-HASH-ENC that
    may hold the hashes in the clear). Counts only - never a value."""
    if not m:
        return None
    h = m.get("sensitive")
    if h is None:
        return {"state": "legacy"}
    if not isinstance(h, dict) or h.get("state") not in ("encrypted", "omitted"):
        return {"state": "invalid"}
    c = h.get("counts") if isinstance(h.get("counts"), dict) else {}
    return {"state": h["state"], "counts": {k: int(c.get(k) or 0) for k in ("password_hashes", "settings") if isinstance(c.get(k, 0), int)}}


def list_backups(settings: Settings) -> list[dict[str, Any]]:
    items = [entry(p) for p in backups_dir(settings).glob("*.zip")]
    items.sort(key=lambda e: e["created_at"], reverse=True)
    return items


def prune(settings: Settings) -> list[str]:
    """Keep the newest N automatic backups per kind; manual and uploaded ones are never removed here."""
    removed: list[str] = []
    for kind, keep in KEEP.items():
        rows = sorted((p for p in backups_dir(settings).glob(f"{kind}-*.zip")), key=lambda p: p.stat().st_mtime, reverse=True)
        for p in rows[keep:]:
            try:
                p.unlink()
                removed.append(p.name)
            except OSError:
                pass
    return removed


def create(settings: Settings, conn: sqlite3.Connection, kind: str = "manual", note: str = "", include_access: bool = True, include_audit: bool = False, include_events: bool = False,
           backup_password: str | None = None) -> dict[str, Any]:
    from . import energy_backup, water_backup

    min_chars = sens.min_chars(conn)
    if backup_password is not None:
        sens.password_bytes(backup_password, min_chars)  # refuse a weak / oversized password before the snapshot is taken
    data = snapshot(conn, include_access, include_audit, include_events)
    out = write_zip(settings, data, kind, schema_version(conn), note, energy_history=energy_backup.include_history(conn), water_history=water_backup.include_history(conn), backup_password=backup_password,
                    min_chars=min_chars)
    return entry(out)


def create_standalone(settings: Settings, db: Database, kind: str, note: str = "") -> dict[str, Any]:
    with db.connection() as conn:
        return create(settings, conn, kind, note)


def _actor_rows(conn: sqlite3.Connection, user_id: str | None) -> dict[str, list[dict[str, Any]]]:
    """The acting administrator's own identity rows, kept across an access restore so nobody locks themselves out."""
    if not user_id:
        return {}
    out: dict[str, list[dict[str, Any]]] = {}
    existing = _tables(conn)
    if "users" in existing:
        out["users"] = [dict(r) for r in conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchall()]
    if "bindings" in existing:
        out["bindings"] = [dict(r) for r in conn.execute("SELECT * FROM bindings WHERE subject_kind = 'user' AND subject_id = ?", (user_id,)).fetchall()]
    if sens.HASH_TABLE in existing:  # BACKUP-HASH-ENC: a local administrator restoring access keeps their own password too
        out[sens.HASH_TABLE] = [{k: v for k, v in dict(r).items() if k not in NEVER_EXPORTED_COLUMNS.get(sens.HASH_TABLE, frozenset())}
                                for r in conn.execute(f"SELECT * FROM {sens.HASH_TABLE} WHERE user_id = ?", (user_id,)).fetchall()]
    if "group_members" in existing:
        col = next((c for c in _columns(conn, "group_members") if c in ("user_id", "member_id", "subject_id")), None)
        if col:
            out["group_members"] = [dict(r) for r in conn.execute(f"SELECT * FROM group_members WHERE {col} = ?", (user_id,)).fetchall()]
    return out


def _insert_rows(conn: sqlite3.Connection, table: str, rows: list[dict[str, Any]], replace: bool) -> int:
    """Write the archive's rows of one table; returns how many rows were written (what the restore answer reports)."""
    cols_now = set(_columns(conn, table)) - NEVER_EXPORTED_COLUMNS.get(table, frozenset())
    n = 0
    verb = "INSERT OR REPLACE" if replace else "INSERT OR IGNORE"
    for row in rows:
        if table == "settings" and _kept_setting(row.get("key")):
            continue
        keys = [k for k in row.keys() if k in cols_now]
        if not keys:
            continue
        cur = conn.execute(f"{verb} INTO {table}({', '.join(keys)}) VALUES ({', '.join('?' * len(keys))})", [row[k] for k in keys])
        n += max(cur.rowcount, 0)  # rows written: a merge's INSERT OR IGNORE of a row that exists writes nothing
    return n


# Never restored from an archive (CR-006 2a): the skins' control images and render records are rebuilt / kept locally;
# 2c's export of skins will add them here and must pass _unsafe_rows' path rule.
NEVER_RESTORED = ("plan_skin_controls", "plan_skin_renders")


def _unsafe_rows(settings: Settings, data: dict[str, list[dict[str, Any]]]) -> dict[str, int]:
    """Re-review 2a: drop, in place, archive rows that could steer a file path - a floor whose id is not a plain id
    (db.ID_RE; the id names `skins/<floor id>/`), every row of another table pointing at such a floor, and a
    `plan_skin*` row whose `path` does not confine to the skins root. Skipped, counted and logged (count only); the
    rest of the restore goes on. Returns {table: rows skipped}."""
    from ..db import ID_RE
    from .skins import store as skins_store

    skipped: dict[str, int] = {}
    def plain(v: Any) -> bool:
        return isinstance(v, str) and ID_RE.fullmatch(v) is not None

    bad_floors = {str(r.get("id")) for r in data.get("floors", []) if isinstance(r, dict) and not plain(r.get("id")) and r.get("id") is not None}
    for table, rows in data.items():
        keep: list[dict[str, Any]] = []
        for r in rows:
            fid = r.get("floor_id") if isinstance(r, dict) else None
            unsafe = not isinstance(r, dict) or (table == "floors" and not plain(r.get("id"))) or (fid is not None and (not isinstance(fid, str) or fid in bad_floors))
            if not unsafe and table in FILE_COLUMNS:  # review F1: a file column outside the restorable set could steer a later read
                for c in FILE_COLUMNS[table]:
                    v = r.get(c)
                    if v is not None and (not isinstance(v, str) or not restorable(_rel(settings, v))):
                        unsafe = True
            if not unsafe and table.startswith("plan_skin") and r.get("path") is not None:
                try:
                    skins_store.confine_stored(settings, r["path"])
                except skins_store.SkinStoreError:
                    unsafe = True
            if unsafe:
                skipped[table] = skipped.get(table, 0) + 1
            else:
                keep.append(r)
        rows[:] = keep
    return skipped


def _open_sensitive(manifest: dict[str, Any], z: zipfile.ZipFile, names: set[str], backup_password: str | None,
                    skip_sensitive: bool) -> tuple[str, dict[str, Any] | None, str | None]:
    """BACKUP-HASH-ENC: (state, decrypted payload or None, why it was skipped or None). Runs before anything is written.
    An inconsistent archive (a section without its header, a malformed header, key-derivation settings out of range) is refused
    whatever the operator chose. An encrypted section that cannot be opened (no / wrong password, changed or truncated archive)
    is refused unless the operator explicitly chose to restore without it (`skip_sensitive`)."""
    state = sens.state_of(manifest, names)
    if state != "encrypted":
        return state, None, None
    sens.check_header(manifest["sensitive"])  # never a silent downgrade: a malformed header is refused even with skip
    if skip_sensitive and not backup_password:
        return state, None, "operator_skipped"
    try:
        payload = sens.unseal(manifest["sensitive"], sens.read_member(z), backup_password, sens.binding_of(manifest))
    except sens.SensitiveError as exc:
        if skip_sensitive and exc.code != "backup_password_too_long":
            return state, None, exc.code
        raise
    return state, payload, None


def _current_hashes(conn: sqlite3.Connection) -> dict[str, dict[str, Any]]:
    if sens.HASH_TABLE not in _tables(conn):
        return {}
    cols = [c for c in (sens.HASH_COLUMN, *sens.HASH_COMPANIONS) if c in _columns(conn, sens.HASH_TABLE)]
    sql = f"SELECT user_id, {', '.join(cols)} FROM {sens.HASH_TABLE} WHERE {sens.HASH_COLUMN} IS NOT NULL"
    return {r["user_id"]: {c: r[c] for c in cols} for r in conn.execute(sql).fetchall()}


def _fill_missing_hashes(data: dict[str, list[dict[str, Any]]], current: dict[str, dict[str, Any]], restored: int, legacy: bool) -> dict[str, Any]:
    """A credential row of the archive that comes without its hash (section omitted or skipped) takes the CURRENT hash of the same
    user id on this installation when there is one (whoever can sign in here today still can - including the acting administrator,
    and a rollback on the same host loses nothing); otherwise its hash is NULL: that account needs an administrator's link
    (the reset). Returns the restore answer's `passwords` block (user ids, never a hash)."""
    kept, need = 0, []
    for r in data.get(sens.HASH_TABLE) or []:
        if not isinstance(r, dict) or r.get(sens.HASH_COLUMN):
            continue
        uid = r.get("user_id")
        cur = current.get(uid) if isinstance(uid, str) else None
        if cur:
            r.update(cur)
            kept += 1
        else:
            r.update({sens.HASH_COLUMN: None, "set_at": None, "set_by": None})
            if isinstance(uid, str):
                need.append(uid)
    return {"restored": restored, "kept_current": kept, "need_reset": need[:500], "need_reset_count": len(need), "legacy_plaintext": legacy}


def restore(settings: Settings, conn: sqlite3.Connection, path: Path, mode: str = "replace", scope: str = "project", actor_user_id: str | None = None,
            backup_password: str | None = None, skip_sensitive: bool = False, process_hooks: bool = True) -> dict[str, Any]:
    """Load a backup into the current database inside the caller's transaction. `process_hooks=False` (DATASTORE-295, the
    restore drill into a scratch directory): the process-wide capture-lease revocation and stream reset are NOT triggered - the
    live installation's database was not touched, so its live leases stay valid. `replace` empties every table of
    the scope first, also one the archive does not have (a backup older than the table): the restored project equals
    the backup, and no row is left pointing at a parent row being replaced (R-T7-1) - except KEEP_WHEN_ABSENT (CR-019's
    switch protection): an archive without them keeps the current rows (`kept_current` in the answer). Identity rows of
    the acting user are kept. `merge` only adds missing rows. Files are written before the commit; a failure rolls the rows back.
    BACKUP-HASH-ENC: an encrypted sensitive section needs `backup_password` (sens.SensitiveError otherwise, raised before anything
    is written) unless `skip_sensitive` - then the section is not restored (`_fill_missing_hashes`; the current values of
    SENSITIVE_SETTINGS are kept)."""
    if mode not in ("replace", "merge"):
        raise ValueError("mode must be replace | merge")
    if scope not in ("project", "project+access"):
        raise ValueError("scope must be project | project+access")
    manifest = read_manifest(path)
    current_schema = schema_version(conn)
    if int(manifest.get("schema_version") or 0) > current_schema:
        raise ValueError(f"backup schema {manifest.get('schema_version')} is newer than this installation ({current_schema}); update the add-on first")
    existing = _tables(conn)
    tables = [t for t in PROJECT_TABLES + (ACCESS_TABLES if scope == "project+access" else []) if t in existing and t not in NEVER_EXPORTED_TABLES]
    data: dict[str, list[dict[str, Any]]] = {}
    with zipfile.ZipFile(path) as z:
        names = set(z.namelist())
        for t in tables:
            member = f"data/{t}.json"
            if member in names:
                data[t] = json.loads(z.read(member).decode("utf-8"))
        # BACKUP-HASH-ENC: decided before any row is deleted
        sens_state, payload, sens_skipped = _open_sensitive(manifest, z, names, backup_password, skip_sensitive)
        plaintext_ignored = sens.strip_plaintext(data) if sens_state != "legacy" else 0
        if plaintext_ignored:
            log.warning("restore ignored %s plaintext sensitive value(s) in an archive with an encrypted-section header", plaintext_ignored)
        legacy_hashes = sum(1 for r in data.get(sens.HASH_TABLE) or [] if isinstance(r, dict) and r.get(sens.HASH_COLUMN)) if sens_state == "legacy" else 0
        if legacy_hashes:
            log.warning("restore of an archive from before encrypted backups: %s local password hash(es) were stored in the clear", legacy_hashes)
        restored_hashes = sens.merge_into(data, payload) if payload else legacy_hashes
        passwords = _fill_missing_hashes(data, _current_hashes(conn), restored_hashes, legacy_hashes > 0) if sens.HASH_TABLE in data else None
        # a sensitive setting the archive does not bring (omitted / skipped section) keeps its current value
        brought = {r.get("key") for r in data.get("settings") or [] if isinstance(r, dict)}
        keep_sensitive = sorted(sens.SENSITIVE_SETTINGS - brought)
        keep = _actor_rows(conn, actor_user_id) if scope == "project+access" else {}
        update_switch = _update_switch(conn, data)
        kept_current = [t for t in tables if t in KEEP_WHEN_ABSENT and t not in data]
        door_history = _keep_door_history(conn) if mode == "replace" and "door_automations" in tables else None
        if mode == "replace":
            for t in reversed(tables):  # children before parents; a table missing from the archive is emptied too
                if t in kept_current:
                    continue  # CR-019: never emptied by an archive that does not have it
                if t == "settings":
                    kept_keys = [*SETTINGS_KEEP, *keep_sensitive]
                    conn.execute(f"DELETE FROM settings WHERE key NOT IN ({', '.join('?' * len(kept_keys))})"
                                 + "".join(" AND substr(key, 1, ?) <> ?" for _ in SETTINGS_KEEP_PREFIXES),
                                 [*kept_keys, *(v for p in SETTINGS_KEEP_PREFIXES for v in (len(p), p))])
                else:
                    conn.execute(f"DELETE FROM {t}")
        skipped = _unsafe_rows(settings, data)
        door_blocks_dropped, door_blocks_sanitised = _sanitise_door_blocks(data)
        counts: dict[str, int] = {}
        for t in tables:
            if t in data:
                counts[t] = _insert_rows(conn, t, data[t], replace=(mode == "replace"))
        door_blocks_disarmed = door_blocks_sanitised + (_disarm_restored_blocks(conn) if "door_automations" in tables else 0)
        if door_history is not None:
            _put_back_door_history(conn, *door_history)
        if "notify_settings" in tables:  # CR-018: an archive without the table must not leave the notification settings without their one row
            from .notify_settings import ensure_row

            ensure_row(conn)
        for t, rows in keep.items():
            if rows:
                _insert_rows(conn, t, rows, replace=False)
        roles_pruned = _prune_role_permissions(conn) if "custom_roles" in data else []
        backgrounds_rejected: list[dict[str, str]] = []  # SEC246 I2
        files = 0
        files_skipped = 0
        # review F1: only the files the archive's own (kept) rows reference, each inside the restorable set
        wanted = {rel for rel in (_rel(settings, ref) for ref in _file_refs(data)) if rel is not None and restorable(rel)}
        for member in names:
            if not member.startswith("files/") or member.endswith("/"):
                continue
            rel = member[len("files/"):]
            if rel not in wanted or not restorable(rel):
                files_skipped += 1
                continue
            dest = settings.data_dir / rel
            base = settings.data_dir.resolve()
            if base not in dest.resolve().parents:  # re-review 2a: never write outside the data dir, whatever the name
                continue
            dest.parent.mkdir(parents=True, exist_ok=True)
            if rel.startswith(BACKGROUND_ROOT):
                # SEC246 I2: an archive is unsigned - a background picture gets the upload's content guarantee again (pixel budget,
                # re-encoded as a fresh JPEG); one that fails it is not written and the slot's old file is removed
                from ..errors import ApiError
                from ..routers import ui_background

                with z.open(member) as src:
                    raw = src.read(ui_background.IMAGE_MAX_BYTES + 1)
                try:
                    clean = ui_background.reencode(raw)
                except ApiError as exc:
                    dest.unlink(missing_ok=True)
                    backgrounds_rejected.append({"file": rel, "code": exc.code})
                    files_skipped += 1
                    continue
                ui_background.write_atomic(dest, clean)
                files += 1
                continue
            with z.open(member) as src, open(dest, "wb") as dst:
                dst.write(src.read())
            files += 1
        energy: dict[str, Any] = {}
        if "energy_meters" in tables:  # CR-023: the allow-listed energy.db part, only for meters the restored project has
            from . import energy_backup

            allowed = {r[0] for r in conn.execute("SELECT id FROM energy_meters").fetchall()}
            energy = energy_backup.restore_from_zip(settings, z, names, allowed_meters=allowed, replace=(mode == "replace"))
        water: dict[str, Any] = {}
        if "water_meters" in tables:  # CR-WATER78: the allow-listed water.db part, only for meters the restored project has
            from . import water_backup

            allowed_w = {r[0] for r in conn.execute("SELECT id FROM water_meters").fetchall()}
            water = water_backup.restore_from_zip(settings, z, names, allowed_meters=allowed_w, replace=(mode == "replace"))
    if scope == "project+access":
        if process_hooks:
            bump_permission_revision(conn)
        else:  # the drill's scratch database: the same revision move, without the process-wide lease / grant hooks
            from ..db import permission_revision

            set_setting(conn, "permission_revision", str(permission_revision(conn) + 1))
    # CR-WISKEY-LEASE-REVOCATION-EVENT 2.3: a restored database gets a fresh revocation stream (never the archive's counter - the
    # lease tables are not backup tables) and no capture lease survives a restore
    from . import capture_lease, lease_events

    if process_hooks:
        capture_lease.on_authority_change("restore", all=True)
        lease_events.WORKER.request_reset("restore")
        # CR-WISKEY-HMAC-ROTATION-295 section 9: the key tables are not in any archive (the live keys stay); a rotation in flight is
        # resolved by the engine's next round as a restore (rolled back before its switch)
        from . import bridge_rotation

        bridge_rotation.on_restore()
    lease_settings = _lease_settings_report(conn, data)
    # CR-006 2a review: a replaced project may no longer have a floor whose skin control images are stored
    from .skins import store as skins_store

    swept = skins_store.sweep_orphans(settings, conn) if "plan_skin_controls" in existing else 0
    from . import plan_bakes

    bakes_swept = plan_bakes.sweep_orphans(settings, conn)  # CR-029 S3: bakes of floors the restored project no longer has
    if skipped:
        log.warning("restore skipped %s row(s) with an unsafe id or path", sum(skipped.values()))
    if files_skipped:
        log.warning("restore skipped %s archive file(s) outside the restorable set", files_skipped)
    return {"mode": mode, "scope": scope, "tables": counts, "files": files, "files_skipped": files_skipped, "skin_controls_swept": swept, "bakes_swept": bakes_swept, "skipped_unsafe": skipped,
            "kept_current": kept_current, "roles_pruned": roles_pruned, "door_automations": {"disarmed": door_blocks_disarmed, "dropped": door_blocks_dropped}, "energy": energy, "water": water, "app_version": manifest.get("app_version"), "created_at": manifest.get("created_at"),
            "update_apply_enabled": update_switch, "backgrounds_rejected": backgrounds_rejected, "capture_lease_settings": lease_settings,
            "sensitive": {"state": sens_state, "restored": payload is not None or legacy_hashes > 0, "skipped": sens_skipped,
                          "plaintext_ignored": plaintext_ignored, "settings_kept_current": keep_sensitive},
            "passwords": passwords}


def _sanitise_door_blocks(data: dict[str, list[dict[str, Any]]]) -> tuple[int, int]:
    """DOORHARD-295 / CR-AUTODOORS-295 12.3: an archive is unsigned. Its door-automation rows come in as `disarmed` (reason `restored`) whatever
    they say, and a row whose policy does not pass the block's own validation (or whose state is unknown) is dropped. Returns (dropped, disarmed)."""
    rows = data.get("door_automations")
    if not rows:
        return 0, 0
    from . import door_automation

    at = door_automation.iso(door_automation.now())
    disarmed = 0
    kept: list[dict[str, Any]] = []
    for r in rows:
        try:
            if not isinstance(r, dict) or r.get("state") not in ("draft", "armed", "disarmed") or not isinstance(r.get("id"), str):
                raise ValueError("row")
            door_automation.validate_policy(json.loads(r.get("policy_json") or ""))
        except Exception:  # noqa: BLE001 - ApiError, ValueError, TypeError: all the same verdict
            continue
        if r["state"] == "armed":
            r = {**r, "state": "disarmed", "disarm_reason": "restored", "disarmed_at": at, "disarmed_by": "system", "armed_until": None, "corroborated_trigger": None}
            disarmed += 1
        kept.append(r)
    data["door_automations"] = kept
    return len(rows) - len(kept), disarmed


def _keep_door_history(conn: sqlite3.Connection) -> tuple[list[dict[str, Any]], list[dict[str, Any]]] | None:
    """Owner decision 2026-10-21 ("not hard to manage"): a replace restore does NOT wipe the door automations' fire history. Deleting the
    blocks would cascade to `door_automation_fires` - the record an administrator reads and the counters the per-door cap and the cooldown
    count - so the installation's own rows are kept aside here and put back after the archive's rows are in (`_put_back_door_history`)."""
    try:
        blocks = [dict(r) for r in conn.execute("SELECT * FROM door_automations").fetchall()]
        fires = [dict(r) for r in conn.execute("SELECT * FROM door_automation_fires").fetchall()]
    except sqlite3.OperationalError:  # a database before the migration
        return None
    return blocks, fires


def _put_back_door_history(conn: sqlite3.Connection, blocks: list[dict[str, Any]], fires: list[dict[str, Any]]) -> None:
    """Put the installation's fire rows back. A fire whose block is not in the restored set keeps its block as a deleted, disarmed record
    (the soft-delete the screens already know), so the history and the per-door cap still see it; nothing is armed by this."""
    if not fires:
        return
    from . import door_automation

    at = door_automation.iso(door_automation.now())
    present = {r[0] for r in conn.execute("SELECT id FROM door_automations").fetchall()}
    needed = {f["automation_id"] for f in fires}
    for b in blocks:
        if b["id"] in needed and b["id"] not in present:
            tomb = {**b, "state": "disarmed", "disarm_reason": b.get("disarm_reason") or "restored", "armed_until": None, "deleted_at": b.get("deleted_at") or at, "updated_at": at}
            cols = ", ".join(tomb)
            conn.execute(f"INSERT OR IGNORE INTO door_automations({cols}) VALUES ({', '.join('?' * len(tomb))})", list(tomb.values()))
    for f in fires:
        cols = ", ".join(f)
        conn.execute(f"INSERT OR IGNORE INTO door_automation_fires({cols}) VALUES ({', '.join('?' * len(f))})", list(f.values()))


def _disarm_restored_blocks(conn: sqlite3.Connection) -> int:
    """DOORHARD-295 / CR-AUTODOORS-295 12.3: after a restore no door-opening block is armed. Covers the archive's rows, the rows a `merge` keeps and the
    rows an older archive (without the table) leaves in place: a person arms each block again (the arming checks run again)."""
    from . import door_automation

    at = door_automation.iso(door_automation.now())
    cur = conn.execute("""UPDATE door_automations SET state = 'disarmed', disarm_reason = 'restored', disarmed_at = ?, disarmed_by = 'system', armed_until = NULL,
                          corroborated_trigger = NULL, updated_at = ? WHERE state = 'armed'""", (at, at))
    return max(cur.rowcount, 0)


def _lease_settings_report(conn: sqlite3.Connection, data: dict[str, list[dict[str, Any]]]) -> dict[str, Any]:
    """CR-WISKEY-LEASE-REVOCATION-EVENT 5 / 7.3 (the CR-033 section 9 rule): `access.capture_lease`, `access.capture_lease_seconds`
    and `access.lookup_scope` are never taken from an archive (SETTINGS_KEEP) - a restore never loosens them. The answer lists
    the archive values that were dropped (`dropped`: key -> archive value) next to the values kept."""
    from . import capture_lease

    archive = {r.get("key"): r.get("value") for r in data.get("settings") or [] if isinstance(r, dict) and r.get("key") in capture_lease.KEYS}
    kept = {k: get_setting(conn, k) or capture_lease.DEFAULTS[k] for k in capture_lease.KEYS}
    dropped = {k: v for k, v in archive.items() if isinstance(v, str) and v != kept[k]}
    return {"kept": kept, "dropped": dropped}


def _update_switch(conn: sqlite3.Connection, data: dict[str, list[dict[str, Any]]]) -> dict[str, Any]:
    """SEC246 L4: the self-update switch a restore keeps (the current value, never the archive's) and what the archive held
    (None when the archive has no row - every archive written since this rule, and every one from before 2.4.4)."""
    from .self_update import apply_enabled

    kept = apply_enabled(conn)
    archived: bool | None = None
    for row in data.get("settings", []):
        if row.get("key") == UPDATE_SWITCH_KEY:
            archived = (row.get("value") or "true") != "false"
    return {"kept": kept, "archive": archived, "differed": archived is not None and archived != kept}


def _prune_role_permissions(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    """CR-020 S2 review L6: a restored archive from an older version can carry custom roles naming a permission this version
    no longer has (nvr.config.stream, removed by migration 0050) or one that only built-in roles may hold. Such a role would
    grant nothing for it and its next edit would fail (422 permission_unknown), so the permission is dropped here - the same
    rule migration 0050 applied - and the role's revision moves. Returns [{role_id, removed}] for the answer and the audit row."""
    from ..routers.access import PERMISSION_LABELS, SYSTEM_PERMISSIONS  # local import: the permission catalogue lives with the roles API

    def keep(p: Any) -> bool:
        return isinstance(p, str) and p in PERMISSION_LABELS and p not in SYSTEM_PERMISSIONS

    out: list[dict[str, Any]] = []
    for r in conn.execute("SELECT id, permissions_json, sensitive_json FROM custom_roles").fetchall():
        try:
            perms = json.loads(r["permissions_json"] or "[]")
            sens = json.loads(r["sensitive_json"] or "[]")
        except ValueError:
            continue
        if not isinstance(perms, list) or not isinstance(sens, list):
            continue
        removed = sorted({str(p)[:64] for p in perms + sens if not keep(p)})
        if not removed:
            continue
        conn.execute("UPDATE custom_roles SET permissions_json = ?, sensitive_json = ?, revision = revision + 1 WHERE id = ?",
                     (json.dumps([p for p in perms if keep(p)]), json.dumps([p for p in sens if keep(p)]), r["id"]))
        out.append({"role_id": r["id"], "removed": removed})
    return out


def save_upload(settings: Settings, content: bytes) -> dict[str, Any]:
    if len(content) > MAX_UPLOAD:
        raise ValueError("backup file too large")
    try:
        with zipfile.ZipFile(io.BytesIO(content)) as z:
            if "manifest.json" not in z.namelist():
                raise ValueError("not a SMPLWISE backup (manifest.json missing)")
            m = json.loads(z.read("manifest.json").decode("utf-8"))
    except zipfile.BadZipFile as exc:
        raise ValueError("not a zip file") from exc
    if m.get("format") != FORMAT:
        raise ValueError("unsupported backup format")
    stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%d-%H%M%S")
    out = backups_dir(settings) / f"upload-{stamp}.zip"
    n = 1
    while out.exists():
        n += 1
        out = backups_dir(settings) / f"upload-{stamp}-{n}.zip"
    tmp = out.with_name(out.name + ".tmp")
    tmp.write_bytes(content)
    tmp.replace(out)
    return entry(out)


# ---- start-up safety and the daily copy ----


def pre_upgrade(settings: Settings) -> Path | None:
    """Before migrations run: if the stored application version differs from this build, write a backup of the
    existing data so a bad upgrade can be undone (T036). Returns the file, or None when nothing was needed."""
    if not settings.db_path.exists():
        return None
    try:
        conn = sqlite3.connect(settings.db_path, timeout=10)
        conn.row_factory = sqlite3.Row
        try:
            if "settings" not in _tables(conn):
                return None
            stored = get_setting(conn, "app.version")
            if stored == __version__:
                return None
            data = snapshot(conn)
            out = write_zip(settings, data, "auto-pre-upgrade", schema_version(conn), note=f"before upgrade {stored or 'unknown'} -> {__version__}")
        finally:
            conn.close()
        prune(settings)
        return out
    except (sqlite3.Error, OSError, ValueError) as exc:  # never block start-up because of the safety copy
        log.warning("pre-upgrade backup skipped: %s", exc)
        return None


def record_version(db: Database) -> None:
    with db.connection() as conn:
        if get_setting(conn, "app.version") != __version__:
            set_setting(conn, "app.version", __version__)


async def daily_loop(db: Database, settings: Settings, interval_s: int = DAILY_SECONDS) -> None:
    """One automatic copy a day (the first one a day after start-up, so restarts do not pile up copies)."""
    from starlette.concurrency import run_in_threadpool

    while True:
        await asyncio.sleep(interval_s)
        try:
            e = await run_in_threadpool(create_standalone, settings, db, "auto-daily", "daily")
            removed = await run_in_threadpool(prune, settings)
            log.info("daily backup %s (%d bytes); pruned %s", e["name"], e["bytes"], removed or "nothing")
            from . import offbox_runtime  # DATASTORE-295 phase 2: the encrypted off-box copies of this backup (enabled targets only)

            await run_in_threadpool(offbox_runtime.after_backup, db, settings, e["name"])
        except Exception as exc:  # noqa: BLE001 - keep the loop alive
            log.warning("daily backup failed: %s", exc)
            from . import notify_sources  # CR-018: the administrators hear about a failed automatic backup (resolved by the next good one)

            await run_in_threadpool(notify_sources.backup_failed, db)
