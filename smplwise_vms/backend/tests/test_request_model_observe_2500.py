"""ADR-019 L14 step 1 (ADR019-L14-OBSERVE-2500): the observing request base model (smplwise/wire/request.py)."""
from __future__ import annotations

import logging

import pytest
from pydantic import AliasChoices, ConfigDict, Field, ValidationError

from smplwise.wire import request as obs
from smplwise.wire.request import RequestModel


class _Plain(RequestModel):
    name: str
    size: int = 1
    nick: str = Field(default="", alias="nickname")
    tag: str = Field(default="", validation_alias=AliasChoices("tag", "label"))


class _Forbid(RequestModel):
    model_config = ConfigDict(extra="forbid")
    name: str


class _Allow(RequestModel):
    model_config = ConfigDict(extra="allow")
    name: str


@pytest.fixture(autouse=True)
def _lenient(monkeypatch):
    monkeypatch.setenv("SW_REQUEST_STRICT", "0")
    obs._reset()
    yield
    obs._reset()


def test_known_keys_fields_and_aliases_are_not_observed():
    m = _Plain.model_validate({"name": "a", "size": 2, "nickname": "n", "label": "l"})
    assert (m.name, m.size, m.nick, m.tag) == ("a", 2, "n", "l")
    assert obs.counts()["distinct"] == 0


def test_unknown_key_is_dropped_logged_once_per_model_and_key_and_counted(caplog):
    with caplog.at_level(logging.WARNING, logger="smplwise.wire.request"):
        for _ in range(3):
            m = _Plain.model_validate({"name": "a", "ssid_hash": "x"})
        _Plain.model_validate({"name": "a", "other": 1})
    assert not hasattr(m, "ssid_hash") and m.model_dump()["name"] == "a"  # behaviour unchanged: dropped
    lines = [r.getMessage() for r in caplog.records]
    assert len(lines) == 2 and "_Plain.ssid_hash" in lines[0] and "_Plain.other" in lines[1]
    assert "x" not in lines[0].replace("ssid_hash", "").replace("_Plain", "")  # no value in the log
    c = obs.counts()
    assert c["distinct"] == 2 and c["total"] == 4
    assert c["items"][0] == {"model": "_Plain", "key": "ssid_hash", "count": 3}


def test_strict_mode_raises(monkeypatch):
    monkeypatch.setenv("SW_REQUEST_STRICT", "1")
    with pytest.raises(ValidationError) as exc:
        _Plain.model_validate({"name": "a", "extra_key": 1})
    assert "undeclared keys ['extra_key']" in str(exc.value)
    assert obs.counts()["distinct"] == 0
    assert _Plain.model_validate({"name": "a"}).name == "a"


def test_forbid_and_allow_subclasses_are_not_observed(monkeypatch):
    with pytest.raises(ValidationError):
        _Forbid.model_validate({"name": "a", "x": 1})
    assert _Allow.model_validate({"name": "a", "x": 1}).model_extra == {"x": 1}
    monkeypatch.setenv("SW_REQUEST_STRICT", "1")
    assert _Allow.model_validate({"name": "a", "x": 1}).name == "a"
    assert obs.counts()["distinct"] == 0


def test_dump_file_lists_every_unknown_key(monkeypatch, tmp_path):
    f = tmp_path / "d.tsv"
    monkeypatch.setenv("SW_REQUEST_OBSERVE_DUMP", str(f))
    _Plain.model_validate({"name": "a", "x": 1, "y": 2})
    monkeypatch.setenv("SW_REQUEST_STRICT", "1")
    with pytest.raises(ValidationError):
        _Plain.model_validate({"name": "a", "x": 1})
    assert f.read_text(encoding="utf8").splitlines() == ["_Plain	x", "_Plain	y", "_Plain	x"]


def test_table_is_bounded(monkeypatch):
    monkeypatch.setattr(obs, "_MAX_KEYS", 3)
    _Plain.model_validate({"name": "a", **{f"k{i}": 1 for i in range(6)}})
    c = obs.counts()
    assert c["distinct"] == 3 and c["overflow"] == 3 and c["total"] == 6


def test_non_dict_input_is_left_to_pydantic():
    with pytest.raises(ValidationError):
        _Plain.model_validate("nope")


def test_conftest_sets_strict_for_the_backend_tests():
    from pathlib import Path
    assert 'os.environ.setdefault("SW_REQUEST_STRICT", "1")' in (Path(__file__).parent / "conftest.py").read_text(encoding="utf8")
