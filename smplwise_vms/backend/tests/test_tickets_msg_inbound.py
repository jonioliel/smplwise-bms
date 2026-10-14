"""CR-038 9.6: inbound replies - normalising both ha-whatsapp events, the account filter, freshness (late / stale), dedupe, nonce
matching without a phone number (LID), text matching, ambiguity, advisory-only status changes and forged-event resistance."""
from __future__ import annotations

import datetime as dt
import random

import pytest
from fake_ha_whatsapp import FakeHaWhatsapp
from tickets_msg_fakes import ENTRY_A, ENTRY_B, KEY_A, KEY_B, PHONE_OTHER, PHONE_VENDOR, T0, TICKETS_KEY

from smplwise.services.tickets import inbound as ib
from smplwise.services.tickets.channel import keyed_hash

UTC = dt.timezone.utc
NONCE = "0123456789abcdef"
VENDOR_KEY = keyed_hash(TICKETS_KEY, PHONE_VENDOR)
recv, button = FakeHaWhatsapp.received, FakeHaWhatsapp.button


class FakeMatches:
    def __init__(self) -> None:
        self.targets: dict[str, ib.NonceTarget] = {}
        self.cands: list[tuple[str, ib.Candidate]] = []

    def by_nonce(self, nonce: str) -> ib.NonceTarget | None:
        return self.targets.get(nonce)

    def candidates(self, sender_key: str, *, since: dt.datetime, account_key: str | None) -> list[ib.Candidate]:
        return [c for k, c in self.cands if k == sender_key and c.last_sent_at >= since]


def target(**kw) -> ib.NonceTarget:
    base = dict(outbox_id="ob1", ticket_id="T1", ticket_number=1042, department_id="D1", assignment_id="A1", contact_id="c1",
                contact_phone_key=VENDOR_KEY, account_key=KEY_A, link_live=True, assignment_current=True, requires_code=False,
                ticket_status="assigned", provider_message_id=None)
    base.update(kw)
    return ib.NonceTarget(**base)


def cand(number=1042, status="assigned", dept="D1", account=KEY_A, sent=T0 - dt.timedelta(hours=1), code=False) -> ib.Candidate:
    return ib.Candidate(f"T{number}", number, dept, f"A{number}", "c1", f"ob{number}", sent, account, status, code)


def proc(matches=None, *, mapped=(KEY_A,), recent=()) -> tuple[ib.InboundProcessor, FakeMatches]:
    m = matches or FakeMatches()
    filt = ib.TicketAccountFilter(lambda: set(mapped), lambda since: set(recent))
    return ib.InboundProcessor(key=TICKETS_KEY, directory=m, dedupe=ib.MemoryDedupe(), account_filter=filt), m


# ---------------------------------------------------------------- normalising

def test_normalise_received_and_button_events():
    m = ib.normalise(recv(PHONE_VENDOR, " 1‮ ", at=T0, entry_id=ENTRY_A, media_url="http://evil.invalid/x.jpg"))
    assert (m.event_type, m.msg_type, m.sender_digits, m.content, m.entry_id, m.account_key) == (
        "whatsapp_message_received", "chat", PHONE_VENDOR, "1", ENTRY_A, KEY_A)
    assert m.provider_at == T0 and not hasattr(m, "media_url")
    b = ib.normalise(button(PHONE_VENDOR, f"t:{NONCE}:ack", at=T0, message_id="3EB0X"))
    assert (b.event_type, b.selected_id, b.message_id, b.content, b.account_key) == ("whatsapp_button_pressed", f"t:{NONCE}:ack", "3EB0X", "התקבל", None)
    assert ib.normalise({"event_type": "state_changed", "data": {}}) is None and ib.normalise("junk") is None


@pytest.mark.parametrize("fmt", ["epoch", "ms", "iso"])
def test_timestamp_shapes(fmt):
    assert ib.normalise(recv(PHONE_VENDOR, "1", at=T0, timestamp_format=fmt)).provider_at == T0


