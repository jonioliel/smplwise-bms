"""Thread/context-scoped absolute RPC budget; does not imply hardware cancellation."""
from contextlib import contextmanager
from contextvars import ContextVar
import time

_END = ContextVar("wiskey_call_deadline", default=None)

class DeadlineExpired(TimeoutError):
    pass

def active():
    return _END.get() is not None

def remaining(maximum=None):
    end = _END.get()
    value = float(maximum) if end is None and maximum is not None else (end - time.monotonic() if end is not None else float("inf"))
    if value <= 0:
        raise DeadlineExpired("deadline_expired")
    return value if maximum is None else min(value, float(maximum))

@contextmanager
def scope(seconds):
    end = time.monotonic() + float(seconds)
    old = _END.get()
    token = _END.set(min(old, end) if old is not None else end)
    try:
        yield
    finally:
        _END.reset(token)
