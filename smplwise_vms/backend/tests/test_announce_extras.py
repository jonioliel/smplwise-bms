"""ANN2 voice announcement extras: a per-announcement volume (clamped, restored, skipped with a recorded reason when the player has none),
pause-music (pause, wait for the speech, resume - only what we paused and nobody touched), quiet hours (suppress | lower, critical exempt,
the notification centre's window and clock seam), the rule action's volume / critical, and the `announce` notification-policy channel
(routing by category and severity, quiet hours, limits, audit, the lock-screen level). Every speak call and every player call goes to a fake
(`announcements.SPEAK`, `PLAYER_STATE`, `PLAYER_CALL`, `SLEEP`): no real speaker, engine or Home Assistant is contacted, and no test waits
for real time."""
from __future__ import annotations

import datetime as dt
import json

import media_seed_audio as aseed
import pytest
from notify_world import API, World, fake_push  # noqa: F401 - fixture

from smplwise.errors import ApiError
from smplwise.services import announcements as ann
from smplwise.services import notify
from smplwise.services import rules as rules_svc

pytestmark = pytest.mark.usefixtures("daytime_clock")
ANN = f"{API}/announcements"
DAY = dt.datetime(2026, 10, 1, 9, 0, tzinfo=dt.timezone.utc)  # 12:00 local
NIGHT = dt.datetime(2026, 10, 1, 20, 0, tzinfo=dt.timezone.utc)  # 23:00 local, inside the default 22:00-07:00 window
VOL = 4  # supported_features: VOLUME_SET


class Speaker:
    def __init__(self, players: "Players") -> None:
        self.calls: list[tuple[str, list[str], str, str]] = []
        self.error: Exception | None = None
        self.players = players

    def __call__(self, _settings, engine, entity_ids, message, language) -> None:
        self.calls.append((engine, list(entity_ids), message, language))
        if self.error:
            raise self.error
        self.players.start_speech(entity_ids)


class Players:
    """A scripted set of media players: state + attributes per entity, every service call recorded. While a speech is on, a poll reads `playing`
    `speech_polls` times and then the player is `after` (idle). `on_speak` lets a test change the world while the speech runs."""

    def __init__(self) -> None:
        self.s: dict[str, dict] = {}
        self.calls: list[tuple[str, str, float | None]] = []
        self.speaking: dict[str, int] = {}
        self.fail: set[str] = set()
        self.speech_polls = 2
        self.after = "idle"
        self.on_speak = None
        self.reads = 0
        self.sleeps = 0

    def add(self, ent: str, state: str = "playing", volume: float | None = 0.3, features: int | None = VOL) -> None:
        attrs: dict = {}
        if volume is not None:
            attrs["volume_level"] = volume
        if features is not None:
            attrs["supported_features"] = features
        self.s[ent] = {"state": state, "attributes": attrs}

    def state(self, _settings, ent):
        self.reads += 1
        st = self.s.get(ent)
        if st is None:
            return None
        if ent in self.speaking:
            if self.speaking[ent] > 0:
                self.speaking[ent] -= 1
                return {"state": "playing", "attributes": dict(st["attributes"])}
            st["state"] = self.after
            del self.speaking[ent]
        return {"state": st["state"], "attributes": dict(st["attributes"])}

    def call(self, _settings, service, data):
        ent = data["entity_id"]
        self.calls.append((service, ent, data.get("volume_level")))
        if service in self.fail:
            raise ApiError(503, "ha_unavailable", "x")
        st = self.s[ent]
        if service == "media_pause":
            st["state"] = "paused"
        elif service == "media_play":
            st["state"] = "playing"
        elif service == "volume_set":
            st["attributes"]["volume_level"] = data["volume_level"]

    def start_speech(self, entities) -> None:
        self.speaking = {e: self.speech_polls for e in entities if e in self.s}
        if self.on_speak:
            self.on_speak(self)

    def sleep(self, _s) -> None:
        self.sleeps += 1

    def services(self, name: str) -> list[tuple[str, float | None]]:
        return [(e, v) for s, e, v in self.calls if s == name]


