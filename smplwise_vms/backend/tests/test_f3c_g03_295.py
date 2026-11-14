"""F3C-295 G-03, amended by SMALLFIXA-295 (review 3 G-01 follow-up): the `wiskey.acr5_*` switches have exactly ONE writer -
`routers/wiskey_switches.py` through `services/wiskey_switches.py` - and the peer seam / registry (`wiskey.peer_*`) still have none.
This pins the fact so another writer cannot be added by accident: the PATCH /settings whitelist carries no wiskey.acr5_* / wiskey.peer_*
key, no other router module writes one, and the writer router itself never calls set_setting (the service's closed list does)."""
from __future__ import annotations

import re
from pathlib import Path

from smplwise.routers.settings import SettingsPatch

ROOT = Path(__file__).resolve().parents[1] / "smplwise"
KEY = re.compile(r"wiskey\.(acr5_|peer_)")
PEER = re.compile(r"wiskey\.peer_")
WRITES = re.compile(r"set_setting|INSERT INTO settings|UPDATE settings")
WRITER = "wiskey_switches.py"


def test_the_patch_whitelist_has_no_acr5_or_peer_key():
    aliases = {f.alias or name for name, f in SettingsPatch.model_fields.items()}
    assert not [a for a in aliases if KEY.match(a)]


def test_no_router_but_the_switch_writer_writes_an_acr5_or_peer_setting():
    offenders = []
    for path in (ROOT / "routers").glob("*.py"):
        text = path.read_text(encoding="utf-8")
        if path.name == WRITER:
            assert not WRITES.search(text), "the writer router delegates every write to services/wiskey_switches.py"
            assert not PEER.search(text), "the peer seam has no writer"
            continue
        if KEY.search(text) and WRITES.search(text):
            offenders.append(path.name)
    assert offenders == []


def test_the_switch_writer_service_writes_only_its_closed_acr5_list():
    from smplwise.services import wiskey_acr5 as a5
    from smplwise.services import wiskey_switches as ws

    assert set(ws.SWITCHES) == set(a5.FLAGS.values())
    assert not [k for k in ws.SWITCHES if PEER.match(k)]
    text = (ROOT / "services" / WRITER).read_text(encoding="utf-8")
    assert "wiskey_peer" not in text, "the writer never imports the unwired peer seam"
