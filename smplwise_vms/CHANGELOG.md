# Changelog — SMPLWISE VMS add-on

## 0.1.0 (pilot, in progress)
- Ingress-only FastAPI backend with SQLite in /data and versioned migrations.
- Identity from Supervisor Ingress headers; explicit bootstrap of the first VMS administrator.
- Sites → buildings → floors; plan assets (PDF/PNG/JPG), derived plan versions with rotation/crop,
  draft → published, map anchors with revisions and tombstones; audit log.
- Read-only camera discovery from the NVR (channels, online state, track ids).
- Built web UI (Hebrew, RTL, boards-language) served from the add-on.
