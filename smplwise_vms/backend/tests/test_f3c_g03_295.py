"""F3C-295 G-03: the ACR5 consumer switches and the peer registry have NO settings writer - `not_built` stays final. This pins the fact so a
writer cannot be added by accident: the PATCH /settings whitelist carries no wiskey.acr5_* / wiskey.peer_* key and no router module writes one."""
from __future__ import annotations

import re
from pathlib import Path

from smplwise.routers.settings import SettingsPatch

ROOT = Path(__file__).resolve().parents[1] / "smplwise"
KEY = re.compile(r"wiskey\.(acr5_|peer_)")


def test_the_patch_whitelist_has_no_acr5_or_peer_key():
    aliases = {f.alias or name for name, f in SettingsPatch.model_fields.items()}
    assert not [a for a in aliases if KEY.match(a)]


def test_no_router_writes_an_acr5_or_peer_setting():
    offenders = []
    for path in (ROOT / "routers").glob("*.py"):
        text = path.read_text(encoding="utf-8")
        if KEY.search(text) and re.search(r"set_setting|INSERT INTO settings|UPDATE settings", text):
            offenders.append(path.name)
    assert offenders == []
