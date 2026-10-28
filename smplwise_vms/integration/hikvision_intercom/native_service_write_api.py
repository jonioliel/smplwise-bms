"""Versioned direct service writes with an independent native owner grant.

The existing human/W1 protocol is unchanged. Service requests carry no invented
human or automation actor. A paired identity alone cannot select this contract:
its current owner-configured grant and complete native target scope must match.
"""

from __future__ import annotations

import asyncio
import hashlib
import re
import weakref
from copy import deepcopy

import voluptuous as vol
from homeassistant.components import websocket_api

from .access.arx_execution_authority import StationGrant
from .access.arx_people_execution import check_people_scope
from .access.commit_tasks import finish_owned_commit
from .access.models import AccessError, ManagedUser, build_user, utc_now
from .bridge_command_auth import host_for, send_bridge_result
from .const import DOMAIN
from .storage import AccessStore
from .trusted_actions.direct_bridge_origin import DirectBridgeConnection
from .trusted_actions.existing_bridge_auth import canonical_body
from .trusted_actions.source_commit_guard import source_commit
from .trusted_actions.validation import Refusal, aware, reference

CONTRACT = "wiskey-native-service-write.v1"
CONFIG_KEY = "native_service_grants_v1"
KEY = "native_service_writes"
JOURNAL_SCHEMA_VERSION = 3
STATUS = "users/service_write_status_v1"
ACTIONS = frozenset(
    {"users/create", "users/update", "users/pin_generate", "users/temporary_cancel"}
)
DATA_FIELDS = frozenset(
    {
        "display_name",
        "employee_no",
        "active",
        "access_category",
        "responsible_person",
        "access_purpose",
        "valid_from",
        "valid_until",
        "pin",
        "assignments",
        "access_timing_policy",
        "access_timing_draft",
        "phone",
    }
)
FIELDS = frozenset(
    {
        "contract",
        "actor_id",
        "authority_ref",
        "authority_revision",
        "role",
        "scope_ref",
        "grant_id",
        "grant_revision",
        "permission_revision",
        "target_ref",
        "target_revision",
        "request_id",
        "operation_id",
    }
)
GRANT_FIELDS = frozenset(
    {
        "authority_ref",
        "authority_revision",
        "role",
        "scope_ref",
        "grant_id",
        "grant_revision",
        "permission_revision",
        "commands",
        "fields",
        "stations",
        "user_ids",
        "allow_create",
        "expires_at",
    }
)
_REGISTERED = weakref.WeakKeyDictionary()


