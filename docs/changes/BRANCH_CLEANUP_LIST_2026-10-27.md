# Remote branch cleanup list - 2026-10-27 (READ-ONLY analysis, nothing deleted)

Task: DEADBRANCH-297 (board row r362). Basis: `git fetch --prune origin` on 2026-10-27; origin/main = `1b0ddd85c`; latest tag `v2.23.2`. 348 remote branches on origin (excluding `origin/HEAD`).

Method: ancestry via `git merge-base --is-ancestor <branch> origin/main`; unique commits via `git cherry origin/main <branch>` (count of `+` lines, i.e. commits whose patch is not already in main, so squash or cherry-picked merges count as merged); tag containment via `merge-base --is-ancestor <branch> <tag>` for every `v*` tag (30 tags); age = days since the last commit on the branch. Stale = no commit in more than 14 days. No branch, tag or ref was changed by this work.

Classification order: PROTECTED (`main`) -> ACTIVE (`pilot/*-297`, `release/2240`, `release/2241`, never proposed for deletion) -> MERGED (ancestor of main, or zero unique commits) -> TAGGED (unmerged into main but contained by a release tag) -> STALE (unique commits, >14 days) -> ACTIVE-RECENT (unique commits, <=14 days, other).

## Counts

| class | count |
|---|---|
| PROTECTED | 1 |
| ACTIVE | 12 |
| MERGED | 243 |
| TAGGED | 0 |
| STALE | 32 |
| UNMERGED_RECENT | 60 |
| total | 348 |

Of the MERGED class, 214 are proposed SAFE-TO-DELETE; the rest are `release/*` or `backup/*` refs held for the owner.

## 1. PROTECTED

| branch | last commit | age (d) | unique commits | proposed action |
|---|---|---|---|---|
| `main` | 2026-10-26 | 0 | 0 | KEEP (never touch) |

## 2. ACTIVE (running agents, DO NOT delete)

Matches `pilot/*-297`, `release/2240`, `release/2241`.

