"""CAL-FEED-REVIEW-2351: the security review of the outgoing iCal feed (contract 15.6 / 15.11; docs/changes/CAL-FEED-REVIEW-2351.md).
One test (or more) per finding, through the real app on a temporary database, on the local AND the remote channel (`/arx`): token design
(entropy, hash only, shown once, rotation / revocation, age limit), nothing personal in the document (notes, attendees - users, residents,
guests, their contacts and counts - organisers, on-behalf labels), RFC 5545 escaping (no property injection), the size cap, rate limits
per client address (misses count) and per feed, the creator's CURRENT authority, response headers (no cookie, no-store, no CORS), the token
kept out of log lines and connection labels, the constant-time compare, and the per-feed remote switch (default off, local sessions only,
audited; the edge still blocks every other shape). Fakes only: no Home Assistant, no network."""
from __future__ import annotations

import dataclasses
import datetime as dt
import hashlib
import json
import logging
import re

import pytest
from fastapi.testclient import TestClient

from conftest import as_user, bind
from smplwise import remote_channel
from smplwise.config import Settings
from smplwise.db import Database
from smplwise.main import create_app
from smplwise.routers import calendar as cal_router
from smplwise.routers import calendar_feeds as feeds

API = "/api/v1"
REMOTE = "/arx/api/v1"
UTC = dt.timezone.utc
NOW = dt.datetime(2026, 11, 2, 9, 0, tzinfo=UTC)
GUEST_NAME, GUEST_PHONE, GUEST_EMAIL = "אורחת סודית", "050-555-0142", "guest.secret@example.test"
ALLOWED_PROPS = {"BEGIN", "END", "VERSION", "PRODID", "CALSCALE", "METHOD", "UID", "DTSTAMP", "DTSTART", "DTEND", "SUMMARY", "TRANSP", "CLASS"}


@pytest.fixture(scope="module")
def _app(tmp_path_factory):
    st = Settings(data_dir=tmp_path_factory.mktemp("calfeed2351") / "data", www_dir=None, in_addon=False, trusted_proxies=("172.30.32.2",), dev_user="joni",
                  bootstrap_admin_username="joni", nvr_host="nvr-placeholder.test", nvr_http_port=80, nvr_user=None, nvr_password=None, go2rtc_url=None,
                  log_level="warning", max_upload_bytes=5 * 1024 * 1024, max_pdf_pages=5, max_render_px=800, preview_px=300)
    st = dataclasses.replace(st, remote_access=True)
    c = TestClient(create_app(st))
    c.settings_obj = st
    c.get(f"{API}/me")
    return c


@pytest.fixture()
def cc(_app, monkeypatch):
    monkeypatch.setattr(cal_router, "_now", lambda: NOW)
    with Database(_app.settings_obj.db_path).connection() as c:
        for t in ("cal_attendee_notices", "cal_attendee_policy", "cal_attendees", "cal_occurrences", "cal_guest_details", "cal_approvals", "cal_event_rooms",
                  "cal_events", "cal_members", "cal_feeds", "cal_calendars"):
            c.execute(f"DELETE FROM {t}")
        c.execute("DELETE FROM bindings WHERE assigned_by = 'test'")
        c.execute("DELETE FROM settings WHERE key LIKE 'calendar.%'")
        c.execute("DELETE FROM audit_log WHERE action LIKE 'calendar.%'")
        c.execute("UPDATE users SET active = 1")
    with feeds._RATE_LOCK:
        feeds._RATE.clear()
    return _app


def ok(r, code=200):
    assert r.status_code == code, r.text
    return r.json()


def db(c):
    return Database(c.settings_obj.db_path)


def enable(c, **over):
    return ok(c.put(f"{API}/calendar/settings", json={"enabled": True, "feeds_enabled": True, **over}))


def room(c, name="חדר א"):
    return ok(c.post(f"{API}/calendar/calendars", json={"name": name, "type": "room", "color": "blue", "capacity": 20, "buffer_after_min": 0}), 201)["calendar"]


