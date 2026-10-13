"""CR-038 9.9: WhatsApp accounts and uses - discovery from a mirror fixture, states, use resolution, the mapping document,
warnings and the shared per-account pacing ledger. Fakes only (no Home Assistant)."""
from __future__ import annotations

import datetime as dt
import json
import random
import sqlite3

import pytest
from fake_ha_whatsapp import FakeHaWhatsapp, FakeMirror, PairedAccount
from tickets_msg_fakes import ENTRY_A, ENTRY_B, KEY_A, KEY_B, T0, default_doc

from smplwise.services import messaging_accounts as ma
from smplwise.services.tickets.channel import AccountRef, SendResult

UTC = dt.timezone.utc


def registry(on: bool = True, extra: tuple[ma.UseSpec, ...] = ()) -> ma.UseRegistry:
    return ma.UseRegistry((*ma.tickets_uses(lambda: on), *extra))


def service(fake: FakeHaWhatsapp, doc: ma.MappingDoc, *, ws: bool = True, extra_states=None) -> ma.AccountsService:
    return ma.AccountsService(load_doc=lambda: doc, reader=FakeMirror(fake, ws=ws, extra_states=extra_states), registry=registry())


# ---------------------------------------------------------------- discovery and state

def test_discovery_groups_by_config_entry_and_finds_the_connection_sensor():
    fake = FakeHaWhatsapp([PairedAccount(ENTRY_A, "15555550191"), PairedAccount(ENTRY_B, "15555550192", connected=False)])
    found = ma.discover(fake.mirror_rows())
    assert sorted(found) == [KEY_A, KEY_B]
    assert found[KEY_A].connection_entity_id.endswith("_connected") and found[KEY_A].connection_state == "on"
    assert found[KEY_B].connection_state == "off" and len(found[KEY_B].entity_ids) == 3


def test_discovery_edge_cases():
    disabled = FakeHaWhatsapp([PairedAccount(ENTRY_A, "1", entity_disabled=True)])
    assert ma.discover(disabled.mirror_rows())[KEY_A].connection_entity_id is None  # grouped, but no state source
    no_sensor = FakeHaWhatsapp([PairedAccount(ENTRY_A, "1", with_connection_entity=False)])
    assert ma.discover(no_sensor.mirror_rows())[KEY_A].connection_entity_id is None
    renamed = [ma.MirrorRow(r.entity_id, r.domain, "whatsapp_v2", r.unique_id, r.config_entry_id) for r in FakeHaWhatsapp().mirror_rows()]
    assert ma.discover(renamed) == {}  # platform renamed: only a manual account can be used
    hostile = [ma.MirrorRow("binary_sensor.x", "binary_sensor", "whatsapp", "x_connection", "../etc;drop")]
    assert ma.discover(hostile) == {}


@pytest.mark.parametrize("connected,available,ws,state", [
    (True, True, True, "connected"), (False, True, True, "disconnected"), (True, False, True, "unknown"), (True, True, False, "unknown")])
def test_state_from_the_connection_entity(connected, available, ws, state):
    fake = FakeHaWhatsapp([PairedAccount(ENTRY_A, "1", connected=connected, available=available)])
    st = service(fake, default_doc(), ws=ws).status(KEY_A)
    assert st.state == state and st.source == "entity" and st.sendable is (state == "connected")


def test_missing_when_the_entry_is_gone_and_after_an_unknown_account_answer():
    fake = FakeHaWhatsapp([PairedAccount(ENTRY_A, "1")])
    svc = service(fake, default_doc())
    assert svc.status(KEY_B).state == "missing" and not svc.status(KEY_B).sendable
    svc.note_result(KEY_A, SendResult("not_sent", "account_not_found"))
    assert svc.status(KEY_A).state == "missing"
    svc.refresh()
    assert svc.status(KEY_A).state == "connected"


