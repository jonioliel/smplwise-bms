"""TK251 remainder (2.5.8): the findings of the deep review of 2026-10-15 that TK251A left (A4 orphan files, A6 the internal photo
path through the ONE intake pipeline, B6 the account filter without entry_id) and the older TK251 leftovers - the formula guard on
every CSV the module writes, the "link opened" line per link generation, the SLA hidden from limited viewers (incl. the table
cursor), negative tests for the visibility of cost evidence files, and the handler link inside the cost messages. Every name,
number and address here is invented."""
from __future__ import annotations

import base64
import csv
import datetime as dt
import io
import os
import re
import time
from pathlib import Path

import pytest
from conftest import bind
from PIL import Image

from smplwise.services.tickets import attachments, costs_report, costs_retention, export, image_intake, table
from smplwise.services.tickets import inbound as ib
from smplwise.services.tickets import message_templates as mt
from smplwise.services.tickets import outbox as ob
from smplwise.services.tickets.public_http import UNIFORM_404
from smplwise.services.tickets.public_runtime import RUNTIME
from test_tickets_costs import LINES, decide, done, jpeg, pdf, submit  # noqa: F401 - the slice 9 world
from tickets_msg_fakes import KEY_A, KEY_B, PHONE_VENDOR, T0, TICKETS_KEY, assign, make_env
from tickets_s4_world import API, Clock, build_s4, crid
from tickets_world import MAINT, build

SMPLWISE = Path(__file__).resolve().parents[1] / "smplwise"


@pytest.fixture()
def s4(settings, monkeypatch):
    costs_report.reset_rate()
    export.reset_rate()
    return build_s4(settings, monkeypatch)


@pytest.fixture()
def w(settings):
    export.reset_rate()
    attachments.forget_size_cache()
    yield build(settings)
    attachments.forget_size_cache()


def hdr(token: str) -> dict[str, str]:
    return {"x-ticket-token": token}


def _set(db, ticket_id: str, **fields) -> None:
    with db.connection() as conn:
        conn.execute(f"UPDATE tickets SET {', '.join(f'{k} = ?' for k in fields)} WHERE id = ?", (*fields.values(), ticket_id))


def _db(w):
    from smplwise.db import Database

    return Database(w.settings.db_path)


# ================================================================ CSV hygiene - every CSV the module writes

STARTERS = ("=", "+", "-", "@", "\t", "\r")


def _unguarded(cells: list[str]) -> list[str]:
    return [c for c in cells if c and c[0] in STARTERS + ("＝", "＋", "－", "＠")]


def test_csv_every_csv_writer_of_the_module_is_known_and_uses_the_cell_guard():
    """A tripwire: a new CSV in the tickets module must be added here, and it must route its cells through text_hygiene.csv_cell."""
    files = sorted(SMPLWISE.joinpath("services", "tickets").glob("*.py")) + sorted(SMPLWISE.joinpath("routers").glob("tickets*.py"))
    writers = {p.name for p in files if "csv.writer(" in p.read_text(encoding="utf-8")}
    assert writers == {"export.py", "costs_report.py"}
    for name in writers:
        src = SMPLWISE.joinpath("services", "tickets", name).read_text(encoding="utf-8")
        assert "from .text_hygiene import csv_cell" in src


@pytest.mark.parametrize("value", ["=1+1", "+972", "-2+3", "@SUM(A1)", "\tcmd", "\rcmd", "＝1", "＠x"])
def test_csv_the_cell_guard_prefixes_every_formula_starter(value):
    from smplwise.services.tickets.text_hygiene import csv_cell

    assert csv_cell(value) == "'" + value


