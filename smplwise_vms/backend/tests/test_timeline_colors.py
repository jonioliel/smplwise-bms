"""Owner 2026-10-01: the person dots and the recording bars of the investigation timeline were both blue, so each kind has a colour
setting - `timeline.colors` in PATCH /settings, an installation-wide JSON object {option: palette name | #rrggbb}
(services/timeline_colors.py). Read back as an object with every option; changed with system.configure only; refused values
change nothing; audited. The value can never carry CSS: the frontend applies it as custom properties."""
from __future__ import annotations

import json
import re
from pathlib import Path

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import timeline_colors

URL = "/api/v1/settings"
DEFAULT = {"recording": "accent", "motion": "red", "person": "orange", "vehicle": "green", "door": "purple", "line": "amber", "offline": "gray"}

BAD = [
    "accent",
    [],
    True,
    {"person": "red;background:url(x)"},  # CSS injection through a value
    {"person": "#fff"},  # short hex is not accepted
    {"person": "#12345g"},
    {"person": "#2f6bff\n"},  # a trailing newline must not slip past the pattern
    {"person": "rgb(1,2,3)"},
    {"person": "var(--sw-danger)"},
    {"person": "javascript:alert(1)"},
    {"person": "Orange"},  # names are exact
    {"person": ""},
    {"person": 5},
    {"person": None},
    {"person": ["red"]},
    {"bogus": "red"},  # unknown option
    {"person; color": "red"},
    {"person": "red", "extra": "blue"},
]


def _audit_details(app):
    with app.state.db.connection() as conn:
        return [json.loads(r[0] or "{}") for r in conn.execute("SELECT details_json FROM audit_log WHERE action = 'settings.update' AND decision = 'allowed' ORDER BY rowid").fetchall()]


def test_normalize_fills_defaults_accepts_palette_and_hex_and_refuses_the_rest():
    assert timeline_colors.normalize({}) == DEFAULT
    assert timeline_colors.normalize({"person": "teal", "recording": "#2F6BFF"}) == {**DEFAULT, "person": "teal", "recording": "#2f6bff"}
    for token in timeline_colors.TOKENS:
        assert timeline_colors.normalize({"door": token})["door"] == token
    for bad in BAD:
        with pytest.raises(ValueError):
            timeline_colors.normalize(bad)


def test_person_is_no_longer_the_recording_blue_by_default(client):
    got = client.get(URL).json()["settings"]["timeline.colors"]
    assert got == DEFAULT, "an object with every option, not a JSON string"
    assert got["person"] != got["recording"]
    assert set(got) == set(timeline_colors.OPTIONS)


def test_round_trip_replaces_the_whole_value_and_is_audited(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        r = c.patch(URL, json={"timeline.colors": {"person": "#AA11CC", "recording": "teal"}})
        assert r.status_code == 200, r.text
        want = {**DEFAULT, "person": "#aa11cc", "recording": "teal"}
        assert r.json()["settings"]["timeline.colors"] == want
        assert c.get(URL).json()["settings"]["timeline.colors"] == want
        # options left out take their default again (the value is replaced, never merged)
        assert c.patch(URL, json={"timeline.colors": {"door": "pink"}}).json()["settings"]["timeline.colors"] == {**DEFAULT, "door": "pink"}
        # a patch without the key leaves it alone
        assert c.patch(URL, json={"ui.hide_map": "true"}).json()["settings"]["timeline.colors"] == {**DEFAULT, "door": "pink"}
        # an empty object is the way back to the defaults
        assert c.patch(URL, json={"timeline.colors": {}}).json()["settings"]["timeline.colors"] == DEFAULT
        # every change is on the record with the normalised value
        assert {"timeline.colors": want} in _audit_details(app)


def test_bad_values_are_a_422_and_change_nothing(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        assert c.patch(URL, json={"timeline.colors": {"vehicle": "cyan"}}).status_code == 200
        want = c.get(URL).json()["settings"]["timeline.colors"]
        for bad in BAD:
            r = c.patch(URL, json={"timeline.colors": bad})
            assert r.status_code == 422, (bad, r.text)
        assert c.get(URL).json()["settings"]["timeline.colors"] == want
        with app.state.db.connection() as conn:
            stored = conn.execute("SELECT value FROM settings WHERE key = 'timeline.colors'").fetchone()[0]
            n = conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'settings.update' AND decision = 'allowed' AND details_json LIKE '%timeline.colors%'").fetchone()[0]
        assert "url(" not in stored and ";" not in stored
        assert n == 1, "only the one accepted change is audited"


def test_only_system_configure_may_change_it(settings):
    c = TestClient(create_app(settings))
    c.get("/api/v1/me")
    bind(c, settings, "dana", "viewer", "installation", "*")
    assert c.patch(URL, headers=as_user("dana"), json={"timeline.colors": {"person": "pink"}}).status_code == 403
    assert c.get(URL).json()["settings"]["timeline.colors"] == DEFAULT
    # every user may read it (the timeline of every user follows it)
    assert c.get(URL, headers=as_user("dana")).json()["settings"]["timeline.colors"] == DEFAULT


def test_a_corrupt_stored_value_reads_as_the_defaults(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        with app.state.db.connection() as conn:
            conn.execute("INSERT INTO settings(key, value) VALUES('timeline.colors', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", ("[1, 2",))
        assert c.get(URL).json()["settings"]["timeline.colors"] == DEFAULT
        with app.state.db.connection() as conn:
            conn.execute("UPDATE settings SET value = ? WHERE key = 'timeline.colors'", ('{"person": "red;background:url(x)"}',))
        assert c.get(URL).json()["settings"]["timeline.colors"] == DEFAULT


def test_the_frontend_palette_names_the_same_swatches():
    """frontend/src/api/timeline-colors.ts maps each palette name to a hex; the lists must not drift apart."""
    ts = (Path(__file__).resolve().parents[3] / "frontend" / "src" / "api" / "timeline-colors.ts").read_text(encoding="utf-8")
    block = re.search(r"export const TIMELINE_PALETTE[^{]*\{(.*?)\n\};", ts, re.S)
    assert block, "TIMELINE_PALETTE not found"
    assert tuple(re.findall(r"^\s*([a-z]+): \{ hex", block.group(1), re.M)) == timeline_colors.TOKENS
    options = re.search(r"export const TIMELINE_OPTIONS[^=]*=\s*\[(.*?)\]", ts, re.S)
    assert options and tuple(re.findall(r"'([a-z]+)'", options.group(1))) == timeline_colors.OPTIONS
    defaults = re.search(r"export const DEFAULT_TIMELINE_COLORS[^{]*\{(.*?)\};", ts, re.S)
    assert defaults and dict(re.findall(r"(\w+): '([a-z]+)'", defaults.group(1))) == DEFAULT
