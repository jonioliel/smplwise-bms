# CR-017 — Automations, scenes and scripts ("אוטומציות · סצנות · סקריפטים")

**Status:** PROPOSAL, **owner decisions adopted 2026-10-01** (§16; architecture only, nothing implemented). Owner request
2026-10-01: "complete control over creating, editing and deleting automations, scenes and scripts in Home Assistant through Arx,
in smart, convenient and beautiful interfaces"; installers and family users; Hebrew RTL; permission-driven. **Task:** T100
(R208-R212, AT208-AT212). **Contract + work plan:** `docs/architecture/AUTOMATIONS_API.md`. **Owner decisions:**
`docs/design/mockups/automations/decisions-HE.md`. **Mockup:** `docs/design/mockups/automations/index.html` (evidence
`docs/evidence/automations-mockup/`). **Security amendment draft (owner sign-off pending):**
`docs/security/HA_IDENTITY_RBAC_AMENDMENT_AUTOMATIONS_DRAFT_HE.md`.
**Inputs:** the anonymised probe of the owner's four systems `docs/research/AUTOMATIONS_PROBE_2026-10-01.md` (branch
`pilot/automations-probe`); HA core/frontend source on `dev` read 2026-10-01 (public GitHub); CR-014 (`SCHEDULER_API.md`, the
closest precedent: component-backed objects, revision/drift, trash, preview, sensitive grants, bridge writes); CR-015/016 (plan
style, calibration); `docs/security/HA_IDENTITY_RBAC_HE.md`; the bridge (`integration/smplwise_bridge`, 0.3.1 on `g0/intake`).
No HA, lab or device was contacted for this document.

Marks: **V-SRC** = read in HA core/frontend source (`dev`, 2026-10-01). **V-PROBE** = observed read-only on the owner's systems
(probe 2026-10-01, HA 2026.8.3/2026.9.4). **U-n** = unverified; each has a mitigation and a phase-0 check (§3.3).
Vocabulary: operator screens never name Home Assistant/HA/YAML/blueprint; "תשתית המערכת" is the platform. This document names
things exactly.

## 1. Goals and non-goals

**Goals**
1. One place in Arx to see, understand, run, enable/disable, create, edit, copy and delete automations, scripts and scenes of
   the installation, filtered to what the viewer may see.
2. A friendly builder for the common case, "כאשר X קורה, אם Y, אז Z", with entity pickers scoped to the user's floors, a live
   Hebrew sentence describing each automation, templates for the usual cases, a dry-run and "why did it run".
3. Every existing automation of the owner stays editable: parts the builder does not model are kept verbatim as **locked
   blocks** (never dropped, never rewritten).
4. Safety equal to CR-014: permissions + floor scope, **the same grants as manual control** for alarm/locks/doors/gates/sirens
   (owner decision 6ג, §9.2), preview of affected devices, loop/storm protection, rate limits, 30-day trash and version history,
   audit. Codes are never stored in, or shown by, an automation.
5. HA stays the authority: Arx writes the same files the HA editor writes, in the same (new) schema, so the HA UI keeps working.
6. Every option of the feature lives in one dedicated settings tab, הגדרות › אוטומציות (§4.7); operator screens carry none.

**Non-goals (v1)**: Arx's own automation engine (the alarm-rules engine of T052 stays as is); blueprint import or authoring
(roadmap, §14.1); typed editing of device triggers/actions, templates and purpose-specific triggers (locked blocks in v1, typed
later per owner decision 5 — the block model is built for it, §6.2); `wait_*`, `parallel`, webhooks, MQTT (locked); labels/
categories writes (displayed and filterable only); **forced** conversion between schedules and automations (a suggestion only, §5);
editing integration-provided scenes (they are activate-only); restricting what people do in the HA UI itself (AGENTS.md: Arx
restrictions never restrict the original HA UI).

## 2. Live findings (probe 2026-10-01) and what they change

| Finding (V-PROBE, 4 systems: H, V, K, O) | Consequence in this CR |
|---|---|
| 42 automations (23/4/15/0), 9 scripts, 239 scenes; HA 2026.8.3-2026.9.4 | Small lists: one list screen with filters, no pagination tricks (§4.1) |
| **All** 42 automations and 9 scripts UI-managed (config API 200 by id); 0 YAML-managed, 0 blueprints, 0 duplicate ids | Write path is the config files; YAML-managed read-only mode is built but is an edge case (§4.6); blueprints out of v1 (§1) |
| All 42 use the new keys `triggers/conditions/actions`, `trigger:`, `action:`; 0 legacy | Write only the new schema; read legacy for safety (§6.2) |
| Aliases Hebrew in 41/42; descriptions in 30/42 | RTL-safe alias/description; Unicode search; `<bdi>` around ids and numbers |
| Triggers: `state` 38/77 entries (28/42 automations), `time` 12, `time_pattern` 8, `template` 7, `device` 6, `homeassistant` start 4, one purpose-specific (`switch.turned_on`); **no** sun/zone/numeric_state/mqtt/webhook | v1 typed triggers: state, time, time_pattern, HA start (+ sun, numeric_state, presence for the templates the owner asked for); device/template/purpose-specific = locked (§4.2) |
| Logic lives in `choose` (16) and `if/then` (4); top-level conditions rare (14); trigger ids used in 26/42 (for `condition: trigger`) | `choose`, `if/then`, trigger ids and trigger conditions are typed in v1 |
| 27/42 have ≤3 steps, 40/42 ≤8; largest config ~4.3 kB | The builder is a vertical block list, not a canvas; no graph editor |
| Templates in 20/42 automations (all ≤400 chars); `entity_id` built by template in actions | A whole-item read-only rule (CR-014 §2.6) would lock half the automations → **block-level** locking instead (§6.2) |
| Every target is a raw `entity_id`; 0 `area_id`/`floor_id`/`label_id` targets | v1 writes entity lists only (the scope check needs them); pickers group by floor/area (§7) |
| Custom services in actions: `scheduler.*` (V, 4 calls), `browser_mod`, `shell_command`, `automation.*` (H, 4), `homeassistant.*` (1 per system) | Service catalogue from `get_services`; unknown services = locked blocks; `shell_command`, `homeassistant.*`, `automation.*`, `scheduler.*` flagged (§9) |
| Alarm panel in 3 automations + 2 scripts; notify in 4 (H only); 0 locks/covers | Alarm steps exist from day one: they are allowed and gated by the manual-control grants (§9.2); notify typed with an admin allow-list of targets |
| 2 automations (K) reference missing entities | "missing device" warning chip, item still editable |
| All 239 scenes are integration-provided (wall-switch controller + hub): no `id`, no members | Scenes v1 = activate + organise those; HA-native scene capture is **new** for the owner (§4.3) |
| Scripts: 9, short (1-5 steps), 1 with `fields`, none called from automations; 0 script traces | Script runner is simple; fields form supports 5 selector kinds |
| `trace/list` works everywhere; 70 stored automation runs in total | "Why did it run" reads the full trace on demand (decision 9ג); last-run + run count on the list |
| `config` component loaded but `config.automation/script/scene` not listed although the API works | Availability is detected by probing the config API, never by the components list |