def test_csv_the_costs_export_guards_every_text_cell_claim_and_line_rows(s4):
    t, token, client, _ = done(s4, "optional")
    hostile = [{"kind": "other", "description": "=HYPERLINK(\"http://x.example.test\")", "amount": "10"},
               {"kind": "parts", "description": "@SUM(1+1)", "quantity": "1", "unit_price": "5"}]
    r = submit(client, token, lines=hostile, vendor_ref="+972-INV")
    assert r.status_code == 201, r.text
    assert decide(s4, t["id"], "approve").status_code == 200
    r = decide(s4, t["id"], "mark-paid", payment_ref="-1+2 העברה", payment_date=dt.date.today().isoformat())
    assert r.status_code == 200, r.text
    for rows in ("claim", "line"):
        costs_report.reset_rate()
        got = s4.c.get(f"{API}/tickets/costs/export.csv?rows={rows}&status=paid")
        assert got.status_code == 200, got.text
        cells = [c for row in csv.reader(io.StringIO(got.content.decode("utf-8-sig"))) for c in row]
        assert _unguarded(cells) == [], (rows, _unguarded(cells))
    body = got.content.decode("utf-8-sig")
    assert "'=HYPERLINK" in body and "'@SUM" in body


def test_csv_the_tickets_export_guards_every_text_cell(w):
    t = w.create("tom", "=cmd|' /C calc'!A0")
    _set(_db(w), t["id"], place_text="+972 קומה 1", device_name="@מזגן")
    got = w.c.get(f"{API}/tickets/export.csv?columns=number,title,place,device,assignee,status&status=all", headers=w.h("mona"))
    assert got.status_code == 200, got.text
    cells = [c for row in csv.reader(io.StringIO(got.content.decode("utf-8-sig"))) for c in row]
    assert _unguarded(cells) == [] and "'=cmd|' /C calc'!A0" in cells and "'+972 קומה 1" in cells and "'@מזגן" in cells


# ================================================================ the "link opened" line per generation

def test_open_note_a_new_link_generation_gets_its_own_opened_line_and_counters(s4):
    t, token = s4.sent()
    client, _ = s4.public(Clock(time.time()))
    assert client.get("/t/api/ticket", headers=hdr(token)).status_code == 200
    first = s4.link_row(t["id"])
    assert first["first_opened_at"] and first["open_count"] == 1
    r = s4.c.post(f"{API}/tickets/{t['id']}/link/new")
    assert r.status_code == 200, r.text
    fresh = s4.link_row(t["id"])
    assert int(fresh["generation"]) == 2
    assert fresh["first_opened_at"] is None and fresh["last_opened_at"] is None and fresh["open_count"] == 0, \
        "the new link was not opened yet - the manager's line and the 'link not opened' clock start again"
    assert r.json()["link"]["first_opened_at"] is None and r.json()["link"]["devices"] == 0
    assert client.get("/t/api/ticket", headers=hdr(token)).content == UNIFORM_404, "the old token is dead"
    assert client.get("/t/api/ticket", headers=hdr(s4.token_of(t["id"]))).status_code == 200
    opened = [e for e in s4.w.detail(t["id"])["events"] if e["kind"] == "link_opened"]
    assert sorted(e["data"].get("generation") for e in opened) == [1, 2]  # same-second rows may come in either order
    assert s4.w.detail(t["id"])["link"]["devices"] == 1


def test_open_note_the_unopened_clock_of_a_new_generation_starts_at_the_generation(s4):
    from smplwise.services.tickets import monitor

    t, _token = s4.sent()
    with s4.db.connection() as conn:
        conn.execute("UPDATE ticket_links SET created_at = '2026-01-01T00:00:00Z', generation_at = '2026-10-16T08:00:00Z'")
        row = dict(conn.execute("SELECT t.*, a.assignee_kind AS asg_kind FROM tickets t JOIN ticket_assignments a ON a.id = t.current_assignment_id "
                                "WHERE t.id = ?", (t["id"],)).fetchone())
        info = monitor._link_info(conn, row)
    assert info is not None and info.sent_at == "2026-10-16T08:00:00Z"


# ================================================================ SLA - management information, hidden from limited viewers

