"""T056: the Lovelace card ships inside the bridge integration (both copies identical, versioned), the add-on's
installer carries it into Home Assistant's custom_components, the integration module compiles, and the card
source holds no secret and no entity — it embeds the add-on's Ingress page (HA identity, VMS roles)."""
from __future__ import annotations

import json
import py_compile
from pathlib import Path

import pytest
from conftest import png_bytes  # noqa: F401 - keeps the shared fixtures importable

from smplwise.main import create_app
from smplwise.services import bridge_install, ha_client

REPO = Path(__file__).resolve().parents[3]
SRC = REPO / "smplwise_vms" / "integration" / "smplwise_bridge"
COPY = REPO / "custom_components" / "smplwise_bridge"


def test_card_is_shipped_and_the_copies_agree():
    card = SRC / "www" / "smplwise-card.js"
    assert card.is_file() and (COPY / "www" / "smplwise-card.js").read_bytes() == card.read_bytes()
    for name in ("__init__.py", "const.py", "manifest.json"):
        assert (SRC / name).read_bytes() == (COPY / name).read_bytes(), name
    manifest = json.loads((SRC / "manifest.json").read_text(encoding="utf-8"))
    const = (SRC / "const.py").read_text(encoding="utf-8")
    assert manifest["version"] == "0.2.1" and 'VERSION = "0.2.1"' in const
    py_compile.compile(str(SRC / "__init__.py"), doraise=True)
    src = card.read_text(encoding="utf-8")
    assert "customElements.define('smplwise-card'" in src and "hassio/ingress/session" in src and "embed=1" in src
    code = "\n".join(l for l in src.splitlines() if not l.strip().startswith(("*", "/*", "//")))  # the doc comment may name the ingress token placeholder
    assert "pairing" not in code.lower() and "token" not in code.lower() and "password" not in code.lower(), "the card carries no secret"
    init = (SRC / "__init__.py").read_text(encoding="utf-8")
    assert "async_register_static_paths" in init and "async_create_item" in init and '"res_type": "module"' in init


@pytest.fixture()
def ha_cfg(tmp_path, monkeypatch):
    cfg = tmp_path / "ha"
    cfg.mkdir()
    (cfg / "configuration.yaml").write_text("", encoding="utf-8")
    monkeypatch.setenv("SW_HA_CONFIG_DIR", str(cfg))
    return cfg


def test_installer_carries_the_card(settings, ha_cfg, monkeypatch):
    monkeypatch.setattr(ha_client, "supervisor_token", lambda: "supervisor-token")
    monkeypatch.setattr(ha_client, "post_discovery", lambda _s, service, config: {"uuid": "u1"})
    app = create_app(settings)
    st = bridge_install.install(app.state.db, settings)
    target = ha_cfg / "custom_components" / "smplwise_bridge"
    assert (target / "www" / "smplwise-card.js").is_file() and st["source_version"] == "0.2.1"


WWW = REPO / "smplwise_vms" / "www"


def test_built_ui_references_its_assets_relatively_and_ships_the_three_chunk():
    """T087 (ruling R-P4-9): the card embeds the Ingress page, so the 3D toggle is the floor screen's own; the chunk must
    resolve relative to that page. The built entry names ./assets/, the lazy 3D chunk names the three chunk relatively,
    no file names an absolute /assets/ path, and three never reaches the entry bundle."""
    index = (WWW / "index.html").read_text(encoding="utf-8")
    assert 'src="./assets/index-' in index and 'href="./assets/index-' in index
    assert '"/assets/' not in index
    assets = WWW / "assets"
    three = sorted(p for p in assets.glob("three-*.js") if not p.name.endswith(".map"))
    view = sorted(p for p in assets.glob("sw-plan-3d-*.js") if not p.name.endswith(".map"))
    assert len(three) == 1 and len(view) == 1, "one three chunk and one 3D view chunk in the built UI (run npm run build:addon)"
    entry = next(p for p in assets.glob("index-*.js") if not p.name.endswith(".map")).read_text(encoding="utf-8")
    assert "WebGLRenderer" not in entry
    assert f'"./{three[0].name}"' not in entry, "the entry never imports the three chunk statically"
    view_src = view[0].read_text(encoding="utf-8")
    assert f'from"./{three[0].name}"' in view_src
    assert '"/assets/' not in view_src and '"/assets/' not in entry
    assert three[0].stat().st_size < 900_000, "the three chunk stays a single tree-shaken library build (about 630 KB minified, 160 KB gzip)"
    card = (SRC / "www" / "smplwise-card.js").read_text(encoding="utf-8")
    assert "/explore/floors/" in card and "embed=1" in card, "the map view of the card is the floor screen itself"