class NativeServiceWrites:
    def __init__(self, hass, store, state):
        if state is None:
            state = {
                "schema_version": JOURNAL_SCHEMA_VERSION,
                "repository_id": None,
                "operations": {},
            }
        if (
            type(state) is not dict
            or set(state) != {"schema_version", "repository_id", "operations"}
            or type(state["schema_version"]) is not int
            or state["schema_version"] != JOURNAL_SCHEMA_VERSION
            or type(state["operations"]) is not dict
            or len(state["operations"]) > 4096
        ):
            raise AccessError("invalid_storage")
        if state["repository_id"] is not None:
            reference(state["repository_id"])
        elif state["operations"]:
            raise AccessError("invalid_storage")
        for key, row in state["operations"].items():
            if (
                type(row) is not dict
                or set(row)
                != {
                    "owner",
                    "request_id",
                    "operation_id",
                    "command",
                    "target_ref",
                    "grant_id",
                    "request_sha256",
                    "state",
                    "receipt",
                }
                or key != self.key(row["owner"], row["operation_id"])
                or row["state"] not in {"unknown", "completed"}
                or type(row["request_sha256"]) is not str
                or re.fullmatch(r"[0-9a-f]{64}", row["request_sha256"]) is None
            ):
                raise AccessError("invalid_storage")
            for name in (
                "owner",
                "request_id",
                "operation_id",
                "command",
                "target_ref",
                "grant_id",
            ):
                reference(row[name])
            if row["receipt"] is not None and (
                type(row["receipt"]) is not dict
                or set(row["receipt"])
                != {"user_id", "person_revision", "central_state", "device_application"}
            ):
                raise AccessError("invalid_storage")
        self.hass, self.namespace, self.manager, self.store, self.state = (
            hass,
            hass.data[DOMAIN],
            hass.data[DOMAIN]["access"],
            store,
            state,
        )
        self.repository = self.manager.repository
        self.registry = self.namespace.get("native_peer_registry")
        self.lock = asyncio.Lock()
        self.namespace[KEY] = self

    @staticmethod
    def key(owner, operation):
        return hashlib.sha256((owner + "\0" + operation).encode()).hexdigest()

    def stable(self):
        if (
            self.hass.is_stopping
            or self.hass.data.get(DOMAIN) is not self.namespace
            or self.namespace.get(KEY) is not self
            or self.namespace.get("access") is not self.manager
            or self.manager.repository is not self.repository
            or self.manager._closed
        ):
            raise Refusal("service_write_source_unavailable")
        identity = self.identity()
        if self.state["repository_id"] not in (None, identity):
            # A different restored/replaced repository cannot adopt an old
            # intent or claim its receipt. No automatic reset or migration.
            raise Refusal("service_write_repository_changed")

    def identity(self):
        from .trusted_actions.native_peer_source import NativePeerRegistry

        if (
            type(self.registry) is not NativePeerRegistry
            or self.namespace.get("native_peer_registry") is not self.registry
            or self.registry.repository is not self.repository
        ):
            raise Refusal("service_write_source_unavailable")
        NativePeerRegistry._stable(self.registry)
        return self.registry.repository_id

    def grant(self, principal, metadata, parameters):
        self.stable()
        principal.check()
        original = principal.parameters
        if original.pop("service_write", None) != metadata or original != parameters:
            raise Refusal("Unauthorized")
        if (
            type(principal.owner_key[3]) is not DirectBridgeConnection
            or principal.repository is not self.repository
        ):
            raise Refusal("Unauthorized")
        if (
            type(metadata) is not dict
            or set(metadata) != FIELDS
            or metadata.get("contract") not in {CONTRACT, "wiskey-native-service-write.v2"}
        ):
            raise Refusal("invalid_fields")
        if metadata["actor_id"] != principal.owner_key[2].id:
            raise Refusal("service_actor_mismatch")
        for name in FIELDS - {
            "authority_revision",
            "grant_revision",
            "permission_revision",
            "target_revision",
        }:
            reference(metadata[name])
        for name in ("authority_revision", "grant_revision", "permission_revision"):
            if type(metadata[name]) is not int or not 1 <= metadata[name] <= 2**53 - 1:
                raise Refusal("invalid_fields")
        permanent = metadata["contract"] == "wiskey-native-service-write.v2"
        if permanent:
            from .native_auto_installation import KEY as INSTALLATION_KEY

            installer = self.namespace.get(INSTALLATION_KEY)
            if installer is None:
                raise Refusal("service_grant_required")
            expected = installer.grant(principal.owner_key[0].entry)
            grant = {
                **expected,
                "role": "access_manager",
                "commands": sorted(ACTIONS),
                "fields": sorted(DATA_FIELDS),
                "stations": [],
                "user_ids": [],
                "allow_create": True,
                "expires_at": None,
            }
            cfg = {"schema_version": 1, "grants": [grant]}
        else:
            cfg = principal.owner_key[0].entry.options.get(CONFIG_KEY)
        if (
            not isinstance(cfg, dict)
            or set(cfg) != {"schema_version", "grants"}
            or type(cfg["schema_version"]) is not int
            or cfg["schema_version"] != 1
            or not isinstance(cfg["grants"], list)
            or len(cfg["grants"]) > 128
        ):
            raise Refusal("service_grant_required")
        rows = [
            g
            for g in cfg["grants"]
            if isinstance(g, dict) and g.get("grant_id") == metadata["grant_id"]
        ]
        if len(rows) != 1 or set(rows[0]) != GRANT_FIELDS:
            raise Refusal("service_grant_denied")
        grant = rows[0]
        if any(
            type(grant[k]) is not type(metadata[k]) or grant[k] != metadata[k]
            for k in (
                "authority_ref",
                "authority_revision",
                "role",
                "scope_ref",
                "grant_id",
                "grant_revision",
                "permission_revision",
            )
        ):
            raise Refusal("service_grant_denied")
        if (
            grant["role"] != "access_manager"
            or principal.command not in ACTIONS
            or not isinstance(grant["commands"], list)
            or not set(grant["commands"]) <= ACTIONS
            or principal.command not in grant["commands"]
        ):
            raise Refusal("service_grant_denied")
        from .bridge_command_auth import BridgeCommandHost

        if not permanent and BridgeCommandHost._owner(
            host_for(self.hass)
        ).auth.clock().now >= aware(grant["expires_at"]):
            raise Refusal("service_grant_expired")
        if (
            not isinstance(grant["fields"], list)
            or not set(grant["fields"]) <= DATA_FIELDS
            or type(grant["allow_create"]) is not bool
            or not isinstance(grant["user_ids"], list)
            or not isinstance(grant["stations"], list)
        ):
            raise Refusal("service_grant_denied")
        if set(parameters) & {"actor", "peer_write", "service_write"}:
            raise Refusal("invalid_fields")
        if principal.command == "users/create":
            if not grant["allow_create"] or metadata["target_revision"] is not None:
                raise Refusal("service_target_denied")
        elif parameters.get("user_id") != metadata["target_ref"] or not parameters.get("user_id"):
            raise Refusal("service_target_denied")
        elif principal.command == "users/pin_generate":
            if (
                type(metadata["target_revision"]) is not int
                or not 1 <= metadata["target_revision"] <= 2**53 - 1
            ):
                raise Refusal("revision_conflict")
        elif type(metadata["target_revision"]) is not int or metadata[
            "target_revision"
        ] != parameters.get("revision"):
            raise Refusal("revision_conflict")
        if not permanent and principal.command != "users/create":
            created = {
                r["receipt"]["user_id"]
                for r in self.state["operations"].values()
                if r["owner"] == metadata["actor_id"]
                and r["grant_id"] == metadata["grant_id"]
                and r["command"] == "users/create"
                and r["receipt"] is not None
            }
            if metadata["target_ref"] not in set(grant["user_ids"]) | created:
                raise Refusal("service_target_denied")
        if "data" in parameters and (
            type(parameters["data"]) is not dict
            or not permanent and not set(parameters["data"]) <= set(grant["fields"])
        ):
            raise Refusal("service_field_denied")
        return grant

    def scope(self, grant, before, after):
        if grant["expires_at"] is None:
            # Full installed Arx authority; native schema/CAS/device checks still run.
            return
        stations = []
        for row in grant["stations"]:
            if not isinstance(row, dict) or set(row) != {
                "station_id",
                "api_relay",
                "physical_relay",
                "mapping_revision",
            }:
                raise Refusal("service_grant_denied")
            stations.append(StationGrant(**row))
        for person in (before, after):
            if person is not None and (
                person.group_ids
                or set(person.permission_overrides) - {s.station_id for s in stations}
            ):
                raise Refusal("service_target_denied")
        check_people_scope(self.repository, tuple(stations), before, after)

    async def save(self, state):
        async def persist():
            await self.store.async_save(deepcopy(state))
            self.state = state

        await finish_owned_commit(asyncio.create_task(persist()))

    async def execute(self, principal, metadata, parameters, dispatch):
        grant = self.grant(principal, metadata, parameters)
        owner, operation = metadata["actor_id"], metadata["operation_id"]
        key = self.key(owner, operation)
        request_sha256 = hashlib.sha256(
            canonical_body(
                {"command": principal.command, "service_write": metadata, "parameters": parameters}
            )
        ).hexdigest()
        pin_revision = None

        def current():
            self.grant(principal, metadata, parameters)
            if (
                pin_revision is not None
                and self.repository.get(metadata["target_ref"]).revision != pin_revision
            ):
                raise Refusal("revision_conflict")

        async with self.lock:
            current()
            previous = self.state["operations"].get(key)
            if previous is not None:
                if any(
                    previous[k] != v
                    for k, v in {
                        "command": principal.command,
                        "target_ref": metadata["target_ref"],
                        "grant_id": metadata["grant_id"],
                        "request_sha256": request_sha256,
                    }.items()
                ):
                    raise Refusal("service_operation_conflict")
                return {
                    "contract": metadata["contract"],
                    "schema_version": 1,
                    "state": previous["state"],
                    "code": "operation_already_recorded",
                    "operation_id": operation,
                    "receipt": deepcopy(previous["receipt"]),
                    "replay_available": False,
                }
            if len(self.state["operations"]) >= 4096:
                raise Refusal("service_write_capacity")
            if any(
                r["owner"] == owner
                and (
                    r["request_id"] == metadata["request_id"]
                    or principal.command == "users/create"
                    and r["command"] == "users/create"
                    and r["target_ref"] == metadata["target_ref"]
                )
                for r in self.state["operations"].values()
            ):
                raise Refusal("service_origin_or_request_already_recorded")
            # Exact recorded operations return their safe original receipt
            # before a now-stale person CAS is considered. This never dispatches.
            old = (
                None
                if principal.command == "users/create"
                else self.repository.get(metadata["target_ref"])
            )
            if old is not None and old.revision != metadata["target_revision"]:
                raise Refusal("revision_conflict")
            if principal.command == "users/pin_generate":
                after = None
                pin_revision = old.revision
            else:
                data = (
                    {"active": False}
                    if principal.command == "users/temporary_cancel"
                    else parameters.get("data", {})
                )
                normalized = self.repository.permission_data(data, old)
                after = build_user(
                    normalized,
                    employee_no=old.employee_no if old else "1",
                    previous=old,
                    now=utc_now(),
                )
            self.scope(grant, old, after)
            state = deepcopy(self.state)
            state["repository_id"] = self.identity()
            state["operations"][key] = {
                "owner": owner,
                "request_id": metadata["request_id"],
                "operation_id": operation,
                "command": principal.command,
                "target_ref": metadata["target_ref"],
                "grant_id": metadata["grant_id"],
                "request_sha256": request_sha256,
                "state": "unknown",
                "receipt": None,
            }
            await self.save(state)
            current()
        committed = []

        def attach(before, candidate, _result):
            current()
            changed = [
                uid
                for uid in set(before["users"]) | set(candidate["users"])
                if before["users"].get(uid) != candidate["users"].get(uid)
            ]
            if len(changed) != 1 or committed:
                raise Refusal("service_write_commit_mismatch")
            uid = changed[0]
            old = before["users"].get(uid)
            new = candidate["users"].get(uid)
            if (
                new is None
                or principal.command == "users/create"
                and old is not None
                or principal.command != "users/create"
                and uid != metadata["target_ref"]
            ):
                raise Refusal("service_target_denied")
            self.scope(
                grant, ManagedUser.from_private(old) if old else None, ManagedUser.from_private(new)
            )
            committed.append(
                {
                    "user_id": uid,
                    "person_revision": new["revision"],
                    "central_state": "saved",
                    "device_application": "not_proven",
                }
            )

        try:
            if principal.command == "users/pin_generate":
                self.scope(grant, self.repository.get(metadata["target_ref"]), None)
            with source_commit(
                self.repository,
                current,
                attachment=None if principal.command == "users/pin_generate" else attach,
            ):
                result = await dispatch()
            current()
            if principal.command == "users/pin_generate":
                person = self.repository.get(metadata["target_ref"])
                receipt = {
                    "user_id": person.id,
                    "person_revision": person.revision,
                    "central_state": "unchanged_pin_generated_not_saved",
                    "device_application": "not_proven",
                }
            else:
                if len(committed) != 1:
                    raise Refusal("service_write_commit_mismatch")
                receipt = committed[0]
            async with self.lock:
                current()
                state = deepcopy(self.state)
                state["operations"][key].update(state="completed", receipt=receipt)
                await self.save(state)
                current()
            return {
                "contract": metadata["contract"],
                "schema_version": 1,
                "state": "completed",
                "code": "central_saved" if committed else "pin_generated_not_saved",
                "operation_id": operation,
                "result": result,
                "receipt": receipt,
                "replay_available": False,
            }
        except (Exception, asyncio.CancelledError):
            # The intent is durable before dispatch. Crash/ACK loss may leave a
            # saved central person without a completion receipt: never replay.
            raise Refusal("service_write_outcome_unknown") from None