def test_sla_limited_viewers_never_receive_the_dues_in_the_list_or_the_detail(w):
    t = w.create("nora")
    _set(_db(w), t["id"], ack_due_at="2026-01-01T00:00:00Z", stuck_due_at="2026-01-02T00:00:00Z", resolve_due_at="2026-01-03T00:00:00Z")
    limited = w.detail(t["id"], "nora")
    assert limited["view"] == "limited" and limited["sla"] is None
    items = w.c.get(f"{API}/tickets?scope=visible", headers=w.h("nora")).json()["items"]
    assert [i["sla"] for i in items if i["id"] == t["id"]] == [None]
    full = w.detail(t["id"], "mona")
    assert full["view"] == "full" and full["sla"]["ack_due_at"] == "2026-01-01T00:00:00Z"


def test_sla_the_stuck_filter_and_facets_never_count_a_limited_row(w):
    t = w.create("nora")
    _set(_db(w), t["id"], stuck_kind="stuck", stuck_level=1, stuck_due_at="2026-01-01T00:00:00Z")
    r = w.c.get(f"{API}/tickets/table?status=all&stuck=any", headers=w.h("nora"))
    assert r.status_code == 200 and r.json()["items"] == [], "filtering by a stuck kind would disclose it"
    assert [i["id"] for i in w.c.get(f"{API}/tickets/table?status=all", headers=w.h("nora")).json()["items"]] == [t["id"]]
    f = w.c.get(f"{API}/tickets/facets?status=all", headers=w.h("nora")).json()
    assert f["stuck"] == {} and f["total"] == 1
    f = w.c.get(f"{API}/tickets/facets?status=all&stuck=any", headers=w.h("nora")).json()
    assert f["total"] == 0
    assert w.c.get(f"{API}/tickets/facets?status=all", headers=w.h("mona")).json()["stuck"] == {"stuck": 1}
    assert [i["id"] for i in w.c.get(f"{API}/tickets/table?status=all&stuck=any", headers=w.h("mona")).json()["items"]] == [t["id"]]


def test_sla_the_export_leaves_the_management_columns_blank_for_a_limited_row(w):
    t = w.create("cleo", "מזגן בלובי")  # cleo manages cleaning: a maintenance ticket she opened is LIMITED for her
    _set(_db(w), t["id"], stuck_kind="stuck", stuck_level=1, stuck_due_at="2026-01-01T00:00:00Z")
    assert w.detail(t["id"], "cleo")["view"] == "limited"
    got = w.c.get(f"{API}/tickets/export.csv?columns=number,sla,stuck&status=all", headers=w.h("cleo"))
    assert got.status_code == 200, got.text
    rows = list(csv.reader(io.StringIO(got.content.decode("utf-8-sig"))))
    mine = [r for r in rows[1:] if r[0] == str(t["number"])]
    assert mine == [[str(t["number"]), "", ""]]


def test_sla_the_table_cursor_is_sealed_and_discloses_no_sort_value():
    sort = table.parse_sort("sla:asc")
    cur = table.encode_cursor(sort, ["2026-01-01T00:00:00Z"], "abcdef0123456789")
    raw = base64.urlsafe_b64decode(cur + "=" * (-len(cur) % 4))
    assert b"2026-01-01" not in raw and b"abcdef0123456789" not in raw and b"sla" not in raw
    assert table.decode_cursor(cur, sort) == (["2026-01-01T00:00:00Z"], "abcdef0123456789")
    flipped = cur[:-3] + ("A" if cur[-3] != "A" else "B") + cur[-2:]
    with pytest.raises(table.TableError):
        table.decode_cursor(flipped, sort)
    long_title = table.encode_cursor(table.parse_sort("title:asc"), ["א" * 200], "abcdef0123456789")
    assert table.decode_cursor(long_title, table.parse_sort("title:asc"))[0] == ["א" * 200]