def test_senders_without_a_number():
    lid = ib.normalise(recv("", "1", at=T0, sender="123456789012345@lid"))
    assert lid.sender_digits is None and not lid.sender_is_group
    group = ib.normalise(recv("", "1", at=T0, sender="120363000000000000@g.us"))
    assert group.sender_is_group and group.sender_digits is None
    long = ib.normalise(recv(PHONE_VENDOR, "x" * 1500, at=T0))
    assert long.content_too_long and len(long.content) == 1000


@pytest.mark.parametrize("text,refs,action", [
    ("1", set(), "ack"), ("2", set(), "wip"), (" התקבל! ", set(), "ack"), ("בטיפול", set(), "wip"), ("OK.", set(), "ack"),
    ("in progress", set(), "wip"), ("в работе", set(), "wip"), ("تم الاستلام", set(), "ack"), ("١", set(), "ack"),
    ("#1043 1", {1043}, "ack"), ("1043 2", {1043}, "wip"), ("1043", {1043}, None), ("ok I'll come tomorrow", set(), None),
    ("1 2", set(), None), ("done", set(), None), ("בוצע", set(), None), ("room 102 is fixed", set(), None),
    ("#1042 fixed it", {1042}, None)])
def test_parse_reply(text, refs, action):
    assert ib.parse_reply(text) == (frozenset(refs), action)


@pytest.mark.parametrize("current,action,to", [
    ("assigned", "ack", "acknowledged"), ("assigned", "wip", "in_progress"), ("acknowledged", "wip", "in_progress"),
    ("acknowledged", "ack", None), ("in_progress", "ack", None), ("waiting_part", "wip", None), ("done", "wip", None),
    ("closed", "ack", None), ("returned", "wip", None), ("assigned", None, None)])
def test_advisory_status_moves_forward_only(current, action, to):
    assert ib.advisory_status(current, action) == to


# ---------------------------------------------------------------- account filter, ignore rules, freshness, dedupe

def test_events_from_other_accounts_are_dropped_before_any_row():
    p, m = proc(mapped=(KEY_A,), recent=())
    d = p.process(recv(PHONE_VENDOR, "1", at=T0, entry_id=ENTRY_B), T0)
    assert d.result == "dropped" and d.record is False and p.counters["dropped"] == 1
    p2, _ = proc(mapped=(KEY_A,), recent=(KEY_B,))
    assert p2.process(recv(PHONE_VENDOR, "1", at=T0, entry_id=ENTRY_B), T0).result != "dropped"  # replied within the window
    p3, _ = proc()
    assert p3.process(recv(PHONE_VENDOR, "1", at=T0), T0).result != "dropped"  # no entry_id: processed as in r1


@pytest.mark.parametrize("event,reason", [
    (recv(PHONE_VENDOR, "x", at=T0, msg_type="image"), "type"),
    (recv("", "1", at=T0, sender="120363000000000000@g.us"), "group"),
    (recv(PHONE_VENDOR, "   ", at=T0), "empty"),
    (recv(PHONE_VENDOR, "x" * 1001, at=T0), "too_long")])
def test_ignored(event, reason):
    p, _ = proc()
    d = p.process(event, T0)
    assert (d.result, d.reason) == ("ignored", reason) and d.content is None


def test_freshness():
    p, m = proc()
    m.cands.append((VENDOR_KEY, cand()))
    assert p.process(recv(PHONE_VENDOR, "1", at=T0 + dt.timedelta(minutes=3)), T0).result == "stale"
    assert p.process(recv(PHONE_VENDOR, "1", at=T0 - dt.timedelta(hours=73)), T0).result == "stale"
    late = p.process(recv(PHONE_VENDOR, "1", at=T0 - dt.timedelta(minutes=30)), T0)
    assert (late.result, late.action, late.waiting_reason, late.ticket_id, late.note) == ("late", None, "late_reply", "T1042", "1")
    assert p.process(recv(PHONE_VENDOR, "2", at=None), T0).result == "late"  # no usable timestamp: never a status
    fresh = p.process(recv(PHONE_VENDOR, "1", at=T0 - dt.timedelta(minutes=9)), T0)
    assert (fresh.result, fresh.action) == ("status", "acknowledged")


