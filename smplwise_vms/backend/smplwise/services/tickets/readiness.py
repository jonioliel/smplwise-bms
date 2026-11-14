"""CR-038 owner request 2026-10-14: ONE readiness object for sending a ticket outside - what the assign dialog and the "מטפלים וספקים"
page show when something is missing (the owner installed 2.5.0 and found no way to send by WhatsApp, to a vendor or to an employee
without an account, because the dialog hid every option whose prerequisite was missing).

Nothing new is stored: it reads the handler page's state (public_runtime.missing: the add-on option, its listener, the public address,
the module key), the WhatsApp master switch and e-mail fallback of the channel settings (messaging.channel_settings), the account the
`tickets.messages` use resolves to (messaging_accounts.resolve_key on the mapping document - the switch is NOT consulted, so "no
account" and "switch off" are told apart) and how many active directory rows of each kind exist. Booleans and counts only: no
address, number or account value ever leaves here."""
from __future__ import annotations

from typing import Any

from . import store_links

MESSAGES_USE = "tickets.messages"


def account_mapped(conn, department_id: str | None) -> bool:
    """Whether the ticket messages use resolves to a WhatsApp account (for the department when given, else anywhere)."""
    try:
        from .. import messaging_accounts as ma
        from .. import messaging_runtime as mr

        svc = mr.service(conn)
        doc, reg = svc.doc(), svc.registry
        if ma.resolve_key(doc, reg, MESSAGES_USE, department_id=department_id):
            return True
        if department_id:
            return False
        prefix = f"{MESSAGES_USE}{ma.DEPT_SEP}"
        return any(v for k, v in doc.uses.items() if k.startswith(prefix))
    except Exception:  # noqa: BLE001 - a readiness line never fails a request; an unreadable mapping reads as "not mapped"
        return False


def contact_counts(conn) -> dict[str, int]:
    """Active, not erased directory rows by the API kind (employee / vendor / person)."""
    out = {"employee": 0, "vendor": 0, "person": 0}
    for r in store_links.contacts(conn, include_inactive=False, limit=10_000):
        kind = "employee" if r["kind"] == "person" and r.get("employee") else r["kind"]
        out[kind] = out.get(kind, 0) + 1
    return out


def readiness(conn, department_id: str | None = None) -> dict[str, Any]:
    from . import settings_doc
    from . import messaging
    from .public_runtime import RUNTIME

    missing = RUNTIME.missing(conn)  # option | listener | address | key
    cs = messaging.channel_settings(conn)
    try:
        email_ok = messaging.email_configured(conn, messaging.RUNTIME.data_dir)
    except Exception:  # noqa: BLE001
        email_ok = False
    public_page = "option" not in missing and "listener" not in missing
    return {
        "public_page": public_page,
        "public_option": "option" not in missing,
        "base_url": "address" not in missing,
        "module_key": "key" not in missing,
        "public_ready": not missing,
        "public_missing": missing,
        # 2.5.8 review F7: why the stored public address no longer serves (None when it does or was never set)
        "base_url_refused": settings_doc.read(conn)["public"].get("base_url_refused"),
        "master_switch": bool(cs["whatsapp"]["enabled"]),
        "account_mapped": account_mapped(conn, department_id),
        "email_fallback": bool(cs["email_fallback"]),
        "email_configured": bool(email_ok),
        "contacts_count": contact_counts(conn),
    }
