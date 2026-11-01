# CR-VSEARCH115 - free-text search in recordings (board item r115)

**Status:** proposed, design only (branch `pilot/VSEARCH115-295`, from `main` @ `320e5555` = v2.12.4). No code, no contact with any Frigate or NVR.
**Builds on:** T063 (`services/semantic.py`, `GET /search/semantic`, `GET /search/providers`), CR-029 (Frigate provider), CR-FRIGATE-CAPABILITY-MATRIX.
**Default:** OFF at every tier except the already-shipped baseline, which stays behind `ai.provider` as today. Migrations: none expected (section 11).

## 1. Goal

An operator types a sentence such as "a person in a red coat in the lobby in the afternoon" (or the Hebrew equivalent) and gets a list of
moments to open in the existing event centre / playback, each with an honest statement of what matched and what could not be checked.
The result is a **lead to footage**, never a statement about who someone is.

## 2. What exists today (verified in the repo at this SHA)

| Piece | Finding |
|---|---|
| T063 baseline | `services/semantic.py` parses a question with a lexicon: object class (person / vehicle / motion / door / line / field), places (zones with `searchable=1`, floors, cameras by alias or source name, scoped to the caller), a time window in the site zone (today, yesterday, morning..night, last hour, week, `HH:MM-HH:MM`). Route `GET /search/semantic?q=&limit=` runs `list_events` per place and type and returns each event with `match.confidence` (`exact` / `partial`) and `basis`. Settings `ai.provider` (`none` / `local` default / `external`, external always refused), `ai.privacy_ack`, `ai.budget_daily`. |
| Gap 1: colour and clothing | Colour words and clothing words (red, coat, bag, hat, face...) are recognised and returned in `unsupported` with the reason "no source produced that metadata". So the example sentence today yields person + lobby + afternoon, and reports "red" and "coat" as unused. |
| Gap 2: no UI | No caller of `/search/semantic` exists in `ui/src` at this SHA (only `tests/test_semantic.py`). Whether a screen exists on another branch: UNKNOWN. |
| Gap 3: Frigate metadata | The Frigate mirror keeps, per review item, `objects`, `zones`, `sub_labels` (`frigate_reviews` + `events.details_json`). It does not keep tracked-object attributes, plates, descriptions or embeddings. The review layer is coarse: one item spans several objects. |
| Frigate features | The adapter already discovers `semantic_search`, `face_recognition`, `lpr`, `genai` from `/api/config` and exposes `features.search_semantic` (and `faces`, `lpr`, `genai`). Reported only, not used. Owner decision recorded in CR-029 / the capability matrix: no face, no LPR, no genai. |
| Frigate routes | The 0.18.2 route list in `tests/fixtures/frigate_openapi_0_18_2_routes.json` contains `/events/search`, `/events/{id}/attributes`, `/events/{id}/recognized_license_plate`, `/recognized_license_plates`, `/sub_labels`, `/faces*`, `/{camera}/search/motion*`. The capability matrix lists search as a gap ("read-only search route, later phase"). `GET_ALLOWED` in `frigate_http.py` does not list `/api/events/search` (to be confirmed when implemented). |
| Hikvision NVR smart events | Arrive as `events` rows (`vmd`, `linedetection`, `fielddetection`...) with `detectionTarget` refining person / vehicle when the device sends it (`events_ingest.py`). No colour, no appearance. |
| Recordings index | `GET /cameras/{id}/recordings` gives coverage per camera; search results link to it, they do not scan video. |
| Licence plates in Arx | Occurrences in door / access code are access-control data, not recording search. Not a source for this feature. |

## 3. What Frigate provides natively (not Arx code)

- Structured filters on `/api/events`: camera, label, sub_label, zone, time window, etc. Arx already reads `/api/events` windowed.
- Frigate 0.15+ semantic search (text-to-image and image-to-image similarity over tracked-object thumbnails, optionally text over generated descriptions) via `/api/events/search`, when `semantic_search` is enabled in Frigate's config. It runs an embedding model inside Frigate: CPU works slowly on the small model, a GPU is recommended for the large one; memory and storage grow with the number of tracked objects. These resource figures come from general Frigate knowledge, not from a document in this repo: **UNKNOWN until read from the owner's instance or a supervised run**.
- Attributes (for example a recognised plate, a face name as sub label) only exist when Frigate's face / LPR / genai features are on. Not on in Arx policy.
- Whether the owner's 0.18.x instance has `semantic_search` enabled: **UNKNOWN** (not re-checked here).
- Whether `/events/search` scores are good enough for a colour query like "red coat" on a hallway camera: **UNKNOWN**; it must be measured before any promise.

## 4. Three tiers