@pytest.fixture()
def world(settings, fake_push, monkeypatch):
    w = World(settings)
    players = Players()
    speaker = Speaker(players)
    monkeypatch.setattr(ann, "SPEAK", speaker)
    monkeypatch.setattr(ann, "PLAYER_STATE", players.state)
    monkeypatch.setattr(ann, "PLAYER_CALL", players.call)
    monkeypatch.setattr(ann, "SLEEP", players.sleep)
    aseed.install(w.c, "ma")
    aseed.approve_players(w.c)
    keys = {n: aseed.key_with(w.c, e) for n, e in {"a": "media_player.wiim_a", "b": "media_player.wiim_b"}.items()}
    clock = {"now": DAY}
    monkeypatch.setattr(notify, "now_utc", lambda: clock["now"])
    w.keys, w.players, w.speaker, w.clock = keys, players, speaker, clock
    return w


def enable(w: World, devices=("a", "b"), **extra) -> dict:
    r = w.c.put(f"{ANN}/config", json={"enabled": True, "engine": "tts.fake_engine", "devices": sorted(w.keys[d] for d in devices), **extra})
    assert r.status_code == 200, r.text
    return r.json()


def entity(w: World, which: str = "a") -> str:
    """The speaker entity an announcement to that device reaches (found by one resolve, then the players are scripted on it)."""
    with w.db.connection(mode="read") as conn:
        cfg_devices = ann.config(conn)["devices"]
    assert w.keys[which] in cfg_devices, "enable() the device first"
    with w.db.connection(mode="read") as conn:
        return ann.resolve(conn, "device", w.keys[which])[0][1]


def speak(w: World, which: str = "a", **extra):
    w.clock["now"] += dt.timedelta(minutes=2)  # past the cooldown and the per-minute window of the previous attempt
    return w.c.post(ANN, json={"scope": "device", "ref": w.keys[which], "text": "שלום", **extra})


def audit_details(w: World) -> dict:
    with w.db.connection(mode="read") as conn:
        r = conn.execute("SELECT * FROM audit_log WHERE action = 'media.announce' ORDER BY rowid DESC LIMIT 1").fetchone()
    return {"decision": r["decision"], "reason": r["reason"], **json.loads(r["details_json"])}


def history(w: World) -> list[dict]:
    return w.c.get(f"{ANN}/history").json()["history"]


# ---------------------------------------------------------------------------------------------------- off by default

def test_everything_is_off_by_default_and_a_plain_announcement_touches_no_player(world):
    w = world
    cfg = w.c.get(f"{ANN}/config").json()["config"]
    assert cfg["volume"] is None and cfg["pause_music"] is False
    assert cfg["quiet"] == {"enabled": False, "from": "22:00", "to": "07:00", "days": ["sun", "mon", "tue", "wed", "thu", "fri", "sat"], "mode": "suppress", "night_volume": None}
    assert cfg["notify"] == {"enabled": False, "scope": "area", "ref": "", "categories": [], "min_severity": "alert"}
    enable(w)
    assert speak(w).status_code == 200 and len(w.speaker.calls) == 1
    assert w.players.reads == 0 and w.players.calls == [], "no volume and no pause-music: exactly the one speak call, no player is read"
    assert history(w)[0]["notes"] == []


# ---------------------------------------------------------------------------------------------------- volume

def test_volume_is_clamped_applied_and_restored(world):
    w = world
    enable(w)
    ent = entity(w)
    w.players.add(ent, state="idle", volume=0.3)
    r = speak(w, volume=150)  # clamped to 100
    assert r.status_code == 200
    assert w.players.services("volume_set") == [(ent, 1.0), (ent, 0.3)], "set before the speech, put back after it"
    d = audit_details(w)
    assert d["volume"] == 100 and d["status"] == "sent" and "notes" not in d
    assert w.players.s[ent]["attributes"]["volume_level"] == 0.3
    r = speak(w, volume=-20)  # clamped to 0
    assert r.status_code == 200 and w.players.services("volume_set")[-2] == (ent, 0.0)
    assert speak(w, volume="loud").status_code == 422


def test_configured_default_volume_and_the_explicit_one_wins(world):
    w = world
    enable(w, volume=40)
    ent = entity(w)
    w.players.add(ent, state="idle", volume=0.2)
    assert speak(w).status_code == 200 and w.players.services("volume_set")[0] == (ent, 0.4)
    assert speak(w, volume=70).status_code == 200 and w.players.services("volume_set")[2] == (ent, 0.7)
    assert w.c.put(f"{ANN}/config", json={"volume": None}).json()["config"]["volume"] is None
    w.players.calls.clear()
    assert speak(w).status_code == 200 and w.players.calls == []
    assert w.c.put(f"{ANN}/config", json={"volume": 250}).json()["config"]["volume"] == 100, "the stored default is clamped too"
    assert w.c.put(f"{ANN}/config", json={"volume": "x"}).status_code == 422