def test_sla_a_short_page_cursor_never_carries_an_invisible_rows_title(w):
    mine = w.create("tom", "ללא מקום")  # placeless: visible to gil (a maintenance member bound to floor 3 only)
    for i in range(130):
        t = w.create("tom", f"סוד {i:03d}")
        w.place(t["id"], "floor2")  # invisible to gil
    page = w.c.get(f"{API}/tickets/table?status=all&sort=title:desc&limit=25", headers=w.h("gil")).json()
    assert page["items"] == [] and page["next_cursor"], "a short page stops on an invisible row"
    raw = base64.urlsafe_b64decode(page["next_cursor"] + "=" * (-len(page["next_cursor"]) % 4))
    assert "סוד".encode() not in raw, "the position's title of an invisible ticket never reaches the client"
    ids, cursor = [], page["next_cursor"]
    while cursor:
        nxt = w.c.get(f"{API}/tickets/table?status=all&sort=title:desc&limit=25&cursor={cursor}", headers=w.h("gil")).json()
        ids += [i["id"] for i in nxt["items"]]
        cursor = nxt["next_cursor"]
    assert ids == [mine["id"]]


# ================================================================ cost evidence files - negative visibility

def _claim_with_files(s4, ticket=None, token=None, client=None):
    if ticket is None:
        ticket, token, client, _ = done(s4)
    ids = []
    for color in ((250, 250, 250), (200, 200, 200)):
        r = client.post("/t/api/claim/file", headers=hdr(token), files={"file": ("p.jpg", jpeg(color=color), "image/jpeg")},
                        data={"client_request_id": crid(), "document_key": "doc1", "page_no": str(len(ids) + 1)})
        assert r.status_code == 201, r.text
        ids.append(r.json()["id"])
    r = client.post("/t/api/claim/file", headers=hdr(token), files={"file": ("a.pdf", pdf(), "application/pdf")}, data={"client_request_id": crid()})
    assert r.status_code == 201, r.text
    pdf_id = r.json()["id"]
    r = submit(client, token, documents=[{"file_ids": ids}, {"file_ids": [pdf_id]}])
    assert r.status_code == 201, r.text
    claim = s4.c.get(f"{API}/tickets/{ticket['id']}/costs").json()["claims"][0]
    return ticket, token, client, claim, ids, pdf_id


def _file_urls(tid, claim, pdf_id, photo_id):
    rev = claim["revisions"][0]["id"]
    return [f"{API}/tickets/{tid}/costs/files/{pdf_id}", f"{API}/tickets/{tid}/costs/files/{photo_id}",
            f"{API}/tickets/{tid}/costs/{claim['id']}/documents/{rev}/1.pdf"]


def test_evidence_a_member_without_costs_view_gets_403_and_an_audited_denial(s4):
    t, _tok, _cl, claim, ids, pdf_id = _claim_with_files(s4)
    for url in _file_urls(t["id"], claim, pdf_id, ids[0]):
        r = s4.c.get(url, headers=s4.h("mona"))
        assert r.status_code == 403 and r.json()["code"] == "forbidden", (url, r.text)
        assert b"%PDF" not in r.content and b"\xff\xd8\xff" not in r.content
    with s4.db.connection(mode="read") as conn:
        n = conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'ticket.cost.file_download' AND decision = 'denied'").fetchone()[0]
    assert n == 3


def test_evidence_a_user_who_cannot_see_the_ticket_gets_the_uniform_404_even_with_costs_view(s4):
    t, _tok, _cl, claim, ids, pdf_id = _claim_with_files(s4)
    bind(s4.c, s4.w.settings, "cleo", "tickets_costs_view", "installation", "*")
    bind(s4.c, s4.w.settings, "vic", "tickets_costs_view", "installation", "*")
    for user in ("cleo", "vic"):
        for url in _file_urls(t["id"], claim, pdf_id, ids[0]):
            r = s4.c.get(url, headers=s4.h(user))
            assert r.status_code in (403, 404) and b"%PDF" not in r.content and b"\xff\xd8\xff" not in r.content, (user, url, r.status_code)
            if user == "cleo":
                assert r.status_code == 404, "a visible-elsewhere user learns nothing about this ticket"


