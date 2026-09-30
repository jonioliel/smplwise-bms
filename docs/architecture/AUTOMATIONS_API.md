# CR-017 Automations, scenes, scripts — API contract and parallel work plan

Status: **PROPOSED CONTRACT** (becomes binding when the owner answers `docs/design/mockups/automations/decisions-HE.md`;
until then it follows the recommendations). Change request: `docs/changes/CR-017-AUTOMATIONS-SCENES-SCRIPTS.md` ("the CR").
Task T100. Style and conventions follow `SCHEDULER_API.md` (CR-014) and `MEDIA_API.md` (CR-015). Contract changes are made only
by the coordinator on the architecture branch; stream branches rebase.

## 1. Conventions

- Router `routers/automations.py`, prefix `/api/v1`, tag `automations`. Every handler authorises per operation and per item
  (CR §7); the body never carries authority. Bodies are pydantic `extra="forbid"`. Errors use `ApiError` with the Hebrew
  `user_message` of §3.3. Instants are UTC ISO-8601 `Z`.
- `kind` ∈ `automation | script | scene`. `id` is opaque: the config id (`"1727712345678"`, `"arx_1727712345678"`) or, for an item
  without one (YAML without id, integration scene), `"entity:<entity_id>"`. Clients never derive ids or entity ids.
- Writes carry `client_request_id` (8-80 chars; idempotent per user through `automation_ops`) and, for existing items,
  `base_revision`.
- Operator strings never name Home Assistant/HA/YAML/blueprint/Supervisor; `status.admin` and הגדרות › אוטומציות may.
- Typed client: `frontend/src/api/automations.ts` + `automations-mock.ts` (S0, coordinator). The client file is authoritative for
  field names once written; this document is authoritative for semantics.

## 2. Types (TypeScript mirror)

### 2.1 Blocks

```ts
export type ItemKind = 'automation' | 'script' | 'scene';
export type Duration = { hours?: number; minutes?: number; seconds?: number };

/** Every block keeps the stored form. The writer re-emits `raw` byte-for-byte while the typed fields still equal the ones
 *  parsed from it; only a changed block is rebuilt (new schema, HA key order). A new block has raw = null. */
interface BlockBase { uid: string; raw: unknown | null; sentence: string }

export type TriggerBlock = BlockBase & { kind: 'typed'; id?: string | null } & (
  | { type: 'state'; entity_ids: string[]; from?: string | null; to?: string | null; for?: Duration | null }
  | { type: 'numeric_state'; entity_ids: string[]; above?: number | null; below?: number | null; for?: Duration | null }
  | { type: 'time'; at: string /* HH:MM or HH:MM:SS */ }
  | { type: 'time_pattern'; hours?: string | null; minutes?: string | null; seconds?: string | null }
  | { type: 'sun'; event: 'sunrise' | 'sunset'; offset_min: number }
  | { type: 'homeassistant'; event: 'start' });

export type ConditionBlock = BlockBase & { kind: 'typed' } & (
  | { type: 'state'; entity_ids: string[]; state: string | string[]; for?: Duration | null }
  | { type: 'numeric_state'; entity_ids: string[]; above?: number | null; below?: number | null }
  | { type: 'time'; after?: string | null; before?: string | null; weekday?: Weekday[] | null }
  | { type: 'sun'; after?: SunRef | null; before?: SunRef | null }
  | { type: 'trigger'; ids: string[] }
  | { type: 'and' | 'or' | 'not'; conditions: Array<ConditionBlock | LockedBlock> }   // one nesting level
  | { type: 'shabbat'; mode: 'only_holy_days' | 'not_holy_days' });                    // CR-014 preset = a state condition

export type ActionBlock = BlockBase & { kind: 'typed' } & (
  | { type: 'service'; action: string; entity_ids: string[]; data: Record<string, unknown>;
      role: 'device' | 'scene' | 'script' | 'notify' | 'automation' }
  | { type: 'delay'; delay: Duration }
  | { type: 'choose'; options: Array<{ conditions: Array<ConditionBlock | LockedBlock>; sequence: Block[] }>; default: Block[] | null }
  | { type: 'if'; conditions: Array<ConditionBlock | LockedBlock>; then: Block[]; else: Block[] | null }
  | { type: 'repeat_count'; count: number; sequence: Block[] }
  | { type: 'condition'; condition: ConditionBlock }
  | { type: 'stop'; message: string });

export interface LockedBlock extends BlockBase {
  kind: 'locked'; fingerprint: string;          // sha256/16 of canonical raw; the server compares it on save
  reason: 'template' | 'device' | 'purpose_trigger' | 'custom_service' | 'service_not_allowed' | 'unsupported_step'
        | 'disabled_step' | 'secret' | 'code' | 'unknown';
  label: string;                                 // Hebrew, e.g. "תבנית", "כפתור · מפסק סלון", "שירות מיוחד · scheduler"
  sensitive: boolean; effects: 'none' | 'unknown' | string[];   // entity ids when statically known
  template_text?: string | null;                 // only for callers with can.advanced and no masked values
  masked: boolean;
}
export type Block = TriggerBlock | ConditionBlock | ActionBlock | LockedBlock;
```