@pytest.mark.parametrize("script,reason", [
    (dict(volume=None), "no_volume_level"),
    (dict(volume=0.3, features=1), "not_supported"),
])
def test_a_player_without_volume_is_skipped_silently_and_the_reason_is_recorded(world, script, reason):
    w = world
    enable(w)
    ent = entity(w)
    w.players.add(ent, state="idle", **script)
    r = speak(w, volume=60)
    assert r.status_code == 200, "the announcement is spoken all the same"
    assert w.players.services("volume_set") == [] and len(w.speaker.calls) == 1
    note = f"volume_skipped:{w.keys['a']}:{reason}"
    assert audit_details(w)["notes"] == [note] and history(w)[0]["notes"] == [note]


def test_an_unreadable_player_state_skips_the_volume(world):
    w = world
    enable(w)  # the player is not known to the fake: its state reads as None
    assert speak(w, volume=60).status_code == 200
    assert audit_details(w)["notes"] == [f"volume_skipped:{w.keys['a']}:state_unavailable"] and w.players.calls == []


def test_a_volume_that_cannot_be_set_never_fails_the_announcement_and_a_moved_slider_is_not_overwritten(world):
    w = world
    enable(w)
    ent = entity(w)
    w.players.add(ent, state="idle", volume=0.3)
    w.players.fail = {"volume_set"}
    assert speak(w, volume=60).status_code == 200 and audit_details(w)["notes"] == [f"volume_skipped:{w.keys['a']}:set_failed"]
    w.players.fail = set()
    w.players.calls.clear()
    w.players.on_speak = lambda p: p.s[ent]["attributes"].__setitem__("volume_level", 0.9)  # someone moves the slider during the speech
    assert speak(w, volume=60).status_code == 200
    assert w.players.services("volume_set") == [(ent, 0.6)] and audit_details(w)["notes"] == [f"volume_not_restored:{w.keys['a']}:changed_meanwhile"]


# ---------------------------------------------------------------------------------------------------- pause music

def test_music_is_paused_for_the_speech_and_resumed_after_it(world):
    w = world
    enable(w, pause_music=True)
    ent = entity(w)
    w.players.add(ent, state="playing", volume=0.3)
    assert speak(w).status_code == 200
    assert [(s, e) for s, e, _v in w.players.calls] == [("media_pause", ent), ("media_play", ent)]
    assert w.players.s[ent]["state"] == "playing" and w.players.sleeps >= 1
    assert "notes" not in audit_details(w)


def test_volume_is_put_back_before_the_music_resumes(world):
    w = world
    enable(w, pause_music=True)
    ent = entity(w)
    w.players.add(ent, state="playing", volume=0.3)
    assert speak(w, volume=80).status_code == 200
    assert [s for s, _e, _v in w.players.calls] == ["media_pause", "volume_set", "volume_set", "media_play"]


def test_music_that_was_not_playing_is_never_paused_or_resumed(world):
    w = world
    enable(w, pause_music=True)
    ent = entity(w)
    for state in ("paused", "idle", "off"):
        w.players.add(ent, state=state)
        w.players.calls.clear()
        assert speak(w).status_code == 200
        assert w.players.calls == [], state


def test_music_the_user_stopped_or_switched_off_meanwhile_is_not_resumed(world, monkeypatch):
    w = world
    enable(w, pause_music=True)
    ent = entity(w)
    # powered off during the speech
    w.players.add(ent, state="playing")
    w.players.on_speak = lambda p: (p.s[ent].__setitem__("state", "off"), p.speaking.clear())
    assert speak(w).status_code == 200
    assert w.players.services("media_play") == [] and audit_details(w)["notes"] == [f"resume_skipped:{w.keys['a']}:off"]
    # stopped between our pause and the speech (a paused player that now reads idle)
    w.players.on_speak = None
    w.players.add(ent, state="playing")
    orig = w.players.call

    def stop_after_pause(settings, service, data):
        orig(settings, service, data)
        if service == "media_pause":
            w.players.s[ent]["state"] = "idle"

    monkeypatch.setattr(ann, "PLAYER_CALL", stop_after_pause)
    w.players.calls.clear()
    assert speak(w).status_code == 200
    assert w.players.services("media_play") == [] and audit_details(w)["notes"] == [f"resume_skipped:{w.keys['a']}:stopped_meanwhile"]


