"""Users from Home Assistant, VMS groups, role bindings, effective-permission preview and the RBAC audit
trail (chapters 8 and 40; docs/security/HA_IDENTITY_RBAC_HE.md §5-§12; contracts/access-api.design.json).

Identity comes only from Home Assistant (the bridge's directory push and the Ingress headers); nothing here
writes to HA. Every change bumps permission_revision, is audited with a before/after diff of the subject's
bindings, and closes the affected users' media sessions (services/revocation)."""
from __future__ import annotations

import datetime as dt
import json
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, Field

from ..audit import audit
from ..auth import current_principal, get_conn, normalize_username, settings_of
from ..db import set_setting, bump_permission_revision, get_setting, new_id, now_iso, permission_revision, unlocked
from ..errors import ApiError
from ..rbac import INSTALLATION, LEGACY_PERMISSIONS, LOCAL_ID_PREFIX, ROLE_NAMES_HE, ROLES, STATION, STATION_PERMISSIONS, Principal, expand_legacy, all_roles, authorize, camera_floors, effective_permissions, permissions_anywhere, require, role_name, role_permissions, scope_name
from ..remote_channel import is_remote
from ..services import ha_client, revocation
from ..services import playback as pb
from ..services.timeutil import parse_utc

router = APIRouter()

PERMISSION_LABELS: dict[str, str] = {
    "map.read": "צפייה במפה",
    "entity.state.read": "מצב ישויות HA",
    # devices.read (CR-007 slice 1): the read-only "חשמל והתקנים" area - HA floors → areas → per-domain cards with live
    # counts. Granted like map.read (viewer and above, not kiosk); a floor-scoped binding narrows it to the entities
    # placed on those floors exactly as entity.state.read does in routers/ha.py. Control is a separate permission
    # (devices.control, slice 2) and is never implied by this one.
    "devices.read": "צפייה בחשמל והתקנים",
    # devices.control (CR-007 slice 2): one-tap single-entity actions from the devices area, for the everyday domains
    # only - light, switch, input_boolean, cover, climate, fan, media_player (services/ha_scope.DEVICES_CONTROL_DOMAINS).
    # It never reaches a lock, the alarm panel, a siren, a script, a scene or a button: those stay behind
    # ha.entity.control (plus door.unlock / alarm.disarm for the sensitive ones), enforced in routers/ha.py and tested.
    # Floor-scoped exactly like devices.read (the entity's own placement, not HA's floor). Granted by default to
    # operator, site_admin and system_admin - NOT to viewer / kiosk, and NOT to editor (coordinator ruling on the
    # slice-2 review, 2026-09-28, keeping the recorded decision below that editor holds no control permission at all).
    "devices.control": "שליטה בהתקן בודד (חשמל והתקנים)",
    # devices.control_bulk (CR-007 slice 3): the floor menu, the area popover and the building buttons of the devices
    # area - "turn off the lights / close the covers / turn off the climate / turn off the screens / turn everything
    # off" for a building, an HA floor or an HA area, many physical devices from one click, each behind a confirmation
    # dialog and the server's own `confirmed: true`. It reaches ONLY lights, switches / input_booleans, covers (never
    # a door / garage / gate cover), climate, fans and media players - never a lock, the alarm panel, a siren, a script,
    # a scene, a button or a switch placed on the map as a door (services/device_bulk.py), and never a switch an
    # administrator (or the CR-019 classifier) protected from group actions. Treated like access.release:
    # granted by default ONLY to site_admin and system_admin (not operator, whose devices.control stays single-entity),
    # listed in sensitive_permissions_not_implied, so a custom role grants it to one person only by naming it among its
    # sensitive permissions. Floor-scoped like devices.control (the entity's own placement): a floor binding runs floor
    # and area actions over the entities placed on its floors; a building action needs installation scope.
    "devices.control_bulk": "פעולות מרוכזות בחשמל והתקנים: כיבוי תאורה / מיזוג / מסכים וסגירת תריסים לאזור, קומה או מבנה",
    "video.live": "שידור חי",
    "wall.view": "מסך קיר (קריאה בלבד)",
    "video.playback": "ניגון הקלטות",
    "events.read": "צפייה באירועים",
    "events.ack": "סימון אירועים כטופלו",
    # CR-SHIFT114 (r114): the shift / 24-hour summary. Holding it opens the screen; every section inside needs its own module's right (operator, site_admin, system_admin).
    "reports.shift": "סיכום משמרת: מה קרה בבניין (סעיפים לפי ההרשאות שלך)",
    "map.import": "ייבוא תוכניות",
    "map.edit": "עריכת מפה",
    "map.publish": "פרסום תוכנית",
    "placement.edit": "הצבת ציוד על המפה",
    "views.edit": "עריכת תצוגות",
    "catalog.manage": "ניהול ספריית העצמים",
    "site.content.configure": "הגדרות תוכן מקומיות",
    "system.configure": "הגדרות מערכת",
    "sources.configure": "הגדרת מקורות (NVR / go2rtc)",
    "identity.directory.read": "צפייה בספריית המשתמשים",
    "identity.local.manage": "ניהול משתמשי Arx (יצירה, קישורי כניסה, השבתה)",  # USR2: system_admin only, never delegable, never in a custom role
    "rbac.assign": "שיוך תפקידים",
    "rbac.roles.manage": "ניהול תפקידים",
    "audit.read": "צפייה באודיט",
    "backup.manage": "גיבוי ושחזור",
    "system.update": "עדכון המערכת",  # CR-021: check for and (S3) install a new version; system administrators only, never delegable
    # USR1 (docs/design/USR1_HA_USERS_FROM_ARX.md): create home-system users (ordinary, never administrators) with one Arx role,
    # and deactivate / activate / delete ONLY the users Arx itself created. A SYSTEM permission (built-in system_admin only,
    # never a custom role, never delegable: the security spec gives site administrators no home-system management); the actor
    # must also be an active home-system administrator in the synced directory (routers/ha_users.py).
    "users.ha_manage": "ניהול משתמשי מערכת הבית: יצירה, השבתה ומחיקה",
    # HMACACT2-295 (CR-034 section 7): starting or resuming a bridge key rotation. Sensitive, installation scope, system_admin only, never delegable,
    # never in a custom role (SYSTEM_PERMISSIONS). The route also still requires a system administrator.
    "bridge.key.rotate": "החלפת מפתח הגשר (הפעלה והמשך)",
    # PARTNERAPI113-295 (owner answer 166): the partner interface - partner tokens, webhook targets, secrets, the delivery log. A SYSTEM permission:
    # built-in system_admin only, never in a custom role, never delegable; a local Arx identity needs the second factor for it.
    "partner.manage": "ניהול ממשק השותפים: אסימונים, יעדי הודעות ויומן משלוחים",
    "video.export": "ייצוא וידאו",
    "ha.entity.control": "שליטה בישויות HA",
    "audio.talk": "דיבור דו־כיווני",
    "camera.ptz": "שליטת PTZ",
    # NN5 F2 (Frigate control, docs/changes/CR-029-FRIGATE-PROVIDER.md): the only permissions that write to a Frigate recorder. Every one is checked on the
    # camera it changes (profile: installation) AND needs its write class switched on for the recorder (system.configure, off by default). analytics.review
    # (operator and above, not sensitive) mirrors "reviewed" to Frigate; the other four are sensitive and held by site_admin and system_admin only.
    # camera.ptz (existing, held by no built-in role) is the PTZ step permission; the PTZ class is also behind a code flag that is OFF.
    "analytics.review": "Frigate: סימון פריטי סקירה כנסקרו גם ב־Frigate",
    "analytics.control": "Frigate: מתגי ניתוח של מצלמה (זיהוי, תנועה, שמע, התראות)",
    "analytics.record_control": "Frigate: הפעלה וכיבוי של הקלטה, צילומי תמונה והמצלמה עצמה",
    "analytics.profile": "Frigate: החלפת פרופיל פעיל",
    "analytics.events": "Frigate: שמירת אירוע מעבר לשמירה הרגילה ותיקון תווית",
    "analytics.exports": "Frigate: ייצוא קטע מצלמה בתוך Frigate (יצירה, שינוי שם, מחיקה של ייצוא שנוצר כאן)",
    "analytics.cases": "Frigate: תיקי תיעוד ב־Frigate (יצירה, שינוי שם, מחיקה של תיק שנוצר כאן)",
    "door.unlock": "פתיחת דלת",
    # CR-010 (אבטחה › אזעקה): the intrusion alarm section. alarm.view reads the panels and their zones (viewer and above,
    # not kiosk); alarm.arm arms a panel (operator and above - arming raises protection); alarm.disarm (T079, sensitive)
    # disarms, now granted by default to site_admin and system_admin like access.release; alarm.bypass (sensitive)
    # bypasses / restores one zone of a panel through the control the server paired with it - site_admin and
    # system_admin. All four are scoped like entity.state.read: installation-wide, or the panels placed on the
    # holder's floors (services/ha_scope.py). A custom role grants disarm / bypass only by naming them as sensitive.
    "alarm.view": "צפייה באזעקה ובחיישניה",
    "alarm.arm": "דריכת אזעקה",
    "alarm.disarm": "ניטרול אזעקה",
    "alarm.bypass": "עקיפת חיישן אזעקה (הוצאת אזור מהגנה)",
    # CR-014 (תזמונים, owner decision 2026-09-30): who edits schedules is a permission the owner grants to any user or role.
    # schedule.view reads them (site_admin, system_admin); schedule.manage creates / edits / enables / runs / deletes /
    # restores (site_admin, system_admin; sensitive - a custom role names it among its sensitive permissions);
    # schedule.sensitive adds the sensitive classes - alarm, locks, doors and gates (system_admin only; sensitive). All
    # three are scoped like devices.control (the action entity's own placement) and never implied by another permission.
    "schedule.view": "צפייה בתזמונים",
    "schedule.manage": "ניהול תזמונים: יצירה, עריכה, הפעלה והשבתה, הרצה מיידית, מחיקה ושחזור",
    "schedule.sensitive": "תזמון פעולות רגישות: אזעקה, מנעולים, דלתות ושערים",
    # CR-017 (אוטומציות · סצנות · סקריפטים, owner decisions 2026-10-01): six permissions, all scoped like devices.control - by the placement of the
    # item's TARGET entities (HA areas and floors are never a scope). there is NO view-only permission (owner decision 2026-10-01): who may not edit and save automations does not see them at all (at most they activate scenes and run scripts they may);
    # automation.manage creates / edits / enables / disables / runs / deletes automations, scene.manage the scenes (capture, edit), script.manage the
    # scripts (all SENSITIVE: a custom role names them among its sensitive permissions); script.run runs scripts (not sensitive); automation.code_view is
    # the second side of the editor's "builder / code" toggle (SENSITIVE). A step that arms, disarms, unlocks, locks, sounds a siren or moves a door needs the
    # same grant manual control needs at that entity (owner decision 6ג) - there is no separate "sensitive content" permission.
    "automation.manage": "יצירה, עריכה, הפעלה/השבתה, הרצה ומחיקה של אוטומציות",
    "scene.manage": "יצירה, צילום ועריכה של סצנות",
    "script.run": "הפעלת סקריפטים",
    "script.manage": "יצירה ועריכה של סקריפטים",
    "automation.code_view": "תצוגת קוד בעורך (הצד השני של המתג \"בונה · קוד\")",
    # screen.personalize (home redesign, owner decision 2026-09-30): the home screen's PERSONAL override - a direction of
    # its own and the user's own widget on / off / size / order (frontend החשבון שלי › המסך שלי, /me/prefs `home.personal`).
    # Presentation only, so it is not sensitive and is never implied by another permission; held by no default role except
    # system_admin - the owner grants it to one person through a custom role plus a binding. The server checks it on every
    # write AND every read: a stored value of a user who lost it is ignored (services/home_screen.py apply_personal).
    "screen.personalize": "התאמה אישית של המסך שלי",
    # CR-018 (התראות, owner decision 4b 2026-10-01): notify.manage is the ONE permission over what is sent - the settings tab "התראות": per-source
    # policies with recipients and channels, quiet hours and the pass-through matrix, escalation, lock-screen detail, retention, outgoing mail, and
    # everyone's delivery log. Installation scope, held by system_admin only, in sensitive_permissions_not_implied (a custom role grants it to one
    # person by naming it among its sensitive permissions). Receiving a notification needs NO permission - a user gets only what they may see.
    "notify.manage": "ניהול התראות: מקורות, נמענים, ערוצים, שעות שקט, הסלמה, דואר יוצא ויומן מסירה",
    # CR-027 (the phone app): presence.report lets a signed-in person register THEIR OWN phone and report what it shares
    # (held by every default role but kiosk - a kiosk display is not a person); presence.sensors.view (system_admin) sees
    # everyone's registered devices, what each one shares and its current presence state. Presence settings (the master
    # switch, the allowed sensors, the employee notice, the required-sensors policy, retention) are system.configure.
    "presence.report": "רישום המכשיר הנייד שלי ודיווח נוכחות",
    "presence.sensors.view": "צפייה במכשירים הניידים של כולם ובמה שהם משתפים",
    # WHOIN034-295 (board r034): presence.view opens "מי במבנה" - who the phone app currently places inside, by floor and area. Scoped like
    # the map (a floor-scoped holder sees that floor only; a person placed on a site only needs installation scope). system_admin only by
    # default and SENSITIVE (a custom role names it among its sensitive permissions): it shows where named people are right now.
    "presence.view": "צפייה במי שנמצא במבנה (מסך מי במבנה)",
    # CR-TIMESCRUB101 section 6/7 (owner-approved 2026-10-24): the PAST of the presence sensors (motion / occupancy / presence) on the
    # historical map's time scrub - it tells who was where, so it is not implied by devices.read: floor scope, site_admin and system_admin
    # by default, in sensitive_permissions_not_implied; every serving writes one audit row per (user, floor, day) (history.presence.view).
    "history.presence": "היסטוריית נוכחות במפה ההיסטורית (חיישני תנועה ונוכחות בעבר)",
    # CR-015 (מולטימדיה · מסכים ושלט, docs/architecture/MEDIA_API.md 6 / CR 6.1): six permissions, all scoped like devices.control (the
    # screen's anchor entity placement; HA areas and floors are never a scope). media.read (viewer and above, not kiosk) sees the
    # page, the cards and the state; media.control (operator and above) sends volume, keys, transport and text; media.power (operator
    # and above) turns a screen on / off and changes its source, app or sound output; media.public (site_admin and system_admin;
    # SENSITIVE - a custom role names it among its sensitive permissions) also lets a caller change content on a screen marked public;
    # media.bulk (same default roles; SENSITIVE) is the floor / area "כבה מסכים"; media.layout (site_admin and system_admin) edits the
    # screens page and the remote. Merging devices, kinds, approval, the public flag, audio links and profiles are system.configure.
    "media.read": "צפייה במסכים ובמולטימדיה",
    "media.control": "שליטה במסכים: עוצמה, מקשים וניגון",
    "media.power": "הדלקה וכיבוי של מסכים והחלפת מקור",
    "media.public": "מסכים ציבוריים: החלפת מקור ואפליקציה והקלדה",
    "media.bulk": "כיבוי מרוכז של מסכים בקומה או באזור",
    "media.layout": "עריכת מסך המולטימדיה והשלט",
    # CR-016 (נגנים, רמקולים וקבוצות): media.group (operator and above) joins and leaves rooms, sets a group's volume and starts a saved group - it also
    # needs media.control at EVERY member's anchor; a group of four rooms or more, or one that spans more than one floor, needs a confirmation, and a
    # group over the whole building needs media.bulk as well. Not sensitive. Saving a group (the presets) is media.layout.
    "media.group": "קיבוץ רמקולים וקבוצות שמורות",
    # CR-016 phase 2b (the direct Music Assistant connection, CR 17.4): media.browse (operator and above, the media.group pattern) opens the library tab of a
    # player - browse and search; starting an item stays media.control. media.queue (operator, site_admin, system_admin, like media.browse; a custom role may add it) moves,
    # deletes, plays next and clears queue rows - with media.control, and at every follower's anchor when the queue is a live leader's. Neither is sensitive.
    "media.browse": "עיון וחיפוש בספריית המוזיקה",
    "media.queue": "עריכת תור הניגון",
    # CR-028 (שדר למסך): media.cast (operator, site_admin, system_admin; not sensitive) starts, extends, switches and stops a cast of a camera to a
    # media screen within scope (the screen's anchor placement, like media.control) - with video.live on the camera, and only to a screen the
    # administrator allowed (system.configure, per screen, off by default). Stopping anyone's cast on a screen is also media.bulk there.
    "media.cast": "שידור וידאו של מצלמה למסכים",
    # MU2 (הכרזות קוליות): media.announce (site_admin, system_admin; SENSITIVE, a custom role names it explicitly) speaks a typed text through the speakers the administrator
    # allowed for announcements, by room or by device, and lets a rule carry an announce action. Installation scope; the setup and the test button are system.configure.
    "media.announce": "הכרזה קולית ברמקולים",
    "nvr.config.write": "כתיבה להגדרות ה־NVR",
    "nvr.config.events": "NVR: הפעלת התראות (Notify Surveillance Center) ולוחות זימון",
    "nvr.config.detection": "NVR: עריכת אזורי זיהוי תנועה ורגישות",
    "nvr.config.privacy": "NVR: עריכת מסכות פרטיות",
    "nvr.config.smart": "NVR: עריכת כללי Smart Event",
    "nvr.config.schedule": "NVR: עריכת לוח ההקלטה",
    # nvr.configure (CR-020 S2, owner decision 2026-10-03): changing a camera stream's encoding on the NVR (SVC, codec,
    # resolution, bitrate ...) and undoing such a change. The installer's job: a SYSTEM permission (SYSTEM_PERMISSIONS
    # below), held by the built-in system_admin only, never by a custom role, never delegable; checked at installation
    # scope AND on the camera's own chain (T055). It replaced the unused sensitive nvr.config.stream (removed from
    # roles.json; migration 0050 strips it from stored custom roles).
    "nvr.configure": "NVR: שינוי קידוד הזרמים של המצלמות",
    "nvr.config.osd": "NVR: שם ערוץ ו־OSD",
    "nvr.config.time": "NVR: שעון ו־NTP",
    "nvr.record.manual": "NVR: הקלטה ידנית",
    "nvr.record.lock": "NVR: נעילת קטע הקלטה",
    "nvr.alarm_output": "NVR: הפעלת יציאת אזעקה",
    "nvr.storage.test": "NVR: בדיקת דיסק",
    "nvr.system.reboot": "NVR: הפעלה מחדש",
    "rules.ha_notify": "חוקים: התראה דרך Home Assistant (notify)",
    # access.read is granted broadly in roles.json (viewer and above, not kiosk) on purpose: a product decision mirroring
    # map.read's own breadth, recorded as a deviation in docs/changes/CR-005-ACCESS-CONTROL-INTEGRATION.md (T054). Since
    # CR-036 it covers the stations of the entry center only (online, ringing, doors, camera stills): no person data - B0
    # removed the last-access record, and S3 moved the people directory and the entry log onto access.people.read /
    # access.events.read (below). Station-scoped through services/intercom_authority.py.
    "access.read": "צפייה בבקרת כניסה (WisKey)",
    # access.release (CR-005 §3, phase 3, T054) covers every PHYSICAL WisKey command SMPLWISE offers: door release,
    # call answer / reject / hang up, spoken announcement. Recorded decision 2026-09-27: granted by default ONLY to
    # site_admin and system_admin - the built-in roles that already carry operational authority over real systems
    # (ha.entity.control, rules.manage, rbac.assign; system_admin everything). NOT to viewer / kiosk (read-only roles),
    # NOT to editor (its management permissions are content authoring - maps, views, catalogue - not operational trust,
    # and it holds no control permission at all), and NOT to operator: operator does hold ha.entity.control, and a guard
    # desk is exactly who answers the intercom, but handing real-world door control to that broad role by default is a
    # policy expansion the owner has not decided; a custom role (or a later roles.json change) grants it narrowly.
    # It is in sensitive_permissions_not_implied (like door.unlock), so a custom role must list it explicitly among its
    # sensitive permissions. Installation scope only (stations are not mapped to sites): a site-scoped site_admin does
    # not get it. Narrowing it later = removing it from those two roles in roles.json and the design catalogue.
    # 2.4.9 (owner decision 2026-10-13): the call signal and the announcement moved onto access.call (below), so
    # access.release is the door permission alone (CR-033's one door rule, with door.unlock on the mapped lock).
    # WXPERM (owner decision 2026-10-13): renamed to the door-only access.doors.open (below). access.release stays a known,
    # sensitive LEGACY name (rbac.LEGACY_PERMISSIONS): a custom role saved with it keeps opening doors (and a deny of such a
    # role keeps refusing them); no built-in role lists it any more, and the role editor offers it only to a role that already
    # has it. Kept in the catalogue so stored roles and backups stay valid.
    "access.release": "בקרת כניסה: שחרור דלת (שם קודם של פתיחת דלתות; נשמר לתפקידים קיימים)",
    # access.doors.open (WXPERM, owner decision 2026-10-13): opening a door - the one door rule (services/door_authority.py)
    # on the station's chain, or door.unlock on the mapped lock. Door only: no call, announcement, entry log or people
    # directory (those are access.call / access.events.read / access.people.read). Sensitive (never implied; a custom role
    # names it explicitly), station-scope capable (rbac.STATION_PERMISSIONS). Default: site_admin, system_admin and the
    # door_opener grant role - the roles that held access.release before, so nothing regresses.
    "access.doors.open": "בקרת כניסה: פתיחת דלתות",
    # access.people.manage (CR-005 §3, phase 2 slice A1; owner decision 2026-09-28, answer 1 to the phase-2 brief):
    # create / edit / delete a person in WisKey - identity, phone, active, validity, PIN, cards, station assignments.
    # A configuration write that grants or revokes physical access once WisKey syncs it, so it gets exactly
    # access.release's treatment: granted by default ONLY to site_admin and system_admin, never to viewer / kiosk /
    # editor / operator, listed in sensitive_permissions_not_implied (a custom role must name it explicitly among its
    # sensitive permissions - that is how the owner grants it to one specific person: a custom role plus a binding),
    # installation scope only. Card capture (access.cards.capture, below) and door settings (access.doors.*) are separate
    # permissions; access.read still never implies any of them.
    "access.people.manage": "ניהול אנשים בבקרת כניסה (WisKey): יצירה, עריכה ומחיקה של אנשים, קודי PIN וכרטיסים",
    # access.cards.capture (CR-005 phase 2 slice A2; owner decision 2026-09-28, answer 2 to the phase-2 brief): reading a
    # presented card from a WisKey station's reader into the person editor - it puts a real reader at a door into
    # card-collection mode (PHYSICAL) and ends in a people write (the approved card opens the person's doors once WisKey
    # syncs it). Its own permission, required IN ADDITION to access.people.manage on every capture endpoint, so card
    # enrolment never rides along with the guard-desk access.release nor with people editing alone. Same treatment as
    # access.release / access.people.manage: default ONLY site_admin and system_admin, sensitive (never implied; a custom
    # role naming it among its sensitive permissions plus a binding is the per-person grant path), installation scope.
    "access.cards.capture": "קריאת כרטיס מקורא בעמדת WisKey (מפעיל את הקורא בדלת; דורש גם ניהול אנשים)",
    # CR-036 S3 (WisKey native screens; owner answers 2026-10-11): the split of what access.read used to cover, every one
    # scoped by the access-control station chain (station -> building -> site -> installation, CR-033 D2) and enforced by
    # the one projection filter (services/intercom_authority.py) on everything the add-on serves from WisKey. Owner answer
    # 3: an operator sees names only - the employee number, portraits, phone and profile values need access.people.sensitive.
    # Reads (not sensitive): stations.read = a station's technical details (model, firmware, relays, clock, door programs,
    # hold-open schedules, whether a public code is set - never its value); events.read = the entry log with person names;
    # people.read = people (names, station assignments, groups, validity); admin.read = the Settings status page (health,
    # sync, alerts, the intercom's own action log). Sensitive (never implied; a custom role names them explicitly):
    # events.export (CSV, audited), people.sensitive, call (answer / reject / hang up and spoken announcements - the
    # access.release split so answering a ring needs no door rights; 2.4.9, owner decision 2026-10-13: the call, announcement
    # and TTS-engine routes ride it on the station chain, held by operator, site_admin and system_admin by default - a custom
    # role may carry it too), and the three managers of the write phase (S15/S16) - catalogue entries only until
    # that phase gates its writes on them.
    "access.stations.read": "בקרת כניסה: פרטים טכניים של עמדות (דגם, קושחה, ממסרים, שעון, תוכניות דלת, לוחות החזקה, האם מוגדר קוד)",
    "access.events.read": "בקרת כניסה: יומן כניסות (כולל שמות)",
    "access.events.export": "בקרת כניסה: ייצוא יומן הכניסות לקובץ",
    "access.people.read": "בקרת כניסה: צפייה באנשים (שמות, שיוך לעמדות, קבוצות ותוקף)",
    "access.people.sensitive": "בקרת כניסה: פרטים רגישים של אנשים (מספר עובד, תמונה, טלפון, שדות פרופיל)",
    "access.people.message": "בקרת כניסה: שליחת הודעות וואטסאפ לאנשים",
    "access.call": "בקרת כניסה: מענה לשיחה מעמדה והכרזה קולית",
    "access.admin.read": "בקרת כניסה: מצב מערכת, סנכרון, התראות ויומן פעולות האינטרקום",
    "access.schedules.manage": "בקרת כניסה: עריכת לוחות זמנים של דלתות",
    "access.stations.manage": "בקרת כניסה: עריכת הגדרות עמדה (תוכניות דלת, החזקה פתוחה, קודים ציבוריים)",
    "access.groups.manage": "בקרת כניסה: עריכת קבוצות ושדות פרופיל",
    # CR-036 S11 (owner decision 2026-10-12, PG): generating a person's PIN - a personal value shown once to the requesting
    # operator and stored, logged, cached or audited nowhere. Its own permission ON TOP of access.people.manage, in an interactive
    # session only (an HA frontend or Arx browser session, never a bearer-token client); sensitive (never implied); default
    # site_admin and system_admin, like access.cards.capture. Scoped by the access-control station chain like the people writes.
    "access.pin.generate": "בקרת כניסה: יצירת קוד PIN לאדם (מוצג פעם אחת למבקש; דורש גם ניהול אנשים)",
    # CR-ARX-WISKEY-SHARED-IDENTITY D5 (owner answer 2, 2026-10-17): approving a time-bounded door grant for an EXTERNAL person (a vendor,
    # a technician) - per station (the access-control station chain), together with people.manage + people.sensitive (+ pin.generate for
    # a code). Sensitive, never implied; built-in holder system_admin only; the owner hands it to a user through a custom role.
    "access.external.grant": "בקרת כניסה: אישור גישה זמנית לאדם חיצוני (ספק או טכנאי)",
    # EXTERNALBUILD-297 (CR-VISITOR105): invite a visitor to the visitor-entrance doors of a station (approved by the host inside the envelope)
    "access.visitor.invite": "בקרת כניסה: הזמנת מבקר עם קוד כניסה זמני",
    # CR-AUTODOORS-295: create, edit, arm and stop the "open a door" blocks of automations - only for doors the person may open
    # themselves (checked at arm time and again at every fire). Opens nothing by itself. Sensitive, never implied; built-in holder
    # system_admin only; may be carried by a station-scope role (rbac.STATION_PERMISSIONS).
    "access.doors.automate": "בקרת כניסה: אוטומציות שפותחות דלתות (הגדרה, חימוש ועצירה)",
    "access.people.stations": "בקרת כניסה: מתן וחסימת גישה לאדם לפי עמדה",
    # CR-039 / DOORWIN-295 (owner decisions 2026-10-13): door windows and emergency controls - four separate sensitive permissions, never
    # implied, on the access-control station chain. Built-in holders: system_admin all four (emergency OPEN: system administrators only),
    # site_admin manage + cancel + emergency lock, operator the guard override (cancel). Everyone else through a custom role.
    "access.windows.manage": "בקרת כניסה: ניהול חלונות פתיחה של דלתות (שעות פתיחה מתוזמנות)",
    "access.windows.cancel": "בקרת כניסה: הפסקת חלון פתיחה פעיל ואימות ידני שהדלת חזרה למצב רגיל",
    "access.emergency.lock": "בקרת כניסה: נעילת חירום של כל הדלתות בהיקף",
    "access.emergency.open": "בקרת כניסה: פתיחת חירום של כל הדלתות בהיקף (פינוי)",
    # EMROLE-295 (owner decisions 2026-10-24): who may give the built-in emergency_open role to a person (guard, temporary guard, reception), with an expiry.
    # System administrators always; the built-in security_manager role (this permission alone) while the setting doors.emergency.grant.by_security_manager is on.
    # Sensitive, never implied, never delegable: it grants the single emergency_open role and nothing else (no rbac.assign, no other role).
    "emergency.open.grant": "מתן תפקיד פתיחת חירום לאנשים (עם תוקף) וביטולו",
    # CR-023 (electricity meters and bills; owner decision 2026-10-04: three permissions only). energy.view: meters, kWh and
    # account status without money (operator and above). energy.bills: money (prices, amounts, bills, PDFs), customer
    # contact fields, and every bill act - draft, issue, mark sent/paid, correct, cancel (site_admin, system_admin; SENSITIVE,
    # never implied). energy.manage: meters, accounts and formulas, customers, prices and VAT, business details, the
    # operational electricity settings (site_admin, system_admin). Installation scope only in v1. The retention values stay
    # behind system.configure and the backup switch behind backup.manage.
    # ZONECOUNT107-295 (CR-ZONECOUNT107): how many people are in an area now and over time (counts only). Sensitive, never implied; judged on every
    # camera that feeds the area; built-in holder system_admin only. The mapping and the switch stay behind system.configure.
    "occupancy.view": "צפייה בספירת אנשים לפי אזור",
    # XSCENARIO109-295 (CR-SCENARIO109 section 17): cross-module scenarios. view + manage: the managers and the system administrator from day
    # one (owner Q6 = 215 b); admin (settings, kill switch, reassign): the system administrator. All three are grantable to any role.
    "scenario.view": "צפייה בתרחישים חוצי מודולים",
    "scenario.manage": "כתיבה ועריכה של תרחישים חוצי מודולים",
    "scenario.admin": "הגדרות תרחישים, עצירת חירום והעברת בעלות",
    "energy.view": "צפייה במונים ובצריכה",
    "energy.bills": "חיובים: סכומים, לקוחות, הפקה וביטול",
    "energy.manage": "ניהול מונים, חשבונות, לקוחות ומחירים",
    # CR-031 (generator control screen; owner 2026-10-05): generator.view = the live screen, history charts, alerts and their
    # acknowledge / mute (operator and above); generator.manage = detection, the sensor mapping, rated values, thresholds and the
    # alert routing (site_admin, system_admin). View and alerts only: there is NO command to the controller, so no control permission.
    "generator.view": "צפייה בגנרטור והתראותיו",
    "generator.manage": "ניהול הגנרטור: זיהוי, מיפוי חיישנים וניתוב התראות",
    # CR-WATER78 (water meters; owner decisions 2026-10-23): water.view = the tab, meters, consumption, readings (operator and above -
    # NOT viewer: consumption of a tenant's sub-meter is personal data, Q4), scoped by the floors of the meter's entity (Q5); water.ack =
    # acknowledge / mute leak warnings (slice 2; operator and above); water.manage = define / edit / replace / retire meters, manual
    # readings, leak rule defaults, entity ids (site_admin, system_admin; installation scope). The module switch and the retention stay
    # behind system.configure, the backup choice behind backup.manage. No actuation permission: the module never writes a device (Q6).
    "water.view": "צפייה במוני מים ובצריכה",
    "water.ack": "התראות מים: אישור והשתקה",
    "water.manage": "ניהול מוני מים: הגדרה, קישור, כללי דליפה",
    # CR-WATER78 slice 3 (section 16): money of the water billing - prices, amounts, open balances, the bills and every bill action, the
    # customers' contact fields. Sensitive, never implied; site_admin and system_admin by default (operator / viewer: off).
    "water.bills": "חיובי מים: סכומים, לקוחות, הפקה וביטול",
    # CR-INFRA-ELEVATORS: define elevators and link their state sensors (site_admin, system_admin; installation scope). Viewing the
    # elevators needs no permission of its own: devices.read, scoped by the floors of the linked sensors (routers/elevators.py).
    "infra.elevators.manage": "ניהול מעליות: הגדרה וקישור חיישני מצב",
    # CR-INFRA-TEMPERATURE 2.9.1: viewing the temperature units needs devices.read (scoped by the unit's sensors, routers/temperature.py).
    # ack = acknowledge a unit's alerts and mute its WARNINGS for a while (operator, site_admin, system_admin); manage = define units, link
    # sensors, thresholds, rules, the installation defaults and the learned defrost windows (site_admin, system_admin; installation scope).
    "infra.temperature.ack": "טמפרטורות: אישור התראות והשתקת אזהרות",
    "infra.temperature.manage": "ניהול טמפרטורות: יחידות, חיישנים, ספים וכללים",
    # TEMPLINK-295: create / revoke a temporary download link of a temperature report (site_admin, system_admin; installation scope; the
    # feature itself is OFF until the temperature settings turn it on)
    "infra.temperature.report_link": "טמפרטורות: יצירה וביטול של קישור הורדה זמני לדוח",
    # WALINK-295: send that link as a plain-text WhatsApp message to the recipients the settings name (site_admin, system_admin; OFF until the settings turn it on)
    "infra.temperature.report_link_send": "טמפרטורות: שליחת קישור הדוח בוואטסאפ לנמענים שהוגדרו",
    # CR-INSIGHT215 (2.15.0): read-only insights (door openings without an entry event, waste) scoped by the entity they are about; their
    # thresholds and door pairs; the monthly building report (installation). Defaults: site_admin, system_admin. Every part ships OFF.
    "insights.read": "תובנות: פתיחות דלת לא מוסברות וצריכת אנרגיה",
    "insights.manage": "תובנות: ספים וזוגות דלת",
    "reports.building": "דוח בניין חודשי (PDF)",
    # CR-MAINT215 (2.15.0, the maintenance module; OFF by default): view = the ledger, plans, rounds, supplier documents and a scanned tag
    # (operator, site_admin, system_admin); perform = walk a round, mark a plan done (same roles); manage = create / edit / delete tasks,
    # renew a certificate or a document, print and revoke tags (site_admin, system_admin). Scoped by the task's place (floor / building /
    # site; a placeless task is an installation-level task). Not sensitive: no money, no person data, no physical action.
    "maintenance.view": "אחזקה: צפייה בפנקס, בתוכניות ובסבבים",
    "maintenance.perform": "אחזקה: ביצוע סבבים וסימון עבודות שבוצעו",
    "maintenance.manage": "אחזקה: ניהול משימות, אישורים, מסמכי ספקים ותגיות",
    # CR-EMERG104 (owner q202): the emergency readiness view is opened by maintenance.view OR emergency.view, configured by maintenance.manage OR
    # emergency.manage (and its contact list); each row is still redacted by the permission of its own source. Default: site_admin, system_admin.
    "emergency.view": "מוכנות לחירום: צפייה בדף ובהיסטוריה",
    "emergency.manage": "מוכנות לחירום: הגדרות, קישור משימות, מצלמות חירום ואנשי קשר",
    # CR-038 (the optional tickets module, docs/changes/CR-038-TICKETS-MODULE.md section 8; owner decisions D15 / D25): WHAT a person
    # may do with tickets - WHERE is the ticket's place AND department membership (services/tickets/access.py visible()). view: see
    # tickets (own, assigned to me, my departments') and be assignable in a department one is a member of (operator, site_admin,
    # system_admin); create: open a ticket (same roles); manage: assign / close / edit in the departments one MANAGES (site_admin,
    # system_admin); external: send to an outside contact or vendor (sensitive; site_admin, system_admin); all_departments: manage /
    # view every department without membership (sensitive; system_admin); configure: departments, members, categories, the contact
    # directory, the module's display name (sensitive; system_admin). Each is also a single-permission built-in role
    # (tickets_<name>, roles.json) so it can be given to ONE person with an ordinary binding (D25, section 8.2).
    # D33: the labels carry the module's display name as the token {module} (owner rename 2026-10-14); every place that serves them renders it
    # (rendered_labels below) - never write the default name here.
    "tickets.view": "{module}: צפייה",
    "tickets.create": "{module}: פתיחה",
    "tickets.manage": "{module}: ניהול המחלקות שבאחריותי (שיוך, עריכה וסגירה)",
    "tickets.external": "{module}: שליחה לגורם חיצוני (ספקים ואנשי קשר)",
    "tickets.all_departments": "{module}: כל המחלקות",
    "tickets.configure": "{module}: הגדרות (מחלקות, חברים וספרייה)",
    # CR-038 D31 (slice 9, section 11A.8): cost claims of external vendors - both sensitive, each also a single-permission role.
    # costs.view: see amounts, lines, invoice files, cost columns and reports (site_admin, system_admin); costs: approve / adjust /
    # reject, mark paid, enter a claim on the vendor's behalf, reopen the window, override the close gate (system_admin).
    "tickets.costs.view": "{module}: צפייה בעלויות (סכומים, חשבוניות ודוחות)",
    "tickets.costs": "{module}: אישור עלויות (אישור, תיקון, דחייה וסימון תשלום)",
    # Owner 14.10 (docs/changes/CR-038-DELETE-NOTES.md): full, irreversible deletion of a ticket with everything hanging off it
    # (notes, photos, links, costs). Sensitive, not delegable, a single-permission role tickets_delete; system_admin only.
    "tickets.delete": "{module}: מחיקה מלאה (כולל הערות, תמונות, קישורים ועלויות)",
    # CR-DEPT-MANAGER-HANDLERS (owner 2026-10-17, docs/changes/CR-DEPT-MANAGER-HANDLERS.md): a department MANAGER manages the handlers
    # and vendors of HIS departments on "מטפלים וספקים" (add / remove members without a manager role, attach / detach directory rows,
    # create a directory row, edit / erase the rows he created that no other department uses). Effective only together with
    # tickets.manage AND a manager membership of the department (services/tickets/dept_handlers.py). Sensitive, not delegable by
    # default, a single-permission role tickets_handlers; system_admin only among the built-in roles.
    "tickets.handlers": "{module}: ניהול מטפלים וספקים במחלקות שבאחריותי",
    # VPORTALRFQ (owner 2026-10-17): approve / reject the company technician requests vendors send from the portal - only for vendors
    # of the departments the holder manages (all of them with tickets.all_departments); tickets.configure keeps approving every one.
    # Sensitive, not delegable by default, the single-permission role tickets_technician_requests; system_admin only among built-ins.
    # SMALL-294 (CR-038 18A, D15): keep the contact / vendor directory (create, edit, erase, export, full phone numbers, every row) without
    # tickets.configure; tickets.configure still covers it. Sensitive, not delegable by default, a single-permission role tickets_directory.
    "tickets.directory": "{module}: ספרייה - ספקים ואנשי קשר חיצוניים",
    "tickets.technician_requests": "{module}: אישור בקשות טכנאים מספקים (במחלקות שבאחריותי)",
    # CR-INTAKE99 (owner 143, 2026-10-24): see and decide the free-text requests that arrive from known numbers (drafts). Sensitive, not
    # delegable by default, the single-permission role tickets_intake; department managers and system admins hold it implicitly.
    "tickets.intake": "{module}: קליטת פניות בטקסט חופשי (טיוטות לאישור)",
    # CR-038 D9: choosing which linked WhatsApp account sends each kind of message (installation level, slice 5a's screen; the
    # permission is catalogued here with the module so 5a does not touch the shared files). Sensitive; system_admin.
    "messaging.accounts.manage": "בחירת חשבונות וואטסאפ לשליחת הודעות",
    # CR-WA-PACING-295: the dedicated WisKey service principal may reserve and release a send on the shared WhatsApp budget - nothing else.
    # Sensitive, in no built-in role (a custom role holding only this permission is bound to the principal the owner created).
    "messaging.pacing.reserve": "הקצאת שליחה בתקציב הוואטסאפ המשותף (שירות WisKey בלבד)",
    # CR-READY96 (demo mode, owner decision 2026-10-24): starting / extending / stopping a demo on a separate database is for the SYSTEM INSTALLER only -
    # sensitive, in no built-in role (an administrator names it in a custom role). demo.run_anywhere: the owner may also start one over the remote channel on any server
    # (elsewhere the remote demo runs only where the installer switched `demo.allow_remote` on).
    "demo.run": "הפעלת מצב הדגמה על מסד נתונים נפרד (מתקין המערכת בלבד)",
    "demo.run_anywhere": "הפעלת מצב הדגמה מרחוק בכל שרת (הבעלים בלבד)",
    # CR-NOTICE106 section 6: the building notice board (module OFF by default). view = read my notices; manage = write, publish,
    # archive, tag to TV boards (scoped: the audience must fit the writer's scope); push = publish with a push (slice 2); boards =
    # the TV boards (links, display settings, tokens). manage / push / boards have single-permission grant roles.
    "notices.view": "לוח הודעות: צפייה",
    "notices.manage": "לוח הודעות: כתיבה, פרסום וארכוב",
    "notices.push": "לוח הודעות: שליחת התראה לנמענים",
    "notices.boards": "לוח הודעות: לוחות תצוגה (קישורים והגדרות מסך)",
    # NOTICEDEL-295: real deletion of a published or archived notice (a draft is deleted by its writer). site_admin + system_admin; not delegable by default.
    "notices.delete": "לוח הודעות: מחיקה סופית של הודעה",
}
SYSTEM_PERMISSIONS = {"system.configure", "sources.configure", "identity.directory.read", "rbac.roles.manage", "audit.read", "backup.manage", "nvr.configure", "system.update",
                      "users.ha_manage", "identity.local.manage", "bridge.key.rotate", "partner.manage"}  # rbac.assign is delegable (T082); USR1: users.ha_manage; USR2: identity.local.manage (system_admin only, never in a custom role)
