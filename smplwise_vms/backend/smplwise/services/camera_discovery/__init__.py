"""Camera discovery on the site's network, phase 1 (ONVIF-DISCOVER-2500; design docs/design/onvif-discovery-2412/DESIGN.md, owner
decisions 2026-11-22 Q54-Q61).

  wsd.py         the WS-Discovery Probe Arx sends and the defensive reader of a device's ProbeMatches answer; recorder recognition
  ranges.py      which addresses a scan may probe: only the site's own network (the host's interfaces), at most 1,024 addresses
  sweep.py       the paced unicast sweep over UDP 3702 (two rounds, listen window, cancellation) and the optional HTTP fallback
  onvif_http.py  the two device-service reads: GetSystemDateAndTime (no credentials) and ONE GetDeviceInformation (PasswordDigest)
  known.py       already known devices: without a recorder / through a recorder / the recorder itself (memory, keyed fingerprints)
  service.py     the scan job (memory, TTL), the one-attempt credential rule and lockout guard, limits, RBAC and audit (MANAGER)

Nothing here writes to a camera, a recorder or go2rtc, and nothing is saved but audit rows. The routes are the ONVIF-API row.
This file imports nothing (services/autosync.py imports `known` from the recorder discovery)."""