def test_a_pause_that_fails_is_a_note_not_a_failure_and_nothing_is_resumed(world):
    w = world
    enable(w, pause_music=True)
    ent = entity(w)
    w.players.add(ent, state="playing")
    w.players.fail = {"media_pause"}
    assert speak(w).status_code == 200 and len(w.speaker.calls) == 1
    assert w.players.services("media_play") == [] and audit_details(w)["notes"] == [f"pause_failed:{w.keys['a']}"]


def test_a_resume_that_fails_is_recorded(world):
    w = world
    enable(w, pause_music=True)
    ent = entity(w)
    w.players.add(ent, state="playing")
    w.players.fail = {"media_play"}
    assert speak(w).status_code == 200 and audit_details(w)["notes"] == [f"resume_failed:{w.keys['a']}"]


def test_a_speech_that_never_ends_is_waited_for_a_bounded_time_and_the_music_stays_paused(world):
    w = world
    enable(w, pause_music=True)
    ent = entity(w)
    w.players.add(ent, state="playing")
    w.players.speech_polls = 10_000  # reads `playing` forever
    assert speak(w).status_code == 200
    assert w.players.sleeps == int(ann.MAX_SPEECH_S / ann.POLL_S), "bounded by MAX_SPEECH_S"
    assert w.players.services("media_play") == []
    assert audit_details(w)["notes"] == ["speech_timeout", f"resume_skipped:{w.keys['a']}:speech_timeout"]


def test_a_speech_that_never_shows_as_playing_gives_up_waiting_after_the_start_window(world):
    w = world
    enable(w, pause_music=True)
    ent = entity(w)
    w.players.add(ent, state="playing")
    w.players.speech_polls = 0  # a clip too short to show up
    assert speak(w).status_code == 200
    assert w.players.sleeps <= int(ann.START_WAIT_S / ann.POLL_S) and [s for s, _e, _v in w.players.calls] == ["media_pause", "media_play"]


def test_when_the_engine_refuses_the_music_resumes_at_once_and_the_failure_is_reported(world):
    w = world
    enable(w, pause_music=True)
    ent = entity(w)
    w.players.add(ent, state="playing")
    w.speaker.error = ApiError(503, "ha_unavailable", "x")
    r = speak(w)
    assert r.status_code == 502 and r.json()["code"] == "speak_failed"
    assert [s for s, _e, _v in w.players.calls] == ["media_pause", "media_play"] and w.players.sleeps == 0
    assert history(w)[0]["status"] == "failed"


def test_an_area_announcement_pauses_only_the_allowed_speaker_of_the_room(world):
    w = world
    enable(w, devices=("a",), pause_music=True)  # the receiver of the same room is not allowed
    ent = entity(w)
    w.players.add(ent, state="playing")
    w.players.add("media_player.denon_main", state="playing")
    w.clock["now"] += dt.timedelta(minutes=2)
    assert w.c.post(ANN, json={"scope": "area", "ref": "living", "text": "x"}).status_code == 200
    assert [e for e, _v in w.players.services("media_pause")] == [ent] and [e for e, _v in w.players.services("media_play")] == [ent]
    assert w.players.s["media_player.denon_main"]["state"] == "playing" and "media_player.denon_main" not in w.speaker.calls[0][1]


# ---------------------------------------------------------------------------------------------------- quiet hours

def test_quiet_hours_suppress_but_a_critical_announcement_is_exempt(world):
    w = world
    enable(w, quiet={"enabled": True})
    assert speak(w).status_code == 200, "daytime: nothing is held"
    w.clock["now"] = NIGHT
    r = w.c.post(ANN, json={"scope": "device", "ref": w.keys["a"], "text": "בלילה"})
    assert r.status_code == 409 and r.json()["code"] == "quiet_hours" and r.json()["details"]["message_en"]
    assert len(w.speaker.calls) == 1
    d = audit_details(w)
    assert d["decision"] == "denied" and d["reason"] == "quiet_hours" and d["status"] == "refused"
    h = history(w)[0]
    assert h["status"] == "refused" and h["error"] == "quiet_hours"
    w.clock["now"] += dt.timedelta(minutes=2)
    r = w.c.post(ANN, json={"scope": "device", "ref": w.keys["a"], "text": "דחוף", "critical": True})
    assert r.status_code == 200 and len(w.speaker.calls) == 2 and audit_details(w)["critical"] is True


