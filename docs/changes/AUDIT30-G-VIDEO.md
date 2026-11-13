# AUDIT30-G-VIDEO - design audit round 30, branch G: video and investigation

Branch `pilot/AUDIT30-G-VIDEO`, cut from `origin/pilot/AUDIT30-BASE` @ `2a6430586` (main v2.43.2 + SYS-AUDIT-QUICKFIX-2437 +
NOSCROLL-1366-2437). Plan: `private/design-system-2026-10-27/round30/system-audit/FIXES.md` sections 0, 1, 8, 13. Frontend only; no
version bump, no CHANGELOG entry, no migration, no backend change, no home screen touched. Files edited are only branch G's
(`screens/live-*.ts`, `investigate-*.ts`, `system-devices.ts`, `i18n/he.ts`); no shared component (branch B), no
`components/sw-live-player.ts` / `system-diagnostics.ts` (pilot/GO2RTC-STREAM-SYNC-2436). The QUICKFIX and NOSCROLL work is kept.

## Owner gates assumed

| Gate | Assumed answer | Used for |
|---|---|---|
| Q10 (finding 15, operator copy) | **א** - translate or remove all of them ("NVR" included) | G2 |

Every other item of branch G is ungated, or waits for branch B (below).

## What changed

| Item | Finding | File | Change |
|---|---|---|---|
| G2 | #15 | `i18n/he.ts` | new section `videoCopy` (recorder words, "מיקומים שמורים", "מפעילים", site time, demo subtitles). |
| G2 | #15 | `investigate-playback.ts` | subtitle: the zone id is gone (live: date and time; demo: "14.09.2026 hh:mm · נתוני הדגמה"). |
| G2 | #15 | `live-camera.ts` | PTZ chip "Presets" -> "מיקומים שמורים"; demo detail "זמן מקור: NVR · Asia/Jerusalem" -> "מקליט · שעון האתר". |
| G2 | #15 | `investigate-rules.ts` | tab "Triggers" -> "מפעילים"; the two empty-tab texts without "Asia/Jerusalem", "NVR", "allowlist"; the subtitle, the rule dialog subtitle and the editor's steps/card "Trigger" -> "מפעיל"; editor hint without "unlock / disarm", "AI", "opt-in", "allowlist"; "correlation id" -> "מזהה קישור". |
| G2 | #15 | `system-devices.ts` | camera health: every operator "NVR" -> "מקליט" (subtitle, sync button, discovery line, empty state, alias hint and toast, drawer row, manual registration dialog); "OSD" in the alias hint -> "הכיתוב על התמונה"; "(ISAPI)" dropped. |
| G2 | #15 | `investigate-events.ts`, `live-wall.ts` | the recorder filter: aria-label and "כל ה־NVR" -> "מקליט" / "כל המקליטים" (the select itself is unchanged). |
| G1 | #5 | `system-devices.ts` | the recorder card left the page: a header action "פרטי המקליט" opens a `sw-drawer` with the same facts (two columns). The camera table gets the room (NOSCROLL's known limit "empty room above the recorder row" is gone). |
| G4 (part) | #10 | `system-devices.ts` | FPS / rate / main-stream cells no longer use `sw-table`'s `ltr` column (which sets `--sw-font-mono`): each value is a `span.ltr` with tabular figures in the product face. |
| G5 | #12, #6 | `investigate-incidents.ts` | the screen adopts `<sw-page wide>` (list and detail; the local `<h1>`, `.top` header and its CSS are gone; clock and actions in the `actions` slot); every local `span.badge` is a `<sw-badge filled>` (open = error, closed = offline, door / infrastructure looks mapped to live / stale / error / offline / unknown). The detail's status + elapsed time is a filled badge above the title (sw-page `crumbs` slot); on the phone the clock rides beside it and the frame is one step denser, so the board keeps the room it had. |

Not mirrored: no video, plan or timeline geometry was touched.

### After branch B (follow-ups, B's API is not on this base)

