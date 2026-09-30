# WisKey 2.0.0-rc.37 changelog entry (as delivered)

Copied verbatim from the `CHANGELOG.md` of the rc.37 handoff package (2026-09-30). Source: original.

## [2.0.0-rc.37] - 2026-09-30

- Arx request 1: expand the selected camera wall to 12 streams, arrange tiles from measured container width, compact its embedded toolbar, and raise each authenticated MSE/RTC bridge ceiling from 9 to 12 connections. Playback still depends on actual camera, network, browser, and go2rtc capacity.
- Arx request 2: compute automatic overview density from the measured grid and available frame height. Explicit 4/6/8/9/12 selections display the requested number of cards and scroll within the frame when needed.
- Arx request 3: accept optional URL `density` and `wall` values so Arx can restore selections per user; no new WisKey storage or message is introduced.
- Arx request 4: make `embed=1` document and panel edges transparent, remove external host decoration, and accept optional `chrome=none` for zero main padding.
- Arx request 5: Companion authentication forwarding remains a separate integration experiment; it is not implemented in this release.
