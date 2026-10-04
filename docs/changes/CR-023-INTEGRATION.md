# CR-023 electricity meters and bills - integration report

Branch: `integ/electricity`, created from `origin/g0/intake` at `b6295645` (release 0.1.157); after 0.1.159 was released,
`origin/main` (`8de8054a`) was merged in and the branch became the 0.1.160 release candidate (section 7). No tag; `g0/intake` and
`main` were not touched.

## 1. Branches merged (normal merges, in this order)

| Branch | Head | What it brings |
|---|---|---|
| `pilot/electricity-p0` | `3d286931` | CR-023 (EN + HE), mockup gallery (155 views), PDF feasibility spike |
| `pilot/elec-server` | `5866494e` | meters registry (migration 0054), `energy.db` store, sampler, counter rules, readings provider, meters API, energy settings registry, backup part |
| `pilot/elec-billing` | `bea31a02` | customers, accounts, formula, tariffs and VAT, bills and snapshot, numbering, automatic drafts (migration placeholder 0054) |
| `pilot/elec-pdf` | `9b459d75` | bill PDF renderer (WeasyPrint + fpdf2 fallback), Heebo subset fonts, logo sanitiser, Dockerfile/requirements |
| `pilot/elec-ui-meters` | `27adc70e` | Infrastructure area and the "מוני חשמל" sub-tab, meters screens, retention settings, permission rows |
| `pilot/elec-ui-bills` | `7dc2082e` | accounts, wizard, formula editor, bills, customers, billing settings screens, mock layer |

## 2. Merge conflicts and resolutions

Textual conflicts arose only when merging `pilot/elec-billing` onto `pilot/elec-server`; the other merges were clean.

| File | Resolution |
|---|---|
| `roles.json`, `contracts/examples/role-catalog.design.json`, `routers/access.py` (labels) | both branches added the same three permissions; ONE copy kept (`energy.view`, `energy.bills`, `energy.manage`; `energy.bills` sensitive) |
| `services/backup.py` | ONE mechanism: `services/energy_backup` holds `MAIN_TABLES` (meters + billing tables), `KEEP_WHEN_ABSENT`, `FILE_COLUMNS`; `backup.py` merges them into its lists. Restore allow-listing unchanged. `energy_bill_numbers` stays out of the backup |
| `contracts/API_INVENTORY.md` | regenerated (`scripts/api_inventory.py`, 496 routes) |
| migration lists in `test_media_api.py`, `test_media_players_api.py`, `test_notify_core.py` | updated to the renumbered set (`..., 49, 54, 55`) |

## 3. Integration decisions (semantic, beyond textual conflicts)

1. **Migrations.** `0053_electricity_meters.sql` (meters) and `0054_electricity_billing.sql` (billing), directly after 0.1.159's
   0052 (both branches had used the placeholder 0054; the number 0053 reserved for the capability model's last phase was free -
   that phase is not built and will be renumbered later). SQL unchanged except the header comments.
