# V1-REMAINING-2406 - the 25 open V1 cards: classification, recorded evidence, the activation runbook built

Branch `pilot/V1-REMAINING-2406` from `origin/release/2405-train` @ `a8e1ef724` (the 2.40.5 UI rebuild on top of `eadc5b080`; nothing
else between them). Registry, one operations document and one backend test. No runner, lab, device, HA, WisKey or browser run; no
acceptance test marked PASS. `management/test_catalog.json` is not touched (three catalog-sweep agents own it this round) and T005 is
not touched (its own audit is running).

## 1. Method

`scripts/progress.py` counts a card when its status is DONE or one evidence line carries an exact implementation marker; a
`commit <sha>` counts only when the commit is not annotated "not on origin/main". `progress.py --cards` on the base listed 25 open V1
cards (V1 330 of 355). For each card: the card, its dependencies and its evidence; `docs/changes/BOARD-HYGIENE-2403.md` (its table and
section 4.4, which already named nine of these cards as "release lines carry no `commit <sha>`") and `docs/changes/BOARD-RULE-2404.md`;
then `git log origin/main` / `git merge-base --is-ancestor` / `git tag --contains` for every commit the card names or its change record
implies (owner rule: check git before building).

Classes: **SHIPPED-UNRECORDED** (on origin/main in a tagged release, the evidence lacks a counting `commit` line), **BUILDABLE-NOW**
(no lab, owner decision or WisKey needed), **LAB**, **OWNER-DECISION**, **WISKEY**, **CHAIN** (blocked only by the T005 / T006 chain).
No open V1 card is CHAIN: none of the 25 depends on T005 or T006 (WXG1 depends on WXG0, WXH4 on WXH2 / WXH3, the display cards on
shipped cards).

## 2. The 25 cards

