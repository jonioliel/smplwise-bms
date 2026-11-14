"""Thread/context-scoped absolute RPC budget; does not imply hardware cancellation.

WIN-ARX-RC4-DEADLINE-01 (2026-10-30): a caller may fix ONE absolute end (`now() + seconds`) before it hands the call to another thread
and enter it there with `until(end)`; every nested `scope` only ever shortens it (`min`), never renews it. `_clock` is the monotonic
clock of every end and every `remaining` (a test may replace it with a controlled clock)."""
from contextlib import contextmanager
from contextvars import ContextVar
import time

_END = ContextVar("wiskey_call_deadline", default=None)
_clock = time.monotonic

class DeadlineExpired(TimeoutError):
    pass

def now():
    return _clock()

def active():
    return _END.get() is not None

def deadline():
    """The absolute end in force in this context (None = no budget)."""
    return _END.get()

def remaining(maximum=None):
    end = _END.get()
    value = float(maximum) if end is None and maximum is not None else (end - _clock() if end is not None else float("inf"))
    if value <= 0:
        raise DeadlineExpired("deadline_expired")
    return value if maximum is None else min(value, float(maximum))

@contextmanager
def until(end):
    """Enter the absolute `end` (a value of `now()`); an end already in force that is earlier wins."""
    old = _END.get()
    token = _END.set(min(old, float(end)) if old is not None else float(end))
    try:
        yield
    finally:
        _END.reset(token)

@contextmanager
def scope(seconds):
    with until(_clock() + float(seconds)):
        yield
