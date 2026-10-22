# CR-ELECBILL77 - electricity bill draft notification, live bill state, rate limits

Status: implemented on `pilot/ELECBILL77-295` (from `main` @ `c37c75c91`, v2.12.3). Board item r077. Backend only; no frontend change,
no migration, no new permission, no new channel.

## What changes

1. **New notification source `energy.bill_draft`** (`services/notify_policy.py`, category `system`, severity `info`, `app` on by default,
   WhatsApp off like every source). Recipient rule `energy_bills` (every active user, intersected with visibility), subject kind
   `energy_bills` (`services/notify_visibility.py`: `energy.bills` at installation scope, re-checked at every delivery and inbox read).
   It is emitted by `services/energy_notify.draft_ready`, called from `energy_billing.auto_generate` inside the transaction that writes the
   draft and its `energy_auto_runs` row, for a draft that stays a draft (`auto_mode = "draft"`). Dedupe key = the bill id: once per draft.
   A recalculation, an edit, a correction, a manual draft and an auto-issued bill emit nothing.
2. **Live state**: `GET /api/v1/energy/bills/state` with a `revision` and `ETag` / `If-None-Match` (304); `GET /energy/bills` also carries
   `revision`. See `docs/architecture/ELECTRICITY_BILLING_API.md` section 9.
3. **Rate limits** (`services/energy_limits.py`, the secrets-test limiter pattern): recalculation 10 per user / 30 per installation per
   minute, PDF render 20 / 60 per minute (a stored PDF is free), plus an in-flight guard per bill. Refusal: 429, `rate_limited` or
   `recompute_in_progress`, `retryable`, `details.retry_after_s` and `details.scope`.

## Rules kept

- Module off: there is no electricity module switch in this release. The source is listed in the policy matrix only while the installation has
  a billing account (`energy_notify.listed`); with none, nothing is emitted. An account with `auto_mode = "off"` produces no draft, so no notice;
  an administrator can switch the source off in the notification matrix.
- Text: the period (`09/2026` or a date range) only. Never an amount, a customer, an account or a bill number.
- Permission: only holders of `energy.bills` receive it or can open it from the inbox; the quiet hours, the phone-app / push rules, the per-user
  push rate, the device's per-category mute and the WhatsApp opt-in are the pipeline's own and are not touched.
- A notification failure is logged and never fails or rolls back the draft.

## Tests

`tests/test_energy_elecbill77.py`: once per draft (and not again on a second pass), not for a recalculated draft, not for an auto-issued bill,
module off (no accounts) and policy off, permission (a viewer gets nothing), text without amounts, the 429 shape and window for recalculation
and PDF, the in-flight guard, the ETag / 304 and the revision moving with each change.