def test_quiet_hours_cross_midnight_follow_the_days_and_the_installation_zone(world):
    w = world
    enable(w, quiet={"enabled": True, "from": "22:00", "to": "07:00", "days": ["thu"]})  # 2026-10-01 is a Thursday: the window that STARTS Thursday
    w.clock["now"] = NIGHT
    assert w.c.post(ANN, json={"scope": "device", "ref": w.keys["a"], "text": "x"}).status_code == 409
    w.clock["now"] = dt.datetime(2026, 10, 2, 1, 0, tzinfo=dt.timezone.utc)  # 04:00 local, Friday: still the Thursday window
    assert w.c.post(ANN, json={"scope": "device", "ref": w.keys["a"], "text": "x"}).status_code == 409
    w.clock["now"] = dt.datetime(2026, 10, 2, 20, 0, tzinfo=dt.timezone.utc)  # Friday 23:00: Friday is not a quiet day
    assert w.c.post(ANN, json={"scope": "device", "ref": w.keys["a"], "text": "x"}).status_code == 200


def test_lower_mode_speaks_at_the_night_volume(world):
    w = world
    enable(w, volume=80, quiet={"enabled": True, "mode": "lower", "night_volume": 25})
    ent = entity(w)
    w.players.add(ent, state="idle", volume=0.5)
    assert speak(w).status_code == 200 and w.players.services("volume_set")[0] == (ent, 0.8), "daytime: the default volume"
    w.clock["now"] = NIGHT
    assert speak(w).status_code == 200  # speak() moves the clock by two minutes: still inside the window
    assert w.players.services("volume_set")[2] == (ent, 0.25) and "quiet_lowered" in audit_details(w)["notes"]
    assert speak(w, volume=10).status_code == 200 and w.players.services("volume_set")[4] == (ent, 0.1), "never louder than asked"
    r = speak(w, critical=True)
    assert r.status_code == 200 and w.players.services("volume_set")[6] == (ent, 0.8) and "notes" not in audit_details(w), "critical keeps its volume"


def test_quiet_settings_are_validated_and_audited(world):
    w = world
    for bad in ({"enabled": "yes"}, {"from": "25:00"}, {"from": "08:00", "to": "08:00"}, {"mode": "mute"}, {"days": ["xyz"]}, {"night_volume": "low"}, {"surprise": 1}):
        assert w.c.put(f"{ANN}/config", json={"quiet": bad}).status_code == 422, bad
    out = w.c.put(f"{ANN}/config", json={"quiet": {"enabled": True, "from": "23:30", "to": "06:00", "mode": "lower", "night_volume": 400}}).json()
    assert out["changed"] == ["quiet"] and out["config"]["quiet"]["night_volume"] == 100 and out["config"]["quiet"]["from"] == "23:30"
    assert w.c.put(f"{ANN}/config", json={"quiet": {"night_volume": None}}).json()["config"]["quiet"]["night_volume"] is None
    with w.db.connection(mode="read") as conn:
        n = conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'media.announce.config'").fetchone()[0]
    assert n == 2


# ---------------------------------------------------------------------------------------------------- the rule action

def _rule(w: World, **action):
    body = {"name": "דלת", "trigger": {"types": ["door"], "sources": ["system"]}, "scope": {}, "cooldown_s": 0,
            "actions": [{"kind": "announce", "scope": "device", "ref": w.keys["a"], "message": "הדלת פתוחה", **action}]}
    r = w.c.post(f"{API}/rules", json=body)
    assert r.status_code == 201, r.text
    return r.json()


def _fire(w: World, n: int) -> list[dict]:
    ev = {"id": f"e{n}", "type": "door", "source": "system", "severity": "alert", "camera_id": None, "occurred_at": "2026-10-01T09:00:00Z", "details": {}}
    with w.db.connection() as conn:
        fired = rules_svc.evaluate_event(conn, ev, "Asia/Jerusalem", deliver=False)
    rules_svc.deliver_pending(fired)
    return fired