def event(c, cal, title="ישיבת הנהלה", start="2026-11-03T10:00:00Z", end="2026-11-03T11:00:00Z", **kw):
    return ok(c.post(f"{API}/calendar/events", json={"calendar_id": cal["id"], "title": title, "start": start, "end": end, **kw}), 201)


def feed(c, cal, detail="busy", who=None):
    return ok(c.post(f"{API}/calendar/feeds", json={"calendar_ids": [cal["id"]], "detail": detail}, headers=who or {}), 201)


def token_of(path):
    return path.rsplit("/", 1)[1][:-4]


def audit_rows(c, action=None):
    with db(c).connection() as x:
        q = "SELECT * FROM audit_log WHERE action LIKE 'calendar.feed%'" + (" AND action = ?" if action else "")
        return [dict(r) for r in x.execute(q, (action,) if action else ()).fetchall()]


def props(text):
    """The property names of an unfolded VCALENDAR; asserts CRLF line endings and that only folded continuations start with a space."""
    assert text.endswith("\r\n") and "\n" not in text.replace("\r\n", "")
    unfolded = text.replace("\r\n ", "")
    names = []
    for line in unfolded.split("\r\n")[:-1]:
        m = re.match(r"^([A-Z-]+)[:;]", line)
        assert m, line
        names.append(m.group(1))
    return names, unfolded


# ---------------------------------------------------------------- F1 token design (entropy, hash only, shown once, rotation, age limit)

def test_token_is_256_bit_hashed_shown_once_and_rotation_restarts_its_age(cc, monkeypatch):
    enable(cc)
    cal = room(cc)
    a, b = feed(cc, cal), feed(cc, cal)
    ta, tb = token_of(a["path"]), token_of(b["path"])
    assert ta != tb and feeds.TOKEN_RE.fullmatch(ta) and len(ta) == 43  # token_urlsafe(32): 256 random bits
    with db(cc).connection() as x:
        hashes = {r[0] for r in x.execute("SELECT token_hash FROM cal_feeds")}
    assert hashes == {hashlib.sha256(ta.encode()).hexdigest(), hashlib.sha256(tb.encode()).hexdigest()}
    listed = json.dumps(ok(cc.get(f"{API}/calendar/feeds")))
    assert ta not in listed and tb not in listed and ta not in json.dumps(audit_rows(cc), default=str)
    assert a["feed"]["token_set_at"] == "2026-11-02T09:00:00Z" and a["feed"]["expires_at"] is None and a["feed"]["remote"] is False
    # the age limit (F7): `feed_max_age_days` counts from the token's issue; past it the uniform 404, rotation starts it again
    enable(cc, feed_max_age_days=7)
    assert ok(cc.get(f"{API}/calendar/feeds"))["feeds"][0]["expires_at"] == "2026-11-09T09:00:00Z"
    assert cc.get(a["path"]).status_code == 200
    later = NOW + dt.timedelta(days=8)
    monkeypatch.setattr(cal_router, "_now", lambda: later)
    assert cc.get(a["path"]).status_code == 404
    rot = ok(cc.post(f"{API}/calendar/feeds/{a['feed']['id']}/rotate"))
    assert rot["feed"]["expires_at"] == "2026-11-17T09:00:00Z" and cc.get(rot["path"]).status_code == 200 and cc.get(a["path"]).status_code == 404
    with pytest.raises(Exception):  # noqa: B017 - the setting is range-checked
        enable(cc, feed_max_age_days=99999)


# ---------------------------------------------------------------- F2 nothing personal: notes, attendees (2.35.0), organisers, labels

