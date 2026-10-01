"""CR-017 S1: the seam between the routes and the block model (services/automation_draft.py) - pure, no app. A draft from a client is never trusted (locked blocks are the
stored item's by fingerprint, typed blocks keep only stored raws), a caller is shown no raw content without the code view, an entity outside the caller's reach is a locked
view that writes back untouched, and a code-view config is a builder save only when the builder would have written the same."""
from __future__ import annotations

import copy

from smplwise.services import automation_draft as drafts
from smplwise.services import automation_model as model

CTX = model.ModelContext()

STORED = {
    "id": "100", "alias": "מורכבת", "description": "", "mode": "restart", "variables": {"night": True},
    "triggers": [{"trigger": "state", "entity_id": ["binary_sensor.hall"], "to": "on", "id": "hall"}, {"trigger": "template", "value_template": "{{ states('sensor.x') | int > 3 }}"}],
    "conditions": [{"condition": "state", "entity_id": ["light.office"], "state": "off"}],
    "actions": [{"alias": "הדלקה", "action": "light.turn_on", "target": {"entity_id": ["light.office"]}, "data": {"brightness_pct": 40}},
                {"choose": [{"conditions": [{"condition": "trigger", "id": ["hall"]}], "sequence": [{"action": "switch.turn_on", "target": {"entity_id": ["switch.fan"]}},
                                                                                                    {"action": "light.turn_on", "target": {"entity_id": "{{ 'light.x' }}"}}]}]},
                {"action": "shell_command.blink"}],
}


def stored_draft():
    return model.config_to_draft("automation", STORED, CTX).draft


def stripped(draft, *, keep_locked=False):
    """What a caller without the code view gets back: no raw anywhere."""
    return drafts.present(draft, code_view=False, mctx=CTX)


def rewrite(draft, stored=None):
    return model.draft_to_config("automation", draft, STORED if stored is None else stored, CTX, item_id="100")


# ================================================================ read

def test_read_reports_masked_locked_and_unsupported():
    rd = drafts.read("automation", {**STORED, "actions": [{"action": "notify.x", "data": {"message": "hi", "api_key": "••••"}}]}, CTX)
    assert rd["masked"] is True and rd["locked_count"] >= 1 and rd["extras"] == ["variables"] and rd["draft"]["alias"] == "מורכבת"
    plain = drafts.read("automation", STORED, CTX)
    assert plain["masked"] is False and plain["locked_count"] == 3 and plain["sentence"] and plain["unsupported"] is False
    scene = drafts.read("scene", {"id": "1", "name": "ערב", "entities": {"light.office": {"state": "on", "brightness": 120}, "switch.a": "off"}}, CTX)
    assert scene["unsupported"] is False
    odd = drafts.read("scene", {"id": "1", "name": "ערב", "entities": {"light.office": {"state": True}}}, CTX)
    assert odd["unsupported"] is True, "a member the draft cannot hold is shown, never edited"


def test_path_sentences_are_keyed_by_the_dotted_path_of_every_block():
    sent = drafts.path_sentences(stored_draft())
    assert {"triggers.0", "triggers.1", "conditions.0", "actions.0", "actions.1", "actions.1.choose.0.conditions.0", "actions.1.choose.0.sequence.0", "actions.2"} <= set(sent)
    assert sent["triggers.1"] == "תבנית" and sent["actions.0"]


# ================================================================ sanitise

def test_a_draft_without_raws_round_trips_the_stored_item_byte_for_byte():
    shown = stripped(stored_draft())
    assert all(w.block["raw"] is None for w in model.walk_draft(shown))
    san = drafts.sanitise("automation", shown, stored_draft(), CTX)
    assert san.changed == [] and san.problems == []
    out = rewrite(san.draft)
    assert model.dumps_exact(out) == model.dumps_exact(STORED), "step aliases, key order, the extras and the locked blocks come back exactly"


