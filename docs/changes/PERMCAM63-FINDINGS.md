# PERMCAM63-295 - personal per-camera permissions x shared spaces (board r063)

Scope: verification only (tests + this note). No product code was changed.
Tests: `smplwise_vms/backend/tests/test_permcam63_shared_spaces.py` (reuses `test_shared_spaces._world`, `_share`, `_binding`).

## Rule under test

CR-009 section 13 "Camera security" says a member camera is visible through a shared space only if the viewer's own camera permissions allow it, and
that the per-person rule lives in one place (`access.camera_scope`, `rbac` camera bindings). In code:

- `rbac.scope_chain('camera', id)` = camera, every floor it is anchored on (plus, via `shared_spaces.camera_shared_floors`, every other floor of a
  shared room it is a *member* of while it is anchored on one of the room's floors), their buildings and sites, the installation
  (`smplwise/rbac.py:170`).
- `access._chains` is the batched twin (`smplwise/services/access.py:46`), `access.camera_scope` the batched decision (`:68`).
- Allow anywhere on the chain grants; a deny binding whose role holds the permission anywhere on the chain wins (`rbac.authorize`, `rbac.py:249`;
  `camera_scope`, `access.py:68`). Membership only adds floors to a chain, never a grant.

## Matrix (34 rows)

Static rows (25, one module world; each asserted on the camera list (map.read), live, snapshot, and the batched scope; the batched scope is also
compared with `authorize` per camera for map.read, video.live, video.playback). Cameras: camH = hall camera on the home floor f2 (member),
camD = member anchored on the other floor f3 only, camA = f2 outside the hall, cam3 = f3 outside the hall. Role is `viewer` unless stated.

| Row | Bindings | Reaches |
|---|---|---|
| A1 | allow camera camH | camH |
| A2 | allow camera camD | camD |
| A3 | allow camera camA | camA |
| A4 | deny camera camH only | nothing |
| B1 | allow f3 | camH, camD, cam3 |
| B2 | allow f2 | camH, camA, camD (camD through the room) |
| B3 | allow f2 + f3 | all |
| B4-B6 | allow building / site / installation | all |
| C1 | allow f3 + allow camera camA | camH, camD, cam3, camA |
| C2 | allow f3 + deny camera camH | camD, cam3 |
| C3 | allow f3 + deny camera camD | camH, cam3 |
| C4 | allow camera camH + deny f2 | nothing (deny wins) |
| C5 | allow camera camD + deny f2 (home floor) | nothing (room puts f2 on camD's chain) |
| C6 | allow camera camH + deny f3 | nothing |
| C7 | allow f2 + deny f3 | camA |
| C8 | allow f3 + deny f2 | cam3 |
| C9 | allow installation + deny camera camH | camA, camD, cam3 |
| C10 | allow installation + deny f3 | camA |
| C11 | allow installation + deny f2 | cam3 |
| C12 | deny installation + allow camera camH | nothing |
| C13 | allow camera camA + deny f3 | camA |
| R1 | allow f3 + deny camera camH with a role holding none of the camera permissions | camH, camD, cam3 (that deny is inert) |
| R2 | allow f3 + deny camera camH with `operator` | camD, cam3 |

Also: camera-only reader sees no neighbour member on the map; operator playback/events follow the same decision.

Structural rows (9, one world each, asserted on the batched scope vs `authorize` and, where relevant, list/live/snapshot):

| Row | Event | Expected |
|---|---|---|
| S1 | member camD removed from the room | home-floor reader loses camD; personal allow keeps it; a home-floor deny stops applying to it (membership only added the floor to its chain) |
| S2 | member camH removed | other floor loses camH; home floor keeps it |
| S3 | camH moved to another floor outside the room | other-floor reader loses it; personal allow follows; other floor's deny no longer reaches it; new floor's reader gains it |
| S4 | non-member camA dragged into the hall outline | no reach widened; the other floor's deny does not reach it |
| S5 | room unshared | members drop; floor reach and room-carried deny end; personal allow stays |
| S6 | room deleted in one step (with_unshare) | same state as unshare |
| S7 | binding revoked; group binding + personal deny; person leaves the group | revoke removes the room reach, personal camera binding stays; personal deny beats the group allow; leaving the group removes the reach |
| S8 | person deactivated | everything gone at once, live 403 |
| S9 | other floor force-deleted | room ends, members end, personal allow stays |

## Result

No real bug found: list, live, snapshot, events and the batched scope agree in every row, a deny always wins, and no row showed a permission
lost or leaked. Two behaviours worth knowing (both follow the documented rule, so asserted as expected, not as xfail):

1. A deny on the home floor reaches an other-floor-only member (C5, S1) only while it is a member; removing the member (or unsharing) lifts that
   deny for that camera. This is the documented "membership only adds floors to the chain" rule, but an owner who relies on a home-floor deny to
   hide the hall's cameras should know that unsharing the room reopens a camera that is also reached by a personal or other-floor allow.
2. The share conversion folds a camera's duplicate anchor on the other floor into its home anchor (CR-009 s5). After unsharing or deleting the
   room, the other floor's reader therefore does not get that camera back (S2, S6). This is documented conversion behaviour, not a permission loss.