Typed-block rules: an `entity_ids` list is a literal list (a template makes the block locked); `target.area_id/device_id/
floor_id/label_id` make it locked in v1; `action` must be in the catalogue for the entity class (§3.2 `catalog`), else locked
`service_not_allowed`; a step with `enabled: false` or `continue_on_error` is locked `disabled_step`. Weekday tokens are HA's
(`mon`…`sun`).

### 2.2 Drafts

```ts
export interface AutomationDraft { alias: string; description: string; mode: Mode; max: number | null;
  triggers: Array<TriggerBlock | LockedBlock>; conditions: Array<ConditionBlock | LockedBlock>; actions: Array<ActionBlock | LockedBlock> }
export interface ScriptDraft { alias: string; description: string; icon: string | null; mode: Mode; max: number | null;
  fields: ScriptField[]; sequence: Array<ActionBlock | LockedBlock> }
export interface SceneDraft { name: string; icon: string | null; members: SceneMember[] }
export type Mode = 'single' | 'restart' | 'queued' | 'parallel';
export interface ScriptField { key: string; name: string; required: boolean; default: unknown;
  selector: { kind: 'number'; min: number; max: number; step?: number; unit?: string } | { kind: 'boolean' }
          | { kind: 'select'; options: string[] } | { kind: 'text'; max?: number } | { kind: 'entity'; domains: string[] }
          | { kind: 'locked'; raw: unknown } }
export interface SceneMember { entity_id: string; state: string; attributes: Record<string, number | string | boolean | number[]> }
```

Unknown top-level keys of the stored item (`variables`, `trace`, `trigger_variables`, `initial_state`, `note`, future keys) are
not in the draft; the server carries them unchanged and lists their names in `Item.extras`. Caps: alias 1-120 chars, description
≤ 1000; ≤ 20 triggers, ≤ 20 conditions, ≤ 60 steps in total (nested included), nesting depth ≤ 4, ≤ 50 target entities; script
fields ≤ 12; scene members ≤ 100.

### 2.3 Item (list and detail)

```ts
export interface Item {
  kind: ItemKind; id: string; config_id: string | null; entity_id: string | null;
  name: string; description: string; icon: string | null;
  source: 'ui' | 'yaml' | 'integration' | 'dynamic';
  state: 'on' | 'off' | 'running' | 'unavailable' | 'invalid' | 'scene';   // automation on/off, script running, scene
  sentence: string;                              // one Hebrew line (CR §4.2); '' for integration scenes
  floors: Array<{ id: string; name: string }>; areas: Array<{ id: string; name: string }>;
  targets: Array<{ entity_id: string; name: string; floor: string | null; area: string | null; class: string | null;
                   sensitive: boolean; missing: boolean }>;
  sensitive: boolean; sensitive_classes: string[]; locked_count: number; unknown_effects: boolean;
  mode: Mode | null; extras: string[]; labels: string[]; category: string | null;
  last_run: { at: string; result: 'ok' | 'error' | 'stopped' | 'running' | 'not_triggered' } | null; runs_7d: number | null;
  created_via: 'arx' | 'external'; owner: { display_name: string } | null; updated_at: string | null;
  revision: string | null; pinned: boolean; favourite: boolean; hidden: boolean;
  can: { edit: boolean; advanced: boolean; toggle: boolean; run: boolean; delete: boolean; copy: boolean };
  read_only: null | { reasons: Array<{ code: string; message: string; entity_id?: string }> };
  warnings: Array<{ code: 'missing_entity' | 'invalid_config' | 'self_trigger' | 'cycle' | 'storm' | 'changed_outside'
                         | 'use_schedule' | 'unknown_effects'; message: string }>;
}
export interface ItemDetail extends Item {
  draft: AutomationDraft | ScriptDraft | SceneDraft;   // blocks with per-caller locking (out-of-scope entities → locked view)
  versions: number; trash_restore_of: string | null;
}
```

