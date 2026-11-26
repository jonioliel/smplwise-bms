"""LISTENER-DEADLINE-2540 (follow-up of CAST-RELAY-HARDEN-2540, deep review V-03): a forced NVR undo over a document that changed on
the device records the document it actually overwrote as its `before` - as a write records its own - so the forced undo can itself be
undone back to the overwritten state; its audit row says it overwrote a newer device state. Against the fake NVR of test_nvr_write.py
(httpx MockTransport); no real device is contacted."""
from __future__ import annotations

import json

from fastapi.testclient import TestClient
from test_nvr_write import FakeNvr

from smplwise.main import create_app
from smplwise.services import nvr_write

PATH = "/ISAPI/Event/triggers/VMD-1"


def _rollback_audit(app) -> list[dict]:
    with app.state.db.connection(mode="read") as conn:
        rows = conn.execute("SELECT decision, reason, details_json FROM audit_log WHERE action = 'nvr.rollback' ORDER BY rowid").fetchall()
    return [{"decision": r["decision"], "reason": r["reason"], **json.loads(r["details_json"] or "{}")} for r in rows]


def test_a_forced_undo_over_a_changed_document_can_itself_be_undone_back_to_the_overwritten_state(settings, monkeypatch):
    fake = FakeNvr()
    monkeypatch.setattr(nvr_write, "_client", fake.client)
    app = create_app(settings)
    with TestClient(app) as c:
        c.post("/api/v1/cameras", json={"channel": 1, "alias": "לובי"})
        original = fake.docs[PATH]
        assert c.put("/api/v1/nvr/notify", json={"channels": [1], "smart": False}).status_code == 200
        ch = next(x for x in c.get("/api/v1/nvr/changes").json()["changes"] if x["target"] == "VMD-1" and x["status"] == "applied")
        # an edit in the recorder's own screens after the change: the newer device state
        edited = fake.docs[PATH].replace("<id>record-1</id>", "<id>record-1x</id>")
        assert edited != fake.docs[PATH]
        fake.docs[PATH] = edited
        assert c.post(f"/api/v1/nvr/changes/{ch['id']}/rollback").json()["code"] == "changed_since"
        r = c.post(f"/api/v1/nvr/changes/{ch['id']}/rollback", json={"force": True})
        assert r.status_code == 201, r.text
        undo = r.json()
        assert fake.docs[PATH] == original
        with app.state.db.connection(mode="read") as conn:
            row = conn.execute("SELECT before_xml, after_xml, rollback_of FROM nvr_changes WHERE id = ?", (undo["id"],)).fetchone()
        assert row["rollback_of"] == ch["id"]
        assert nvr_write._normalize(row["before_xml"]) == nvr_write._normalize(edited), "the undo recorded what it overwrote, not the change's after"
        last = _rollback_audit(app)[-1]
        assert last["decision"] == "allowed" and last["forced"] is True and last["overwrote_device_change"] is True
        # the forced undo is itself undone (the device still holds what it left): back to the overwritten device state
        r = c.post(f"/api/v1/nvr/changes/{undo['id']}/rollback")
        assert r.status_code == 201, r.text
        assert nvr_write._normalize(fake.docs[PATH]) == nvr_write._normalize(edited)
        assert "overwrote_device_change" not in _rollback_audit(app)[-1] and "forced" not in _rollback_audit(app)[-1]


def test_a_forced_undo_over_an_unchanged_document_does_not_claim_an_overwrite(settings, monkeypatch):
    fake = FakeNvr()
    monkeypatch.setattr(nvr_write, "_client", fake.client)
    app = create_app(settings)
    with TestClient(app) as c:
        c.post("/api/v1/cameras", json={"channel": 1, "alias": "לובי"})
        assert c.put("/api/v1/nvr/notify", json={"channels": [1], "smart": False}).status_code == 200
        ch = next(x for x in c.get("/api/v1/nvr/changes").json()["changes"] if x["target"] == "VMD-1" and x["status"] == "applied")
        after = fake.docs[PATH]
        r = c.post(f"/api/v1/nvr/changes/{ch['id']}/rollback", json={"force": True})
        assert r.status_code == 201, r.text
        last = _rollback_audit(app)[-1]
        assert last["forced"] is True and "overwrote_device_change" not in last
        with app.state.db.connection(mode="read") as conn:
            before = conn.execute("SELECT before_xml FROM nvr_changes WHERE id = ?", (r.json()["id"],)).fetchone()["before_xml"]
        assert nvr_write._normalize(before) == nvr_write._normalize(after)