def test_attendees_guests_notes_and_labels_never_reach_either_detail_level(cc):
    enable(cc)
    cal = room(cc)
    bind(cc, cc.settings_obj, "dana", "operator", "installation", "*")
    out = event(cc, cal, title="ועד הבית", notes="הערה פרטית מאוד", on_behalf_kind="customer", on_behalf_label="משפחת לוי",
                attendees=[{"kind": "user", "ref_id": "dev-dana"},
                           {"kind": "guest", "name": GUEST_NAME, "phone": GUEST_PHONE, "email": GUEST_EMAIL, "role": "required"}])
    assert out["attendees"]["count"] >= 2  # the entry really carries attendees
    with db(cc).connection() as x:
        assert x.execute("SELECT COUNT(*) FROM cal_attendees WHERE removed_at IS NULL").fetchone()[0] >= 2
    for detail in ("busy", "titles"):
        doc = cc.get(feed(cc, cal, detail)["path"])
        assert doc.status_code == 200
        names, text = props(doc.text)
        assert set(names) <= ALLOWED_PROPS, set(names) - ALLOWED_PROPS  # no ATTENDEE / ORGANIZER / DESCRIPTION / X- / LOCATION
        assert names.count("BEGIN") == 2  # VCALENDAR + the one entry
        for secret in (GUEST_NAME, "+972505550142", "0505550142", "555-0142", GUEST_EMAIL, "dana", "Dana", "הערה פרטית", "משפחת לוי", "joni", "חדר א"):
            assert secret not in text, (detail, secret)
        assert ("SUMMARY:ועד הבית" in text) == (detail == "titles") and ("SUMMARY:תפוס" in text) == (detail == "busy")


# ---------------------------------------------------------------- F3 RFC 5545 escaping: no line / property injection, capped titles

def test_titles_cannot_inject_lines_or_properties_and_are_capped(cc):
    enable(cc)
    cal = room(cc)
    eid = event(cc, cal, title="x")["event"]["id"]
    evil = "a\r\nATTENDEE:mailto:x@evil.test\nb;c,d\\e LOCATION:x\u0085f\u007fg\x00h" + "ש" * 400
    with db(cc).connection() as x:
        x.execute("UPDATE cal_events SET title = ? WHERE id = ?", (evil, eid))  # an imported / legacy title is not trusted either
    text = cc.get(feed(cc, cal, "titles")["path"]).text
    names, unfolded = props(text)
    assert set(names) <= ALLOWED_PROPS and "ATTENDEE" not in names and "LOCATION" not in names
    summary = next(line for line in unfolded.split("\r\n") if line.startswith("SUMMARY:"))
    assert summary.startswith("SUMMARY:aATTENDEE:mailto:x@evil.testb\\;c\\,d\\\\eLOCATION:xfgh")
    assert len(summary) - len("SUMMARY:") <= feeds.MAX_TITLE + 10  # capped (escapes may add a few characters)
    assert all(len(line.encode("utf-8")) <= 75 for line in text.split("\r\n"))  # folded on octets


# ---------------------------------------------------------------- F4 size cap

def test_the_document_is_capped_in_bytes_and_stays_valid(cc, monkeypatch):
    enable(cc)
    cal = room(cc)
    for d in range(3, 9):
        event(cc, cal, title=f"אירוע {d}", start=f"2026-11-0{d}T10:00:00Z", end=f"2026-11-0{d}T11:00:00Z")
    path = feed(cc, cal, "titles")["path"]
    assert props(cc.get(path).text)[0].count("BEGIN") == 7
    monkeypatch.setattr(feeds, "MAX_DOC_BYTES", 700)
    names, _ = props(cc.get(path).text)
    assert 2 <= names.count("BEGIN") < 7 and names[-1] == "END" and names.count("BEGIN") == names.count("END")


# ---------------------------------------------------------------- F5 rate limits: per client address (misses count) and per feed

