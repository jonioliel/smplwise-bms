"""Original paired Native metadata reads, opt-in for the test deployment.

The fixed three-command set has no mutation or person read. All existing
channel guards and Arx route RBAC still execute above this transport wrapper.
Other calls retain their existing transport and admission behavior.
"""
from __future__ import annotations
import asyncio
import os
import re
import time
from datetime import datetime, timedelta, timezone
from typing import Any

from ..db import Database
from . import ha_bridge
from .intercom_client import IntercomError
from .wiskey_media_bridge import BridgeSigner, MediaBridgeError, TYPE_PREFIX

METADATA_READS = frozenset({"overview", "subscribe", "authorization/session"})
ENV = "SW_WISKEY_NATIVE_SIGNED_READS"
SUBSCRIPTION_KIND = "wiskey-bridge-subscription.v1"
SUBSCRIPTION_SECONDS = 300


def _key(settings):
    with Database(settings.db_path).connection(mode="read", label="native metadata proof") as conn:
        return ha_bridge.signing_key(conn)


async def bind_metadata(call, settings):
    if os.environ.get(ENV, "0") != "1":
        return call
    who = await call("auth/current_user")
    result = who.get("result") if isinstance(who, dict) and who.get("success") is True else None
    identity = result.get("id") if isinstance(result, dict) else None
    if not isinstance(identity, str) or re.fullmatch(r"[0-9a-f]{32}", identity) is None:
        raise IntercomError("unauthorized", "overview")

    async def signed_metadata(msg_type: str, **parameters: Any):
        command = msg_type.removeprefix(TYPE_PREFIX)
        if not msg_type.startswith(TYPE_PREFIX) or command not in METADATA_READS:
            return await call(msg_type, **parameters)
        key = await asyncio.to_thread(_key, settings)
        if command == "subscribe" and not parameters:
            parameters = {"expires_at": (datetime.now(timezone.utc)+timedelta(seconds=SUBSCRIPTION_SECONDS)).isoformat()}
        try:
            proof = BridgeSigner(lambda: key).command_proof(command, identity, parameters)
        except MediaBridgeError as exc:
            raise IntercomError(exc.code, command) from None
        reply = await call(msg_type, bridge=proof)
        if command == "subscribe" and reply.get("success") is True:
            result = reply.get("result")
            if (not isinstance(result, dict) or set(result) != {"kind", "schema_version", "expires_at"}
                    or result.get("kind") != SUBSCRIPTION_KIND
                    or type(result.get("schema_version")) is not int or result.get("schema_version") != 1
                    or result.get("expires_at") != parameters.get("expires_at")):
                raise IntercomError("invalid_response", command)
            signed_metadata.native_subscription_renew_at = time.monotonic()+SUBSCRIPTION_SECONDS-min(60,SUBSCRIPTION_SECONDS/2)
        return reply
    signed_metadata.native_subscription_renew_at = None
    return signed_metadata
