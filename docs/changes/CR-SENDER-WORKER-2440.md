# CR-SENDER-WORKER-2440

Code-review batch 16.11, wave 3A (backend). Plan row `pilot/CR-SENDER-WORKER-2436` in
`private/code-review-2026-11-13/MASTER_PLAN.md`; findings 04:F10 and 04:F27 (these files).
Base: `origin/pilot/CR-WAVE2-COMBINED-2439` (`97080bbc4`). Risk in the plan: **high** (concurrency).

## What and why

1. **One sender-worker skeleton (04:F10).** New `services/delayed_worker.py`:
   - `DelayedWorker`: the thread, the bounded queue of hand-overs, the heap of waiting jobs, the in-flight counter,
     `make_due`, `drain` (20 ms poll) and `stop` (3 s join). A heap entry is a tuple whose first element is the due
     time and whose last is the job. Subclasses give `_run_job(job)` and `_job_failed(job)`.
   - `heap_wait(heap)` and `wait_idle(idle, timeout)`: the two small pieces all three workers share.
   - `notify_email.EmailWorker(DelayedWorker)`: keeps `submit`, `schedule`, `has`; `retries` is the same list as
     `heap`. Thread name `email-worker`, queue bound `WORKER_QUEUE_MAX`, log texts unchanged.
   - `notify_whatsapp.Worker(DelayedWorker)`: keeps `submit`, `schedule` (with the `HEAP_MAX` bound and its honest
     failure), `pending`, `gate`. Thread name `whatsapp-notify`, queue bound `QUEUE_MAX`, log texts unchanged; a
     raising job is still finished as `failed` / `channel_error`.
   - `push.PushNotifier` is **not** a subclass. It is restartable on another database, its heap belongs to its own
     thread alone (no lock), its queue carries notices and a `None` sentinel, and its `drain` also waits for the
     notification outbox. Forcing it under the base class would change its locking. It now uses `heap_wait` for the
     loop's wait and `wait_idle` for `drain`; its private `_due()` (no other caller) is gone.
   - `worker_for` and `reset_state` stay in their modules (module globals, the modules' own lock).

   Kept exactly: timing constants (1 s maximum wait, 20 ms drain poll, 3 s stop join, the PushNotifier's own
   2 s / 5 s joins), the single `lock` around the heap and `inflight` with nothing else taken while it is held,
   `inflight` raised before the pop, the two-level guard (a raising job is settled by the subclass; a raising
   hand-over or a raising settle step is logged by the loop and the thread goes on), `_wake` never blocking on a
   full queue, `stop` never joining its own thread.
2. **A silent failure leaves a trace (04:F27, these files).** The three files hold one broad `except` that ended in
   a bare `pass`: closing the SMTP connection in `notify_email.py`. It now logs at debug level with the traceback.
   The other bare `pass` blocks in these files catch `queue.Full` or `OSError` only (narrow, by design) and stay.

## Lead decision L7: does the WhatsApp orphan-job fix apply to e-mail?

**Yes, the same gap exists; it is not fixed in this branch.**

- The WhatsApp fix (`notify_whatsapp.worker_for`, "review F10"): when a worker is replaced, the delivery ids of the
  jobs still in the old worker's heap are removed from `_LIVE`, so the housekeeping (`recover_orphans`) marks their
  `retry` rows as failed instead of leaving them in `retry` for ever.
- `notify_email.worker_for` replaces a worker in the same two cases (another database object, a dead or stopped
  thread) and stops the old one. Its waiting jobs die with it, but `notify_email._LIVE` keeps their delivery ids, and
  `recover_orphans` skips every row in `_LIVE`. Those rows stay `retry` until the process restarts.
- Why not here: the row says no behaviour change, and the e-mail fix is not a copy of the WhatsApp one. E-mail jobs
  carry several delivery ids each and can wait in two places (the e-mail worker's heap and the held digest), so the
  fix needs a "delivery ids of this job" accessor on `MailJob` / `DigestJob` and its own test. In production a
  replacement happens only when the database object changes or the thread died, so the exposure is small.
- Suggested follow-up (closing chain 3B or its own small branch): in `notify_email.worker_for`, after stopping the
  replaced worker, drop its heap jobs' ids from `_LIVE`; one test like the WhatsApp one.

## Files

New: `smplwise_vms/backend/smplwise/services/delayed_worker.py`,
`smplwise_vms/backend/tests/test_delayed_worker_2440.py`.
Changed: `services/notify_email.py` (worker class, one log line), `services/notify_whatsapp.py` (worker class),
`services/push.py` (`PushNotifier._loop` wait, `drain`, `_due` removed).

Outside my rows: none.

## Tests actually run

See the end of this file (filled after the runs; the row asks for three green runs in a row).
