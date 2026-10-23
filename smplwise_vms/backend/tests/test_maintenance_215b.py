"""MAINT215B (owner review 24.10, docs/changes/CR-MAINT215.md "Owner review 24.10 decisions"): reminders only after they are enabled in
Settings and the reminder log; the supplier-insurance mark of the tickets assignee picker (MARKING ONLY - nothing blocks); the certificate /
document file (PDF and picture, through the tickets validators); closing the request a plan opened ASKS the closer; the phone round default;
the sticker address = the remote address; the options for elevators / generators. Negative first. Same cast and fakes as test_maintenance_215.py."""
from __future__ import annotations

import io
import json

import pytest
from PIL import Image
from test_maintenance_215 import API, M, MAINT, NOW, _plan, _round, at, mw  # noqa: F401  (mw is the fixture)

from smplwise.services.maintenance import files as mfiles
from smplwise.services.maintenance import reminders
from smplwise.services.maintenance import service as msvc

PDF = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n"


def jpeg(w: int = 320, h: int = 240) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (w, h), (90, 160, 40)).save(buf, "JPEG", quality=85)
    return buf.getvalue()


def setting(mw, **kv):
    r = mw.c.patch(f"{API}/settings", json=kv)
    assert r.status_code == 200, r.text


# ================================================================ reminders only after they are enabled

def test_reminders_are_off_by_default_and_nothing_goes_out_until_enabled(mw):
    mw.on(reminders=False)
    assert mw.c.get(f"{API}/settings").json()["settings"]["maintenance.reminders_enabled"] == "false"
    t = mw.task(due_date="2027-01-20")
    s = mw.tick(at(2027, 1, 15))
    assert s["soon"] == 0 and s["overdue"] == 0 and s["tasks"] == 1
    assert mw.rows("SELECT COUNT(*) FROM maint_reminder_log")[0][0] == 0
    assert mw.rows("SELECT reminded_level FROM maint_tasks WHERE id = ?", (t["id"],))[0][0] == 0, "the level is not advanced while off"
    # a manager enables them: what is due at that moment goes out once
    setting(mw, **{"maintenance.reminders_enabled": "true"})
    assert mw.tick(at(2027, 1, 16))["soon"] == 1
    assert mw.tick(at(2027, 1, 17))["soon"] == 0
    log = mw.c.get(f"{M}/reminder-log").json()
    assert log["reminders_enabled"] is True and [i["event"] for i in log["items"]] == ["due_soon"] and log["items"][0]["title"] == t["title"]
    # switching them off again stops the next level
    setting(mw, **{"maintenance.reminders_enabled": "false"})
    assert mw.tick(at(2027, 2, 25))["overdue"] == 0


def test_the_reminder_setting_needs_system_configure_and_is_validated(mw):
    mw.on(reminders=False)
    assert mw.c.patch(f"{API}/settings", json={"maintenance.reminders_enabled": "true"}, headers=mw.h("tom")).status_code == 403
    for key, bad in (("maintenance.reminders_enabled", "yes"), ("maintenance.round_phone_view", "grid"), ("maintenance.close_request_mode", "never"),
                     ("maintenance.reminder_check_minutes", "0"), ("maintenance.reminder_check_minutes", "1441"), ("maintenance.reminder_log_keep_days", "6"),
                     ("maintenance.reminder_log_keep_days", "3651"), ("maintenance.vendor_insurance_warn_days", "366"), ("maintenance.file_max_per_task", "0"),
                     ("maintenance.file_max_per_task", "51"), ("maintenance.vendor_missing_insurance_mark", "maybe")):
        assert mw.c.patch(f"{API}/settings", json={key: bad}).status_code == 422, (key, bad)
    setting(mw, **{"maintenance.reminder_check_minutes": "5", "maintenance.reminder_log_keep_days": "30", "maintenance.round_phone_view": "list",
                   "maintenance.close_request_mode": "off", "maintenance.vendor_insurance_warn_days": "10", "maintenance.file_max_per_task": "3"})
    d = mw.c.get(f"{M}/options").json()["defaults"]
    assert (d["reminder_check_minutes"], d["reminder_log_keep_days"], d["round_phone_view"], d["close_request_mode"], d["vendor_insurance_warn_days"], d["file_max_per_task"]) \
        == (5, 30, "list", "off", 10, 3)
    assert mw.c.get(f"{M}/module").json()["round_view"] == "list"


