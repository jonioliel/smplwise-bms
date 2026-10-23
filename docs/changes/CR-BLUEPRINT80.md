# CR-BLUEPRINT80 - Automation blueprints ("תבניות חכמות"): a library, creation from parameters, later import / export

Status: PROPOSAL with slice 1 (backend only) built and OFF. Branch `pilot/BLUEPRINT80-295` from `origin/main` (v2.12.4, 320e5555). Board item r080.
Builds on CR-017 (`docs/changes/CR-017-AUTOMATIONS-SCENES-SCRIPTS.md`, API `docs/architecture/AUTOMATIONS_API.md`); CR-017 section 14.1 listed
"Blueprints (show, instantiate, later import)" as a roadmap item (owner decision 8: "not in v1, later", estimate 12-20 h) and promised the item model keeps
`use_blueprint` untouched. Door-opening automations stay under CR-AUTODOORS-295 and CR-033; nothing in this CR changes them. No Home Assistant, bridge, lab
device or door was contacted to write or test this slice. Precedence per CLAUDE.md: an approved change request, then `MASTER_SPEC_HE.md` and `docs/security/`,
then `AGENTS.md`, then this document; this CR binds only once the owner approves it.

## 1. Goal

Today a person builds an automation block by block, or starts from the 7 pre-filled drafts of the gallery (`/automations/templates`, `template_defs`), whose
pickers are left empty and which nothing validates until save. The goal: **a library of ready-made, parameterised blueprints. The person picks one, fills a few
fields (devices, an area, times, minutes, a message), and gets an automation** that went through exactly the checks a hand-made one goes through. Later: import
and export of blueprints, with signing.

Non-goals: a second automation engine; Home Assistant's own YAML blueprints (`use_blueprint`, `blueprint:` folders) - this is Arx's format, expanded by Arx into an
ordinary automation; blueprints that open doors, lock, arm / disarm, sound sirens or move covers; editing a blueprint's template in the UI; anything on the frontend
in slice 1.

Relation to the existing gallery: the gallery stays as it is (drafts to review in the editor). A blueprint differs in that its parameters are typed and validated
against the real installation, it has a version, and (later) it can be imported / exported. Whether the gallery is eventually folded into the library is an owner
question (section 14, Q5).

## 2. What the owner gets (slice 1, backend)

- `GET /api/v1/automation-blueprints`: the built-in library (read-only) with each blueprint's parameter specs.
- `POST /api/v1/automation-blueprints/{id}/preview`: the draft the parameters stand for, its Hebrew sentence, and what the save would answer (including a refusal for
  missing rights). Nothing is written.
- `POST /api/v1/automation-blueprints/{id}/instantiate`: creates the automation **disabled** through `automation_ops.create` (section 6). Enabling is the existing
  enable route, with its own checks.
- The feature is the administrator setting `automations.blueprints_enabled`, **default `false`**, on top of `automations.enabled`.

## 3. Blueprint format (schema version 1)

A blueprint is declarative JSON (`services/automation_blueprints.py`, `LIBRARY`); never code, never a template string.

```
{ "id": "motion_light_timer", "version": 1, "category": "lights|alerts|climate|schedules", "icon": "mdi:...",
  "title": "<Hebrew, <= 80>", "description": "<Hebrew, <= 300>",
  "parameters": [ {"key", "type", "label", ...constraints} ],           // 1-12
  "rules":      [ {"rule": "lt|ne", "a": "<key>", "b": "<key>", "message": "..."} ],
  "template":   { "mode": "single|restart", "triggers": [...], "conditions": [...], "actions": [...] } }
```

The template has the shape of an automation config (new HA schema). A value may be `{"$param": "<key>"}`, optionally `"as": "duration"` (minutes to
`{hours, minutes, seconds}`) or `"as": "offset_text"` (minutes to a sun offset). There is no other expression language.

**Parameter types (closed):** `entity`, `entities` (1-20), `area_entities` (an area, or a floor, expanded to the literal entities of the wanted domains at creation
time, <= 20, so a later change of the area does not silently change the automation), `time` (HH:MM), `minutes`, `int`, `number`, `text` (<= 200, no braces or angle
brackets or control characters: a template can never be smuggled in), `weekdays`, `notify_target` (one of the targets the administrator approved in
`automations.notify_targets`; absent = the first approved one), `scene`. Entity-like parameters carry `domains`, optional `device_classes`, `max`, and a `role`
(`watch` = a trigger / condition entity, `control` = an action target). Unknown keys in the caller's `params` are refused.