| Tier | What | Needs | Colour / clothing | Cost and risk |
|---|---|---|---|---|
| 1 | **Filter builder over existing metadata.** Extend the T063 baseline: a visible, editable chip bar (object, place, time, severity, source, sub label) built from the parsed sentence; richer Hebrew time and place parsing (section 5); include Frigate `objects` / `zones` / `sub_labels` as filters; show `unsupported` terms as greyed chips ("not searched: red coat"). Deterministic, no model, no network. | UI + small parser changes; no new data. | Not searched; stated plainly. | Lowest. Failure mode is a too-broad result, which the chips make visible. |
| 2 | **Frigate semantic search proxied read-only**, per recorder, only if `features.search_semantic` is true. Arx forwards the already-parsed text (object / zone / time become Frigate filter parameters; the residual words go to the similarity query), re-applies Arx scope to every returned event, and maps hits to Arx events / review items. Allow-list `GET /api/events/search` only (windowed, limited). | Owner's Frigate has semantic search on; Frigate resources (UNKNOWN). | Possible as similarity scores, labelled "visual similarity, not a fact". | Load lands on the owner's Frigate; scores are probabilistic; thumbnails of people reach the browser only through Arx media permissions already in place. No write to Frigate. |
| 3 | **Optional local embedding service** (separate process on the runner or a NAS; thumbnails of tracked objects embedded once; vector index kept locally). | New component, model licence review, storage for vectors, a retention rule for them. | Best coverage of colour and clothing. | Highest: vectors of people images are biometric-adjacent data; a model download and update path; GPU/CPU cost; an `external` cloud provider stays refused (as today). Not recommended before tier 2 is measured. |

Tiers stack: 1 is always the front end; 2 and 3 each add one more "provider" in `semantic.registry()` with the existing declaration (model version, privacy statement, network flag, daily budget, opt-in).

## 5. Hebrew (and English) query parsing rules

Principles: lexicon, never a model; every word is either **used**, **ignored as filler**, or **reported unsupported**; prepositions glued to nouns (ב ל מ ה ו כ ש) are stripped as in T063; the site IANA zone and the request date decide times (ADR-004).