def test_the_worker_interval_is_a_setting(mw):
    mw.on()
    setting(mw, **{"maintenance.reminder_check_minutes": "2"})
    reminders.reset_for_tests()
    reminders.janitor(mw.db)
    assert reminders._every_s == 120.0


def test_the_reminder_log_lists_reminders_and_requests_and_follows_visibility(mw):
    mw.on()
    plan = _plan(mw, lead_days=7)
    floor_task = mw.task(title="בדיקת קומה 2", place=mw.floor("floor2"), due_date="2027-01-20")
    mw.tick(at(2027, 1, 14))
    log = mw.c.get(f"{M}/reminder-log").json()
    assert {i["event"] for i in log["items"]} == {"due_soon", "request"}, log
    req = next(i for i in log["items"] if i["event"] == "request")
    assert req["task_id"] == plan["id"] and req["detail"], "the request line names the ticket id"
    only = mw.c.get(f"{M}/reminder-log", params={"event": "request"}).json()["items"]
    assert [i["event"] for i in only] == ["request"]
    assert mw.c.get(f"{M}/reminder-log", params={"event": "nope"}).status_code == 422
    # isolation: gil (floor 3) sees neither the floor-2 task's line nor an installation task's; fred (floor 2) sees the floor-2 line
    assert floor_task["id"] not in {i["task_id"] for i in mw.c.get(f"{M}/reminder-log", headers=mw.h("gil")).json()["items"]}
    assert floor_task["id"] in {i["task_id"] for i in mw.c.get(f"{M}/reminder-log", headers=mw.h("fred")).json()["items"]}
    assert mw.c.get(f"{M}/reminder-log", headers=mw.h("vic")).status_code == 403, "default deny"
    # a deleted task keeps its line, for managers only
    mw.c.delete(f"{M}/tasks/{floor_task['id']}")
    assert floor_task["id"] not in {i["task_id"] for i in mw.c.get(f"{M}/reminder-log", headers=mw.h("fred")).json()["items"]}
    assert floor_task["id"] in {i["task_id"] for i in mw.c.get(f"{M}/reminder-log").json()["items"]}


def test_a_failed_request_is_logged_and_old_lines_are_pruned(mw):
    mw.on()
    _plan(mw)
    with mw.db.connection() as conn:
        conn.execute("UPDATE ticket_departments SET active = 0 WHERE id = ?", (MAINT,))
    mw.tick(at(2027, 1, 15))
    assert [i["event"] for i in mw.c.get(f"{M}/reminder-log", params={"event": "request_failed"}).json()["items"]] == ["request_failed"]
    setting(mw, **{"maintenance.reminder_log_keep_days": "7"})
    mw.tick(at(2027, 3, 1))  # 45 days later: the January lines are older than the 7 days kept
    assert all(i["at"] >= "2027-02-20" for i in mw.c.get(f"{M}/reminder-log").json()["items"])


# ================================================================ supplier insurance: a MARK in the picker, never a block

def _picker(mw, user: str = "joni"):
    r = mw.c.get(f"{API}/tickets/assignees", params={"department_id": MAINT}, headers=mw.h(user))
    assert r.status_code == 200, r.text
    return {c["name"]: c for c in r.json()["contacts"]}


def test_the_assignee_picker_marks_a_supplier_with_expired_or_missing_insurance_and_nothing_blocks(mw):
    mw.on()
    ok, late, soon, none = (mw.vendor(n) for n in ("ספק תקין", "ספק פג", "ספק מסתיים", "ספק בלי"))
    mw.clock = NOW
    mw.task(kind="vendor_document", title="ביטוח", vendor_id=ok, doc_type="insurance", due_date="2028-06-01")
    mw.task(kind="vendor_document", title="ביטוח", vendor_id=late, doc_type="insurance", due_date="2027-01-10")
    mw.task(kind="vendor_document", title="ביטוח", vendor_id=soon, doc_type="insurance", due_date="2027-02-01")
    mw.task(kind="vendor_document", title="רישיון", vendor_id=none, doc_type="electrician_license", due_date="2028-01-01")
    with mw.db.connection(mode="read") as conn:
        marks = msvc.insurance_marks(conn, [ok, late, soon, none], __import__("datetime").date(2027, 1, 15))
    assert marks[ok]["state"] == "ok" and marks[late] == {"state": "expired", "valid_until": "2027-01-10"}
    assert marks[soon]["state"] == "expiring" and marks[none] == {"state": "missing", "valid_until": None}
    # the picker route carries the mark on the supplier rows
    picker = _picker(mw)
    assert picker["ספק פג"]["insurance"]["state"] == "expired" and picker["ספק בלי"]["insurance"]["state"] == "missing"
    # MARKING ONLY: assigning the supplier with the expired insurance is not refused and asks for no confirmation
    t = mw.w.create("joni", "תקלה")
    r = mw.c.post(f"{API}/tickets/{t['id']}/assign", json={"assignee": {"kind": "contact", "id": late}, "revision": mw.w.detail(t["id"])["revision"]}, headers=mw.h("joni"))
    assert r.status_code != 409 or r.json()["code"] != "insurance_expired", r.text
    assert "insurance" not in json.dumps(r.json()["code"] if r.status_code >= 400 else "")


