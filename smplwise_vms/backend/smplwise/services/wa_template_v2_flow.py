"""TPLV2-295: the preview -> confirm -> send flow of a WhatsApp `template_send_v2` message, on top of `wa_template_send.TemplateSender`.

OFF by default (`messaging.template_send` {enabled}, edited in Settings by `system.configure`) AND behind the code permit
`intercom_messaging_adapter.TEMPLATE_SEND_SUPPORTED` (False until a real station has answered; only tests open it, against a FAKE).
Owner decision 25.10: NO consent flag - an open conversation window is enough, the version is not held for WisKey's answer. The flow
therefore never reads or sends a consent value. Arx's own opt-out list (a person who asked not to be messaged) is a different rule and
stays in the route.

What the sender SEES vs what WisKey FILLS: Arx names a person (id + observed revision) and a WisKey template (private reference +
observed revision). WisKey fills the {{i}} values from its own person record, so Arx cannot show the message text. The preview shows
exactly what Arx knows - the template's name, language and purpose, the recipient's name, the two revisions - and says so
(`content_shown: false`); the confirmation is bound to that preview by a digest, so a template or person that changed in between is
refused (409) and the sender must look again.

Honest states (`outcome`): `sent` = the provider ACCEPTED it (delivery unknown), `not_sent` = it provably never left Arx,
`refused` = WisKey answered with a closed refusal of this send, `unknown` = handed on, no usable answer: never retried, never shown as
sent and never as failed. An unknown person revision, an unknown window, an unreadable switch are all reported as unknown / closed,
never as a value Arx made up."""
from __future__ import annotations

import datetime as dt
import hashlib
import sqlite3
from dataclasses import dataclass
from typing import Any, Callable

from . import wa_template_send as wts
from . import wa_template_v2_contract as contract

TOKEN_VERSION = "v2p1"


def binding_token(*, tpl: wts.TemplateRef, person_id: str, person_revision: int | None, account: str | None) -> str:
    """A consistency digest of what the preview showed (NOT a secret and not an authorisation): the template (id, name, language,
    WisKey pair), the person (id, observed revision) and the account. The confirmation must carry it back unchanged."""
    parts = (TOKEN_VERSION, tpl.id, tpl.name, tpl.language, tpl.purpose, str(tpl.wiskey_ref), str(tpl.wiskey_revision), person_id,
             str(person_revision), str(account))
    return hashlib.sha256("\x1f".join(parts).encode("utf-8")).hexdigest()[:32]


def blockers(*, switch: bool, permit: bool, tpl: wts.TemplateRef | None, person_revision: int | None, account: str | None) -> list[str]:
    """Why a send would be refused now, in the order the sender checks (a preview-time hint; the sender decides again at send time).
    Empty = nothing known stands in the way (still no promise: WisKey's own checks run after the hand-over)."""
    out: list[str] = []
    if not switch:
        out.append("template_send_off")
    if not permit:
        out.append("template_unsupported")
    if tpl is None:
        out.append("template_not_found")
    elif tpl.wiskey_ref is None or tpl.wiskey_revision is None:
        out.append("template_v2_unbound")
    if person_revision is None:
        out.append("person_revision_unknown")  # UNKNOWN stays unknown: Arx will not invent a revision
    if account is None:
        out.append("account_unavailable")
    return out


class DbPacer:
    """The shared send budget (`wa_pacing`) on SHORT write transactions, so the write gate is NOT held while the transport waits for
    WisKey: `check` and `on_result` each open their own `write_aside`. Same decisions as `messaging_runtime.pacer_on(conn)`."""

    def __init__(self, db: Any) -> None:
        self._db = db

    def check(self, **kw: Any) -> Any:
        from . import messaging_runtime as mr

        with self._db.write_aside() as w:
            return mr.pacer_on(w).check(**kw)

    def on_result(self, **kw: Any) -> Any:
        from . import messaging_runtime as mr

        with self._db.write_aside() as w:
            return mr.pacer_on(w).on_result(**kw)


def pacing_source(db: Any) -> Callable[[str], Any]:
    from . import messaging_runtime as mr

    with db.connection(mode="read", label="template v2 pacing") as conn:
        return mr.pacing_for(conn)


def build_sender(db: Any, *, transport: Any = None, clock: Callable[[], dt.datetime] | None = None) -> wts.TemplateSender:
    """A sender whose switch / registry are read from the settings table at the moment of the call and whose permit is the code
    constant. `transport=None` = the installed v2 provider (the direct join, only while `template_send_v2` is selected)."""

    def switch() -> bool:
        with db.connection(mode="read", label="template v2 switch") as conn:
            return wts.switch_on(conn)

    def registry() -> list[wts.TemplateRef]:
        with db.connection(mode="read", label="template v2 registry") as conn:
            return wts.load_registry(conn)

    kw: dict[str, Any] = {"clock": clock} if clock is not None else {}
    return wts.TemplateSender(transport, registry=registry, switch=switch, permit_fn=wts.permit, pacer=DbPacer(db),
                              pacing_for=pacing_source(db), **kw)


@dataclass(frozen=True)
class Verdict:
    """One send's honest result. `outcome`: sent | not_sent | refused | unknown. `code`: Arx's local code or WisKey's closed code."""
    outcome: str
    code: str | None
    retry_after_s: int | None = None
    answered: bool = False  # a closed v2 result was read (WisKey answered); False = decided locally or no usable answer


def verdict_of(result: wts.TemplateResult) -> Verdict:
    """`sent` only for the provider's acceptance. A local refusal is `not_sent`. A closed WisKey `not_sent` is `refused` (WisKey saw
    and declined it). `unknown` stays `unknown` whatever else is attached - it is never relabelled."""
    if result.outcome == "sent":
        return Verdict("sent", None, answered=True)
    if result.outcome == "unknown":
        return Verdict("unknown", result.code, answered=result.result_version is not None)
    if result.result_version is not None:
        return Verdict("refused", result.code, result.retry_after_s, answered=True)
    return Verdict("not_sent", result.code or result.reason, result.retry_after_s)


def request_ids(client_request_id: str) -> tuple[str, str]:
    """(request_id, operation_id) for one confirmed send. Both derive from the browser's one-attempt id, so a repeat of that id can
    never become a second operation (the attempt record also refuses a repeated id before anything is sent)."""
    return client_request_id, "tplv2-" + client_request_id


def conn_registry(conn: sqlite3.Connection) -> list[wts.TemplateRef]:
    return wts.load_registry(conn)


def status_of(conn: sqlite3.Connection) -> dict[str, Any]:
    """The Settings screen's read: switch, permit, registry (with the WisKey pair shown as bound / unbound), contract status."""
    refs = wts.load_registry(conn)
    return {"enabled": wts.switch_on(conn), "permit": wts.permit(),
            "templates": [{"id": r.id, "name": r.name, "language": r.language, "params": list(r.params), "purpose": r.purpose,
                           "template_ref": r.wiskey_ref, "template_revision": r.wiskey_revision, "bound": r.wiskey_ref is not None} for r in refs],
            "contract": contract.public_state()}
