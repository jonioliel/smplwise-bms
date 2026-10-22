"""WKB2-295 (owner decision 2026-10-23): retention of the sealed WisKey intent originals (migration 0146, `wiskey_intent_originals`).

Once an intent is terminal (committed / never_committed) and its terminal fact is older than `wiskey.intent_original_retention_days`
(default 30; clamped to 1..365 - a saved 0, a negative or a huge value never turns the retention off and never purges "now"), the sealed
original and context are NULLed and `purged_at` is stamped (services/wiskey_intents.purge_originals). The row, both SHA-256 values and
the intent's terminal state stay as proof. An open intent (intent / sent / unknown) is never purged. The 0146 trigger refuses any other
update of the table. Idempotent: a purged row is not touched again.

One audit row per pass that purged something - counts and the window only, never an id, a hash or a value. Placement: `janitor()` is
called from main.janitor_tick, at most once an hour per process; a failure is logged by type and never stops the tick."""
from __future__ import annotations

import datetime as dt
import logging
import threading
import time
from typing import Any

from ..audit import audit
from ..db import get_setting
from . import wiskey_intents as wi

log = logging.getLogger("smplwise.wiskey_intent_retention")

CHECK_EVERY_S = 3600.0
SETTING_KEY = "wiskey.intent_original_retention_days"
AUDIT_ACTION = "wiskey.intent_original.purged"


def retention_days(conn) -> int:
    """The window in days: the setting clamped to 1..365; missing or unreadable -> 30."""
    try:
        raw = get_setting(conn, SETTING_KEY)
    except Exception:  # noqa: BLE001 - a database without the settings table: the default
        raw = None
    return wi.clamp_retention(raw) if raw is not None else wi.RETENTION_DEFAULT_DAYS


def run(db: Any, now: dt.datetime | None = None) -> dict[str, int]:
    """One pass in one transaction. Returns `{purged, retention_days}`."""
    with db.connection(label="wiskey_intent_retention.purge") as conn:
        days = retention_days(conn)
        n = wi.purge_originals(conn, days=days, now=now)
        if n:
            audit(conn, actor=None, action=AUDIT_ACTION, decision="allowed", resource_type="installation",
                  details={"purged": n, "retention_days": days})
    return {"purged": n, "retention_days": days}


_last = 0.0
_lock = threading.Lock()


def janitor(db: Any) -> None:
    """The janitor's hook: at most one pass per CHECK_EVERY_S in this process; never raises."""
    global _last
    with _lock:
        mono = time.monotonic()
        if _last and mono - _last < CHECK_EVERY_S:
            return
        _last = mono
    try:
        run(db)
    except Exception as exc:  # noqa: BLE001 - housekeeping never stops the janitor
        log.warning("wiskey intent original retention failed (%s)", type(exc).__name__)


def reset_for_tests() -> None:
    global _last
    _last = 0.0
