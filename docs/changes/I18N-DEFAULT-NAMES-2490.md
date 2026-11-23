# I18N-DEFAULT-NAMES-2490 - default names the server stores, made in the creator's language (second pass)

Branch `pilot/I18N-DEFAULT-NAMES-2490`, cut from `origin/pilot/I18N-BACKEND-2490` at `bd8fad7b7`. Target 2.49.0.

Owner decision Q15 / N53 = b ("translate at creation", not the recommended option): a default name or title the SERVER writes into
stored data is made in the interface language (`ui.lang`) of the user whose request creates it. Already-saved names are not migrated.
A name made with no requesting user (a background pass, a rule) stays Hebrew. Hebrew output is byte-identical for Hebrew users.

The mechanism is the one I18N-EN-2490 added: `services/default_names.py` (`lang_of(conn, principal)`, `name(key, lang, **values)`,
the he / en `TEXTS` catalogue whose Hebrew is the old literal). It is the right tool here rather than `i18n.Msg` / `localize`: a `Msg`
written to the database is its Hebrew string from then on (i18n.py rule 2), while a default name has to be made in the creator's
language before it is written. The one gallery that serves defaults on a read (the automation templates) also goes through
`default_names`, because its `_out` edge would only localize `Msg`s and the template strings were plain Hebrew.

## 1. Inventory (backend `smplwise_vms/backend/smplwise/`, line numbers at this branch's head)

Method: a tokenizer pass over every `.py` under `smplwise/` listing each string literal / f-string part with a Hebrew letter (9,322
lines, docstrings excluded), then three filters - literals within 6 / 15 lines of an `INSERT` / `insert_*(` / `UPDATE ... SET name`,
literals in `name|title|label|alias = / : / or "..."` positions, and the constants they flow from (`*_NAME`, `*_LABEL`, `DEFAULT_*`,
galleries of `(id, name, icon, ...)`) - each hit read in context. Error / refusal texts, notification texts and display catalogues
(I18N-BACKEND-2490's scope) were not counted.

### 1a. Translated at creation in this branch (5 creation paths, 42 Hebrew literals: 1 + 2 + 1 + 22 + 16)

| # | where (file:line) | default written | stored as | created by | English |
| --- | --- | --- | --- | --- | --- |
| 1 | `services/plan_geometry.py:185` `new_document` (Hebrew constant `DEFAULT_LEVEL_NAME`, :35) | `מפלס ראשי` | the level name of a new structure; stored with the editor's first save, or by calibrate / detect-accept / DXF and IFC import that start from it | the editor's read / write routes: `routers/plan_geometry.py:224,388,569,637,682,738,779`, `routers/plans.py:710`, `routers/plan_ifc.py:107`, `routers/plan_package.py:76` pass `dn.lang_of(conn, principal)` to `geometry_store.working_doc` (`services/geometry_store.py:110`) | `Main level` |
| 2 | `services/autosync.py:58` `ensure_recorder`; `routers/cameras.py:46-49` `_ensure_recorder` | `NVR ראשי` | `recorders.name` of the first recorder (`nvr-1`) when its row does not exist yet (`ON CONFLICT` never renames) | manual camera registration `routers/cameras.py:285`; saving an NVR connection `routers/nvr_connection.py:513`; recorder PATCH / remove before the first discovery `routers/recorders.py:287,333`. The background discovery (`autosync.py:141`) passes no language: Hebrew | `Main NVR` |
| 3 | `services/camera_sources.py:513` `_ensure_standalone_recorder` (Hebrew constant `STANDALONE_NAME`, :67) | `מצלמות ללא מקליט` | `recorders.name` of the pseudo-recorder that groups the cameras without a recorder, made once by the first such camera | `create_standalone` `services/camera_sources.py:539` (`POST /cameras/standalone`) | `Cameras without a recorder` |
| 4 | `services/plan_dxf_map.py:100-138` `suggest_block`, `:1199` object `label` (word list `BLOCK_WORDS` :35-37 = 21 words, `GENERIC_NAME` :43, library item `name_he`) | `כיסא`, `עצם כללי`, the library's Hebrew item name ... | the `label` of every object imported from a DXF drawing; stored when the person accepts the candidates (`detect/accept`) | `POST /plan-versions/{id}/import-dxf-geometry` `routers/plans.py:709-726` (the language is read before the worker pool, never inside `unlocked`) | the library's `name_en` (Hebrew when an item has none), `default_names.BLOCK_WORD_EN`, `Generic object` |
| 5 | `services/automation_view.py:536-549` `template_defs` (7 templates: name + description, 2 notification texts) | `תאורה בתנועה` ..., `הדלת פתוחה`, `זוהתה נזילת מים` | the gallery draft's `alias` (the automation's name when saved) and the notify step's `message` | `GET /automations/templates` (the editor saves the served draft after review); language `dn.lang_of(ctx.conn, ctx.principal)` at `:523` | `default_names.AUTOMATION_TEMPLATE_EN` / `AUTOMATION_MESSAGE_EN` |

### 1b. Already made in the creator's language by I18N-EN-2490 (13 rows, not touched here)

`routers/zones.py` (`חדר {n}`), `routers/incidents.py` (manual / marker / event / alarm-button titles), `routers/cases.py` (route case
title, imported case title), `services/generator_core.py` (`גנרטור`), `services/door_conversion.py` (door window name + note),
`services/schedule_ops.py` (split name), `services/automation_blueprints.py` (template alias), `services/tickets/intake.py`
(approved request title), `routers/nvr_write.py` (`ערוץ {n}` written to the NVR). See docs/changes/I18N-EN-2490.md section 5.

