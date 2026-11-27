"""WISKEY-R8-2520 (plan docs/changes/WISKEY-RESYNC-2520.md section 4.2, master ids R2 / C3; owner decisions 25.11): Arx's READER of
the manual service grant v3 that the home-system OWNER gives (or takes back) in WisKey's own screen.

What WisKey 2.0.1-rc.19 offers (PRODUCT 3e7bfc58; contracts `docs/contracts/full-management-v1/service_grants--*_v3.*`, source
`manual_service_grants.py`, `direct_bridge_api.py`, `native_service_write_api.py`, read only):
- `service_grants/read_v3 | preview_v3 | commit_v3 | revoke_v3` - the OWNER's actions, admitted by WisKey only on the classic socket of a
  genuine, current home-system owner (`verify_owner`), reviewed (preview -> commit with `review_id` + `revision` + `confirmed`) and
  backed up. Owner decision 25.11 (all recommendations): they stay in WisKey's own screen (panel tab `tools`, the
  `hikvision-service-authority` card the panel shows to the owner only). Arx never sends them - not here, not on the direct envelope
  (`wiskey_direct_catalog.WISKEY_OWNER_ONLY` refuses them `owner_action_in_wiskey` before any byte), not over the classic socket (no
  caller exists; tests/test_wiskey_service_grants_v3_2520.py scans for it). No self-grant, no revoke over the wire.
- `service_grants/current_v3` - a signed direct READ for the PAIRING SERVICE itself (WisKey `DIRECT_READ_COMMANDS`, empty parameters,
  signed request v2 `wiskey-bridge-command.v2` with the kid; signed reply `wiskey-direct-reply.v2`). It answers the closed
  `ManualGrantServiceRead`: `{format: wiskey-manual-service-grants.v3, revision, status: active | absent_or_revoked, grant}`, where the
  grant is bound by WisKey to the current repository identity, the loaded pairing entry and its KeySet fingerprint (`lookup`). This is
  the ONLY read the add-on identity is allowed, and the only thing this module sends.

What Arx does with it:
- Sends `current_v3` only when ALL hold (else nothing is sent and the reason is reported): the direct join is installed and selects the
  command on its current connection (discovery lists it, the clock admits the window, the pairing is verified - R7), the connection
  is protocol v2 (the contract defines the v2 envelope only), and that connection's `direct/capabilities_v3` offered the
  `manual_service_write` block exactly as rc19 (`wiskey_direct_discovery.MANUAL_SERVICE_WRITE_V3`).
- Reads the answer CLOSED (`read_current`): every key, constant and list exactly as the contract pins it (role `access_manager`, the
  four service commands, the thirteen data fields, no stations / persons scope, `allow_create` true, `expires_at` null). `active`
  must carry a grant and `absent_or_revoked` must carry none. Anything else is `unknown` / `contract_mismatch` and grants nothing.
- A WisKey refusal of the read is reported as `refused` with WisKey's code, and stays final: no other command is tried in its place
  (never `read_v3`, never an older grant source). A lost answer is `unknown`. Neither is ever shown or used as a grant.
- The observation is bound to the connection it was read on and used for at most FRESHNESS_S. It is AUTHORITY ONLY AS WISKEY HOLDS IT:
  WisKey re-checks the grant on every service write (`native_service_write_api.grant` -> `lookup`), so a grant revoked a second ago is
  refused there; Arx's copy only decides whether a v3 write may be attempted at all.
- v3 grants NO cards: `cards/add`, `cards/remove` (and `users/delete`) are not service-write actions and are never selected for this
  path (access_service_writer.select_path).

Status: implemented and tested on fakes only. Live: NOT_MEASURED (the lab runs WisKey rc10, where the direct connection is v1 and the
v3 block is absent: every read answers `unsupported` and sends nothing)."""
from __future__ import annotations

import logging
import re
import threading
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Callable, Mapping

from ..test_reset import register_reset
from .wiskey_service_write import COMMANDS as SERVICE_COMMANDS
from .wiskey_service_write import DATA_FIELDS, MAX_REVISION, ROLE, GrantRef