Read-only reason codes: `no_permission`, `entity_not_controllable`, `sensitive_permission_required`, `yaml_managed`,
`no_config_id`, `integration_scene`, `masked_values`, `config_api_unavailable`, `bridge_unavailable`, `delegation_off`,
`feature_disabled`, `ha_unavailable`.

### 2.4 Status, preview, runs

```ts
export interface AutomationsStatus {
  available: 'ok' | 'ha_unavailable' | 'config_api_unavailable' | 'feature_disabled' | 'not_configured' | 'error';
  stale: boolean; last_sync_at: string | null; writable: boolean;
  write_block: null | 'feature_disabled' | 'ha_unavailable' | 'bridge_missing' | 'bridge_unpaired' | 'bridge_too_old'
             | 'delegation_off' | 'authoring_blocked';
  scheduler_present: boolean;                    // CR §5 boundary
  can: { view: boolean; manage: boolean; scene_manage: boolean; script_run: boolean; script_manage: boolean;
         sensitive: boolean; advanced: boolean; configure: boolean };
  counts: { automations: number; scripts: number; scenes: number; running: number; attention: number; hidden: number | null };
  admin?: { ha_version: string; bridge_version: string | null; bridge_required: string; delegation: boolean;
            caller_is_ha_admin: boolean; config_api: 'ok' | 'unavailable'; authoring_block_reason: string | null };
}
export interface PreviewResult {
  valid: boolean; errors: Issue[]; warnings: Issue[]; ha_validation: 'ok' | 'failed' | 'skipped';
  sentence: string; block_sentences: Record<string, string>;
  effects: { entities: Array<{ entity_id: string; name: string; floor: string | null; area: string | null;
                               from: string | null; to: string | null }>; unknown: boolean };
  sensitive: boolean; requires: { confirm: boolean; sensitive_permission: boolean; advanced: boolean };
  use_schedule: null | { schedule_draft: unknown /* CR-014 ScheduleDraft */ };
}
export interface Issue { path: string; code: string; message: string }
export interface RunSummary { run_id: string; at: string; finished_at: string | null;
  result: 'ok' | 'error' | 'stopped' | 'running' | 'not_triggered';
  trigger: string; conditions: Array<{ sentence: string; passed: boolean | null }>;
  steps: Array<{ sentence: string; result: 'done' | 'skipped' | 'error' | 'running'; error: string | null }> }
```

`RunSummary` never contains variables, context ids or user ids; `steps` for callers without `can.advanced` are the top-level
steps only.

## 3. Routes

### 3.1 Table

| # | Method | Path | Purpose | Auth (CR §7) |
|---|---|---|---|---|
| 1 | GET | `/automations/status` | availability, capabilities, `can`, counts | signed in; never 403 |
| 2 | GET | `/automations` | list; query `kind`, `q` (≤ 80), `floor`, `area`, `state`, `sensitive`, `source`, `mine`, `label`, `category`, `sort` (`last_run`\|`name`\|`updated`), `limit` ≤ 500 | view (or script.run for scripts, control for scenes) |
| 3 | GET | `/automations/{kind}/{id}` | `ItemDetail` | view + visible |
| 4 | GET | `/automations/catalog` | pickable entities with their typed triggers/conditions/actions and argument specs; notify targets; scenes; scripts with fields | any authoring permission |
| 5 | GET | `/automations/templates` | the gallery (CR §4.2.4), each with `target: 'automation' \| 'schedule'` | manage |
| 6 | POST | `/automations/preview` | `{kind, id?, draft}` → `PreviewResult` (always 200 for a well-formed body) | view or manage |
| 7 | POST | `/automations/{kind}` | create `{draft, enabled, confirm, client_request_id}` → 201 `{item, op_id}` | manage/scene.manage/script.manage + control (+ sensitive) |
| 8 | PUT | `/automations/{kind}/{id}` | replace `{draft, base_revision, confirm, client_request_id}` | edit (old AND new) |
| 9 | PUT | `/automations/{kind}/{id}/advanced` | `{config, base_revision, confirm, client_request_id}` (full item JSON; the client renders YAML) | advanced + HA admin (bridge) |
| 10 | POST | `/automations/{kind}/{id}/delete` | `{base_revision, confirm, client_request_id}` → trash | delete |
| 11 | POST | `/automations/{kind}/{id}/copy` | `{name, client_request_id}` | copy |
| 12 | POST | `/automations/automation/{id}/enable` · `/disable` | `{confirm, client_request_id}` | toggle |
| 13 | POST | `/automations/automation/{id}/run` | `{skip_condition: true, confirm, client_request_id}` → 202 | run |
| 14 | POST | `/automations/script/{id}/run` · `/stop` | `{fields, confirm, client_request_id}` → 202 | script.run + effects control |
| 15 | POST | `/automations/scene/{id}/apply` | `{confirm, client_request_id}` → 202 | control of members / scene entity |
| 16 | POST | `/automations/scene/capture` | `{entity_ids}` → `{members: SceneMember[]}` (no write) | scene.manage + control |
| 17 | POST | `/automations/{kind}/{id}/dry-run` | → `{conditions: [{sentence, passed\|null}], effects}` (no execution) | view |
| 18 | GET | `/automations/{kind}/{id}/runs` · `/runs/{run_id}` | `RunSummary[]` · one | view + visible |
| 19 | GET / POST | `/automations/{kind}/{id}/versions` · `/versions/{vid}/restore` | history (last 20) · restore = upsert | view · edit |
| 20 | GET / POST | `/automations/trash` · `/trash/{tid}/restore` · `/trash/{tid}/purge` | trash (30 days) | view · create rules · installation-wide manage |
| 21 | PUT | `/automations/{kind}/{id}/meta` | `{pinned?, favourite?, hidden?}` (Arx only; `hidden` for integration scenes by admins) | view (own prefs) / manage (hidden) |
| 22 | GET | `/automations/review` | administrator list: sensitive external, storm, invalid, missing entities, owner lost rights, masked values | installation-wide manage |
| 23 | GET / PUT | `/settings` keys `automations.enabled`, `.notify_targets`, `.storm_auto_disable`, `.templates_enabled` | settings | `system.configure` |