**Allowed triggers:** `state`, `numeric_state`, `time`, `sun`. **Allowed conditions:** `state`, `numeric_state`, `time`, `sun`. **Allowed actions:** a `delay`, or
one service of {`light.turn_on/off`, `switch.turn_on/off`, `fan.turn_on/off`, `climate.turn_off`, `climate.set_temperature`, `climate.set_hvac_mode`,
`media_player.turn_off`, `scene.turn_on`} or the notify target parameter, with an `entity_id` target only (no area / device / label target, which CR-017 locks in
v1). No `choose` / `if` / `repeat` / `parallel` / `wait`, no templates, no event or webhook triggers, no `device` triggers. Every block key outside a fixed per-type
list is a definition error.

**Versioning:** `schema` (the format, 1) and `version` (the blueprint, an integer; a changed template or parameter set is a new version). An automation created from
a blueprint records `{id, version}` in the audit row (not in the Home Assistant config in slice 1, to keep the written file identical to a hand-made one; the
`use_blueprint` marker of CR-017 14.1 is an owner question, Q6). A new library version never changes an existing automation.

## 4. The library (6-8 safe starters; slice 1 ships 8)

Exact Hebrew titles and descriptions (these strings are in the code and in a test):

| id | category | title | description |
|---|---|---|---|
| `lights_off_floor_empty_night` | lights | כיבוי אורות כשהאזור ריק בלילה | מכבה את התאורה שבחרתם כשאין תנועה באזור במשך כמה דקות, בשעות הלילה שתקבעו. |
| `door_left_open_notify` | alerts | התראה על דלת או חלון שנשארו פתוחים | שולח הודעה כשחיישן דלת או חלון נשאר במצב פתוח יותר מהזמן שתקבעו. ההתראה אינה פותחת או סוגרת דבר. |
| `temperature_out_of_range` | alerts | התראת טמפרטורה חריגה | שולח הודעה כשהטמפרטורה בחיישן עולה מעל הגבול העליון או יורדת מתחת לגבול התחתון. |
| `scheduled_scene` | schedules | הפעלת סצנה בשעה קבועה | מפעיל סצנה קיימת בשעה שתקבעו, בימים שתבחרו. |
| `motion_light_timer` | lights | תאורה בתנועה עם כיבוי אוטומטי | מדליק תאורה כשיש תנועה ומכבה אותה אחרי כמה דקות. |
| `water_leak_notify` | alerts | התראת נזילת מים | שולח הודעה מיד כשחיישן הצפה מזהה מים. |
| `ac_off_window_open` | climate | כיבוי מזגן כשחלון פתוח | מכבה מזגן כשחלון נשאר פתוח יותר מכמה דקות. |
| `area_lights_at_sunset` | lights | תאורת אזור בשקיעה | מדליק את כל התאורה של אזור שתבחרו בשקיעה, עם הקדמה או איחור בדקות לפי הצורך. |

"Lights off when the floor is empty at night": the trigger is "a motion sensor of the area has been off for N minutes", the conditions are "all the chosen sensors are
off" (a state condition on a list means all) and "inside the night window" (a time condition, `after > before` wraps midnight); the floor is the set of sensors the
person picks (picking by floor is the `area_entities` type, used by the sunset blueprint). Operator strings never say blueprint / HA / YAML (CR-017 section 1); the
word in the UI is "תבניות חכמות" (distinct from the existing "תבניות" gallery; owner question Q5).

## 5. Parameter validation against the installation and the user

Server side, before anything is built (`resolve_params`), against the add-on's mirror and the caller's reach (`scope.Ctx`, the editor's own):

1. every entity exists (not removed), has the allowed domain (and device class where the blueprint says so: a "door sensor" parameter takes door / window / opening
   sensors only), and the caller may read its state (`entity.state.read` / `devices.read` in reach) - else a per-parameter error (`entity_unknown`, `entity_domain`,
   `entity_class`, `entity_not_in_reach`);
2. a `control` entity is not sensitive (section 7);
3. numbers and times are in range, types are exact (a string is not a number, `true` is not 1), cross-parameter rules hold (`low < high`, `from != to`);
4. notify targets are in the approved list; text has no braces;
5. areas / floors exist; entities of the area that the caller may not control, that are sensitive, or of another class are left out; none left = `area_empty`.

Errors are `422 validation` with `details.errors = [{param, code, message}]` (Hebrew messages). **Control rights are not re-implemented here**: they are judged by the
create path (section 6), so the answer is the editor's `403 forbidden` / `grant_required` / `delegation_off` / `entity_not_controllable`.

## 6. Creation goes through the SAME path

`instantiate` expands the blueprint to an automation config, reads it through the block model (`config_to_draft`, so the draft is exactly what the editor would hold;
a draft that comes out with a locked block or an unknown top-level key is refused `blueprint_not_expressible`), clears every block's `raw` (a new block, as when the
editor sends it) and calls **`automation_ops.create(w, "automation", draft, enabled=False, confirm, client_request_id)`** - the function behind `POST /automations/automation`.
Therefore, unchanged and with no copy of their logic: the manage permission per kind (`require_manage`), `automations.enabled`, the write rate limit, the bridge /
HA-admin / delegation write block, idempotency by `client_request_id`, `judge` (caps, argument rules, `entity_mismatch`, masks), the scope and sensitive grants
(`scope.change_reasons`), the door-path guards (`door_path_guard.check_automation_item` and `check_config`, which resolve called scenes), self-trigger confirmation,
the bridge upsert, the version / trash history, and the `automation.create` audit row. A local (Arx-only) identity is refused as for a manual create
(`service_identity.refuse_automation_write`). A test builds the same automation by hand and compares the stored config and the bridge call.

