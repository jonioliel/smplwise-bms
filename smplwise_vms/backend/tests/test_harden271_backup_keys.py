"""2.7.1 hardening (integration notes open risk 9, HARDEN271 item 1): the installation-local secrets and security switches that
2.7.0 added are never exported in a project backup and never taken from one - a `replace` or `merge` restore leaves the
installation's own values alone, even when an (older or hand-made) archive carries them.

- `access.messaging.phone_key` (WA-SEND-FIX): the HMAC key of the phone hashes. Restored, every number-based opt-out of this
  installation stops matching; exported, the key sits in the archive in the clear.
- `access.messaging` (people messaging; WA-SEND-FIX caps + send hours, WA-CONSENT-LINK `consent_by_link`): an archive must not switch
  messaging or consent by link on, or loosen the caps (the `notify.whatsapp` / `messaging.whatsapp` precedent).
- `access.external_grants` + `access.external.*` (WISKEYID): the external-grant switch and its limits are security policy.
- `bridge.local_identity_extended` (SVCIDENT2): the bridge's last reported copy of the extended switch is runtime state.
Vendor uploads and the vendor portal keep their switches inside `tickets.settings`, which was already kept (checked below)."""
from __future__ import annotations

import io
import json
import zipfile
from dataclasses import replace

from conftest import seed_tree
from fastapi.testclient import TestClient

from smplwise.db import get_setting, set_setting
from smplwise.main import create_app
from smplwise.services import access_grants as ag
from smplwise.services import backup as svc
from smplwise.services import intercom_messaging as im
from smplwise.services import service_identity as si

NEW_KEYS = (im.PHONE_KEY_SETTING, im.SETTING_KEY, ag.FLAG_KEY, ag.MAX_DAYS_KEY, ag.MAX_DOORS_KEY, ag.FRESH_KEY, ag.CODE_HOUR_KEY,
            ag.LOCAL_KEY, si.BRIDGE_EXTENDED)
ARCHIVE_VALUES = {im.PHONE_KEY_SETTING: "a" * 64, im.SETTING_KEY: json.dumps({"revision": 9, "enabled": True, "consent_by_link": True,
                                                                               "per_person_per_day": 50}),
                  ag.FLAG_KEY: "on", ag.MAX_DAYS_KEY: "365", ag.MAX_DOORS_KEY: "99", ag.FRESH_KEY: "999", ag.CODE_HOUR_KEY: "3",
                  ag.LOCAL_KEY: "on", si.BRIDGE_EXTENDED: "true"}
TARGET_VALUES = {im.PHONE_KEY_SETTING: "b" * 64, im.SETTING_KEY: json.dumps({"revision": 1, "enabled": False}),
                 ag.FLAG_KEY: "off", ag.MAX_DAYS_KEY: "7", ag.MAX_DOORS_KEY: "2", ag.FRESH_KEY: "30", ag.CODE_HOUR_KEY: "7",
                 ag.LOCAL_KEY: "off", si.BRIDGE_EXTENDED: "false"}


def test_every_installation_secret_and_switch_added_in_270_is_kept():
    missing = [k for k in NEW_KEYS if not svc._kept_setting(k)]
    assert missing == [], missing
    assert svc._kept_setting("tickets.settings"), "vendor uploads / vendor portal switches live in tickets.settings"


def test_the_archive_never_carries_them(settings):
    app = create_app(settings)
    c = TestClient(app)
    seed_tree(c)
    with app.state.db.connection() as conn:
        for k, v in ARCHIVE_VALUES.items():
            set_setting(conn, k, v)
        set_setting(conn, "ui.design", "b")
    e = c.post("/api/v1/backups", json={}).json()
    raw = c.get(f"/api/v1/backups/{e['name']}/download").content
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        keys = {r["key"] for r in json.loads(z.read("data/settings.json"))}
        blob = b"".join(z.read(n) for n in z.namelist() if n.startswith("data/") or n == "manifest.json")
    assert "ui.design" in keys
    assert keys.isdisjoint(NEW_KEYS), keys & set(NEW_KEYS)
    assert b"a" * 64 not in blob


def _archive_carrying_the_keys(c: TestClient) -> bytes:
    """A real archive with the nine rows written back into data/settings.json - what an older build (or a hand-edited file) holds."""
    e = c.post("/api/v1/backups", json={}).json()
    raw = c.get(f"/api/v1/backups/{e['name']}/download").content
    src = zipfile.ZipFile(io.BytesIO(raw))
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as dst:
        for n in src.namelist():
            data = src.read(n)
            if n == "data/settings.json":
                rows = json.loads(data)
                template = dict(rows[0])
                for k, v in ARCHIVE_VALUES.items():
                    rows.append({**template, "key": k, "value": v})
                data = json.dumps(rows).encode()
            dst.writestr(n, data)
    return out.getvalue()


def test_a_restore_never_overwrites_them(settings, tmp_path):
    app = create_app(settings)
    c = TestClient(app)
    seed_tree(c)
    archive = _archive_carrying_the_keys(c)
    settings2 = replace(settings, data_dir=tmp_path / "data2")
    app2 = create_app(settings2)
    c2 = TestClient(app2)
    with app2.state.db.connection() as conn:
        for k, v in TARGET_VALUES.items():
            set_setting(conn, k, v)
    up = c2.post("/api/v1/backups/upload", files={"file": ("copy.zip", archive, "application/zip")})
    assert up.status_code == 201, up.text
    for mode in ("replace", "merge"):
        body = {"mode": mode, "confirm": "RESTORE", **({"scope": "project"} if mode == "replace" else {})}
        res = c2.post(f"/api/v1/backups/{up.json()['name']}/restore", json=body)
        assert res.status_code == 200, res.text
        with app2.state.db.connection() as conn:
            got = {k: get_setting(conn, k) for k in NEW_KEYS}
        assert got == TARGET_VALUES, (mode, {k: v for k, v in got.items() if v != TARGET_VALUES[k]})
