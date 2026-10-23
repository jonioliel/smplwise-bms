# CR-MASKCOPY62 - copy privacy masks from one camera to several cameras

Status: SLICE 1 BUILT (plan / preview only) on pilot/MASKCOPY62-295, from main v2.12.4 (320e5555). Board item r062.
Not live: the plan route is behind the switch `nvr.privacy_mask_copy` (default `false`), and **no device write exists in this
slice**. No device write is executed overnight or by any agent; a write happens only through the existing approved write path
(`services/nvr_privacy.write_camera`) with the owner's per-action approval.

## 1. Goal

Today a privacy mask is edited one camera at a time (NVRMASK-295 / MASKUI-295). Sites with several cameras on the same scene
(a corridor, a lobby from two angles, identical cameras on a facade) need the same blacked-out areas on all of them. This
change lets an administrator pick a source camera and a set of target cameras and see, per camera, exactly which masks each
target would end up with, before anything is written.

## 2. What exists and is reused

- Model: the device's `privacyMask` document per channel - master switch plus up to N regions (default 4) of four points in a
  normalized frame (704x576 on the lab family); `services/nvr_privacy.py` (`read_mask`, `view`, `validate`, `state`, `etag`,
  `document`, `write_camera`, `restore_change`), permission `nvr.config.privacy` (sensitive, installation scope AND per camera).
- Device quirks (docs/legacy/KNOWN_QUIRKS.md): capabilities answer 403 so the limit falls back to 4x4; the region flag reads
  `false` while masking (only the master counts); PUT merges, removal is DELETE per region.
- Write path (not changed here): `/nvr/privacy-masks/preview` + `/apply` - literal `confirm: true`, etag per camera, one camera at
  a time, partial apply (skip stale/invalid, stop at the first failed write), verify read-back, automatic restore, a row in
  `nvr_changes` and one-step undo (`/nvr/changes/{id}/rollback`).
- CR-020 rules reused: preview before write, partial apply with a per-camera result, undo, and "the owner does the first lab write".

## 3. How masks map between cameras

Regions are stored in each device's normalized frame, so a region is mapped by scaling each axis: `x' = round(x * Wt / Ws)`,
`y' = round(y * Ht / Hs)`, clamped to the target frame. There is no rotation, mirroring, crop or lens-distortion correction.

**Warning (shown on every plan, `scene_must_match`):** normalized coordinates describe a place in the picture, not an object in
the world. A copied mask is geometrically right only when the target camera views the same scene from the same position with
the same field of view and orientation. With a different FOV, mounting height or angle the mask will cover the wrong area -
it can hide nothing that needed hiding, or hide something that must stay visible. Therefore:

- every plan has `confirmation_required: true`; the later apply needs the literal confirmation and the `plan_digest` of the exact
  plan shown (a changed source or target etag invalidates it);
- the person reviews a **per-camera preview** (before / after regions drawn on that camera's own picture in the UI slice);
- when the normalized frames differ the plan adds `frame_differs`; the UI slice must make that step explicit.

Per target the plan is validated with the existing device rules (`nvr_privacy.validate`: four points, inside the frame, convex,
at least 4 units wide and high, at most the target's region limit). Modes: `add` (default, keeps the target's existing regions,
never removes a mask, identical regions are not duplicated) and `replace` (the target ends with exactly the copied regions).
Statuses: `ready`, `unchanged`, `invalid` (a scaled region fails the rules, e.g. too small), `conflict` (more regions than the
target allows, or the target already holds a region that fails the rules), `skipped` (the target cannot be read / no mask support).

## 4. Permissions and safety

- `nvr.config.privacy` at installation scope and on the source AND every target camera (403 audited before any device call; also
  needed to read the source mask because it reveals what is private).
- Local-only (the `/api/v1/nvr/privacy-masks` prefix is already in `remote_channel.BLOCKED_ON_REMOTE`).
- Slice 1 performs GET reads only (`privacyMask` and its capabilities) through the existing reader; no PUT/DELETE, no go2rtc, no
  NVR configuration. The plan responses and the audit row carry no device address, credentials, serial or MAC.
- Default OFF: `nvr.privacy_mask_copy` = `false` -> 409 `feature_disabled` and no device read. The apply slice will additionally
  require `nvr.privacy_mask_write` = `true` (the existing write switch).
- Audit: action `nvr.privacy_mask_copy` (stage, mode, target count, counts per status; never coordinates). Applied copies (slice 2)
  are normal `nvr_changes` rows, one per camera, each undoable.

## 5. API (slice 1)

`POST /api/v1/nvr/privacy-masks/copy/plan` `{source_camera_id, target_camera_ids[1..64], mode: add|replace}` ->
`{stage:"plan", device_write:false, confirmation_required:true, warnings[], mapping, source{...}, items[{camera_id, status, frame,
frame_differs, max_regions, before, after, added, removed, etag, problems|details|reason}], ready, unchanged, invalid, conflict,
skipped, plan_digest}`. 422 when the source is also a target, a camera repeats, or the source has no active mask.

## 6. Tests plan

Slice 1 (`tests/test_mask_copy.py`, fake NVR from NVRMASK-295): axis scaling and clamping; add / replace; unchanged; conflict over
the limit; invalid after scaling; different frame; digest; switch default off and no device call; GET-only plan with zero writes;
audit without coordinates; RBAC (403 before any device call, sensitive grant works); local-only.
Slice 2: apply with plan_digest + etags, partial apply, stop-at-first-failure, undo of each camera, stale detection.
Slice 3 (UI): per-camera preview drawn on each camera, explicit scene confirmation, he/en/ar/ru, RTL, 44 px targets; evidence set.
Lab: **only the owner performs the first real write**, on a camera of his choice, with a one-step undo ready.

## 7. Slices

1. Backend plan / preview, no write (this change).
2. Backend apply through `nvr_privacy.write_camera` per camera (reuses preview/apply guards), still behind both switches; built and
   tested on fakes only.
3. Frontend: source/targets picker, per-camera preview, confirmation, results and undo.
4. Owner-supervised first lab write.

## 8. Owner questions (recommendation first)

1. Default mode: a) `add` - never removes a target's existing mask (recommended); b) `replace`.
2. Targets with a different normalized frame: a) allow with the explicit frame warning (recommended); b) refuse.
3. Must the person tick "these cameras view the same scene" per target camera: a) yes, per target (recommended); b) once for all.
4. Switch name/placement: a) separate `nvr.privacy_mask_copy` (recommended); b) reuse `nvr.privacy_mask_write`.
5. Who may copy: a) only `nvr.config.privacy` holders (recommended); b) also site administrators.