def test_duplicates():
    p, m = proc()
    m.cands.append((VENDOR_KEY, cand()))
    ev = recv(PHONE_VENDOR, "1", at=T0)
    assert p.process(ev, T0).result == "status"
    assert p.process(ev, T0 + dt.timedelta(minutes=1)).result == "duplicate"
    assert p.process(recv(PHONE_VENDOR, "1", at=T0, entry_id=ENTRY_A), T0).result != "duplicate"  # another account: another event


# ---------------------------------------------------------------- button taps (nonce)

def test_button_tap_by_the_contact():
    p, m = proc()
    m.targets[NONCE] = target()
    d = p.process(button(PHONE_VENDOR, f"t:{NONCE}:ack", at=T0, entry_id=ENTRY_A), T0)
    assert (d.result, d.action, d.ticket_id, d.outbox_id) == ("status", "acknowledged", "T1", "ob1")


def test_nonce_alone_decides_when_there_is_no_number():
    p, m = proc()
    m.targets[NONCE] = target()
    ev = recv("", "בטיפול", at=T0, sender="123456789012345@lid", msg_type="button_reply", selected_id=f"t:{NONCE}:wip")
    d = p.process(ev, T0)
    assert (d.result, d.action) == ("status", "in_progress")


@pytest.mark.parametrize("kw,event_kw,result,reason", [
    ({}, {"sender_number": PHONE_OTHER}, "refused", "sender_mismatch"),
    ({}, {"entry_id": ENTRY_B}, "refused", "account_mismatch"),
    ({"provider_message_id": "3EB0A"}, {"message_id": "3EB0B"}, "refused", "message_mismatch"),
    ({"link_live": False}, {}, "ignored", "assignment_ended"),
    ({"assignment_current": False}, {}, "ignored", "assignment_ended"),
    ({"requires_code": True}, {}, "note", "code_protected"),
    ({"ticket_status": "in_progress"}, {}, "note", "not_forward"),
    ({"ticket_status": "waiting_part"}, {"action": "wip"}, "note", "not_forward"),
])
def test_button_tap_refusals(kw, event_kw, result, reason):
    p, m = proc(mapped=(KEY_A, KEY_B))
    m.targets[NONCE] = target(**kw)
    action = event_kw.pop("action", "ack")
    sender = event_kw.pop("sender_number", PHONE_VENDOR)
    d = p.process(button(sender, f"t:{NONCE}:{action}", at=T0, **event_kw), T0)
    assert (d.result, d.reason, d.action) == (result, reason, None)


def test_unknown_or_malformed_nonce():
    p, m = proc()
    assert p.process(button(PHONE_VENDOR, f"t:{NONCE}:ack", at=T0), T0).reason == "nonce_unknown"
    m.targets[NONCE] = target()
    # an id that is not exactly ours is treated as plain text (no candidates -> unknown sender)
    assert p.process(button(PHONE_VENDOR, f"t:{NONCE}:done", at=T0), T0).result == "unknown_sender"


def test_late_button_tap_is_a_flagged_note():
    p, m = proc()
    m.targets[NONCE] = target()
    d = p.process(button(PHONE_VENDOR, f"t:{NONCE}:ack", at=T0 - dt.timedelta(hours=2)), T0)
    assert (d.result, d.action, d.waiting_reason) == ("late", None, "late_reply")


# ---------------------------------------------------------------- text replies

def test_text_reply_with_one_candidate():
    p, m = proc()
    m.cands.append((VENDOR_KEY, cand()))
    d = p.process(recv(PHONE_VENDOR, "2", at=T0), T0)
    assert (d.result, d.action, d.ticket_id, d.content) == ("status", "in_progress", "T1042", None)
    n = p.process(recv(PHONE_VENDOR, "אגיע מחר בבוקר", at=T0 + dt.timedelta(seconds=5)), T0 + dt.timedelta(seconds=5))
    assert (n.result, n.note, n.content) == ("note", "אגיע מחר בבוקר", "אגיע מחר בבוקר")


