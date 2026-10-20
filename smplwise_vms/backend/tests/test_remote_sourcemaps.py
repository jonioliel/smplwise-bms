"""PUB-05 (public review 2026-10-20): the remote channel (/arx/, no identity) never serves source maps; the Ingress path keeps them."""
from __future__ import annotations

import dataclasses

from fastapi.testclient import TestClient

from smplwise.main import create_app


def test_source_maps_are_404_on_the_remote_channel_only(settings, tmp_path):
    www = tmp_path / "www"
    (www / "assets").mkdir(parents=True)
    (www / "index.html").write_text("<!doctype html><title>Arx</title>", encoding="utf-8")
    (www / "assets" / "app.js").write_text("console.log(1)\n//# sourceMappingURL=app.js.map\n", encoding="utf-8")
    (www / "assets" / "app.js.map").write_text('{"version":3}', encoding="utf-8")
    (www / "arx-sw.js").write_text("//\n", encoding="utf-8")
    (www / "arx-sw.js.map").write_text('{"version":3}', encoding="utf-8")
    c = TestClient(create_app(dataclasses.replace(settings, remote_access=True, www_dir=www)))
    assert c.get("/arx/assets/app.js").status_code == 200
    for path in ("/arx/assets/app.js.map", "/arx/arx-sw.js.map", "/arx/assets/APP.JS.MAP"):
        assert c.get(path).status_code == 404, path
    assert c.get("/assets/app.js.map").status_code == 200, "the local (Ingress) channel is unchanged"