def test_evidence_a_limited_viewer_with_costs_view_gets_403(s4):
    t = s4.ticket(user="nora", title="נזילה בתקרה")
    assert s4.assign_contact(t["id"]).status_code == 200
    token = s4.token_of(t["id"])
    client, _ = s4.public(Clock(time.time()))
    for st in ("acknowledged", "done"):
        assert client.post("/t/api/status", headers=hdr(token), json={"status": st, "client_request_id": crid()}).status_code == 200
    with s4.db.connection() as conn:  # the claim is required by default only for some departments: make sure one exists
        has = conn.execute("SELECT COUNT(*) FROM ticket_cost_claims WHERE ticket_id = ?", (t["id"],)).fetchone()[0]
    if not has:
        asg = s4.w.detail(t["id"])["assignments"][-1]["id"]
        assert s4.c.post(f"{API}/tickets/{t['id']}/costs/requirement", json={"assignment_id": asg, "mode": "optional"}).status_code == 200
    _t, _tok, _cl, claim, ids, pdf_id = _claim_with_files(s4, t, token, client)
    bind(s4.c, s4.w.settings, "nora", "tickets_costs_view", "installation", "*")
    assert s4.w.detail(t["id"], "nora")["view"] == "limited"
    for url in _file_urls(t["id"], claim, pdf_id, ids[0]):
        r = s4.c.get(url, headers=s4.h("nora"))
        assert r.status_code == 403, (url, r.status_code)
    assert s4.c.get(f"{API}/tickets/{t['id']}/costs", headers=s4.h("nora")).json()["claims"][0].get("revisions") is None


def test_evidence_ids_never_cross_tickets_claims_or_revisions(s4):
    t1, _k1, _c1, claim1, ids1, pdf1 = _claim_with_files(s4)
    t2, _k2, _c2, claim2, ids2, pdf2 = _claim_with_files(s4)
    assert s4.c.get(f"{API}/tickets/{t2['id']}/costs/files/{pdf1}").status_code == 404, "a file of another ticket"
    assert s4.c.get(f"{API}/tickets/{t2['id']}/costs/files/{ids1[0]}").status_code == 404
    rev1 = claim1["revisions"][0]["id"]
    assert s4.c.get(f"{API}/tickets/{t2['id']}/costs/{claim2['id']}/documents/{rev1}/1.pdf").status_code == 404, "a revision of another claim"
    assert s4.c.get(f"{API}/tickets/{t1['id']}/costs/{claim2['id']}/documents/{claim2['revisions'][0]['id']}/1.pdf").status_code == 404
    assert s4.c.get(f"{API}/tickets/{t1['id']}/costs/{claim1['id']}/documents/{rev1}/3.pdf").status_code == 404, "no third document"
    assert s4.c.get(f"{API}/tickets/{t1['id']}/costs/{claim1['id']}/documents/{rev1}/2.pdf").status_code == 404, "document 2 is a PDF, not pages"
    assert s4.c.get(f"{API}/tickets/{t1['id']}/attachments/{ids1[0]}").status_code == 404, "an invoice page is not a ticket photo"


def test_evidence_a_pending_file_is_never_served_and_the_vendor_page_never_serves_invoice_files(s4):
    t, token, client, _ = done(s4)
    r = client.post("/t/api/claim/file", headers=hdr(token), files={"file": ("p.jpg", jpeg(), "image/jpeg")}, data={"client_request_id": crid()})
    assert r.status_code == 201
    pending = r.json()["id"]
    assert s4.c.get(f"{API}/tickets/{t['id']}/costs/files/{pending}").status_code == 404, "not part of any claim yet"
    assert client.get(f"/t/api/photo/{pending}", headers=hdr(token)).content == UNIFORM_404
    _t, _tok, _cl, _claim, ids, pdf_id = _claim_with_files(s4, t, token, client)
    for fid in (*ids, pdf_id):
        assert client.get(f"/t/api/photo/{fid}", headers=hdr(token)).content == UNIFORM_404


# ================================================================ the link inside cost messages

