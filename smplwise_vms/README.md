# SMPLWISE VMS — Home Assistant add-on

Map-centred video management for Hikvision NVRs inside Home Assistant (Ingress, HA identity, VMS roles).
See [DOCS.md](DOCS.md) for installation and configuration. Source of the web UI: `../frontend`;
backend: `backend/` (Python 3.12, FastAPI, SQLite). Build the UI into `www/` with
`npm --prefix ../frontend run build:addon` before committing a release.

## Developer loop (workstation, no Docker)

```bash
cd smplwise_vms/backend && pip install -r requirements.txt pytest pymupdf
SW_DEV_USER=<your-ha-username> SW_BOOTSTRAP_ADMIN=<your-ha-username> SW_DATA_DIR=../../data SW_WWW_DIR=../../frontend/dist python -m smplwise
```

- `SW_DEV_USER` substitutes the Ingress identity on a workstation only; the backend refuses it when
  `/data/options.json` exists (i.e. inside the add-on). Add `X-SW-Dev-User: <name>` to act as another user.
- NVR discovery reads `NVR_HOST`, `NVR_HTTP_PORT`, `NVR_USER`, `NVR_PASSWORD` from the environment (never
  commit them); `go2rtc_url` is reserved for the live-video build.
- Without `pdftoppm` on PATH the developer fallback rasterizes PDFs with PyMuPDF in-process; the add-on
  image always uses `pdftoppm` in a bounded subprocess.
- `npm --prefix ../frontend run dev` (5173) or `preview` (4173) proxy `/api` to `127.0.0.1:8099`.
- Tests: `pytest` here; fixture-based Playwright suites in `../frontend/tests` run in demo mode (stop the
  backend first); `SW_LIVE=1 npx playwright test tests/evidence-live.spec.ts` records real-backend evidence.
