"""The API routers, and the ordered table `main.create_app` mounts them from (CR-MAIN-ROUTERS-TABLE-2440, review 05:P2-05).

This package file holds DATA only - it imports no router module, so importing one router still imports just that one.

`ROUTERS` is the include order of the application, top to bottom; it used to be about 180 `from .routers import x` /
`app.include_router(...)` pairs inline in `create_app`. THE ORDER IS BEHAVIOUR:

* a router with a fixed path must come before the router whose `{parameter}` path would swallow it (the entries say so:
  "BEFORE /tickets/{ticket_id}", "before /backups/{name}", "BEFORE /notifications/{nid}");
* `contracts/API_INVENTORY.md` is generated from the resulting route table and pins it;
* a router module is imported when the table reaches it, so registrations made at import keep their order too. Where a module
  was imported earlier than it was mounted, a `Load` entry keeps that import at its old place.

Entry kinds:

* `Mount(module, tag, attr="router", prefix=True, when=None)`: `app.include_router(<module>.<attr>, prefix="/api/v1", tags=[tag])`;
  `prefix=False` mounts at the root without a tag (the TV page); `when` names a condition in `main.MOUNT_CONDITIONS`.
* `Load(module)`: import only.
* `Step(name)`: service wiring that runs between two includes, `startup_steps.WIRING[name]`.

`EAGER` are the modules `main` imports when it is itself imported (before any `create_app`), in that order.

Tell the kinds apart with `isinstance`, never with `==` or `in`: a NamedTuple equals any tuple with the same values, so
`Step("x") == Load("x")`.
"""
from __future__ import annotations

import importlib
from types import ModuleType
from typing import NamedTuple

API_PREFIX = "/api/v1"


class Mount(NamedTuple):
    module: str
    tag: str | None
    attr: str = "router"
    prefix: bool = True
    when: str | None = None


class Load(NamedTuple):
    module: str


class Step(NamedTuple):
    name: str


def load(module: str) -> ModuleType:
    return importlib.import_module(f"{__name__}.{module}")


def import_eager() -> None:
    for module in EAGER:
        load(module)


EAGER: tuple[str, ...] = (
    "home_mapping",
    "access",
    "access_control",
    "wiskey_relay_map",
    "access_groups",
    "alarm",
    "doors",
    "anchors",
    "automations",
    "backup",
    "brand",
    "white_label",
    "cameras",
    "cases",
    "catalog",
    "device_cameras",
    "device_layouts",
    "devices",
    "energy_billing",
    "events",
    "exports",
    "floor_images",
    "frames",
    "ha",
    "health",
    "me",
    "media",
    "multimedia",
    "notifications",
    "nvr_connection",
    "nvr_settings",
    "nvr_write",
    "popup_layout",
    "plan_area_links",
    "plan_bakes",
    "plan_catalog",
    "plan_geometry",
    "plan_ifc",
    "plan_package",
    "plan_view",
    "plans",
    "playback",
    "playback_groups",
    "push",
    "recordings",
    "rules",
    "schedules",
    "search",
    "settings",
    "setup",
    "skins",
    "storage",
    "system_update",
    "ui_background",
    "views",
    "wall",
    "zones",
)

