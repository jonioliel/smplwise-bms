"""PRIVORG-291: the installation's own privacy identity - the organisation NAME (the existing tickets setting `organization_name`) and
the CONTACT POINT for privacy requests (`privacy.contact`: an e-mail address or a phone number) with an optional https `privacy.link`
(tickets settings document, edited with system.configure in the tickets public-page settings card).

Read by the technician privacy notice and the entry-code message (services/access_grants.py) and the phone-verification message
(services/tickets/phone_verify.py). Every value is empty when unset and every reader then keeps today's text unchanged. Nothing here
is legal wording: the fixed texts stay code-owned; this module only supplies the three values that are substituted into them."""
from __future__ import annotations

import sqlite3
from dataclasses import dataclass


@dataclass(frozen=True)
class PrivacyIdentity:
    organization: str = ""
    contact: str = ""
    link: str = ""

    @property
    def any(self) -> bool:
        return bool(self.organization or self.contact or self.link)


def identity(conn: sqlite3.Connection) -> PrivacyIdentity:
    """The three values, each stripped; an unreadable document reads as "not set" (fail safe: the unchanged texts)."""
    try:
        from .tickets import settings_doc

        doc = settings_doc.read(conn)
        privacy = doc.get("privacy") if isinstance(doc.get("privacy"), dict) else {}
        return PrivacyIdentity(organization=str(doc.get("organization_name") or "").strip(), contact=str(privacy.get("contact") or "").strip(),
                               link=str(privacy.get("link") or "").strip())
    except Exception:  # noqa: BLE001 - an installation without the tickets tables / a broken document: nothing is set
        return PrivacyIdentity()