# T082 (R164): the per-installation allow-list of roles a delegated administrator may hand out. Setting key
# `rbac.delegable_roles` (shipped in 0.1.36 - kept, so an allow-list the owner already edited survives); the default
# narrowed to viewer + operator. Never on it, whatever the setting says: system_admin / site_admin, a role with a
# system permission or with rbac.assign itself (no delegating the delegation), a custom role with a sensitive grant.
# DOORWIN2-295 (CR-039 7.2): door_windows_guard (end a running window) is delegable by default; door_windows_manager, emergency_lock and emergency_open are NOT
# (a delegated administrator cannot hand out building-wide hold-open or emergency rights unless the owner adds them to `rbac.delegable_roles`).
DEFAULT_DELEGABLE = ["viewer", "operator", "tickets_view", "tickets_create", "tickets_manage", "door_windows_guard",  # CR-038 8.2: the three plain ticket grants
                     "notices_manage", "notices_push", "notices_boards",  # CR-NOTICE106 section 6: the notice board's grants are delegable
                     "announcer"]  # ANNOUNCE-295 (owner 2026-10-25): easy to hand out; every announcement is audited
NEVER_DELEGABLE = {"system_admin", "site_admin"}
SENSITIVE: list[str] = list(json.loads((Path(__file__).resolve().parents[1] / "roles.json").read_text(encoding="utf-8")).get("sensitive_permissions_not_implied", []))
SCOPE_TABLES = {"site": "sites", "building": "buildings", "floor": "floors"}
STALE_S = 300  # the integration pushes the directory every 60 s


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def rendered_labels(conn: sqlite3.Connection) -> dict[str, str]:
    """PERMISSION_LABELS as a screen shows them: a module's templated label rendered with its display name (CR-038 D33)."""
    from ..services.tickets import naming

    return naming.render_catalogue(conn, PERMISSION_LABELS)