def test_text_reply_needs_a_number():
    p, m = proc()
    m.cands.append((VENDOR_KEY, cand()))
    d = p.process(recv("", "1", at=T0, sender="123456789012345@lid"), T0)
    assert (d.result, d.content) == ("unknown_sender", None)


def test_unknown_sender_keeps_nothing_but_the_envelope():
    p, _ = proc()
    d = p.process(recv(PHONE_OTHER, "who is this", at=T0), T0)
    assert (d.result, d.content, d.note, d.ticket_id) == ("unknown_sender", None, None, None)


def test_old_messages_do_not_make_candidates():
    p, m = proc()
    m.cands.append((VENDOR_KEY, cand(sent=T0 - dt.timedelta(hours=80))))
    assert p.process(recv(PHONE_VENDOR, "1", at=T0), T0).result == "unknown_sender"


def test_ambiguous_reply_goes_to_the_managers_of_each_candidate():
    p, m = proc()
    m.cands += [(VENDOR_KEY, cand(1042, dept="D1")), (VENDOR_KEY, cand(1043, dept="D2"))]
    d = p.process(recv(PHONE_VENDOR, "1", at=T0, sender_name="דני"), T0)
    assert (d.result, d.action, d.content, d.waiting_reason) == ("ambiguous", None, "1", "reply")
    assert d.candidate_ticket_ids == ("T1042", "T1043") and d.candidate_department_ids == ("D1", "D2") and d.sender_display == "דני"
    narrowed = p.process(recv(PHONE_VENDOR, "#1043 1", at=T0 + dt.timedelta(seconds=1)), T0 + dt.timedelta(seconds=1))
    assert (narrowed.result, narrowed.ticket_id, narrowed.action) == ("status", "T1043", "acknowledged")
    wrong = p.process(recv(PHONE_VENDOR, "#77 1", at=T0 + dt.timedelta(seconds=2)), T0 + dt.timedelta(seconds=2))
    assert (wrong.result, wrong.reason) == ("ambiguous", "reference_unknown")


def test_a_reference_never_guesses_with_a_single_candidate():
    p, m = proc()
    m.cands.append((VENDOR_KEY, cand(1042)))
    d = p.process(recv(PHONE_VENDOR, "#55 1", at=T0), T0)
    assert d.result == "ambiguous" and d.action is None


def test_candidates_follow_the_event_account():
    p, m = proc(mapped=(KEY_A, KEY_B))
    m.cands += [(VENDOR_KEY, cand(1042, account=KEY_A)), (VENDOR_KEY, cand(1043, account=KEY_B))]
    d = p.process(recv(PHONE_VENDOR, "1", at=T0, entry_id=ENTRY_B), T0)
    assert (d.result, d.ticket_id) == ("status", "T1043")


def test_code_protected_contact_gets_a_note_only():
    p, m = proc()
    m.cands.append((VENDOR_KEY, cand(code=True)))
    d = p.process(recv(PHONE_VENDOR, "1", at=T0), T0)
    assert (d.result, d.reason, d.action) == ("note", "code_protected", None)


# ---------------------------------------------------------------- forged events, privacy