@pytest.mark.parametrize("purpose", ["cost_rejected", "cost_reopened"])
def test_cost_link_the_starters_carry_the_link_and_a_template_without_it_is_refused(purpose):
    for lang, body in mt.STARTERS[purpose].items():
        assert "{link}" in body, (purpose, lang)
        assert mt.problems(purpose, body) == [], (purpose, lang)
    assert {"code": "link_required", "field": "body"} in mt.problems(purpose, "{module_name} {number}: הוחזר")
    assert mt.problems("cost_approved", mt.STARTERS["cost_approved"]["he"]) == [], "an approval needs no action: no link"


def test_cost_link_the_hebrew_starters_avoid_the_banned_words():
    for purpose in ("cost_rejected", "cost_reopened", "cost_approved"):
        assert not re.search("קריא(ה|ות|ת)", mt.STARTERS[purpose]["he"])


def test_cost_link_a_cost_message_needs_a_link_at_enqueue():
    env = make_env()
    env.directory.add("c1")
    with pytest.raises(ob.OutboxError):
        env.outbox.enqueue(purpose="cost_rejected", now=env.clock.now(), contact_id="c1", ticket_id="T1", assignment_id="A1", link_id=None,
                           department_id="D1", params={"number": "1042", "department": "אחזקה"})


def test_cost_link_a_rejection_carries_the_claim_mode_link_and_dies_without_one():
    env = make_env()
    env.links.mint("L1")
    env.links.claim_only.add("L1")  # the ticket is closed: the page no longer serves the link, the claim step does
    row = assign(env, purpose="cost_rejected", params={"number": "1042", "department": "אחזקה"})
    assert env.tick() == 1
    done_row = env.row(row.id)
    assert done_row.state == "sent", done_row
    [call] = env.fake.calls
    assert env.links.url("L1", claim=True) in call["data"]["message"]
    assert ("L1", "whatsapp", "cost_rejected") in env.links.notes
    env.links.mint("L2")
    env.links.revoked.add("L2")
    row2 = assign(env, link="L2", assignment="A2", purpose="cost_reopened", params={"number": "1043", "department": "אחזקה"})
    env.tick()
    assert env.row(row2.id).state == "cancelled" and env.row(row2.id).outcome_code == "link_not_live"
    assert len(env.fake.calls) == 1


def test_cost_link_the_real_links_port_serves_a_closed_tickets_claim_mode(s4):
    from smplwise.services.tickets import messaging
    from smplwise.services.tickets import outbox_store as obs

    t, token, client, _ = done(s4, "optional")
    assert s4.w.status("joni", t["id"], "closed").status_code == 200
    link = s4.link_row(t["id"])
    port = messaging.DbLinks(obs.Access(s4.db), lambda: dt.datetime.now(dt.timezone.utc))
    assert port.url(link["id"]) is None, "the page no longer serves it"
    url = port.url(link["id"], claim=True)
    assert url and url.endswith(token), "the claim step does, until the claim window ends"
    with s4.db.connection() as conn:
        conn.execute("UPDATE ticket_cost_claims SET claim_until = '2000-01-01T00:00:00Z'")
    assert port.url(link["id"], claim=True) is None


def test_cost_link_a_rejection_queues_with_the_link_id(s4, monkeypatch):
    from smplwise.services.tickets import costs, messaging

    seen: list[dict] = []

    class FakeRuntime:
        data_dir = None
        outbox = object()

        def enqueue(self, conn, **kw):
            seen.append(kw)
            return None

    monkeypatch.setattr(messaging, "RUNTIME", FakeRuntime())
    monkeypatch.setattr(messaging, "plan_channel", lambda conn, contact, data_dir: "whatsapp")
    t, token, client, _ = done(s4)
    assert submit(client, token).status_code == 201
    assert decide(s4, t["id"], "reject", reason="חסרה חשבונית").status_code == 200
    assert [k["purpose"] for k in seen] == ["cost_rejected"] and seen[0]["link_id"] == s4.link_row(t["id"])["id"]
    assert costs is not None


# ================================================================ A4 - orphan files under a ticket folder

def _age(p: Path, hours: float) -> None:
    old = time.time() - hours * 3600
    os.utime(p, (old, old))


