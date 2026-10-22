"""BKPFIX-295: (1) the four `wiskey.acr5_*` switches are never exported in a backup and a restore never switches one on;
(2) scripts/sync_integration.py writes the integration README with LF endings (the repo enforces LF through .gitattributes)."""
from __future__ import annotations

import io
import json
import zipfile
from dataclasses import replace
from pathlib import Path

import pytest
from conftest import seed_tree
from fastapi.testclient import TestClient

from smplwise.db import get_setting, set_setting
from smplwise.main import create_app
from smplwise.services import backup as svc
from smplwise.services import wiskey_acr5

REPO = Path(__file__).resolve().parents[3]
KEYS = tuple(wiskey_acr5.FLAGS.values())


def test_the_four_acr5_switches_are_kept_settings():
    assert len(KEYS) == 4 and all(k.startswith("wiskey.acr5_") for k in KEYS)
    assert [k for k in KEYS if not svc._kept_setting(k)] == []


def test_a_backup_taken_with_a_switch_on_does_not_carry_it(settings):
    app = create_app(settings)
    c = TestClient(app)
    seed_tree(c)
    with app.state.db.connection() as conn:
        for k in KEYS:
            set_setting(conn, k, "on")
        set_setting(conn, "ui.design", "b")
    e = c.post("/api/v1/backups", json={}).json()
    raw = c.get(f"/api/v1/backups/{e['name']}/download").content
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        keys = {r["key"] for r in json.loads(z.read("data/settings.json"))}
    assert "ui.design" in keys
    assert keys.isdisjoint(KEYS), keys & set(KEYS)


def test_a_restore_never_switches_an_acr5_switch_on(settings, tmp_path):
    app = create_app(settings)
    c = TestClient(app)
    seed_tree(c)
    e = c.post("/api/v1/backups", json={}).json()
    raw = c.get(f"/api/v1/backups/{e['name']}/download").content
    src = zipfile.ZipFile(io.BytesIO(raw))
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as dst:  # an older / hand-made archive that carries the switches ON
        for n in src.namelist():
            data = src.read(n)
            if n == "data/settings.json":
                rows = json.loads(data)
                template = dict(rows[0])
                rows.extend({**template, "key": k, "value": "on"} for k in KEYS)
                data = json.dumps(rows).encode()
            dst.writestr(n, data)
    app2 = create_app(replace(settings, data_dir=tmp_path / "data2"))
    c2 = TestClient(app2)
    with app2.state.db.connection() as conn:
        for k in KEYS:
            set_setting(conn, k, "off")
    up = c2.post("/api/v1/backups/upload", files={"file": ("copy.zip", out.getvalue(), "application/zip")})
    assert up.status_code == 201, up.text
    for mode in ("replace", "merge"):
        body = {"mode": mode, "confirm": "RESTORE", **({"scope": "project"} if mode == "replace" else {})}
        res = c2.post(f"/api/v1/backups/{up.json()['name']}/restore", json=body)
        assert res.status_code == 200, res.text
        with app2.state.db.connection() as conn:
            assert {k: get_setting(conn, k) for k in KEYS} == {k: "off" for k in KEYS}, mode


@pytest.mark.skipif(not (REPO / "scripts" / "sync_integration.py").is_file(), reason="repository layout not available")
def test_sync_integration_writes_the_readme_with_lf(monkeypatch, tmp_path):
    monkeypatch.syspath_prepend(str(REPO / "scripts"))
    import sync_integration as si

    monkeypatch.setattr(si, "SRC", tmp_path / "src")
    monkeypatch.setattr(si, "DST", tmp_path / "out" / "smplwise_bridge")
    (tmp_path / "src").mkdir()
    (tmp_path / "src" / "x.py").write_text("x = 1\n", encoding="utf-8")
    si.sync()
    raw = (tmp_path / "out" / "README.md").read_bytes()
    assert b"\r" not in raw and raw.endswith(b"\n") and b"sync_integration.py" in raw
    tracked = REPO / "smplwise_vms" / "integration" / "README.md"
    if tracked.is_file():
        assert tracked.read_bytes() == raw, "the committed README must equal what the script writes (LF)"
