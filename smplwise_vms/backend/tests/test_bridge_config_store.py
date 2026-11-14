"""CR-017 / bridge 0.6.0: the file layer of `config_item` (config_store.py) on a temporary directory: the shapes Home Assistant's editor writes (a list with `id`
first, a dict keyed by the script's object id), key order and unicode kept, compare-and-set, the ring of 10 backups, an atomic write that is read back (and put back
when it is not what was meant), files with YAML tags never rewritten. Synthetic data only."""
from __future__ import annotations

import datetime as dt
import json
import os
import stat
import sys

import pytest
import yaml

from bridge_loader import load

store_mod = load("config_store")
policy = load("config_policy")
ConfigStore, StoreError = store_mod.ConfigStore, store_mod.StoreError


def auto(i="1727700000001", alias="תאורה בכניסה", **kw):
    c = {"id": i, "alias": alias, "description": "", "triggers": [{"trigger": "time", "at": "20:00:00"}], "conditions": [],
         "actions": [{"action": "light.turn_on", "target": {"entity_id": ["light.entry"]}, "data": {"brightness_pct": 70}}], "mode": "single"}
    c.update(kw)
    return c


@pytest.fixture()
def store(tmp_path):
    return ConfigStore(tmp_path)


def fresh_stamp():
    t = [dt.datetime(2026, 10, 1, 12, 0, 0, tzinfo=dt.timezone.utc)]

    def now():
        t[0] += dt.timedelta(seconds=1)
        return t[0]

    return now


# ---------------------------------------------------------------- shapes and order

def test_a_create_appends_to_the_list_and_writes_what_the_ha_editor_would(tmp_path):
    store = ConfigStore(tmp_path)
    before, after = store.upsert("automation", "1727700000001", auto(), None)
    assert before is None and after == policy.revision_of(auto())
    text = (tmp_path / "automations.yaml").read_text(encoding="utf-8")
    assert text.startswith("- id: '1727700000001'\n  alias: תאורה בכניסה\n  description: ''\n  triggers:\n  - trigger: time\n    at: '20:00:00'\n")  # HA's dump: id first, unicode, quoted ids / times
    assert yaml.safe_load(text) == [auto()]
    store.upsert("automation", "1727700000002", auto("1727700000002", "שנייה"), None)
    assert [x["id"] for x in yaml.safe_load((tmp_path / "automations.yaml").read_text(encoding="utf-8"))] == ["1727700000001", "1727700000002"]
    assert store.get("automation", "1727700000002")["alias"] == "שנייה" and store.get("automation", "nope") is None
    assert store.revision("automation", "1727700000001") == policy.revision_of(auto())


def test_key_order_unicode_and_numbers_survive_a_round_trip(tmp_path):
    store = ConfigStore(tmp_path)
    cfg = auto(max=10, mode="queued", variables={"room": "סלון"}, actions=[{"action": "climate.set_temperature", "target": {"entity_id": ["climate.bed"]}, "data": {"temperature": 23.5}},
                                                                               {"delay": {"hours": 0, "minutes": 3, "seconds": 0}}, {"action": "switch.turn_on", "data": {"flag": True}}])
    store.upsert("automation", cfg["id"], cfg, None)
    got = store.get("automation", cfg["id"])
    assert json.dumps(got, ensure_ascii=False) == json.dumps(cfg, ensure_ascii=False)  # the SAME bytes in the SAME key order
    assert policy.revision_of(got) == policy.revision_of(cfg)
    # strings YAML 1.1 would read as other things come back as strings
    odd = auto("1727700000009", "on", triggers=[{"trigger": "state", "entity_id": ["x.y"], "to": "on", "from": "off"}], actions=[{"action": "notify.x", "data": {"message": "2026-10-01", "title": "06:30"}}])
    store.upsert("automation", odd["id"], odd, None)
    assert json.dumps(store.get("automation", odd["id"]), ensure_ascii=False) == json.dumps(odd, ensure_ascii=False)


def test_scripts_are_a_dict_keyed_by_the_object_id_with_no_id_inside_and_scenes_a_list(tmp_path):
    store = ConfigStore(tmp_path)
    script = {"alias": "תריסים", "mode": "single", "sequence": [{"action": "cover.open_cover", "target": {"entity_id": ["cover.a"]}}]}
    assert store.upsert("script", "arx_1727700001234", script, None)[0] is None
    assert yaml.safe_load((tmp_path / "scripts.yaml").read_text(encoding="utf-8")) == {"arx_1727700001234": script}
    assert store.get("script", "arx_1727700001234") == script and "id" not in store.get("script", "arx_1727700001234")
    store.upsert("script", "second", {"alias": "ב", "sequence": []}, None)
    assert list(yaml.safe_load((tmp_path / "scripts.yaml").read_text(encoding="utf-8"))) == ["arx_1727700001234", "second"]
    scene = {"id": "1727700000200", "name": "ברוכים", "entities": {"light.entry": {"state": "on", "brightness": 204}}}
    store.upsert("scene", "1727700000200", scene, None)
    assert yaml.safe_load((tmp_path / "scenes.yaml").read_text(encoding="utf-8")) == [scene]