def test_per_address_budget_counts_misses_before_the_lookup_and_per_feed_budget_holds(cc):
    enable(cc, feed_address_rate_per_min=10, feed_rate_per_min=3)
    cal = room(cc)
    path = feed(cc, cal)["path"]
    misses = [cc.get(f"{API}/calendar/feed/{'A' * 43}.ics").status_code for _ in range(6)] + [cc.get(f"{API}/calendar/feed/junk").status_code for _ in range(4)]
    assert misses == [404] * 10
    assert cc.get(path).status_code == 429  # the address spent its budget guessing - the real token is no exception
    with feeds._RATE_LOCK:
        feeds._RATE.clear()
    assert [cc.get(path).status_code for _ in range(4)] == [200, 200, 200, 429]  # the feed's own budget
    # on the remote channel the budget is per CF-Connecting-IP (the socket peer is the tunnel)
    fid = ok(cc.get(f"{API}/calendar/feeds"))["feeds"][0]["id"]
    ok(cc.put(f"{API}/calendar/feeds/{fid}/remote", json={"enabled": True}))
    with feeds._RATE_LOCK:
        feeds._RATE.clear()
    bad = f"{REMOTE}/calendar/feed/{'B' * 43}.ics"
    assert [cc.get(bad, headers={"CF-Connecting-IP": "198.51.100.9"}).status_code for _ in range(11)][-1] == 429
    assert cc.get(REMOTE + path[len(API):], headers={"CF-Connecting-IP": "198.51.100.10"}).status_code == 200


# ---------------------------------------------------------------- F6 the creator's current authority

def test_a_feed_follows_its_creators_current_authority(cc):
    enable(cc)
    cal, other = room(cc), room(cc, "חדר ב")
    event(cc, cal, title="בחדר א")
    event(cc, other, title="בחדר ב", start="2026-11-04T10:00:00Z", end="2026-11-04T11:00:00Z")
    bind(cc, cc.settings_obj, "erin", "operator", "installation", "*")
    bind(cc, cc.settings_obj, "erin", "calendar_connect", "installation", "*")
    for c in (cal, other):
        cur = ok(cc.get(f"{API}/calendar/calendars/{c['id']}"))["calendar"]
        ok(cc.put(f"{API}/calendar/calendars/{c['id']}/members", json={"revision": cur["revision"],
                                                                          "members": [{"subject_kind": "user", "subject_id": "dev-erin", "cal_role": "edit"}]}))
    made = ok(cc.post(f"{API}/calendar/feeds", json={"calendar_ids": [cal["id"], other["id"]], "detail": "titles"}, headers=as_user("erin")), 201)
    t = cc.get(made["path"]).text
    assert "בחדר א" in t and "בחדר ב" in t
    # erin loses her edit role in one calendar: that calendar drops out of the feed at once
    cur = ok(cc.get(f"{API}/calendar/calendars/{other['id']}"))["calendar"]
    ok(cc.put(f"{API}/calendar/calendars/{other['id']}/members", json={"revision": cur["revision"],
                                                                         "members": [{"subject_kind": "user", "subject_id": "dev-erin", "cal_role": "view"}]}))
    t = cc.get(made["path"]).text
    assert "בחדר א" in t and "בחדר ב" not in t
    # an archived calendar drops out too; nothing left = the uniform 404
    with db(cc).connection() as x:
        x.execute("UPDATE cal_calendars SET archived_at = ? WHERE id = ?", ("2026-11-02T09:00:00Z", cal["id"]))
    assert cc.get(made["path"]).status_code == 404
    with db(cc).connection() as x:
        x.execute("UPDATE cal_calendars SET archived_at = NULL WHERE id = ?", (cal["id"],))
    assert cc.get(made["path"]).status_code == 200
    # an inactive creator, or one without `calendar.connect` any more: the uniform 404
    with db(cc).connection() as x:
        x.execute("UPDATE users SET active = 0 WHERE id = 'dev-erin'")
    assert cc.get(made["path"]).status_code == 404
    with db(cc).connection() as x:
        x.execute("UPDATE users SET active = 1 WHERE id = 'dev-erin'")
    assert cc.get(made["path"]).status_code == 200
    with db(cc).connection() as x:
        x.execute("DELETE FROM bindings WHERE assigned_by = 'test' AND role_id = 'calendar_connect'")
    assert cc.get(made["path"]).status_code == 404