### 3.2 Semantics that matter

- **Create/replace**: validate (model + policy + scope) → `preview` rules (errors → 422 `validation` with `details.errors`) →
  sensitive/unknown-effect content needs `confirm` (409 `confirmation_required`) → `base_revision` check (409 `item_changed`
  with `details.current`) → bridge `upsert` → re-read → cache, meta, version row, audit → 200/201 `{item, op_id}`. Bridge ok
  with `loaded: false` → 202 `{status: "not_loaded"}` and the admin review lists it. Timeout → 504, op `unknown`, never retried.
- **Locked-block rule**: every locked block in a draft must match (fingerprint) a locked block of the stored item, unless the
  caller has `can.advanced`; else 403 `locked_block_changed`. Order changes and removals are allowed (CR §7).
- **Boundary**: a create that is time/sun-only with device-only actions while `scheduler_present` → 422 `use_schedule` with
  `details.schedule_draft`; replaces of existing items are never refused for this.
- **Delete**: snapshot to `automation_trash`, then bridge `delete`; on bridge failure the snapshot is removed. Integration
  scenes and YAML-managed items → 422 `not_editable`.
- **Restore** (trash or version): bridge `upsert` with the original id when free (else a new id, reported), under the current
  rules (scope, sensitive, delegation).
- **Run**: 1 per item per 10 s installation-wide (429 `run_too_soon`); scene apply 1 per 3 s; answers are 202 with `run_id` when
  known (from the next `automation_triggered`/`script_started` with the bridge's `context_id`).

### 3.3 Error codes (Hebrew user messages, verbatim)

| Status | code | user_message |
|---|---|---|
| 403 | `forbidden` | אין הרשאה לפעולה זו בהיקף המבוקש. |
| 403 | `entity_not_controllable` | אין לך הרשאת שליטה ב־{name}. |
| 403 | `sensitive_permission_required` | תוכן שנוגע באזעקה, במנעולים, בדלתות ובשערים דורש הרשאה לתוכן רגיש. |
| 403 | `advanced_required` | שינוי זה דורש הרשאה לעריכה מתקדמת. |
| 403 | `locked_block_changed` | חלק נעול שונה. אפשר לשנות אותו רק בעריכה מתקדמת. |
| 403 | `delegation_off` | שמירה עבור משתמש זה אינה מופעלת בהגדרות רכיב החיבור. |
| 403 | `not_ha_admin` | עריכה מתקדמת זמינה רק למנהלי תשתית המערכת. |
| 404 | `item_not_found` | הפריט לא נמצא. |
| 404 | `trash_not_found` | הפריט אינו בסל המחזור (ייתכן שפג תוקפו). |
| 409 | `item_changed` | הפריט שונה במקום אחר. טענו את הגרסה העדכנית והחליטו מה לשמור. |
| 409 | `confirmation_required` | פעולה זו דורשת אישור מפורש. |
| 409 | `feature_disabled` | האוטומציות כבויות בהגדרות המערכת. |
| 422 | `validation` | ערך לא תקין — {field}: {what} |
| 422 | `ha_validation` | תשתית המערכת דחתה את ההגדרה: {what} |
| 422 | `action_not_allowed` | הפעולה אינה מותרת כאן. |
| 422 | `code_not_allowed` | אסור לשמור קוד בתוך אוטומציה, סצנה או סקריפט. |
| 422 | `use_schedule` | פעולה בשעות קבועות נוצרת בתזמונים. |
| 422 | `not_editable` | פריט זה מוגדר בקובץ תצורה או במכשיר ואינו ניתן לעריכה כאן. |
| 422 | `masked_values` | הפריט כולל ערכים חסויים; ערכו אותו בתשתית המערכת. |
| 429 | `rate_limited` / `run_too_soon` | יותר מדי שינויים ברצף; נסו שוב בעוד רגע. / הפריט הורץ ממש עכשיו; נסו שוב בעוד כמה שניות. |
| 502 | `config_refused` | תשתית המערכת דחתה את השינוי. (`details.error` = bridge code) |
| 503 | `config_api_unavailable` / `ha_unavailable` | עריכת אוטומציות אינה זמינה כרגע. / תשתית המערכת אינה זמינה כרגע. |
| 503 | `bridge_not_paired` / `bridge_too_old` | existing / נדרש עדכון של רכיב החיבור כדי לשמור אוטומציות. |
| 504 | `config_timeout` | תשתית המערכת לא ענתה בזמן; ייתכן שהשינוי נשמר. רעננו לפני ניסיון נוסף. |

## 4. Bridge 0.6.0 — `smplwise_bridge.config_item` (SupportsResponse.ONLY)

```json
{ "user_id": "<ha user id>", "op": "upsert", "request_id": "<op id>", "kind": "automation",
  "item_id": "1727712345678", "base_revision": "9f2c0d1e4b7a6c35", "profile": "builder",
  "config": { "id": "1727712345678", "alias": "…", "description": "", "triggers": [], "conditions": [], "actions": [], "mode": "single" },
  "preserved": ["<fingerprint>", "…"], "sensitive": false,
  "variables": null, "skip_condition": null, "ts": 1790000000, "nonce": "…", "sig": "…" }
```

| op | Needs | Effect |
|---|---|---|
| `upsert` | kind, item_id, config, base_revision (null = create; the id must not exist), profile, preserved | write file + reload + wait for entity |
| `delete` | kind, item_id, base_revision | remove from file + registry entry |
| `enable` / `disable` | item_id (automation) | `automation.turn_on/off` with Context(user) |
| `trigger` | item_id, skip_condition, variables? | `automation.trigger` with Context(user) |
| `run_script` / `stop_script` | item_id, variables | `script.turn_on` / `turn_off` with Context(user) |
| `apply_scene` | entity_id | `scene.turn_on` with Context(user) |
| `snapshot_scene` (slice C) | entity_ids | `scene.create` (`snapshot_entities`) / `scene.delete` of `arx_undo_*` only |

Checks, in order (independent of the add-on): signature, replay window, active HA user · op allow-list · `upsert`/`delete`:
`user.is_admin`, or the options-flow switch `delegated_authoring` is on **and** `profile == "builder"`; `profile == "advanced"`
always needs `is_admin` · `config_policy.py` (dependency-free, by path in tests): top-level keys per kind, typed block schemas,
the builder service allow-list (⊂ `ALLOWED_SERVICES` ∪ the CR §9.1 additions), argument specs, no secret-like key and no `code`
at any depth in authored blocks, `sensitive` flag consistency, for `builder`: every block outside the typed schemas must have its
fingerprint in `preserved` **and** in the stored item (so a delegated user can keep but never author them) · under the write
lock: stored revision == `base_revision` else `stale` · HA validation (`async_validate_config_item`) → `ha_invalid` with the
message path · backup ring (10) · atomic write, re-read, verify · reload, wait ≤ 5 s for the registry entry → `loaded`.
Runtime ops: the target entity's registry platform is `automation`/`script`/`homeassistant`(scene) or an integration scene for
`apply_scene`.

Response: `{ok: true, request_id, context_id, revision_before, revision_after, entity_id, loaded}` or `{ok: false, request_id,
error, path?}`; errors `bad_signature|stale|replay`, `unknown_user`, `op_not_allowed`, `not_ha_admin`, `delegation_off`,
`invalid_payload`, `service_not_allowed`, `argument_not_allowed`, `code_not_allowed`, `secret_not_allowed`,
`preserved_mismatch`, `sensitive_flag_mismatch`, `stale`, `exists`, `not_found`, `ha_invalid`, `write_failed`, `unauthorized`,
else the exception class name. Never logged: config values, variables, template text. Other bridge files: `const.py` VERSION
0.6.0 + `SERVICE_CONFIG_ITEM`, options flow (`delegated_authoring`, default false), `services.yaml`, `strings.json`,
translations, unload, README. `execute`, `schedule`, `set_entity_area`, `ALLOWED_SERVICES` unchanged.

## 5. The fake (`smplwise_vms/backend/tests/fake_ha_config.py`)

`FakeHaConfig(installed=True, config_api=True, include_loaded=True, now=callable)`: `automations` (list), `scripts` (dict),
`scenes` (list), `states`, `registry`, `traces`, `events`, `calls`, `fail_next`. REST `rest(method, path, body)` with HA's codes
and messages (GET unknown 404 "Resource not found", DELETE unknown 400, POST upsert, "Message malformed: …" from a small
validator that rejects unknown trigger/action types and bad keys, `{"result":"ok"}`), reload semantics (`automation.reload {id}`
one item; `script.reload` diff; `scene.reload` all), registry removal on delete. WS `ws(msg)`: `get_states`,
`config/entity_registry/list`, `automation/config`, `script/config`, `trace/list`, `trace/get`, `validate_config`,
`get_services`, label/category/floor lists, subscriptions for §6 events. `bridge_config_item(signed, secret, delegated=False,
is_admin=True)` mirrors §4 on the same state. Seed `seed_probe_like()`: synthetic Hebrew aliases ("תאורה בכניסה", "מזגן
חדר שינה") reproducing the probe's distribution (new keys only, one legacy item, state/time/time_pattern/template/device/HA
start and one purpose-specific trigger, choose/if, trigger ids, all modes, custom `scheduler.*`/`shell_command` services, an
alarm arm, notify, a missing entity, a YAML-managed item, a no-id item, 20 integration scenes, 3 scripts one with fields).
No private data. `frontend/tests/fixtures/automations_fake_ha.py` wraps it for the live spec (the `devices_fake_ha.py` pattern).

## 6. Events

Server → client `HaPush` `{type: "automations_changed", kinds: ItemKind[], ids: string[]}` (ids of visible items only; empty =
refetch). Sources (CR §12): `automation_reloaded`, `scene_reloaded`, `automation_triggered`, `script_started`,
`entity_registry_updated`, `state_changed` of the three domains, the 10-minute pull, Arx's own writes.

## 7. Parallel work plan

All agents branch from the architecture branch (or `g0/intake` after it merges). Python
`C:\cloude\smplwisebms\.venv\Scripts\python.exe`, pytest workers=1, targeted files only; Node per CLAUDE.md with a
`node_modules` junction to `C:\cloude\smplwisebms\frontend\node_modules`. Nobody bumps versions or edits CHANGELOG,
`management/*`, `contracts/API_INVENTORY.md`, this document or the S0 client. `bash C:/cloude/smplwisebms/secrets/scan_staged.sh`
before every commit; never read `secrets/` or `private-evidence/`; no HA, lab or device contact (phase 0 is the coordinator's,
with the owner's approval for W-1/W-2). Model: Sonnet for S1-S4 (Fable/Opus for S2's writer if the review asks); Opus reviews
the write path before the merge.

### P0 — decisions, mockup, S0 client (coordinator + design agent, 8-12 h)

Owner answers; static mockup in `docs/design/mockups/automations/` (UniFi-style mandate, v2 tokens, 1440/820/390: list, detail
drawer, builder with typed and locked blocks, template gallery, scene capture table, script runner with fields, "למה זה רץ",
read-only states, conflict banner); `frontend/src/api/automations.ts` + `automations-mock.ts` (mock seeded like §5).

### S1 — backend service (`pilot/CR017-s1-backend`), 34-42 h

```
Goal: CR §4.6, §6.1, §6.3, §7, §8.1, §9.4-§9.7, §10-§12 and this contract §2-§3, §6.
Owns: routers/automations.py; services/automations.py (mirror, status, list/detail, catalog, capture, runs from traces,
  storm guard, review), services/automation_ops.py (create/replace/advanced/delete/copy/enable/run/apply, trash, versions,
  idempotency, audit), services/automation_scope.py (visibility, change/run rights, per-caller locking);
  migrations/0045_automations.sql (+0046 only if grants need data); tests/test_automations_api.py, _scope.py, _mirror.py,
  _trash_versions.py, _runs.py; frontend/tests/fixtures/automations_fake_ha.py (last milestone).
Touches (sole editor): main.py, roles.json, routers/access.py, role-catalog.design.json, routers/settings.py (4 keys),
  services/ha_sync.py (ATTR_ALLOW, subscriptions), services/ha_client.py (call_bridge_config_item, config GET),
  services/device_bulk.py (none expected; verify script/scene stay NEVER_BULK).
Interfaces: model/policy/sentences from S2 by import (stub them from §2 until S2's M1 lands, ~day 1).
Done: every route and §3.3 code tested against fake_ha_config; visibility before filters/counts; 409/CAS; trash + restore with
  the same id; no secret-like value in any answer or audit row; + test_access, test_migrations, test_ui_settings, test_devices,
  test_schedules_api (boundary) green.
```

### S2 — model, sentences, policy, fake, bridge 0.6.0 (`pilot/CR017-s2-model-bridge`), 32-40 h

```
Goal: CR §3.3 (probe extension), §6.2, §8.2-§8.3, §9.1-§9.4, §13 fake; this contract §2.1-§2.2, §4, §5.
Owns: services/automation_model.py (read/write blocks, legacy normalisation, raw-preserving writer, fingerprints),
  services/automation_text.py (Hebrew sentences: triggers, conditions, actions, whole item; golden files),
  services/automation_policy.py (classes, allow-list, arg specs, sensitive, secret masking, loops/cycles, use_schedule);
  tests/fake_ha_config.py + seed; integration/smplwise_bridge/config_policy.py, config_store.py (writer, lock, backups,
  CAS, reload + wait), config_item service in __init__.py, options flow, const/manifest 0.6.0, services.yaml, strings,
  translations, README; scripts/automations_probe.py additions (U-1..U-10 read-only; --write-check opt-in, throwaway ids);
  tests test_automation_model.py (round-trip on every seed item), test_automation_text.py, test_automation_policy.py,
  test_bridge_config_policy.py, test_bridge_config_store.py (temp dir), test_bridge_config_drift.py (bridge allow-list ==
  add-on policy, ⊂ ALLOWED_SERVICES).
Milestones: M1 (first) model + policy + fake + seed; M2 sentences; M3 bridge; M4 probe.
Done: write(read(c)) == c for every seed item; no secret or code survives in authored blocks; writer output equals HA's key
  order; delegation off → non-admin refused; test_bridge_install, test_release_check green.
```

### S3 — frontend lists, detail, runners, settings (`pilot/CR017-s3-lists`), 26-32 h

```
Goal: CR §4.1, §4.2.5-§4.2.6, §4.3 (activate + capture table + save), §4.4 runner, §4.6 states; settings page; trash/versions.
Owns: screens/devices-automations.ts (tab + segmented control), screens/automation-drawer.ts (detail, runs/why, versions,
  actions), components/sw-automation-card.ts (<automation-card .item>), screens/scenes-panel.ts (grid by area, activate,
  favourites, capture table <scene-capture>), screens/scripts-panel.ts (runner, <script-fields-form>),
  screens/system-automations.ts (settings, delegation state, review list, trash); specs unit-automations-list.spec.ts,
  evidence-automations-list.spec.ts (demo; 1440/820/390; loading/empty/error/ready/view-only/yaml/invalid/running; RTL).
Touches (sole editor): shell/nav.ts (tab gating), shell/sw-app.ts (routes #/devices/automations[/…], #/system/automations),
  api/ha.ts (HaPush automations_changed).
Done: no HA/YAML names on operator screens; no hints/paragraphs (clean operator screens); tsc clean; specs run and reported.
```

### S4 — frontend builder and editors (`pilot/CR017-s4-builder`), 34-42 h

```
Goal: CR §4.2.1-§4.2.4, §4.4 editor, §4.5, §5 handoff, conflict banner, unsaved guard, phone variant.
Owns: screens/automation-builder.ts (כאשר / אם / אז sections, live sentence via preview, mode/max), components/
  sw-block-card.ts (typed + locked cards, drag/keyboard reorder), screens/automation-block-forms.ts (one form per typed
  block), screens/automation-entity-picker.ts (floor → area → device, search; reuses schedule-entity-picker patterns),
  screens/automation-templates.ts (gallery; schedule targets open CR-014's create dialog by tag), screens/script-editor.ts
  (fields + sequence reuse), screens/automation-advanced.ts (YAML text editor, path-mapped errors, JSON fallback);
  specs unit-automation-builder.spec.ts, evidence-automation-builder.spec.ts.
Touches: shell/sw-app.ts one import line after S3's.
Done: every typed block round-trips through the form unchanged when untouched (raw preserved); locked blocks visible, movable,
  deletable, never editable without can.advanced; use_schedule handoff; tsc clean; specs run and reported.
```

### 7.1 Merge order, review, shared files

1. **S2** → 2. **S1** → 3. **S3** → 4. **S4**, then the **Opus review of the write path** (automation_ops, automation_scope,
automation_policy, the bridge's config_policy/config_store/delegation, ha_client) with fixes by S1/S2, then the live spec against
the fake (4-6 h, coordinator), then phase 0 W-1/W-2 on the lab with the owner's approval, then the release round. Frontend branches
work on the mock and are harmless early (the tab is gated on `automation.view`, which no role holds until S1).

| Shared file | Sole editor |
|---|---|
| `roles.json`, `routers/access.py`, `role-catalog.design.json`, `routers/settings.py`, `main.py`, `migrations/` | S1 |
| `services/ha_sync.py`, `services/ha_client.py` | S1 |
| `integration/smplwise_bridge/*`, `scripts/automations_probe.py` | S2 |
| `frontend/src/shell/nav.ts`, `frontend/src/api/ha.ts` | S3 |
| `frontend/src/shell/sw-app.ts` | S3 + S4's one import line |
| this document, `frontend/src/api/automations*.ts` | coordinator |

### 7.2 Effort, critical path, calendar

| Item | Agent-hours |
|---|---|
| P0 decisions + mockup + S0 client | 8-12 |
| S1 backend service | 34-42 |
| S2 model, sentences, policy, fake, bridge 0.6.0, probe | 32-40 |
| S3 lists, detail, scenes, scripts, settings | 26-32 |
| S4 builder, templates, script editor, advanced editor | 34-42 |
| Opus review + fixes, live spec, phase 0 (incl. W-1/W-2) | 12-18 |
| **Total slices A + B** | **146-186** |
| Slice C (try-with-undo, typed device triggers, area/floor targets, labels writes, storm auto-disable) | +24-32 |

Slice A alone (see and run, no config writes) is about 40 % of this (≈ 60-75 h) and can ship first.

**Calibration.** CR-015: a 92-116 agent-hour estimate took about 2.5 hours of wall-clock with four parallel agents (contract
22:30 → review fixes 00:46). Agent-hours are nominal effort; the calendar is set by the owner's decisions and reviews, the lab
write checks that need his approval, live rounds on his systems and the release rhythm (one or two release rounds a day, on his
word). The probe shrank the risk: all 42 automations are UI-managed, new-schema, small, with no blueprints.

| Case | Calendar (4 parallel Sonnet agents + integration + Opus review) | Assumes |
|---|---|---|
| **Best** | **2 working days**: day 1 decisions + mockup + S0 + S1-S4; day 2 review, fixes, W-1/W-2 on the lab, one release round for A + B | recommendations adopted, first mockup accepted, the writer matches HA's format first time |
| **Likely** | **4-6 working days**: slice A released on day 2-3; slice B after one mockup revision, the lab write checks and one live round on the owner's systems (2-5 fixes: sentence wording, key order/format, reload timing, a template block) | normal review cycles |
| **Worst** | **9-12 working days (≈ 2 weeks)** | delegation needs a security-review round and a CR against `docs/security/`; the bridge writer disagrees with HA on a real file and is replaced by another write path; scope grows into typed device triggers for the wall-switch buttons, purpose-specific triggers or blueprints |

Honest reading: the owner's "about two weeks" is the worst case. The core builder with safe writes is likely done within a
working week; what stretches it is not coding but decisions, the security exception of CR §8.3 and live verification.

### 7.3 Definition of done (every agent)

Targeted tests actually run and reported (NOT_RUN is not PASS); UI evidence at 1440/820/390 and loading/empty/error/ready; no HA
names on operator screens; no secrets, lab data or private evidence in fixtures; Hebrew sentences reviewed against the golden
files; commit on the agent's own branch with the CLAUDE.md trailer; a closing report per AGENTS.md.