def test_property_no_event_ever_does_more_than_an_advisory_step():
    rng = random.Random(9)
    statuses = ["assigned", "acknowledged", "in_progress", "waiting_part", "done", "returned", "closed"]
    words = ["1", "2", "done", "בוצע", "סגור", "close", "#1042 1", "3", "ok", "", "בטיפול", "‮1", "#1 #2 2"]
    for i in range(1500):
        p, m = proc(mapped=(KEY_A,))
        m.targets[NONCE] = target(ticket_status=rng.choice(statuses), requires_code=rng.random() < 0.2)
        for n in range(rng.randint(0, 3)):
            m.cands.append((VENDOR_KEY, cand(1042 + n, status=rng.choice(statuses), code=rng.random() < 0.2)))
        at = T0 + dt.timedelta(minutes=rng.choice([-200, -30, -5, 0, 1, 3]))
        sender = rng.choice([PHONE_VENDOR, PHONE_OTHER, ""])
        if rng.random() < 0.5:
            ev = button(sender, rng.choice([f"t:{NONCE}:ack", f"t:{NONCE}:wip", f"t:{'f' * 16}:ack", "x"]), at=at,
                        entry_id=rng.choice([None, ENTRY_A, ENTRY_B]))
        else:
            ev = recv(sender, rng.choice(words), at=at, entry_id=rng.choice([None, ENTRY_A, ENTRY_B]),
                      msg_type=rng.choice(["chat", "text", "image"]))
        d = p.process(ev, T0)
        assert d.result in ib.RESULTS + ("dropped",)
        if d.action is not None:
            assert d.result == "status" and d.action in ("acknowledged", "in_progress")
            current = m.targets[NONCE].ticket_status if d.outbox_id == "ob1" else next(c.ticket_status for _, c in m.cands if c.ticket_id == d.ticket_id)
            assert ib.advisory_status(current, {"acknowledged": "ack", "in_progress": "wip"}[d.action]) == d.action
            assert at >= T0 - ib.LATE_AFTER
        if d.result not in ("ambiguous", "note", "late"):
            assert d.content is None
        assert set(d.audit()) == {"result", "ticket_id", "outbox_id", "reason", "action", "event_type"}
        assert PHONE_VENDOR not in str(d.audit()) and PHONE_VENDOR not in repr(d)


def test_the_processor_logs_no_number_and_no_text(caplog):
    import logging

    caplog.set_level(logging.DEBUG)
    p, m = proc()
    m.cands.append((VENDOR_KEY, cand()))
    p.process(recv(PHONE_VENDOR, "אגיע ב-16:00 עם טכנאי", at=T0), T0)
    assert "result=note" in caplog.text and PHONE_VENDOR not in caplog.text and "טכנאי" not in caplog.text


def test_queue_is_bounded():
    q = ib.InboundQueue(maxlen=3)
    assert all(q.submit({"n": i}) for i in range(3)) and not q.submit({"n": 3})
    assert q.overflow == 1 and len(q) == 3 and [e["n"] for e in q.drain(2)] == [0, 1] and len(q) == 1


def test_filter_reads_the_account_mapping():
    from fake_ha_whatsapp import FakeMirror
    from tickets_msg_fakes import default_doc

    from smplwise.services import messaging_accounts as ma

    svc = ma.AccountsService(load_doc=lambda: default_doc(**{"tickets.messages__D9": KEY_B}), reader=FakeMirror(FakeHaWhatsapp()),
                             registry=ma.UseRegistry(ma.tickets_uses(lambda: True)))
    f = ib.TicketAccountFilter(lambda: svc.mapped_keys("tickets"), lambda since: set())
    assert f.accepts(KEY_A, T0) and f.accepts(KEY_B, T0) and not f.accepts("entry:INTERCOM", T0)


# ---------------------------------------------------------------- security review 2026-10-14 (2.5.1): fail closed without entry_id

def test_an_event_without_entry_id_fails_closed_when_more_than_one_account_is_linked():
    p, _ = proc(mapped=(KEY_A, KEY_B))
    d = p.process(recv(PHONE_VENDOR, "1", at=T0), T0)
    assert (d.result, d.reason, d.record) == ("ignored", "account_unknown", True)
    assert d.content is None and d.sender_key is None and d.ticket_id is None, "no content, no sender, never matched"
    d = p.process(button(PHONE_VENDOR, f"t:{NONCE}:ack", at=T0, message_id="3EB0Y"), T0)
    assert d.reason != "account_unknown", "a button carries its own nonce: still matchable"
    # one linked account (mapped or recent): the event is unambiguous and goes on as before
    one, _ = proc(mapped=(KEY_A,))
    assert one.process(recv(PHONE_VENDOR, "1", at=T0), T0).reason != "account_unknown"
    recent, _ = proc(mapped=(KEY_A,), recent=(KEY_B,))
    assert recent.process(recv(PHONE_VENDOR, "1", at=T0), T0).reason == "account_unknown"