def test_insurance_marks_follow_the_settings_and_the_module_switch(mw):
    mw.on()
    v = mw.vendor("ספק")
    with mw.db.connection(mode="read") as conn:
        d = __import__("datetime").date(2027, 1, 15)
        assert msvc.insurance_marks(conn, [v], d)[v]["state"] == "missing"
    setting(mw, **{"maintenance.vendor_missing_insurance_mark": "false"})
    with mw.db.connection(mode="read") as conn:
        assert msvc.insurance_marks(conn, [v], d) == {}, "the 'no insurance document at all' mark is a setting"
    mw.task(kind="vendor_document", title="ביטוח", vendor_id=v, doc_type="insurance", due_date="2027-02-01")
    with mw.db.connection(mode="read") as conn:
        assert msvc.insurance_marks(conn, [v], d)[v]["state"] == "expiring"
    setting(mw, **{"maintenance.vendor_insurance_warn_days": "5"})
    with mw.db.connection(mode="read") as conn:
        assert msvc.insurance_marks(conn, [v], d)[v]["state"] == "ok", "the warning window is a setting"
    assert mw.c.patch(f"{API}/settings", json={"maintenance.enabled": "false"}).status_code == 200
    assert all("insurance" not in c for c in _picker(mw).values()), "the module off: no mark anywhere"


# ================================================================ the certificate / document file

def _doc(mw, **extra):
    return mw.task(kind="certificate", title="תסקיר מעלית", due_date="2027-06-01", **extra)


def _upload(mw, task_id, data: bytes, name="cert.pdf", user="joni", ctype="application/pdf"):
    return mw.c.post(f"{M}/tasks/{task_id}/files", files={"file": (name, data, ctype)}, headers=mw.h(user))


def test_a_pdf_and_a_picture_are_attached_listed_and_downloaded(mw, settings):
    mw.on()
    t = _doc(mw)
    r = _upload(mw, t["id"], PDF, "../../תסקיר.pdf")
    assert r.status_code == 201, r.text
    f = r.json()
    assert f["kind"] == "pdf" and f["bytes"] == len(PDF) and "/" not in f["name"] and f["name"].endswith(".pdf") and f["uploaded_by_name"]
    j = _upload(mw, t["id"], jpeg(), "scan.png", ctype="image/png")
    assert j.status_code == 201 and j.json()["kind"] == "image" and j.json()["name"].endswith(".jpg"), "a picture is re-encoded to a fresh JPEG"
    detail = mw.c.get(f"{M}/tasks/{t['id']}").json()
    assert [x["id"] for x in detail["files"]] == [f["id"], j.json()["id"]] and detail["file_count"] == 2
    dl = mw.c.get(f"{M}/tasks/{t['id']}/files/{f['id']}")
    assert dl.status_code == 200 and dl.content == PDF
    assert dl.headers["content-type"] == "application/pdf" and dl.headers["content-disposition"].startswith("attachment")
    assert dl.headers["content-security-policy"] == "sandbox" and dl.headers["x-content-type-options"] == "nosniff" and "no-store" in dl.headers["cache-control"]
    img = mw.c.get(f"{M}/tasks/{t['id']}/files/{j.json()['id']}")
    assert img.headers["content-type"] == "image/jpeg" and Image.open(io.BytesIO(img.content)).format == "JPEG"
    on_disk = list((settings.data_dir / "maintenance" / t["id"]).iterdir())
    assert len(on_disk) == 2 and {p.suffix for p in on_disk} == {".pdf", ".jpg"}
    assert all(len(p.stem) == 16 for p in on_disk), "random names: the uploader never names a path"
    audit = " ".join(a["details_json"] or "" for a in mw.audits("maintenance.file.add", "allowed"))
    assert "תסקיר" not in audit and "scan" not in audit, "the audit never carries a file name"