Created **disabled** always (`enabled: false`): the person reviews the automation in the editor and enables it with the existing route (own checks, `ask_when_on_new`).

## 7. Door safety (hard rule)

An automation that opens a door stays under CR-AUTODOORS-295 (`door_automations`, its own arming, kill switch, permission `access.doors.automate`) and CR-033 (the
door path; `doors.editor_block`). **A blueprint can neither create nor reference one**, enforced three times:

1. the format has no lock / alarm / siren / cover / script / automation / `homeassistant` / shell service, no name containing unlock / open / door / gate / garage /
   disarm / reload, and a `control` parameter cannot declare such a domain (`validate_definition`; applied to every built-in blueprint in a test and to every imported
   one later);
2. at resolution a control entity that is a lock / alarm / siren / door-class cover, is on the door layer, or is a "possible door device" (a virtual device of a
   door platform, `door_path.possible_door_entities`) is refused (`entity_not_allowed`);
3. the expanded config is checked again, independently (`check_config`): only the closed services, no forbidden domain or name, no sensitive target, so even a definition
   with a bug cannot reach the create path (`blueprint_forbidden_action` / `_target`; a test injects a `lock.unlock` blueprint into the library).

Alarm / lock / siren / cover actions are allowed in hand-made automations by owner decision 6ג (CR-017 section 9.2). **Blueprints are stricter on purpose** (a
ready-made, low-friction path should not carry sensitive actions); Q3 asks whether the owner wants to relax that for alarm arming later. `scene.turn_on` is allowed because the
create path's door-path guard resolves the scene's members and refuses a scene that opens a WisKey door. No `door_automations` row is ever written.

## 8. Permissions, audit, rate limits