| # | Card | Status before | Class | Evidence / reason | Done here |
|---|---|---|---|---|---|
| 1 | T098 - multimedia screens and remote (CR-015) | REVIEW | SHIPPED-UNRECORDED | release 0.1.149 = 4de4b740d (merges 80b68ca45, 2e10257a8, eddee06e8, ef9d7ef82); first tag v2.7.2 | `commit` line; still open inside: brand behaviours live (LAB), map-card TV control (OWNER) |
| 2 | WXG0 - merge the WX3 gate tool | BACKLOG | OWNER-DECISION | the tool (origin/pilot/WX3-hmac-rotation @ ef18041ce) checks a WisKey SOURCE folder under the 2026-10-05 rule "WisKey packages nothing"; since WISKEY-MANAGED-INSTALL-2382 Arx installs a WisKey-built bundle checked byte-exact against `MANAGED_MANIFEST.json` behind the Core provenance gate. BOARD-HYGIENE-2403 already asked whether it is still wanted | "Open:" line; question 1 |
| 3 | WXG1 - impact block, exit 5, gate:allow | BACKLOG | OWNER-DECISION + WISKEY | follows WXG0; the `arx-impact/1` block must be authored by WisKey for every candidate | "Open:" line |
| 4 | WXH4 - fresh-key re-pair, emergency revocation | BLOCKED | OWNER-DECISION | six owner decisions, asked in the WXH-LEFTOVERS-2405 report (`docs/changes/WXH-LEFTOVERS-2405.md` section 8 on its branch), plus a bridge release | nothing (not re-asked here) |
| 5 | GATEAUDIT-297 - gate audit and cleanup | REVIEW | SHIPPED-UNRECORDED | merge df8547fc2 into 2.24.0 (27834e8ba, 781cc523d, a06719d44, 344b9f054); tag v2.24.0 | `commit` line |
| 6 | PLAYBACK-SCRUB-2341 - smooth scrubbing | REVIEW | SHIPPED-UNRECORDED | 24ac00bfe; tag v2.34.1 (the line said "merged at 24ac00bfe" without the `commit` word) | `commit` line |
| 7 | MOBILE-APP-SERVER-295 - phone-app server side | REVIEW | SHIPPED-UNRECORDED | c9193b6e8 (v2.14.0); 070872563 / merge 2948baa00, attestation 37a4c08d6 (v2.19.0) | `commit` line; real phone NOT_RUN stays (LAB) |
| 8 | REAL-TV-SESSION-2380 - real-TV runbook and joint session | BLOCKED | LAB (+ owner question Q2) | the runbook is on docs/TV-RUNBOOK-2380 @ f953e4fa0, not merged; the joint session with a TV is the lab part | nothing; question 2 |
| 9 | CAST-FIRST-TEST-2380 - first physical cast | BLOCKED | OWNER-DECISION + LAB | a device action: one camera to one lab TV needs the owner's approval (Q9) | nothing; question 3 |
| 10 | WISKEY-VISITS-2400 - visits and guest templates | BACKLOG | OWNER-DECISION | question Q6 (recommendation a: Arx's own visitors flow only) | nothing; question 4 |
| 11 | WISKEY-SVC-GRANT-2400 - service-write grant path | BLOCKED | WISKEY | WisKey has no writer for `native_service_grants_v1` on a manual install (Q-WK-4) | nothing |
| 12 | WISKEY-ACTIVATION-RUNBOOK-0411 - activation ladder | REVIEW | BUILDABLE-NOW | the ladder existed only as a gitignored session sheet (private handoff package), so no commit could count | **built**: section 3 |
| 13 | WISKEY-LISTEN-2410 - listen without talk | BLOCKED | WISKEY | no listen downlink from WisKey (Q-WK-5); `listen_no_downlink` in "מצב WisKey" | nothing |
| 14 | WISKEY-EMERGENCY-LOCK-2410 - emergency LOCK | BLOCKED | WISKEY | `emergency_secure_unsupported_v1` (Q-WK-7); `lock_supported = False` | nothing |
| 15 | WISKEY-RING-STATION-2410 - ring a station | BLOCKED | WISKEY + LAB | no ringing command in WisKey; device investigation (Q-WK-6) | nothing |
| 16 | BRIDGE-UPDATE-LISTENER-2401 - bridge 0.10.4 | REVIEW | SHIPPED-UNRECORDED | 61d8f1794 now on origin/main; tag v2.40.1 (0e8c3109b) | `commit` line |
| 17 | WALL-PHONE-TOOLBAR-2401 - phone wall toolbar | REVIEW | SHIPPED-UNRECORDED | 4d4fdeb7d; v2.40.1 | `commit` line |
| 18 | SETTINGS-INTERCOM-CARDS-2401 - intercom settings cards | REVIEW | SHIPPED-UNRECORDED | b8afa129a; v2.40.1 | `commit` line |
| 19 | RELEASE-2401-TRAIN - release 2.40.1 | REVIEW | SHIPPED-UNRECORDED | version commit 604305354; v2.40.1 | `commit` line |
| 20 | WISKEY-ADDENDUM-GAPS-0411 - addendum for WisKey | BLOCKED | OWNER (forward) then WISKEY | the addendum is written (private planning); the owner forwards it | nothing; question 5 |
| 21 | OWNER-LAB-ACTIONS-0411 - owner lab steps | BLOCKED | LAB (owner actions) | eight owner steps on the lab installation; Arx has no write permission | nothing |
| 22 | VIDEO-2403 - no video-policy read without live video | IN_PROGRESS | SHIPPED-UNRECORDED | merge 818e2a7d4; v2.40.3 (dbb9e18a5) | `commit` line; IN_PROGRESS -> REVIEW |
| 23 | SKIN-QA-2403 - the 2.40.1 / 2.40.2 surfaces in every skin | IN_PROGRESS | SHIPPED-UNRECORDED | merge 41d8a2e72; v2.40.3 | `commit` line; IN_PROGRESS -> REVIEW |
| 24 | BOARD-HYGIENE-2403 - board hygiene | IN_PROGRESS | SHIPPED-UNRECORDED | merge dc142795c; v2.40.3 | `commit` line; IN_PROGRESS -> REVIEW |
| 25 | HA-2026-11-COMPAT-2404 - HA 2026.11 names | IN_PROGRESS | SHIPPED-UNRECORDED | merge ab9416e09; v2.40.4 (eab715e53) | `commit` line; IN_PROGRESS -> REVIEW |

Totals: SHIPPED-UNRECORDED 12, BUILDABLE-NOW 1, OWNER-DECISION 5 (WXG0, WXG1, WXH4, CAST-FIRST-TEST-2380, WISKEY-VISITS-2400),
WISKEY 4 (WISKEY-SVC-GRANT-2400, WISKEY-LISTEN-2410, WISKEY-EMERGENCY-LOCK-2410, WISKEY-RING-STATION-2410), LAB 2
(REAL-TV-SESSION-2380, OWNER-LAB-ACTIONS-0411), owner-forward 1 (WISKEY-ADDENDUM-GAPS-0411), CHAIN 0. Several cards carry a second
class (noted in the table); each is counted once, under what unblocks it first.

The four IN_PROGRESS -> REVIEW moves follow the board's convention (BOARD-HYGIENE-2403: released work = REVIEW; the dependency rule
of BOARD-RULE-2404 is met trivially, none has a dependency). Each new line keeps the card's NOT_RUN statements and says the formal
acceptance record is still to be written.