def test_a_locked_block_is_the_stored_one_by_fingerprint_and_nothing_else():
    d = stored_draft()
    locked = [w for w in model.walk_draft(d) if w.block["kind"] == "locked"]
    fresh = copy.deepcopy(d)
    for w in model.walk_draft(fresh):
        if w.block["kind"] == "locked":
            w.block["raw"] = None
    san = drafts.sanitise("automation", fresh, d, CTX)
    assert san.changed == [] and [model.true_fingerprint(w.block) for w in model.walk_draft(san.draft) if w.block["kind"] == "locked"] == [model.true_fingerprint(w.block) for w in locked]
    # an unknown fingerprint without a raw, and a raw the stored item does not hold
    for kw in ({"raw": None, "fingerprint": "0123456789abcdef"}, {"raw": {"action": "shell_command.evil"}}):
        bad = copy.deepcopy(d)
        next(w.block for w in model.walk_draft(bad) if w.block["kind"] == "locked").update(kw)
        out = drafts.sanitise("automation", bad, d, CTX)
        assert len(out.changed) == 1, kw
    assert drafts.sanitise("automation", fresh, None, CTX).changed, "a create has no stored locked block to be"


def test_a_typed_raw_that_is_not_stored_is_dropped_and_the_block_rebuilt():
    d = stored_draft()
    evil = copy.deepcopy(d)
    step = evil["actions"][0]
    step["raw"] = {"action": "light.turn_on", "target": {"entity_id": ["light.office"]}, "data": {"brightness_pct": 40}, "alias": "אחר", "metadata": {"x": 1}}
    san = drafts.sanitise("automation", evil, d, CTX)
    assert san.draft["actions"][0]["raw"] == STORED["actions"][0], "the client's raw is gone; the block is the stored one again (the typed fields are the same)"
    assert rewrite(san.draft)["actions"][0] == STORED["actions"][0]
    other = copy.deepcopy(evil)
    other["actions"][0]["data"]["brightness_pct"] = 41
    out = drafts.sanitise("automation", other, d, CTX).draft
    assert out["actions"][0]["raw"] is None
    assert rewrite(out)["actions"][0] == {"action": "light.turn_on", "target": {"entity_id": ["light.office"]}, "data": {"brightness_pct": 41}}, "an edited block never carries the client's alias / metadata"
    edited = copy.deepcopy(stripped(d))
    edited["actions"][0]["data"]["brightness_pct"] = 70
    out = rewrite(drafts.sanitise("automation", edited, d, CTX).draft)
    assert out["actions"][0] == {"action": "light.turn_on", "target": {"entity_id": ["light.office"]}, "data": {"brightness_pct": 70}}, "an edited block is rebuilt"
    assert out["actions"][1] == STORED["actions"][1] and out["triggers"] == STORED["triggers"], "everything else is untouched"


def test_masked_raws_come_back_from_the_stored_item():
    cfg = {"id": "7", "alias": "x", "triggers": [{"trigger": "time", "at": "01:00:00"}], "actions": [{"action": "rest_command.push", "data": {"api_key": "real-secret", "url": "http://x.invalid"}}]}
    d = model.config_to_draft("automation", cfg, CTX).draft
    shown = model.mask_draft(d)
    assert "real-secret" not in str(shown) and shown["actions"][0]["masked"] is True
    san = drafts.sanitise("automation", shown, d, CTX)
    assert san.changed == [] and san.draft["actions"][0]["raw"] == cfg["actions"][0]
    assert not model.config_has_mask(model.draft_to_config("automation", san.draft, cfg, CTX, item_id="7"))
    lost = drafts.sanitise("automation", shown, None, CTX)
    assert lost.changed and model.config_has_mask(model.draft_to_config("automation", lost.draft, None, CTX, item_id="7")), "a mask that cannot be restored is never written"


