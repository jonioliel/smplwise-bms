"""WISKEY-STATUS-I18N-2520: every "מצב WisKey" reason carries the values its Hebrew sentence was filled with (`params`, additive), so a page
in another language says the same thing from the stable `code` (frontend i18n/wiskey-feature-status.ts). The Hebrew `text` / `fix` are
unchanged. In-memory only: no WisKey, no station, nothing sent."""
from __future__ import annotations

import re
import string
from typing import Any

import pytest

from smplwise.services import wiskey_feature_status as wfs


def _fields(s: str) -> set[str]:
    return {f for _, f, _, _ in string.Formatter().parse(s) if f}


@pytest.mark.parametrize("code", sorted(wfs.R))
def test_every_reason_carries_its_values_and_the_same_hebrew(code: str) -> None:
    kind, text, fix = wfs.R[code]
    names = _fields(text)
    fmt: dict[str, Any] = {n: (7 if n in ("count", "on") else f"v_{n}") for n in names}
    r = wfs._reason(code, **fmt)
    assert set(r) == {"code", "kind", "text", "fix", "params"}
    assert r["code"] == code and r["kind"] == kind and r["fix"] == fix
    assert r["text"] == (text.format(**fmt) if fmt else text)  # the Hebrew is what it was
    assert r["params"] == fmt
    assert not _fields(fix), f"{code}: a fix sentence has no values (the page translates it by code alone)"


def test_params_are_plain_json_values() -> None:
    r = wfs._reason("doors_unmapped", count=3)
    assert r["params"] == {"count": 3} and isinstance(r["params"]["count"], int)
    r = wfs._reason("direct_no_media", missing="a, b")
    assert r["params"] == {"missing": "a, b"}
    assert wfs._reason("listen_unknown")["params"] == {}


def test_join_starting_names_the_state_for_other_languages() -> None:
    """`what` is a Hebrew word; `state` is the join's own state, which the English sentence is built from."""
    src = open(wfs.__file__, encoding="utf-8").read()
    assert re.search(r'_reason\("join_starting", what=.*\[live\], state=live\)', src)


def test_a_failed_check_carries_the_error_name(monkeypatch) -> None:
    class F:
        def __init__(self, *_a: Any) -> None:
            pass

    def boom(_f: Any) -> list[dict[str, Any]]:
        raise KeyError("x")

    monkeypatch.setattr(wfs, "Facts", F)
    monkeypatch.setattr(wfs, "ROWS", [(1, "probe_row", "חיבור", "שורה", boom, None)])
    (row,) = wfs.rows(None, None)
    assert row["state"] == wfs.UNKNOWN
    (r,) = row["reasons"]
    assert r == {"code": "check_failed", "kind": "RUN", "text": "לא ניתן לבדוק כרגע (KeyError).", "fix": None, "params": {"error": "KeyError"}}