# ---------------------------------------------------------------- shaping

def _subject_name(conn: sqlite3.Connection, kind: str, subject_id: str) -> str:
    if kind == "group":
        row = conn.execute("SELECT name FROM groups WHERE id = ?", (subject_id,)).fetchone()
        return row["name"] if row else subject_id
    ha = conn.execute("SELECT name, username FROM ha_users WHERE id = ?", (subject_id,)).fetchone()
    if ha and (ha["name"] or ha["username"]):
        return ha["name"] or ha["username"]
    vms = conn.execute("SELECT display_name, username FROM users WHERE id = ?", (subject_id,)).fetchone()
    if vms and (vms["display_name"] or vms["username"]):
        return vms["display_name"] or vms["username"]
    return subject_id


def _binding_dict(conn: sqlite3.Connection, b: sqlite3.Row, via_group: str | None = None) -> dict[str, Any]:
    return {
        "id": b["id"],
        "subject_kind": b["subject_kind"],
        "subject_id": b["subject_id"],
        "subject_name": _subject_name(conn, b["subject_kind"], b["subject_id"]),
        "role_id": b["role_id"],
        "role_name": role_name(conn, b["role_id"]),
        "scope_type": b["scope_type"],
        "scope_id": b["scope_id"],
        "scope_name": scope_name(conn, b["scope_type"], b["scope_id"]),
        "effect": b["effect"],
        "permission_revision": b["permission_revision"],
        "assigned_by": b["assigned_by"],
        "created_at": b["created_at"],
        "expires_at": b["expires_at"],
        "via_group": via_group,
    }