log = logging.getLogger("smplwise.wiskey_service_grants_v3")

COMMAND = "service_grants/current_v3"  # the ONE command this module sends
FORMAT = "wiskey-manual-service-grants.v3"
CONTRACT = "wiskey-native-service-write.v3"  # the `service_write.contract` of a write under this grant
STATUSES = ("active", "absent_or_revoked")
GRANT_COMMANDS: tuple[str, ...] = tuple(sorted(SERVICE_COMMANDS))
GRANT_FIELDS: tuple[str, ...] = tuple(sorted(DATA_FIELDS))
_DOC_KEYS = frozenset({"format", "revision", "status", "grant"})
_GRANT_KEYS = frozenset({"authority_ref", "authority_revision", "scope_ref", "grant_id", "grant_revision", "permission_revision", "role",
                         "commands", "fields", "stations", "user_ids", "allow_create", "expires_at"})
_REF_RE = re.compile(r"^[^\x00-\x1f\x7f]{1,128}$")
_CODE_RE = re.compile(r"^[A-Za-z0-9_.:-]{1,96}$")
READ_TIMEOUT_S = 6.0
FRESHNESS_S = 60.0  # an observation older than this is read again before it is used (it renews nothing)
# Where the owner grants or revokes: WisKey's embedded panel, management tools page (owner only). Never an Arx action.
OWNER_SCREEN_TAB = "tools"
# Observation states. `active` / `absent_or_revoked` are WisKey's own answer; the others say why there is no answer.
STATES = ("active", "absent_or_revoked", "refused", "unknown", "unsupported", "unavailable")

# What the owner sees (Hebrew first; English copy beside it). No platform name: the panel is WisKey's screen.
TEXTS: dict[str, dict[str, str]] = {
    "active": {
        "he": "בעל המערכת אישר ב-WisKey ארבע פעולות שירות על אנשים: יצירה, עדכון, הפקת קוד וביטול זמני. כרטיסים אינם כלולים. "
              "ביטול ההרשאה נעשה רק במסך הכלים של WisKey.",
        "en": "The system owner approved four service actions on people in WisKey: create, update, generate a code and temporary cancel. "
              "Cards are not included. The approval is withdrawn only in WisKey's tools screen.",
    },
    "absent_or_revoked": {
        "he": "אין הרשאת שירות פעילה מבעל המערכת. מתן ההרשאה וביטולה נעשים רק על ידי בעל המערכת, במסך הכלים של WisKey.",
        "en": "There is no active service approval from the system owner. Only the system owner gives or withdraws it, in WisKey's tools screen.",
    },
    "refused": {
        "he": "WisKey סירב לקריאת הרשאת השירות. לא נשלחה במקומה בקשה אחרת, ולא מניחים שיש הרשאה.",
        "en": "WisKey refused the service approval read. No other request was sent instead, and no approval is assumed.",
    },
    "unknown": {
        "he": "מצב הרשאת השירות לא ידוע: התשובה לא התקבלה או לא תאמה לחוזה. לא מניחים שיש הרשאה.",
        "en": "The service approval is unknown: no answer arrived, or it did not match the contract. No approval is assumed.",
    },
    "unsupported": {
        "he": "WisKey המחובר אינו מציע קריאה של הרשאת שירות מסוג זה. לא נשלחה בקשה.",
        "en": "The connected WisKey does not offer this service approval read. Nothing was sent.",
    },
    "unavailable": {
        "he": "החיבור הישיר ל-WisKey אינו זמין כרגע, ולכן ההרשאה לא נקראה. לא נשלחה בקשה.",
        "en": "The direct connection to WisKey is not available now, so the approval was not read. Nothing was sent.",
    },
}
# R2 / WisKey `disabled_card`: a card marked off centrally is REMOVED from the station only after sync + readback; never "disabled on the
# station", and no promise that it stops opening before that (or while the station is offline). The wording for the people screens.
CARD_OFF_TEXT: dict[str, str] = {
    "he": "הכרטיס סומן כלא פעיל במרכז. הוא יוסר מהעמדה רק אחרי סנכרון ובדיקה חוזרת; עד אז, או כשהעמדה מנותקת, ייתכן שהעמדה עדיין תקבל אותו.",
    "en": "The card is marked inactive centrally. It is removed from the station only after sync and readback; until then, or while the "
          "station is offline, the station may still accept it.",
}


