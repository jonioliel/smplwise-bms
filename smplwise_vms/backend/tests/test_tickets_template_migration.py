"""TKTPLMIG (owner decision 2026-10-16): migration 0092 (0089 on its branch) removes the numeric quick-reply line from the message templates an installation
saved or customised (ticket_templates, kind 'message'), in he / en / ar / ru. Every name and text here is invented."""
from __future__ import annotations

import shutil

import pytest

from smplwise import db as dbmod
from smplwise.services.tickets import message_templates as mt

OLD = {"he": "לאישור מהיר השב 1 = התקבל, 2 = בטיפול", "en": "Quick reply: 1 = received, 2 = in progress",
       "ar": "للرد السريع: 1 = تم الاستلام، 2 = قيد المعالجة", "ru": "Быстрый ответ: 1 = получено, 2 = в работе"}
NEW = {"he": "חובה להיכנס לקישור כדי להמשיך בטיפול.", "en": "You must open the link to continue the handling.",
       "ar": "يجب فتح الرابط لمتابعة المعالجة.", "ru": "Чтобы продолжить работу, необходимо открыть ссылку."}
AT = "2026-10-01T08:00:00Z"



def _from_92() -> list[int]:
    """0092 and every later migration file, in order (property, not a literal list)."""
    return sorted(n for n in (int(f.name[:4]) for f in dbmod.MIGRATIONS_DIR.glob("*.sql")) if n >= 92)

def _older(settings, tmp_path, monkeypatch):
    real = dbmod.MIGRATIONS_DIR
    older = tmp_path / "older"
    older.mkdir()
    for f in real.glob("*.sql"):
        if int(f.name.split("_", 1)[0]) < 92:
            shutil.copy(f, older / f.name)
    monkeypatch.setattr(dbmod, "MIGRATIONS_DIR", older)
    database = dbmod.Database(settings.db_path)
    database.migrate()
    monkeypatch.setattr(dbmod, "MIGRATIONS_DIR", real)
    return database


def _put(conn, tid, lang, body, *, purpose="assign", kind="message", revision=3, deleted=None, active=1):
    conn.execute("INSERT INTO ticket_templates(id, department_id, kind, purpose, name, title, body, lang, active, revision, updated_by, "
                 "updated_at, deleted_at) VALUES (?, NULL, ?, ?, ?, '', ?, ?, ?, ?, 'owner', ?, ?)",
                 (tid, kind, purpose, f"{purpose}/{lang}", body, lang, active, revision, AT, deleted))


def _row(database, tid):
    with database.connection(mode="read") as conn:
        return dict(conn.execute("SELECT * FROM ticket_templates WHERE id = ?", (tid,)).fetchone())


def test_the_starters_and_the_migration_agree_and_no_starter_has_the_old_line():
    for lang in OLD:
        for table in (mt.STARTERS, mt.STAFF_STARTERS):
            for texts in table.values():
                assert OLD[lang] not in texts[lang]
    assert all(NEW[lang] in mt.STARTERS["assign"][lang] for lang in OLD)