def _active_bindings_sql(extra: str = "") -> str:
    return f"SELECT * FROM bindings WHERE revoked_at IS NULL AND (expires_at IS NULL OR expires_at > ?) {extra} ORDER BY created_at"


def _user_bindings(conn: sqlite3.Connection, user_id: str) -> list[dict[str, Any]]:
    now = now_iso()
    out = [_binding_dict(conn, b) for b in conn.execute(_active_bindings_sql("AND subject_kind = 'user' AND subject_id = ?"), (now, user_id)).fetchall()]
    for g in conn.execute("SELECT g.id, g.name FROM groups g JOIN group_members m ON m.group_id = g.id WHERE m.user_id = ?", (user_id,)).fetchall():
        out += [_binding_dict(conn, b, via_group=g["name"]) for b in conn.execute(_active_bindings_sql("AND subject_kind = 'group' AND subject_id = ?"), (now, g["id"])).fetchall()]
    return out


def _binding_summary(conn: sqlite3.Connection, kind: str, subject_id: str) -> list[str]:
    now = now_iso()
    return [f"{b['role_id']}@{b['scope_type']}:{b['scope_id']}:{b['effect']}" for b in conn.execute(_active_bindings_sql("AND subject_kind = ? AND subject_id = ?"), (now, kind, subject_id)).fetchall()]


def _sync_status(ha: dict[str, Any] | None, vms: dict[str, Any] | None, paired: bool) -> str:
    if ha:
        if not ha["is_active"]:
            return "removed"
        try:
            age = (dt.datetime.now(dt.timezone.utc) - parse_utc(ha["synced_at"])).total_seconds()
        except ValueError:
            age = STALE_S + 1
        return "verified" if age <= STALE_S else "stale"
    if vms and vms.get("source") == "dev":
        return "dev"
    return "unavailable" if paired else "unknown"


def _users(conn: sqlite3.Connection, principal: Principal) -> list[dict[str, Any]]:
    ha = {r["id"]: dict(r) for r in conn.execute("SELECT * FROM ha_users").fetchall()}
    vms = {r["id"]: dict(r) for r in conn.execute("SELECT * FROM users").fetchall()}
    paired = bool(get_setting(conn, "bridge.paired_at"))
    try:  # CR-008: the per-user remote-access flag (migration 0033)
        remote_ids = {r[0] for r in conn.execute("SELECT user_id FROM remote_access_users").fetchall()}
    except sqlite3.OperationalError:
        remote_ids = set()
    try:  # CR-008 P2: the last remote sign-in (migration 0035) and the live remote sign-ins per user
        last_remote = {r["user_id"]: r["last_at"] for r in conn.execute("SELECT user_id, last_at FROM remote_sign_ins").fetchall()}
    except sqlite3.OperationalError:
        last_remote = {}
    from ..rbac import is_system_admin
    from ..services import ha_user_auth

    # CR-008 amendment: under remote.policy = flag with remote.admins_default on, an administrator is admitted without a flag
    rs = ha_user_auth.remote_settings(conn)
    admins_default = rs.get("remote.policy", "flag") == "flag" and str(rs.get("remote.admins_default", "true")) == "true"
    remote_live: dict[str, int] = {}
    for entry in ha_user_auth.STORE.chains():
        uid = entry["session"].principal.user_id
        remote_live[uid] = remote_live.get(uid, 0) + 1
    groups_of: dict[str, list[dict[str, str]]] = {}
    for r in conn.execute("SELECT m.user_id, g.id, g.name FROM group_members m JOIN groups g ON g.id = m.group_id").fetchall():
        groups_of.setdefault(r["user_id"], []).append({"id": r["id"], "name": r["name"]})
    out = []
    for uid in sorted(set(ha) | set(vms), key=lambda i: (ha.get(i, {}).get("name") or vms.get(i, {}).get("display_name") or vms.get(i, {}).get("username") or i).lower()):
        h, v = ha.get(uid), vms.get(uid)
        active = bool(h["is_active"]) if h else bool(v["active"]) if v else False
        if h and v and not v["active"]:
            active = False
        admin_default = admins_default and active and is_system_admin(conn, uid)
        remote_basis = "local" if uid.startswith(LOCAL_ID_PREFIX) else "flag" if uid in remote_ids else "admin_default" if admin_default else None  # USR2 Q2: the role is the admission
        out.append({
            "id": uid,
            "name": (h or {}).get("name") or (v or {}).get("display_name") or (v or {}).get("username") or uid,
            "username": (h or {}).get("username") or (v or {}).get("username") or "",
            "is_admin": bool((h or {}).get("is_admin")),
            "active": active,
            "source": "local" if uid.startswith(LOCAL_ID_PREFIX) else "both" if h and v else "ha_directory" if h else "vms",  # USR2: an Arx-only identity
            "sync_status": _sync_status(h, v, paired),
            "synced_at": (h or {}).get("synced_at"),
            "first_seen_at": (v or {}).get("first_seen_at"),
            "last_seen_at": (v or {}).get("last_seen_at"),
            "groups": groups_of.get(uid, []),
            "bindings": _user_bindings(conn, uid),
            "is_self": uid == principal.user_id,
            "remote_access": remote_basis is not None,
            "remote_access_basis": remote_basis,  # flag | admin_default | None; the admin default is the setting's, not the user's switch
            "remote_admin_default": admin_default,  # the administrator default would admit this user without the flag
            "remote_last_sign_in": last_remote.get(uid),
            "remote_sessions": remote_live.get(uid, 0),
        })
    return out


def _ensure_user_row(conn: sqlite3.Connection, user_id: str) -> None:
    """A binding may be granted before the person ever opened the add-on: mirror the directory row into users."""
    if conn.execute("SELECT 1 FROM users WHERE id = ?", (user_id,)).fetchone():
        return
    ha = conn.execute("SELECT * FROM ha_users WHERE id = ?", (user_id,)).fetchone()
    if not ha:
        raise ApiError(404, "user_unknown", "המשתמש לא נמצא בספריית Home Assistant.")
    now = now_iso()
    conn.execute(
        "INSERT INTO users(id, username, display_name, source, active, first_seen_at, last_seen_at) VALUES (?, ?, ?, 'ingress', ?, ?, ?)",
        (user_id, ha["username"] or "", ha["name"] or ha["username"] or "", 1 if ha["is_active"] else 0, now, now),
    )


def _scope_exists(conn: sqlite3.Connection, scope_type: str, scope_id: str) -> bool:
    if scope_type == "installation":
        return scope_id == "*"
    if scope_type == "camera":  # T055: a registered camera (cameras are never soft-deleted)
        return conn.execute("SELECT 1 FROM cameras WHERE id = ?", (scope_id,)).fetchone() is not None
    if scope_type == STATION:  # CR-033 D2: a station the WisKey copy lists, or one already placed or mapped
        from ..services import intercom_doors

        return intercom_doors.station_known(conn, scope_id)
    table = SCOPE_TABLES.get(scope_type)
    if not table:
        return False
    return conn.execute(f"SELECT 1 FROM {table} WHERE id = ? AND deleted_at IS NULL", (scope_id,)).fetchone() is not None


def full_authority(conn: sqlite3.Connection, principal: Principal) -> bool:
    """Full RBAC authority = rbac.assign AND rbac.roles.manage installation-wide (a VMS system administrator).
    Everyone else who holds rbac.assign - a site_admin at any scope (even one bound installation-wide) or a custom
    role naming rbac.assign - is a DELEGATED administrator and goes through every T082 limit below. (Before T082 the
    line was "rbac.assign at installation scope", which let a site_admin bound installation-wide hand out
    system_admin.)"""
    return authorize(conn, principal, "rbac.roles.manage", INSTALLATION).allowed and authorize(conn, principal, "rbac.assign", INSTALLATION).allowed


def assigns_anywhere(conn: sqlite3.Connection, principal: Principal) -> bool:
    """rbac.assign at some scope - the coarse gate a delegated administrator passes (the real checks are per item)."""
    return "rbac.assign" in permissions_anywhere(conn, principal)


def delegation_block(conn: sqlite3.Connection, role_id: str) -> str | None:
    """Why a role can never be on the delegation allow-list (None = it may be)."""
    roles = all_roles(conn)
    if role_id not in roles:
        return "role_unknown"
    perms = set(roles[role_id])
    if role_id in NEVER_DELEGABLE or perms & SYSTEM_PERMISSIONS:
        return "system_role"
    if "rbac.assign" in perms:
        return "assign_role"
    if role_id not in ROLES and perms & set(SENSITIVE):
        return "sensitive_custom_role"
    return None