def test_state_learnt_from_sends_without_a_status_entity():
    fake = FakeHaWhatsapp([PairedAccount(ENTRY_A, "1", with_connection_entity=False)])
    svc = service(fake, default_doc())
    assert svc.status(KEY_A) == ma.AccountStatus("unknown", "sends") and svc.status(KEY_A).sendable  # may try
    svc.note_result(KEY_A, SendResult("not_sent", "service_not_found"))
    assert svc.status(KEY_A).state == "unknown"
    svc.note_result(KEY_A, SendResult("not_sent", "ha_unavailable"))
    assert svc.status(KEY_A).state == "disconnected" and not svc.status(KEY_A).sendable
    svc.note_result(KEY_A, SendResult("unknown", "timeout"))
    assert svc.status(KEY_A).state == "disconnected"  # an unknown proves nothing
    svc.note_result(KEY_A, SendResult("sent"))
    assert svc.status(KEY_A).state == "connected"


def test_manual_account_with_and_without_a_status_entity():
    manual = ma.Account("manual:k3f9", "manual", "ישן", value="15555550199", status_entity_id="binary_sensor.old_phone")
    doc = ma.MappingDoc(1, (manual,), {"tickets.messages": "manual:k3f9"})
    fake = FakeHaWhatsapp([])
    assert service(fake, doc, extra_states={"binary_sensor.old_phone": "on"}).status("manual:k3f9").state == "connected"
    assert service(fake, doc, extra_states={"binary_sensor.old_phone": "off"}).status("manual:k3f9").state == "disconnected"
    assert service(fake, doc, extra_states={}).status("manual:k3f9").state == "unknown"
    plain = ma.MappingDoc(1, (ma.Account("manual:k3f9", "manual", "", value="15555550199"),), {"tickets.messages": "manual:k3f9"})
    svc = service(fake, plain)
    assert svc.status("manual:k3f9") == ma.AccountStatus("unknown", "sends")
    ref = svc.resolve("tickets.messages")
    assert ref.value == "15555550199" and "5555" not in ref.label  # a manual value never becomes a label
    removed = ma.MappingDoc(1, (ma.Account("manual:k3f9", "manual", value="x1", removed=True),), {})
    assert service(fake, removed).status("manual:k3f9").state == "missing"


# ---------------------------------------------------------------- uses

def test_resolution_order():
    doc = default_doc(**{"tickets.messages__D2": KEY_B})
    svc = service(FakeHaWhatsapp(), doc)
    assert svc.resolve("tickets.messages", "D1").key == KEY_A  # no override for D1
    assert svc.resolve("tickets.messages", "D2").key == KEY_B  # the department override
    assert svc.resolve("tickets.codes", "D2").key == KEY_A  # codes inherit the INSTALLATION value, not the override
    assert svc.resolve("tickets.messages", "D2").value == ENTRY_B  # `account` = the entry id
    explicit = default_doc(**{"tickets.codes": KEY_B})
    assert service(FakeHaWhatsapp(), explicit).resolve("tickets.codes").key == KEY_B
    unmapped = ma.MappingDoc(1, (), {"tickets.messages": None})
    assert service(FakeHaWhatsapp(), unmapped).resolve("tickets.messages") is None
    assert service(FakeHaWhatsapp(), unmapped).resolve("tickets.codes") is None
    assert service(FakeHaWhatsapp(), doc).resolve("other.use") is None


def test_a_missing_account_keeps_its_mapping_no_silent_reroute():
    doc = default_doc(**{"tickets.messages__D2": "entry:GONE"})
    svc = service(FakeHaWhatsapp(), doc)
    ref = svc.resolve("tickets.messages", "D2")
    assert ref.key == "entry:GONE" and svc.status(ref.key).state == "missing"


def test_registry_rules():
    reg = registry()
    with pytest.raises(ValueError):
        reg.register(ma.UseSpec("tickets.messages", "x", "dup"))
    with pytest.raises(ValueError):
        reg.register(ma.UseSpec("a.b", "x", "x", inherits="not.registered"))
    assert reg.mapping_key_ok("tickets.messages@dept:D1") and not reg.mapping_key_ok("tickets.codes@dept:D1")
    assert not reg.mapping_key_ok("tickets.messages@dept:../x") and not reg.mapping_key_ok("nope")