2. **Settings.** The billing document (`energy.billing`) is registered in the energy settings registry with `own_route =
   /energy/billing-settings`: one registry knows every `energy.*` key, but the billing document keeps its own revision and validation
   and is neither shown nor accepted by the generic `/energy/settings`. Billing's retention and the not-reporting threshold now read
   the registry (`energy.stale_after_minutes` replaces billing's fixed 60 minutes). Nothing to migrate (unreleased).
3. **Account status** is `active` / `paused` only. The meters side's "meter in use" guard no longer looks for `closed`: a paused
   account still uses its meters; only a deleted account releases them. The meters tests now use the real billing tables.
4. **Billing reads the readings store** through `energy_billing_adapter.provider(conn, settings)`, which answers with the store's
   `EnergyReadingsProvider`. The earlier adapter for a billing-specific protocol (`segments` / `history_wh`) was unused after billing
   adopted the shared protocol and was removed (its test replaced by one against the real provider).
5. **Bill PDF.** The billing seam calls `services/bill_pdf.render_bill_pdf` (the PDF route is a plain `def` route, so it runs in a
   worker thread). Error codes: `pdf_render_failed`, `pdf_timeout` -> 503 retryable; `pdf_page_limit`, `pdf_too_large` -> 422;
   `pdf_unavailable` 503. Failures are recorded as bill events and every bill carries `pdf: {state, error_code, failed_at, engine}`
   (owner round 6). The logo upload uses `sanitize_logo` (refusals carry `details.code`).
6. **PDF engine visibility.** Start-up self-check (background thread; logs which engine works and exposes `pdf_engine` in the
   billing settings); in `auto`, a WeasyPrint render over 5 s (`SW_BILL_PDF_FALLBACK_S`) is re-rendered with fpdf2 (owner round 4).
7. **Third-party notices.** `THIRD_PARTY_NOTICES.md` created: Heebo (SIL OFL 1.1) and the WeasyPrint / fpdf2 / uharfbuzz stack with
   licenses read from the installed package metadata on the runner; Dockerfile and requirements of the PDF branch kept.
8. **Owner-approved additions.**
   - (a) `GET /energy/accounts/{aid}/history?past=N`: consumption per billing period from issued bills, or from the readings
     (raw / quarter-hour / daily totals with the account formula) for periods without a bill, plus the comparison with previous
     periods and the same period last year; wired into the account page's history tab.
   - (b) PDF state on every bill (above) with a short indicator and a retry action on the bill page.
   - (c) Sent / paid: confirmed as local DATES (`YYYY-MM-DD`) on both sides; the UI now sends a date and `row_version`.
   - (d) Payment terms stay in billing settings; the wizard shows them read-only with a link (verified).
   - (e) Manual meter reading / calibration not in v1 (not built); `energy.include_history_in_backup` defaults to off, daily totals
     always travel in the backup.
9. **Frontend unification.** One stylesheet (`src/electricity/styles.ts`, `elecCss`; `elec-css.ts` removed; one `--elec-touch`
   hit-area variable), one permissions source (`src/electricity/access.ts`), wizard step 1 uses `<elec-meter-picker mode="choose">`,
   the bills half reads meters through `src/api/electricity-meters.ts` (the lenient mapping and a wrong candidates path removed), the
   shell already loaded both halves' pages. No Home Assistant wording in the electricity UI (grep).
10. **Evidence screenshots.** All kept except 27 stale `-state-` files of the bills UI that no spec writes any more (21 byte-identical
    to the file without `-state-`, 6 older renders). Total added PNGs about 41 MB.

## 4. Verification (runner, Ubuntu; fakes only)

- Tier-L release gate at `0b10526a` (0.1.160 candidate): **PASS in 64 min** - tsc 1/1; vite build 1/1; Playwright on the dist preview
  4609 passed, 0 failed; pixel baselines 8/8; Playwright on the Vite dev server 500 passed, 0 failed, 1 flaky (the prices test of
  `electricity-accounts` on mobile, passed alone); fake-backend fixture 15/15; backend 4582 passed, 0 failed; `release_check.py` ok.
- Earlier on the branch: electricity backend tests and the full backend suite; electricity Playwright specs on the three projects;
  the layout guards of both electricity halves (4 skins x light/dark x 10 widths; 0 findings); `tsc --noEmit`.
- `tests/test_rbac_camera_scope.py::test_session_downgrade_refuses_and_closes_the_lease` is timing-flaky under load on the runner
  (1/12 on `g0/intake`, 1-3/12 on the electricity branches); it passed in the gate.

## 5. NOT verified

- The real add-on image: Alpine 3.22 on amd64 and aarch64 was not built; that WeasyPrint/Pango load there, the image growth (gate
  60 MB) and the render time on the owner's ARM hardware (gate 5 s; the automatic fpdf2 fallback covers a miss) are unmeasured
  (ELECTRICITY_BILL_PDF.md section 8). The start-up log line "bill pdf engine: ..." and `pdf_engine` in the billing settings show
  what actually runs after the first install.
- Real meters: all readings are fakes; no real energy sensor of the infrastructure was sampled.
- Real infrastructure host (identity, Ingress, the state mirror) and real customers: not exercised; fixtures only.

## 6. Open items

- First-install checks on the real image (engine, size, ARM timing).
- Not built (owner rounds 5-7): "draft ready" notification, live bill state over the WebSocket (screens poll), rate limits on
  recalculate / PDF, a separate segments display for a swapped meter, manual readings / calibration.
- The PDF of an issued bill is rendered on first request (not at issue time); a failure is visible as `pdf.state = failed`.
- `tests/test_rbac_camera_scope.py::test_session_downgrade_refuses_and_closes_the_lease` is timing-flaky on the runner under load:
  1/12 on `g0/intake`, 1-3/12 on the electricity branches; it passes when re-run. Pre-existing, not caused by this integration.

## 7. Release candidate 0.1.160 (same branch, after 0.1.159 was released)

- `origin/main` (0.1.159, `8de8054a`) merged in. Conflicts: `main.py` (routers and janitor steps of both sides kept),
  `services/backup.py` (0.1.159's `restorable()` file rule plus the energy part; `energy/bills/` and `energy/assets/` join
  `RESTORABLE_ROOTS` through `energy_backup.RESTORABLE_ROOTS`, otherwise a restore would drop stored bill PDFs, logos and the rows
  that name them), `nav.ts` / `sw-app.ts` (0.1.159's capability model plus the infrastructure area), the migration lists of four
  tests, the API inventory (regenerated: 513 routes).
- Migrations renumbered to follow 0052 directly: `0053_electricity_meters.sql`, `0054_electricity_billing.sql`. `release_check.py`:
  migrations contiguous (54 files).
- Also merged, cleanly: `pilot/schedules-parity` (`6361f036`) and `pilot/music-queue-actions` (`b915a0d2`).
- Version 0.1.160, CHANGELOG, bilingual `docs/release/0.1.160-RELEASE-NOTES.md`, UI rebuilt (`npm run build:addon` on the runner).
- Consequences of the sixth area, found by the full Playwright run and fixed: nav-order expectations in the shell specs; the bubble
  phone dock (seven 44 px items: tighter paddings below 420 px, the room-picker button steps aside below 368 px); the classic phone
  bar caps its labels at 10.5 px and the icon pill at its item, so no label is cut; classic pixel baselines (linux) regenerated.
- The first tier-L gate (`b6d11855`) failed on the run-time budget, not on a product defect: the three harness specs
  (`electricity-accounts`, `-bills`, `-wizard`) need the Vite dev server (`/tests/electricity-harness/`) but lacked the header the gate
  classifies by, so they ran on the dist preview: 132 tests x 60 s timeout plus single retries took the preview phase to 5230 s and
  the 90-minute budget ran out before the dev, pixel, fixture and release_check phases. The header now sends them to the dev phase
  on all three projects (preview phase then 1236 s). The one backend failure was 0.1.159's child-process guard: the bill PDF child now
  gets `env=minimal_env(...)` (`child_env.minimal_env` accepts fixed, non-secret extras).