def delegable_roles(conn: sqlite3.Connection) -> list[str]:
    """Roles a delegated administrator may assign: the configured allow-list plus custom roles flagged delegable,
    minus anything delegation_block() rules out (a stale setting or flag can never widen it)."""
    raw = get_setting(conn, "rbac.delegable_roles")
    try:
        chosen = [r for r in json.loads(raw) if isinstance(r, str)] if raw else list(DEFAULT_DELEGABLE)
    except ValueError:
        chosen = list(DEFAULT_DELEGABLE)
    custom = [r["id"] for r in conn.execute("SELECT id FROM custom_roles WHERE deleted_at IS NULL AND delegable = 1").fetchall()]
    return sorted(r for r in set(chosen) | set(custom) if delegation_block(conn, r) is None)


def _refuse(conn: sqlite3.Connection, principal: Principal, action: str, scope: tuple[str, str], reason: str, message: str, details: dict[str, Any] | None = None, status: int = 403) -> ApiError:
    audit(conn, actor=principal, action=action, decision="denied", resource_type=scope[0], resource_id=scope[1], reason=reason, details=details or {})
    return ApiError(status, reason, message, details=details or {})


def group_reach_problem(conn: sqlite3.Connection, principal: Principal, group_id: str) -> dict[str, Any] | None:
    """Whether a DELEGATED administrator may touch this group at all (its membership, its bindings). Every active
    binding of the group must lie where the actor holds rbac.assign, carry an allow-listed role and stay within the
    actor's own permissions there (security spec §6: a group bound on two floors of two sites cannot be managed by
    someone delegated one floor) - deny bindings included, since removing a member lifts the group's deny for them -
    and the group needs at least one binding - an unanchored group has no scope a delegated administrator could vouch
    for. None = in reach."""
    rows = conn.execute(_active_bindings_sql("AND subject_kind = 'group' AND subject_id = ?"), (now_iso(), group_id)).fetchall()
    if not rows:
        return {"reason": "group_unanchored"}
    delegable = set(delegable_roles(conn))
    for b in rows:
        scope = (b["scope_type"], b["scope_id"])
        if not scope_in_reach(conn, principal, scope):
            return {"reason": "scope", "binding_id": b["id"]}
        if b["role_id"] not in delegable:
            return {"reason": "role", "binding_id": b["id"]}
        if set(role_permissions(conn, b["role_id"])) - set(effective_permissions(conn, principal, scope)):
            return {"reason": "ceiling", "binding_id": b["id"]}
    return None


def scope_in_reach(conn: sqlite3.Connection, principal: Principal, scope: tuple[str, str]) -> bool:
    """Whether a scope lies inside the actor's subtree: rbac.assign there (on its whole chain, deny-overrides) and, for
    a camera (T055), rbac.assign on EVERY floor the camera is anchored on - a camera that also hangs on a floor outside
    the actor's subtree would otherwise hand that floor's drawing (§15 camera context) to someone the actor may not
    reach. An unanchored camera is therefore in reach only of an installation-wide assigner."""
    if not authorize(conn, principal, "rbac.assign", scope).allowed:
        return False
    if scope[0] == "camera":
        return all(authorize(conn, principal, "rbac.assign", ("floor", f)).allowed for f in camera_floors(conn, scope[1]))
    return True


def is_member(conn: sqlite3.Connection, group_id: str, user_id: str) -> bool:
    return conn.execute("SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?", (group_id, user_id)).fetchone() is not None


def delegated_group_problem(conn: sqlite3.Connection, principal: Principal, group_id: str) -> dict[str, Any] | None:
    """A delegated administrator manages a group only when it is in reach AND they are not one of its members (a
    change to a group they belong to would change their own access). None = theirs to manage."""
    if is_member(conn, group_id, principal.user_id):
        return {"reason": "self_member"}
    return group_reach_problem(conn, principal, group_id)


def check_delegation(conn: sqlite3.Connection, principal: Principal, role_id: str, scope: tuple[str, str], subject_kind: str = "user",
                     subject_id: str | None = None, op: str = "bind", effect: str = "allow") -> None:
    """Pilot rule (§7) plus T082 (R164). Only holders of rbac.assign on the target scope assign or revoke; system_admin
    is installation-wide only. Full authority (full_authority) stops there. A DELEGATED administrator additionally:
    only allow-listed roles (never system_admin / site_admin / a role with a system permission, rbac.assign or - for a
    custom role - a sensitive grant); never a deny binding; only permissions they hold themselves at that scope (when
    granting an allow and when revoking a deny - both hand the permissions out); never their own
    bindings, directly or through a group they belong to (no self-escalation); a group only when every binding of it
    is in their reach (group_reach_problem). Every refusal is an audited `denied` row with its reason."""
    action = "rbac.bind" if op == "bind" else "rbac.unbind"
    require(conn, principal, "rbac.assign", scope)
    if op == "bind" and effect == "allow" and role_id == "system_admin" and scope != INSTALLATION:
        raise ApiError(422, "scope_not_allowed_for_role", "מנהל מערכת מוקצה רק ברמת ההתקנה כולה.")
    if op == "bind" and effect == "allow" and scope[0] == "camera" and "rbac.assign" in role_permissions(conn, role_id):
        # T055 ruling R3: no "administrator of one camera" - an ALLOW at camera scope carries viewing / operating roles
        # only; a full administrator may still DENY any role (system_admin, site_admin) on one camera (review M2)
        raise ApiError(422, "scope_not_allowed_for_role", "תפקיד שכולל שיוך תפקידים אינו מוקצה ברמת מצלמה.", details={"role_id": role_id})
    if op == "bind" and effect == "allow" and scope[0] == STATION and "rbac.assign" in role_permissions(conn, role_id):
        # CR-033 D2, as the camera rule: no "administrator of one station" - an ALLOW at station scope carries operating roles only
        raise ApiError(422, "scope_not_allowed_for_role", "תפקיד שכולל שיוך תפקידים אינו מוקצה ברמת עמדת אינטרקום.", details={"role_id": role_id})
    if op == "bind" and effect == "allow" and scope[0] == STATION and set(role_permissions(conn, role_id)) - STATION_PERMISSIONS:
        # SEC-WXD L4: a station binding grants nothing above or beside itself - an ALLOW there carries the door permissions only
        raise ApiError(422, "scope_not_allowed_for_role", "ברמת עמדת אינטרקום מוקצים רק תפקידי פתיחת דלתות.", details={"role_id": role_id})
    if full_authority(conn, principal):
        return
    if scope[0] == "camera" and not scope_in_reach(conn, principal, scope):
        raise _refuse(conn, principal, action, scope, "delegation_camera_scope", "המצלמה מוצבת גם מחוץ להיקף שבאחריותך (או שאינה מוצבת בכלל); רק מנהל המערכת משייך אותה.",
                      {"role_id": role_id, "camera_id": scope[1]})
    if op == "bind" and effect == "deny":
        # security review T082 (M2): a delegated administrator could deny people above them (a system admin, a peer
        # site admin) inside their scope. Deny bindings stay a full-authority tool.
        raise _refuse(conn, principal, action, scope, "delegation_deny_forbidden", "מנהל מקומי אינו יוצר חסימות; חסימה היא כלי של מנהל המערכת בלבד.", {"role_id": role_id, "subject_kind": subject_kind, "subject_id": subject_id})
    perms = set(role_permissions(conn, role_id))
    if perms & SYSTEM_PERMISSIONS:
        raise _refuse(conn, principal, action, scope, "delegation_exceeded", "מנהל מקומי אינו מקצה תפקידי ניהול או תפקידים עם הרשאות מערכת.", {"role_id": role_id})
    if role_id not in delegable_roles(conn):
        raise _refuse(conn, principal, action, scope, "role_not_delegable", "מנהל מקומי רשאי להקצות רק תפקידים מרשימת ההאצלה.", {"role_id": role_id, "delegable": delegable_roles(conn)})
    if op == "bind" or effect == "deny":
        # granting an allow, or revoking a deny (security review T082, M1): either one hands out these permissions
        missing = sorted(perms - set(effective_permissions(conn, principal, scope)))
        if missing:
            raise _refuse(conn, principal, action, scope, "delegation_escalation", "אי אפשר להאציל הרשאות שאין לך בהיקף הזה.", {"role_id": role_id, "missing": missing})
    if subject_id is not None:
        if (subject_kind == "user" and subject_id == principal.user_id) or (subject_kind == "group" and is_member(conn, subject_id, principal.user_id)):
            raise _refuse(conn, principal, action, scope, "delegation_self", "מנהל מקומי אינו משנה את השיוכים של עצמו (גם לא דרך קבוצה שהוא חבר בה).", {"role_id": role_id, "subject_kind": subject_kind, "subject_id": subject_id})
        if subject_kind == "group":
            problem = group_reach_problem(conn, principal, subject_id)
            if problem:
                raise _refuse(conn, principal, action, scope, "delegation_group_scope", "הקבוצה משויכת מחוץ להיקף שבאחריותך (או שאין לה שיוך); רק מנהל המערכת מנהל אותה.", {"role_id": role_id, "group_id": subject_id, **problem})


def assign_scopes(conn: sqlite3.Connection, principal: Principal) -> list[dict[str, str]]:
    """Every scope node where the actor holds rbac.assign (installation, sites, buildings, floors), with the path name
    the screens show - what a delegated administrator's scope picker offers."""
    out: list[dict[str, str]] = []
    if authorize(conn, principal, "rbac.assign", INSTALLATION).allowed:
        out.append({"type": "installation", "id": "*", "name": "כל ההתקנה"})
    for s in conn.execute("SELECT id, name FROM sites WHERE deleted_at IS NULL ORDER BY sort_order, name").fetchall():
        if authorize(conn, principal, "rbac.assign", ("site", s["id"])).allowed:
            out.append({"type": "site", "id": s["id"], "name": f"אתר · {s['name']}"})
        for b in conn.execute("SELECT id, name FROM buildings WHERE site_id = ? AND deleted_at IS NULL ORDER BY sort_order, name", (s["id"],)).fetchall():
            if authorize(conn, principal, "rbac.assign", ("building", b["id"])).allowed:
                out.append({"type": "building", "id": b["id"], "name": f"{s['name']} · {b['name']}"})
            for f in conn.execute("SELECT id, name FROM floors WHERE building_id = ? AND deleted_at IS NULL ORDER BY sort_order, level, name", (b["id"],)).fetchall():
                if authorize(conn, principal, "rbac.assign", ("floor", f["id"])).allowed:
                    out.append({"type": "floor", "id": f["id"], "name": f"{s['name']} · {b['name']} · {f['name']}"})
    # T055: the cameras the actor may bind at camera scope - the camera picker of the bindings editor
    from ..services.access import camera_scope

    reach = camera_scope(conn, principal, "rbac.assign")
    full = full_authority(conn, principal)
    for c in conn.execute("SELECT id FROM cameras ORDER BY sort_order, channel").fetchall():
        if reach.allows(c["id"]) and (full or scope_in_reach(conn, principal, ("camera", c["id"]))):
            out.append({"type": "camera", "id": c["id"], "name": scope_name(conn, "camera", c["id"])})
    # CR-033 D2: the WisKey stations the actor may bind at station scope (names from the WisKey copy, never ids on screen)
    from ..services import intercom_doors

    for station_id in intercom_doors.known_station_ids(conn):
        if authorize(conn, principal, "rbac.assign", (STATION, station_id)).allowed:
            out.append({"type": STATION, "id": station_id, "name": scope_name(conn, STATION, station_id)})
    return out


def in_reach(conn: sqlite3.Connection, principal: Principal, b: dict[str, Any] | sqlite3.Row) -> bool:
    return scope_in_reach(conn, principal, (b["scope_type"], b["scope_id"]))


def _principal_of(conn: sqlite3.Connection, user_id: str) -> Principal:
    u = conn.execute("SELECT username, display_name, source FROM users WHERE id = ?", (user_id,)).fetchone()
    return Principal(user_id=user_id, username=(u["username"] if u else ""), display_name=(u["display_name"] if u else ""), source=(u["source"] if u else "ingress"))


def _terminate(conn: sqlite3.Connection, settings: Any, user_ids: set[str]) -> None:
    """Immediate effect of a change that may take access away (§11, T055 §15): mark the users - their live relays
    re-check their camera leases and the shell's /me/ws says `permissions_changed` - then, re-evaluated per user with
    the change already written: close the playback sessions of cameras they no longer hold video.playback on, and
    cancel their queued / running exports of cameras they no longer hold video.export on (download re-checks too)."""
    if not user_ids:
        return
    from ..services import exports as ex
    from ..services.access import camera_scope

    revocation.mark(user_ids)
    sessions = []
    for uid in user_ids:
        p = _principal_of(conn, uid)
        playback = camera_scope(conn, p, "video.playback")
        sessions += [s for s in pb.REGISTRY.by_user(uid) if not playback.allows(getattr(s, "camera_id", None))]
        export = camera_scope(conn, p, "video.export")
        for job in conn.execute("SELECT id, camera_id FROM export_jobs WHERE owner_user_id = ? AND state IN ('queued', 'running')", (uid,)).fetchall():
            if export.allows(job["camera_id"]):
                continue
            try:
                ex.request_cancel(conn, job["id"])
            except ApiError:  # finished in between: the download refuses it anyway
                continue
            audit(conn, actor=None, action="video.export.cancel", decision="allowed", resource_type="camera", resource_id=job["camera_id"],
                  reason="access_lost", details={"job": job["id"], "owner_user_id": uid})
    if sessions:
        with unlocked(conn):
            for s in sessions:
                try:
                    pb.close(settings, s, "revoked")
                except Exception:  # noqa: BLE001 - never let a stream cleanup block the revocation
                    pass


def _group_members(conn: sqlite3.Connection, group_id: str) -> list[str]:
    return [r["user_id"] for r in conn.execute("SELECT user_id FROM group_members WHERE group_id = ?", (group_id,)).fetchall()]


