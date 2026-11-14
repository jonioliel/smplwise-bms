"""DATASTORE-295 part 3: the storage-boundary scanner (scripts/sql_boundary_report.py) counts SQL outside store modules, weights
routers, lists the tables written from several modules, and runs on the real backend without importing it."""
from __future__ import annotations

import importlib.util
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]


def _mod():
    spec = importlib.util.spec_from_file_location("sql_boundary_report", REPO / "scripts" / "sql_boundary_report.py")
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def test_the_scanner_on_a_small_tree(tmp_path):
    m = _mod()
    (tmp_path / "routers").mkdir()
    (tmp_path / "services").mkdir()
    (tmp_path / "routers" / "things.py").write_text(
        'def f(conn, t):\n    conn.execute("SELECT id FROM things WHERE x = ?", (1,))\n'
        '    conn.execute(f"UPDATE things SET a = 1 WHERE id = {t}")\n', encoding="utf-8")
    (tmp_path / "services" / "thing_store.py").write_text('def g(conn):\n    conn.execute("DELETE FROM things")\n', encoding="utf-8")
    (tmp_path / "services" / "other.py").write_text('def h(conn):\n    conn.execute("INSERT INTO things(id) VALUES (1)")\n'
                                                    'NOTE = "select a seat from the list"\n', encoding="utf-8")
    rows = {r["module"]: r for r in m.scan(tmp_path)}
    assert rows["services/thing_store.py"]["store"] is True
    r = rows["routers/things.py"]
    assert (r["store"], r["layer"], r["sql"], r["writes"], r["execute_calls"], r["written"]) == (False, "router", 2, 1, 2, ["things"])
    assert r["score"] == (2 + 1 + 2) * 1.5
    assert rows["services/other.py"]["sql"] == 1, "plain English is not SQL"
    assert m.table_spread(list(rows.values())) == [("things", ["routers/things.py", "services/other.py"])]
    md = m.markdown(list(rows.values()), 10)
    assert md.index("routers/things.py") < md.index("services/other.py")


def test_the_scanner_runs_on_the_backend():
    m = _mod()
    rows = m.scan(m.ROOT)
    assert any(r["store"] for r in rows) and any(not r["store"] for r in rows)
    assert any(r["module"] == "services/tickets/store.py" and r["store"] for r in rows)