class GrantsV3Error(Exception):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def _ref(v: Any) -> bool:
    return isinstance(v, str) and _REF_RE.fullmatch(v) is not None


def _rev(v: Any, low: int = 1) -> bool:
    return type(v) is int and low <= v <= MAX_REVISION


@dataclass(frozen=True)
class GrantDocument:
    """One closed `ManualGrantServiceRead` answer."""

    revision: int
    status: str  # active | absent_or_revoked
    grant: GrantRef | None  # set exactly when status == active


def _read_grant(raw: Any) -> GrantRef:
    if not isinstance(raw, Mapping) or set(raw) != _GRANT_KEYS:
        raise GrantsV3Error("contract_mismatch")
    if (raw["role"] != ROLE or not isinstance(raw["commands"], list) or tuple(raw["commands"]) != GRANT_COMMANDS
            or not isinstance(raw["fields"], list) or tuple(raw["fields"]) != GRANT_FIELDS
            or raw["stations"] != [] or not isinstance(raw["stations"], list) or raw["user_ids"] != [] or not isinstance(raw["user_ids"], list)
            or raw["allow_create"] is not True or raw["expires_at"] is not None):
        raise GrantsV3Error("contract_mismatch")
    if not all(_ref(raw[k]) for k in ("authority_ref", "scope_ref", "grant_id")):
        raise GrantsV3Error("contract_mismatch")
    if not all(_rev(raw[k]) for k in ("authority_revision", "grant_revision", "permission_revision")):
        raise GrantsV3Error("contract_mismatch")
    ref = GrantRef(raw["authority_ref"], raw["authority_revision"], raw["scope_ref"], raw["grant_id"], raw["grant_revision"],
                   raw["permission_revision"])
    if not ref.valid():
        raise GrantsV3Error("contract_mismatch")
    return ref


def read_current(raw: Any) -> GrantDocument:
    """The closed `service_grants/current_v3` result, or GrantsV3Error(`contract_mismatch`). Never guesses a missing value."""
    try:
        if not isinstance(raw, Mapping) or set(raw) != _DOC_KEYS or raw["format"] != FORMAT or not _rev(raw["revision"], 0):
            raise GrantsV3Error("contract_mismatch")
        status = raw["status"]
        if not isinstance(status, str) or status not in STATUSES:
            raise GrantsV3Error("contract_mismatch")
        if status == "active":
            return GrantDocument(raw["revision"], status, _read_grant(raw["grant"]))
        if raw["grant"] is not None:  # WisKey never reports a grant for an absent / revoked one: such a document is not read
            raise GrantsV3Error("contract_mismatch")
        return GrantDocument(raw["revision"], status, None)
    except (TypeError, KeyError, AttributeError):
        raise GrantsV3Error("contract_mismatch") from None


@dataclass(frozen=True)
class GrantObservation:
    """What Arx last learned about its v3 grant (or why it learned nothing). `grant` only for `active`."""

    state: str
    reason: str | None = None
    wiskey_code: str | None = None
    connection_ref: str | None = None
    revision: int | None = None
    grant: GrantRef | None = None
    observed_at: float | None = None  # local monotonic
    fetched_at: str | None = None  # UTC, for the screen
    sent: bool = False  # whether this observation sent the read


def _safe_code(code: Any) -> str:
    text = str(code or "")[:96]
    return text if _CODE_RE.fullmatch(text) else "unrecognised"


def _utc() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _default_join() -> Any:
    from . import wiskey_direct_join

    return wiskey_direct_join.installed()