def admin_count(conn: sqlite3.Connection) -> int:
    """Active users who hold rbac.roles.manage installation-wide right now - allow and deny bindings, direct and through
    groups, all counted by authorize() itself (security review T082, M3: counting allow bindings alone missed denies)."""
    n = 0
    for u in conn.execute("SELECT id, username, display_name, source FROM users WHERE active = 1").fetchall():
        if authorize(conn, Principal(u["id"], u["username"], u["display_name"], u["source"]), "rbac.roles.manage", INSTALLATION).allowed:
            n += 1
    return n


@contextmanager
def keep_an_admin(conn: sqlite3.Connection) -> Iterator[None]:
    """Around ANY binding or membership write (allow or deny, user or group): if the installation had an active VMS
    system administrator before and has none after, every write of the block is rolled back and the call refused (§10)."""
    before = admin_count(conn)
    conn.execute("SAVEPOINT t082_keep_admin")
    try:
        yield
        if before and not admin_count(conn):
            raise ApiError(409, "last_admin", "השינוי משאיר את ההתקנה בלי מנהל מערכת פעיל; הקצה מנהל אחר קודם.")
    except BaseException:
        conn.execute("ROLLBACK TO t082_keep_admin")
        conn.execute("RELEASE t082_keep_admin")
        raise
    conn.execute("RELEASE t082_keep_admin")


def active_user_ids(conn: sqlite3.Connection) -> set[str]:
    """The people the delegated directory lists (active in HA and in the VMS) - a delegated administrator may name no
    one else, in a membership change or in its preview."""
    ids = {r[0] for r in conn.execute("SELECT id FROM users WHERE active = 1").fetchall()}
    ids |= {r[0] for r in conn.execute("SELECT id FROM ha_users WHERE is_active = 1").fetchall()}
    ids -= {r[0] for r in conn.execute("SELECT id FROM users WHERE active = 0").fetchall()}
    ids -= {r[0] for r in conn.execute("SELECT id FROM ha_users WHERE is_active = 0").fetchall()}
    return ids


def delegated_sees(conn: sqlite3.Connection, principal: Principal, b: dict[str, Any] | sqlite3.Row) -> bool:
    """A binding a delegated administrator may see: inside their reach and not a system role's (a site_admin bound
    installation-wide reaches every scope, yet the system administrators' bindings stay out of their view)."""
    return in_reach(conn, principal, b) and not set(role_permissions(conn, b["role_id"])) & SYSTEM_PERMISSIONS


# ---------------------------------------------------------------- directory