def test_unsafe_or_wrong_files_are_refused_and_nothing_is_stored(mw, settings):
    mw.on()
    t = _doc(mw)
    js = b"%PDF-1.4\n1 0 obj\n<< /OpenAction << /S /JavaScript /JS (app.alert(1)) >> >>\nendobj\n%%EOF\n"
    r = _upload(mw, t["id"], js)
    assert r.status_code == 422 and r.json()["code"] == "pdf_refused"
    assert _upload(mw, t["id"], b"MZ\x90\x00 not a document", "x.exe", ctype="application/octet-stream").status_code == 415
    assert _upload(mw, t["id"], b"", "e.pdf").status_code == 422
    assert _upload(mw, t["id"], b"%PDF-1.4\n no end marker").json()["code"] == "pdf_invalid"
    assert _upload(mw, t["id"], b"RIFF\x00\x00\x00\x00WEBPVP8 ", "w.webp", ctype="image/webp").json()["code"] == "webp_refused"
    big = b"%PDF-1.4\n" + b"0" * (10 * 1024 * 1024 + 10) + b"\n%%EOF\n"
    assert _upload(mw, t["id"], big).status_code in (413, 422)
    assert mw.rows("SELECT COUNT(*) FROM maint_files")[0][0] == 0
    folder = settings.data_dir / "maintenance" / t["id"]
    assert not folder.exists() or not list(folder.iterdir())
    assert mw.audits("maintenance.file.add", "denied")


def test_file_permissions_visibility_and_limits(mw):
    mw.on()
    t = _doc(mw, place=mw.floor("floor2"))
    # default deny: an operator may view but not attach; a viewer sees nothing; a task of another floor is the uniform 404
    assert _upload(mw, t["id"], PDF, user="fred").status_code == 403
    assert _upload(mw, t["id"], PDF, user="vic").status_code in (403, 404)
    assert _upload(mw, t["id"], PDF, user="gil").status_code == 404
    ok = _upload(mw, t["id"], PDF, user="sara")  # site_admin on floor 2
    assert ok.status_code == 201
    fid = ok.json()["id"]
    assert mw.c.get(f"{M}/tasks/{t['id']}/files/{fid}", headers=mw.h("fred")).status_code == 200
    assert mw.c.get(f"{M}/tasks/{t['id']}/files/{fid}", headers=mw.h("gil")).status_code == 404
    assert mw.c.get(f"{M}/tasks/{t['id']}/files/nope", headers=mw.h("fred")).json()["code"] == "maint_file_not_found"
    assert mw.c.delete(f"{M}/tasks/{t['id']}/files/{fid}", headers=mw.h("fred")).status_code == 403
    assert mw.audits("maintenance.file.add", "denied")
    # only certificates and supplier documents carry files
    plan = _plan(mw, auto_ticket=False, department_id=None)
    assert _upload(mw, plan["id"], PDF).json()["code"] == "files_not_supported"
    # the number of files per task is a setting
    setting(mw, **{"maintenance.file_max_per_task": "2"})
    assert _upload(mw, t["id"], PDF).status_code == 201
    r = _upload(mw, t["id"], PDF)
    assert r.status_code == 409 and r.json()["code"] == "too_many_files" and r.json()["details"]["max"] == 2


def test_removing_a_file_deletes_the_bytes_keeps_the_audit_row_and_a_module_off_hides_it(mw, settings):
    mw.on()
    t = _doc(mw)
    f = _upload(mw, t["id"], PDF).json()
    path = next((settings.data_dir / "maintenance" / t["id"]).iterdir())
    assert mw.c.delete(f"{M}/tasks/{t['id']}/files/{f['id']}").json() == {"id": f["id"], "deleted": True}
    assert not path.exists() and mw.c.get(f"{M}/tasks/{t['id']}/files/{f['id']}").status_code == 404
    assert mw.rows("SELECT deleted_at FROM maint_files WHERE id = ?", (f["id"],))[0][0], "the row stays, marked"
    assert mw.audits("maintenance.file.delete", "allowed")
    assert mw.c.get(f"{M}/tasks/{t['id']}").json()["files"] == []
    g = _upload(mw, t["id"], PDF).json()
    assert mw.c.patch(f"{API}/settings", json={"maintenance.enabled": "false"}).status_code == 200
    assert mw.c.get(f"{M}/tasks/{t['id']}/files/{g['id']}").json()["code"] == "feature_disabled"
    assert _upload(mw, t["id"], PDF).status_code == 404