def test_an_update_replaces_in_place_and_keeps_the_other_items_byte_for_byte(tmp_path):
    store = ConfigStore(tmp_path)
    for i in ("1", "2", "3"):
        store.upsert("automation", i, auto(i, f"פריט {i}"), None)
    before = (tmp_path / "automations.yaml").read_text(encoding="utf-8")
    rev = store.revision("automation", "2")
    b, a = store.upsert("automation", "2", auto("2", "שונה", mode="restart"), rev)
    assert b == rev and a == policy.revision_of(auto("2", "שונה", mode="restart"))
    items = yaml.safe_load((tmp_path / "automations.yaml").read_text(encoding="utf-8"))
    assert [x["alias"] for x in items] == ["פריט 1", "שונה", "פריט 3"]
    # untouched neighbours are the same text
    assert before.split("- id: '2'")[0] in (tmp_path / "automations.yaml").read_text(encoding="utf-8")


# ---------------------------------------------------------------- compare-and-set

def test_create_of_an_existing_id_and_update_of_a_missing_one_and_a_stale_revision_are_refused(store):
    store.upsert("automation", "1", auto("1"), None)
    for args, code in ((("automation", "1", auto("1", "x"), None), "exists"), (("automation", "nope", auto("nope"), "0123456789abcdef"), "not_found"),
                       (("automation", "1", auto("1", "x"), "0123456789abcdef"), "stale")):
        with pytest.raises(StoreError) as e:
            store.upsert(*args)
        assert e.value.code == code
    assert store.get("automation", "1")["alias"] == "תאורה בכניסה"  # nothing changed
    assert len(store.backups("automation")) == 0  # a refused write makes no backup (the first create had no previous text)


def test_a_change_made_outside_between_the_check_and_the_write_is_caught_by_the_store_itself(store):
    store.upsert("automation", "1", auto("1"), None)
    rev = store.revision("automation", "1")
    # the HA editor saves in between (the file changes): the store re-reads at the moment of writing
    store._atomic_write(store.path("automation"), store_mod._dump([auto("1", "נערך בעורך של HA")]))
    with pytest.raises(StoreError) as e:
        store.upsert("automation", "1", auto("1", "שלי"), rev)
    assert e.value.code == "stale" and store.get("automation", "1")["alias"] == "נערך בעורך של HA"


def test_delete_removes_the_item_with_compare_and_set(store):
    store.upsert("automation", "1", auto("1"), None)
    store.upsert("automation", "2", auto("2"), None)
    with pytest.raises(StoreError) as e:
        store.delete("automation", "1", "0123456789abcdef")
    assert e.value.code == "stale"
    rev = store.revision("automation", "1")
    assert store.delete("automation", "1", rev) == rev
    assert store.get("automation", "1") is None and store.get("automation", "2") is not None
    with pytest.raises(StoreError) as e:
        store.delete("automation", "1", None)
    assert e.value.code == "not_found"
    store.upsert("script", "s", {"alias": "x", "sequence": []}, None)
    assert store.delete("script", "s", None) == policy.revision_of({"alias": "x", "sequence": []}) and store.get("script", "s") is None


# ---------------------------------------------------------------- backups

def test_every_write_keeps_the_previous_file_in_a_ring_of_ten(tmp_path):
    store = ConfigStore(tmp_path, now=fresh_stamp())
    store.upsert("automation", "1", auto("1", "v0"), None)
    for n in range(1, 14):
        store.upsert("automation", "1", auto("1", f"v{n}"), store.revision("automation", "1"))
    ring = store.backups("automation")
    assert len(ring) == 10
    newest = yaml.safe_load(ring[-1].read_text(encoding="utf-8"))
    oldest = yaml.safe_load(ring[0].read_text(encoding="utf-8"))
    assert newest[0]["alias"] == "v12" and oldest[0]["alias"] == "v3"  # the text BEFORE each write: v12 was replaced by v13 last
    assert ring[0].parent == tmp_path / "smplwise_bridge_backups" and ring[0].name.startswith("automations.yaml.") and ring[0].name.endswith(".bak")
    assert (tmp_path / "automations.yaml").read_text(encoding="utf-8").count("v13") == 1
    # each file has its own ring
    store.upsert("scene", "s1", {"id": "s1", "name": "n", "entities": {"light.a": "on"}}, None)
    store.upsert("scene", "s1", {"id": "s1", "name": "m", "entities": {"light.a": "on"}}, store.revision("scene", "s1"))
    assert len(store.backups("scene")) == 1 and len(store.backups("automation")) == 10