- Library, preview, instantiate: `automation.manage` somewhere (the same gate as the editor's `/automations/templates`); the audited 403 otherwise. `GET /status` never
  403s (`can_use: false`). No new permission and no migration.
- Audit: a refusal before the create path is an audited `denied` row `automation.blueprint.instantiate` (reason = error code, no values); a success is the ordinary
  `automation.create` row whose details carry `blueprint: {id, version}` (entities and classes as for a manual create; the title and parameter values are not logged).
- Rate limits: the write limit (create path) and the preview limit (`automations.limits.preview_per_min`) of CR-017.

## 9. Default OFF and module off

`automations.blueprints_enabled` = `false` by default (administrator setting, part of the automations tab later). Off: every route except `/status` answers
`409 blueprints_disabled`. `automations.enabled = false` answers `409 feature_disabled` first. The built-in library is code, so turning the feature on exposes nothing
until a person with `automation.manage` instantiates one.

## 10. Import / export (later; not in slice 1)

Designed for, not built. An exported blueprint is the JSON of section 3 plus `{schema, exported_at, exporter, signature}`. Rules fixed now so slice 1 does not paint
us into a corner: (a) import runs `validate_definition` (the same closed format) and refuses anything outside it; (b) an imported blueprint is `sensitive: false` by
construction - there is no way to declare otherwise; (c) signing: Ed25519 over the canonical JSON; the installation holds a list of trusted public keys (the built-in
SmplWise key, plus keys an administrator adds); an unsigned or unknown-signature blueprint is imported only by a system administrator, into a "not trusted" state that
the person must confirm with the diff in front of them; (d) the import is an administrator-only action (`system_admin` / HA administrator), audited with the
blueprint's hash; (e) imported blueprints are stored in an Arx table (the one possible migration, PROVISIONAL `0170_automation_blueprints.sql`, section 12) and can be
disabled or deleted; the built-in library cannot be edited; (f) an imported blueprint's id cannot shadow a built-in id.

## 11. Tests (slice 1: `tests/test_automation_blueprints_80.py`)

Pure: the library is 8 valid, unique, Hebrew blueprints with no door / lock / alarm / siren / cover / script text; fifteen forbidden or unlisted services are refused by
`validate_definition`; the closed format (device / template / webhook triggers, extra keys, nested control flow, area targets, undeclared and unused parameters, a
forbidden control domain, a parameter standing for a non-notify action) is refused; `check_config` stops lock / cover / alarm / siren / script / foreign notify / a sensitive
target. App (CR-017 fake world plus extra entities): default OFF, enabled, module off; read-only library without templates (no write verbs); preview writes nothing;
instantiation equals the manual equivalent (stored config and bridge call) and is created disabled; idempotency; all 8 blueprints instantiate; area expansion; about 30
per-parameter validation cases (unknown / wrong domain / wrong class / count / range / types / rules / notify / text / scene / area); lock, cover, alarm targets refused for
every control parameter; possible-door devices refused and left out of an area; a tampered library blueprint with `lock.unlock` never reaches the bridge; no `door_automations`
row; a user without manage is refused everywhere (audited); a floor editor is held to delegation, scope and reach like the editor. NOT_RUN items: the frontend, a real
Home Assistant, a real notify target (the fake bridge answers).

## 12. Slices

| Slice | Content | Status |
|---|---|---|
| 1 | Format, built-in library, validation, routes (list / one / preview / instantiate), setting (default off), tests | built in this change (backend only) |
| 2 | Frontend: a library screen inside הגדרות › אוטומציות / the automations list ("חדש מתבנית"), a form per blueprint from the parameter specs, preview, areas picker | needs owner approval of Q1-Q2; mockup first |
| 3 | `use_blueprint`-style provenance in the list ("נוצר מתבנית"), "update to the new version" as a visible diff, never silent | depends on Q6 |
| 4 | Export (a blueprint from an existing automation, with parameters chosen by the person, refused if it holds a forbidden block), signed import, trusted keys, table (PROVISIONAL migration 0170, one file) | after owner approval of section 10 |

## 13. Migration, rollback, API inventory

Slice 1: **no migration**. A `contracts/API_INVENTORY.md` regeneration (`python scripts/api_inventory.py`: +5 routes, 1199 -> 1204) is left to the integration of the
release branch, to avoid a conflict with the other branches that add routes. Rollback: remove the router line in `main.py` and the setting default; no data exists.

## 14. Owner questions (recommendation first)

1. Where does the library live in the UI? **Recommended: a "חדש מתבנית" entry in the automations list and the editor's "+ חדש", plus a card list in הגדרות › אוטומציות;**
   alternative: only inside the existing gallery.
2. Created disabled always? **Recommended: yes** (review, then enable); alternative: let the form offer "enable now" for holders of the enable right.
3. Alarm arm / disarm and covers (not doors) in blueprints? **Recommended: no, ever, in built-in blueprints**; revisit with a "good night: arm alarm, close shutters" blueprint only
   after the door-automation review is done.
4. Import / export: administrators only, signed, with a trusted-key list? **Recommended: yes, section 10, and only after slice 2 is in use for a month.**
5. Name and the existing gallery: **Recommended: "תבניות חכמות" for blueprints; keep the 7 gallery drafts for now and migrate them into blueprints one by one** (the gallery's
   `time_only` / schedule suggestion would need a place in the format); alternative: replace the gallery at once.
6. Record the origin in the Home Assistant config (`use_blueprint`-like marker, so the list can say "מבוסס על תבנית מוכנה")? **Recommended: no marker in HA; keep the origin in
   Arx's own tables (slice 3)**, so the file Arx writes stays identical to a hand-made one and HA's editor never sees an unknown key.
7. Should an administrator be able to hide single blueprints (as `automations.templates_hidden` does for the gallery)? **Recommended: yes, in slice 2.**

## 15. Contradictions and notes

- CR-017 section 1 lists blueprint import as a non-goal of v1 and 14.1 as roadmap; this CR is that roadmap item. No earlier decision is overridden.
- CR-017 9.2 (owner decision 6ג) allows sensitive actions in automations; blueprints are deliberately stricter (section 7). Not a conflict: a hand-made automation is unchanged.
- CR-AUTODOORS-295 and CR-033 keep every door gate; this CR adds none and removes none.
