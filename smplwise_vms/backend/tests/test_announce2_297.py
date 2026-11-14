"""ANNOUNCE2-297: the owner's answers of 27.10 on announcements.

- The emergency close lock on a wall display: 15 seconds by default, a setting of 0-600 whole seconds.
- The translation provider: the free Google translation is the default provider (no key; the text goes to a fixed Google host in the request
  body, never in the address); the OpenAI provider (`cloud`) stays selectable with its key in the secrets store; the provider is a setting and
  switching on still needs the recorded approval.
- Translation never delays sending: a machine-translated part is accepted by the normal and the emergency send without any "reviewed" flag.

NOTHING leaves the test: `urllib.request.urlopen` is replaced in every test (a failing stub, or a recorder that answers like the service)."""
from __future__ import annotations

import io
import json
import urllib.parse
import urllib.request

import pytest

from smplwise.services import announce_screens as scr
from smplwise.services import announce_translate as tr
from test_announce_translate_297 import API, enable, world  # noqa: F401 - the shared fixture


# ---------------------------------------------------------------------------------------------------- q71: the close lock

def test_the_close_lock_defaults_to_15_and_takes_whole_seconds_0_to_600(world):
    w = world
    assert scr.DEFAULTS[scr.K_CRIT_CLOSE] == "15" and scr.CRIT_CLOSE_RANGE == (0, 600)
    cfg = enable(w)["config"]["screens"]
    assert cfg["critical_close_s"] == 15
    for ok in (0, 1, 600):
        r = w.c.put(f"{API}/config", json={"screens": {"critical_close_s": ok}})
        assert r.status_code == 200 and r.json()["config"]["screens"]["critical_close_s"] == ok, ok
    for bad in (-1, 601, 15.5, 15.0, "15", True, False, None, [15]):
        assert w.c.put(f"{API}/config", json={"screens": {"critical_close_s": bad}}).status_code == 422, bad
    assert w.c.get(f"{API}/config").json()["config"]["screens"]["critical_close_s"] == 600


# ---------------------------------------------------------------------------------------------------- q72: the provider

def test_google_is_the_default_provider_and_needs_no_key(world, monkeypatch):
    w = world
    assert tr.DEFAULTS[tr.K_PROVIDER] == "google"
    assert set(tr.PROVIDERS_KNOWN) == {"off", "google", "cloud"}
    assert "google" in tr.PROVIDERS and "cloud" in tr.PROVIDERS
    cfg = enable(w)["config"]["translate"]
    assert (cfg["enabled"], cfg["provider"], cfg["key_set"], cfg["approval"]) == (False, "google", True, None)
    # still off until someone records the approval for google
    r = w.c.put(f"{API}/config", json={"translate": {"enabled": True}})
    assert r.status_code == 422 and "translate.approval_required" in json.dumps(r.json())
    seen = []
    monkeypatch.setattr(tr, "GOOGLE_CALL", lambda text, source, target: seen.append((text, source, target)) or f"{target}:{text}")
    r = w.c.put(f"{API}/config", json={"translate": {"enabled": True, "approve": True}})
    assert r.status_code == 200 and r.json()["config"]["translate"]["approval"]["provider"] == "google"
    assert w.c.get(f"{API}/areas").json()["translate_enabled"] is True, "no key needed: the form offers it"
    r = w.c.post(f"{API}/translate", json={"text": "שלום", "targets": ["en"]})
    assert r.status_code == 200 and r.json()["provider"] == "google" and r.json()["items"][0]["text"] == "en:שלום"
    assert seen == [("שלום", "he", "en")]


def test_openai_stays_selectable_with_its_own_approval_and_key(world):
    w = world
    enable(w)
    assert w.c.put(f"{API}/config", json={"translate": {"enabled": True, "approve": True}}).status_code == 200  # google approved
    r = w.c.put(f"{API}/config", json={"translate": {"provider": "cloud"}})
    assert r.status_code == 422 and "translate.approval_required" in json.dumps(r.json()), "another provider is a new decision"
    r = w.c.put(f"{API}/config", json={"translate": {"provider": "cloud", "enabled": False}})
    assert r.status_code == 200
    cfg = r.json()["config"]["translate"]
    assert (cfg["provider"], cfg["key_set"], cfg["approval"]) == ("cloud", False, None)
    assert w.c.put(f"{API}/config", json={"translate": {"provider": "nope"}}).status_code == 422


class _Resp(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *_a):
        return False


def test_the_default_google_call_posts_the_text_in_the_body_to_a_fixed_host(monkeypatch):
    got = []

    def fake(req, timeout=None):
        got.append((req, timeout))
        return _Resp(json.dumps([[["Water ", "המים", None], ["will be cut", "יופסקו", None]], None, "iw"]).encode())

    monkeypatch.setattr(urllib.request, "urlopen", fake)
    assert tr.default_google_call("המים יופסקו", "he", "en") == "Water will be cut"
    ((req, timeout),) = got
    u = urllib.parse.urlsplit(req.full_url)
    assert (u.scheme, u.netloc) == ("https", tr.GOOGLE_HOST) and req.get_method() == "POST" and timeout == tr.CLOUD_TIMEOUT_S
    q = urllib.parse.parse_qs(u.query)
    assert q["sl"] == ["iw"] and q["tl"] == ["en"]  # Google's code for Hebrew
    assert "המים" not in urllib.parse.unquote(req.full_url), "the text never goes into the address"
    assert urllib.parse.parse_qs(req.data.decode())["q"] == ["המים יופסקו"]
    assert not any(k.lower() == "authorization" for k in req.headers)


@pytest.mark.parametrize(("answer", "code"), [(b"", "translate_failed"), (b"<html>", "translate_failed"), (b"[]", "translate_failed"), (b"[[]]", "translate_failed"),
                                              (b'[[[null, "x"]]]', "translate_failed")])
def test_the_default_google_call_refuses_odd_answers(monkeypatch, answer, code):
    monkeypatch.setattr(urllib.request, "urlopen", lambda _r, timeout=None: _Resp(answer))
    with pytest.raises(tr.TranslateError) as exc:
        tr.default_google_call("שלום", "he", "ru")
    assert exc.value.code == code


def test_the_default_google_call_maps_failures_to_codes(monkeypatch):
    import urllib.error

    def busy(req, timeout=None):
        raise urllib.error.HTTPError(req.full_url, 429, "Too Many Requests", {}, None)

    monkeypatch.setattr(urllib.request, "urlopen", busy)
    with pytest.raises(tr.TranslateError) as exc:
        tr.default_google_call("שלום", "he", "ar")
    assert exc.value.code == "translate_rate_limited"

    def down(*_a, **_k):
        raise OSError("no route")

    monkeypatch.setattr(urllib.request, "urlopen", down)
    with pytest.raises(tr.TranslateError) as exc:
        tr.default_google_call("שלום", "he", "ar")
    assert exc.value.code == "translate_unreachable" and "שלום" not in str(exc.value)


# ---------------------------------------------------------------------------------------------------- q73: never delays sending

def test_machine_parts_are_sent_at_once_by_the_emergency_free_text(world):
    w = world
    enable(w)
    w.clock["now"] = w.clock["now"].replace(microsecond=0)
    r = w.c.post(f"{API}/emergency", json={"texts": [{"language": "he", "text": "פנו את הבניין"}, {"language": "en", "text": "Evacuate the building", "machine": True}]})
    assert r.status_code == 200, r.text
    assert [c[3] for c in w.speaker.calls] == ["he", "en"]
