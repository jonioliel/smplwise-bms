"""CR-TK-EXCEPT-LOG (code review 2026-11-13, 01:F-11): the broad handlers of seven tickets modules keep their defaults, catch only
what they are there for (where the cause is known) and say so in the log (everywhere else).

Each test pins both halves of one site: the documented failure still gives the old default, and - where the type was narrowed - an
error of another kind is no longer swallowed. Unit tests on a bare in-memory database (no table at all = "a database before the
migrations"); no key, number or token is used. Every value here is invented."""
from __future__ import annotations

import logging
import sqlite3
from types import SimpleNamespace

import pytest

from smplwise.services.tickets import budgets, code_flow, contact_reports, create, settings_doc, vendor_portal
from smplwise.services.tickets.module_key import ModuleKeyError


@pytest.fixture()
def bare():
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    yield conn
    conn.close()


@pytest.fixture()
def with_settings(bare):
    bare.execute("CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT)")
    return bare


# ---------------------------------------------------------------- vendor_portal: the four switches

def test_portal_switches_fail_closed_without_a_database(bare):
    assert vendor_portal.enabled(bare) is False
    assert vendor_portal.closed_months(bare) == 2
    assert vendor_portal.require_confirmed(bare) is True
    assert vendor_portal.start_worker(bare) is False


def test_portal_switches_read_the_document(with_settings):
    conn = with_settings
    doc = settings_doc.read(conn)["vendor_portal"]
    assert vendor_portal.closed_months(conn) == int(doc["closed_months"])
    assert vendor_portal.require_confirmed(conn) is bool(doc["require_confirmed_number"])
    assert vendor_portal.start_worker(conn) is bool(doc["start_worker"])
    assert vendor_portal.enabled(conn) is False  # the module switch is off (no row)
    conn.execute("INSERT INTO settings VALUES ('tickets.enabled', 'true')")
    assert vendor_portal.enabled(conn) is bool(doc["enabled"])


def test_portal_switch_no_longer_hides_a_programming_error(with_settings, monkeypatch):
    def broken(_conn):
        raise TypeError("a bug, not a database state")

    monkeypatch.setattr(vendor_portal.settings_doc, "read", broken)
    for reader in (vendor_portal.closed_months, vendor_portal.require_confirmed, vendor_portal.start_worker):
        with pytest.raises(TypeError):
            reader(with_settings)


def test_portal_setting_default_is_logged(bare, caplog):
    caplog.set_level(logging.DEBUG, logger="smplwise.tickets.vendor_portal")
    assert vendor_portal.closed_months(bare) == 2
    assert any("closed_months" in r.getMessage() and r.exc_info for r in caplog.records)


# ---------------------------------------------------------------- vendor_portal: the key

class _Keys:
    def __init__(self, exc: Exception) -> None:
        self.exc = exc

    def current(self, *, create: bool = False):
        raise self.exc

    def get(self, key_id=None):
        raise self.exc


@pytest.mark.parametrize("exc", [ModuleKeyError("no key yet"), PermissionError("unreadable key file")])
def test_a_key_failure_is_the_fail_closed_answer(monkeypatch, exc):
    monkeypatch.setattr(vendor_portal, "KEYS", _Keys(exc))
    assert vendor_portal.number_key("972500000000") is None


def test_another_failure_of_the_key_store_is_not_hidden(monkeypatch):
    monkeypatch.setattr(vendor_portal, "KEYS", _Keys(RuntimeError("a bug")))
    with pytest.raises(RuntimeError):
        vendor_portal.number_key("972500000000")


def test_derive_for_outbox_without_the_table(bare):
    assert vendor_portal.derive_for_outbox(bare, "not-a-link-id", "c1") is None
    vid = "0" * 32
    if vendor_portal.codes_mod.is_link_id(vid):  # the id shape passes: the read itself meets a database before 0105
        assert vendor_portal.derive_for_outbox(bare, vid, "c1") is None


# ---------------------------------------------------------------- budgets

def test_scope_label_without_the_place_tables(bare):
    assert budgets.scope_label(bare, {"scope_kind": "site", "scope_id": "s1"}) == ""
    assert budgets.scope_label(bare, {"scope_kind": "building", "scope_id": "b1"}) == ""
    bare.execute("CREATE TABLE sites (id TEXT, name TEXT)")
    bare.execute("INSERT INTO sites VALUES ('s1', 'North')")
    assert budgets.scope_label(bare, {"scope_kind": "site", "scope_id": "s1"}) == "North"


# ---------------------------------------------------------------- code_flow / contact_reports / create: logged, same answer

class _Dispatch:
    def code_ready(self, conn, contact):
        raise RuntimeError("the dispatcher cannot answer")


def test_channel_recheck_failure_is_refused_and_logged(caplog):
    caplog.set_level(logging.WARNING, logger="smplwise.tickets.codes")
    assert code_flow.channel_still_allowed(None, {"phone_e164": "x"}, "whatsapp", link_sent_via="manual", dispatch=_Dispatch()) is False
    assert any("re-check failed (RuntimeError)" in r.getMessage() for r in caplog.records)


class _Provider:
    def still_relevant(self, conn, row):
        raise KeyError("gone")

    def outcome(self, conn, row):
        raise ValueError("mirror failed")


def test_report_provider_failures_are_logged_with_their_type(monkeypatch, caplog):
    caplog.set_level(logging.WARNING, logger="smplwise.tickets.reports")
    monkeypatch.setitem(contact_reports.PROVIDERS, "unit_test_module", _Provider())
    row = SimpleNamespace(source_module="unit_test_module", document_id=None, state="sent", updated_at=None)
    assert contact_reports.still_relevant(None, row) is False
    contact_reports.on_outcome(None, row)  # never raises
    text = "\n".join(r.getMessage() for r in caplog.records)
    assert "relevance check failed module=unit_test_module (KeyError)" in text
    assert "outcome hook failed module=unit_test_module (ValueError)" in text
    assert "gone" not in text and "mirror failed" not in text, "the type only: an exception text may carry a value"


def test_partner_hook_never_breaks_a_new_ticket_and_is_logged(monkeypatch, caplog):
    from smplwise.services.partner import webhooks

    def broken(conn, ticket_id):
        raise RuntimeError("queue write failed")

    monkeypatch.setattr(webhooks, "on_ticket_created", broken)
    caplog.set_level(logging.WARNING, logger="smplwise.tickets.create")
    create._partner_hook(None, "t-1")
    assert any("partner webhook hook failed" in r.getMessage() and "(RuntimeError)" in r.getMessage() for r in caplog.records)