@router.get("/identity/users")
def list_users(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    if not authorize(conn, principal, "identity.directory.read", INSTALLATION).allowed and assigns_anywhere(conn, principal):
        return _delegated_directory(conn, principal)
    require(conn, principal, "identity.directory.read", INSTALLATION)
    return {
        "users": _users(conn, principal),
        "directory": {
            "paired": bool(get_setting(conn, "bridge.paired_at")),
            "last_directory_at": get_setting(conn, "bridge.directory_at") or None,
            "users": conn.execute("SELECT COUNT(*) FROM ha_users").fetchone()[0],
        },
        "revision": permission_revision(conn),
        "can_assign": authorize(conn, principal, "rbac.assign", INSTALLATION).allowed,
        "delegated": not full_authority(conn, principal),
        "assign_scopes": assign_scopes(conn, principal),
        "assignable_roles": sorted(all_roles(conn)) if full_authority(conn, principal) else delegable_roles(conn),
        # CR-008 P2: turning a user's remote flag off ends their remote sessions only under remote.policy = flag
        "remote_policy": get_setting(conn, "remote.policy", "flag") or "flag",
    }


def _delegated_directory(conn: sqlite3.Connection, principal: Principal) -> dict[str, Any]:
    """What a delegated administrator (rbac.assign somewhere, no identity.directory.read) sees - security spec §4: not
    the organisation's directory, only what assigning inside their scope needs. Active people by name (there is no
    other way to pick an assignee), no HA admin flag, no sync diagnostics, and of each person only the bindings and
    groups inside the actor's reach."""
    reach_groups = {g["id"] for g in conn.execute("SELECT id FROM groups").fetchall() if delegated_group_problem(conn, principal, g["id"]) is None}
    users = []
    for u in _users(conn, principal):
        if not u["active"]:
            continue
        users.append({
            **u,
            "username": "",
            "is_admin": False,
            "synced_at": None,
            "first_seen_at": None,
            "last_seen_at": None,
            "remote_access": False,
            "remote_access_basis": None,
            "remote_admin_default": False,
            "remote_last_sign_in": None,
            "remote_sessions": 0,
            "groups": [g for g in u["groups"] if g["id"] in reach_groups],
            "bindings": [b for b in u["bindings"] if delegated_sees(conn, principal, b)],
        })
    return {
        "users": users,
        "directory": {"paired": bool(get_setting(conn, "bridge.paired_at")), "last_directory_at": None, "users": len(users)},
        "revision": permission_revision(conn),
        "can_assign": True,
        "delegated": True,
        "assign_scopes": assign_scopes(conn, principal),
        "assignable_roles": delegable_roles(conn),
    }


@router.post("/identity/sync")
def sync_directory(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Ask the bridge integration to push the HA user directory now (it pushes every 60 s anyway)."""
    require(conn, principal, "system.configure", INSTALLATION)
    settings = settings_of(request)
    if not get_setting(conn, "bridge.paired_at"):
        raise ApiError(503, "bridge_not_paired", "גשר Arx אינו מצומד ב־Home Assistant.")
    audit(conn, actor=principal, action="identity.sync", decision="allowed", resource_type="installation", resource_id="*", request_id=_rid(request))
    try:
        with unlocked(conn):
            result = ha_client.call_service(settings, "smplwise_bridge", "sync_directory", {}, return_response=True)
    except ApiError as exc:
        if exc.code in ("service_not_found", "ha_error"):
            return {"requested": False, "note": "האינטגרציה המותקנת עדיין ללא שירות sync_directory; הספרייה נדחפת אוטומטית כל דקה.", "error": exc.code}
        raise
    return {"requested": True, "result": result}


# ---------------------------------------------------------------- roles

@router.get("/access/roles")
def list_roles(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """The role catalogue. A delegated administrator (rbac.assign somewhere, no directory right) gets only the roles
    they may hand out - the wizard never offers system_admin, site_admin or anything off the allow-list."""
    delegated_only = not authorize(conn, principal, "identity.directory.read", INSTALLATION).allowed and assigns_anywhere(conn, principal)
    if not delegated_only:
        require(conn, principal, "identity.directory.read", INSTALLATION)
    delegable = delegable_roles(conn)
    roles = []
    for rid, perms in ROLES.items():
        roles.append({
            "id": rid, "name": role_name(conn, rid), "permissions": list(perms), "custom": False, "description": "", "revision": None, "delegable": rid in delegable,
            "sensitive_included": [p for p in perms if p in SENSITIVE], "sensitive_missing": [p for p in SENSITIVE if p not in perms and p not in LEGACY_PERMISSIONS], "system_role": bool(set(perms) & SYSTEM_PERMISSIONS),
            "delegation_block": delegation_block(conn, rid),
        })
    for r in conn.execute("SELECT * FROM custom_roles WHERE deleted_at IS NULL ORDER BY created_at").fetchall():
        roles.append(_custom_role_dict(conn, r))
    if delegated_only:
        roles = [r for r in roles if r["id"] in delegable]
    return {"roles": roles, "labels": rendered_labels(conn), "sensitive": SENSITIVE, "system_permissions": sorted(SYSTEM_PERMISSIONS), "delegable_roles": delegable,
            "legacy_permissions": LEGACY_PERMISSIONS,  # WXPERM: old name -> the permission it stands for (the editor hides an old name a role does not hold)
            "can_manage_roles": authorize(conn, principal, "rbac.roles.manage", INSTALLATION).allowed, "delegated": delegated_only or not full_authority(conn, principal)}


# ---------------------------------------------------------------- bindings

class BindingBody(BaseModel):
    subject_kind: str = Field(pattern="^(user|group)$")
    subject_id: str = Field(min_length=1, max_length=200)
    role_id: str = Field(min_length=1, max_length=60)
    scope_type: str = Field(pattern="^(installation|site|building|floor|camera|access_control_station)$")
    scope_id: str = Field(min_length=1, max_length=200)
    effect: str = Field(default="allow", pattern="^(allow|deny)$")
    expires_at: str | None = None


@router.get("/access/bindings")
def list_bindings(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    if not assigns_anywhere(conn, principal):
        require(conn, principal, "rbac.assign", INSTALLATION)
    rows = conn.execute(_active_bindings_sql(), (now_iso(),)).fetchall()
    if not full_authority(conn, principal):
        rows = [b for b in rows if delegated_sees(conn, principal, b)]
    return {"bindings": [_binding_dict(conn, b) for b in rows], "revision": permission_revision(conn)}


def validate_binding(conn: sqlite3.Connection, principal: Principal, body: BindingBody, request: Request | None = None) -> None:
    """Every check of one new binding, without writing anything but the audit row of a refusal: known role and scope,
    a future expiry, the delegation limits (check_delegation), an existing subject, no active duplicate. Shared by the
    single route, the group route and the all-or-nothing bulk route (routers/access_groups.py). The permission comes
    before any lookup: a caller without rbac.assign learns nothing about scopes or groups (security review T082)."""
    if not assigns_anywhere(conn, principal):
        require(conn, principal, "rbac.assign", INSTALLATION)
    if body.role_id not in all_roles(conn):
        raise ApiError(422, "role_unknown", "תפקיד לא מוכר.")
    scope = (body.scope_type, body.scope_id)
    require(conn, principal, "rbac.assign", scope)
    if not _scope_exists(conn, *scope):
        raise ApiError(422, "scope_unknown", "ההיקף (אתר / מבנה / קומה / מצלמה) לא נמצא.")
    if body.expires_at:
        try:
            if parse_utc(body.expires_at) <= dt.datetime.now(dt.timezone.utc):
                raise ApiError(422, "validation", "expires_at כבר עבר.")
        except ValueError:
            raise ApiError(422, "validation", "expires_at חייב להיות UTC (Z).")
    if body.subject_kind == "group" and not conn.execute("SELECT 1 FROM groups WHERE id = ?", (body.subject_id,)).fetchone():
        raise ApiError(404, "group_unknown", "הקבוצה לא נמצאה.")
    check_delegation(conn, principal, body.role_id, scope, body.subject_kind, body.subject_id, op="bind", effect=body.effect)
    if body.subject_kind == "user" and not user_known(conn, body.subject_id):
        raise ApiError(404, "user_unknown", "המשתמש לא נמצא בספריית Home Assistant.")
    if body.subject_kind == "user" and body.effect == "allow":
        from ..services import service_identity

        if service_identity.is_service_user(conn, body.subject_id):
            # USR2 P3 security review F4: the service identity is never a person - it holds no Arx role (a deny stays possible)
            audit(conn, actor=principal, action="rbac.bind", decision="denied", resource_type="user", resource_id=body.subject_id, reason="service_account",
                  details={"role_id": body.role_id})
            raise ApiError(422, "service_account", service_identity.SERVICE_ACCOUNT_HE)
    if body.subject_kind == "user" and body.subject_id.startswith(LOCAL_ID_PREFIX):
        # USR2-FIX F1: without a request the channel is unknown - fail closed (treated as remote)
        local_binding_check(conn, principal, body.subject_id, body.role_id, body.effect, remote=True if request is None else is_remote(request))
    dup =conn.execute(
        _active_bindings_sql("AND subject_kind = ? AND subject_id = ? AND role_id = ? AND scope_type = ? AND scope_id = ? AND effect = ?"),
        (now_iso(), body.subject_kind, body.subject_id, body.role_id, body.scope_type, body.scope_id, body.effect),
    ).fetchone()
    if dup:
        raise ApiError(409, "binding_exists", "השיוך הזה כבר קיים.", details={"binding_id": dup["id"]})


LOCAL_ONE_BINDING_HE = "למשתמש Arx יש תפקיד אחד בהיקף אחד. כדי להחליף אותו, השתמש ב״שינוי תפקיד״ במסך משתמשי Arx."
LOCAL_ROLE_HE = "התפקיד הזה אינו ניתן למשתמש Arx (מנהל מערכת והרשאות מערכת שמורים למשתמשי תשתית המערכת)."
LOCAL_DENY_HE = "למשתמש Arx אין חסימות: יש לו תפקיד אחד בהיקף אחד."


def local_binding_check(conn: sqlite3.Connection, principal: Principal, user_id: str, role_id: str, effect: str, *, remote: bool = True) -> None:
    """USR2 section 12.1 (owner answer Q3): an Arx-only identity holds exactly ONE allow binding - any role except system_admin
    (and no role with a system permission) - never a deny, never a second binding. Every refusal is audited.
    USR2-FIX F1 (CR-USR2 §1a.3): a role carrying an administrative permission is given to a local identity only from the local
    (Ingress) channel - on the remote channel (or when the caller's channel is unknown: `remote` defaults to True, fail closed)
    the refusal looks exactly like the dedicated routes' (404 `not_found`, as if the route did not exist), audited
    `rbac.bind` denied `local_admin_target_remote`."""
    from ..services import local_identity

    def refuse(code: str, message: str, status: int) -> ApiError:
        audit(conn, actor=principal, action="rbac.bind", decision="denied", resource_type="user", resource_id=user_id, reason=code, details={"role_id": role_id})
        return ApiError(status, code, message, details={"role_id": role_id})

    if effect != "allow":
        raise refuse("local_user_no_deny", LOCAL_DENY_HE, 422)
    if local_identity.role_refusal(conn, role_id):
        raise refuse("role_not_allowed_for_local_user", LOCAL_ROLE_HE, 422)
    if remote and local_identity.role_is_admin(conn, role_id):
        audit(conn, actor=principal, action="rbac.bind", decision="denied", resource_type="user", resource_id=user_id, reason="local_admin_target_remote",
              details={"role_id": role_id})
        raise ApiError(404, "not_found", "Not found")
    # EMROLE-295 (owner answer 2026-10-25): the emergency_open grant (always expiry-bound, audited, through /doors/emergency/grants) is the one exception to
    # "one binding": it neither counts as the person's role nor is refused for already holding one.
    existing = conn.execute(_active_bindings_sql("AND subject_kind = 'user' AND subject_id = ? AND role_id != 'emergency_open'"), (now_iso(), user_id)).fetchone()
    if existing and role_id != "emergency_open":
        raise refuse("local_user_one_binding", LOCAL_ONE_BINDING_HE, 409)


def user_known(conn: sqlite3.Connection, user_id: str) -> bool:
    return bool(conn.execute("SELECT 1 FROM users WHERE id = ?", (user_id,)).fetchone() or conn.execute("SELECT 1 FROM ha_users WHERE id = ?", (user_id,)).fetchone())


def touch_group(conn: sqlite3.Connection, group_id: str, principal: Principal) -> int:
    """Every change of a group - its name, members or its own bindings - moves its revision (the T082 guard)."""
    conn.execute("UPDATE groups SET revision = revision + 1, updated_at = ?, updated_by = ? WHERE id = ?", (now_iso(), principal.user_id, group_id))
    row = conn.execute("SELECT revision FROM groups WHERE id = ?", (group_id,)).fetchone()
    return int(row["revision"]) if row else 0


def insert_binding(conn: sqlite3.Connection, principal: Principal, request: Request, body: BindingBody, extra_audit: dict[str, Any] | None = None) -> tuple[str, int]:
    """Write one already-validated binding: bump the permission revision, audit (ids only) with the subject's
    before/after binding summary. Returns (binding id, permission revision). The caller terminates sessions."""
    with keep_an_admin(conn):
        if body.subject_kind == "user":
            _ensure_user_row(conn, body.subject_id)
        before = _binding_summary(conn, body.subject_kind, body.subject_id)
        rev = bump_permission_revision(conn)
        bid = new_id()
        conn.execute(
            "INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at, expires_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            (bid, body.subject_kind, body.subject_id, body.role_id, body.scope_type, body.scope_id, body.effect, rev, principal.user_id, now_iso(), body.expires_at),
        )
        details: dict[str, Any] = {"binding_id": bid, "role_id": body.role_id, "scope": f"{body.scope_type}:{body.scope_id}", "effect": body.effect, "before": before,
                                   "after": _binding_summary(conn, body.subject_kind, body.subject_id), "revision": rev, **(extra_audit or {})}
        if body.subject_kind == "group":
            details["group_revision"] = touch_group(conn, body.subject_id, principal)
        audit(conn, actor=principal, action="rbac.bind", decision="allowed", resource_type=body.subject_kind, resource_id=body.subject_id, request_id=_rid(request), details=details)
        if body.subject_kind == "user" and body.subject_id.startswith(LOCAL_ID_PREFIX) and body.effect == "allow":
            _invalidate_links_on_admin_role(conn, principal, request, body.subject_id, body.role_id)
    return bid, rev


def _invalidate_links_on_admin_role(conn: sqlite3.Connection, principal: Principal, request: Request, user_id: str, role_id: str) -> int:
    """USR2-FIX F1: a local identity that becomes an administrative target keeps no open first-login / reset link - a link minted
    before the promotion may have been issued on the remote channel, and an administrative target's links are local-channel only
    (CR-USR2 §1a.3). Runs for every route that writes the binding (the generic one, bulk, and `PUT .../role`)."""
    from ..services import local_identity

    if not local_identity.role_is_admin(conn, role_id):
        return 0
    n = local_identity.invalidate_links(conn, user_id)
    if n:
        audit(conn, actor=principal, action="auth.local.link.invalidated", decision="allowed", resource_type="user", resource_id=user_id,
              reason="admin_role", request_id=_rid(request), details={"links": n, "role_id": role_id})
    return n


def affected_users(conn: sqlite3.Connection, subject_kind: str, subject_id: str) -> set[str]:
    return {subject_id} if subject_kind == "user" else set(_group_members(conn, subject_id))


@router.post("/access/bindings", status_code=201)
def create_binding(body: BindingBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    validate_binding(conn, principal, body, request)
    bid, rev = insert_binding(conn, principal, request, body)
    if body.effect == "deny":
        _terminate(conn, settings_of(request), affected_users(conn, body.subject_kind, body.subject_id))
    else:
        revocation.changed(affected_users(conn, body.subject_kind, body.subject_id))  # the shell shows what was granted
    row = conn.execute("SELECT * FROM bindings WHERE id = ?", (bid,)).fetchone()
    return {**_binding_dict(conn, row), "revision": rev}


def revoke_one(conn: sqlite3.Connection, principal: Principal, request: Request, b: sqlite3.Row) -> int:
    """Revoke one active binding after the same delegation checks as granting it (a delegated administrator revokes
    only allow-listed roles inside their reach, never their own) and the last-administrator guard."""
    scope = (b["scope_type"], b["scope_id"])
    check_delegation(conn, principal, b["role_id"], scope, b["subject_kind"], b["subject_id"], op="unbind", effect=b["effect"])
    with keep_an_admin(conn):
        before = _binding_summary(conn, b["subject_kind"], b["subject_id"])
        rev = bump_permission_revision(conn)
        conn.execute("UPDATE bindings SET revoked_at = ? WHERE id = ?", (now_iso(), b["id"]))
        details: dict[str, Any] = {"binding_id": b["id"], "role_id": b["role_id"], "scope": f"{b['scope_type']}:{b['scope_id']}", "before": before,
                                   "after": _binding_summary(conn, b["subject_kind"], b["subject_id"]), "revision": rev}
        if b["subject_kind"] == "group":
            details["group_revision"] = touch_group(conn, b["subject_id"], principal)
        audit(conn, actor=principal, action="rbac.unbind", decision="allowed", resource_type=b["subject_kind"], resource_id=b["subject_id"], request_id=_rid(request), details=details)
    return rev


@router.delete("/access/bindings/{binding_id}")
def revoke_binding(binding_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    if not assigns_anywhere(conn, principal):
        require(conn, principal, "rbac.assign", INSTALLATION)
    b = conn.execute("SELECT * FROM bindings WHERE id = ? AND revoked_at IS NULL", (binding_id,)).fetchone()
    if not b:
        raise ApiError(404, "not_found", "השיוך לא נמצא או כבר בוטל.")
    rev = revoke_one(conn, principal, request, b)
    _terminate(conn, settings_of(request), affected_users(conn, b["subject_kind"], b["subject_id"]))
    return {"revoked": binding_id, "revision": rev}


# ---------------------------------------------------------------- preview + audit

class PreviewBody(BaseModel):
    user_id: str = Field(min_length=1, max_length=200)
    scope_type: str = Field(default="installation", pattern="^(installation|site|building|floor|camera|access_control_station)$")
    scope_id: str = Field(default="*", min_length=1, max_length=200)


@router.post("/access/preview")
def preview(body: PreviewBody, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Effective permissions of a user at a scope, computed server-side; no impersonation (§12)."""
    scope = (body.scope_type, body.scope_id)
    if body.user_id != principal.user_id:
        require(conn, principal, "rbac.assign", scope)
    if not _scope_exists(conn, *scope):
        raise ApiError(422, "scope_unknown", "ההיקף לא נמצא.")
    u = conn.execute("SELECT * FROM users WHERE id = ?", (body.user_id,)).fetchone()
    subject = Principal(user_id=body.user_id, username=(u["username"] if u else ""), display_name=(u["display_name"] if u else ""), source=(u["source"] if u else "ingress"))
    active = bool(u["active"]) if u else True
    allowed = effective_permissions(conn, subject, scope) if active else []
    limited = body.user_id != principal.user_id and not full_authority(conn, principal)
    if limited:
        # security review T082: never more than the actor holds there themselves
        allowed = sorted(set(allowed) & set(effective_permissions(conn, principal, scope)))
    return {
        "user_id": body.user_id,
        "scope_type": body.scope_type,
        "scope_id": body.scope_id,
        "scope_name": scope_name(conn, *scope),
        "active": active,
        "allowed": allowed,
        "denied": [p for p in PERMISSION_LABELS if p not in allowed],
        "limited_to_own": limited,
        "labels": rendered_labels(conn),
        # a delegated administrator previews inside their reach: the bindings listed are the ones there, too
        "bindings": [b for b in _user_bindings(conn, body.user_id) if not limited or delegated_sees(conn, principal, b)],
        "revision": permission_revision(conn),
    }


@router.get("/audit")
def list_audit(
    principal: Principal = Depends(current_principal),
    conn: sqlite3.Connection = Depends(get_conn),
    prefix: str = Query("rbac.", max_length=60),
    actor: str | None = Query(None, max_length=200),
    resource_id: str | None = Query(None, max_length=200),
    limit: int = Query(100, ge=1, le=500),
    channel: str | None = Query(None, pattern="^(local|remote|bearer)$"),
    view: str | None = Query(None, pattern="^(remote_sign_ins|remote_refusals)$"),
    actor_kind: str | None = Query(None, pattern="^(automation|person)$"),
) -> dict[str, Any]:
    """The audit screen. CR-008 P2: `channel` = where the actor came from (`local` = inside the system's own UI,
    `remote` = SmplWise Arx, `bearer` = Arx with a bearer token); `view` = a quick view that replaces the action prefix:
    `remote_sign_ins` (every auth.remote_* row: sign-ins, refusals, revocations, sign-outs, refused cross-site requests)
    or `remote_refusals` (every denied row of the remote channel - remote_not_allowed, csrf_refused, rate limits, a
    revoked sign-in, the remote live-stream cap)."""
    require(conn, principal, "audit.read", INSTALLATION)
    detail = "COALESCE(CASE WHEN json_valid(details_json) THEN json_extract(details_json, '$.{0}') END, '')"
    remote_row = f"({detail.format('channel')} = 'remote' OR action LIKE 'auth.remote%')"
    if view == "remote_sign_ins":
        sql = "SELECT * FROM audit_log WHERE action LIKE 'auth.remote%'"
        args: list[Any] = []
    elif view == "remote_refusals":
        sql = f"SELECT * FROM audit_log WHERE decision = 'denied' AND {remote_row}"
        args = []
    else:
        sql = "SELECT * FROM audit_log WHERE action LIKE ?"
        args = [prefix + "%"]
    if channel == "remote":
        sql += f" AND {remote_row}"
    elif channel == "bearer":
        sql += f" AND {detail.format('via')} = 'bearer'"
    elif channel == "local":
        sql += f" AND NOT {remote_row}"
    # CR-AUTODOORS-295: `automation` = the rows of the automation operators (actor `automation:<block id>`, e.g. a door an
    # automation opened); `person` = everything else
    if actor_kind == "automation":
        sql += " AND actor_user_id LIKE 'automation:%'"
    elif actor_kind == "person":
        sql += " AND (actor_user_id IS NULL OR actor_user_id NOT LIKE 'automation:%')"
    if actor:
        # HA 2026.10 normalises usernames (strip + casefold, core#175613): "Joni" finds the rows written as "joni" before
        # or after a rename. SQLite's LOWER() is ASCII-only, so the same Python normalisation runs on both sides.
        # A name that is empty once normalised matches nothing (never the rows without an actor).
        conn.create_function("sw_username_norm", 1, normalize_username, deterministic=True)
        sql += " AND actor_username IS NOT NULL AND sw_username_norm(actor_username) = ?"
        args.append(normalize_username(actor) or "\x00")
    if resource_id:
        sql += " AND resource_id = ?"
        args.append(resource_id)
    sql += " ORDER BY rowid DESC LIMIT ?"
    args.append(limit)
    rows = []
    for r in conn.execute(sql, args).fetchall():
        d = dict(r)
        try:
            d["details"] = json.loads(d.pop("details_json") or "{}")
        except (ValueError, KeyError):
            d["details"] = {}
        rows.append(d)
    return {"rows": rows}


# ---------------------------------------------------------------- custom roles and delegation (T082)

# body-size guards only (the catalogue decides what is valid): wide enough for "select all" of the regular and of the
# sensitive lists, which the 20 / 40 of T082 no longer were (28 sensitive grants by 0.1.148 - owner hit the limit).
# 2.7.0 gate: the fixed 60 broke again at 61 sensitive grants (access.external.grant, tickets.technician_requests and
# tickets.external all sit in `sensitive_permissions_not_implied` - correctly: no role implies them, and a custom role that
# carries any of them is never delegable). The caps now follow the catalogue with headroom, so a new permission cannot make
# "select all" fail again; they stay bounded (a body cannot grow beyond the catalogue plus the margin).
ROLE_PERMISSIONS_MAX = max(120, len(PERMISSION_LABELS) + 40)
ROLE_SENSITIVE_MAX = max(60, len(SENSITIVE) + 20)


class CustomRoleBody(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    description: str = Field(default="", max_length=300)
    permissions: list[str] = Field(default_factory=list, max_length=ROLE_PERMISSIONS_MAX)
    sensitive: list[str] = Field(default_factory=list, max_length=ROLE_SENSITIVE_MAX)
    delegable: bool = False


class CustomRolePatch(CustomRoleBody):
    revision: int = Field(ge=1)


class RolePreviewBody(BaseModel):
    role_id: str | None = Field(default=None, max_length=60)
    permissions: list[str] = Field(default_factory=list, max_length=ROLE_PERMISSIONS_MAX)
    sensitive: list[str] = Field(default_factory=list, max_length=ROLE_SENSITIVE_MAX)


class DelegationBody(BaseModel):
    delegable_roles: list[str] = Field(default_factory=list, max_length=50)


def _custom_role_dict(conn: sqlite3.Connection, r: sqlite3.Row) -> dict[str, Any]:
    perms = json.loads(r["permissions_json"])
    sens = json.loads(r["sensitive_json"] or "[]")
    allp = sorted(set(perms) | set(sens))
    return {
        "id": r["id"], "name": r["name_he"], "description": r["description"], "permissions": allp, "custom": True, "revision": r["revision"], "delegable": bool(r["delegable"]),
        "sensitive_included": [p for p in allp if p in SENSITIVE], "sensitive_missing": [p for p in SENSITIVE if p not in allp and p not in LEGACY_PERMISSIONS], "system_role": False,  # WXPERM: an old name is never "missing"
        "created_by_username": r["created_by_username"], "updated_by_username": r["updated_by_username"], "updated_at": r["updated_at"],
        "delegation_block": "sensitive_custom_role" if set(allp) & set(SENSITIVE) else "assign_role" if "rbac.assign" in allp else None,
    }


def _validate_role_body(permissions: list[str], sensitive: list[str]) -> tuple[list[str], list[str]]:
    perms = sorted({p for p in permissions if p})
    sens = sorted({p for p in sensitive if p})
    unknown = [p for p in perms + sens if p not in PERMISSION_LABELS]
    if unknown:
        raise ApiError(422, "permission_unknown", "הרשאה לא מוכרת.", details={"unknown": unknown})
    if set(perms) & set(SENSITIVE):
        raise ApiError(422, "sensitive_in_permissions", "הרשאות רגישות ניתנות רק ברשימת ההרשאות הרגישות, במפורש.", details={"sensitive": sorted(set(perms) & set(SENSITIVE))})
    if set(perms) & SYSTEM_PERMISSIONS or set(sens) & SYSTEM_PERMISSIONS:
        raise ApiError(422, "system_permission_not_allowed", "הרשאות מערכת נשארות בתפקידים המובנים בלבד.", details={"system": sorted((set(perms) | set(sens)) & SYSTEM_PERMISSIONS)})
    if set(sens) - set(SENSITIVE):
        raise ApiError(422, "not_sensitive", "רק הרשאות מהרשימה הרגישה נכנסות לרשימת ההרשאות הרגישות.", details={"invalid": sorted(set(sens) - set(SENSITIVE))})
    if not perms and not sens:
        raise ApiError(422, "validation", "תפקיד חייב לכלול לפחות הרשאה אחת.")
    return perms, sens


def _check_delegable_flag(delegable: bool, perms: list[str], sens: list[str]) -> None:
    """T082 (R164): a custom role with a sensitive grant (or with rbac.assign) is never delegable - refused, not
    silently dropped, so the dialog says why."""
    if delegable and (sens or "rbac.assign" in perms):
        raise ApiError(422, "sensitive_role_not_delegable", "תפקיד עם הרשאה רגישה או עם שיוך תפקידים אינו ניתן להאצלה למנהל אתר.",
                       details={"sensitive": sens, "assign": "rbac.assign" in perms})


def _role_impact(conn: sqlite3.Connection, role_id: str | None, new_perms: list[str]) -> dict[str, Any]:
    """Who is touched by a role change: bindings, users (direct and through groups), groups and scopes, plus the permission diff."""
    current = role_permissions(conn, role_id) if role_id else []
    new_perms = expand_legacy(new_perms)  # WXPERM: compare like with like (role_permissions expands legacy names)
    out: dict[str, Any] = {"role_id": role_id, "added": sorted(set(new_perms) - set(current)), "removed": sorted(set(current) - set(new_perms)), "bindings": 0, "users": [], "groups": [], "scopes": []}
    if not role_id:
        return out
    now = now_iso()
    users: dict[str, str] = {}
    groups: dict[str, str] = {}
    scopes: set[str] = set()
    for b in conn.execute(_active_bindings_sql("AND role_id = ?"), (now, role_id)).fetchall():
        out["bindings"] += 1
        scopes.add(scope_name(conn, b["scope_type"], b["scope_id"]))
        if b["subject_kind"] == "user":
            u = conn.execute("SELECT display_name, username FROM users WHERE id = ?", (b["subject_id"],)).fetchone()
            users[b["subject_id"]] = (u["display_name"] or u["username"]) if u else b["subject_id"]
        else:
            g = conn.execute("SELECT name FROM groups WHERE id = ?", (b["subject_id"],)).fetchone()
            groups[b["subject_id"]] = g["name"] if g else b["subject_id"]
            for uid in _group_members(conn, b["subject_id"]):
                u = conn.execute("SELECT display_name, username FROM users WHERE id = ?", (uid,)).fetchone()
                users[uid] = (u["display_name"] or u["username"]) if u else uid
    out["users"] = [{"id": k, "name": v} for k, v in sorted(users.items(), key=lambda kv: kv[1])]
    out["groups"] = [{"id": k, "name": v} for k, v in sorted(groups.items(), key=lambda kv: kv[1])]
    out["scopes"] = sorted(scopes)
    return out


@router.post("/access/roles", status_code=201)
def create_custom_role(body: CustomRoleBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "rbac.roles.manage", INSTALLATION)
    perms, sens = _validate_role_body(body.permissions, body.sensitive)
    _check_delegable_flag(body.delegable, perms, sens)
    if body.name.strip() in {role_name(conn, r) for r in ROLE_NAMES_HE} or conn.execute("SELECT 1 FROM custom_roles WHERE name_he = ? AND deleted_at IS NULL", (body.name.strip(),)).fetchone():
        raise ApiError(409, "role_name_taken", "כבר קיים תפקיד בשם הזה.")
    rid = f"custom-{new_id()[:8]}"
    now = now_iso()
    conn.execute(
        "INSERT INTO custom_roles(id, name_he, description, permissions_json, sensitive_json, delegable, revision, created_by, created_by_username, updated_by, updated_by_username, created_at, updated_at) VALUES (?,?,?,?,?,?,1,?,?,?,?,?,?)",
        (rid, body.name.strip(), body.description, json.dumps(perms), json.dumps(sens), int(body.delegable), principal.user_id, principal.username, principal.user_id, principal.username, now, now),
    )
    rev = bump_permission_revision(conn)
    audit(conn, actor=principal, action="rbac.role.create", decision="allowed", resource_type="role", resource_id=rid, request_id=_rid(request), details={"name": body.name.strip(), "permissions": perms, "sensitive": sens, "delegable": body.delegable, "revision": rev})
    return _custom_role_dict(conn, conn.execute("SELECT * FROM custom_roles WHERE id = ?", (rid,)).fetchone())


@router.post("/access/roles/preview")
def preview_role_change(body: RolePreviewBody, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Before saving: who holds the role today (users, groups, scopes) and which permissions the change adds or removes."""
    require(conn, principal, "rbac.roles.manage", INSTALLATION)
    perms, sens = _validate_role_body(body.permissions, body.sensitive)
    if body.role_id and body.role_id not in all_roles(conn):
        raise ApiError(404, "not_found", "התפקיד לא נמצא.")
    return {**_role_impact(conn, body.role_id, sorted(set(perms) | set(sens))), "labels": rendered_labels(conn)}


@router.patch("/access/roles/{role_id}")
def update_custom_role(role_id: str, body: CustomRolePatch, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "rbac.roles.manage", INSTALLATION)
    if role_id in ROLES:
        raise ApiError(409, "builtin_role", "תפקידים מובנים אינם ניתנים לעריכה; צור תפקיד מותאם.")
    r = conn.execute("SELECT * FROM custom_roles WHERE id = ? AND deleted_at IS NULL", (role_id,)).fetchone()
    if not r:
        raise ApiError(404, "not_found", "התפקיד לא נמצא.")
    if body.revision != r["revision"]:
        raise ApiError(409, "stale_revision", "התפקיד השתנה בינתיים; טען מחדש.", details={"current_revision": r["revision"], "sent_revision": body.revision})
    perms, sens = _validate_role_body(body.permissions, body.sensitive)
    _check_delegable_flag(body.delegable, perms, sens)
    impact = _role_impact(conn, role_id, sorted(set(perms) | set(sens)))
    conn.execute(
        "UPDATE custom_roles SET name_he = ?, description = ?, permissions_json = ?, sensitive_json = ?, delegable = ?, revision = revision + 1, updated_by = ?, updated_by_username = ?, updated_at = ? WHERE id = ?",
        (body.name.strip(), body.description, json.dumps(perms), json.dumps(sens), int(body.delegable), principal.user_id, principal.username, now_iso(), role_id),
    )
    rev = bump_permission_revision(conn)
    if impact["removed"]:
        _terminate(conn, settings_of(request), {u["id"] for u in impact["users"]})
    elif impact["added"]:
        revocation.changed({u["id"] for u in impact["users"]})
    audit(conn, actor=principal, action="rbac.role.update", decision="allowed", resource_type="role", resource_id=role_id, request_id=_rid(request),
          details={"added": impact["added"], "removed": impact["removed"], "affected_users": len(impact["users"]), "affected_bindings": impact["bindings"], "delegable": body.delegable, "revision": rev})
    return {**_custom_role_dict(conn, conn.execute("SELECT * FROM custom_roles WHERE id = ?", (role_id,)).fetchone()), "impact": impact}


@router.delete("/access/roles/{role_id}")
def delete_custom_role(role_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "rbac.roles.manage", INSTALLATION)
    if role_id in ROLES:
        raise ApiError(409, "builtin_role", "תפקידים מובנים אינם נמחקים.")
    r = conn.execute("SELECT * FROM custom_roles WHERE id = ? AND deleted_at IS NULL", (role_id,)).fetchone()
    if not r:
        raise ApiError(404, "not_found", "התפקיד לא נמצא.")
    impact = _role_impact(conn, role_id, [])
    if impact["bindings"]:
        raise ApiError(409, "role_in_use", "התפקיד עדיין משויך; בטל את השיוכים קודם.", details={"bindings": impact["bindings"], "users": impact["users"], "groups": impact["groups"]})
    conn.execute("UPDATE custom_roles SET deleted_at = ?, updated_by = ?, updated_by_username = ? WHERE id = ?", (now_iso(), principal.user_id, principal.username, role_id))
    rev = bump_permission_revision(conn)
    audit(conn, actor=principal, action="rbac.role.delete", decision="allowed", resource_type="role", resource_id=role_id, request_id=_rid(request), details={"name": r["name_he"], "revision": rev})
    return {"deleted": role_id, "revision": rev}


DELEGATION_RULES = [
    "מנהל אתר משייך רק תפקידים מרשימה זו - לעולם לא מנהל מערכת, מנהל אתר או תפקיד מותאם עם הרשאה רגישה",
    "רק הרשאות שהוא מחזיק בעצמו באותו היקף, ורק בתוך ההיקף שלו",
    "לא את עצמו: לא שיוך ישיר ולא דרך קבוצה שהוא חבר בה",
    "קבוצה רק כשכל השיוכים שלה בתוך ההיקף שלו; יצירה, שינוי שם ומחיקה של קבוצות - מנהל המערכת בלבד",
    "אין שינוי של תפקידים משותפים; בקשה מרובה נבדקת פריט־פריט ונדחית כולה בפריט הראשון שנחסם",
]


@router.get("/access/delegation")
def get_delegation(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "identity.directory.read", INSTALLATION)
    blocked = {rid: delegation_block(conn, rid) for rid in all_roles(conn)}
    return {"delegable_roles": delegable_roles(conn), "default": DEFAULT_DELEGABLE, "rules": DELEGATION_RULES,
            "blocked": {k: v for k, v in blocked.items() if v}, "revision": permission_revision(conn)}


@router.put("/access/delegation")
def set_delegation(body: DelegationBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Replace the allow-list (rbac.roles.manage). Built-in roles live in the setting,
    custom roles in their own `delegable` flag - this call keeps both in step, so the list sent is the whole truth."""
    require(conn, principal, "rbac.roles.manage", INSTALLATION)
    known = all_roles(conn)
    chosen = sorted({r for r in body.delegable_roles if r in known})
    blocked = {r: delegation_block(conn, r) for r in chosen if delegation_block(conn, r)}
    if blocked:
        system = any(v == "system_role" for v in blocked.values())
        raise ApiError(422, "system_role_not_delegable" if system else "sensitive_role_not_delegable",
                       "תפקיד עם הרשאות מערכת אינו ניתן להאצלה." if system else "תפקיד מותאם עם הרשאה רגישה או עם שיוך תפקידים אינו ניתן להאצלה.",
                       details={"blocked": sorted(blocked), "reasons": blocked})
    before = delegable_roles(conn)
    set_setting(conn, "rbac.delegable_roles", json.dumps([r for r in chosen if r in ROLES]))
    for r in conn.execute("SELECT id, delegable FROM custom_roles WHERE deleted_at IS NULL").fetchall():
        want = 1 if r["id"] in chosen else 0
        if int(r["delegable"]) != want:
            conn.execute("UPDATE custom_roles SET delegable = ?, revision = revision + 1, updated_by = ?, updated_by_username = ?, updated_at = ? WHERE id = ?",
                         (want, principal.user_id, principal.username, now_iso(), r["id"]))
    rev = bump_permission_revision(conn)
    audit(conn, actor=principal, action="rbac.delegation.update", decision="allowed", resource_type="installation", resource_id="*", request_id=_rid(request), details={"before": before, "after": delegable_roles(conn), "revision": rev})
    return {"delegable_roles": delegable_roles(conn), "revision": rev}