Caveat: three active systems, mostly wall switches and climate. Media, lock, cover and blueprint cases are **unobserved**, not
unnecessary; the model keeps them as locked blocks until typed.

## 3. HA facts this CR relies on

### 3.1 Config API and runtime services (V-SRC unless marked)

| Fact | Consequence |
|---|---|
| `GET/POST/DELETE /api/config/{automation\|script\|scene}/config/{key}`; files `automations.yaml` (list), `scripts.yaml` (dict), `scenes.yaml` (list) — file names U-1 | Arx reads by id; only items in those files are editable |
| All three views are `@require_admin`; WS `automation/config`, `script/config`, `trace/*`, `blueprint/*` are admin-only | Non-admin HA users cannot author in HA; see §8.3 (recorded contradiction) |
| GET unknown → 404 "Resource not found"; DELETE unknown → **400** "Resource not found"; POST is an **upsert** (unknown key appends) | Create = upsert with a fresh id; the bridge refuses an upsert whose id exists unless it is an edit with `base_revision` |
| POST validates (automation/script: `async_validate_config_item`; scene: platform schema), then **stores the raw body**; errors 400 "Message malformed: …"; success `{"result":"ok"}` | Arx must send exactly what it wants stored; validation errors are mapped to block paths |
| Automation key: any string (frontend uses `String(Date.now())`); script key: slug = object id of `script.<key>`; scene key: string | Arx ids: automation/scene `String(epoch ms)`; script `arx_<epoch ms>` unless an ASCII slug of the alias is free |
| Writes rewrite the whole file under a lock (comments lost); entries without `id` get a uuid4 | Same behaviour as the HA editor; the owner already lives with it |
| After POST: `automation.reload {id}` (only that automation), `script.reload` (diff), `scene.reload` (all scenes, no diff) as a fire-and-forget task; after DELETE the registry entry is removed and no reload | The bridge reloads itself and waits for the entity (§8.2) |
| Entity attribute `id` = config id = registry `unique_id` (automation; scene platform `homeassistant`); script unique_id = key. No `id` → no registry entry, not editable | Keys: `(kind, config_id)`; entity ids are re-read, never derived |
| `automation.trigger` (`skip_condition` default **true**, `variables`), `automation.turn_off` (`stop_actions` default true), `script.turn_on` (fire-and-forget, `variables`), `script.<key>` (waits, fields as data, optional response), `scene.turn_on` (`transition` 0-300), `scene.apply`, `scene.create` (dynamic, in memory, `snapshot_entities`), `scene.delete` (dynamic only, 2023.12) | Run-now, script fields, try-with-undo (§4.3) |
| Reload services are admin services (`async_register_admin_service`); `script.reload` U-8 | Only the bridge (system context) reloads |
| Invalid automation → `UnavailableAutomationEntity` + repairs issue `validation_failed_*` | "לא פעילה – שגיאה בהגדרה" state from the entity (§9.6) |
| `validate_config` WS (no admin): `{triggers?, conditions?, actions?}` → per key `{valid, error}` | Preview uses it for HA-side validation without writing |
| Traces: `trace/list {domain, item_id?}`, `trace/get {domain, item_id, run_id}` (admin), 5 stored per item by default, persisted; extended dict has `trace` (path → steps with `result`, `changed_variables`, `error`, timestamps), `config`, `context` | "Why did it run" = sentence + the full trace (§4.2.6); step shape U-7 |
| Keys renamed 2024.8 (`service:`→`action:`) and 2024.10 (plural keys, `platform:`→`trigger:`); legacy still loads | Read both, write new |
| 2025.12-2026.9: purpose-specific triggers/conditions (`switch.turned_on`, …) default in the HA editor since 2026.7; several renamed or removed (2026.5, 2026.7); `note` key (2026.6) | Arx writes **generic** triggers (stable) and keeps purpose-specific ones as locked blocks; `note` preserved |
| Events: `automation_reloaded`, `scene_reloaded`, `automation_triggered {name, entity_id, source}`, `script_started`; **no** `script_reloaded` | Refresh design §12 |
| `config/label_registry/list`, `floor_registry/list`, `category_registry/list {scope}` are readable without admin | Labels/categories shown and filterable |

### 3.2 Not in HA at all

No revision/etag on items (Arx builds one, §10); no per-item history or trash (Arx keeps them); no owner/creator field; no
compare-and-set across writers (the bridge narrows the window, §10.1).