# ---------------------------------------------------------------- F8 headers: no cookie, no store, no referrer, no CORS

def test_document_headers(cc):
    enable(cc)
    cal = room(cc)
    doc = cc.get(feed(cc, cal)["path"], headers={"Origin": "https://evil.example", "X-SW-Dev-User": ""})
    assert doc.status_code == 200 and doc.headers["content-type"].startswith("text/calendar")
    h = {k.lower(): v for k, v in doc.headers.items()}
    assert "set-cookie" not in h and "access-control-allow-origin" not in h
    assert h["cache-control"] == "private, no-store" and h["referrer-policy"] == "no-referrer" and h["x-robots-tag"] == "noindex, nofollow"
    assert h["x-content-type-options"] == "nosniff"


# ---------------------------------------------------------------- F9 the token never reaches a log line or a connection label

def test_access_log_lines_are_redacted_and_the_connection_label_has_no_token(cc, monkeypatch):
    tok = "Q" * 43
    rec = logging.LogRecord("uvicorn.access", logging.INFO, __file__, 1, '%s - "%s %s HTTP/%s" %d',
                            ("203.0.113.5:4411", "GET", f"/arx/api/v1/calendar/feed/{tok}.ics", "1.1", 200), None)
    assert feeds.RedactFeedToken().filter(rec) and tok not in rec.getMessage() and "/calendar/feed/REDACTED" in rec.getMessage()
    keep = logging.LogRecord("uvicorn.access", logging.INFO, __file__, 1, '%s - "%s %s"', ("x", "GET", "/api/v1/calendar/feeds/fed_1/rotate"), None)
    feeds.RedactFeedToken().filter(keep)
    assert "fed_1/rotate" in keep.getMessage()  # the management routes are not touched
    assert feeds._FILTER in logging.getLogger("uvicorn.access").filters and feeds._FILTER in logging.getLogger("smplwise").filters
    enable(cc)
    path = feed(cc, room(cc))["path"]
    labels = []
    real = Database.connection

    def spy(self, *a, **kw):
        labels.append(str(kw.get("label")))
        return real(self, *a, **kw)

    monkeypatch.setattr(Database, "connection", spy)
    assert cc.get(path).status_code == 200
    assert labels and not any(token_of(path) in x for x in labels)


# ---------------------------------------------------------------- F10 constant-time compare after the indexed lookup

def test_the_stored_hash_is_compared_in_constant_time(cc, monkeypatch):
    enable(cc)
    path = feed(cc, room(cc))["path"]
    calls = []
    real = feeds.hmac.compare_digest
    monkeypatch.setattr(feeds.hmac, "compare_digest", lambda a, b: calls.append(1) or real(a, b))
    assert cc.get(path).status_code == 200 and calls


# ---------------------------------------------------------------- F11 the remote channel: default off, per-feed switch, local-only, audited