def test_mapped_keys_for_the_inbound_filter():
    doc = default_doc(**{"tickets.messages__D2": KEY_B})
    assert service(FakeHaWhatsapp(), doc).mapped_keys("tickets") == {KEY_A, KEY_B}
    assert service(FakeHaWhatsapp(), doc).mapped_keys("intercom") == set()


# ---------------------------------------------------------------- the document

def test_corrupt_document_reads_as_empty():
    for raw in ("{not json", "[]", None, 42, json.dumps({"accounts": "x", "uses": [1]})):
        doc = ma.parse_doc(raw)
        assert doc.accounts == () and dict(doc.uses) == {}


def test_parse_drops_bad_rows_and_round_trips():
    raw = {"revision": 3, "accounts": [
        {"key": KEY_A, "kind": "discovered", "label": "קריאות‮ ····0001", "last4": "0001", "pacing": {"per_hour": 999}},
        {"key": "manual:k3f9", "kind": "manual", "label": "ישן", "account": "15555550199"},
        {"key": "manual:zz", "kind": "manual", "account": "x"},  # key too short
        {"key": KEY_B, "kind": "manual", "account": "x"},  # kind does not match the key
        {"key": "manual:k3f9", "kind": "manual", "account": "dup"}],
        "uses": {"tickets.messages": KEY_A, "tickets.codes": None, "bad": "not-a-key"}}
    doc = ma.parse_doc(json.dumps(raw))
    assert [a.key for a in doc.accounts] == [KEY_A, "manual:k3f9"]
    assert doc.accounts[0].label == "קריאות ····0001" and doc.accounts[0].pacing == ma.Pacing()
    assert dict(doc.uses) == {"tickets.messages": KEY_A, "tickets.codes": None}
    again = ma.parse_doc(json.dumps(ma.doc_to_json(doc)))
    assert again == doc
    assert "15555550199" not in repr(doc)


def test_validate_put():
    found = ma.discover(FakeHaWhatsapp([PairedAccount(ENTRY_A, "1")]).mirror_rows())
    cur = ma.MappingDoc(4, (ma.Account(KEY_A, "discovered", "a", "0001"),), {"tickets.messages": KEY_A})
    reg = registry()
    _, probs = ma.validate_doc({"revision": 3}, current=cur, registry=reg, discovered=found)
    assert probs == [{"code": "settings_stale", "field": "revision"}]
    data = {"revision": 4, "accounts": [
        {"key": KEY_A, "kind": "discovered", "label": "a", "pacing": {"min_gap_s": 1}},
        {"key": "manual:abcd", "kind": "manual", "label": "m", "account": ENTRY_A},  # equals the discovered entry id
        {"key": "manual:efgh", "kind": "manual", "label": "gone", "account": "15555550199", "removed": True}],
        "uses": {"tickets.messages": KEY_A, "tickets.codes": "manual:efgh", "tickets.codes@dept:D1": KEY_A,
                 "tickets.messages@dept:D1": "entry:NOPE", "x.y": KEY_A}}
    new, probs = ma.validate_doc(data, current=cur, registry=reg, discovered=found)
    codes = sorted(p["code"] for p in probs)
    assert codes == ["manual_equals_discovered", "pacing_out_of_range", "use_account_removed", "use_account_unknown", "use_unknown", "use_unknown"]
    assert new.revision == 5


def test_manual_value_heuristics():
    found = ma.discover(FakeHaWhatsapp([PairedAccount(ENTRY_A, "1")]).mirror_rows())
    doc = ma.MappingDoc(1, (ma.Account(KEY_A, "discovered", "a", "0199"),), {})
    assert ma.manual_value_problems("15555550199", found, doc) == ([], ["maybe_same_number"])
    assert ma.manual_value_problems(ENTRY_A, found, doc)[0] == ["manual_equals_discovered"]