### 3.3 Phase-0 checks (read-only on the lab first; the two write checks need the owner's explicit approval)

U-1 file names and list/dict shapes on 2026.9 · U-2 REST `GET /api/config/*` through the Supervisor proxy with the add-on
token, and WS `automation/config` on the add-on's session · U-3 import paths of `async_validate_config_item`
(automation, script) and the scene schema in 2026.9 (the bridge uses them) · U-4 how a `!secret` inside `automations.yaml`
comes back from GET · U-5 missing `automation: !include automations.yaml` → a write that never loads (detection §4.6) ·
U-6 a condition-test / template-render WS command and its admin status (dry-run of template conditions) · U-7 `trace/get`
step shape on 2026.9 · U-8 `script.reload` admin status; whether `scene.reload` drops dynamic scenes · U-9 purpose-specific
trigger shape on 2026.9 (rendering locked blocks) · U-10 a non-admin HA user's Context may call `automation.trigger/turn_on/off`
· **W-1 (approval)** a bridge-written automation reads back identically in the HA editor and vice versa · **W-2 (approval)** a
bridge-written script and scene load after reload. Probe script: `scripts/automations_probe.py` exists on `pilot/automations-probe`;
S2 extends it with U-1…U-10 (read-only) and a separate, opt-in `--write-check` for W-1/W-2 with throwaway items.

## 4. The three kinds and their UX models

### 4.1 Navigation and lists

- Home area tabs (CR-014 pattern): **מבט על · תזמונים · אוטומציות**. Inside "אוטומציות" a segmented control: **אוטומציות ·
  סצנות · סקריפטים**. Settings: a dedicated tab הגדרות › אוטומציות (§4.7). Tabs appear only to holders of `automation.view` (or
  the run rights of §7). Optional (setting `automations.ask_when_on_new`, off by default): one "+ חדש" in the home area that asks
  "מתי?" — "בשעות קבועות" opens CR-014's create dialog, "כשמשהו קורה" opens the builder (§5).
- List row / card: name (Hebrew alias), the one-line Hebrew sentence, floor/area chips of the targets, on/off toggle, last run
  ("לפני 12 דק׳"), run count (traces), state chips: "רץ עכשיו", "כבויה", "שגיאה בהגדרה", "מכשיר חסר", "רגישה", "שונתה מחוץ
  למערכת", "חלק נעול" (locked-block indicator), "צפייה בלבד". Filters: search (name, description, entity names), floor/area,
  state, "רגישות", "שלי". Sort: last run (default), name, updated. Phone: cards; desktop: cards or table.
- Detail drawer (`sw-drawer`): sentence, blocks outline, affected devices, last runs with "למה זה רץ", versions, actions (הרץ,
  בדיקה, עריכה, שכפול, מחיקה). Clean operator screens: no hints or paragraphs (owner rule 2026-09-30); the words Home
  Assistant/HA/YAML appear only inside the code view and in the settings tab.

### 4.2 Automations

1. **Builder** (drawer on desktop, full screen on phone): three stacked sections **כאשר** (triggers) · **אם** (conditions) · **אז**
   (actions), each a vertical list of block cards with "+ הוסף". A block card shows its own sentence ("התנועה בפרוזדור מזוהה
   במשך 2 דק׳") and opens a small form. Top: name, the live Hebrew sentence of the whole automation (server-generated by
   `/automations/preview`, debounced 400 ms), enable toggle. Bottom: mode ("אם מופעלת שוב בזמן ריצה": התעלם / התחל מחדש /
   המתן בתור / הרץ במקביל) and `max`, collapsed under "אפשרויות". **Builder ↔ code toggle** (decision 3): a segmented control
   "בונה · קוד" at the top of the editor, rendered only for callers with `automation.code_view` (§4.5); both views edit the same
   draft, switching re-parses the item so a change made in the code view shows as blocks (typed where the schema knows it,
   locked otherwise) and vice versa.
2. **Typed blocks v1** (the probe's usage plus the owner's list): triggers `state` (entities, from/to, for), `time` (clock time),
   `time_pattern`, `homeassistant` start, `sun` (sunrise/sunset ± offset), `numeric_state` (above/below, for), presence (a
   `state` trigger on `person.*` home/not_home, and "כולם יצאו" = `numeric_state` on `zone.home` below 1), trigger `id`.
   Conditions: state, numeric_state, time (after/before/weekdays), sun, trigger id, and/or/not (one nesting level), the Shabbat
   preset (CR-014's configured sensor). Actions: device control (allow-listed services with argument specs, `target.entity_id`
   list), scene activation, script call (fields form), notify (admin-approved targets), delay, `choose` (≤ 6 options + default),
   `if/then/else`, `repeat` (count), condition-as-step, `stop`. Sensitive services (alarm arm/disarm, lock/unlock, door, gate,
   garage, siren) are typed like any other device action, **without** a `code` argument (§9.2-§9.3).
3. **Locked blocks**: everything else — templates (`{{ }}` badge, short text shown), device triggers/actions ("כפתור · {device
   name}" label), purpose-specific triggers, unknown or custom services (`scheduler.*`, `browser_mod.*`, `shell_command.*`),
   `wait_*`, `parallel`, `variables`, `repeat` while/until/for_each, `enabled: false` or `continue_on_error` steps, `note`,
   anything with a secret-like key. A locked block is shown, can be moved or deleted by a normal editor, and is re-sent
   byte-identical; its content is editable only in the code view (§4.5). Each locked block carries its `reason`, so the
   builder can grow typed forms for a reason later without a migration (decision 5, §6.2 and §14.1).