def test_remote_is_off_by_default_switched_per_feed_from_a_local_session_and_audited(cc, monkeypatch):
    enable(cc)
    cal = room(cc)
    event(cc, cal)
    a, b = feed(cc, cal), feed(cc, cal)
    ra, rb = REMOTE + a["path"][len(API):], REMOTE + b["path"][len(API):]
    assert cc.get(a["path"]).status_code == 200  # local / ingress as before
    assert cc.get(ra).status_code == 404 and cc.get(rb).status_code == 404  # remote: the uniform 404 by default
    # the switch is refused from a remote session (route check; the remote session itself is covered by test_remote_access)
    monkeypatch.setattr(feeds, "_remote", lambda request: True)
    r = cc.put(f"{API}/calendar/feeds/{a['feed']['id']}/remote", json={"enabled": True})
    assert r.status_code == 403 and r.json()["code"] == "local_only"
    monkeypatch.undo()
    monkeypatch.setattr(cal_router, "_now", lambda: NOW)
    assert cc.put(f"{API}/calendar/feeds/{a['feed']['id']}/remote", json={"enabled": "yes"}).status_code == 422
    # another calendar.connect holder who is neither the creator nor an administrator may not switch it
    bind(cc, cc.settings_obj, "cora", "calendar_connect", "installation", "*")
    assert cc.put(f"{API}/calendar/feeds/{a['feed']['id']}/remote", json={"enabled": True}, headers=as_user("cora")).status_code in (403, 404)
    out = ok(cc.put(f"{API}/calendar/feeds/{a['feed']['id']}/remote", json={"enabled": True}))
    assert out["feed"]["remote"] is True
    rows = audit_rows(cc, "calendar.feed.remote")
    assert len(rows) == 1 and json.loads(rows[0]["details_json"])["enabled"] is True
    doc = cc.get(ra, headers={"CF-Connecting-IP": "203.0.113.20"})
    assert doc.status_code == 200 and "SUMMARY:תפוס" in doc.text and "set-cookie" not in {k.lower() for k in doc.headers}
    assert cc.get(rb).status_code == 404  # only THAT feed
    # the edge still blocks every other method and shape under the prefix
    assert cc.post(ra).status_code == 404 and cc.head(ra).status_code == 404
    assert cc.get(ra + ".map").status_code == 404 and cc.get(ra[:-4]).status_code == 404 and cc.get(ra + "/x").status_code == 404
    assert cc.get(f"{REMOTE}/calendar/feed").status_code == 404
    # off again, or revoked: the uniform 404 remotely (a revoke also clears the switch)
    ok(cc.put(f"{API}/calendar/feeds/{a['feed']['id']}/remote", json={"enabled": False}))
    assert cc.get(ra).status_code == 404
    ok(cc.put(f"{API}/calendar/feeds/{a['feed']['id']}/remote", json={"enabled": True}))
    ok(cc.post(f"{API}/calendar/feeds/{a['feed']['id']}/revoke"))
    assert cc.get(ra).status_code == 404 and ok(cc.get(f"{API}/calendar/feeds"))["feeds"][0]["remote"] is False
    assert cc.put(f"{API}/calendar/feeds/{a['feed']['id']}/remote", json={"enabled": True}).status_code == 409


def test_edge_gate_shape():
    ok_path = f"/api/v1/calendar/feed/{'a' * 43}.ics"
    assert remote_channel._route_gated("http", "GET", ok_path)
    for method, path in (("POST", ok_path), ("HEAD", ok_path), ("GET", ok_path + ".map"), ("GET", f"/api/v1/calendar/feed/{'a' * 42}.ics"),
                         ("GET", "/api/v1/calendar/feed/../feeds"), ("GET", f"/api/v1/calendar/feed/{'a' * 43}.ics/x")):
        assert not remote_channel._route_gated("http", method, path), (method, path)
    assert not remote_channel._route_gated("websocket", "GET", ok_path)
    assert feeds.DOC_PATH_RE.pattern == remote_channel.ROUTE_GATED_ON_REMOTE[0][1].pattern


def test_migration_0193_columns(cc):
    from smplwise.db import MIGRATIONS_DIR

    nums = sorted(int(p.name[:4]) for p in MIGRATIONS_DIR.glob("*.sql"))
    assert nums == list(range(nums[0], nums[-1] + 1)) and 193 in nums  # contiguous, no gap, no duplicate
    assert (MIGRATIONS_DIR / "0193_calendar_feed_review.sql").exists()
    with db(cc).connection() as x:
        cols = {r[1]: r for r in x.execute("PRAGMA table_info(cal_feeds)")}
    assert "remote_enabled" in cols and cols["remote_enabled"][4] == "0" and "token_set_at" in cols