### 1c. Reviewed and left Hebrew on purpose (30 sites)

No requesting user (a background pass, a rule, a system actor) - stays Hebrew by the rule:
- `services/calendar_sync/engine.py:40,331` `(ללא כותרת)` and `:367` `מיומן חיצוני` - external calendar sync;
- `services/tickets/create.py:178` `SYSTEM_NAME = "מערכת"` - the system actor's name on rule-created tickets (`rule_engine.py:218,237`);
- `services/scenarios.py:374` `תרחיש: {name}` - ticket title of a scenario run;
- `services/autosync.py:141` - the discovery pass's `ensure_recorder` (no language: `NVR ראשי`);
- `services/recorders/provision_isr.py:505,511` `ערוץ {n}` - channel discovery;
- `services/demo_mode.py:132,140` `מבנה ראשי`, `מקליט לדוגמה` - the demo world's seed data.

Installation defaults (settings seeded once, not made by one person's request):
- `services/intercom_messaging.py:100-104` the three default message templates;
- `services/notices/model.py:141-143` the news feeds (proper names of Hebrew publications).

Compared later (a per-user language would break the comparison):
- `services/access_external.py:183`, `services/access_grants.py:2304` `אורח` - re-derived and digest-checked (as I18N-EN-2490);
- `routers/cases.py:483` the case tag `מסלול מוצע` - a matched tag;
- `services/tickets/rfq_orders.py:388,424` `מועד עבודה: ` ... - generated description lines that `refresh_order_lines` finds again by
  their Hebrew prefix.

Not stored (display fallbacks / read-time text; owned by the screens' or I18N-BACKEND's catalogues):
- `routers/events.py:411` `קיבוץ ידני` (manual event group label, computed per read);
- `services/shared_spaces.py:41,590` `רצפה בקומה {n}` and `:616-617` upper / lower level labels (attached on read, stripped before storage);
- `routers/recorders.py:153`, `services/nvr_settings.py:85` `NVR ראשי` (fallback when no row exists);
- `services/camera_sources.py:922` `מצלמה {n}` (notification param);
- `services/media_model.py:364` media zone names; `services/geometry_store.py:536` `קומה אחרת`; `routers/generator.py:194` `ללא שם`;
- `services/plan_dxf_map.py:176` `catalog_choices` and `:451` the mapping step's block suggestions (the stored label is made at import, row 4).

System notes, not names (candidates for a later pass, see question 1):
- `routers/cases.py:492,499` the route case's event notes (`נקודת המוצא של המסלול המוצע`, `השערת מסלול · ...`);
- `routers/plans.py:442` the restored version's notes `שחזור של גרסה שפורסמה ב־...`;
- `services/geometry_store.py:303`, `services/plan_geometry.py:954,956,965` the structure's uncertainty notes after a copy / crop change.

Copy names: there is no server-made `(העתק)` / `(copy)` suffix. Schedule copy (`services/schedule_ops.py:992 copy(name)`) and
automation copy take the name from the client; the frontend makes it with `tr('{name} (עותק)')` (already English for English users).

## 2. What changed

- `services/default_names.py`: entries `plan.level_main`, `recorder.primary`, `recorder.standalone`, `plan.object_generic`; tables
  `BLOCK_WORD_EN`, `AUTOMATION_TEMPLATE_EN`, `AUTOMATION_MESSAGE_EN`; helpers `block_word`, `automation_template`, `automation_message`.
  Every Hebrew entry is the old literal (the old constants stay and a test pins them equal).
- `services/plan_geometry.new_document(version, asset, lang="he")`, `services/geometry_store.working_doc(conn, version, lang="he")`.
- `services/autosync.ensure_recorder(..., lang="he")`, `routers/cameras._ensure_recorder(..., lang="he")`,
  `services/camera_sources._ensure_standalone_recorder(conn, lang="he")`.
- `services/plan_dxf_map.suggest_block(..., lang="he")`, `map_geometry(..., lang="he")`, `import_geometry(..., lang="he")`, new
  `_item_name(item, lang)`.
- `services/automation_view.template_defs`: name, description, alias and notify messages per the requester's language.
- Every new parameter defaults to Hebrew, so every other caller (and every existing test) is unchanged.

Comparison logic: none changed. No server code compares a stored name with these defaults (checked: `NVR ראשי`, `מצלמות ללא מקליט`,
`מפלס ראשי`, `עצם כללי`, the template names - the level is found by `is_default` / id, the standalone group by its id, templates by
id, imported objects by `item_id`). There is no uniqueness-suffix logic over these names.

## 3. Tests

New `smplwise_vms/backend/tests/test_default_names_i18n_2490b.py` (13 tests): the catalogue (Hebrew = old constants, English has no
Hebrew letters, every block word / template has its English); per creation path, he and en: the new structure's level (unit + editor
route, kept after switching back), the first NVR (route he / en + no rename + discovery pass Hebrew), the standalone group (he / en +
made once), DXF labels (`suggest_block`, `map_geometry`, the import route he / en through accept and read back in the other
language), the automation gallery (he unchanged; en name = alias, messages English).

Tests actually run:

- PC (workstation venv, Python 3.12), targeted: `pytest tests/test_default_names_i18n_2490b.py` - **13 passed**.
  `ruff check smplwise tests/test_default_names_i18n_2490b.py` - clean.
- Server slot B (sharded): see section 4.

## 4. Server runs (slot B)

(filled after the runs)