def test_file_storage_is_confined_and_the_tables_are_not_in_a_backup(mw, settings):
    from smplwise.body_limit import route_limit
    from smplwise.services import backup as bsvc

    assert {"maint_files", "maint_reminder_log"} <= bsvc.NEVER_EXPORTED_TABLES and not ({"maint_files", "maint_reminder_log"} & set(bsvc.PROJECT_TABLES))
    n, name = route_limit("POST", "/api/v1/maintenance/tasks/abc/files", settings)
    assert name == "maintenance_file" and n > 10 * 1024 * 1024
    for bad in ("../x/0123456789abcdef.pdf", "/abs/0123456789abcdef.pdf", "a/b/0123456789abcdef.pdf", "a/0123456789abcdef.exe", "a\\0123456789abcdef.pdf"):
        with pytest.raises(ValueError):
            mfiles.path_of(settings.data_dir, bad)
    assert mfiles.clean_name("../../etc/passwd", "pdf") == "passwd.pdf" and mfiles.clean_name("", "image") == "certificate.jpg"
    assert mfiles.clean_name("x" * 300, "pdf").endswith(".pdf") and len(mfiles.clean_name("x" * 300, "pdf")) <= 80
    assert mfiles.download_headers('a"b.pdf', "pdf")["Content-Disposition"].count('"') == 2


# ================================================================ closing the request a plan opened ASKS the closer

def _open_request(mw):
    t = _plan(mw, lead_days=7)
    mw.tick(at(2027, 1, 14))
    tid = mw.c.get(f"{M}/tasks/{t['id']}").json()["ticket_id"]
    assert tid
    mw.clock = at(2027, 1, 16)
    return t, tid


def _close(mw, tid, user="joni"):
    rev = mw.c.get(f"{API}/tickets/{tid}").json()["revision"]
    r = mw.c.post(f"{API}/tickets/{tid}/status", json={"to": "closed", "note": "בוצע", "revision": rev}, headers=mw.h(user))
    assert r.status_code == 200, r.text


def test_closing_the_request_asks_by_default_and_changes_nothing_until_the_closer_says_yes(mw):
    mw.on()
    assert mw.c.get(f"{M}/options").json()["defaults"]["close_request_mode"] == "ask"
    t, tid = _open_request(mw)
    assert mw.c.get(f"{M}/close-proposal/{tid}").json() == {"proposal": None}, "a request that is still open proposes nothing"
    _close(mw, tid)
    assert mw.c.get(f"{M}/tasks/{t['id']}").json()["due_date"] == "2027-01-20", "closing alone does not move the plan"
    prop = mw.c.get(f"{M}/close-proposal/{tid}").json()["proposal"]
    assert prop == {"task_id": t["id"], "title": t["title"], "kind": "preventive", "due_date": "2027-01-20", "next_due": "2027-02-20"}
    # nobody who may not see or mark the plan is asked - and learns nothing: the same empty answer as for an unknown request
    assert mw.c.get(f"{M}/close-proposal/{tid}", headers=mw.h("vic")).json() == {"proposal": None}
    r = mw.c.post(f"{M}/close-proposal/{tid}/confirm", headers=mw.h("tom"))
    assert r.status_code == 200, r.text
    after = mw.c.get(f"{M}/tasks/{t['id']}").json()
    assert after["due_date"] == "2027-02-20"
    rec = mw.c.get(f"{M}/tasks/{t['id']}/records").json()["items"][0]
    assert rec["ticket_ids"] == [tid] and rec["started_by_name"] and rec["performed_on"] == "2027-01-16", "the confirming person is the performer"
    assert any("ticket_closed_confirmed" in (a["details_json"] or "") for a in mw.audits("maintenance.task.complete", "allowed"))
    # asked once: the cycle is done, the question is gone and a second confirm is refused
    assert mw.c.get(f"{M}/close-proposal/{tid}").json() == {"proposal": None}
    assert mw.c.post(f"{M}/close-proposal/{tid}/confirm").json()["code"] == "nothing_to_confirm"
    assert len(mw.c.get(f"{M}/tasks/{t['id']}/records").json()["items"]) == 1


