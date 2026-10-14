"""CR-038 slice 6b (D24, section 13.6) - the table's query language as pure functions: the sort / filter / column / limit whitelists,
the opaque keyset cursor (and what tampering can and cannot do), the saved-view document and the `tickets.board` preference."""
from __future__ import annotations

import base64
import json

import pytest

from smplwise.services.tickets import table, table_prefs, views


def test_sort_whitelist_two_keys_and_default():
    assert table.parse_sort(None) == (("activity", "desc"),)
    assert table.parse_sort("priority:asc,created:desc") == (("priority", "asc"), ("created", "desc"))
    assert table.parse_sort("number") == (("number", "asc"),)
    for bad in ("bogus:asc", "number:up", "number:asc,number:desc", "a:asc,b:asc,c:asc", "priority:asc,created:desc,number:asc", "title:asc;DROP", 7):
        with pytest.raises(table.TableError) as exc:
            table.parse_sort(bad)
        assert exc.value.field == "sort", bad
    assert set(table.SORT_KEYS) == {"number", "title", "department", "priority", "status", "assignee", "place", "device", "created", "activity", "stuck", "sla"}


@pytest.mark.parametrize("raw,field", [
    ({"status": "nope"}, "status"),
    ({"status": "new,bogus"}, "status"),
    ({"scope": "everything"}, "scope"),
    ({"priority": "urgent,critical"}, "priority"),
    ({"department": "ok-id,bad id"}, "department"),
    ({"assignee": "group:abc"}, "assignee"),
    ({"assignee": "user:"}, "assignee"),
    ({"stuck": "forever"}, "stuck"),
    ({"waiting": "assignee"}, "waiting"),
    ({"created_from": "yesterday"}, "created_from"),
    ({"created_from": "2026-10-13T10:00:00"}, "created_from"),  # no zone: refused, never guessed
    ({"created_from": "2026-10-13T10:00:00Z", "created_to": "2026-10-12T10:00:00Z"}, "created_to"),
    ({"q": "x" * 81}, "q"),
    ({"phone": "0501234567"}, "phone"),
    ({"department": ",".join(f"d{i}" for i in range(21))}, "department"),
])
def test_filter_whitelist_refuses_and_names_the_field(raw, field):
    with pytest.raises(table.TableError) as exc:
        table.parse_filters(raw)
    assert exc.value.field == field


def test_filters_normalise_to_a_canonical_form():
    f = table.parse_filters({"status": "done,new,new", "department": "d1, d2", "priority": ["high"], "assignee": "me", "stuck": "any", "waiting": "manager",
                             "created_from": "2026-10-13T12:00:00+03:00", "q": " מזגן‮ "})
    assert f.statuses == ("new", "done") and f.status_text == "new,done", "statuses in lifecycle order, distinct"
    assert f.created_from == "2026-10-13T09:00:00Z", "an instant with an offset becomes UTC"
    assert f.q == "מזגן", "Cc / Cf stripped (review T9)"
    assert table.parse_filters({}).statuses == table.STATUS_GROUPS["open"]
    assert table.parse_filters({"status": "all"}).statuses is None
    assert table.parse_filters(f.as_dict()) == f, "the canonical form parses back to itself (a saved view round-trips)"


def test_limits_and_columns():
    assert [table.parse_limit(v) for v in (None, "25", 50, "100", 200)] == [50, 25, 50, 100, 200]
    for bad in ("30", "0", "abc", 1000):
        with pytest.raises(table.TableError):
            table.parse_limit(bad)
    assert table.parse_columns(None) == table.DEFAULT_COLUMNS
    assert table.parse_columns("sla,status") == ("number", "title", "sla", "status"), "number and title are always shown, first"
    assert table.parse_columns("title,number,device") == ("title", "number", "device"), "their order is the user's when listed"
    with pytest.raises(table.TableError):
        table.parse_columns("title,phone")


def test_the_cursor_is_bound_to_its_sort_and_validated():
    sort = table.parse_sort("priority:asc,created:desc")
    cur = table.encode_cursor(sort, [2, "2026-10-13T10:00:00Z"], "abcdef0123456789")
    assert table.decode_cursor(cur, sort) == ([2, "2026-10-13T10:00:00Z"], "abcdef0123456789")
    assert table.decode_cursor(None, sort) is None
    with pytest.raises(table.TableError):
        table.decode_cursor(cur, table.parse_sort("number:asc")), "a cursor of another sort is refused (the client starts over)"
    forged = [
        {"s": "priority:asc,created:desc", "v": [2], "i": "abc"},  # wrong length
        {"s": "priority:asc,created:desc", "v": [2, {"x": 1}], "i": "abc"},  # wrong type
        {"s": "priority:asc,created:desc", "v": [2, "x"], "i": "../etc"},  # a bad id
        {"s": "priority:asc,created:desc", "v": [True, "x"], "i": "abc"},
        {"s": "priority:asc,created:desc", "v": [2, "x" * 201], "i": "abc"},
        "not a dict",
    ]
    for doc in forged:
        raw = base64.urlsafe_b64encode(json.dumps(doc).encode()).decode().rstrip("=")
        with pytest.raises(table.TableError):
            table.decode_cursor(raw, sort)
    with pytest.raises(table.TableError):
        table.decode_cursor("%%%not-base64%%%", sort)


def test_a_saved_view_document_uses_the_same_whitelists():
    v = views.normalize({"view": "table", "filters": {"status": "handling", "priority": "urgent"}, "sort": "sla:asc", "columns": ["status", "sla"], "density": "compact"})
    assert v == {"view": "table", "filters": {"scope": "visible", "status": "handling", "priority": ["urgent"]}, "sort": "sla:asc",
                 "columns": ["number", "title", "status", "sla"], "density": "compact"}
    assert views.normalize({})["sort"] == "activity:desc"
    for bad, field in (({"filters": {"status": "x"}}, "view.filters.status"), ({"sort": "phone:asc"}, "view.sort"), ({"columns": ["phone"]}, "view.columns"),
                       ({"density": "huge"}, "view.density"), ({"view": "map"}, "view.view"), ({"script": 1}, "view.script")):
        with pytest.raises(table.TableError) as exc:
            views.normalize(bad)
        assert exc.value.field == field, bad
    stored = {"id": "v1", "name": "x", "view_json": json.dumps({"view": "table", "columns": ["gone_column"], "density": "compact"}), "created_at": "a", "updated_at": "b"}
    assert views.present(stored)["view"]["density"] == "compact", "a stored view a later version cannot read keeps what it can"
    assert views.present(stored)["view"]["columns"] == list(table.DEFAULT_COLUMNS)


def test_the_board_preference_validator():
    assert table_prefs.normalize({}) == {}
    assert table_prefs.normalize({"view": "table", "columns": ["status"], "sort": "number:desc", "density": "compact", "limit": 100, "default_view": "abc123"}) == {
        "view": "table", "columns": ["number", "title", "status"], "sort": "number:desc", "density": "compact", "limit": 100, "default_view": "abc123"}
    assert table_prefs.normalize({"view": None}) == {}
    for bad in ({"view": "map"}, {"columns": "status"}, {"sort": "x:y"}, {"density": "x"}, {"limit": 7}, {"default_view": "a b"}, {"other": 1}, [1], "x"):
        with pytest.raises(ValueError):
            table_prefs.normalize(bad)