def test_no_temporary_file_is_left_behind_and_the_file_mode_is_kept(tmp_path):
    store = ConfigStore(tmp_path)
    store.upsert("automation", "1", auto("1"), None)
    p = tmp_path / "automations.yaml"
    if sys.platform != "win32":
        os.chmod(p, 0o600)
    store.upsert("automation", "1", auto("1", "x"), store.revision("automation", "1"))
    assert sorted(f.name for f in tmp_path.iterdir() if f.is_file()) == ["automations.yaml"]
    if sys.platform != "win32":
        assert stat.S_IMODE(p.stat().st_mode) == 0o600


def test_a_write_that_reads_back_differently_is_undone(tmp_path, monkeypatch):
    store = ConfigStore(tmp_path)
    store.upsert("automation", "1", auto("1"), None)
    before = (tmp_path / "automations.yaml").read_text(encoding="utf-8")
    monkeypatch.setattr(store_mod, "_dump", lambda data: "- id: '1'\n  alias: corrupted\n")  # a dump that is not what was meant
    with pytest.raises(StoreError) as e:
        store.upsert("automation", "1", auto("1", "x"), store.revision("automation", "1"))
    assert e.value.code == "write_failed"
    assert (tmp_path / "automations.yaml").read_text(encoding="utf-8") == before  # put back
    assert len(store.backups("automation")) == 1  # and the ring still holds the previous file


# ---------------------------------------------------------------- files that are not ours to rewrite

def test_a_file_with_yaml_tags_is_never_read_for_writing_or_rewritten(tmp_path):
    (tmp_path / "automations.yaml").write_text("- id: '1'\n  alias: x\n  actions:\n  - action: notify.x\n    data:\n      message: !secret hello\n", encoding="utf-8")
    store = ConfigStore(tmp_path)
    for fn in (lambda: store.get("automation", "1"), lambda: store.upsert("automation", "2", auto("2"), None), lambda: store.delete("automation", "1", None)):
        with pytest.raises(StoreError) as e:
            fn()
        assert e.value.code == "yaml_tags_present"
    assert "!secret hello" in (tmp_path / "automations.yaml").read_text(encoding="utf-8")  # untouched
    (tmp_path / "scripts.yaml").write_text("!include scripts/\n", encoding="utf-8")
    with pytest.raises(StoreError):
        ConfigStore(tmp_path).get("script", "x")
    # an exclamation mark inside a message is not a tag
    (tmp_path / "scenes.yaml").write_text("- id: '1'\n  name: שלום!\n  entities:\n    light.a: 'on!'\n", encoding="utf-8")
    assert ConfigStore(tmp_path).get("scene", "1")["name"] == "שלום!"


def test_missing_empty_and_malformed_files(tmp_path):
    store = ConfigStore(tmp_path)
    assert store.get("automation", "1") is None and store.get("script", "x") is None  # absent files are empty
    (tmp_path / "automations.yaml").write_text("", encoding="utf-8")
    (tmp_path / "scripts.yaml").write_text("{}\n", encoding="utf-8")
    assert store.get("automation", "1") is None
    store.upsert("automation", "1", auto("1"), None)
    assert store.get("automation", "1") is not None
    (tmp_path / "scenes.yaml").write_text("not: a list\n", encoding="utf-8")
    with pytest.raises(StoreError) as e:
        store.get("scene", "x")
    assert e.value.code == "file_shape"
    (tmp_path / "scripts.yaml").write_text("- a\n- b\n", encoding="utf-8")
    with pytest.raises(StoreError) as e:
        store.get("script", "x")
    assert e.value.code == "file_shape"
    (tmp_path / "scenes.yaml").write_text("{ unbalanced", encoding="utf-8")
    with pytest.raises(StoreError) as e:
        store.get("scene", "x")
    assert e.value.code == "file_unreadable"


def test_an_unwritable_directory_is_write_failed_without_a_traceback_text(tmp_path, monkeypatch):
    store = ConfigStore(tmp_path)
    monkeypatch.setattr(store_mod.tempfile, "mkstemp", lambda **kw: (_ for _ in ()).throw(OSError("secret path /x/y")))
    with pytest.raises(StoreError) as e:
        store.upsert("automation", "1", auto("1"), None)
    assert e.value.code == "write_failed" and "secret path" not in str(e.value)
