"""What the access-control router shares with the service layer (CR-SPLIT-ACCESS-CONTROL-2440; review 05:P2-09, 05:P2-07).

The person draft models (`PersonData`, `CardData`: mirrors of WisKey's USER_FIELDS / CARD_FIELDS, extra keys forbidden) lived in
routers/access_control.py and were imported back from there by services/bulk_people.py; they are moved here unchanged and the
router re-exports them. The router's own SQL statements sit here too, behind named functions (same text, same parameters)."""
from __future__ import annotations

import re
import sqlite3
from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, StrictBool, StrictInt, model_validator

from ..db import now_iso
from . import intercom_writes as iw
from .timeutil import parse_utc


IDENTIFIER = r"^[A-Za-z0-9_-]{1,32}$"  # WisKey validate_identifier / validate_card (client/access.py)
PIN_PATTERN = r"^[0-9]{1,128}$"  # models.py build_user
PHONE = re.compile(r"^\+?[0-9 ()-]+$")  # models.py phone_value, 7-15 digits
UUID_TEXT = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")  # uuid_text: canonical form
MAX_CARDS = 255
MAX_ASSIGNMENTS = 100
PERIOD_MIN = datetime(1970, 1, 1, tzinfo=timezone.utc)  # valid_period bounds
PERIOD_MAX = datetime(2037, 12, 31, 23, 59, 59, tzinfo=timezone.utc)
PERSON = "intercom_person"


def _no_control(value: str) -> bool:
    return not any(ord(c) < 32 for c in value)


class CardData(BaseModel):
    """One card of the draft (WisKey CARD_FIELDS): a saved card by `id` (its stored number is kept - the browser never
    has it) or a new card by `card_no`, never both."""

    model_config = ConfigDict(extra="forbid")
    id: str | None = None
    card_no: str | None = Field(None, pattern=IDENTIFIER)
    label: str = Field("", max_length=64)
    card_type: Literal["normalCard"] = "normalCard"
    enabled: StrictBool = True

    @model_validator(mode="after")
    def _one_identity(self) -> "CardData":
        if (self.id is None) == (self.card_no is None):
            raise ValueError("a card is either a saved one by id or a new one by card_no")
        if self.id is not None and not UUID_TEXT.fullmatch(self.id):
            raise ValueError("card id")
        if not _no_control(self.label):
            raise ValueError("label")
        return self


def _station_key(key: str) -> bool:
    return 1 <= len(key) <= 64 and _no_control(key)


