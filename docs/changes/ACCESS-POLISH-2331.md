# ACCESS-POLISH-2331 - people and access administration, wave 1

Branch `pilot/ACCESS-POLISH-2331` (from `origin/main` @ 52a8d9129). No version bump, no merge.

Scope: `system-access.ts` (Settings > Users and permissions, all tabs), its sub-panels `system-access-*.ts` except
`system-access-control.ts`, `access-external.ts`, `system-access-messaging.ts`, `system-local-users.ts`,
`system-presence-places.ts`. Shared design tokens, shared `sw-*` components, shell and system navigation are untouched;
where a shared change looked useful it is listed under "Proposals" below.

Evidence: `docs/evidence/ACCESS-POLISH-2331/before/` (and `.../after/` once the runner runs the AFTER phase:
`SW_SHOT_PHASE=after`) - the same captures, from
`frontend/tests/evidence-access-polish-2331.spec.ts` (mocked backend, invented sample data), at 1440 / 1920 (desktop
project), 1180 / 1024 (tablet project) and 390 (mobile project). Each phase also has `metrics-<project>.json`: the
vertical overflow of the shell's main area, the document and any sideways scroll for every capture.

## Critique (before)

Measured on the before build; "main" = how far the shell's main area scrolls.

### Users and permissions (`system-access.ts`) - the weakest screen of the wave

1. **The user / group drawer was not reachable on a phone.** The drawer was a non-modal `sw-drawer` placed absolutely
   inside a `.stage` box; on a phone its bottom sheet is anchored to the bottom of that box, not of the viewport. With six
   users the stage is ~1,400 px tall, so tapping a user opened a sheet far below the fold (`access-user-drawer-390`: the
   screenshot shows the list, no sheet). On desktop the drawer covered the table's role column and its footer (the
   actions) sat at the bottom of the stage, below the fold for longer lists.
2. **Fixed `min-block-size` 420 / 620 px stages** reserved room for that absolute drawer: short lists ended in a large
   empty band, and the groups tab scrolled on every desktop width (`access-groups-1440`: main 145 px) only because of it.
3. **Phone users list: one card per user ~700 px tall** (name, role, groups, state, sync, last seen, remote, last remote
   sign-in, each label on its own line): six users = 1,399 px of scroll. Groups, sync and remote access are all repeated
   in the user's drawer.
4. **Roles cards used the danger colour for neutral text**: a custom role's own description and the "second factor at
   remote sign-in" policy line were set in the red "not included" style - they read as warnings.
5. **Section labels as copy-pasted inline styles** (`font-weight:600;font-size:...` a dozen times) with uneven spacing
   between drawer sections; the effective-permissions columns had the same.
6. **Effective permissions, idle state** was one grey sentence under the toolbar - no empty-state panel like the other
   tabs.
7. **Drawer footers**: the action buttons were inline elements with no gap control; "delete group" (danger) sat flush
   against "save members" / "assign role".
8. **Status line**: `.msg` had no style (plain coloured text); the remote-access result message was set without the
   3.5 s clear the other messages use, so it stayed until the next action.
9. "Effective permissions" in the user drawer switched the tab without writing the address (the deep link stayed on
   the users tab) and left the drawer state behind.
10. The group impact dialog (shown before every group change) is a fixed `sw-dialog`; it is opened from inside the group
    drawer.
11. **A deny binding looked like a grant in the lists**: the users table's "role · scope" column and the groups table's
    bindings column printed a deny ("חסימה") binding exactly like an allow one (only the drawer row carried the badge).
12. The settings screens may name Home Assistant (owner rule 2026-09-29) - the many "HA" mentions here are allowed and
    were kept.

### Arx users (`system-local-users.ts`)

1. Loading showed a bare "…"; a load failure a red note with no retry; the empty list a grey sentence.
2. The selected user's panel had no title row and **no way to close it** (only selecting another user).
3. **The passkey-first checkbox was a 100 % wide, 40 px tall field** (the label rule styled every `input`, the
   `label.check` class it used was never defined).
4. Seven actions in one row with the destructive "delete" between everyday ones; no separation between the actions and
   the reset / WhatsApp / passkey sections.
5. The create form had no title or close control (only "cancel" at its bottom).
6. No visible focus ring of the component's own inputs beyond the browser default.

### Places (`system-presence-places.ts`)

1. The save button is disabled while there are no changes or while an entry has a problem, with no text saying which
   (the problem itself is shown inline on the entry, possibly in another card).
2. The success message used `--sw-live` (the live-video dot colour) instead of the success text token.
3. An open editor could only be closed with its "done" button (no Escape).

### Access control sub-panels (status, health, audit, groups, policy, messages), parity, display, external access

These were polished in earlier rounds (CR-036 S10-S12, WA, SHAREDUI-295, GRANTS3-295, EXTERNALBUILD-297): skeleton
loading, typed failure panels with retry, stale notes, 44 px targets, modal drawers, phone layouts. Findings, kept as
proposals because the strings / layouts are pinned by pixel baselines and owner-approved mockups:

1. Groups tab: the card subheadings show the integration's read names (`profiles/settings_get`, `profiles/versions`);
   the status tab does the same for some cards (`healthSub`, `alertsSub`, `conflictsSub`). Technical, but the
   settings screens may carry technical names - left for an owner decision.