| branch | last commit | age (d) | unique commits | proposed action | note |
|---|---|---|---|---|---|
| `pilot/A11YFIX-297` | 2026-10-27 | 0 | 1 | KEEP (ACTIVE) | fix(a11y): three contrast defects of the 2026-10-27 design audit (A11YFIX-297) |
| `pilot/BOARDV2-297` | 2026-10-27 | 0 | 7 | KEEP (ACTIVE) | feat(notice-board): the V2 board design and its settings (BOARDV2-297); test(notice-board): V2 board layout, settings and unit specs; backend V2 option tests (BOA; fix(notice-board): V2 bus rows never widen their area; the slide's bus slide takes the sta |
| `pilot/BUBBLECLEAN-297` | 2026-10-27 | 0 | 1 | KEEP (ACTIVE) | fix(bubble): hide the Look dials card and the bubble demo route while the skin is frozen;  |
| `pilot/DESIGNAUDIT-297` | 2026-10-27 | 0 | 2 | KEEP (ACTIVE) | docs(design): DESIGNAUDIT-297 v1 - design-system audit, code inventory; docs(design): DESIGNAUDIT-297 v2 - rendered critique, ranked findings, token contract |
| `pilot/DESIGNSYS-297` | 2026-10-27 | 0 | 1 | KEEP (ACTIVE) | design: DESIGNSYS-297 - the new design system proposal (DESIGN.md, TOKENS.md, COMPONENT_RU |
| `pilot/ELEVFIX-297` | 2026-10-27 | 0 | 6 | KEEP (ACTIVE) | test(elevators): narrow-card layout spec for the elevators home widget (ELEVFIX-297); ﻿fix(elevators): narrow elevators cards stack cleanly, one-line summary, calm out-of-servi; ﻿fix(elevators): small cards keep the same minimum width as the others (ELEVFIX-297) |
| `pilot/GATEAUDIT-297` | 2026-10-27 | 0 | 3 | KEEP (ACTIVE) | test(gate): drop the zero-pixel design-foundation duplicates of the visual matrix; frozen-; test(visual): re-take the 38 stale visual-matrix Linux baselines (reviewed, intended chang; chore(gate): tier-L baselines from the 2.23.1 nightly, adjusted for the bubble freeze and  |
| `pilot/HEAVYTESTS-297` | 2026-10-26 | 0 | 0 | KEEP (ACTIVE) |  |
| `pilot/MEDIACARD-297` | 2026-10-27 | 0 | 3 | KEEP (ACTIVE) | test(avpixel295): pixel spec for the multimedia (audio/video) screens - screens, players, ; test(mediacard297): retarget AVPIXEL-295 to the WisKey station media drawer, dark and tabl; test(mediacard297): 19 Linux baselines for the station media drawer in dark and on the tab |
| `pilot/SMALLMERGES-297` | 2026-10-27 | 0 | 9 | KEEP (ACTIVE) | gate: gate v2 (GATE2-295) - change-impact selection on top of the unchanged engine, dry-ru; docs(gate2): retrospective replay of the gate-2 selector on 11 red gates (GATE2-295); gate(gate2): replay rules R1-R4 and the unit-* smoke-masking fix - 0 of 138 failing files  |
| `pilot/WIDGETBREAK-297` | 2026-10-27 | 0 | 9 | KEEP (ACTIVE) | test(widgets): worst-case harness and layout spec for the home widgets (WIDGETBREAK-297); test(widgets): harness resolves the item like the home screen (WIDGETBREAK-297); fix(home-widgets): long sensor text, narrow forecast and edit chrome stay inside 240 px ca |
| `pilot/WISKEY-OWNER26-297` | 2026-10-27 | 0 | 4 | KEEP (ACTIVE) | feat(wiskey): adopt owner26 HA-scoped media terminal (WISKEY-OWNER26-297); feat(wiskey): adopt owner26 independent listen (WISKEY-OWNER26-297); feat(wiskey): adopt owner26 signed Native metadata feed (WISKEY-OWNER26-297) |

## 3. MERGED into origin/main

Every commit is an ancestor of origin/main or patch-equivalent to a commit in it.

| branch | last commit | age (d) | unique commits | proposed action |
|---|---|---|---|---|
| `archive/bubble-skin-v2.23.0` | 2026-10-26 | 0 | 0 | SAFE-TO-DELETE (fully merged) |
| `integ/2100` | 2026-10-21 | 6 | 0 | SAFE-TO-DELETE (fully merged) |
| `integ/2101` | 2026-10-21 | 6 | 0 | SAFE-TO-DELETE (fully merged) |
| `integ/2102` | 2026-10-21 | 6 | 0 | SAFE-TO-DELETE (fully merged) |
| `integ/2111` | 2026-10-21 | 5 | 0 | SAFE-TO-DELETE (fully merged) |
| `integ/263` | 2026-10-17 | 10 | 0 | SAFE-TO-DELETE (fully merged) |
| `integ/264` | 2026-10-17 | 9 | 0 | SAFE-TO-DELETE (fully merged) |
| `integ/270` | 2026-10-18 | 9 | 0 | SAFE-TO-DELETE (fully merged) |
| `integ/271` | 2026-10-18 | 8 | 0 | SAFE-TO-DELETE (fully merged) |
| `integ/272` | 2026-10-18 | 8 | 0 | SAFE-TO-DELETE (fully merged) |
| `integ/273` | 2026-10-19 | 8 | 0 | SAFE-TO-DELETE (fully merged) |
| `integ/280` | 2026-10-19 | 7 | 0 | SAFE-TO-DELETE (fully merged) |
| `integ/281` | 2026-10-19 | 7 | 0 | SAFE-TO-DELETE (fully merged) |
| `integ/282` | 2026-10-19 | 7 | 0 | SAFE-TO-DELETE (fully merged) |
| `integ/290` | 2026-10-19 | 7 | 0 | SAFE-TO-DELETE (fully merged) |
| `integ/290-rel` | 2026-10-20 | 7 | 0 | SAFE-TO-DELETE (fully merged) |
| `integ/291` | 2026-10-20 | 7 | 0 | SAFE-TO-DELETE (fully merged) |
| `integ/291-baselines` | 2026-10-20 | 7 | 0 | SAFE-TO-DELETE (fully merged) |
| `integ/291-rel` | 2026-10-20 | 7 | 0 | SAFE-TO-DELETE (fully merged) |
| `integ/292` | 2026-10-20 | 6 | 0 | SAFE-TO-DELETE (fully merged) |
| `integ/292-rel` | 2026-10-20 | 6 | 0 | SAFE-TO-DELETE (fully merged) |
| `integ/293` | 2026-10-20 | 6 | 0 | SAFE-TO-DELETE (fully merged) |
| `integ/293-rel` | 2026-10-20 | 6 | 0 | SAFE-TO-DELETE (fully merged) |
| `integ/WK-2170` | 2026-10-24 | 2 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/ACCEPT102-295` | 2026-10-23 | 4 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/ADOPTR6-295` | 2026-10-25 | 1 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/ANNOUNCE-295` | 2026-10-25 | 2 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/ANNOUNCEB-295` | 2026-10-26 | 1 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/APPREFRESH-295` | 2026-10-23 | 4 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/APPREFRESH2-295` | 2026-10-23 | 4 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/APPREFRESH2B-295` | 2026-10-23 | 3 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/APPREFRESH3-295` | 2026-10-23 | 3 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/ASGI-295` | 2026-10-25 | 2 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/AVW10-295` | 2026-10-23 | 4 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/BKPFIX-295` | 2026-10-22 | 4 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/BLUEPRINT80-295` | 2026-10-23 | 4 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/BUBBLEFREEZE-295` | 2026-10-26 | 0 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/BUSRT-295` | 2026-10-26 | 1 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/BUSTIMES-295` | 2026-10-26 | 0 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/BUSTIMES-295-r` | 2026-10-26 | 0 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/BUSVERIFY-295` | 2026-10-26 | 0 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/CAMHEALTH091-295` | 2026-10-23 | 3 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/CAMSUGGEST138-295` | 2026-10-23 | 3 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/CAPEMERGENCY-295` | 2026-10-25 | 2 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/CAPEMERGENCY2-295` | 2026-10-25 | 1 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/CAPMAP-295` | 2026-10-25 | 2 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/COMPLY108-295` | 2026-10-23 | 4 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/CRITRELAY217-295` | 2026-10-23 | 3 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/CRITSERVER217-295` | 2026-10-24 | 3 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/CRITSOUND124-295` | 2026-10-23 | 3 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/CRITSOUND124B-295` | 2026-10-23 | 3 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/DATEFMT60-295` | 2026-10-23 | 4 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/DENYALERT133-295` | 2026-10-23 | 4 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/DIALOGSOLID-295` | 2026-10-24 | 2 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/DOCLINKSEC-295` | 2026-10-23 | 4 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/DOCSHOTS053-295` | 2026-10-23 | 3 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/DOCSUX-295` | 2026-10-22 | 4 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/DROPDOWNFIT-295` | 2026-10-24 | 2 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/ELECBILL77-295` | 2026-10-23 | 4 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/EMERGREADY104-295` | 2026-10-23 | 3 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/EMROLE-295` | 2026-10-25 | 2 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/ENTIDSWEEP-295` | 2026-10-20 | 6 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/FIN2190-295` | 2026-10-25 | 2 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/FIX2180-295` | 2026-10-25 | 2 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/FIX2200-295` | 2026-10-25 | 1 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/FIX2210B-295` | 2026-10-26 | 1 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/FIX2211-295` | 2026-10-26 | 1 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/FIX2220-295` | 2026-10-26 | 0 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/FIX2230-295` | 2026-10-26 | 0 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/FIX2231A-295` | 2026-10-26 | 0 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/FIX2231B-295` | 2026-10-26 | 0 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/FIX2231C-295` | 2026-10-26 | 0 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/FIX2232A-295` | 2026-10-26 | 0 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/FIX2232B-295` | 2026-10-26 | 0 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/FIXTKNAME-295` | 2026-10-26 | 1 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/FLAKES-295` | 2026-10-25 | 1 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/FLEET215-295` | 2026-10-23 | 3 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/FRIGATE2-295` | 2026-10-22 | 4 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/FRIGLIVE2-295` | 2026-10-22 | 4 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/FRIGPERM-295` | 2026-10-24 | 2 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/GATEFIX2140-295` | 2026-10-23 | 3 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/GATEFIX2150A-295` | 2026-10-24 | 3 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/GATEFIX2150B-295` | 2026-10-24 | 3 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/GATEFIX2150C-295` | 2026-10-24 | 3 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/GENELEV-295` | 2026-10-25 | 2 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/GENLOG092-295` | 2026-10-23 | 3 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/GUIDETEMP-295` | 2026-10-21 | 5 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/HDRFIX-295` | 2026-10-26 | 1 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/HOME-295` | 2026-10-26 | 1 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/HOMEINFO-295` | 2026-10-26 | 1 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/IDENT146-295` | 2026-10-23 | 4 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/INSIGHT215-295` | 2026-10-23 | 3 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/INSIGHT215B-295` | 2026-10-23 | 3 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/INTAKE99-295` | 2026-10-23 | 4 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/KAV079-295` | 2026-10-24 | 2 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/KAVDEVTEST-295` | 2026-10-24 | 2 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/KAVLEFT-295` | 2026-10-24 | 2 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/KEYROT-FIX-295` | 2026-10-23 | 3 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/KEYROT-HARNESS-295` | 2026-10-23 | 3 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/LEASELIFE-295` | 2026-10-22 | 4 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/LIVEEVENT100-295` | 2026-10-23 | 3 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/LIVEEVENT100B-295` | 2026-10-23 | 3 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/LOGOFIT-295` | 2026-10-24 | 2 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/LOGOFIX-295` | 2026-10-26 | 1 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/LOGOKIT-295` | 2026-10-24 | 2 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/LOGOS-295` | 2026-10-23 | 3 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/LOGOS295B` | 2026-10-23 | 3 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/LOGOSIDE-295` | 2026-10-25 | 2 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/MAINT215-295` | 2026-10-23 | 3 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/MAINT215B-295` | 2026-10-23 | 3 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/MASKCOPY62-295` | 2026-10-23 | 4 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/MOBILE214-295` | 2026-10-23 | 4 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/MUTEFIX-295` | 2026-10-23 | 4 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/NIGHTLYFIX-295` | 2026-10-21 | 5 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/NOSCROLL-295` | 2026-10-25 | 1 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/NOTICE106-295` | 2026-10-23 | 3 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/NOTICE106B-295` | 2026-10-24 | 3 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/NOTICEADD-295` | 2026-10-24 | 2 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/NOTICECAPS-295` | 2026-10-25 | 2 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/NOTICEDEL-295` | 2026-10-25 | 2 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/NOTICEGB-295` | 2026-10-24 | 2 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/NOTICEPAGE-295` | 2026-10-24 | 2 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/NOTICEPERM-295` | 2026-10-24 | 2 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/NOTICEPOLISH-295` | 2026-10-24 | 2 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/NOTICEPUSH-295` | 2026-10-24 | 2 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/NOTICEREMOVE-295` | 2026-10-26 | 1 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/NOTICERSS-295` | 2026-10-25 | 2 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/NOTICESAVER-295` | 2026-10-24 | 2 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/NOTICESLIDES-295` | 2026-10-24 | 2 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/OCR119-295` | 2026-10-23 | 4 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/PACING12-295` | 2026-10-22 | 4 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/PARTNERAPI113-295` | 2026-10-23 | 3 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/PEERQUERY-295` | 2026-10-25 | 2 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/PERMCAM63-295` | 2026-10-23 | 4 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/PHYSENTRY070-295` | 2026-10-23 | 3 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/PHYSENTRY070B-295` | 2026-10-23 | 3 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/PIXEL2201-295` | 2026-10-26 | 1 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/POLISH-295` | 2026-10-25 | 1 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/POLISH136-295` | 2026-10-23 | 4 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/POLISH2-295` | 2026-10-25 | 1 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/PREGATE264` | 2026-10-17 | 10 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/PRESENCE307-295` | 2026-10-23 | 3 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/PRESUNAVAIL-295` | 2026-10-24 | 2 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/PRESUNAVAIL2-295` | 2026-10-24 | 2 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/PREVIEWONLY-295` | 2026-10-23 | 4 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/PUSHSVC-295` | 2026-10-23 | 4 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/PWCLEAN-295` | 2026-10-25 | 1 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/QUARANTINE-295` | 2026-10-25 | 1 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/QUIET103-295` | 2026-10-23 | 4 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/R2160B-BE-295` | 2026-10-24 | 3 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/R2160B-FE-295` | 2026-10-24 | 3 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/READY96-295` | 2026-10-23 | 3 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/READYFLEET-295` | 2026-10-23 | 3 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/SAFE1-295` | 2026-10-22 | 4 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/SAFE2-295` | 2026-10-22 | 4 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/SCENARIO109-295` | 2026-10-23 | 4 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/SERVICEIA1-295` | 2026-10-23 | 4 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/SERVICEIA2-295` | 2026-10-23 | 3 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/SERVICEIA3-295` | 2026-10-23 | 3 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/SESSIONEXCH2-295` | 2026-10-24 | 2 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/SESSIONEXCH217-295` | 2026-10-23 | 3 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/SHIFT114-295` | 2026-10-23 | 4 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/SMALLA-295` | 2026-10-22 | 4 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/SMALLFIXA-295` | 2026-10-22 | 4 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/SMALLFIXB-295` | 2026-10-22 | 4 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/STALETESTS-295` | 2026-10-23 | 3 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/SVC215-295` | 2026-10-23 | 3 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/SVC215B-295` | 2026-10-23 | 3 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/SWITCHUI-295` | 2026-10-22 | 4 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/SXFIX-295` | 2026-10-25 | 1 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/T06ADMIT-295` | 2026-10-25 | 2 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/TEMPLINK-295` | 2026-10-25 | 2 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/TENANTINTAKE098-295` | 2026-10-23 | 3 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/TESTDEBT4-295` | 2026-10-21 | 5 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/TESTFIX-MAINTTAGS-295` | 2026-10-24 | 3 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/TESTFIX2171-295` | 2026-10-24 | 2 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/TESTSTAB-295` | 2026-10-23 | 4 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/TIMESCRUB101-295` | 2026-10-23 | 3 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/TIMESCRUB101B-295` | 2026-10-23 | 3 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/TOPPILL-295` | 2026-10-24 | 2 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/TPLV2-295` | 2026-10-25 | 1 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/TVOPT-295` | 2026-10-25 | 1 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/UI2122-295` | 2026-10-22 | 4 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/UPSTREAM-295` | 2026-10-21 | 5 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/VENDORARRIVAL126B-295` | 2026-10-23 | 3 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/VISITOR105-295` | 2026-10-23 | 4 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/VOICE143-295` | 2026-10-23 | 4 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/W031-295` | 2026-10-25 | 1 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/W10CLIENT-295` | 2026-10-24 | 3 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/WALINK-295` | 2026-10-25 | 2 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/WAPACE-295` | 2026-10-23 | 3 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/WATER78-295` | 2026-10-23 | 4 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/WATER78B-295` | 2026-10-23 | 3 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/WATER78C-295` | 2026-10-23 | 3 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/WHITELABEL097-295` | 2026-10-23 | 3 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/WHOIN034-295` | 2026-10-23 | 3 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/WK4ADOPT-295` | 2026-10-25 | 1 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/WKA-295` | 2026-10-22 | 4 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/WKADAPT-295` | 2026-10-23 | 4 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/WKAUDIN-295` | 2026-10-24 | 2 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/WKB3-295` | 2026-10-24 | 3 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/WKCAP-295` | 2026-10-24 | 2 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/WKCAPWIRE-295` | 2026-10-24 | 2 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/WKDIRECT-295` | 2026-10-24 | 2 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/WKF01F02-295` | 2026-10-25 | 2 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/WKLIVE-295` | 2026-10-24 | 2 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/WKOPENUNK-295` | 2026-10-24 | 2 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/WKR5-295` | 2026-10-24 | 2 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/WKR5ADOPT-295` | 2026-10-25 | 2 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/WKVEC-295` | 2026-10-25 | 2 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/WKWRITE-295` | 2026-10-24 | 2 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/XSCENARIO109-295` | 2026-10-23 | 3 | 0 | SAFE-TO-DELETE (fully merged) |
| `pilot/ZONECOUNT107-295` | 2026-10-23 | 4 | 0 | SAFE-TO-DELETE (fully merged) |
| `rel2140fix-work` | 2026-10-23 | 4 | 0 | SAFE-TO-DELETE (fully merged) |
| `release/2100` | 2026-10-21 | 6 | 0 | NEEDS-OWNER-DECISION (release/backup ref, keep as history unless owner agrees) |
| `release/2101` | 2026-10-21 | 6 | 0 | NEEDS-OWNER-DECISION (release/backup ref, keep as history unless owner agrees) |
| `release/2111` | 2026-10-21 | 5 | 0 | NEEDS-OWNER-DECISION (release/backup ref, keep as history unless owner agrees) |
| `release/2112` | 2026-10-21 | 5 | 0 | NEEDS-OWNER-DECISION (release/backup ref, keep as history unless owner agrees) |
| `release/2120b` | 2026-10-22 | 4 | 0 | NEEDS-OWNER-DECISION (release/backup ref, keep as history unless owner agrees) |
| `release/2121` | 2026-10-22 | 4 | 0 | NEEDS-OWNER-DECISION (release/backup ref, keep as history unless owner agrees) |
| `release/2122` | 2026-10-23 | 4 | 0 | NEEDS-OWNER-DECISION (release/backup ref, keep as history unless owner agrees) |
| `release/2123` | 2026-10-23 | 4 | 0 | NEEDS-OWNER-DECISION (release/backup ref, keep as history unless owner agrees) |
| `release/2124` | 2026-10-23 | 4 | 0 | NEEDS-OWNER-DECISION (release/backup ref, keep as history unless owner agrees) |
| `release/2140` | 2026-10-23 | 3 | 0 | NEEDS-OWNER-DECISION (release/backup ref, keep as history unless owner agrees) |
| `release/2150` | 2026-10-23 | 3 | 0 | NEEDS-OWNER-DECISION (release/backup ref, keep as history unless owner agrees) |
| `release/2160` | 2026-10-23 | 3 | 0 | NEEDS-OWNER-DECISION (release/backup ref, keep as history unless owner agrees) |
| `release/2160B` | 2026-10-24 | 2 | 0 | NEEDS-OWNER-DECISION (release/backup ref, keep as history unless owner agrees) |
| `release/2170W` | 2026-10-24 | 2 | 0 | NEEDS-OWNER-DECISION (release/backup ref, keep as history unless owner agrees) |
| `release/2171` | 2026-10-24 | 2 | 0 | NEEDS-OWNER-DECISION (release/backup ref, keep as history unless owner agrees) |
| `release/2180` | 2026-10-25 | 2 | 0 | NEEDS-OWNER-DECISION (release/backup ref, keep as history unless owner agrees) |
| `release/2190` | 2026-10-25 | 1 | 0 | NEEDS-OWNER-DECISION (release/backup ref, keep as history unless owner agrees) |
| `release/2190-fix` | 2026-10-25 | 2 | 0 | NEEDS-OWNER-DECISION (release/backup ref, keep as history unless owner agrees) |
| `release/2200` | 2026-10-26 | 1 | 0 | NEEDS-OWNER-DECISION (release/backup ref, keep as history unless owner agrees) |
| `release/2201` | 2026-10-25 | 1 | 0 | NEEDS-OWNER-DECISION (release/backup ref, keep as history unless owner agrees) |
| `release/2201b` | 2026-10-26 | 1 | 0 | NEEDS-OWNER-DECISION (release/backup ref, keep as history unless owner agrees) |
| `release/2210` | 2026-10-25 | 1 | 0 | NEEDS-OWNER-DECISION (release/backup ref, keep as history unless owner agrees) |
| `release/2210b` | 2026-10-26 | 1 | 0 | NEEDS-OWNER-DECISION (release/backup ref, keep as history unless owner agrees) |
| `release/2211` | 2026-10-26 | 1 | 0 | NEEDS-OWNER-DECISION (release/backup ref, keep as history unless owner agrees) |
| `release/2211m` | 2026-10-26 | 1 | 0 | NEEDS-OWNER-DECISION (release/backup ref, keep as history unless owner agrees) |
| `release/2220` | 2026-10-26 | 0 | 0 | NEEDS-OWNER-DECISION (release/backup ref, keep as history unless owner agrees) |
| `release/2230` | 2026-10-26 | 0 | 0 | NEEDS-OWNER-DECISION (release/backup ref, keep as history unless owner agrees) |
| `release/2231` | 2026-10-26 | 0 | 0 | NEEDS-OWNER-DECISION (release/backup ref, keep as history unless owner agrees) |
| `release/2232` | 2026-10-26 | 0 | 0 | NEEDS-OWNER-DECISION (release/backup ref, keep as history unless owner agrees) |

## 4. Contained by a release tag, not merged into main

None.

## 5. Stale (more than 14 days, unique commits not in main or any tag)

Unique commit subjects (up to 3) in the last column.

| branch | last commit | age (d) | unique commits | proposed action | note |
|---|---|---|---|---|---|
| `integ/241` | 2026-10-08 | 19 | 1 | NEEDS-OWNER-DECISION (unique work; merge, archive by tag, or delete) | fix(release): renumber the FRGS migration 0072 -> 0071 (release_check needs a contiguous s |
| `pilot/ASTRA-inventory-refresh` | 2026-10-09 | 18 | 1 | NEEDS-OWNER-DECISION (unique work; merge, archive by tag, or delete) | docs(design): refresh the designer handoff inventories for 2.4.2 (screens, components, tok |
| `pilot/CR017-s1-backend` | 2026-10-01 | 25 | 3 | NEEDS-OWNER-DECISION (unique work; merge, archive by tag, or delete) | CR-017 S2: fixes of the Opus security review (F5, delegated delete, lows); CR-017 S1: fixes of the Opus security review (F1-F4, F6, lows a-d and f); CR-017 S1: wire against S2's review fixes (a03cfe1e) |
| `pilot/DEVHIST-mockup` | 2026-10-05 | 21 | 2 | NEEDS-OWNER-DECISION (unique work; merge, archive by tag, or delete) | docs(cr032): device activity popup (long press) - mockups, feasibility, estimate, owner qu; docs(cr032): device activity popup - design round 2 (compact 380 px, calmer, 12 entity typ |
| `pilot/GATE-parallel` | 2026-10-12 | 15 | 6 | NEEDS-OWNER-DECISION (unique work; merge, archive by tag, or delete) | feat(gate): opt-in parallel mode - one Chromium pool for preview, dev, fixture, pixel and ; test(gate): the backend shard-plan case states the real LPT result (400+50 / 300+100); fix(gate): gate_status.json writes are serialised (a lock around the .tmp + replace) |
| `pilot/GEN1-generator-mockup` | 2026-10-05 | 21 | 3 | NEEDS-OWNER-DECISION (unique work; merge, archive by tag, or delete) | design(gen1): generator control screen mockup (phase A) and CR-031 draft; design(gen1): revision 2 - hero power-flow diagram, capability-driven screen, rewritten ow; design(gen1): revision 3 - device-based detection, view and alerts only, generator picker, |
| `pilot/GT3-podman` | 2026-10-06 | 20 | 1 | NEEDS-OWNER-DECISION (unique work; merge, archive by tag, or delete) | chore(gt3): rootless Podman setup script, no-network smoke test and notes for the test run |
| `pilot/K11-2fa-draft` | 2026-10-06 | 21 | 1 | NEEDS-OWNER-DECISION (unique work; merge, archive by tag, or delete) | docs(CR-011): second factor decision paper rev 2 - per-channel threat model, options, step |
| `pilot/NN5-frigate-study` | 2026-10-05 | 21 | 2 | NEEDS-OWNER-DECISION (unique work; merge, archive by tag, or delete) | docs(nn5): Frigate study - feature inventory, gap analysis, provider architecture and thre; docs(nn5): record the passive WebSocket listen result (no events/reviews frames seen) in t |
| `pilot/ST7-lookdev` | 2026-10-10 | 16 | 9 | NEEDS-OWNER-DECISION (unique work; merge, archive by tag, or delete) | docs(cr029): plan Studio 6 - realistic 3D (quality level 3) and the eye-level walk-through; design(cr029): Plan Studio 6 interactive WebGL prototype - realistic 3D, walk-through, sti; docs(cr029): prototype README + CR findings - SwiftShader per-rung measurement recorded NO |
| `pilot/ST7-owner-form` | 2026-10-09 | 18 | 2 | NEEDS-OWNER-DECISION (unique work; merge, archive by tag, or delete) | docs(cr029): plan Studio 6 - realistic 3D (quality level 3) and the eye-level walk-through; docs(st7): owner decision form (Hebrew) and the Studio 6 build plan |
| `pilot/WISKEY-CRs` | 2026-10-10 | 16 | 4 | NEEDS-OWNER-DECISION (unique work; merge, archive by tag, or delete) | docs(cr-033): WisKey door path change request - door_open for every Arx-started opening; docs(cr-034): bridge HMAC rotation with a 3-minute two-key cap and the gate tool rules; docs(cr-033): interim transport while the trusted path is off, so bridge 0.8.1 does not br |
| `pilot/WISKEY-importer` | 2026-10-11 | 16 | 1 | NEEDS-OWNER-DECISION (unique work; merge, archive by tag, or delete) | feat(cr035): WisKey importer stage 1 - offline package intake, Arx import manifest, staged |
| `pilot/WISKEY-screens-design` | 2026-10-11 | 15 | 3 | NEEDS-OWNER-DECISION (unique work; merge, archive by tag, or delete) | design(cr036): WisKey native screens mockup gallery (slice S5) + Playwright evidence; docs(cr036): WisKey screens design record (ADR for slice S5); design(cr036): round 2 - stations redesign (stills, calls, talk, announce) + WhatsApp mess |
| `pilot/WX2-transition-table` | 2026-10-05 | 21 | 1 | NEEDS-OWNER-DECISION (unique work; merge, archive by tag, or delete) | docs(wiskey): WX2 door-open path transition table (today vs smplwise_intercom) |
| `pilot/WX3-hmac-rotation` | 2026-10-05 | 21 | 1 | NEEDS-OWNER-DECISION (unique work; merge, archive by tag, or delete) | docs+tool(wx3): HMAC key rotation procedure, local gate tool for the intercom source folde |
| `pilot/android-v4-import` | 2026-10-06 | 20 | 1 | NEEDS-OWNER-DECISION (unique work; merge, archive by tag, or delete) | feat(mobile): import Android v4 (presence sensors, FCM relay client, contract mock) into m |
| `pilot/cast-ux-mockups` | 2026-10-05 | 21 | 1 | NEEDS-OWNER-DECISION (unique work; merge, archive by tag, or delete) | design(cr028): interactive cast-to-screens UX mockups - live camera, wall, tray, errors, p |
| `pilot/design-compare-claude` | 2026-10-01 | 26 | 5 | NEEDS-OWNER-DECISION (unique work; merge, archive by tag, or delete) | design(compare): entrant-claude boards for the hi-tech Domus comparison; design(compare): three switchable skins, Domus room/building structure, list modes; design(compare): judge fixes for entrant-claude - LTR mirrors, knobs, skin identities |
| `pilot/design-round2` | 2026-10-01 | 26 | 2 | NEEDS-OWNER-DECISION (unique work; merge, archive by tag, or delete) | docs(design): round-2 brief and send list for Astra; docs(design): round-2 send list includes mirrors and home-kpi structure boards |
| `pilot/flaky-baseline` | 2026-10-06 | 20 | 1 | NEEDS-OWNER-DECISION (unique work; merge, archive by tag, or delete) | baseline: f0b42dd0 + the --sw-repeat option only |
| `pilot/frigate-clip-read` | 2026-10-06 | 20 | 5 | NEEDS-OWNER-DECISION (unique work; merge, archive by tag, or delete) | feat(frigate): read-only streamed GET of clip.mp4 (camera window and event) on the read al; test(frigate): fix NULs in the fake clip fixture; test(frigate): fake clip route path length |
| `pilot/home-unified-mockup` | 2026-10-01 | 25 | 1 | NEEDS-OWNER-DECISION (unique work; merge, archive by tag, or delete) | docs(design): mockup of the unified home status card and per-device home editing |
| `pilot/music-library-search` | 2026-10-03 | 23 | 3 | NEEDS-OWNER-DECISION (unique work; merge, archive by tag, or delete) | feat(media): library search through the bridge without the direct Music Assistant connecti; fix(media): keep the bridge status shape; card version 0.7.0; test expectations (MU1); test(bridge): card version assertion follows 0.7.0 |
| `pilot/music-library-search-b` | 2026-10-03 | 23 | 4 | NEEDS-OWNER-DECISION (unique work; merge, archive by tag, or delete) | feat(media): library search through the bridge without the direct Music Assistant connecti; fix(media): keep the bridge status shape; card version 0.7.0; test expectations (MU1); test(bridge): card version assertion follows 0.7.0 |
| `pilot/schedules-external-probe` | 2026-10-01 | 25 | 1 | NEEDS-OWNER-DECISION (unique work; merge, archive by tag, or delete) | docs(research): external schedules probe on two real systems (CR-014) |
| `pilot/studio6-plan` | 2026-10-05 | 21 | 1 | NEEDS-OWNER-DECISION (unique work; merge, archive by tag, or delete) | docs(cr029): plan Studio 6 - realistic 3D (quality level 3) and the eye-level walk-through |
| `pilot/studio6-prototype` | 2026-10-05 | 21 | 3 | NEEDS-OWNER-DECISION (unique work; merge, archive by tag, or delete) | docs(cr029): plan Studio 6 - realistic 3D (quality level 3) and the eye-level walk-through; design(cr029): Plan Studio 6 interactive WebGL prototype - realistic 3D, walk-through, sti; docs(cr029): prototype README + CR findings - SwiftShader per-rung measurement recorded NO |
| `pilot/tabs-dropdown-mockup` | 2026-10-02 | 25 | 1 | NEEDS-OWNER-DECISION (unique work; merge, archive by tag, or delete) | docs(design): tabs vs dropdowns phone mockup (A today, B dropdowns, C hybrid) + Settings p |
| `pilot/tasks-sync-2` | 2026-10-05 | 21 | 1 | NEEDS-OWNER-DECISION (unique work; merge, archive by tag, or delete) | chore(tasks): T063 and T073 are out of scope by owner decision 2026-10-05 (EXCLUDED eviden |
| `pilot/verify-221` | 2026-10-06 | 20 | 1 | NEEDS-OWNER-DECISION (unique work; merge, archive by tag, or delete) | docs(verify): 2.2.1 verification of gaps-220, flaky-fixes and frigate-addon-option on the  |
| `pilot/wiskey-b0` | 2026-10-01 | 25 | 6 | NEEDS-OWNER-DECISION (unique work; merge, archive by tag, or delete) | feat(wiskey): pin the rc37-contract.2 catalogs and add the contract-diff tool and contract; feat(intercom): D-006 closed background projection; drop last_access and people counts (B0; feat(intercom): split the WisKey background channel from the write channel (B0, D-004) |

## 6. Active/recent unmerged (14 days or less, unique commits)

| branch | last commit | age (d) | unique commits | proposed action | note |
|---|---|---|---|---|---|
| `codex/wiskey-arx-round4-source-delivery-2026-10-24` | 2026-10-24 | 2 | 1 | KEEP | docs(owner): deliver original Arx round4 sources and receipts for Mac integration |
| `integ/2411` | 2026-10-14 | 13 | 9 | KEEP | docs(cr040): key rotation design - atomic switch, bridge-owned trust epoch, UNKNOWN by sta; feat(bridge 0.8.1): trust epoch and atomic key rotation (CR-040) - trust_rotate / trust_st; feat(cr040): bridge trust-key rotation in the add-on - access.trust.rotate, migration 0089 |
| `integ/251` | 2026-10-14 | 13 | 1 | KEEP | release: 2.5.1 prep - version bump, bilingual CHANGELOG section, release notes, roadmap ro |
| `pilot/ATTEST232-295` | 2026-10-23 | 3 | 1 | KEEP | feat(attest232): device hardware attestation verifier layer for the app refresh device key |
| `pilot/ATTEST232B-295` | 2026-10-23 | 3 | 1 | KEEP | feat(attest232): device hardware attestation verifier layer for the app refresh device key |
| `pilot/AVPIXEL-295` | 2026-10-26 | 1 | 1 | KEEP | test(avpixel295): pixel spec for the multimedia (audio/video) screens - screens, players,  |
| `pilot/BUSMOCK-295` | 2026-10-26 | 1 | 1 | KEEP | docs(design): nearby bus times on the notice board - mock-up and API note (BUSMOCK-295) |
| `pilot/CAL112-295` | 2026-10-23 | 4 | 1 | KEEP | docs(CR-CAL112): calendar integration change record (ICS feed first, OAuth write-through o |
| `pilot/CR-LEASE-REVOKE` | 2026-10-16 | 10 | 1 | KEEP | docs(cr): CR-WISKEY-LEASE-REVOCATION-EVENT - the Arx-side revocation event and lease ledge |
| `pilot/CR-WISKEYID` | 2026-10-17 | 10 | 1 | KEEP | docs(cr): CR-ARX-WISKEY-SHARED-IDENTITY - one person in Arx and WisKey, time-bounded door  |
| `pilot/DOCSA-295` | 2026-10-24 | 2 | 1 | KEEP | docs(owner): decision page for building announcements, vendor technician card flow, billin |
| `pilot/EMERG104-295` | 2026-10-23 | 4 | 1 | KEEP | docs(cr): CR-EMERG104 emergency readiness view (read-only appendix of the maintenance ledg |
| `pilot/FABLE-REVIEW-295` | 2026-10-21 | 6 | 1 | KEEP | docs(security): Fable review report 2026-10-21 - public surfaces, HMAC rotation, door auto |
| `pilot/FABLE-REVIEW2-295` | 2026-10-21 | 6 | 1 | KEEP | docs(security): Fable review 2 - door windows / emergency, door-automation hardening, brid |
| `pilot/FABLE-REVIEW3-295` | 2026-10-21 | 5 | 1 | KEEP | docs(fable-review-3): security review 3 of release/2111, the ECCACT x WKV2B merge and HMAC |
| `pilot/FABLE-REVIEW4-295` | 2026-10-21 | 5 | 1 | KEEP | docs(review): Fable security review 4 - extended service identity impact-check re-review ( |
| `pilot/GATE2-295` | 2026-10-25 | 1 | 3 | KEEP | gate: gate v2 (GATE2-295) - change-impact selection on top of the unchanged engine, dry-ru; docs(gate2): retrospective replay of the gate-2 selector on 11 red gates (GATE2-295); gate(gate2): replay rules R1-R4 and the unit-* smoke-masking fix - 0 of 138 failing files  |
| `pilot/GATE2-295-tune` | 2026-10-26 | 1 | 4 | KEEP | gate: gate v2 (GATE2-295) - change-impact selection on top of the unchanged engine, dry-ru; docs(gate2): retrospective replay of the gate-2 selector on 11 red gates (GATE2-295); gate(gate2): replay rules R1-R4 and the unit-* smoke-masking fix - 0 of 138 failing files  |
| `pilot/GATEEFF-295` | 2026-10-21 | 6 | 7 | KEEP | docs(gate): template A/B benchmark on the runner - 2.79 s -> 0.65 s median per fresh test ; wip(gate): GATEEFF-295 policy layer - managed quarantine, classification lanes, base compa; wip(gate): GATEEFF-295 selftest lanes, retry-no-result hardening, test fixes |
| `pilot/GATEEFF2-295` | 2026-10-21 | 5 | 8 | KEEP | docs(gate): template A/B benchmark on the runner - 2.79 s -> 0.65 s median per fresh test ; wip(gate): GATEEFF-295 policy layer - managed quarantine, classification lanes, base compa; wip(gate): GATEEFF-295 selftest lanes, retry-no-result hardening, test fixes |
| `pilot/GATESPEED-293` | 2026-10-20 | 6 | 1 | KEEP | docs(gate): template A/B benchmark on the runner - 2.79 s -> 0.65 s median per fresh test  |
| `pilot/GDRIVEBK-295` | 2026-10-25 | 1 | 1 | KEEP | feat(gdrivebk): Google Drive off-box backup destination - design + scaffold, off by defaul |
| `pilot/GRANTS-FIX280` | 2026-10-19 | 8 | 1 | KEEP | fix(access-grants): grants-worker review F2, F3, F4, F6 (narrowing proof + CAS, Arx-create |
| `pilot/GUIDE-293` | 2026-10-20 | 6 | 1 | KEEP | docs(guide): user guide for 2.9.0-2.9.2 - what's new, tickets (overview, matrix, calendar, |
| `pilot/GUIDE-29X-295` | 2026-10-20 | 6 | 2 | KEEP | docs(guide): user guide for 2.9.0-2.9.2 - what's new, tickets (overview, matrix, calendar,; docs(guide): user guide and add-on DOCS for 2.9.3 - temperature phase 3, generator widget, |
| `pilot/HOMEMOCK-295` | 2026-10-25 | 1 | 4 | KEEP | design(home): polished home-screen mockup, every state and component (HOMEMOCK-295); design(home): round 2 - the CARDS home mode with the same polish, owner answers applied (H; design(home): round 2b - the SmplWise and company logos in the header, and the 1366x768 la |
| `pilot/KEYROT-PLAN-295` | 2026-10-22 | 4 | 1 | KEEP | docs(release): lab run plan for the bridge key rotation (HMACACT-295 / HMACACT2-295) |
| `pilot/LEGALPACK-295` | 2026-10-25 | 2 | 1 | KEEP | docs(legal): legal-review pack for counsel - request letter, README, 25 converted document |
| `pilot/MGRDASH-SPEC` | 2026-10-17 | 10 | 1 | KEEP | docs(design): manager dashboard - spec (Hebrew) and static mock-up, design only |
| `pilot/MGRDASH-SPEC2` | 2026-10-17 | 10 | 2 | KEEP | docs(design): manager dashboard - spec (Hebrew) and static mock-up, design only; docs(design): manager dashboard mock-up v2 - built from the product's own glass layers, co |
| `pilot/MULTISITE-PLAN-295` | 2026-10-26 | 1 | 2 | KEEP | docs(multisite): revise the multi-site plan for owner answers 367-379 - online sync, per-b; docs(multisite): fold the 2026-10-26 owner decisions into the plan, re-cut the slices (bot |
| `pilot/NIGHTLYRED-295` | 2026-10-26 | 1 | 5 | KEEP | gate: gate v2 (GATE2-295) - change-impact selection on top of the unchanged engine, dry-ru; docs(gate2): retrospective replay of the gate-2 selector on 11 red gates (GATE2-295); gate(gate2): replay rules R1-R4 and the unit-* smoke-masking fix - 0 of 138 failing files  |
| `pilot/NVRMASK2-295` | 2026-10-21 | 6 | 1 | KEEP | docs(release-2102): NVRMASK2-295 section - privacy-mask write already contained in integ/2 |
| `pilot/OFFLINE110-295` | 2026-10-23 | 3 | 1 | KEEP | feat(r110): offline field work, server half (OFFLINE110-295 slice 1) - bundle, replay rule |
| `pilot/OFFLINE110B-295` | 2026-10-23 | 3 | 1 | KEEP | feat(r110): offline field work, server half (OFFLINE110-295 slice 1) - bundle, replay rule |
| `pilot/POLISHPREVIEW-295` | 2026-10-25 | 2 | 1 | KEEP | docs(review): static polish previews for the home, schedules and automations screens |
| `pilot/PROVISION2-295` | 2026-10-20 | 6 | 6 | KEEP | feat(provision2): API v2 reads behind GetSupportedAPIs, audio in video (off by default), P; feat(provision2): motion detection on / off and sensitivity for Provision cameras through ; feat(provision2): set-motion in the sanctioned Provision write script (save, write once, v |
| `pilot/READY96B-295` | 2026-10-23 | 3 | 1 | KEEP | feat(READY96): score chip on the settings entry "readiness" (slice 1 leftover) |
| `pilot/READY96C-295` | 2026-10-23 | 3 | 1 | KEEP | feat(READY96): score chip on the settings entry "readiness" (slice 1 leftover) |
| `pilot/SEC217-295` | 2026-10-23 | 3 | 1 | KEEP | fix(sec217): the four fix-before-enable findings of the 2.16.0 security review |
| `pilot/SECFIX2-RED-295` | 2026-10-20 | 6 | 1 | KEEP | test(secfix2-295): RED baseline only - the SECFIX2-295 tests on the unchanged base (integ/ |
| `pilot/SERVICEIA-295` | 2026-10-23 | 3 | 2 | KEEP | docs(SERVICE-IA): service-management area - IA inventory, proposal with capability parity ; docs(SERVICE-IA): record the owner review 24.10 decisions |
| `pilot/SMS118-295` | 2026-10-23 | 4 | 1 | KEEP | docs(changes): CR-SMS118 SMS channel for service-request notifications (design only) |
| `pilot/TESTDEBT-295` | 2026-10-20 | 6 | 3 | KEEP | test(testdebt): the node-only unit config leaves out the 18 page specs; SW_UNIT_PAGES=1 ru; test(testdebt): unit config is ESM - no __dirname; test(testdebt): triage doc; unit config notes the preview-only 3D spec |
| `pilot/TK260-expand-nav` | 2026-10-16 | 11 | 6 | KEEP | fix(tickets): the drawer's expand arrow opens the request full-screen (TK260); test(tickets): TK260 spec builds the stored sign-in client id from the page origin; test(tickets): TK260 prefix proxy uses the request origin, not an assumed preview port |
| `pilot/TPLWIRE-295` | 2026-10-22 | 4 | 1 | KEEP | docs(TPLWIRE-295): record that WisKey has no template-send command; stop before wiring |
| `pilot/UIJANK-293-redcheck` | 2026-10-20 | 6 | 1 | KEEP | test(uijank-293): RED CHECK ONLY - the overlay guard on the unfixed integ/293 code (never  |
| `pilot/USR2-spec` | 2026-10-16 | 10 | 1 | KEEP | docs(usr2): Arx-only identity design spec - identity store, argon2id passwords, one-time l |
| `pilot/VENDORARRIVAL126-295` | 2026-10-23 | 3 | 3 | KEEP | feat(vendorarrival126): vendor "I have arrived" tap, expected-arrival window and missed-ar; feat(vendorarrival126): "I have arrived" card on the vendor page, Settings card, timeline ; fix(vendorarrival126): tsc errors in the arrived card (null children) and the timeline ico |
| `pilot/VSEARCH115-295` | 2026-10-23 | 4 | 1 | KEEP | docs(changes): CR-VSEARCH115 free-text search in recordings, design only |
| `pilot/WKB-295` | 2026-10-22 | 4 | 2 | KEEP | feat(wiskey): WKB-295 per-station removal proof, durable full original, T06 mapping; fix(wiskey): WKB-295 a queued id without a row keeps the station proof UNKNOWN |
| `pilot/WKB2-295` | 2026-10-23 | 4 | 3 | KEEP | feat(wiskey): WKB-295 per-station removal proof, durable full original, T06 mapping; fix(wiskey): WKB-295 a queued id without a row keeps the station proof UNKNOWN; feat(wiskey): WKB2-295 seal the intent originals, references only, retention purge, never  |
| `pilot/WKBRIDGE-295` | 2026-10-23 | 4 | 1 | KEEP | feat(WKBRIDGE-295): Arx side of the WisKey round-3 bridge command route (prepared, not wir |
| `pilot/WKCLOSE-295` | 2026-10-26 | 0 | 2 | KEEP | test(wkclose): the HA-path socket ownership and the shared-HA completion gap on the real H; docs(wkclose): closeout of the Arx side of the WisKey live-stream/talk work - identities,  |
| `pilot/WKREPLY-295` | 2026-10-22 | 4 | 1 | KEEP | docs(wiskey): answer table R1-R13 and Hebrew reply prompt for the 22.10 WisKey progress me |
| `pilot/WXROT-2411` | 2026-10-14 | 13 | 10 | KEEP | docs(cr040): key rotation design - atomic switch, bridge-owned trust epoch, UNKNOWN by sta; feat(bridge 0.8.1): trust epoch and atomic key rotation (CR-040) - trust_rotate / trust_st; feat(cr040): bridge trust-key rotation in the add-on - access.trust.rotate, migration 0089 |
| `pilot/WXROT-REBASE` | 2026-10-17 | 9 | 10 | KEEP | docs(cr040): key rotation design - atomic switch, bridge-owned trust epoch, UNKNOWN by sta; feat(bridge 0.8.1): trust epoch and atomic key rotation (CR-040) - trust_rotate / trust_st; feat(cr040): bridge trust-key rotation in the add-on - access.trust.rotate, migration 0089 |
| `pilot/coord-protocol-v2` | 2026-10-20 | 6 | 6 | KEEP | coord: multi-Claude master/sub-developer coordination protocol; feat(coord): two-way task inbox (assign/inbox/accept/done/report) with secret validation; docs(coord): two-way flow, role checklists, task card, merge discipline; dev environment g |
| `release/2120` | 2026-10-21 | 5 | 1 | KEEP | release: 2.12.0 prep - version, bilingual CHANGELOG, release notes, gate 3 runbook |
| `release/2131` | 2026-10-23 | 4 | 4 | KEEP | feat(wiskey): WKB-295 per-station removal proof, durable full original, T06 mapping; fix(wiskey): WKB-295 a queued id without a row keeps the station proof UNKNOWN; feat(wiskey): WKB2-295 seal the intent originals, references only, retention purge, never  |

## 7. Comparison with private/planning/BRANCH_CLEANUP_LIST_2026-10-24.md

- 2026-10-24 basis: origin/main `9d4e54439`, 303 remote heads (186 MERGED, 113 LIVE, 2 DEAD by its own rules: DEAD = no commit in 7 days and all commits patch-equivalent in main). Today: 348 remote branches, an increase of 45 in three days.
- Old list remote rows: 301 (DEAD 2, LIVE 113, MERGED 186).
- Branches in the old list that no longer exist on origin: 105 (`pilot/ACCESSREQ-293`, `pilot/AUTODOORS-295`, `pilot/BGFIX-293`, `pilot/BREAKUI-295`, `pilot/BULKPEOPLE-295`, `pilot/CAMVF-295`, `pilot/CLEANUP-295`, `pilot/CLOCK-293`, `pilot/DATASTORE-295`, `pilot/DDAREA-295`, `pilot/DIRPERM-295`, `pilot/DOCS2111-295`, `pilot/DOORHARD-295`, `pilot/DOORWIN-295`, `pilot/DOORWIN-spec`, `pilot/DOORWIN-w0`, `pilot/DOORWIN2-295`, `pilot/DOORWIN3-295`, `pilot/DWFIX-295`, `pilot/ECCACT-295`, `pilot/ELECNOTE-295`, `pilot/ELEVDOORS-293`, `pilot/ENTPOL-295`, `pilot/EXTID-295`, `pilot/F3A-295`, `pilot/F3B-295`, `pilot/F3C-295`, `pilot/FABLEFIX-295`, `pilot/FABLEFIX-D04-295`, `pilot/FRIGATE-295`, `pilot/FRIGLIVE-295`, `pilot/G2FIX-295`, `pilot/GATE3FIX-295`, `pilot/GATEHYGIENE-291`, `pilot/GENALERT-295`, `pilot/GENWIDGET-293`, `pilot/GRANTDENY-295`, `pilot/GRANTS3-295`, `pilot/GRANTSMIN-295`, `pilot/GUIDES2120-295` ...).
- Branches new since the old list: 152.
- Branches LIVE/DEAD on 2026-10-24 that are now MERGED into main: 39 (`pilot/APPREFRESH3-295`, `pilot/CAMHEALTH091-295`, `pilot/CAMSUGGEST138-295`, `pilot/CRITSOUND124-295`, `pilot/EMERGREADY104-295`, `pilot/ENTIDSWEEP-295`, `pilot/GENLOG092-295`, `pilot/GUIDETEMP-295`, `pilot/INSIGHT215-295`, `pilot/INSIGHT215B-295`, `pilot/INTAKE99-295`, `pilot/KEYROT-FIX-295`, `pilot/LIVEEVENT100-295`, `pilot/LIVEEVENT100B-295`, `pilot/LOGOS-295`, `pilot/LOGOS295B`, `pilot/NIGHTLYFIX-295`, `pilot/NOTICE106-295`, `pilot/NOTICE106B-295`, `pilot/OCR119-295`, `pilot/PARTNERAPI113-295`, `pilot/POLISH136-295`, `pilot/PREGATE264`, `pilot/READY96-295`, `pilot/SCENARIO109-295`, `pilot/SERVICEIA3-295`, `pilot/TENANTINTAKE098-295`, `pilot/TESTDEBT4-295`, `pilot/TESTSTAB-295`, `pilot/TIMESCRUB101-295`, `pilot/TIMESCRUB101B-295`, `pilot/UPSTREAM-295`, `pilot/VISITOR105-295`, `pilot/VOICE143-295`, `pilot/WATER78C-295`, `pilot/WHITELABEL097-295`, `pilot/WHOIN034-295`, `pilot/XSCENARIO109-295`, `release/2150`).
- Branches MERGED on 2026-10-24 that are no longer merged: 0.
- Differences in method: the old list also covered local branches and worktrees (not repeated here); it used a 7-day dead threshold, this one applies the 14-day stale threshold requested by the task and adds tag containment. The old list never recommended deleting anything on origin; the same applies here until the owner approves.

## 8. Deletion commands - NOT EXECUTED

These commands are listed for the owner. Nothing here has been run. They cover only the SAFE-TO-DELETE rows of section 3. Re-run the inventory immediately before executing, because agents may have pushed since 2026-10-27, and never include ACTIVE or PROTECTED branches.

```sh
# NOT EXECUTED - review first
git fetch --prune origin
git push origin --delete archive/bubble-skin-v2.23.0 integ/2100 integ/2101 integ/2102 integ/2111 integ/263 integ/264 integ/270 integ/271 integ/272
git push origin --delete integ/273 integ/280 integ/281 integ/282 integ/290 integ/290-rel integ/291 integ/291-baselines integ/291-rel integ/292
git push origin --delete integ/292-rel integ/293 integ/293-rel integ/WK-2170 pilot/ACCEPT102-295 pilot/ADOPTR6-295 pilot/ANNOUNCE-295 pilot/ANNOUNCEB-295 pilot/APPREFRESH-295 pilot/APPREFRESH2-295
git push origin --delete pilot/APPREFRESH2B-295 pilot/APPREFRESH3-295 pilot/ASGI-295 pilot/AVW10-295 pilot/BKPFIX-295 pilot/BLUEPRINT80-295 pilot/BUBBLEFREEZE-295 pilot/BUSRT-295 pilot/BUSTIMES-295 pilot/BUSTIMES-295-r
git push origin --delete pilot/BUSVERIFY-295 pilot/CAMHEALTH091-295 pilot/CAMSUGGEST138-295 pilot/CAPEMERGENCY-295 pilot/CAPEMERGENCY2-295 pilot/CAPMAP-295 pilot/COMPLY108-295 pilot/CRITRELAY217-295 pilot/CRITSERVER217-295 pilot/CRITSOUND124-295
git push origin --delete pilot/CRITSOUND124B-295 pilot/DATEFMT60-295 pilot/DENYALERT133-295 pilot/DIALOGSOLID-295 pilot/DOCLINKSEC-295 pilot/DOCSHOTS053-295 pilot/DOCSUX-295 pilot/DROPDOWNFIT-295 pilot/ELECBILL77-295 pilot/EMERGREADY104-295
git push origin --delete pilot/EMROLE-295 pilot/ENTIDSWEEP-295 pilot/FIN2190-295 pilot/FIX2180-295 pilot/FIX2200-295 pilot/FIX2210B-295 pilot/FIX2211-295 pilot/FIX2220-295 pilot/FIX2230-295 pilot/FIX2231A-295
git push origin --delete pilot/FIX2231B-295 pilot/FIX2231C-295 pilot/FIX2232A-295 pilot/FIX2232B-295 pilot/FIXTKNAME-295 pilot/FLAKES-295 pilot/FLEET215-295 pilot/FRIGATE2-295 pilot/FRIGLIVE2-295 pilot/FRIGPERM-295
git push origin --delete pilot/GATEFIX2140-295 pilot/GATEFIX2150A-295 pilot/GATEFIX2150B-295 pilot/GATEFIX2150C-295 pilot/GENELEV-295 pilot/GENLOG092-295 pilot/GUIDETEMP-295 pilot/HDRFIX-295 pilot/HOME-295 pilot/HOMEINFO-295
git push origin --delete pilot/IDENT146-295 pilot/INSIGHT215-295 pilot/INSIGHT215B-295 pilot/INTAKE99-295 pilot/KAV079-295 pilot/KAVDEVTEST-295 pilot/KAVLEFT-295 pilot/KEYROT-FIX-295 pilot/KEYROT-HARNESS-295 pilot/LEASELIFE-295
git push origin --delete pilot/LIVEEVENT100-295 pilot/LIVEEVENT100B-295 pilot/LOGOFIT-295 pilot/LOGOFIX-295 pilot/LOGOKIT-295 pilot/LOGOS-295 pilot/LOGOS295B pilot/LOGOSIDE-295 pilot/MAINT215-295 pilot/MAINT215B-295
git push origin --delete pilot/MASKCOPY62-295 pilot/MOBILE214-295 pilot/MUTEFIX-295 pilot/NIGHTLYFIX-295 pilot/NOSCROLL-295 pilot/NOTICE106-295 pilot/NOTICE106B-295 pilot/NOTICEADD-295 pilot/NOTICECAPS-295 pilot/NOTICEDEL-295
git push origin --delete pilot/NOTICEGB-295 pilot/NOTICEPAGE-295 pilot/NOTICEPERM-295 pilot/NOTICEPOLISH-295 pilot/NOTICEPUSH-295 pilot/NOTICEREMOVE-295 pilot/NOTICERSS-295 pilot/NOTICESAVER-295 pilot/NOTICESLIDES-295 pilot/OCR119-295
git push origin --delete pilot/PACING12-295 pilot/PARTNERAPI113-295 pilot/PEERQUERY-295 pilot/PERMCAM63-295 pilot/PHYSENTRY070-295 pilot/PHYSENTRY070B-295 pilot/PIXEL2201-295 pilot/POLISH-295 pilot/POLISH136-295 pilot/POLISH2-295
git push origin --delete pilot/PREGATE264 pilot/PRESENCE307-295 pilot/PRESUNAVAIL-295 pilot/PRESUNAVAIL2-295 pilot/PREVIEWONLY-295 pilot/PUSHSVC-295 pilot/PWCLEAN-295 pilot/QUARANTINE-295 pilot/QUIET103-295 pilot/R2160B-BE-295
git push origin --delete pilot/R2160B-FE-295 pilot/READY96-295 pilot/READYFLEET-295 pilot/SAFE1-295 pilot/SAFE2-295 pilot/SCENARIO109-295 pilot/SERVICEIA1-295 pilot/SERVICEIA2-295 pilot/SERVICEIA3-295 pilot/SESSIONEXCH2-295
git push origin --delete pilot/SESSIONEXCH217-295 pilot/SHIFT114-295 pilot/SMALLA-295 pilot/SMALLFIXA-295 pilot/SMALLFIXB-295 pilot/STALETESTS-295 pilot/SVC215-295 pilot/SVC215B-295 pilot/SWITCHUI-295 pilot/SXFIX-295
git push origin --delete pilot/T06ADMIT-295 pilot/TEMPLINK-295 pilot/TENANTINTAKE098-295 pilot/TESTDEBT4-295 pilot/TESTFIX-MAINTTAGS-295 pilot/TESTFIX2171-295 pilot/TESTSTAB-295 pilot/TIMESCRUB101-295 pilot/TIMESCRUB101B-295 pilot/TOPPILL-295
git push origin --delete pilot/TPLV2-295 pilot/TVOPT-295 pilot/UI2122-295 pilot/UPSTREAM-295 pilot/VENDORARRIVAL126B-295 pilot/VISITOR105-295 pilot/VOICE143-295 pilot/W031-295 pilot/W10CLIENT-295 pilot/WALINK-295
git push origin --delete pilot/WAPACE-295 pilot/WATER78-295 pilot/WATER78B-295 pilot/WATER78C-295 pilot/WHITELABEL097-295 pilot/WHOIN034-295 pilot/WK4ADOPT-295 pilot/WKA-295 pilot/WKADAPT-295 pilot/WKAUDIN-295
git push origin --delete pilot/WKB3-295 pilot/WKCAP-295 pilot/WKCAPWIRE-295 pilot/WKDIRECT-295 pilot/WKF01F02-295 pilot/WKLIVE-295 pilot/WKOPENUNK-295 pilot/WKR5-295 pilot/WKR5ADOPT-295 pilot/WKVEC-295
git push origin --delete pilot/WKWRITE-295 pilot/XSCENARIO109-295 pilot/ZONECOUNT107-295 rel2140fix-work
```

Security note: this document contains branch names, dates and counts only; no hosts, addresses, credentials or serial numbers.
