"""CR-038 slice 4 test fixtures: the slice-1 world (tests/tickets_world.py) plus the handler page - a public address, the add-on
option on, the listener counted as running (no socket: the public app is driven through an ASGI test client), the module key in
the test's data directory, an outside contact and vendor in the directory, and a ticket sent outside.

Every phone number, name and address here is invented (the 050-000-xxxx block and example.test hosts)."""
from __future__ import annotations

import dataclasses
import uuid
from typing import Any

from fastapi.testclient import TestClient

from smplwise.db import Database
from smplwise.services.tickets import links
from smplwise.services.tickets.keyring import KEYS
from smplwise.services.tickets.public_runtime import RUNTIME
from tickets_world import API, MAINT, World, build

BASE_URL = "https://t-demo.arx.example.test"
PHONE_A = "050-000-0031"
PHONE_A_E164 = "972500000031"
PHONE_B = "+972 50 000 0032"


class Clock:
    def __init__(self, t: float) -> None:
        self.t = t

    def __call__(self) -> float:
        return self.t

    def advance(self, s: float) -> None:
        self.t += s


@dataclasses.dataclass
class S4:
    w: World
    db: Database
    contact: dict[str, Any]
    vendor: dict[str, Any]

    @property
    def c(self) -> TestClient:
        return self.w.c

    def h(self, user: str) -> dict[str, str]:
        return self.w.h(user)

    def add_contact(self, user: str = "joni", **body: Any) -> Any:
        payload = {"kind": "person", "display_name": "משה אברהם", "phone": PHONE_A, "lang": "he", **body}
        return self.c.post(f"{API}/tickets/contacts", json=payload, headers=self.h(user))

    def contact_rev(self, contact_id: str) -> int:
        r = self.c.get(f"{API}/tickets/contacts/{contact_id}")
        assert r.status_code == 200, r.text
        return r.json()["revision"]

    def ticket(self, user: str = "joni", title: str = "מזגן לא מקרר", **extra: Any) -> dict[str, Any]:
        return self.w.create(user, title, **extra)

    def assign_contact(self, ticket_id: str, contact_id: str | None = None, user: str = "joni", **extra: Any):
        rev = self.w.detail(ticket_id)["revision"]
        body = {"assignee": {"kind": "contact", "id": contact_id or self.contact["id"]}, "revision": rev, **extra}
        return self.c.post(f"{API}/tickets/{ticket_id}/assign", json=body, headers=self.h(user))

    def sent(self, title: str = "מזגן לא מקרר", **extra: Any) -> tuple[dict[str, Any], str]:
        """A ticket sent to the contact; returns (detail, the handler token - derived like the copy route does)."""
        t = self.ticket(title=title)
        r = self.assign_contact(t["id"], **extra)
        assert r.status_code == 200, r.text
        return r.json(), self.token_of(t["id"])

    def link_row(self, ticket_id: str) -> dict[str, Any]:
        with self.db.connection(mode="read") as conn:
            row = conn.execute("SELECT * FROM ticket_links WHERE ticket_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1", (ticket_id,)).fetchone()
        assert row is not None
        return dict(row)

    def token_of(self, ticket_id: str) -> str:
        row = self.link_row(ticket_id)
        return links.derive_token(KEYS.get(row["key_id"]), row["id"], int(row["generation"]))

    def copy(self, ticket_id: str, user: str = "joni"):
        return self.c.post(f"{API}/tickets/{ticket_id}/link/copy", headers=self.h(user))

    def public(self, clock: Clock | None = None, peer: str = "198.51.100.7") -> tuple[TestClient, Any]:
        app = RUNTIME.build_app(self.db, clock=clock)
        return TestClient(app, client=(peer, 50000)), app


def crid() -> str:
    return str(uuid.uuid4())


def build_s4(settings, monkeypatch) -> S4:
    """The slice-1 world with the handler page ready (option on, listener counted as running, a public address)."""
    w = build(settings)
    monkeypatch.setattr(RUNTIME, "option_on", True)
    monkeypatch.setattr(RUNTIME, "listening", True)
    monkeypatch.setattr(RUNTIME, "app", None)
    monkeypatch.setattr(RUNTIME, "switch", None)
    r = w.c.get(f"{API}/tickets/settings")
    assert r.status_code == 200, r.text
    r = w.c.put(f"{API}/tickets/settings", json={"revision": r.json()["revision"], "public": {"base_url": BASE_URL},
                                                   "organization_name": "מגדלי הדר"})
    assert r.status_code == 200, r.text
    db = Database(settings.db_path)
    s4 = S4(w=w, db=db, contact={}, vendor={})
    vendor = s4.add_contact(kind="vendor", display_name="קליימה-טק מיזוג אוויר", phone=PHONE_B, email="service@clima.example.test")
    assert vendor.status_code == 201, vendor.text
    contact = s4.add_contact()
    assert contact.status_code == 201, contact.text
    s4.contact, s4.vendor = contact.json(), vendor.json()
    return s4