2. External access (`/wiskey/external`) scrolls the main area at every width (1440: 506 px, 1024: 1,149 px, phone:
   3,924 px). It is a working list (grants), not a live-control screen; a no-scroll layout (list scrolling inside its
   card) would change an owner-approved mockup - proposal only.
3. Messages scrolls at 1440 (1,297 px): a long settings form - expected for a settings page.

## Changes

`system-access.ts`
- User and group drawers are **modal** (`sw-drawer modal`): fixed to the viewport (side panel / phone bottom sheet), focus
  moves in and is trapped, Escape and the backdrop close it, focus returns to the row, the footer actions are always in
  view. The group impact dialog renders inside the open group drawer (the modal drawer makes the page behind inert); with
  no drawer open it renders where it did.
- A deny binding is marked "· חסימה" (danger colour) in the users and groups tables (`data-binding-deny`).
- `.stage` min-heights removed (no empty band, the groups tab no longer scrolls at 1440).
- Phone (<= 767 px): the users table drops the groups / sync / remote columns (all three are in the drawer).
- Roles: the custom role's description in neutral text, the second-factor policy line neutral, the card actions as a class.
- One `.sec` section label for drawers, the wizard and the effective-permissions card; "Members · n" shows the live count.
- Drawer footers: one flex row with a gap; "delete group" at the far end.
- Effective permissions idle: an empty-state panel (shield icon, what the calculation shows).
- Status line: success / error messages as soft chips; the remote-access result clears like the others.
- "Effective permissions" from the drawer writes the tab to the address and closes the drawer.

`system-local-users.ts`
- Loading / load error (with retry) / empty as `sw-state-panel` (compact).
- The selected user's panel: a title row with the state badge and a close button; "delete" stands apart at the end of the
  action row; a divider between the actions and the reset / WhatsApp / passkey sections.
- The create form: a title row with a close button.
- `label.check` defined: the passkey-first checkbox is a 20 px box beside its text.
- Focus ring on the component's inputs and selects (`--sw-focus`).

`system-presence-places.ts`
- Next to the save button: "unsaved changes", or how many problems block the save (marked in the lists).
- The success message uses `--sw-success-text`.
- Escape closes the open editor (the edit stays, unsaved, as with "done").

Every existing `data-*` hook kept; no feature, setting or data removed.

## Proposals (shared code, not changed here)

- `sw-table`: a per-column `hideBelow` (or `priority`) option, so screens drop secondary columns on a phone without their
  own media query (done locally in `system-access.ts`).
- `sw-drawer` footer: a slotted footer container is a flex item, so `margin-inline-start: auto` inside it does nothing; a
  `footer-end` slot for destructive actions would make the pattern uniform.
- `sw-state-panel` inside a drawer / card: a `size="inline"` between `compact` and the default.

## Pixel baselines likely affected

- `tests/pixel-access-status.spec.ts`, `tests/pixel-access-s12.spec.ts`, `tests/pixel-wiskey-messaging.spec.ts`: no
  change expected (their components were not edited) - listed because they share the settings page.
- Any baseline of `#/system/access` (users / groups / roles / effective / audit / Arx users) and
  `#/system/diagnostics?tab=mobile&page=places`: the layout changed (stage heights, role card text colour, drawers,
  the places footer). Grep: `layout-worstcase-screens-297.spec.ts` (`access`), `screens.spec.ts` (`sc24-access`),
  `layout-visdiff-246.spec.ts`, `evidence-whoin034-295.spec.ts` (places shots, not pixel-compared).
- Per the owner rule (30.10) the branch refreshes its baselines on the runner before joining a train - not done here
  (no runner for this task).

## Tests

The workstation ran out of memory during this task (16 agents); the coordinator stopped all local builds, previews and
Playwright evidence runs. What ran, with real totals:

| Run | Result |
| --- | --- |
| `npx tsc --noEmit` on the final code | PASS (exit 0) - a first run caught 5 implicit-any errors from the phone column filter, fixed in the same commit |
| `unit-token-lint` + `unit-lead-reserve` + `unit-uxfix-rtl` (`--workers=1`, final code) | 25 passed |
| the same three + `unit-uxrest2-295` + `unit-whoin034-295` + `unit-role-editor-legacy` (on the code before the last two edits: deny marker, Arx-users phone columns) | 47 passed |
| `evidence-access-polish-2331.spec.ts`, BEFORE phase (vite preview of the unmodified build on 4203, 3 projects) | 21 / 21 passed - captures and `metrics-*.json` in `before/` |
| `evidence-access-polish-2331.spec.ts`, AFTER phase | NOT_RUN (no local build allowed) - `after/` is empty; runs on the runner |
| existing evidence / page specs of these screens: `unit-second-factor-admin-ui` (user drawer, now modal), `layout-worstcase-screens-297` (`WC_USERS_ONLY=1`), `evidence-whoin034-295` (places), `evidence-access-status`, `evidence-access-s12`, `evidence-wiskey-messaging-settings`, `evidence-accessreq-293`, `unit-arx-local-login` (Arx users) | NOT_RUN - for the runner gate |

Points for the runner run to watch: the user / group drawers are now `modal` (top layer): a spec that clicks a table row
while a drawer is open must close it first (the existing ones do - "סגור"); `[data-group-impact]` is now inside the group
drawer when it is open (same shadow root, the selector is unchanged).