ROUTERS: tuple[Mount | Load | Step, ...] = (
    Mount("me", "identity"),
    Mount("catalog", "catalog"),
    Mount("home_mapping", "catalog"),  # MAPPING-ASSIST-2330: the mapping assistant
    Mount("plans", "plans"),
    Mount("plan_geometry", "plans"),
    Mount("plan_package", "plans"),
    Mount("plan_ifc", "plans"),
    Mount("plan_view", "plans"),  # CR-029 S0: a person's own realistic-3D look dials
    Mount("plan_catalog", "catalog"),
    Mount("anchors", "anchors"),
    Mount("camera_discovery", "cameras"),  # ONVIF-API-2500: finding cameras on the site network - BEFORE /cameras/{camera_id}/capabilities
    Mount("camera_sources", "cameras"),  # CAMERA-STREAM-SOURCES-2410: a camera's video source, cameras without a recorder
    Mount("cameras", "cameras"),
    Mount("settings", "settings"),
    Mount("ui_background", "settings"),  # CRY: the background pictures behind the glass
    Mount("white_label", "settings"),  # WHITELABEL097-295: the installer brand profile and the customer pack
    Mount("brand", "settings"),  # LOGOS-295: the company logo, the logo size / dark-background choices, the tab title
    Mount("media", "media"),
    Mount("recordings", "recordings"),
    Mount("playback", "playback"),
    Mount("playback_groups", "playback"),
    Mount("exports", "exports"),
    Mount("events", "events"),
    Mount("ha", "home-assistant"),
    # developer identity mode only: truly absent otherwise, not merely a 404 raised from inside the handler
    Mount("ha", "home-assistant", attr="dev_router", when="dev_identity"),
    Mount("access", "access"),
    Mount("access_groups", "access"),
    Mount("access_control", "access-control"),
    Mount("access_control_reads", "access-control"),  # CR-036 S4: the typed access-control reads (its own line: merges with CR-033 stay simple)
    Mount("intercom_media", "access-control"),  # CR-036 S18: station live video + talk (its own line)
    Mount("intercom_listen", "access-control"),  # WKAUDIN-295: listening to a station (its own line; off by default)
    Mount("intercom_calls", "access-control"),  # WISKEY-INBOUND-CALLS-2382: the incoming-call banner, the call log (its own line)
    Mount("access_control_writes", "access-control"),  # CR-036 S11: the person writes added to the editor's (its own line, like S4's)
    Mount("access_control_station_ops", "access-control"),  # WISKEY-STATION-OPS-2390: station maintenance (its own file and its own line)
    Mount("access_control_profiles", "access-control"),  # WISKEY-PROFILES-EDIT-2390: the groups and profile fields editor (its own file and its own line)
    Mount("access_control_schedule_writes", "access-control"),  # WISKEY-SCHED-WRITE-2390: the device schedule library's writes (its own file and line)
    Mount("access_control_schedule_reads", "access-control"),  # WISKEY-SCHED-READS-2520: WisKey's signed schedule inspection jobs (its own file and line)
    Mount("access_control_triage", "access-control"),  # WISKEY-CONFLICTS-2400: conflict resolution and fleet alert actions (its own file and its own line)
    Mount("access_control_diag", "access-control"),  # WISKEY-ACCESS-DIAG-2400: the "אבחון הרשאות" views (its own file and its own line)
    Mount("wiskey_lineage", "access-control"),  # WKR5-295: the WisKey people-write lineage administration (its own line)
    Mount("access_control_door_tech", "access-control"),  # WISKEY-DOOR-TECH-2390: door technical writes (its own file and its own line)
    Mount("access_control_messaging", "access-control"),  # CR-036 WA: WhatsApp from the people screen (its own file and its own line)
    Mount("access_control_template_v2", "access-control"),  # TPLV2-295: WhatsApp template send v2 (OFF by default; fake-only)
    Mount("access_control_wa_queue", "access-control"),  # WISKEY-WA-QUEUE-2400: registry refresh, durable queue, v3, paced send opt-in
    Mount("bulk_people", "access-control"),  # CR-BULKPEOPLE-295: bulk edit, CSV import / export of people (its own line)
    Mount("access_control_station_people", "access-control"),  # WISKEY-PEOPLE-COMPLETE-2390: station-only people, duplicates, PIN check (its own line)
    Mount("wiskey_installer", "access-control"),  # WISKEY-INSTALLER-NATIVE-2400: WisKey's installer tools (system.configure)
    Mount("access_control_ops", "access-control"),  # WISKEY-OPS-VIEWS-2400: Settings › תפעול האינטרקום (its own line)
    Mount("access_control_system_status", "access-control"),  # WISKEY-RESYNC-2520: WisKey system/status_v1 + jobs/status_v1 (its own line)
    Mount("doors", "access-control"),  # CR-033: door map, station placement, door grants, trusted path
    Mount("wiskey_relay_map", "access-control"),  # WISKEY-RELAYMAP-2310: the WisKey relay map approval
    Mount("door_automations", "access-control"),  # CR-AUTODOORS-295: automations that open doors (its own line)
    Mount("door_windows", "access-control"),  # CR-039 DOORWIN-295: door windows + emergency controls (OFF)
    Mount("quiet", "notifications"),  # CR-QUIET103 slice 1: quiet windows per floor / area (OFF)
    Mount("wiskey_validation", "access-control"),  # WISKEY-LIVE-VALIDATION-2390: station acceptance runs (on demand only)
    Mount("readiness", "ops"),  # CR-READY96 slice 1: installation readiness score (system.configure)
    Mount("demo", "ops"),  # CR-READY96 slice 1: demo mode on a separate database (demo.run, sensitive, in no built-in role)
    Mount("occupancy", "occupancy"),  # ZONECOUNT107-295: people count per area from Frigate reviews (OFF)
    Mount("camera_suggest", "plan"),  # CAMSUGGEST138-295: nearest-camera suggestion settings + accepted zone camera
    Mount("scenarios", "scenarios"),  # XSCENARIO109-295: cross-module scenarios (OFF; never a door or device action)
    Mount("devices", "devices"),
    Mount("popup_layout", "devices"),  # AREAEDIT-2290: the area pop-up layout (system.configure)
    Mount("device_layouts", "devices"),
    Mount("device_cameras", "devices"),
    Mount("multimedia", "multimedia"),  # CR-015: מולטימדיה - מסכים ושלט (/api/v1/multimedia; /api/v1/media is the camera video router)
    Mount("schedules", "schedules"),  # CR-014: תזמונים
    Mount("automations", "automations"),  # CR-017: אוטומציות · סצנות · סקריפטים
    Mount("automation_blueprints", "automations"),  # CR-BLUEPRINT80: ready-made automation templates (its own line)
    Mount("automation_ext", "automations"),  # KAV079-295: the editors' extension (wall buttons, pre-save checks, on-device test)
    Mount("alarm", "alarm"),  # CR-010: אבטחה › אזעקה
    Mount("zones", "zones"),
    Mount("skins", "plans"),
    Mount("plan_area_links", "zones"),  # K88: room <-> area links (table, suggestions, bulk apply)
    Mount("floor_images", "plans"),  # K88: own floor images (off / on) and their alignment
    Mount("plan_bakes", "plans"),  # CR-029 S3: stills, room masks and lightmaps rendered by an editor browser
    Mount("search", "search"),
    Mount("backup_offbox", "backup"),  # DATASTORE-295 phase 2: before /backups/{name}
    Mount("backup", "backup"),
    Mount("system_update", "system-update"),  # CR-021 S1: self-update check and settings (system.update)
    Mount("frames", "recordings"),
    Mount("cases", "cases"),
    Mount("storage", "storage"),
    Mount("rules", "rules"),
    Mount("push", "push"),
    Mount("energy_billing", "energy"),  # CR-023 P2: electricity billing - customers, accounts, prices, bills
    Mount("mobile_notifications", "notifications"),  # CR-027: the phone app's push registration and message fetch - BEFORE /notifications/{nid}
    Mount("notifications", "notifications"),  # CR-018: התראות - the inbox, the push action endpoint, administration (notify.manage)
    Mount("notify_whatsapp", "notifications"),  # NOTIFWA: the WhatsApp channel - master switch, own-number test, own opt-out
    Step("messaging_uses"),  # the messaging uses that join their registry at import (TEMPREG-295, CR-INSIGHT215, REGSTART-295)
    Mount("presence", "presence"),  # CR-027: the phone app - device registration, presence / sensor reports, the required-sensors policy
    Mount("building_presence", "presence"),  # BUILDING-PRESENCE-2271: anonymous room / building occupancy from the tagged presence sensors (invisible while none is tagged)
    Mount("app_refresh", "identity"),  # APPREFRESH-295: the phone app's persistent sign-in (switch security.app_refresh, default off)
    Mount("app_brand", "settings"),  # APP-SERVER-LEFTOVERS-2380: the company name + logo for the phone apps' splash / about screen (device token or session, read-only)
    Mount("ha_users", "access"),  # USR1: home-system users created from Arx (users.ha_manage + an HA administrator)
    Mount("health", "ops"),
    Mount("setup", "ops"),
    Mount("views", "views"),
    Mount("wall", "wall"),
    Mount("nvr_connection", "nvr"),  # CR-022: vendors, the stored connection, its test, the restart that applies it
    Mount("app_secrets", "settings"),  # TKSECRETS2: the in-app secrets store (its own line)
    Mount("video_services", "settings"),  # HEALTH-GO2RTC-FOLLOWUP-2431: which go2rtc services run, and the choice
    Mount("recorders", "nvr"),  # CR-024: recorders (multi-NVR) - list, add, edit, remove, connection, health
    Load("frigate"),
    Mount("recorder_health", "nvr"),  # CR-026: recorder health cards and thresholds
    Mount("camera_image_health", "nvr"),  # CAMHEALTH091: camera image health (dark / blurred / frozen / shifted)
    Mount("frigate", "frigate"),  # NN5 F1: the Frigate provider API (read-only toward Frigate)
    Mount("frigate_control", "frigate"),  # NN5 F2: the only routes that write to Frigate (every write class is off until switched on)
    Mount("frigate_f2b", "frigate"),  # NN5 F2b: auto profile on alarm change, native exports / cases, manual events (classes off by default)
    Mount("frigate_config", "frigate"),  # FRGS: config schema, zones and camera settings (class `config`, off by default)
    Mount("nvr_write", "nvr"),
    Mount("nvr_settings", "nvr"),  # CR-020 S1: read-only camera video settings
    Mount("nvr_privacy", "nvr"),  # NVRMASK-295: privacy-mask read / preview / guarded apply (off by default)
    Mount("mask_copy", "nvr"),  # MASKCOPY62-295: privacy-mask copy PLAN only, no device write (off by default)
    Load("energy_meters"),
    Load("generator"),
    Load("elevators"),
    Mount("temperature", "infra"),  # CR-INFRA-TEMPERATURE 2.9.1: טמפרטורות - units, history, alert log, routing (read-only)
    Mount("elevators", "infra"),  # CR-INFRA-ELEVATORS: מעליות - definitions, sensor mapping, derived live state (view only)
    Mount("generator", "generator"),  # CR-031: גנרטור - devices, live values, history, alerts, routing (view and alerts only)
    Mount("energy_meters", "energy"),  # CR-023 P1: מוני חשמל - meters, readings, consumption, settings
    Mount("shift_summary", "reports"),  # CR-SHIFT114: the shift / 24-hour summary (read-only; OFF by default)
    Mount("incidents", "events"),  # CR-LIVEEVENT100: אירוע חי - one page per incident (read-mostly; OFF by default)
    Mount("water", "infra"),  # CR-WATER78 slice 1: מים - meters, readings, consumption, settings (module switch, default off)
    Mount("insights", "insights"),  # CR-INSIGHT215: insights and the monthly building report (its own line; every part OFF by default)
    Mount("water_billing", "infra"),  # CR-WATER78 slice 3: water accounts, tariffs, bills (shared billing settings)
    Mount("nvr_batch", "nvr"),  # CR-020 S2C: multi-camera stream batches (background runner)
    Load("remote"),
    Mount("second_factor", "remote"),  # K11: the optional TOTP second factor (own enrolment, admin reset)
    Mount("access_tokens", "remote"),  # MFA-TOKENS-2490: the user's own access tokens (HA's read-only, Arx-issued revocable)
    Mount("factor_policy", "remote"),  # MFA-POLICY-2490: the sign-in factor policy - overrides and the compliance view (report mode by default)
    Mount("device_keys", "remote"),  # MFA-DEVICEKEY-2490: the Android app's phone key (register / sign / revoke; owner Q51)
    Mount("push_approval", "remote"),  # MFA-T095-REST-2530: approve a sensitive action on the phone (number matching; off by default)
    Mount("user_factors", "remote"),  # MFA-SCREENS-2510: one user's second factors for the user drawer (read only)
    Mount("capture_lease", "access"),  # CR-WISKEY-LEASE-REVOCATION-EVENT 7.3: lease route switch (off), lease length, C03 lookup scope
    Mount("bridge_key", "system"),  # CR-WISKEY-HMAC-ROTATION-295: bridge HMAC key rotation (off; go-live not permitted; fakes only)
    Mount("wiskey_pairing", "system"),  # WISKEY-PAIRING-2382: Arx <-> WisKey pairing status, probe, guided re-pair
    Mount("partner", "system"),  # PARTNERAPI113-295: partner tokens and webhooks (off; go-live not permitted; fakes only)
    Mount("access_grants", "access"),  # CR-ARX-WISKEY-SHARED-IDENTITY: external-person door grants (off; go-live not permitted)
    Mount("access_visitors", "access"),  # EXTERNALBUILD-297 / CR-VISITOR105: visitor invitations (off by default)
    Mount("access_wiskey_visits", "access"),  # WISKEY-VISITS-2407: WisKey visits / guest templates / the record of an Arx invitation (its own line)
    Mount("wiskey_switches", "access"),  # SMALLFIXA-295 (review 3 G-01/G-03): the wiskey.acr5_* switch writer (system administrator)
    Mount("wiskey_managed", "access"),  # WISKEY-MANAGED-INSTALL-2382: WisKey installs and upgrades through Arx (owner-started, system administrator)
    Load("fleet"),
    # CR-FLEET215: the signed daily fleet report (switch OFF; system administrator). Its readiness block comes from CR-READY96's
    # services/readiness.evaluate() (READYFLEET-295: one readiness, one screen); /readiness and /demo are CR-READY96's routers above.
    Mount("fleet", "system"),
    Mount("access_station_permissions", "access"),  # STATIONPERM-295: per-station access of a person (off; go-live not permitted)
    Mount("compliance_export", "access"),  # COMPLY108-295: who could enter which door and when (read-only export; off)
    Mount("remote", "remote"),  # CR-008: auth/session, the remote-access flag
    Load("local_identity"),
    Mount("local_privacy", "identity"),  # IDENT146: personal data export (off by default: privacy.personal_export)
    Mount("local_identity", "identity"),  # USR2: Arx-only identities (off by default: security.local_identity)
    Mount("service_identity", "identity"),  # USR2 P3: the service identity (local channel only; its off-only kill switch: either channel)
    Mount("local_passkeys", "identity"),  # USR2 phase 4: passkeys of Arx-only identities
    Step("assetlinks_route"),  # GET /.well-known/assetlinks.json: the Android app's Digital Asset Links statement (not under /api/v1)
    Mount("cast", "multimedia"),  # CR-028: שדר למסך - cast sessions, targets, the cast administration
    Step("cast_sessions"),  # the relay's callbacks and the live tokens of open casts
    Load("announcements"),
    Mount("announcements", "multimedia"),  # MU2: הכרזות קוליות - speak, setup, test, history
    Step("announcements"),  # the `announce` notification channel and the announcement log
    Step("wa_recipient_guard"),  # WAPACE-295: the WhatsApp recipient allow-list, for every sender
    Load("tickets"),  # CR-038 S1: the optional tickets module (its own lines)
    Load("tickets_admin"),
    Mount("tickets", "tickets", attr="open_router"),  # GET /tickets/module: the only route that answers while the module is off
    Mount("tickets_admin", "tickets"),  # settings, name, departments - BEFORE /tickets/{ticket_id}
    Load("tickets_contacts"),  # CR-038 S4 (its own lines)
    Load("tickets_links"),
    Mount("tickets_contacts", "tickets"),  # the contact / vendor directory - BEFORE /tickets/{ticket_id}
    Mount("tickets_dept_handlers", "tickets"),  # CR-DEPT-MANAGER-HANDLERS (its own lines) | department managers' handlers - BEFORE /tickets/{ticket_id}
    Mount("tickets_links", "tickets"),  # handler links, health, address probe, key - BEFORE /tickets/{ticket_id}
    Mount("tickets_table", "tickets"),  # CR-038 S6b: the board table (table, export.csv, bulk, views) | CR-038 S6b - BEFORE /tickets/{ticket_id}
    Load("tickets_budgets"),  # CR-SVC215 S1: budgets, the vendor card, vendor visits (their own lines)
    Load("tickets_vendor_stats"),
    Load("tickets_visits"),
    Mount("tickets_budgets", "tickets"),  # /tickets/costs/budgets... BEFORE the cost routes
    Mount("tickets_vendor_stats", "tickets"),  # /tickets/contacts/{id}/stats
    Mount("tickets_visits", "tickets"),  # /tickets/{id}/visits... BEFORE /tickets/{ticket_id}
    Mount("offline_field", "tickets"),  # OFFLINE110-295 S1: offline field work, server half (default OFF)
    Mount("tickets_costs", "tickets"),  # CR-038 S9: cost claims (report, export, review, on-behalf, downloads) | CR-038 S9 - BEFORE /tickets/{ticket_id}
    Mount("tickets_detail", "tickets"),  # TKDETAILBE: owner, timeline, quotes, vendor messages, drafts | BEFORE /tickets/{ticket_id}
    Mount("tickets_rules", "tickets"),  # TKRULES-291: tickets opened from alerts (system.configure) | BEFORE /tickets/{ticket_id}
    Mount("tickets_intake", "tickets"),  # CR-INTAKE99: free-text request drafts (operator side only) | BEFORE /tickets/{ticket_id}
    Mount("tickets_map", "tickets"),  # TKMAP1: the map element of a request | BEFORE /tickets/{ticket_id}
    Mount("tickets_rfq", "tickets"),  # TKRFQ1: requests for quotation (stage C1, the manager API) | /tickets/rfqs... BEFORE /tickets/{ticket_id}
    Mount("tickets_messages", "tickets"),  # CR-038 S5b (its own lines) | channel, outbox, inbound, message templates - BEFORE /tickets/{ticket_id}
    Mount("tickets_board", "tickets"),  # CR-038 S6: the manager board + the facet counts, BEFORE /tickets/{ticket_id}
    Mount("tickets", "tickets"),
    Step("tickets_public"),  # CR-038 S4: the module key and the public listener's wiring
    Mount("maintenance", "maintenance", attr="open_router"),  # CR-MAINT215: the optional maintenance module (its own lines) | GET /maintenance/module: answers while the module is off
    Mount("maintenance", "maintenance"),  # ledger, plans, rounds, supplier documents, tags (off by default)
    Mount("docread", "docread", attr="open_router"),  # SUPPLIERDOCS-297: reading an attached certificate into proposed fields (off by default) | GET /maintenance/docread/module
    Mount("docread", "docread"),
    Mount("emergency_readiness", "emergency-readiness", attr="open_router"),  # CR-EMERG104: the read-only emergency readiness view (off by default) | GET /emergency-readiness/module answers while the module is off
    Mount("emergency_readiness", "emergency-readiness"),
    Step("ha_bridge"),  # HMACACT-295: the key set learns the data directory
    Mount("messaging_accounts", "messaging"),  # CR-038 S5a: WhatsApp accounts per use (installation-level, no module gate)
    Mount("notices", "notices", attr="open_router"),  # CR-NOTICE106: לוח הודעות - notices, TV boards (module OFF by default) | module state + settings: answer while the module is off
    Mount("notices", "notices", attr="display_router"),  # the TV feed: no login, X-Board-Token
    Mount("notices", "notices"),
    Mount("notices", None, attr="page_router", prefix=False),  # GET /b/{slug}: the static TV page (before the www mount)
    Mount("calendar", "calendar", attr="open_router"),  # CALENDARS-298: יומנים - calendars, bookings, approvals, maintenance windows (module OFF by default) | module state, settings, guest purge: answer while the module is off
    Mount("calendar", "calendar"),
    Mount("calendar_attendees", "calendar"),  # CAL-ATTENDEES-2343: named attendees, their policy and notices
    Mount("calendar_sync", "calendar"),  # CALENDARS-298 phase 2: external calendar connections, bindings, manual sync
    Load("calendar_feeds"),  # CALCONNECT-2330: iCal OUT feeds (management + the token document)
    Step("calendar_runtime"),  # CALCONNECT-2330: sealed credentials and the built-in adapters, before the feeds router
    Mount("calendar_feeds", "calendar"),
    Mount("calendar_feeds", "calendar", attr="public_router"),  # the token document: no signed-in person (a subscriber cannot sign in)
    Mount("transit", "transit"),  # BUSTIMES-295: הגדרות › תחבורה ציבורית (stops, catalogue, health); the TV digest is a notices display route
    Mount("home_interface", "home"),  # HOME-SIMPLE-2420: the home interface (policy, rooms, favourites, wall panel exit)
    Mount("home_v3", "home"),  # HOME-V3-P1-2430: room wallpapers for everyone, the doors a guest may be given
    Mount("home_gaps", "home"),  # HOME-V3-GAPS-2436: the alarm changes for the home diary
    Mount("home_family", "home"),  # HOME-V3-P2-2431: family and building screens of the home interface
    Load("home_wall_events"),  # HOME-V3-FOLLOWUP-B-2431: a wall panel adds a family calendar event
    Load("home_ticket_photo"),  # HOME-V3-FOLLOWUP-B-2431: a photo on a new home ticket
    Mount("home_wall_events", "home"),
    Mount("home_ticket_photo", "home"),
    Step("tickets_messaging"),  # CR-038 S5b: the ticket message channel (outbox, inbound)
)