async def dispatch_service(hass, principal, metadata, parameters, dispatch):
    host = hass.data[DOMAIN].get(KEY)
    if type(host) is not NativeServiceWrites:
        raise Refusal("service_write_source_unavailable")
    return await host.execute(principal, metadata, parameters, dispatch)


@websocket_api.websocket_command(
    vol.All(vol.Schema({"type": DOMAIN + "/" + STATUS}, extra=vol.ALLOW_EXTRA))
)
@websocket_api.async_response
async def status_handler(hass, connection, message):
    try:
        principal = await host_for(hass).admit(connection, message, STATUS)
        parameters = principal.parameters
        if type(connection) is not DirectBridgeConnection or set(parameters) != {"operation_id"}:
            raise Refusal("invalid_fields")
        operation = reference(parameters["operation_id"])
        host = hass.data[DOMAIN].get(KEY)
        if type(host) is not NativeServiceWrites:
            raise Refusal("service_write_source_unavailable")
        host.stable()
        principal.check()
        row = host.state["operations"].get(host.key(connection.user.id, operation))
        result = {
            "contract": CONTRACT,
            "schema_version": 1,
            "state": "unknown" if row is None else row["state"],
            "operation_id": operation,
            "receipt": None if row is None else deepcopy(row["receipt"]),
            "replay_available": False,
        }
        send_bridge_result(connection, message["id"], result)
    except (Refusal, AccessError) as error:
        connection.send_error(message["id"], error.code, "Service receipt unavailable")
    except Exception:
        connection.send_error(
            message["id"], "service_write_outcome_unknown", "Service receipt unavailable"
        )


async def setup_native_service_writes(hass):
    store = AccessStore(hass, key=DOMAIN + ".native_service_write_intents_v1")
    NativeServiceWrites(hass, store, await store.async_load())
    websocket_api.async_register_command(hass, status_handler)
    _REGISTERED[hass] = hass.data[websocket_api.DOMAIN][DOMAIN + "/" + STATUS]


def registered_service_writes(hass):
    handler = _REGISTERED.get(hass)
    return (
        (STATUS,)
        if handler is not None
        and hass.data.get(websocket_api.DOMAIN, {}).get(DOMAIN + "/" + STATUS) is handler
        else ()
    )