class PersonData(BaseModel):
    """The draft, as a patch: only the keys present are sent to WisKey (`users/update` keeps the rest). Mirrors WisKey's
    USER_FIELDS for what this slice edits; `profile`, `group_ids`, `photo`, `access_timing_*`, `user_type` are not
    accepted (extra keys are refused locally).

    Station access travels as WisKey's own editor sends it (panel.ts save(): `permission_overrides` + `door_permissions`
    + `access_policy_revision`), NEVER as the legacy absolute `assignments`: in WisKey's `group_permissions.prepare` an
    already-allowed station keeps its previous `allowed_locks` unless `door_permissions` names it, so a relay removed
    from an existing assignment would be silently kept (review B1). `door_permissions` lists the ENABLED stations with
    their relays; `permission_overrides` the personal allow / deny per station (a station granted by a group and left
    alone has none). `access_policy_revision` is the profile policy revision the editor loaded, when WisKey has one, so
    WisKey's `group_policy_changed` check applies."""

    model_config = ConfigDict(extra="forbid")
    employee_no: str | None = Field(None, pattern=IDENTIFIER)
    display_name: str | None = Field(None, min_length=1, max_length=32)
    phone: str | None = Field(None, max_length=32)
    active: StrictBool | None = None
    valid_from: str | None = Field(None, max_length=40)
    valid_until: str | None = Field(None, max_length=40)
    pin: str | None = Field(None, pattern=PIN_PATTERN)  # present and null = remove the PIN (WisKey: `pin: null`)
    cards: list[CardData] | None = Field(None, max_length=MAX_CARDS)
    permission_overrides: dict[str, Literal["allow", "deny"]] | None = None
    door_permissions: dict[str, list[StrictInt]] | None = None
    access_policy_revision: StrictInt | None = Field(None, ge=0)
    # CR-036 S11: the access category with its responsible person and purpose (a visitor / contractor needs both a responsible
    # person and an end date - WisKey's `guest_responsible_required` / `invalid_validity`), and the timing: the proposal
    # (`access_timing_draft`, never a grant) and the enforced policy (`access_timing_policy`: `ha` = Arx's own enforcement
    # through WisKey's rolling validity window, `native` = the device's own schedule with per-station slot bindings). Present
    # and null clears it. Both are validated exactly as WisKey validates them (services/intercom_writes.py).
    access_category: Literal["staff", "visitor", "contractor"] | None = None
    responsible_person: str | None = Field(None, max_length=64)
    access_purpose: str | None = Field(None, max_length=128)
    access_timing_draft: dict[str, Any] | None = None
    access_timing_policy: dict[str, Any] | None = None

    @model_validator(mode="after")
    def _rules(self) -> "PersonData":
        if self.display_name is not None and (not self.display_name.strip() or not _no_control(self.display_name)):
            raise ValueError("display_name")
        for text in (self.responsible_person, self.access_purpose):
            if text is not None and not _no_control(text):
                raise ValueError("text")
        if "access_category" in self.model_fields_set and self.access_category is None:
            raise ValueError("access_category")  # WisKey always has one: it can be changed, never removed
        try:
            if "access_timing_draft" in self.model_fields_set:
                self.access_timing_draft = iw.timing_draft(self.access_timing_draft)
            if "access_timing_policy" in self.model_fields_set:
                self.access_timing_policy = iw.timing_policy(self.access_timing_policy)
        except ValueError as exc:
            raise ValueError(f"timing: {exc}") from None
        if self.phone and (not PHONE.fullmatch(self.phone) or not 7 <= len(re.sub(r"[^0-9]", "", self.phone)) <= 15):
            raise ValueError("phone")
        if ("valid_from" in self.model_fields_set) != ("valid_until" in self.model_fields_set) or (self.valid_from is None) != (self.valid_until is None):
            raise ValueError("valid_from and valid_until go together")
        if self.valid_from is not None and self.valid_until is not None:
            try:
                start, end = parse_utc(self.valid_from), parse_utc(self.valid_until)
            except ValueError:
                raise ValueError("validity") from None
            if not PERIOD_MIN <= start < end <= PERIOD_MAX:
                raise ValueError("validity")
        if self.cards is not None:
            new = [c.card_no for c in self.cards if c.card_no is not None]
            ids = [c.id for c in self.cards if c.id is not None]
            if len(set(new)) != len(new) or len(set(ids)) != len(ids):
                raise ValueError("duplicate card")
        if (self.permission_overrides is None) != (self.door_permissions is None):
            raise ValueError("permission_overrides and door_permissions go together")
        if self.permission_overrides is not None and (len(self.permission_overrides) > MAX_ASSIGNMENTS or any(not _station_key(k) for k in self.permission_overrides)):
            raise ValueError("permission_overrides")
        if self.door_permissions is not None:
            if len(self.door_permissions) > MAX_ASSIGNMENTS or any(not _station_key(k) for k in self.door_permissions):
                raise ValueError("door_permissions")
            for locks in self.door_permissions.values():  # group_permissions.prepare: non-empty, within {1, 2}, distinct
                if not locks or any(lock not in (1, 2) for lock in locks) or len(set(locks)) != len(locks):
                    raise ValueError("door_permissions")
            if any(self.permission_overrides.get(k) == "deny" for k in self.door_permissions):  # type: ignore[union-attr]
                raise ValueError("a denied station cannot carry relays")
        return self

    def wiskey(self) -> dict[str, Any]:
        """The `data` dict for WisKey: exactly the keys the draft set, in WisKey's shapes."""
        out: dict[str, Any] = {}
        for key in ("employee_no", "display_name", "phone", "active", "valid_from", "valid_until", "pin",
                    "access_category", "responsible_person", "access_purpose", "access_timing_draft", "access_timing_policy"):
            if key in self.model_fields_set:
                out[key] = getattr(self, key)
        if self.cards is not None:
            out["cards"] = [
                {**({"id": c.id} if c.id is not None else {"card_no": c.card_no}), "label": c.label, "card_type": c.card_type, "enabled": c.enabled}
                for c in self.cards
            ]
        if self.permission_overrides is not None and self.door_permissions is not None:
            out["permission_overrides"] = dict(self.permission_overrides)
            out["door_permissions"] = {sid: sorted(locks) for sid, locks in self.door_permissions.items()}
        if self.access_policy_revision is not None:
            out["access_policy_revision"] = self.access_policy_revision
        return out


# ---------------------------------------------------------------- the router's SQL (review 05:P2-07), statements unchanged

def command_already_sent(conn: sqlite3.Connection, action: str, user_id: str, since: str, client_request_id: str) -> bool:
    """The duplicate check of the command envelope: an attempt row of the same caller, action and `client_request_id` since
    `since` (the attempt rows are the durable record; the id is matched inside the audit JSON, so it carries no LIKE wildcard)."""
    seen = conn.execute(
        "SELECT 1 FROM audit_log WHERE action = ? AND actor_user_id = ? AND at >= ? AND details_json LIKE ? AND details_json LIKE ? LIMIT 1",
        (action, user_id, since, f'%"client_request_id": "{client_request_id}"%', '%"phase": "attempt"%'),
    ).fetchone()
    return bool(seen)


def tile_action_id(conn: sqlite3.Connection, user_id: str, client_request_id: str) -> str | None:
    """The devices tile's `ha_actions` row of this caller and `client_request_id`, if there is one (a duplicate click)."""
    existing = conn.execute("SELECT id FROM ha_actions WHERE principal_user_id = ? AND client_request_id = ?", (user_id, client_request_id)).fetchone()
    return existing["id"] if existing else None


def tile_action_pending(w: sqlite3.Connection, aid: str, entity_id: str, action_id: str, user_id: str, username: str, client_request_id: str, via: str) -> None:
    """The pending `ha_actions` row of a door opened from a tile: no arguments, no expected state."""
    w.execute(
        "INSERT INTO ha_actions(id, entity_id, action_id, arguments_json, principal_user_id, principal_username, client_request_id, status, requested_at, expected_state, via) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        (aid, entity_id, action_id, "{}", user_id, username, client_request_id, "pending", now_iso(), None, via),
    )


def tile_action_answer(w: sqlite3.Connection, aid: str, status: str, error: str | None) -> None:
    """The answer of a tile's door action; `confirmed_at` is set only by a `confirmed` status."""
    w.execute("UPDATE ha_actions SET status = ?, error = ?, responded_at = ?, confirmed_at = CASE WHEN ? = 'confirmed' THEN ? ELSE confirmed_at END WHERE id = ?",
              (status, error, now_iso(), status, now_iso(), aid))