def test_a_script_field_with_a_locked_selector_is_the_stored_one():
    cfg = {"alias": "s", "fields": {"t": {"name": "זמן", "selector": {"time": {}}}, "n": {"name": "מספר", "selector": {"number": {"min": 1, "max": 5}}}}, "sequence": [{"action": "light.turn_off", "target": {"entity_id": ["light.a"]}}]}
    d = model.config_to_draft("script", cfg, CTX).draft
    assert d["fields"][0]["selector"]["kind"] == "locked"
    shown = drafts.present(d, code_view=False, mctx=CTX)
    assert shown["fields"][0]["selector"]["raw"] is None
    san = drafts.sanitise("script", shown, d, CTX)
    assert san.changed == [] and san.draft["fields"][0]["selector"]["raw"] == {"time": {}}
    shown["fields"][0]["selector"]["raw"] = {"text": {}}
    assert len(drafts.sanitise("script", shown, d, CTX).changed) == 1


# ================================================================ present

def test_present_masks_secrets_and_shows_raw_content_only_with_the_code_view():
    d = stored_draft()
    with_code = drafts.present(d, code_view=True, mctx=CTX)
    assert with_code["actions"][0]["raw"] is not None and with_code["triggers"][1]["raw"] is not None
    without = drafts.present(d, code_view=False, mctx=CTX)
    assert all(w.block["raw"] is None for w in model.walk_draft(without)) and all(w.block.get("template_text") is None for w in model.walk_draft(without))
    assert "states(" not in str(without) and "shell_command" not in str(without["actions"][2]["raw"])
    assert d["actions"][0]["raw"] is not None, "the source draft is never changed"


def test_a_trigger_outside_the_callers_reach_is_a_locked_view_that_writes_back_untouched():
    d = stored_draft()
    shown = drafts.present(d, code_view=False, mctx=CTX, can_watch=lambda e: e != "binary_sensor.hall")
    trig = shown["triggers"][0]
    assert trig["kind"] == "locked" and trig["reason"] == "unknown" and trig["label"] == trig["sentence"] and "Hall" not in trig["label"] or trig["sentence"]
    assert trig["raw"] is None and trig["fingerprint"] == model.fingerprint_of(STORED["triggers"][0])
    assert shown["conditions"][0]["kind"] == "typed", "what the caller may see stays editable"
    san = drafts.sanitise("automation", shown, d, CTX)
    assert san.changed == [] and rewrite(san.draft) == STORED
    # the same view moved to another place is still the stored block; an invented one is not
    moved = copy.deepcopy(shown)
    moved["triggers"].reverse()
    assert drafts.sanitise("automation", moved, d, CTX).changed == []
    moved["triggers"][0]["fingerprint"] = "feedfeedfeedfeed"
    assert len(drafts.sanitise("automation", moved, d, CTX).changed) == 1


# ================================================================ code view

def test_a_code_view_config_is_a_builder_save_only_when_the_builder_would_write_the_same():
    ok, parsed = drafts.builder_expressible("automation", {**STORED, "actions": [{**STORED["actions"][0], "data": {"brightness_pct": 55}}, *STORED["actions"][1:]]}, STORED, CTX, "100")
    assert ok is True and parsed["alias"] == "מורכבת"
    assert drafts.builder_expressible("automation", STORED, STORED, CTX, "100")[0] is True, "unchanged content"
    new_locked = {**STORED, "conditions": [*STORED["conditions"], {"condition": "template", "value_template": "{{ true }}"}]}
    assert drafts.builder_expressible("automation", new_locked, STORED, CTX, "100")[0] is False, "a new locked block"
    assert drafts.builder_expressible("automation", {**STORED, "variables": {"night": False}}, STORED, CTX, "100")[0] is False, "a changed extra key"
    assert drafts.builder_expressible("automation", {**STORED, "initial_state": True}, STORED, CTX, "100")[0] is False, "a new extra key"
    assert drafts.builder_expressible("automation", STORED, None, CTX, "100")[0] is False, "a create that carries locked blocks and extras"
    plain = {"id": "9", "alias": "פשוטה", "triggers": [{"trigger": "time", "at": "07:00:00"}], "conditions": [], "actions": [{"action": "light.turn_on", "target": {"entity_id": ["light.a"]}}], "mode": "single"}
    assert drafts.builder_expressible("automation", plain, None, CTX, "9")[0] is True
    assert drafts.builder_expressible("automation", {**plain, "description": ""}, plain, CTX, "9")[0] is True, "a default key is not a difference of content"
