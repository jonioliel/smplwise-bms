"""ECCACT-295 (directive item 1): the live transport for WisKey's person readback, with capability negotiation.

What it is
- `LiveReadback` sends WisKey's candidate reads `users/access_state_v2` / `users/access_state` / `schedules/normalize_user` over the
  feed's own session on the `readback` channel (services/wiskey_channels.py: three reads, no write), through the same rate limits, slot
  and timeout rules as every other adapter read (`intercom_sync.SYNC.command`).
- The version is NEGOTIATED from WisKey's own `overview.api` (`commands` AND `capabilities`, `wiskey_access_state.negotiate`): v2 is
  preferred; v1 is only a compatibility read that never proves a revocation; a WisKey that lists neither pair leaves the question
  UNKNOWN. Nothing is guessed from a version number and nothing is retried: a failed or timed-out read is simply UNKNOWN (None) and the
  caller (the revoke worker) asks again on its next pass, bound to the then-current revision.
- `access_state(user_id, revision)` returns `(result, schema)`: the raw `result` dict and the schema the command that was SENT
  promises, so the single strict parser (`wiskey_access_state.parse_result(..., expect=schema)`) refuses an answer of the other version
  (no silent v2 -> v1 fallback). It is the `AccessStateReader` of `access_grant_engine.revocation_pending_from`.

What it is not
- No write, no HA user / token handling: the identity is the add-on's existing service session. WisKey admits these commands only for
  an active administrator while its own build gate is on (arx_readback_api.authorize); whether the add-on's identity is one is an
  OPERATIONAL fact that this module reports as `forbidden` (WisKey `unauthorized`) and never works around.

The switch gate (review 3 G-01, owner decision 2026-10-21: the `wiskey.acr5_*` switches GATE the readback)
- `gate(key)` is asked right before anything is sent - the overview negotiation included - on every read: `access_state` needs
  `acr5_01` (`wiskey.acr5_access_state`), `normalize_user` needs `acr5_02` (`wiskey.acr5_normalize_user`). The product reader
  (`access_grants.engine_for`) passes `wiskey_acr5.consumer_on` (the switch AND the permit) read fresh from the database; a closed
  gate, or a gate that fails, is `ReadbackUnavailable("consumer_off")` = UNKNOWN, so a revoke stays `revoking`. Both switches default
  OFF. `gate=None` (no switch) is for unit tests of the transport only."""
from __future__ import annotations

import threading
import time
from typing import Any, Callable

from . import intercom_adapter, intercom_client, intercom_sync
from . import wiskey_access_state as was

WHO = "system:wiskey_readback"
CHANNEL = "readback"
NEGOTIATION_TTL_S = 30.0  # how long a negotiated answer is reused; WisKey's lists change only with a build / flag change


class ReadbackUnavailable(Exception):
    """No usable readback: the session is not ready, WisKey lists no usable pair, refused, timed out or answered off-contract.
    `code` is closed text for logs; the caller maps every one of them to UNKNOWN."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def project_api_lists(raw: Any) -> dict[str, Any]:
    """The overview's `api` block reduced to the two lists negotiation needs. A missing / mistyped list stays None (not listed)."""
    api = raw.get("api") if isinstance(raw, dict) and isinstance(raw.get("api"), dict) else {}

    def strings(value: Any) -> list[str] | None:
        return [v for v in value] if isinstance(value, list) and all(isinstance(v, str) for v in value) else None

    return {"commands": strings(api.get("commands")), "capabilities": strings(api.get("capabilities"))}


GATE_ACCESS_STATE = "acr5_01"  # wiskey_acr5.FLAGS: wiskey.acr5_access_state
GATE_NORMALIZE = "acr5_02"     # wiskey_acr5.FLAGS: wiskey.acr5_normalize_user


_LAST: dict[str, Any] | None = None
_LAST_LOCK = threading.Lock()


def _note_negotiated(n: was.Negotiated) -> None:
    """EXTERNALBUILD-297 (X1): the last negotiation this process made, for the readiness check (version, reason, when). Never a list."""
    global _LAST
    from datetime import datetime, timezone

    with _LAST_LOCK:
        _LAST = {"version": n.version, "reason": n.reason, "at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")}


def last_negotiated() -> dict[str, Any] | None:
    with _LAST_LOCK:
        return dict(_LAST) if _LAST is not None else None


