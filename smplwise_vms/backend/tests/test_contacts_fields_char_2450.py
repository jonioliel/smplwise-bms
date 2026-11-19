"""CR-BE-COMPLEXITY-2450 - characterisation of `services.tickets.contacts._fields` (code review 01:F-19: "one validator per contact field"),
recorded BEFORE the function was split.

`_fields` validates a contact create / edit body field by field; the FIRST problem it meets is the refusal the client sees, so the order of
the checks is behaviour. Every case below is a (body, creating, current) triple; the recording (tests/fixtures/contacts_fields_char_2450.json)
holds the exact output dict or the exact (field, code) refusal of the unchanged function. The database lookups are stand-ins (a vendor
directory and the active user ids), so the cases run without a database. `SW_RECORD_CHAR=1` re-records - only on the commit before a refactor."""
from __future__ import annotations

import itertools
import json
import os
from pathlib import Path

import pytest

from smplwise.services.tickets import contacts, store, store_links

GOLDEN = Path(__file__).resolve().parent / "fixtures" / "contacts_fields_char_2450.json"

DIRECTORY = {
    "v1": {"id": "v1", "kind": "vendor", "erased_at": None},
    "v-erased": {"id": "v-erased", "kind": "vendor", "erased_at": "2026-01-01T00:00:00Z"},
    "p1": {"id": "p1", "kind": "person", "erased_at": None},
}
ACTIVE_USERS = {"u1", "u2"}

CURRENTS = {
    "none": None,
    "person": {"id": "c1", "kind": "person", "employee": 0, "vendor_id": "v1", "user_id": None, "permanent_vendor": 1, "rate_currency": "USD"},
    "employee": {"id": "c2", "kind": "person", "employee": 1, "vendor_id": None, "user_id": None, "permanent_vendor": 0, "rate_currency": None},
    "linked": {"id": "c3", "kind": "person", "employee": 0, "vendor_id": None, "user_id": "u1", "permanent_vendor": 0, "rate_currency": None},
    "vendor": {"id": "v1", "kind": "vendor", "employee": 0, "vendor_id": None, "user_id": None, "permanent_vendor": 1, "rate_currency": "ILS"},
}

# one value per field that passes, and one or more that fail, for every field `_fields` reads
FIELD_VALUES = {
    "kind": ["person", "vendor", "employee", "robot", None],
    "display_name": ["  Dana  ", "", "x" * 81, 5],
    "company": ["Acme", None, "y" * 81],
    "notes": ["line one\nline two", "z" * 1001],
    "phone": ["050-123-4567", "+972 50 123 4567", "abc", ""],
    "email": ["Dana@Example.com", "not-an-email", ""],
    "preferred_channel": ["whatsapp", "fax"],
    "lang": ["en", "xx"],
    "require_code": [True, "yes"],
    "active": [False, 1],
    "phone_verify": [True, None],
    "share_history": [None, True, False, "no"],
    "vendor_id": ["v1", None, "", "v-erased", "p1", "ghost", "c1"],
    "permanent_vendor": [True, False, "x"],
    "user_id": ["u1", None, "ghost"],
    "cost_claim": ["required", None, "maybe"],
    "vat_exempt": [True, "no"],
    "vat_default": ["included", "gross"],
    "labor_rate": ["120.50", None, "", "-3", "abc"],
    "rate_currency": ["EUR", "XYZ"],
}


def _cases() -> list[tuple[str, dict, bool, str]]:
    out: list[tuple[str, dict, bool, str]] = []
    # 1. every field value alone, on a create and on each kind of edit
    for name, values in FIELD_VALUES.items():
        for i, v in enumerate(values):
            for cur in CURRENTS:
                creating = cur == "none"
                body = {name: v}
                if creating:
                    body = {"kind": "person", "display_name": "Dana", **body}
                out.append((f"{name}[{i}]@{cur}", body, creating, cur))
    # 2. pairs of fields that interact (kind / employee / vendor / user / marker / rate), every value against every value, on create and edit
    pairs = [("kind", "vendor_id"), ("kind", "user_id"), ("kind", "permanent_vendor"), ("user_id", "permanent_vendor"),
             ("vendor_id", "user_id"), ("labor_rate", "rate_currency"), ("display_name", "kind"), ("preferred_channel", "lang"),
             ("cost_claim", "vat_default"), ("share_history", "require_code")]
    for a, b in pairs:
        for (ia, va), (ib, vb) in itertools.product(enumerate(FIELD_VALUES[a]), enumerate(FIELD_VALUES[b])):
            for cur in ("none", "person", "employee", "linked"):
                creating = cur == "none"
                body = {a: va, b: vb}
                if creating:
                    body = {"kind": "person", "display_name": "Dana", **body}
                out.append((f"{a}[{ia}]+{b}[{ib}]@{cur}", body, creating, cur))
    # 3. whole bodies: the first refusal wins
    every_bad = {k: v[-1] for k, v in FIELD_VALUES.items()}
    every_good = {k: v[0] for k, v in FIELD_VALUES.items()}
    for cur in CURRENTS:
        out.append((f"all-bad@{cur}", dict(every_bad), cur == "none", cur))
        out.append((f"all-good@{cur}", dict(every_good), cur == "none", cur))
        for drop in FIELD_VALUES:  # the first refusal after removing each field in turn
            out.append((f"all-bad-minus-{drop}@{cur}", {k: v for k, v in every_bad.items() if k != drop}, cur == "none", cur))
    return out


def _run(monkeypatch, body: dict, creating: bool, cur: str) -> dict:
    monkeypatch.setattr(store_links, "contact", lambda _conn, cid: DIRECTORY.get(cid))
    monkeypatch.setattr(store, "active_user_ids", lambda _conn: set(ACTIVE_USERS))
    try:
        return {"ok": contacts._fields(None, dict(body), creating=creating, current=CURRENTS[cur])}
    except contacts.ContactInvalid as exc:
        return {"refused": [exc.field, exc.code]}


def test_contacts_fields_is_characterised(monkeypatch):
    got = {name: _run(monkeypatch, body, creating, cur) for name, body, creating, cur in _cases()}
    if os.environ.get("SW_RECORD_CHAR") == "1":
        GOLDEN.write_text(json.dumps(got, ensure_ascii=False, indent=0, sort_keys=True) + "\n", encoding="utf-8", newline="\n")
    want = json.loads(GOLDEN.read_text(encoding="utf-8"))
    got = json.loads(json.dumps(got))
    assert sorted(got) == sorted(want)
    diff = [n for n in want if got[n] != want[n]]
    assert not diff, f"{len(diff)} cases changed, e.g. {diff[:5]}: {[(got[n], want[n]) for n in diff[:3]]}"


def test_the_recording_covers_refusals_and_successes():
    want = json.loads(GOLDEN.read_text(encoding="utf-8"))
    refused = {tuple(v["refused"]) for v in want.values() if "refused" in v}
    assert sum("ok" in v for v in want.values()) > 100 and len(refused) >= 15, refused
    assert {("vendor_id", "unknown"), ("permanent_vendor", "not_external"), ("user_id", "employee"), ("kind", "user_linked"),
            ("rate_currency", "choice")} <= refused


@pytest.mark.parametrize("cur", sorted(CURRENTS))
def test_no_case_name_repeats(cur):
    names = [n for n, *_ in _cases() if n.endswith("@" + cur)]
    assert len(names) == len(set(names))
