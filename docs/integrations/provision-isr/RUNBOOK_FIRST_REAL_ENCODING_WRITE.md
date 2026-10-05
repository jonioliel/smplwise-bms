# Runbook - the first real encoding write on the Provision-ISR NVR (CR-025 NN2B)

**Who runs it:** the owner, at his keyboard, one camera, one stream. **What it proves:** that `SetVideoStreamConfig` on the
owner's NVR (NVR8-16400AN, firmware 1.4.7, API v1) accepts the body Arx builds, that the device applies exactly the asked
fields, and that the exact restore works. Until this is done every statement about encoding writes on a real Provision unit is
**not verified on a real device** (CR-025 section 6.7). Nothing here is run by an agent.

**What is written:** one `SetVideoStreamConfig/<channel>` request for one stream, one field changed (a bit rate or a GOP value
that is within the device's own published range), then - after the check - one more request that puts the old value back.
Nothing else: no network, user, disk, reboot, firmware or recording setting; no go2rtc or Home Assistant change.

## 0. Before you start

1. Pick the camera: an **online** channel you can live without for one minute (the picture of that stream may drop for a few
   seconds while the camera re-initialises its encoder). Prefer a **sub** stream first (lower risk), then a main stream.
   Note the channel number and the stream (`main` or `sub`).
2. Nobody else edits the NVR meanwhile (its own web UI, another Arx session). If a bulk change is running in Arx, wait for it.
3. Terminal at the repository root, project venv. All commands below are the one sanctioned entry point
   `scripts/provision_nvr_write.py` (the permission prompt shows each command; credentials come from `secrets/lab.env`, never
   typed, never printed). Shorthand used here:
   `PW = .venv\Scripts\python.exe scripts\provision_nvr_write.py`
4. Choose a **small, reversible** change. Recommended: the GOP, one step (for example 50 -> 40 on a main stream, 12 -> 10 on a
   sub stream) or the bit rate one step down. Not a codec, not a resolution (those restart the encoder harder and change what
   go2rtc and the player see). Keep the value inside the camera's own range - the dry run proves it.

## 1. Read-only checks (no write)

```
PW --dry-run set-encoding --channel <N> --stream <main|sub> --set gop=<new value>
```

Expected output, in this order:

- `support: writable; write mode: whole (every stream of the channel, the target edited)` - for firmware 1.4.7 (a v1 device)
  **whole** is right: the request carries every stream of the channel, the target edited, siblings re-sent as read.
  `write mode: partial` only appears on a device that itself lists `SetVideoStreamConfig` in `GetSupportedAPIs` (v2).
- `validation: every value is inside the device's own capability document` (resolution listed, fps within the resolution's
  maximum, bit rate and GOP inside the stream's published bounds, codec token listed).
- `request: POST /SetVideoStreamConfig/<N>` and the redacted `body: ...` - read it. Expect `<streams>` with **no attributes**,
  one `<item id="...">` per stream of the channel (or exactly one for `partial`), only scalar fields (`name` only when it is a
  plain name), no `rtsp://` text, no address.
- `current: {...}` the values read from the device now, and `restore (after a real write): ... writes back {...}` - these are the
  values the restore will put back. Write them down.
- `dry-run: nothing written`.

**Stop (do not write) when:** `support:` says NOT writable (any reason), `validation: REFUSED`, the body has an attribute on
`<streams>`, an unexpected field changed, the `current` values do not match what the NVR's own screen shows for that stream, or
the dry run itself fails (any `stopped:` line, `source_forbidden` = the login is refused: do not retry, check the account).

Optional second read-only check (a baseline for later): in Arx, הגדרות › אבטחה › מצלמות, note the stream's row (codec,
resolution, fps, bit rate, GOP) and take a screenshot of the NVR's own screen for that channel.

## 2. The write (the one approved write)

Same command without `--dry-run`:

```
PW set-encoding --channel <N> --stream <main|sub> --set gop=<new value>
```

What the script does, in order, with no retry anywhere: reads the stream and its etag -> support gate + validation again ->
saves the restore record (`secrets/provision-restore/<entry>.json`) and the device's full item as read
(`private-evidence/provision-isr-live/stream-before-<entry>.xml`, not committed) -> journals `before` -> **one**
`SetVideoStreamConfig` -> reads the stream back -> compares every changed field with what was asked.

Outcomes:

| Printed | Meaning | You do |
|---|---|---|
| `entry <id>: verified {...}  (restore with: restore-from-log --entry <id>)`, exit 0 | the device applied exactly the asked fields | write down `<id>`; go to step 3 |
| `entry <id>: DIVERGED {...}` then `restoring the saved values once` and `restored and verified`, exit 3 | the device took only part of the change; the script already put the old values back, once | stop; send the output to the lead; do **not** run it again |
| `... RESTORE DID NOT VERIFY - stop and check the device`, exit 3 | the restore itself did not read back as asked | stop; check the stream on the NVR's own screen; set the old values by hand there; report |
| `entry <id>: device refused (<code>); nothing was changed on the device`, exit 4 | the NVR answered an error (`nvr_rejected`: values refused; `nvr_not_supported` / `device_refused`: this NVR does not pass writes to this camera - risk R2; `nvr_busy`) | stop; no state changed; report the code (not the address); try **another camera** only after the lead says so |
| `OUTCOME UNKNOWN ... read-only check: stream unchanged / changed / PARTLY CHANGED`, exit 7 | the connection ended after the request was sent; the script read the stream back (read-only) and made **no** further write | decide by hand from that line: `unchanged` -> nothing to do; `changed` -> go to step 3; `PARTLY CHANGED` -> go to step 4 |
| `refused: ...` / `stopped: ...`, exit 2 / 5 | the script refused before the device was touched (bad argument, login refused) | fix the cause; do not loop |

**Stop conditions during the write (any one):** the NVR's own screen shows a different value than the script printed; the
camera does not come back within about 60 seconds; the NVR shows an alarm or reboots; a second request would be needed to
"finish" the change. In all of them: no further write, except the restore in step 4.

## 3. Check and restore

1. Look at the stream in Arx (הגדרות › אבטחה › מצלמות) and on the NVR's own screen: the changed value matches, the others are
   unchanged, live video of the channel still plays (through go2rtc, or the NVR's screen).
2. Put the old value back (the restore is a write too, and also asks at the permission prompt):

   ```
   PW restore-from-log --entry <id>
   ```

   Expected: `entry <new id>: verified {...}` with the values written down in step 1. (Dry run first if you want:
   `PW --dry-run restore-from-log --entry <id>`.)
3. Confirm once more in Arx and on the NVR's screen that the stream is exactly as before step 2.

## 4. If something is wrong (the one allowed repair)

`PW restore-from-log --entry <id>` puts back only the fields the entry changed, from the values read **before** the write. If
that does not verify, set the old values in the NVR's own web UI by hand (they are in the entry's journal line and in
`secrets/provision-restore/<entry>.json`), then stop. Do not attempt other commands; the script has no others for streams.

## 5. Report back (no secrets)

Send: the entry id, the camera/stream (channel number only), the printed outcome, whether the write mode was `whole` or
`partial`, whether the live picture dropped and for how long, and the dry-run `current` / `change` lines. The lead then updates
CR-025 section 6.7 (what is now verified on a real device) and decides whether to turn `writes_enabled` on in Arx for this
recorder (`nvr_extra.writes_enabled: true`, a settings change the owner approves separately).

## What is written to disk

- `private-evidence/provision-isr-live/nvr-write-log.jsonl` - one line per phase, no credential, no address (redacted).
- `private-evidence/provision-isr-live/stream-before-<entry>.xml` - the device's item as read, unmodified (may contain the
  device's own stream name); gitignored.
- `secrets/provision-restore/<entry>.json` - the restore record; gitignored.

## Why one camera, and why these stop conditions

The offline tests prove the request shape against a fake device built from the guide and from what the unit answered on reads
(2026-10-04). Real firmware may differ: it may refuse a whole-`streams` body, apply only part of it, ignore it, drop the
connection, or refuse writes for cameras behind the NVR (risk R2). Each of those has a printed outcome above and none of them is
followed by an automatic second attempt other than the single restore.