def test_a_rule_announce_action_carries_a_volume_and_is_silent_in_the_quiet_hours(world):
    w = world
    enable(w, quiet={"enabled": True})
    ent = entity(w)
    w.players.add(ent, state="idle", volume=0.3)
    rule = _rule(w, volume=55)
    assert rule["actions"][0]["volume"] == 55 and rule["actions"][0]["critical"] is False
    assert _fire(w, 1)[0]["announce"][0]["status"] == "sent" and w.players.services("volume_set")[0] == (ent, 0.55)
    w.clock["now"] = NIGHT
    assert _fire(w, 2)[0]["announce"][0]["status"] == "quiet_hours" and len(w.speaker.calls) == 1, "a rule is silent at night"
    bad = {"name": "x", "actions": [{"kind": "announce", "scope": "device", "ref": w.keys["a"], "message": "x", "volume": "loud"}]}
    assert w.c.post(f"{API}/rules", json=bad).status_code == 422


def test_a_critical_rule_speaks_in_the_quiet_hours(world):
    w = world
    enable(w, quiet={"enabled": True})
    _rule(w, critical=True)
    w.clock["now"] = NIGHT
    assert _fire(w, 3)[0]["announce"][0]["status"] == "sent" and len(w.speaker.calls) == 1


# ---------------------------------------------------------------------------------------------------- the notification channel

def route(w: World, **body):
    r = w.c.put(f"{ANN}/config", json={"notify": {"enabled": True, "scope": "device", "ref": w.keys["a"], **body}})
    assert r.status_code == 200, r.text
    return r.json()["config"]["notify"]


def emit(w: World, key: str = "n1", **kw):
    w.clock["now"] += dt.timedelta(minutes=2)
    nid = w.emit("camera.offline", "camera", w.cam, params={"name": "לובי"}, dedupe_key=key, **kw).id
    w.flush()
    return nid


def announce_rows(w: World, nid: str) -> list[dict]:
    return [r for r in w.deliveries(nid) if r["channel"] == "announce"]


def test_the_policy_channel_speaks_a_notification_and_leaves_a_delivery_row_an_announcement_row_and_an_audit_row(world):
    w = world
    enable(w)
    route(w)
    w.set_policy("camera.offline", channels={"announce": True})
    assert w.c.get(f"{API}/notify/policies/camera.offline").json()["channels"]["announce"] is True
    nid = emit(w)
    assert len(w.speaker.calls) == 1
    _eng, entities, message, _lang = w.speaker.calls[0]
    assert entities and "לובי" in message and "מצלמה" in message
    rows = announce_rows(w, nid)
    assert [(r["status"], r["user_id"], r["target_ref"]) for r in rows] == [("sent", None, "announce:device")]
    h = history(w)[0]
    assert h["source"] == "notification" and h["status"] == "sent" and h["username"] is None
    with w.db.connection(mode="read") as conn:
        assert conn.execute("SELECT notification_id FROM announcements").fetchone()[0] == nid
    d = audit_details(w)
    assert d["source"] == "notification" and d["notification_id"] == nid and d["decision"] == "allowed"


def test_nothing_is_spoken_unless_the_policy_channel_the_routing_and_the_feature_are_all_on(world):
    w = world
    enable(w)
    route(w)
    nid = emit(w, "off1")  # the policy channel is off (the default)
    assert announce_rows(w, nid) == [] and w.speaker.calls == []
    w.set_policy("camera.offline", channels={"announce": True})
    w.c.put(f"{ANN}/config", json={"notify": {"enabled": False}})
    nid = emit(w, "off2")
    assert [(r["status"], r["reason"]) for r in announce_rows(w, nid)] == [("skipped", "channel_unavailable")] and w.speaker.calls == []
    route(w)
    w.c.put(f"{ANN}/config", json={"enabled": False})
    nid = emit(w, "off3")
    assert [(r["status"], r["reason"]) for r in announce_rows(w, nid)] == [("skipped", "channel_unavailable")] and w.speaker.calls == []
    w.c.put(f"{ANN}/config", json={"enabled": True, "notify": {"ref": ""}})
    nid = emit(w, "off4")
    assert [(r["status"], r["reason"]) for r in announce_rows(w, nid)] == [("skipped", "channel_unavailable")] and w.speaker.calls == []


