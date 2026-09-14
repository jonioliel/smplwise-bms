# SMPLWISE VMS add-on (pilot 0.1.0)

Map-centred video management for a Hikvision NVR, served inside Home Assistant through Ingress.
This build contains the catalogue (sites → buildings → floors), architectural plan import (PDF / PNG /
JPG with page selection, rotation and crop), camera placement with view cones, server-side roles and
scopes, and an audit log. Live video, playback and events arrive in the following builds.

## Installation

1. Settings → Apps → App store → ⋮ → **Repositories** → paste
   `https://github.com/jonioliel/smplwise-bms` → **Add**.
2. Install **SMPLWISE VMS**. The Supervisor builds the image locally (a few minutes on first install).
3. Open the add-on **Configuration** tab:
   - `bootstrap_admin_username` — the Home Assistant **username** (not display name) that becomes the
     VMS system administrator. The grant happens once, on that user's first visit, and is written to
     the audit log. Leave everything else empty for now if you only want to try the maps.
   - `nvr_host`, `nvr_http_port`, `nvr_username`, `nvr_password` — read-only ISAPI access used by
     "Sync cameras". Prefer a dedicated non-admin NVR account. The add-on never changes NVR settings.
   - `go2rtc_url` — reserved for the live-video build.
4. Start the add-on and open it from the sidebar (**SMPLWISE VMS**).

## Identity and access

- Users are Home Assistant users. The Supervisor forwards the authenticated user with every Ingress
  request; the add-on trusts that identity only when the request comes from the Supervisor proxy.
- Nobody has access until a VMS administrator assigns a role in a scope (site, building, floor).
  Home Assistant admin status grants nothing inside the product, and the product never changes HA
  users, groups or admin flags.
- Every decision, upload, publish and placement is recorded in the audit log (no secrets).

## Data and backups

- Everything lives in `/data` (SQLite database + original plan files + derived images) and is
  included in Home Assistant backups (`backup: hot`).
- Original plan uploads are never modified; backgrounds are derived and can be regenerated.

## Limits in this build

- Uploads: PDF/PNG/JPG up to 40 MB, PDF up to 20 pages; SVG and DWG/DXF are rejected.
- PDF rasterization runs in a separate process (pdftoppm) with a 30 s limit.
- No live video or playback yet; camera tiles show illustrated placeholders tagged "דמו".

## Troubleshooting

- "Home Assistant לא העביר זהות משתמש": the Supervisor did not send the `X-Remote-User-*` headers.
  Update Supervisor/Core; the add-on refuses to guess an identity.
- "אין הרשאה": your HA user has no VMS role yet — ask the VMS administrator (bootstrap user).
- Logs: the add-on **Log** tab; set `log_level: debug` for request-level detail (never prints secrets).