class LiveReadback:
    def __init__(self, settings: Any, *, sync: Any = None, clock: Callable[[], float] = time.monotonic,
                 gate: Callable[[str], bool] | None = None) -> None:
        self.settings = settings
        self._sync = sync
        self._clock = clock
        self._gate = gate
        self._lock = threading.Lock()
        self._cached: tuple[float, was.Negotiated] | None = None

    def _require(self, key: str) -> None:
        """G-01: the matching `wiskey.acr5_*` switch must be on right now, before anything (the negotiation included) is sent."""
        if self._gate is None:
            return
        try:
            on = self._gate(key) is True
        except Exception:  # noqa: BLE001 - an unreadable switch is OFF
            on = False
        if not on:
            raise ReadbackUnavailable("consumer_off")

    @property
    def sync(self) -> Any:
        return self._sync if self._sync is not None else intercom_sync.SYNC

    # ---- negotiation
    def negotiate(self, *, fresh: bool = False) -> was.Negotiated:
        """WisKey's current `api.commands` / `api.capabilities` (one overview read on the service channel, cached for
        NEGOTIATION_TTL_S). A read that did not answer is `ReadbackUnavailable`, never a cached or assumed result."""
        now = self._clock()
        with self._lock:
            cached = self._cached
        if not fresh and cached is not None and 0 <= now - cached[0] < NEGOTIATION_TTL_S:
            return cached[1]
        try:
            reply = self.sync.command(self.settings, "readback_api", intercom_client.overview, project_api_lists, who=WHO, channel="service")
        except Exception as exc:  # noqa: BLE001 - a request-level refusal (ApiError) or anything else is "cannot tell"
            raise ReadbackUnavailable(type(exc).__name__) from None
        lists = reply.get("readback_api") if isinstance(reply, dict) else None
        if not isinstance(lists, dict):
            raise ReadbackUnavailable(str(reply.get("last_error") or reply.get("state") or "unavailable") if isinstance(reply, dict) else "unavailable")
        negotiated = was.negotiate(lists.get("commands"), lists.get("capabilities"))
        with self._lock:
            self._cached = (now, negotiated)
        _note_negotiated(negotiated)
        return negotiated

    # ---- the reads
    def _read(self, command: str, key: str, fields: dict[str, Any]) -> Any:
        short = command[len(intercom_client.DOMAIN) + 1:]

        async def send(call: intercom_client.Call) -> Any:
            return await intercom_adapter._ask(call, short, **fields)

        try:
            reply = self.sync.command(self.settings, key, send, lambda raw: raw, who=WHO, channel=CHANNEL)
        except Exception as exc:  # noqa: BLE001 - ApiError (rate limit / request-level) and everything else: UNKNOWN
            raise ReadbackUnavailable(type(exc).__name__) from None
        raw = reply.get(key) if isinstance(reply, dict) else None
        if not isinstance(raw, dict):
            raise ReadbackUnavailable(str(reply.get("last_error") or reply.get("state") or "unavailable") if isinstance(reply, dict) else "unavailable")
        return raw

    def access_state(self, user_id: str, revision: int) -> tuple[dict[str, Any], int]:
        """`(result, schema)` for `user_id` bound to `revision` (the revision of the caller's fresh users/get). Raises
        `ReadbackUnavailable` when nothing usable can be asked or answered, or while `wiskey.acr5_access_state` is off (G-01)."""
        self._require(GATE_ACCESS_STATE)
        negotiated = self.negotiate()
        if negotiated.version is None or negotiated.command is None:
            raise ReadbackUnavailable(f"negotiation:{negotiated.reason}")
        fields = {"user_id": user_id, "revision": revision}
        return self._read(negotiated.command, "access_state", fields), negotiated.version

    def __call__(self, user_id: str, revision: int) -> tuple[dict[str, Any], int]:
        return self.access_state(user_id, revision)

    def normalize_user(self, schedule: Any) -> dict[str, Any]:
        """`schedules/normalize_user` (ACR5-02); only while `wiskey.acr5_normalize_user` is on (G-01) and WisKey lists the command AND
        advertises its capability."""
        self._require(GATE_NORMALIZE)
        listed = self.negotiate_lists()
        if "schedules/normalize_user" not in listed[0] or "user_schedule_normalization_v1" not in listed[1]:
            raise ReadbackUnavailable("negotiation:unsupported")
        return self._read("hikvision_intercom/schedules/normalize_user", "normalized", {"schedule": schedule})

    def negotiate_lists(self) -> tuple[frozenset[str], frozenset[str]]:
        try:
            reply = self.sync.command(self.settings, "readback_api", intercom_client.overview, project_api_lists, who=WHO, channel="service")
        except Exception as exc:  # noqa: BLE001
            raise ReadbackUnavailable(type(exc).__name__) from None
        lists = reply.get("readback_api") if isinstance(reply, dict) else None
        if not isinstance(lists, dict) or lists.get("commands") is None or lists.get("capabilities") is None:
            raise ReadbackUnavailable("not_listed")
        return frozenset(lists["commands"]), frozenset(lists["capabilities"])