def test_changed_uses_carries_keys_only():
    before = default_doc()
    after = default_doc(**{"tickets.messages": KEY_B})
    assert ma.changed_uses(before, after) == [{"use": "tickets.messages", "before": KEY_A, "after": KEY_B}]


def test_labels_keep_four_digits_only():
    fake = FakeHaWhatsapp([PairedAccount(ENTRY_A, "15555550191")])
    entity = ma.discover(fake.mirror_rows())[KEY_A].connection_entity_id
    assert ma.read_last4(fake.get_state, entity) == "0191"
    assert ma.suggest_label(ENTRY_A, "15555550191") == "וואטסאפ ····0191"
    assert ma.suggest_label(ENTRY_A, "+1 555 ***") == f"וואטסאפ {ENTRY_A[:6]}"  # masked ("Mask Sensitive Data")
    assert ma.read_last4(lambda e: (_ for _ in ()).throw(RuntimeError("down")), entity) is None


# ---------------------------------------------------------------- warnings

def test_warnings():
    intercom = ma.UseSpec("intercom.messages", "intercom", "אינטרקום")
    reg = registry(extra=(intercom,))
    doc = ma.MappingDoc(1, (ma.Account(KEY_A, "discovered", "a"), ma.Account(KEY_B, "discovered", "b", shared_outside=True)),
                        {"tickets.messages": KEY_A, "tickets.messages@dept:D2": KEY_B, "intercom.messages": KEY_A})
    statuses = {KEY_A: ma.AccountStatus("connected", "entity"), KEY_B: ma.AccountStatus("disconnected", "entity")}
    got = {(w["code"], w["use"], w.get("department_id")) for w in ma.warnings(doc, reg, statuses, ["D1", "D2"])}
    assert ("shared_module", "tickets.messages", None) in got  # the ticket number also sends intercom messages
    assert ("shared_module", "intercom.messages", None) in got
    assert ("shared_outside", "tickets.messages", "D2") in got
    assert ("account_down", "tickets.messages", "D2") in got
    assert not any(c == "account_down" and d is None for c, _, d in got)
    none = ma.warnings(ma.MappingDoc(1, (), {}), registry(), {})
    assert [w["code"] for w in none] == ["required_unmapped"]
    assert ma.warnings(ma.MappingDoc(1, (), {}), registry(on=False), {}) == []  # module off: no ticket warnings


# ---------------------------------------------------------------- the ledger and pacing

def sqlite_ledger() -> ma.SqliteSendLedger:
    conn = sqlite3.connect(":memory:")
    conn.executescript(ma.LEDGER_DDL)
    return ma.SqliteSendLedger(conn)


@pytest.mark.parametrize("make", [ma.MemorySendLedger, sqlite_ledger])
def test_ledger_counts_and_prunes(make):
    led = make()
    for i in range(5):
        led.record(account_key=KEY_A, use_key="tickets.messages", recipient_key="r1", kind="message", at=T0 + dt.timedelta(minutes=i))
    led.record(account_key=KEY_A, use_key="tickets.codes", recipient_key="r1", kind="code", at=T0 + dt.timedelta(minutes=5))
    led.record(account_key=KEY_B, use_key="tickets.codes", recipient_key="r1", kind="code", at=T0 + dt.timedelta(minutes=6))
    assert len(led.times(since=T0 - dt.timedelta(seconds=1), account_key=KEY_A)) == 6
    assert len(led.times(since=T0 - dt.timedelta(seconds=1), recipient_key="r1", kinds=("code",))) == 2
    assert len(led.times(since=T0 + dt.timedelta(minutes=2), account_key=KEY_A, kinds=("message",))) == 2
    assert led.last_at(KEY_A) == T0 + dt.timedelta(minutes=5)
    assert led.prune(T0 + dt.timedelta(minutes=3)) == 3
    with pytest.raises(ValueError):
        led.record(account_key=KEY_A, use_key="x", recipient_key="r", kind="spam", at=T0)