| Dimension | Rule | Examples |
|---|---|---|
| Object | Lexicon to normalized class; Frigate labels (`person`, `car`, `dog`...) mapped to the same classes | "אדם", "אנשים", "רכב", "משאית" -> person / vehicle; "dog" -> label filter if the recorder reports it |
| Place | Whole catalogue name first (exact), then token match (partial); a place name beats a same-word object term; only places the caller may read | "בלובי", "ליד השער" -> zone/camera; "קומה 2" -> floor |
| Day | Relative words resolved in the site zone | "היום", "אתמול", "שלשום" (new), "ביום ראשון" (new, last such day), "בשבוע שעבר" (new), "לפני 3 ימים" (new), explicit date `12.10`, `12/10/2026` (new) |
| Day part | Fixed windows (site-configurable defaults) | "בבוקר" 06-12, "בצהריים" 11-14, "אחר הצהריים" 12-18 (the example sentence), "בערב" 17-23, "בלילה" 22-06 (crosses midnight, belongs to the evening's date) |
| Clock | `HH:MM-HH:MM`, "בין 14:00 ל־16:00", "אחרי 18:00", "לפני 07:30", "בסביבות 15:00" = +/-30 min (new) | |
| Duration | "בשעה האחרונה", "ב־3 שעות האחרונות" (new), "10 דקות אחרונות" (new) | |
| Colour / clothing | Recognised so they are **not mistaken for place names**; searched only if tier 2 or 3 is active; otherwise listed as unsupported | "מעיל אדום", "תיק כחול" |
| Negation / counting | Not supported ("בלי", "יותר מ־3"); reported as unsupported | |
| Ambiguity | Two equally good places -> both are searched and shown as chips the user can remove; a window longer than the cap (section 8) is shortened and the chip says so | |
| Output | Always the parsed form (`objects`, `places`, `window`, `unsupported`, `leftovers`) so the user sees how the sentence was read | |

Example: "אדם במעיל אדום בלובי אחר הצהריים" parses to person, zone "לובי", today 12:00-18:00, and unsupported {"מעיל", "אדום"} at tier 1.

## 6. Privacy

Searching for people by appearance is sensitive and is treated like the event centre's most restricted read.

- **No identification.** No face matching, no plate lookup, no "find this person" by image upload, at any tier. `NOT_IDENTITY` stays in every response. Query text that asks for a name matches no catalogue entry and is reported as a leftover; there is no name index of people.
- **Permission.** New explicit permission (name proposed: `events.search_free_text`), separate from `events.read`, granted to nobody by default; scoped per camera/area through the existing `camera_scope` and floor scope (`map.read`): a camera, zone or floor the caller cannot read is invisible to place matching and to results, so a query cannot reveal that a place exists.
- **Audit.** Each search writes an audit row (`search.free_text`): actor, tier, parsed filters (objects, place ids, window), result count, request id. The raw sentence is stored only if the owner chooses (it may contain a person's name); default = parsed form only, sentence hashed. Opening a result is audited by the existing playback / media audit.
- **Retention.** Query audit rows follow the audit retention already configured. Tier 3 vectors (if ever built) are deleted with the source event, never outlive the event retention, and are never exported or backed up off-box.
- **Data leaving the installation:** none at tiers 1 and 3; at tier 2 only to the owner's own Frigate on the already-configured connection. `external` providers stay refused.
- The existing `ai.privacy_ack` is reused as the acknowledgement that appearance search is on; the user guide states in plain Hebrew what is searched and what is not.

## 7. Permissions

| Action | Permission |
|---|---|
| See the search box and use tier 1 | `events.search_free_text` plus `events.read` on each result camera |
| Use tier 2 | same; the Arx account's existing Frigate read access, no new Frigate permission |
| Configure tier, caps, audit-sentence option | system admin setting |
| Open a result | existing event / playback / media permissions, unchanged |

## 8. Performance limits

- Tier 1: indexed queries only (`idx_events_time`, `idx_events_camera_time`); window cap 7 days per query (a longer request is cut and says so); `limit` max 200 as today; per-place fan-out capped (10 places x 6 types); a 3 s server budget, partial results flagged.
- Tier 2: one Frigate call per recorder per search, windowed and limited (never unfiltered), timeout under the shared `nvr.deadline`, 1 concurrent search per recorder and 6 per minute per user, results cached 60 s per (user, parsed query); a 429 or timeout is a named part failure, not an empty list. Frigate-side cost: UNKNOWN until measured on the owner's instance (supervised, read-only, task-specific approval).
- Tier 3: indexing in the background at low priority, never on the event loop; latency target and index size to be measured, not promised.
- No search scans video files; footage is reached only after the user opens a result.

## 9. Tests plan

Fixture-based, no real device (`fake_frigate.py` gets an `/events/search` stub only in the implementing task).

1. Parser table tests (HE + EN): every row in section 5, midnight-crossing night, DST day, site zone vs UTC, ambiguous place, place name equal to an object word, unsupported colour, empty and over-long input.
2. Scope: a camera / floor the caller cannot read never appears as a place chip nor in results; missing permission = 403 and an audit row.
3. Audit: row written for allowed and denied, parsed form only by default, no sentence text in logs.
4. Tier 2: feature off = tier absent with a clear reason; allow-list test (`non_get == [login]`, `/api/events/search` windowed and limited); results re-scoped; timeout / 429 as part failure; no address, token or Frigate path in any body.
5. Default-off: fresh install shows no search; `ai.provider=none` -> 409 as today.
6. Honesty: every response carries `NOT_IDENTITY`; `unsupported` is never empty when colour words were present.
7. UI (slice S2): desktop / mobile / RTL screenshots, loading / empty / error / ready, chips removable. Real vs fixture marked in the closing report; real Frigate = NOT_RUN until the supervised run.

## 10. Slices

| Slice | Content | Depends |
|---|---|---|
| S1 | Parser v2 (section 5) + permission `events.search_free_text` + audit + window caps; backend only; tests 1-3, 5, 6 | none |
| S2 | UI: search box, chip bar, result list opening the event centre / playback; "not searched" chips | S1 |
| S3 | Tier 2 read-only proxy + allow-list + fake route + tests; supervised read-only measurement on the owner's Frigate (approval needed) | S1, owner answers Q2-Q3 |
| S4 | User guide (HE) page and privacy statement update | S1-S3 |
| S5 (only if the owner decides) | Tier 3 design record, separate CR | S3 measurements |

## 11. Migrations, rollback, known limits

Migrations: none expected (events already carry `details_json`; the audit table exists; permissions are seed data). A result cache, if wanted, is in memory. Rollback: set `ai.provider` to `none` or remove the permission grants; nothing stored needs undoing. Known limits: colour and clothing search does not work at tier 1; Frigate review items are coarser than tracked objects, so a hit means "an alert in that window", not "this exact person"; Hikvision smart events carry no appearance data.

## 12. Owner questions (recommendation first)

1. **Scope of the first release.** (A, recommended) tier 1 only: finish the shipped baseline with UI, richer Hebrew parsing, permission and audit; honest "not searched: red coat". (B) tier 1 + tier 2 together. (C) wait for tier 3.
2. **Is semantic search enabled on your Frigate, and may it be checked read-only?** (A, recommended) yes, allow one read-only look at `/api/config` features plus one windowed `/api/events/search` measurement. (B) no, skip tier 2.
3. **Frigate resources for tier 2.** (A, recommended) accept whatever the measurement shows; Arx caps its own request rate. (B) forbid tier 2 if the instance is CPU-only.
4. **Who may search.** (A, recommended) a new permission, granted to nobody by default; you grant it per role and camera scope. (B) reuse `events.read`.
5. **Audit of query text.** (A, recommended) store parsed filters only, hash the sentence. (B) store the full sentence.
6. **Tier 3.** (A, recommended) not now; decide after tier 2 numbers. (B) design it now.
7. **Colour / clothing expectation.** (A, recommended) accept "not searched" until tier 2/3. (B) hide colour words entirely instead of showing them as unsupported.
8. **Day-part windows** (morning 06-12 ... night 22-06). (A, recommended) keep the defaults, configurable per site later. (B) change them now (state the hours).
