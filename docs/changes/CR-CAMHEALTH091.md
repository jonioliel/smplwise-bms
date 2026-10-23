# CR-CAMHEALTH091 - camera image health (board r091, target 2.17.0)

Branch `pilot/CAMHEALTH091-295`. Is the PICTURE of a connected camera usable: dark, blurred, frozen or shifted away from its reference view.
Shipped **OFF**.

## Load rule (owner: no extra load on the recorder; device access read-only)

One JPEG per sample, at a low rate (default every 15 minutes per camera, at most 6 cameras per 30 s pass, 1 s between grabs). Sources, in order:

1. the add-on's own snapshot cache (`<data>/snapshots/<camera>.jpg`) when it is newer than the camera's last sample - no device I/O;
2. the camera's **existing** go2rtc sub stream `smplwise_<recorder>_ch<n>_sub`, asked for by name only (`GET /api/frame.jpeg?src=<name>`,
   `Go2rtc.frame_existing`). No source URL is sent, so nothing is created, registered, re-pointed or deleted; a name outside `smplwise_` is
   refused. With **only streams already playing** (`passive_only`) a stream is used only while go2rtc already holds it open.

Never called: the recorder's picture endpoint (ISAPI `.../picture`, a main-stream decode on the device), any write, any stream outside the
namespace. Honest note: without `passive_only`, a grab of a sub stream nobody is watching makes go2rtc open the sub stream for a few seconds
(one keyframe). That is the cheapest stream the recorder serves; `passive_only` removes even that.

## Checks (`services/camera_image_health.py`, Pillow + numpy - both already dependencies)

| Problem | Measure | Default (Settings range) |
|---|---|---|
| dark | mean brightness 0-255 | below 20 (0-128) |
| blurred | variance of the 4-neighbour Laplacian at <= 320 x 240; not judged on a dark picture | below 25 (0.5-5000) |
| frozen | mean absolute difference to the previous sample at 128 x 96, N samples in a row; not judged on a dark or blurred picture | below 0.4 (0-20), 3 samples (2-20) |
| shifted | best translation vs the reference thumbnail (64 x 48, normalised cross-correlation, +-25 %); not judged on a dark or blurred picture | moved > 8 % (1-25) or best match < 0.45 (0.05-0.95) |

dark / blurred / shifted must hold `confirm_samples` (2, 1-10) samples in a row; a notification resolves after the condition stayed clear for
`recover_s` (1800 s, 0-86400). Each check can be switched off; cameras can be excluded (a PTZ camera that moves on purpose). Sampling interval
300-86400 s; cameras per pass 1-50.

## Reference view

Table `camera_image_refs` (migration **0163**, built as provisional 0191; renumbered at the 2.16.0 integration, release/2160): one 64 x 48
grayscale thumbnail per camera, never a full picture. The first usable sample becomes the reference automatically; an administrator may set it
from the latest sample or clear it (camera drawer on בריאות מצלמות; audited).

## Alert

Notification source `camera.image` (device faults, alert, inbox; one row per camera and problem, subject = the camera). Recipients and channels
are the source's notification policy, editable in the settings card (rule + selected users) or in the notifications settings. Default
recipients: managers. While the switch is off nothing is due, so every open row resolves.

## API

`GET /camera-image-health` (cameras the caller may watch live), `POST /camera-image-health/check` (system.configure, 409 while off, at most every
30 s), `GET|PUT /camera-image-health/settings` (system.configure, audited), `POST /camera-image-health/{camera_id}/reference`
`{"action": "set"|"clear"}` (system.configure, audited). Names, states and numbers only - never an image, an address, a credential or a source.

## UI

- בריאות מצלמות (`#/investigate/health`): one compact row (counts per problem as filter chips, last check, "check now"), a "תמונה" column, and
  the picture rows + reference buttons in the camera drawer. No new scrolling.
- הגדרות › בריאות ועבודות: card "בדיקת תמונת המצלמות" - the switch, only-playing streams, every threshold, the checks, excluded cameras, the
  alert recipients.

Strings: `frontend/src/i18n/camera-image-health.ts` (Hebrew, English).

## Tests

`smplwise_vms/backend/tests/test_camhealth091_295.py` (synthetic pictures generated in the test), `frontend/tests/layout-camera-image-health.spec.ts`.