def test_a4_orphan_files_older_than_an_hour_are_swept_named_and_fresh_ones_stay(s4):
    t, token, client, claim, ids, pdf_id = _claim_with_files(s4)
    root = RUNTIME.attachments_root()
    folder = root / t["id"]
    with s4.db.connection(mode="read") as conn:
        named = [r[0] for r in conn.execute("SELECT path FROM ticket_cost_files WHERE ticket_id = ?", (t["id"],)).fetchall()]
    for rel in named:
        _age(root / rel, 5)
    orphan_photo = folder / "0123456789abcdef.jpg"
    orphan_pdf = folder / "costs" / "fedcba9876543210.pdf"
    orphan_tmp = folder / ".up.k3j4h5.tmp"
    fresh = folder / "00112233445566aa.jpg"
    unknown = folder / "notes.txt"
    for p in (orphan_photo, orphan_pdf, orphan_tmp, fresh, unknown):
        p.write_bytes(b"\xff\xd8\xff orphan")
    for p in (orphan_photo, orphan_pdf, orphan_tmp, unknown):
        _age(p, 2)
    out = costs_retention.janitor(s4.db, root, force=True)
    assert out["orphan_files"] == 3
    assert not orphan_photo.exists() and not orphan_pdf.exists() and not orphan_tmp.exists()
    assert fresh.exists(), "younger than an hour: its row may still be on the way"
    assert unknown.exists(), "a name the module never writes is not ours to delete"
    assert all((root / rel).is_file() for rel in named), "files a row names stay"


def test_a4_a_ticket_photo_named_by_its_row_stays(w):
    t = w.create("tom")
    r = w.c.post(f"{API}/tickets/{t['id']}/attachments", files={"file": ("p.jpg", jpeg(320, 200), "image/jpeg")}, data={"external": "false"},
                 headers=w.h("tom"))
    assert r.status_code == 201, r.text
    root = w.settings.data_dir / "tickets"
    with _db(w).connection(mode="read") as conn:
        rel = conn.execute("SELECT path FROM ticket_attachments WHERE ticket_id = ?", (t["id"],)).fetchone()[0]
    _age(root / rel, 5)
    out = costs_retention.janitor(_db(w), root, force=True)
    assert out["orphan_files"] == 0 and (root / rel).is_file()


# ================================================================ A6 - the internal photo through the ONE intake pipeline

def _upload(w, ticket_id: str, data: bytes, name: str = "p.jpg"):
    return w.c.post(f"{API}/tickets/{ticket_id}/attachments", files={"file": (name, data, "image/jpeg")}, data={"external": "false"},
                    headers=w.h("tom"))


def test_a6_the_internal_upload_goes_through_the_intake_pipeline_in_its_own_slot(w, monkeypatch):
    calls = []
    real = image_intake.reencode

    def spy(data, **kw):
        calls.append(kw)
        return real(data, **kw)

    monkeypatch.setattr(image_intake, "reencode", spy)
    t = w.create("tom")
    assert _upload(w, t["id"], jpeg(640, 480)).status_code == 201
    assert len(calls) == 1 and calls[0]["semaphore"] is attachments._DECODE, "the staff path keeps its own decode slot"


def test_a6_pillow_never_parses_the_uploads_exif(w, monkeypatch):
    from PIL import ImageOps

    def boom(*a, **k):
        raise AssertionError("Pillow's EXIF reader must not see an upload")

    monkeypatch.setattr(ImageOps, "exif_transpose", boom)
    t = w.create("tom")
    exif = Image.Exif()
    exif[0x0112] = 6  # orientation: rotate 90 - applied by the intake's bounded reader
    exif[0x010E] = "secret description"
    buf = io.BytesIO()
    Image.new("RGB", (400, 200), (10, 20, 30)).save(buf, format="JPEG", exif=exif.tobytes())
    r = _upload(w, t["id"], buf.getvalue())
    assert r.status_code == 201, r.text
    att = r.json()["attachments"][0]
    assert (att["width"], att["height"]) == (200, 400), "the orientation is still applied"
    body = w.c.get(f"{API}/{att['url']}", headers=w.h("tom")).content
    assert b"secret description" not in body