def gate(seed=1):
    return ma.PacingGate(ma.MemorySendLedger(), random.Random(seed))


def test_minimum_gap_with_jitter():
    g, p = gate(), ma.Pacing()
    assert g.check(account_key=KEY_A, pacing=p, recipient_key="r1", kind="message", now=T0).allowed
    g.record(account_key=KEY_A, use_key="tickets.messages", recipient_key="r1", kind="message", now=T0)
    d = g.check(account_key=KEY_A, pacing=p, recipient_key="r2", kind="message", now=T0 + dt.timedelta(seconds=14))
    assert not d.allowed and d.reason == "gap"
    assert T0 + dt.timedelta(seconds=15) <= d.not_before <= T0 + dt.timedelta(seconds=25)
    assert g.check(account_key=KEY_A, pacing=p, recipient_key="r2", kind="message", now=d.not_before).allowed
    assert g.check(account_key=KEY_B, pacing=p, recipient_key="r2", kind="message", now=T0 + dt.timedelta(seconds=1)).allowed  # another account


def test_caps_per_hour_day_recipient_and_codes():
    p = ma.Pacing(min_gap_s=5, jitter_s=0)
    g = gate()
    t = T0
    for i in range(4):
        g.record(account_key=KEY_A, use_key="tickets.messages", recipient_key="r1", kind="message", now=t)
        t += dt.timedelta(minutes=1)
    d = g.check(account_key=KEY_A, pacing=p, recipient_key="r1", kind="message", now=t)
    assert not d.allowed and d.reason == "recipient" and d.not_before == T0 + dt.timedelta(hours=1)
    # codes are excluded from the recipient cap ...
    assert g.check(account_key=KEY_A, pacing=p, recipient_key="r1", kind="code", now=t).allowed
    for i in range(6):
        g.record(account_key=KEY_B, use_key="tickets.codes", recipient_key="r1", kind="code", now=t)
        t += dt.timedelta(minutes=1)
    # ... but have their own cap per recipient across accounts
    d = g.check(account_key=KEY_A, pacing=p, recipient_key="r1", kind="code", now=t)
    assert not d.allowed and d.reason == "code_recipient"
    # and codes count against the account's hourly budget
    hourly = ma.Pacing(min_gap_s=5, jitter_s=0, per_hour=10)
    d = g.check(account_key=KEY_B, pacing=hourly, recipient_key="r9", kind="message", now=t)
    assert d.allowed  # 6 codes on B < 10
    for i in range(4):
        g.record(account_key=KEY_B, use_key="tickets.codes", recipient_key="r8", kind="code", now=t)
        t += dt.timedelta(minutes=1)
    d = g.check(account_key=KEY_B, pacing=hourly, recipient_key="r9", kind="message", now=t)
    assert not d.allowed and d.reason == "hour"


def test_test_sends_are_capped_per_account():
    g, p = gate(), ma.Pacing(min_gap_s=5, jitter_s=0)
    t = T0
    for _ in range(3):
        assert g.check(account_key=KEY_A, pacing=p, recipient_key="admin", kind="test", now=t).allowed
        g.record(account_key=KEY_A, use_key="tickets.messages", recipient_key="admin", kind="test", now=t)
        t += dt.timedelta(minutes=1)
    assert g.check(account_key=KEY_A, pacing=p, recipient_key="admin", kind="test", now=t).reason == "test_hour"


def test_two_uses_on_one_account_share_one_budget():
    p = ma.Pacing(min_gap_s=5, jitter_s=0, per_hour=3)
    g = gate()
    g.record(account_key=KEY_A, use_key="tickets.messages", recipient_key="r1", kind="message", now=T0)
    g.record(account_key=KEY_A, use_key="tickets.codes", recipient_key="r2", kind="code", now=T0 + dt.timedelta(minutes=1))
    g.record(account_key=KEY_A, use_key="intercom.messages", recipient_key="r3", kind="message", now=T0 + dt.timedelta(minutes=2))
    later = T0 + dt.timedelta(minutes=3)
    assert g.check(account_key=KEY_A, pacing=p, recipient_key="r4", kind="message", now=later).reason == "hour"
    assert g.check(account_key=KEY_B, pacing=p, recipient_key="r4", kind="message", now=later).allowed


