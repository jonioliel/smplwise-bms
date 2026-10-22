"""SAFE2-295 (2.10.0 release notes, open items: "`access.external.cards` not in `backup.SETTINGS_KEEP`"): the card switch of the external
access grants (GRANTS3-295 X5, `access_grants.CARDS_KEY`) is security policy like the rest of `access_grants.KEYS`. It is never exported in a
project backup and never taken from one - a `replace` or `merge` restore leaves the installation's own value alone, so an archive written
while the switch was on (or a hand-edited one) can never switch card grants on."""
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


def test_the_card_switch_and_every_external_grant_key_is_kept():
    assert svc._kept_setting(ag.CARDS_KEY)
    missing = [k for k in ag.KEYS if not svc._kept_setting(k)]
    assert missing == [], missing


def test_the_archive_never_carries_the_card_switch(settings):
    app = create_app(settings)
    c = TestClient(app)
    seed_tree(c)
    with app.state.db.connection() as conn:
        set_setting(conn, ag.CARDS_KEY, "on")
        set_setting(conn, "ui.design", "b")
    e = c.post("/api/v1/backups", json={}).json()
    raw = c.get(f"/api/v1/backups/{e['name']}/download").content
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        keys = {r["key"] for r in json.loads(z.read("data/settings.json"))}
    assert "ui.design" in keys, "the project's own settings are still exported"
    assert ag.CARDS_KEY not in keys


def _archive_with_cards_on(c: TestClient) -> bytes:
    """A real archive with `access.external.cards = on` written back into data/settings.json (an older build or a hand-edited file)."""
    e = c.post("/api/v1/backups", json={}).json()
    raw = c.get(f"/api/v1/backups/{e['name']}/download").content
    src = zipfile.ZipFile(io.BytesIO(raw))
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as dst:
        for n in src.namelist():
            data = src.read(n)
            if n == "data/settings.json":
                rows = json.loads(data)
                rows.append({**dict(rows[0]), "key": ag.CARDS_KEY, "value": "on"})
                data = json.dumps(rows).encode()
            dst.writestr(n, data)
    return out.getvalue()


def test_a_restore_never_switches_cards_on_or_drops_the_installation_value(settings, tmp_path):
    app = create_app(settings)
    c = TestClient(app)
    seed_tree(c)
    archive = _archive_with_cards_on(c)
    app2 = create_app(replace(settings, data_dir=tmp_path / "data2"))
    c2 = TestClient(app2)
    with app2.state.db.connection() as conn:
        set_setting(conn, ag.CARDS_KEY, "off")
    up = c2.post("/api/v1/backups/upload", files={"file": ("copy.zip", archive, "application/zip")})
    assert up.status_code == 201, up.text
    for mode in ("replace", "merge"):
        body = {"mode": mode, "confirm": "RESTORE", **({"scope": "project"} if mode == "replace" else {})}
        res = c2.post(f"/api/v1/backups/{up.json()['name']}/restore", json=body)
        assert res.status_code == 200, res.text
        with app2.state.db.connection() as conn:
            assert get_setting(conn, ag.CARDS_KEY) == "off", mode
