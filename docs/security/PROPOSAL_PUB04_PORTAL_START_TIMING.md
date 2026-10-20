# Proposal PUB-04: vendor-portal `start` residual timing channel (not implemented)

Source: `private/planning/SECURITY_REVIEW_PUBLIC_2026-10-20.md`, finding PUB-04 (Low, accepted residual in `docs/changes/CR-VENDOR-PORTAL.md` section 6). Status: PROPOSAL; measure first. No code in this change.

**Update SECFIX2-295:** option A is IMPLEMENTED behind `tickets.settings.vendor_portal.start_worker`, OFF by default (today's
BackgroundTask): `services/tickets/public_portal.py` (`StartWorker`, queue depth 64, silent counted drop, type-only logging, stops with the
listener), tests `test_secfix2_pub04_portal_start_worker.py`. Owner decision 2026-10-21: the switch stays OFF. Step zero is the opt-in test `tests/test_secfix2_pub04_timing_measure.py`
(`SW_MEASURE_PORTAL_START=1`; prints `PUB04_TIMING {...}`); NOT RUN yet; the owner decides after it:
`docs/security/SECFIX2_295_OWNER_SWITCHES.md` section 3. The title's "(not implemented)" refers to the original proposal.

1. Problem: `POST /t/api/portal/start` answers an identical 202 for every well-formed number, but `public_portal.request_in_background` runs as a Starlette `BackgroundTask` inside the same ASGI call. The connection and the edge in-flight slot stay busy until the lookup, the write and the outbox insert finish, and a known number does more statements than an unknown one.
2. Observable: through cloudflared's pooled origin connections this is a few milliseconds of noise, not a clean oracle; the review rates it Low and the CR already accepts it.
3. Step zero (before any change): measure known versus unknown number completion times on the runner with the real listener (N >= 500 each, compare medians and the 95th percentile of the next request on the same connection) and record the numbers in the CR. If the difference is inside the noise floor, close the finding as accepted.
4. Option A (preferred if measurement shows a signal): a bounded in-process queue drained by one worker thread owned by the listener, the pattern of `local_reset.sender_for`. The handler only enqueues `(digits, net)` and returns; the connection is free immediately for both paths.
5. Option A details: queue depth 64; when full, drop silently with a counter (the answer must stay identical, so no 429 here); the worker catches everything and logs the exception type only; the thread stops with the listener.
6. Option B (cheaper, weaker): keep the BackgroundTask but pad the unknown-number path with the same two statements (read plan, write transaction with a dummy row rolled back), so both paths cost the same.
7. Option B drawback: padding drifts when `request_code` changes, so it needs a test that asserts equal statement counts for known and unknown numbers.
8. Not recommended: a fixed sleep or random jitter; it adds load for the attacker and defender alike and hides, not removes, the difference.
9. Tests when approved: both paths return byte-identical 202 bodies and headers; the connection is released before the worker runs (fake worker that blocks); a full queue still answers 202; the worker survives an exception.
10. Needs from the owner: whether the measured difference justifies work at all, then A or B.