## 3. Built: WISKEY-ACTIVATION-RUNBOOK-0411 (commit 443476275)

Why it is the one buildable card: its deliverable is a document, and the document existed only in the private handoff package
(`SESSION_2026-11-04/02_WISKEY_ACTIVATION_HE.md`, gitignored, dated for one session, with lab numbers and backup paths), so the card
could never carry evidence. The repository copy is generic and checked against the build.

- `docs/operations/WISKEY_ACTIVATION_RUNBOOK.md`: rules of the session; preflight (HA full backup, encrypted Arx backup, versions, the
  managed-install switch, the bridge key); seven steps in the acceptance's order - door map, media provider, signed pairing check,
  station video / talk, listen, station acceptance run, door windows / emergency - each with the screen and route, what it writes, the
  expected "מצב WisKey" rows / reason codes / pairing lines, what to watch, rollback and the exact approval wording; the never list;
  rollback levels R0-R4; a record sheet. Updated to 2.40.5 against the private sheet (written for 2.38.x): the media join starts
  at runtime (WISKEY-JOIN-LIVE-2382, no add-on restart), the signed check and "מצב WisKey" exist, the listen and live-validation steps
  were added, and the browser-console PATCH path for builds without the provider row is gone. Physical actions (talk, listen session,
  door pulse, emergency) stay outside the ladder, each needing its own approval naming one station or door.
- `smplwise_vms/backend/tests/test_wiskey_activation_runbook.py`, 16 cases. The doc's `json activation-ladder` block is checked
  against the code: step order = the acceptance's ladder; every setting key a literal in the backend; every status row in
  `wiskey_feature_status.ROWS` with its Hebrew label quoted in the prose; every reason code in `wiskey_feature_status.R`; every
  pairing line in `wiskey_pairing.LABEL` with its label quoted; the acceptance checks equal `wiskey_live_validation.CHECKS` and the
  result words equal its `STATUS_TEXT`; every route and Hebrew UI label present in `frontend/src`; every approval written in the
  steps and unique; the quoted join log line equal to the backend's; a leak scan (IPv4 outside loopback / RFC 5737, MAC, hex of 32+
  characters, `/share/`, `private-evidence`, `/tmp/`, bearer / JWT shapes) with a self-test of its samples.

Test run (workstation, `C:\cloude\smplwisebms\.venv`, explicit file):
`python -m pytest -q -p no:cacheprovider tests/test_wiskey_activation_runbook.py` -> 16 passed. Mutation check, run once by hand
on a temporary copy of the doc: a misspelled reason code, setting key and route, a changed approval wording, a dropped acceptance
check and an inserted private address - each made its test fail (6 of 6 caught).

Known limits: the runbook is NOT_RUN (no session ran it); HA screen names (Backups) are written from general knowledge; the
Hebrew session sheet for the next joint session still has to be derived from it with the lab's own numbers (private). The acceptance
test entry AT-WISKEY-ACTIVATION-RUNBOOK-0411-1 in `management/test_catalog.json` is not updated here (catalog sweep in progress);
the sweep owners may point it at the new test file.

## 4. Registry

- `management/tasks.json`: twelve `commit <sha> (release X, on origin/main) - 2026-11-06 (V1-REMAINING-2406)` lines (commit
  642c1a3df); the four status moves above; "Open:" lines on WXG0 / WXG1; an in-flight `commit 443476275 (pilot/V1-REMAINING-2406, not
  on origin/main, not released)` line on WISKEY-ACTIVATION-RUNBOOK-0411 (it counts once merged and released, not before).
- `scripts/progress.py`: V1 330 -> 342 of 355 on this branch (overall 434 of 447, 97 %); 343 after the runbook reaches origin/main.
- `scripts/project_status.py --write`: PASS (registry links and dependency graph only).

## 5. Rollback

`git revert` of the three commits: the registry lines and statuses return, the runbook and its test go. No data, code path, device or
setting is touched.

## 6. NOT_RUN

Every live acceptance of the twelve recorded cards (as their own lines say); the runbook in a session; the runner (not used: the
2.40.5 gate held it, and nothing here needs it).

Run on the workstation at the branch tip: `scripts/release_check.py` - every item `[ok]` except
`git tag for this version: v2.40.5 not yet` (the tag follows the owner's approval of 2.40.5, not this branch); RESULT: ready for the
owner's approval. `frontend: tsc --noEmit -p .` - exit 0 (no frontend file changed).