def test_a6_the_png_and_progressive_caps_apply_to_staff_too(w):
    t = w.create("tom")
    big = Image.new("1", (3000, 3000))  # 9 MP: under the 16 MP budget, over the 8 MP PNG cap (V6)
    buf = io.BytesIO()
    big.save(buf, format="PNG", optimize=True)
    r = _upload(w, t["id"], buf.getvalue(), name="big.png")
    assert r.status_code == 422 and r.json()["code"] == "too_many_pixels" and r.json()["details"]["max_pixels"] == image_intake.PNG_MAX_PIXELS
    prog = io.BytesIO()
    Image.new("RGB", (3500, 2500), (90, 90, 90)).save(prog, format="JPEG", progressive=True, quality=40)  # 8.75 MP progressive
    r = _upload(w, t["id"], prog.getvalue())
    assert r.status_code == 422 and r.json()["code"] == "too_many_pixels", r.text


def test_a6_attachments_has_no_decoder_of_its_own():
    src = SMPLWISE.joinpath("services", "tickets", "attachments.py").read_text(encoding="utf-8")
    assert "exif_transpose" not in src and "Image.open" not in src and "image_intake.reencode" in src


# ================================================================ B6 - the account filter counts every account the add-on sees

def _proc(*, mapped=(KEY_A,), recent=(), visible=()):
    from test_tickets_msg_inbound import FakeMatches

    def vis():
        if isinstance(visible, Exception):
            raise visible
        return set(visible)

    filt = ib.TicketAccountFilter(lambda: set(mapped), lambda since: set(recent), visible_keys=vis)
    return ib.InboundProcessor(key=TICKETS_KEY, directory=FakeMatches(), dedupe=ib.MemoryDedupe(), account_filter=filt)


def test_b6_one_ticket_account_and_another_account_in_ha_fails_closed_without_entry_id():
    from test_tickets_msg_inbound import recv

    d = _proc(mapped=(KEY_A,), visible=(KEY_A, KEY_B)).process(recv(PHONE_VENDOR, "2", at=T0), T0)
    assert (d.result, d.reason) == ("ignored", "account_unknown") and d.sender_key is None and d.content is None
    alone = _proc(mapped=(KEY_A,), visible=(KEY_A,)).process(recv(PHONE_VENDOR, "2", at=T0), T0)
    assert alone.reason != "account_unknown", "a single account in the whole installation is unambiguous"


def test_b6_an_unreadable_account_list_fails_closed():
    from test_tickets_msg_inbound import recv

    d = _proc(mapped=(KEY_A,), visible=RuntimeError("mirror down")).process(recv(PHONE_VENDOR, "2", at=T0), T0)
    assert d.reason == "account_unknown"


def test_b6_the_accounts_service_lists_every_account_it_can_see():
    from fake_ha_whatsapp import FakeHaWhatsapp, FakeMirror, PairedAccount
    from tickets_msg_fakes import ENTRY_A, ENTRY_B, default_doc

    from smplwise.services import messaging_accounts as ma

    fake = FakeHaWhatsapp([PairedAccount(ENTRY_A, "15555550191"), PairedAccount(ENTRY_B, "15555550192"), PairedAccount("01JFAKEINTERCOM", "15555550193")])
    svc = ma.AccountsService(load_doc=lambda: default_doc(), reader=FakeMirror(fake), registry=ma.UseRegistry(ma.tickets_uses(lambda: True)))
    assert {KEY_A, KEY_B, "entry:01JFAKEINTERCOM"} <= svc.all_keys()
    assert svc.mapped_keys("tickets") == {KEY_A}


def test_b6_the_runtime_processor_is_wired_with_every_visible_account():
    src = SMPLWISE.joinpath("services", "tickets", "messaging.py").read_text(encoding="utf-8")
    assert "visible_keys=svc.all_keys" in src
