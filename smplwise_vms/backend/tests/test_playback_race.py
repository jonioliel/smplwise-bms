"""A playback session closed while its relay stream was still being created (the user left, the group was
closed, the lease expired) must stay closed: the new stream is dropped and the seek refused, instead of the
session coming back as "buffering" and holding a quota slot until the janitor noticed."""
from __future__ import annotations

import datetime as dt

import pytest

from smplwise.errors import ApiError
from smplwise.services import playback as pb


class _Principal:
    user_id = "dev-joni"
    username = "joni"


def _session(monkeypatch, settings, deleted: list[str]) -> pb.PlaybackSession:
    monkeypatch.setattr(pb, "_create_stream", lambda _s, session, _start: setattr(session, "stream", f"smplwise_pb_{session.id}_g{session.generation}"))
    monkeypatch.setattr(pb, "_delete_stream", lambda _s, name: deleted.append(name))
    cam = {"id": "cam-a", "channel": 1, "main_track": 101}
    start = dt.datetime(2026, 9, 16, 8, 0, tzinfo=dt.timezone.utc)
    return pb.create(settings, _Principal(), cam, start, start + dt.timedelta(hours=1), "Asia/Jerusalem", 4)


def test_seek_does_not_resurrect_a_session_closed_meanwhile(monkeypatch, settings):
    deleted: list[str] = []
    session = _session(monkeypatch, settings, deleted)
    assert session.state == "buffering" and session in pb.REGISTRY.active()

    def slow_create(_s, sess, _start):
        pb.close(settings, sess)  # the close lands while the new stream is being created
        sess.stream = "smplwise_pb_new_g1"

    monkeypatch.setattr(pb, "_create_stream", slow_create)
    start = dt.datetime(2026, 9, 16, 8, 5, tzinfo=dt.timezone.utc)
    with pytest.raises(ApiError) as exc:
        pb.seek(settings, session, start, start + dt.timedelta(hours=1))
    assert exc.value.code == "session_over"
    assert session.state == "closed" and session.stream == "" and session not in pb.REGISTRY.active()
    assert deleted[-1] == "smplwise_pb_new_g1", "the stream created after the close is dropped, not leaked"
    pb.REGISTRY.sessions.pop(session.id, None)


def test_seek_keeps_a_live_session(monkeypatch, settings):
    deleted: list[str] = []
    session = _session(monkeypatch, settings, deleted)
    start = dt.datetime(2026, 9, 16, 8, 5, tzinfo=dt.timezone.utc)
    same = pb.seek(settings, session, start, start + dt.timedelta(hours=1))
    assert same is session and session.state == "buffering" and session.generation == 1 and session.stream.endswith("_g1")
    assert deleted == [f"smplwise_pb_{session.id}_g0"], "only the superseded stream is deleted"
    pb.close(settings, session)
    pb.REGISTRY.sessions.pop(session.id, None)