def test_0092_rewrites_only_the_old_line_in_every_language_and_position(settings, tmp_path, monkeypatch):
    database = _older(settings, tmp_path, monkeypatch)
    bodies = {
        "t-he": ("he", "שלום {name},\nלעדכון: {link}\n" + OLD["he"]),                      # last line
        "t-en": ("en", "Hello {name}\n" + OLD["en"] + "\nUpdate: {link}"),                 # middle line
        "t-ar": ("ar", OLD["ar"] + "\nمرحبًا {name}: {link}"),                              # first line
        "t-ru": ("ru", "Здравствуйте {name}\r\nОбновить: {link}\r\n" + OLD["ru"] + "  \r\n"),  # CRLF, trailing spaces
        "t-mixed": ("he", "{link}\n" + OLD["he"] + "\n" + OLD["en"]),                      # two languages in one body
        "t-clean": ("en", "Hello {name}, open {link}"),                                     # no old line
        "t-done": ("en", "Hello {name}\n{link}\n" + NEW["en"]),                             # already migrated
    }
    with database.connection() as conn:
        for tid, (lang, body) in bodies.items():
            _put(conn, tid, lang, body, purpose="reminder" if tid == "t-ru" else "assign")
        _put(conn, "t-ticket", "he", "טקסט " + OLD["he"], kind="ticket", purpose=None)  # a ticket template is not a message
        _put(conn, "t-off", "he", "{link}\n" + OLD["he"], active=0, deleted=AT)          # inactive / deleted rows are rewritten too
        # negative first: the old line is there before the migration
        assert conn.execute("SELECT count(*) FROM ticket_templates WHERE instr(body, ?) > 0 OR instr(body, ?) > 0", (OLD["he"], OLD["en"])).fetchone()[0] == 5
    assert dbmod.Database(settings.db_path).migrate() == _from_92()  # 0093 (app secrets), 0095 (USR1) ... follow in the real set

    expected = {
        "t-he": "שלום {name},\nלעדכון: {link}\n" + NEW["he"],
        "t-en": "Hello {name}\n" + NEW["en"] + "\nUpdate: {link}",
        "t-ar": NEW["ar"] + "\nمرحبًا {name}: {link}",
        "t-ru": "Здравствуйте {name}\r\nОбновить: {link}\r\n" + NEW["ru"] + "  \r\n",
        "t-mixed": "{link}\n" + NEW["he"] + "\n" + NEW["en"],
        "t-clean": bodies["t-clean"][1],
        "t-done": bodies["t-done"][1],
    }
    for tid, body in expected.items():
        assert _row(database, tid)["body"] == body
    assert _row(database, "t-ticket")["body"] == "טקסט " + OLD["he"]  # kind 'ticket' untouched
    assert _row(database, "t-off")["body"] == "{link}\n" + NEW["he"]
    for tid in ("t-he", "t-en", "t-ar", "t-ru", "t-mixed", "t-off"):  # changed rows: revision + 1, stamped by the migration
        r = _row(database, tid)
        assert r["revision"] == 4 and r["updated_by"] == "system:migration-0092" and r["updated_at"] > AT
    for tid in ("t-clean", "t-done", "t-ticket"):  # untouched rows keep revision, author and time
        r = _row(database, tid)
        assert (r["revision"], r["updated_by"], r["updated_at"]) == (3, "owner", AT)
    # a migrated template still validates (the settings editor would accept it)
    for tid, purpose in (("t-he", "assign"), ("t-en", "assign"), ("t-ar", "assign"), ("t-ru", "reminder"), ("t-mixed", "assign")):
        assert mt.problems(purpose, _row(database, tid)["body"]) == [], tid


def test_0092_is_idempotent_when_its_statement_runs_again(settings, tmp_path, monkeypatch):
    database = _older(settings, tmp_path, monkeypatch)
    with database.connection() as conn:
        _put(conn, "t1", "he", "{link}\n" + OLD["he"])
        _put(conn, "t2", "en", "x {link}", purpose="reminder")
    assert dbmod.Database(settings.db_path).migrate() == _from_92()  # 0093 (app secrets), 0095 (USR1) ... follow in the real set
    first = {t: _row(database, t) for t in ("t1", "t2")}
    sql = (dbmod.MIGRATIONS_DIR / "0092_ticket_template_quick_reply.sql").read_text(encoding="utf-8")
    with database.connection() as conn:
        conn.executescript(sql)
    assert {t: _row(database, t) for t in ("t1", "t2")} == first  # no body, revision or timestamp moved
    assert first["t1"]["revision"] == 4 and first["t2"]["revision"] == 3


def test_0092_leaves_the_outbox_and_nothing_else_alone(settings, tmp_path, monkeypatch):
    sql = (dbmod.MIGRATIONS_DIR / "0092_ticket_template_quick_reply.sql").read_text(encoding="utf-8")
    code = "\n".join(line for line in sql.splitlines() if not line.startswith("--"))
    assert "ticket_outbox" not in code and code.count("UPDATE") == 1 and "UPDATE ticket_templates" in code
