"""CR-008 SmplWise Arx remote access: the add-on options, the `/arx` channel middleware, the HA-token session
exchange and the remote branch of the identity resolution."""
from __future__ import annotations

import json

import pytest

from smplwise.config import DEFAULT_REMOTE_PATH, load_settings, normalize_remote_path


# ---------------------------------------------------------------- 1. add-on options

def test_remote_options_default_off(tmp_path, monkeypatch):
    monkeypatch.delenv("SW_REMOTE_ACCESS", raising=False)
    monkeypatch.delenv("SW_REMOTE_PATH", raising=False)
    opts = tmp_path / "options.json"
    opts.write_text(json.dumps({"bootstrap_admin_username": "joni"}), encoding="utf-8")
    s = load_settings(opts)
    assert s.remote_access is False
    assert s.remote_path == "/arx"


def test_remote_options_from_options_file(tmp_path, monkeypatch):
    monkeypatch.setenv("SW_REMOTE_ACCESS", "false")
    opts = tmp_path / "options.json"
    opts.write_text(json.dumps({"remote_access": True, "remote_path": "/Remote/"}), encoding="utf-8")
    s = load_settings(opts)
    assert s.remote_access is True
    assert s.remote_path == "/remote"


def test_remote_options_from_environment(tmp_path, monkeypatch):
    monkeypatch.setenv("SW_REMOTE_ACCESS", "1")
    monkeypatch.setenv("SW_REMOTE_PATH", "arx")
    s = load_settings(tmp_path / "missing.json")
    assert s.remote_access is True and s.remote_path == "/arx"


@pytest.mark.parametrize("raw", ["/", "/api", "/auth", "/a/b", "/../x", "/hikvision-intercom", "/x y", "/" + "a" * 40])
def test_remote_path_rejects_unsafe_values(raw):
    assert normalize_remote_path(raw) == DEFAULT_REMOTE_PATH


def test_addon_manifest_declares_the_options():
    from pathlib import Path

    text = (Path(__file__).resolve().parents[2] / "config.yaml").read_text(encoding="utf-8")
    assert "  remote_access: false" in text and "  remote_path: /arx" in text
    assert "  remote_access: bool" in text and "  remote_path: match(" in text