def test_routing_by_category_and_severity(world):
    w = world
    enable(w)
    w.set_policy("camera.offline", channels={"announce": True})  # camera.offline is a `device_faults` notification of severity alert
    route(w, categories=["doors"])
    assert announce_rows(w, emit(w, "c1")) == [] and w.speaker.calls == [], "another category: not routed, no row"
    route(w, categories=["doors", "device_faults"])
    assert [r["status"] for r in announce_rows(w, emit(w, "c2"))] == ["sent"]
    route(w, categories=[], min_severity="critical")
    assert announce_rows(w, emit(w, "c3")) == [] and len(w.speaker.calls) == 1, "below the minimum severity"
    w.set_policy("camera.offline", severity="critical")
    assert [r["status"] for r in announce_rows(w, emit(w, "c4"))] == ["sent"] and len(w.speaker.calls) == 2
    for bad in ({"categories": ["nope"]}, {"min_severity": "huge"}, {"scope": "room"}, {"surprise": 1}, {"enabled": "yes"}):
        assert w.c.put(f"{ANN}/config", json={"notify": bad}).status_code == 422, bad


def test_quiet_hours_hold_the_channel_but_critical_and_escalations_pass(world):
    w = world
    enable(w, quiet={"enabled": True})
    route(w)
    w.set_policy("camera.offline", channels={"announce": True})
    w.clock["now"] = NIGHT
    nid = emit(w, "q1")
    assert [(r["status"], r["reason"]) for r in announce_rows(w, nid)] == [("skipped", "quiet_hours")] and w.speaker.calls == []
    w.set_policy("camera.offline", severity="critical")
    nid = emit(w, "q2")
    assert [r["status"] for r in announce_rows(w, nid)] == ["sent"] and len(w.speaker.calls) == 1
    # lower mode: the channel speaks, at the night volume
    w.set_policy("camera.offline", severity="alert")
    w.c.put(f"{ANN}/config", json={"volume": 70, "quiet": {"mode": "lower", "night_volume": 20}})
    ent = entity(w)
    w.players.add(ent, state="idle", volume=0.5)
    nid = emit(w, "q3")
    assert [r["status"] for r in announce_rows(w, nid)] == ["sent"] and w.players.services("volume_set")[0] == (ent, 0.2)


def test_the_installation_limits_apply_to_the_channel(world):
    w = world
    enable(w, max_per_minute=1)
    route(w)
    w.set_policy("camera.offline", channels={"announce": True})
    first = w.emit("camera.offline", "camera", w.cam, params={"name": "א"}, dedupe_key="l1").id
    second = w.emit("camera.offline", "camera", w.cam, params={"name": "ב"}, dedupe_key="l2").id
    w.flush()  # same clock instant: the per-minute limit and the cooldown both apply
    assert len(w.speaker.calls) == 1
    got = {nid: [(r["status"], r["reason"]) for r in announce_rows(w, nid)] for nid in (first, second)}
    assert sorted(v[0][0] for v in got.values()) == ["sent", "skipped"] and ("skipped", "rate_limited") in [v[0] for v in got.values()]
    assert [h["status"] for h in history(w)].count("limited") == 1, "the limited attempt is logged as such"


def test_an_engine_failure_is_a_failed_delivery_and_the_pause_is_undone(world):
    w = world
    enable(w, pause_music=True)
    route(w)
    ent = entity(w)
    w.players.add(ent, state="playing")
    w.set_policy("camera.offline", channels={"announce": True})
    w.speaker.error = ApiError(503, "ha_unavailable", "x")
    nid = emit(w)
    assert [(r["status"], r["reason"]) for r in announce_rows(w, nid)] == [("failed", "speak_failed")]
    assert w.players.s[ent]["state"] == "playing", "the music was resumed"
    with w.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM notification_events WHERE notification_id = ? AND kind = 'delivery_failed'", (nid,)).fetchone()[0] == 1


def test_the_spoken_text_follows_the_lock_screen_level(world):
    w = world
    enable(w, language="en")
    route(w)
    w.set_policy("camera.offline", channels={"announce": True})
    w.set_settings(lockscreen="generic")
    emit(w)
    assert w.speaker.calls[-1][2] == "New notification"
    w.set_settings(lockscreen="type_place")
    nid = emit(w, "t2")
    assert "לובי" in w.speaker.calls[-1][2]
    assert [r["status"] for r in announce_rows(w, nid)] == ["sent"]


def test_the_channel_key_is_accepted_and_returned_by_the_policy_api(world):
    w = world
    p = w.c.get(f"{API}/notify/policies/camera.offline").json()
    assert p["channels"]["announce"] is False
    assert w.set_policy("camera.offline", channels={"announce": True})["channels"]["announce"] is True
    assert w.c.put(f"{API}/notify/policies/camera.offline", json={"channels": {"announce": "yes"}}).status_code == 422