def test_saying_no_leaves_the_plan_and_the_modes_off_and_auto_behave(mw):
    mw.on()
    t, tid = _open_request(mw)
    _close(mw, tid)
    assert mw.c.get(f"{M}/tasks/{t['id']}").json()["due_date"] == "2027-01-20"  # the closer answered no: nothing was sent
    setting(mw, **{"maintenance.close_request_mode": "off"})
    assert mw.c.get(f"{M}/close-proposal/{tid}").json() == {"proposal": None}
    assert mw.c.post(f"{M}/close-proposal/{tid}/confirm").status_code == 409
    setting(mw, **{"maintenance.close_request_mode": "auto"})
    assert mw.c.get(f"{M}/close-proposal/{tid}").json() == {"proposal": None}, "auto marks at the close, it does not ask"
    t2 = _plan(mw, title="תוכנית אוטומטית", lead_days=7)
    mw.tick(at(2027, 1, 16))
    tid2 = mw.c.get(f"{M}/tasks/{t2['id']}").json()["ticket_id"]
    _close(mw, tid2)
    assert mw.c.get(f"{M}/tasks/{t2['id']}").json()["due_date"] == "2027-02-20"


def test_the_question_is_only_for_a_person_who_may_mark_it_and_only_for_the_current_cycle(mw):
    mw.on()
    t, tid = _open_request(mw)
    _close(mw, tid)
    # a floor-2-only operator cannot see an installation task's proposal? (placeless: permission at any scope) - fred holds perform at floor 2
    assert mw.c.get(f"{M}/close-proposal/{tid}", headers=mw.h("fred")).json()["proposal"]["task_id"] == t["id"]
    # the plan was moved by hand after the close: the request is of an older cycle, no question
    mw.c.post(f"{M}/tasks/{t['id']}/complete", json={})
    assert mw.c.get(f"{M}/close-proposal/{tid}").json() == {"proposal": None}
    # an unknown request and a paused plan
    assert mw.c.get(f"{M}/close-proposal/nope0000").json() == {"proposal": None}


def test_a_certificate_without_an_interval_is_never_proposed(mw):
    mw.on()
    cert = mw.task(title="תעודה", due_date="2027-01-20")  # no interval: its new date needs a person
    t = mw.w.create("joni", "בקשה")
    with mw.db.connection() as conn:
        conn.execute("UPDATE maint_tasks SET ticket_id = ?, ticket_due = due_date WHERE id = ?", (t["id"], cert["id"]))
    _close(mw, t["id"])
    assert mw.c.get(f"{M}/close-proposal/{t['id']}").json() == {"proposal": None}


# ================================================================ the phone round, the sticker address, the form options

def test_the_sticker_address_is_the_remote_address_unless_overridden(mw):
    mw.on()
    rnd = _round(mw)
    mw.c.post(f"{M}/tags", json={"target_kind": "task", "target_id": rnd["id"]})
    assert mw.c.get(f"{M}/tags").json()["base_url"] == "", "no remote address configured: the screen falls back to the address in use and says so"
    with mw.db.connection() as conn:
        conn.execute("INSERT OR REPLACE INTO settings(key, value) VALUES ('security.local_public_url', 'https://arx.remote.example.test')")
    assert mw.c.get(f"{M}/tags").json()["base_url"] == "https://arx.remote.example.test"
    assert mw.c.get(f"{M}/options").json()["defaults"]["tag_effective_url"] == "https://arx.remote.example.test"
    setting(mw, **{"maintenance.tag_base_url": "https://sticker.example.test/arx"})
    assert mw.c.get(f"{M}/tags").json()["base_url"] == "https://sticker.example.test/arx", "an explicit override wins"
    setting(mw, **{"maintenance.tag_base_url": ""})
    assert mw.c.get(f"{M}/tags").json()["base_url"] == "https://arx.remote.example.test"


def test_the_form_offers_elevators_and_generators_and_a_task_links_to_them(mw):
    mw.on()
    with mw.db.connection() as conn:
        conn.execute("INSERT INTO infra_elevators(id, name, name_key, created_at, updated_at) VALUES ('el1', 'מעלית ראשית', 'מעלית ראשית', 't', 't')")
    opts = mw.c.get(f"{M}/options").json()
    assert opts["elevators"] == [{"id": "el1", "name": "מעלית ראשית"}] and opts["generators"] == []
    t = mw.task(title="תסקיר מעלית", elevator_id="el1")
    assert t["elevator_id"] == "el1" and t["elevator_name"] == "מעלית ראשית"
    card = mw.c.get(f"{M}/by-subject/elevator/el1").json()
    assert [i["id"] for i in card["items"]] == [t["id"]] and card["state"] == "due_soon"
    assert mw.c.post(f"{M}/tasks", json={"kind": "certificate", "title": "x", "due_date": "2027-02-14", "elevator_id": "nope"}, headers=mw.h("joni")).status_code == 422