- **G3 (#7)** camera health: the filter chip row -> the KPI filter row needs B3's `sw-kpi dot=` and a pressed/toggle state; the base
  `sw-kpi action` is a dialog trigger (`aria-haspopup="dialog"`, `aria-expanded`), wrong for a filter. Not started.
- **G4 rest (#10)** `card` roles on the health columns (`card: 'title' | 'badge' | 'meta'`) need B4's `TableColumn.card`; adding it now
  is a type error. The phone target (>= 5 cameras in the first 375x812 screen) is therefore not met yet.

### Not changed (recorded)

- Lead answer 2026-11-12, Q1 = **א**: the remaining operator "NVR" strings were translated on this branch too (commit `bd7614fe7`):
  91 occurrences in `live-camera.ts` (41: schedule / smart rules / motion / OSD writes, capability notes, rename dialog),
  `live-overview.ts`, `live-wall.ts`, `investigate-{cases,event-detail,events,exports,history-map,playback,rules,search}.ts` and
  `i18n/he.ts` (`camera.offlineReason`); Hebrew forms with their prefixes (ה־/ל־/מה־/ב־NVR -> המקליט / למקליט / מהמקליט / במקליט,
  "כל ה־NVR" -> "כל המקליטים"). Comments and identifiers are untouched. Guard: the source test in `evidence-audit30g-video` (90
  Hebrew lines with "NVR" on the base, 0 now). Specs that asserted the old words: `evidence-multi-nvr`, `evidence-video`,
  `screenshots` (one line each).
- Left: the demo fixture row "NVR (הקלטה)" on the live overview comes from `src/fixtures/catalog.ts`, which is not a branch G file;
  the browser check exempts exactly that string. The settings screens (NVR connection, cameras settings, security tabs) belong to
  other owners and keep their wording.
- The video timestamps (`live-camera.ts .stamp`, `investigate-playback.ts .stamp / .drift`) stay monospace: they are on-video
  clock read-outs (OSD family), counted by the probe as mono 1 each.
- The probe's "con L3 / L6" on the single camera and the wall are white labels on video tiles measured against the page because the
  probe does not see the picture under them (`sw-camera-tile`, a shared component). Not a finding of this branch.

## Measurements (audit probe, from a copy of the folder)

Built UI of the base (`dist-before`) and of this branch (`dist-after`), `vite preview`, `node tools/shoot.mjs --routes
camera,live,health,alarm,incidents,events,playback,rules,wall` (1440x900 light/dark, 768, 375) and `--vps contract --schemes light`
(1366x768), `node tools/analyze.mjs`. Page scroll = max(document, page-sized scroller) overflow in px.

| Screen | page scroll 1366x768 | page scroll 1440x900 | sw-page | monospace text runs (1440 light) | contrast fails L / D | native controls |
|---|---|---|---|---|---|---|
| camera health | 0 -> 0 | 0 -> 0 | 1 -> 1 | **21 -> 0** | 0/0 -> 0/0 | sw-table's table only |
| live event | 0 -> 0 | 0 -> 0 | **0 -> 1** | 0 -> 0 | 0/0 -> 0/0 | its own list `<table>` (unchanged, not new) |
| single camera | 0 -> 0 | 0 -> 0 | 1 -> 1 | 1 -> 1 (on-video clock) | 3/0 -> 3/0 (probe limit, video labels) | - |
| playback | 0 -> 0 | 0 -> 0 | 1 -> 1 | 1 -> 1 (on-video clock) | 0/0 -> 0/0 | unchanged |
| rules, events, live overview, alarm, wall | 0 -> 0 | 0 -> 0 | 1 -> 1 | unchanged | unchanged (wall 6/0 probe limit) | unchanged |

Page scroll was already 0 on this base (NOSCROLL-1366-2437). Camera health also: phone 375x812 1432 -> 1207 px (the recorder card
left the page; the phone still scrolls its list by design, the card template is B4), tablet 768x1024 44 -> 0 px. At 1440x900 all ten
demo cameras now fit without the pager.

Probe shots before / after (1366, 1440 light and dark, 768, 375): `docs/changes/evidence/AUDIT30-G-VIDEO/probe/` (the after
shots are of `4d68ca6e4`; the later commits change only the rules copy and the live event's phone header, whose current state is in
`evidence/AUDIT30-G-VIDEO/incidents-*-390.png`). Screenshots of the regression spec at 1440 / 1366 / 390: `evidence/AUDIT30-G-VIDEO/`.

Copy (finding 15), counted by `tests/evidence-audit30g-video.spec.ts` on the base build: "NVR" / zone id / "Presets" / "Triggers" /
"Trigger" visible on camera health, playback, single camera and rules (4 of the 7 copy cases failed on the base, the events centre
and the incidents screens were already clean); after: 0 on all seven.

## Tests

Workstation (Windows), `vite preview` of a build of the branch, `SW_BASE_URL=http://127.0.0.1:<port>/`, `--project=desktop`:

| Command | Result |
|---|---|
| `tsc --noEmit` | exit 0 |
| `vite build` (base and branch) | exit 0 |
| `npx playwright test tests/evidence-audit30g-video.spec.ts` on the BASE build | **9 failed, 7 passed** as intended (copy on health, playback, camera, rules; the 4 sw-page / sw-badge cases; health monospace) |
| the same on the branch build (first commit) | 15 passed, 1 failed (rules: "Trigger" in the subtitle - fixed in `b373a3405`) |
| `evidence-audit30g-video` + `layout-incidents` + `evidence-incidents` + `evidence-sys-audit-quickfix-2437` | 53 passed, 2 failed (`layout-incidents` detail 390x844 light/dark: inner overflow of the doors part - fixed in `3ecf93519`) |
| `layout-incidents` + `evidence-audit30g-video` after the fix (Vite dev server) | 32 passed |

Runner (`private/runner/run_smart.py preview pilot/AUDIT30-G-VIDEO ... --workers=1 --machine runner`):

| Run | Result |
|---|---|
| `pixel-audit30g-video` desktop + mobile `-u` @ `4d68ca6e4` | 16 passed, 16 new linux baselines |
| `pixel-audit30g-video` + `layout-noscroll-1366` + `evidence-audit30g-video`, desktop + mobile, no `-u` @ `b373a3405` | 74 passed, 26 skipped (mobile-only skips of the desktop guards) |
| `pixel-audit30g-video` desktop + mobile `-u` @ `3ecf93519` (phone frame changed), after the runner came back | 26 passed; the 4 phone live-event baselines re-generated (commit `2bf108ed3`) |
| `--update-snapshots=changed` @ `2bf108ed3` (after the NVR copy commit `bd7614fe7`): `pixel-audit30g-video` + `pixel-wall-followups-2390` + `pixel-skin-qa-2403` (`--grep=pixel-stable`, desktop / mobile / tablet); `visual-matrix --grep=live-wall` | 26 passed, 0 rewritten; 6 passed, 0 rewritten (the copy change moves no baseline) |
| proof without `-u` @ `2bf108ed3`: the same two jobs, then `evidence-audit30g-video` + `layout-incidents` (desktop) | 26 passed / 28 skipped (tablet and smoke-only skins); 6 passed; 38 passed |

Runner etiquette (lead rule 2026-11-12 evening): every job started only after `uptime` showed a 1-minute load below 30 and no job of
this branch running; one job at a time, one worker, scoped with `--grep`; nothing was killed on the runner. The runner worktree of
this branch had an untracked `docs/changes/evidence/AUDIT30-G-VIDEO/` (left by a job stopped while the runner hung) that blocked its
checkout, so two update runs used `3ecf93519`; that folder (this branch's own evidence copies) was removed there and the runs were
repeated at the head.

Workstation, after the NVR commit: `tsc --noEmit` exit 0; `evidence-audit30g-video` desktop (Vite dev server) 21 passed, 1 failed
(`/live`: the fixture row "NVR (הקלטה)", exempted) -> `-g "finding 15"` 13 passed.

Not run: `evidence-incidents` / `evidence-sys-audit-quickfix-2437` after `3ecf93519` (they ran green before it; the change is the
phone header only), the tablet project, the full suite (the runner entry check runs the selection). The visual matrix was not
re-taken: this branch does not change `live-wall` or `security-alarm` pixels (the wall change is an aria-label and a key-hint word).

## Design skills (SKILLS_BRIEF.md)

| Skill | Invoked | Command / tool | Finding | Change | Rejected |
|---|---|---|---|---|---|
| ui-ux-pro-max | yes | `search.py "status badge table monospace numeric data" --domain ux`, `search.py "page header title status actions consistency" --domain ux` (`evidence/AUDIT30-G-VIDEO/skills/ui-ux-pro-max.txt`) | badge counts must not be competing live regions; tables need a card layout on phones | the ticking incident badge is not a live region (unchanged); the phone card template waits for B4 | "horizontal scroll wrapper" for tables (our rule: no scrolling) |
| impeccable | yes | `impeccable.cmd detect --json investigate-incidents.ts system-devices.ts` (`skills/impeccable.txt`) | no anti-pattern reported (`[]`) | - | - |
| emil-design-eng | yes | Skill tool | press feedback / drawers: use the existing `sw-drawer` motion, no new animation; the per-second elapsed badge must not animate | recorder facts use `sw-drawer` (existing motion tokens); no transition added | adding a hover lift to the recorder button (touch screens, gated hover only) |

## Rollback

Revert the merge commit. No data, settings or API change.