4. **Templates gallery** (server data, `GET /automations/templates`): motion light (mode restart, off after N minutes without
   motion), door/window open longer than N minutes → notify, leaving home (everyone left → lights/AC off; alarm arm optional,
   shown with the sensitive chip), arriving after sunset → entrance lights, water leak → notify, lights at sunset, AC by the
   clock. Every template creates an **automation**; the time-only ones also show the "צור כתזמון" suggestion (§5). A template
   is a pre-filled draft with the pickers left empty; nothing is saved without review. Administrators hide or re-order
   templates in הגדרות › אוטומציות (§4.7).
5. **Run, test, enable**: "הרץ עכשיו" = `automation.trigger` with `skip_condition: true` (HA's own "run actions"; the same
   confirmation manual control shows for `attention`/sensitive targets); "בדוק תנאים ואז הרץ" = `skip_condition: false`.
   "בדיקה" (dry-run, no execution): current truth of each typed condition from the mirror, template conditions "לא ניתן לבדוק"
   unless U-6, and the device diff that would result ("תאורת פרוזדור: כבוי → דלוק 40%"). Enable/disable = `automation.turn_on/off`
   (disable keeps HA's `stop_actions`).
6. **"למה זה רץ?"** (decision 9ג: the full trace, as HA shows it, for everyone who may view the automation) from `trace/get`: on
   top one short Hebrew sentence per run ("רצה ב־18:42 כי נפתחה דלת הכניסה; התנאי 'אחרי השקיעה' עבר; הדליקה תאורת כניסה"), below it
   the complete step list in order — trigger, every condition with passed/failed, every action step (nested branches included)
   with its result, timing (start, duration), the variables it changed and the error that stopped it. Secret-like values are
   masked (§9.3); the context user appears as a display name, never as an id. Runs of items the viewer cannot see never
   leave the server.

### 4.3 Scenes

- **Integration scenes** (all 239 of the owner's): activate-only cards grouped by area ("הפעל"), favourites and hide in Arx meta;
  permission = control of the scene entity (today's devices path).
- **HA-native scenes (new for the owner)**: "סצנה חדשה" → pick devices (scoped picker) → **"צלם מצב נוכחי"** (server reads the
  mirror and keeps per-domain attributes only: light state/brightness/color_temp_kelvin or hs/rgb per `color_mode`; switch/fan
  state (+percentage); cover position/tilt; climate hvac_mode/temperature/fan_mode/preset; media_player state/volume/source) →
  a table of captured values, each editable → save. "נסה" applies with confirmation and **undo**: `scene.create` snapshot of
  the same entities first, "בטל" re-applies the snapshot and deletes it (slice C, needs U-8). Delete/edit only HA-native scenes.
- Capture domains v1: light, switch, fan, cover, climate, media_player, lock (state only). Lock members need the author's
  `door.unlock`/lock grant at the entity (same as manual control, §9.2) and show the sensitive chip. Alarm panels are not a
  capture domain because reproducing their state needs a code, and codes are never stored (§9.3).

### 4.4 Scripts

- **Runner**: big buttons per script (grouped by the areas of their targets), a fields form for scripts with `fields`
  (selectors: number, boolean, select, text, entity — entity choices scoped), "רץ עכשיו" badge from the `current` attribute and
  "עצור" (`script.turn_off`). Run = `script.turn_on` (fire-and-forget) with `variables`.
- **Editor**: name, icon, description, fields (the five selectors), mode, and a sequence built with the same action blocks as
  automations (one component).

### 4.5 Code view ("קוד") — the second side of the editor toggle

Decision 3: one editor, two views. The toggle "בונה · קוד" shows only to callers with `automation.code_view`; who holds it is a
setting (`automations.code_view_roles`, default installers and administrators = `site_admin`, `system_admin`). The code view is a
monospace text editor of the item's YAML (JSON on the wire; YAML rendered and parsed client-side by a small vendored parser
limited to the YAML subset HA dumps — S4 picks the smallest MIT library, else JSON mode) with server validation (`preview`:
Arx policy + HA `validate_config`) and path-mapped errors. Inside it a locked template block's text is also editable inline from
the builder side (a short multi-line field with a `{{ }}` badge, enough for the owner's templates, all ≤ 400 chars) — that field
is part of the code view's permission, not of the builder's.

**Saving from the code view** derives the write profile from the **content**, not from the view: if every block parses as a typed
block or equals (fingerprint) a locked block of the stored item, the save is a `builder` save (delegation applies, §8.3);
otherwise it is a `code` save, which always needs an HA-admin HA user (the bridge checks). So a delegated household member may
read the code and fix a typed value in it, but cannot author a template, a device trigger or an unknown service. Masked
secret-like values make the code view read-only for the item ("ערכו בתשתית המערכת").

### 4.6 Items Arx cannot edit

| Case (detection) | Shown as |
|---|---|
| No `id` attribute, or config GET 404 (YAML/packages) | read-only; content from WS `automation/config` / `script/config`; "מוגדרת בקובץ תצורה – לצפייה בלבד" (admin sees the exact reason) |
| Config API unavailable (GET on a known id fails ≠ 404, or no item and a probe POST is not approved) | whole feature read-only, status `config_api_unavailable` |
| Include line missing (a bridge write whose entity never appears within 5 s after reload, U-5) | the bridge deletes the orphan, status `authoring_blocked: not_loaded`, admin guidance in settings |
| Integration scene | activate-only |
| Invalid automation (unavailable entity + repairs issue) | editable; banner "לא פעילה – שגיאה בהגדרה" with HA's validation path |
| Delegation off and the caller is not an HA admin | view, run, enable/disable work; the editor opens read-only with the chip "שמירה דורשת מנהל" (the settings tab shows the switch state) |

### 4.7 הגדרות › אוטומציות (one dedicated tab; every option of the feature lives here)

Visible to `system.configure`. Sections, each a card: **מי רשאי** (role × view/run/create-edit/code matrix, read-only here with
a link to the roles screen; the family recipe of §7); **האצלה** (the bridge's delegation switch, **read-only**: its state, when it
changed, and "מופעל בהגדרות רכיב החיבור בתשתית המערכת"); **תצוגת קוד** (which roles see the toggle, default installers/admins);
**סל מחזור** (retention, default 30 days, 7-90); **היסטוריית גרסאות** (count per item, default 20, 5-50); **מגבלות** (writes/min
per user 30, preview/min 60, run interval per item 10 s, scene apply 3 s, storm thresholds 20/min per item and 200/min total,
storm auto-disable off); **פעולות רגישות** (warning chip on/off, default on; the grant rule of §9.2 stated in one line);
**גלריית תבניות** (enable, hide/show and order the templates, admin-approved notify targets); **כפתור "+ חדש" שואל "מתי?"** (optional,
default off). Operator screens never show any of these.

## 5. Boundary with CR-014 schedules

Decision 4ב: **time-based automations are allowed in automations**; schedules stay the simple tool and the two are cross-linked.
- The builder creates and edits time/sun-triggered automations freely (the owner's 9 existing time-only automations stay
  automations; new ones are allowed).
- **Suggestion, never a refusal**: when a draft's triggers are only `time`/`sun` and its actions are only device control (lights,
  switches, climate, fans, covers) and the scheduler component is present, `preview` returns `suggest_schedule` with a pre-filled
  CR-014 draft (time → slot start, weekdays → days, Shabbat condition → preset) and the builder shows one chip, "צור כתזמון",
  next to the save button. Choosing it opens CR-014's dialog with the draft; the automation is not created. Ignoring it saves
  the automation as asked.
- Optional "+ חדש" asking "מתי?" (§4.1) — a setting, off by default.
- Without the scheduler component there is no suggestion. Templates "תאורה בשקיעה" and "מזגן לפי שעות" create automations and
  show the suggestion.
- Automations that call `scheduler.*` (system V) are locked blocks with the chip "שולט בתזמונים".

## 6. Data model

### 6.1 Mirror and item model

The config files are the authority; Arx keeps a read cache per item: `(kind, config_id)`, `entity_id`, `revision`, config JSON
verbatim, `source` (`ui|yaml|integration|dynamic`), editability and reasons. Filled at start (states → ids → GET per id; ≤ 4
in flight), refreshed per §12. Revision = first 16 hex of SHA-256 over canonical JSON (`sort_keys`, compact, `ensure_ascii=False`)
of the stored config.

### 6.2 Blocks (`services/automation_model.py`, pure, shared semantics with the bridge policy)

Read: legacy keys normalised (`trigger`→`triggers`, `platform`→`trigger`, `service`→`action`) into memory only; each trigger,
condition and action step becomes a `typed` block (a closed schema per type) or a `locked` block (`raw` verbatim + `reason` +
Hebrew label + fingerprint = hash of `raw`). **Growth path (decision 5)**: the parser is a registry `reason → schema`; adding a
typed schema for `device`, `template` or `purpose_trigger` later turns those stored blocks into typed blocks on the next read
with no data migration, because every block keeps `raw` and the writer re-emits `raw` while the typed fields still equal the
parsed ones. Rendering a typed block for a new reason needs only its form and its sentence template (§14.1). Write: typed → HA config in the new schema and HA's key order (alias,
description, triggers, conditions, actions, mode, max …); locked → `raw` unchanged; unknown **top-level** keys (`variables`,
`trace`, `trigger_variables`, `initial_state`, `note`, future keys) are carried from the stored config unchanged. Invariant,
tested on every seed shape: `write(read(c)) == c` (canonical JSON) for any unedited item written in the new schema; a legacy
item is rewritten in the new schema only when someone saves it (the HA editor does the same).

### 6.3 Arx tables (migration `0045_automations.sql`; renumbered at merge; 0044 is CR-016's)

`ha_config_items` (cache, §6.1) · `automation_meta` (kind, config_id, created_via `arx|external`, created_by/updated_by (+username),
first/last_seen, gone_at, pinned, hidden (integration scenes), favourite) · `automation_versions` (kind, config_id, revision,
config_json, seen_at, via `arx|external`, actor; last N per item, N = setting `automations.versions_keep`, default 20) ·
`automation_trash` (snapshot + meta + entities + sensitive, deleted_by, expiry = setting `automations.trash_days`, default 30,
restored_at) · `automation_ops` (idempotency per user and `client_request_id`, like `schedule_ops`) ·
`automation_runs` (kind, config_id, at, source `event|trace`, 30-day prune; feeds counts and the storm guard). No config is
stored outside HA except these snapshots. `0046_automation_role_grants.sql` only if default grants need a data migration
(CR-015 precedent `0042`).

## 7. Permissions and scope

Decision 1ב: installers and administrators, **and household members who were granted the permission — only for devices in
their floors/areas** (the binding's scope). Decision 6ג: no separate "sensitive content" permission; sensitive steps use the
grants manual control already uses.

| Permission | Hebrew label | Default | Sensitive (not implied) |
|---|---|---|---|
| `automation.view` | צפייה באוטומציות, סצנות וסקריפטים | site_admin, system_admin | no |
| `automation.manage` | יצירה, עריכה, הפעלה/השבתה, הרצה ומחיקה של אוטומציות | site_admin, system_admin | yes |
| `scene.manage` | יצירה, צילום ועריכה של סצנות | site_admin, system_admin | yes |
| `script.run` | הפעלת סקריפטים | site_admin, system_admin | no |
| `script.manage` | יצירה ועריכה של סקריפטים | site_admin, system_admin | yes |
| `automation.code_view` | תצוגת קוד בעורך (הצד השני של המתג "בונה · קוד") | site_admin, system_admin (setting `automations.code_view_roles`) | yes |

- Scope primitive = CR-014 §4.2 (`ha_scope.entity_allowed`, placements; HA areas are never a scope). Family recipe (documented,
  like "עורך תזמונים"): custom role "בני בית" = `automation.view` + `script.run` bound at their floors; "עורך אוטומציות" adds
  `automation.manage` + `scene.manage` at the same floors. Saving by a household member who is not an HA admin also needs the
  delegation switch (§8.3).
- **Visibility**: an item is visible iff every **action target** entity is visible to the caller (view permission + `devices.read`
  or `entity.state.read` at the entity); with no typed target, by trigger entities; with neither (only locked/notify), only to
  installation-wide viewers. Trigger/condition entities outside scope never hide an item: shown by name, locked for that caller.
- **Change**: the right permission at every target entity of the old and the new content + control there (`ha_scope.control_allowed`)
  + **for a sensitive step, the same grant manual control needs at that entity** (`door.unlock`, `alarm.disarm`, lock/gate/
  garage/siren control classes of CR-014 §4.4 — if you may not unlock the door from the device screen, you may not author an
  automation that unlocks it) + `automation.code_view` when a locked block's content or a top-level unknown key changes.
  Controlling another automation (`automation.turn_on/off/trigger`) needs `automation.manage` at that automation. Deleting or
  moving a locked block needs only `manage` at the typed targets unless the block has unknown effects (then installation-wide
  `manage`).
- **Run**: automation run/enable = `automation.manage` + control of every typed target (sensitive targets: the manual-control
  grant, with the same confirmation manual control shows); unknown effects (locked actions) → installation-wide
  `automation.manage` + confirm. Script run = `script.run` + control of every effect entity (recursively through called scripts,
  depth 3); scene activate = control of every member (HA-native) or of the scene entity (integration).
- `system.configure` administers הגדרות › אוטומציות and grants no authoring right.

## 8. Execution model

### 8.1 Reads (add-on session, no user context)

Mirror via `ha_sync` (automation/script/scene states already mirrored; `ATTR_ALLOW` += `id`, `current`, `max`, `entity_id` for
scenes), config by REST GET per id (U-2; fallback WS `automation/config`/`script/config`), traces, `validate_config`,
`get_services`, label/category/floor registries. Reads never write; everything is filtered per viewer before it leaves the server.

### 8.2 Writes and runtime ops: bridge 0.6.0 `smplwise_bridge.config_item` (renumbered if 0.5.0 is not merged first)

- Signed like `execute`/`schedule`; ops `upsert`, `delete`, `enable`, `disable`, `trigger`, `run_script`, `stop_script`,
  `apply_scene`, `snapshot_scene` (slice C). Runtime ops call the service with `Context(user_id=<caller's HA user>)`
  (non-admin allowed by HA, U-10).
- `upsert`/`delete`: the bridge (a) re-validates the payload with its own dependency-free `config_policy.py`, (b) re-reads the item
  **under its write lock** and refuses when the revision ≠ `base_revision` (`stale`), (c) validates with HA's own
  `async_validate_config_item` (U-3), (d) keeps the previous file in a 10-deep backup ring under `<config>/smplwise_bridge_backups/`,
  (e) writes atomically in HA's format (list/dict, key order) and re-reads to verify, (f) reloads (`automation.reload {id}`,
  `script.reload`, `scene.reload`) and waits ≤ 5 s for the entity, (g) answers `{ok, revision_before, revision_after,
  entity_id, loaded}`. Delete also removes the registry entry (as HA does).
- Why not the REST config API with the add-on's Supervisor token: that token is already admin-capable, so the bridge is not a
  capability barrier; it is the **single enforcement point** (signature, HA-user checks, delegation switch, independent policy,
  CAS under a lock, backups) that ADR-012 and `HA_IDENTITY_RBAC_HE.md` require for every product write. The cost is owning a
  small writer; the risk is covered by W-1/W-2, a contract test per HA release (`release_check`) and the backup ring.

### 8.3 Who may write — recorded contradiction and the owner's approval

HA allows config writes only to HA admins (§3.1). `HA_IDENTITY_RBAC_HE.md` §8 says the admin token must not do what the user may
not do, and that HA configuration changes need the matching HA rights; AGENTS.md says an HA non-admin may hold scoped product
roles. The precedent `set_entity_area` (0.2.5) already performs an admin-level registry write gated by Arx only.

**Owner approval (2026-10-01, decision 2ב) — an explicit, recorded approval of a security design change against
`docs/security/HA_IDENTITY_RBAC_HE.md` §8:** household members who are not HA admins may save automations, scenes and scripts
through a **delegation switch** in the bridge's HA-side options flow ("אפשר ל־Arx לשמור אוטומציות עבור משתמשים שאינם מנהלים"),
default **off**, changeable only by an HA admin inside HA, **simple-builder content only**. Off: `upsert`/`delete` require
`user.is_admin`. On: any active user the add-on signed for, **builder profile only** (typed blocks from the allow-list + locked
blocks byte-equal to the stored ones); the `code` profile always requires `is_admin` (§4.5). Runtime ops never need it. The
switch state is shown read-only in הגדרות › אוטומציות and every delegated write is audited with `delegated: true`. The
amendment text for the security document is drafted in `docs/security/HA_IDENTITY_RBAC_AMENDMENT_AUTOMATIONS_DRAFT_HE.md`
for the owner's sign-off; the original document is not edited until then. Precedence stays as CLAUDE.md states: this approved
change request → `docs/security/`; the contradiction is recorded here, not silently resolved.

## 9. Safety

1. **Allow-lists**: builder action services ⊂ `ha_bridge.ACTIONS` ∪ {`scene.turn_on`, `script.turn_on`, `script.<key>`,
   `notify.<approved target>`, `automation.turn_on/off/trigger`, `alarm_control_panel.alarm_arm_*/alarm_disarm`, `lock.lock/unlock`,
   `cover.open/close` for door/gate/garage classes, `siren.turn_on/off`} — all **without** a `code` argument; never typed:
   `homeassistant.*`, `shell_command.*`, `rest_command.*`, `hassio.*`, `recorder.*`, `smplwise_bridge.*`, any `*.reload`. The
   bridge enforces the same list (drift test like CR-014's).
2. **Sensitive actions — the owner's rule (decision 6ג, chosen knowingly against the earlier recommendation; not to be
   re-asked)**: alarm, locks, doors, gates, garage doors and sirens are **allowed in automations, scenes and scripts like any
   other action**. They pass through the **same permission checks as manual control** — the author (on save), the runner (on
   run-now) and the enabler (on enable) must hold the manual-control grant for that action class at that entity (`door.unlock`,
   `alarm.disarm`, the lock/gate/garage/siren control classes of CR-014 §4.4) within their scope. **Codes are never stored in, or
   shown by, an automation** (a step that needs a code is refused with `code_not_allowed`; panels that require a code for
   disarm cannot be disarmed by an Arx-authored automation — that is HA's own rule, not an Arx restriction). The editor shows a
   plain **warning chip** on such steps ("פעולה רגישה"; its visibility is a setting, default on) and the list shows the chip
   "רגישה". No separate permission, no extra confirmation beyond what manual control already shows.
3. **No secrets**: values under secret-like keys (`password|passwd|token|api_key|apikey|secret|code|pin`, case-insensitive, any
   depth) are masked in every API answer and in traces, never logged or audited; such blocks are locked; the code view is
   read-only for the item. Alarm codes are never typed (CR-014 rule `code_not_allowed`).
4. **Loops and storms**: static warnings in preview — self-trigger (an action target is a state-trigger entity without a guard
   condition) and cycles across the installation's automations (trigger entity ← action target graph); saving a self-trigger needs
   confirm and forces `mode: single` + `max_exceeded: silent`. Runtime guard: > 20 runs/min of one automation or > 200/min in
   total → admin alert with a one-tap disable; auto-disable is a setting, off by default.
5. **Rate limits** (all editable in הגדרות › אוטומציות, §4.7): writes 30/min/user; preview 60/min/user; run/trigger 1 per item
   per 10 s; scene apply 1 per scene per 3 s; bridge calls 15 s timeout, never retried (AGENTS.md: no blind retry of physical
   commands).
6. **Preview/dry-run/confirm**: every save shows the affected devices by floor and the diff of the sentence; unknown-effect
   content (locked actions) needs `confirm: true`; sensitive steps need only the grant of §9.2; invalid-in-HA items are flagged
   from the entity/repairs state.
7. **Missing entities**: chip "מכשיר חסר" (the probe's K case), never auto-removed.

## 10. Concurrency, drift, rollback

1. **Revision + CAS**: every write carries `base_revision`; the add-on refuses early (409 `item_changed` with the current item),
   the bridge re-checks under its lock (window left: a simultaneous HA-UI save between the bridge's check and write, ms).
2. **Drift**: a revision change without an Arx op → new `automation_versions` row (`via: external`), chip "שונתה מחוץ למערכת",
   audit `automation.changed_outside` for sensitive items; an open editor gets the conflict banner (reload / compare / keep mine).
3. **Rollback**: versions (last 20) → "שחזר גרסה" = upsert with the current `base_revision`. **Trash**: delete snapshots first,
   restore re-creates with the **same id** when free (entity id and history continue); 30 days; purge by installation-wide manage.
   The bridge's file backup ring is the last-resort recovery (admin only, documented).

## 11. API contract delta (full shapes in `AUTOMATIONS_API.md` §2-§3)

Router `routers/automations.py`, prefix `/api/v1`: `GET /automations/status`, `GET /automations` (list, all kinds),
`GET /automations/{kind}/{id}`, `GET /automations/catalog`, `GET /automations/templates`, `POST /automations/preview`,
`POST /automations/{kind}` (create), `PUT /automations/{kind}/{id}`, `PUT /automations/{kind}/{id}/code`,
`POST /automations/{kind}/{id}/delete|copy|enable|disable|run|stop|apply|dry-run`, `POST /automations/scene/capture`,
`GET /automations/{kind}/{id}/runs[/{run_id}]`, `GET|POST …/versions[/{vid}/restore]`, `GET /automations/trash`,
`POST /automations/trash/{tid}/restore|purge`, `GET /automations/review`, `PUT /automations/{kind}/{id}/meta`,
`GET|PUT` settings keys `automations.*` (the settings tab, §4.7). Audit resource type `automation_item`, actions
`automation.create|update|delete|restore|enable|disable|run|copy|code_edit|changed_outside|storm`, each with `delegated: bool`.

## 12. Events and refresh

WS subscriptions on the add-on session: `automation_reloaded`, `scene_reloaded`, `automation_triggered`, `script_started`,
`entity_registry_updated` (the three domains), `state_changed` (already streamed). Debounced (500 ms) re-read of the touched
items; scripts (no reload event) are re-read after Arx writes and on registry/state changes; full pull every 10 min and after
reconnect. Clients get `HaPush` `automations_changed {kinds, ids}`.

## 13. Tests

- `tests/fake_ha_config.py`: in-memory automations/scripts/scenes files with HA's exact status codes and messages (GET 404, DELETE
  400, upsert, "Message malformed"), `validate_config`, `automation/config`, `script/config`, `trace/list/get`, registry
  (`unique_id` = id), states (`id`, `last_triggered`, `current`), events, YAML-managed items (entity with id, GET 404), no-id
  items, integration scenes, a legacy item, a secret-like item, an invalid item, and the fake bridge `config_item`. Seed
  `seed_probe_like()`: synthetic, anonymised items reproducing the probe's distributions (state/time/time_pattern/template/device
  triggers, choose/if, trigger ids, modes, Hebrew generic aliases, custom services, a missing entity).
- Backend: model round-trip on every seed item (`write(read(c)) == c`), Hebrew sentences (golden files), policy/scope matrix,
  locked-block preservation, routes and every error code, CAS/409, trash/versions, storm guard, drift. Bridge: `config_policy`
  (module by path), writer on a temp dir (list/dict, key order, backups, atomic), CAS, delegation switch, never reloads without a
  write. Frontend: builder units, evidence specs at 1440/820/390 in demo mode; a live spec against the fake. Phase 0 per §3.3.

## 14. Phases and slices (estimate and calendar in `AUTOMATIONS_API.md` §7)

- **Slice A — see and run** (no config writes): list, detail, sentences, locked outline, enable/disable, run, scene activate,
  script run with fields, "למה זה רץ" (full trace), status + the settings tab, permissions, mirror, fake. Bridge: runtime ops only.
- **Slice B — author**: builder (typed blocks, locked preservation), templates, create/edit/copy/delete, trash, versions, scene
  capture, script editor, the "צור כתזמון" suggestion, the code view (installers must be able to edit the templates that half of
  the owner's automations use), bridge writer + delegation switch, phase-0 W-1/W-2 on the lab (approval).
- **Slice C — extras**: scene try-with-undo, area/floor targets, labels/categories writes, storm auto-disable, the optional
  "+ חדש → מתי?" entry.

### 14.1 Roadmap (the owner said he will want these later; designed for, not built in v1)

| Item | Owner decision | What v1 prepares | Estimate |
|---|---|---|---|
| Typed editing of device triggers/actions (wall-switch buttons), templates and purpose-specific triggers (option ג of question 5) | 5: "option א now, ג later" | locked blocks keep `raw` + `reason`; the parser is a `reason → schema` registry; sentences and forms are per type (§6.2) | +16-24 h (device: `device_automation/*` capabilities; template: inline field already in the code view; purpose-specific: read HA's trigger descriptions) |
| Blueprints (show, instantiate, later import) | 8א: "not in v1, later" | the item model carries `use_blueprint` as a top-level extra unchanged; list shows "מבוסס על תבנית מוכנה" | +12-20 h |
| "+ חדש" asking "מתי?" | 4ב: optional | a setting, off by default (§4.1) | included in slice C |

## 15. Risks

1. Owning a config writer (§8.2): format drift across HA releases → contract test per release, backups, W-1/W-2.
2. Delegation is a real privilege extension beyond HA's model → approved by the owner (§8.3): off by default, HA-admin switch,
   builder profile only, audit; the security document amendment awaits sign-off.
3. HA editor churn (purpose-specific triggers renamed in 2026.5/2026.7) → Arx writes generic triggers; unknown kept locked.
4. Half the owner's automations use templates → block-level locking keeps them editable; sentences say "…ופעולה מתקדמת".
5. Scene capture fidelity per integration (color modes, covers) → per-domain allow-list of attributes, editable table, "נסה".
6. Sample of three systems → unobserved kinds stay locked, not refused.
7. The HA UI remains an unrestricted path for HA users (documented limit, as in CR-014 §4.5b).
8. Sensitive actions allowed in automations (decision 6ג): an automation can unlock a door or disarm the alarm without a person
   present → mitigated by the manual-control grants on author/run/enable, no codes stored, the warning chip, the full trace,
   the "רגישה" filter and the administrator review list; the residual risk is accepted by the owner.
9. The full trace shows variables to every viewer of the automation (decision 9ג) → secret-like values masked, user ids
   replaced by display names, scope filtering unchanged.

## 16. Owner decisions (2026-10-01 morning) — adopted

| # | Question | Decision | Landed in |
|---|---|---|---|
| 1 | Who may create/edit | **ב** installers, admins and household members granted the permission, only for devices in their floors/areas | §7 |
| 2 | Non-HA-admin household members saving | **ב** yes, via a delegation switch (off by default, HA admin turns it on inside HA), simple-builder content only — **explicit approval of a security design change**; amendment drafted | §8.3, `docs/security/HA_IDENTITY_RBAC_AMENDMENT_AUTOMATIONS_DRAFT_HE.md` |
| 3 | Builder or code | **toggle** builder ↔ code inside the editor for everyone allowed to edit; the code view gated by a setting (default installers/admins); the toggle shown only to those who may use it | §4.2.1, §4.5, §4.7 |
| 4 | Schedules vs automations | **ב** time-based automations allowed; schedules stay the simple tool; cross-link ("צור כתזמון" suggestion; optional "+ חדש → מתי?") | §5, §4.1 |
| 5 | v1 builder scope | **א** now; **ג** (typed device/template/purpose-specific blocks) later — block model designed for it | §4.2.2-3, §6.2, §14.1 |
| 6 | Sensitive actions | **ג** allowed like any action — same permission checks as manual control, codes never stored or shown, plain warning chip. Differs from the earlier recommendation (ב); chosen knowingly | §9.2, §7 |
| 7 | Scene creation | **א** "צלם מצב נוכחי" + manual correction in a table; integration scenes activate-only | §4.3 |
| 8 | Blueprints | **א** none in v1; roadmap note | §14.1 |
| 9 | "למה זה רץ" | **ג** the full trace as HA shows it (steps, conditions, variables, timing) for everyone who may view the automation, with the short Hebrew sentence on top | §4.2.6 |
| 10 | The 42 existing automations | **א** all appear immediately and are editable; unknown parts locked and round-tripped unchanged | §4.2.3, §6.2 |
| + | Owner rule | every option in one dedicated settings tab "אוטומציות" | §4.7 |