class ManualGrantSource:
    """The process's reader of `service_grants/current_v3`. `refresh()` makes at most one read; `current_grant()` answers the GrantRef
    of a fresh `active` observation of the CURRENT connection (reading once when there is no fresh observation), else None."""

    def __init__(self, join: Callable[[], Any] = _default_join, *, mono: Callable[[], float] = time.monotonic,
                 freshness_s: float = FRESHNESS_S) -> None:
        self._join = join
        self._mono = mono
        self.freshness_s = freshness_s
        self._lock = threading.Lock()
        self._last: GrantObservation | None = None

    def last(self) -> GrantObservation | None:
        return self._last

    def forget(self) -> None:
        with self._lock:
            self._last = None

    @staticmethod
    def _link(join: Any) -> Any:
        try:
            link = join.session._link
        except AttributeError:
            return None
        return None if link is None or getattr(link, "closed", True) else link

    def _precondition(self, join: Any) -> GrantObservation | None:
        """None when the read may be sent now, else the observation that says why nothing is sent."""
        from . import wiskey_direct_catalog as catalog

        if join is None:
            return GrantObservation("unavailable", "direct_not_installed")
        if catalog.direct_refusal(COMMAND) is not None:  # defensive: the READ is never one of the owner-only commands
            return GrantObservation("unsupported", catalog.direct_refusal(COMMAND))
        try:
            selected = bool(join.selected(COMMAND))
        except Exception:  # noqa: BLE001 - cannot tell = not selected
            selected = False
        link = self._link(join)
        if not selected or link is None:
            reason = None
            try:
                reason = join.session.transport_refusal(COMMAND)
            except Exception:  # noqa: BLE001
                reason = None
            reason = reason or "direct_not_selected"
            return GrantObservation("unsupported" if reason in ("command_not_discovered", "owner_action_in_wiskey") else "unavailable",
                                    _safe_code(reason))
        if getattr(link, "protocol_version", 1) != 2:
            return GrantObservation("unsupported", "v3_needs_direct_v2")
        try:
            cap = join.session.discovery.capabilities
        except AttributeError:
            cap = None
        if cap is None or getattr(cap, "connection_ref", None) != link.connection_ref:
            return GrantObservation("unavailable", "discovery_missing")
        if getattr(cap, "manual_service_write_v3", False) is not True:
            return GrantObservation("unsupported", "manual_v3_not_offered")
        return None

    def refresh(self) -> GrantObservation:
        """One read of `service_grants/current_v3` (or none, with the reason). Never raises; never sends any other command."""
        with self._lock:
            obs = self._refresh_locked()
            self._last = obs
            return obs

    def observe(self) -> GrantObservation:
        """LOWS-BRIDGE-GATE-2550 (deep review 2.52 WB-05): the status screen's answer. A fresh observation of the CURRENT connection that
        really sent the read (`sent`) is answered as it is - the same FRESHNESS_S the writes already rely on (`current_grant`) - so a
        page that polls, or two administrators, no longer send one signed WisKey read per request, each behind the other under the
        lock. Anything else (no observation, a stale one, another connection, or one that sent nothing - those cost no read) is read
        again; a caller that waited for the lock takes the observation the call ahead of it just made."""
        try:
            join = self._join()
        except Exception:  # noqa: BLE001
            join = None
        obs = self._last
        if obs is not None and obs.sent and self._fresh(obs, join):
            return obs
        with self._lock:
            obs = self._last
            if obs is not None and obs.sent and self._fresh(obs, join):
                return obs
            obs = self._refresh_locked()
            self._last = obs
            return obs

    def _refresh_locked(self) -> GrantObservation:
        from .wiskey_capture_port import PortError

        try:
            join = self._join()
        except Exception:  # noqa: BLE001
            join = None
        blocked = self._precondition(join)
        if blocked is not None:
            return GrantObservation(blocked.state, blocked.reason, observed_at=self._mono(), fetched_at=_utc())
        ref = self._link(join).connection_ref
        at, stamp = self._mono(), _utc()
        try:
            raw = join.capture_port.call(COMMAND, {}, timeout_s=READ_TIMEOUT_S)
        except PortError as exc:
            if exc.outcome == "refused":  # a VERIFIED refusal: final, reported as WisKey's code, never followed by another command
                return GrantObservation("refused", "wiskey_refused", _safe_code(exc.code), ref, observed_at=at, fetched_at=stamp, sent=True)
            if exc.outcome == "not_sent":
                return GrantObservation("unavailable", _safe_code(exc.code), connection_ref=ref, observed_at=at, fetched_at=stamp)
            return GrantObservation("unknown", _safe_code(exc.code), connection_ref=ref, observed_at=at, fetched_at=stamp, sent=True)
        except Exception as exc:  # noqa: BLE001 - after a possible hand-over: unknown
            return GrantObservation("unknown", _safe_code(type(exc).__name__), connection_ref=ref, observed_at=at, fetched_at=stamp, sent=True)
        now_link = self._link(join)
        if now_link is None or now_link.connection_ref != ref:  # the answer belongs to a connection that is gone: never used
            return GrantObservation("unknown", "connection_changed", connection_ref=ref, observed_at=at, fetched_at=stamp, sent=True)
        try:
            doc = read_current(raw)
        except GrantsV3Error as exc:
            log.warning("wiskey service grant v3: the answer did not match the contract (%s); no grant is assumed", exc.code)
            return GrantObservation("unknown", exc.code, connection_ref=ref, observed_at=at, fetched_at=stamp, sent=True)
        return GrantObservation(doc.status, None, None, ref, doc.revision, doc.grant, at, stamp, True)

    def _fresh(self, obs: GrantObservation | None, join: Any) -> bool:
        if obs is None or obs.observed_at is None or self._mono() - obs.observed_at >= self.freshness_s:
            return False
        link = self._link(join) if join is not None else None
        return obs.connection_ref is None or (link is not None and link.connection_ref == obs.connection_ref)

    def current_grant(self) -> GrantRef | None:
        """The GrantRef WisKey reported for THIS pairing on the CURRENT connection, while fresh - else None (no grant, no self-grant).
        Reads once when the last observation is stale or belongs to another connection; any observation (also a refusal) is kept for
        FRESHNESS_S, so a refusal is not re-asked on every write."""
        try:
            join = self._join()
        except Exception:  # noqa: BLE001
            return None
        obs = self._last
        if not self._fresh(obs, join):
            obs = self.refresh()
        if obs.state != "active" or obs.grant is None:
            return None
        link = self._link(join)
        if link is None or link.connection_ref != obs.connection_ref:
            return None
        return obs.grant

    def actor_id(self) -> str | None:
        """The `arx-service:<entry>` subject of the current direct connection (WisKey checks `service_write.actor_id` against it)."""
        try:
            join = self._join()
            return join.capture_port.identity().query_owner_id if join is not None else None
        except Exception:  # noqa: BLE001
            return None


def view(obs: GrantObservation | None) -> dict[str, Any]:
    """The screen's answer: what WisKey reported (or why nothing was read), what it allows, and where the owner acts. Never a grant
    reference, never a key. `cards_granted` is always False (v3 grants no cards)."""
    if obs is None:
        obs = GrantObservation("unknown", "not_read")
    active = obs.state == "active" and obs.grant is not None
    text = TEXTS.get(obs.state, TEXTS["unknown"])
    return {
        "state": obs.state,
        "reason": obs.reason,
        "wiskey_code": obs.wiskey_code,
        "revision": obs.revision,
        "fetched_at": obs.fetched_at,
        "contract": CONTRACT,
        "commands": list(GRANT_COMMANDS) if active else [],
        "cards_granted": False,
        "owner_actions_in": "wiskey_owner_screen",
        "owner_screen_tab": OWNER_SCREEN_TAB,
        "message_he": text["he"],
        "message_en": text["en"],
        "card_off_he": CARD_OFF_TEXT["he"],
        "card_off_en": CARD_OFF_TEXT["en"],
    }


SOURCE = ManualGrantSource()


def _reset_for_tests() -> None:
    SOURCE.forget()


register_reset(__name__, ("SOURCE",), _reset_for_tests)