def test_property_simulated_day_never_breaks_a_cap():
    for seed in range(6):
        rng = random.Random(seed)
        p = ma.Pacing(min_gap_s=rng.choice([5, 15, 30]), jitter_s=rng.choice([0, 10]), per_hour=rng.choice([5, 30]),
                      per_day=rng.choice([20, 150]), per_recipient_hour=rng.choice([1, 4]))
        g = ma.PacingGate(ma.MemorySendLedger(), random.Random(seed))
        t, sent = T0, []
        for _ in range(3000):
            t += dt.timedelta(seconds=rng.randint(1, 120))
            kind = rng.choice(["message", "message", "code"])
            rk = f"r{rng.randint(1, 4)}"
            d = g.check(account_key=KEY_A, pacing=p, recipient_key=rk, kind=kind, now=t)
            if d.allowed:
                g.record(account_key=KEY_A, use_key="u", recipient_key=rk, kind=kind, now=t)
                sent.append((t, kind, rk))
            else:
                assert d.not_before > t
        for i, (at, kind, rk) in enumerate(sent):
            if i:
                assert (at - sent[i - 1][0]).total_seconds() >= p.min_gap_s
            hour = [s for s in sent if at - dt.timedelta(hours=1) < s[0] <= at]
            assert len(hour) <= p.per_hour
            assert len([s for s in sent if at - dt.timedelta(days=1) < s[0] <= at]) <= p.per_day
            assert len([s for s in hour if s[1] == "message" and s[2] == rk]) <= p.per_recipient_hour
            assert len([s for s in hour if s[1] == "code" and s[2] == rk]) <= ma.CODE_RECIPIENT_HOUR
        assert sent, seed


# ---------------------------------------------------------------- the SQLite mirror reader

def test_sqlite_mirror_reader_reads_only_whatsapp_rows():
    conn = sqlite3.connect(":memory:")
    conn.execute("""CREATE TABLE ha_entities (entity_id TEXT PRIMARY KEY, domain TEXT, platform TEXT, unique_id TEXT, config_entry_id TEXT,
                    device_class TEXT, state TEXT, available INTEGER, disabled INTEGER, removed_at TEXT)""")
    rows = FakeHaWhatsapp([PairedAccount(ENTRY_A, "1")]).mirror_rows()
    for r in rows:
        conn.execute("INSERT INTO ha_entities VALUES (?,?,?,?,?,?,?,?,?,NULL)",
                     (r.entity_id, r.domain, r.platform, r.unique_id, r.config_entry_id, r.device_class, r.state, int(r.available), int(r.disabled)))
    conn.execute("INSERT INTO ha_entities VALUES ('light.x','light','hue','u','e',NULL,'on',1,0,NULL)")
    conn.execute("INSERT INTO ha_entities VALUES ('binary_sensor.gone','binary_sensor','whatsapp','g_connection','GONE','connectivity','on',1,0,'2026-01-01')")
    reader = ma.SqliteMirrorReader(conn)
    assert {r.entity_id for r in reader.whatsapp_rows()} == {r.entity_id for r in rows}
    assert sorted(ma.discover(reader.whatsapp_rows())) == [KEY_A]
    assert reader.entity_state(rows[0].entity_id) == "on" and reader.entity_state("nope") is None


def test_ref_for_the_test_send():
    svc = service(FakeHaWhatsapp([PairedAccount(ENTRY_A, "1")]), default_doc())
    assert svc.ref(KEY_A) == AccountRef(KEY_A, ENTRY_A, "קריאות ····0001")
    assert svc.ref("entry:UNSEEN") is None and svc.ref("manual:none") is None
