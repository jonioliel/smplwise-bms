"""Durable installed Arx producer/worker over the original native template host.

Only immutable v2 references/revisions enter the private journal. The worker
fills private values at dispatch and uses the original PacingQueue claim, Cloud
provider and native ledger. In-flight jobs become UNKNOWN on restart, never retry.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import weakref
from copy import deepcopy
from dataclasses import asdict
from datetime import UTC, datetime, timedelta
from types import MappingProxyType

from .const import DOMAIN
from .storage import AccessStore
from .trusted_actions.adapters import EngineContext
from .trusted_actions.validation import Refusal
from .whatsapp_template_runtime_v1 import (
    NativeTemplateSendHostV1,
    _person_snapshot,
    descriptor,
)

_DISPATCHES = weakref.WeakKeyDictionary()


class InstalledTemplateDispatch:
    __slots__ = ("__weakref__",)

    def check(self):
        worker, key, request, grant, entry, repository = _DISPATCHES[self]
        worker.installer.current()
        from .native_auto_installation import KEY

        authority = worker.hass.data[DOMAIN][KEY]
        if (
            worker.closed
            or authority.grant(entry) != grant
            or worker.hass.data[DOMAIN]["access"].repository is not repository
            or worker.state["jobs"][key]["state"] != "dispatching"
            or worker.state["jobs"][key]["request"] != request
        ):
            raise Refusal("template_source_unavailable")

    def admit(self, composition, parameters):
        self.check()
        worker, _key, request, _grant, _entry, _repository = _DISPATCHES[self]
        resources = worker.installer.resources
        if resources.composition is not composition:
            raise Refusal("template_source_unavailable")
        host = composition.stable().host
        owner = NativeTemplateSendHostV1.stable(host)
        expected, current = worker.native(request)
        if descriptor(parameters) != expected:
            raise Refusal("operation_conflict")

        def guard(_request):
            self.check()
            current()
            return True

        return EngineContext(
            MappingProxyType(
                {
                    "action": "whatsapp/template_send_v1",
                    "request_id": request["request_id"],
                    "operation_id": request["operation_id"],
                    "operation_binding_ref": request["operation_id"],
                }
            ),
            guard,
            parameters=expected,
            epoch=owner.roots[11],
        )


class NativeTemplateJobs:
    def __init__(self, installer, store, state):
        self.installer, self.hass, self.store, self.state = installer, installer.hass, store, state
        self.lock = asyncio.Lock()
        self.closed = False
        self.wake = asyncio.Event()
        self.task = None

    async def save(self, state):
        await self.store.async_save(state)
        self.state = state

    @classmethod
    async def open(cls, installer):
        store = AccessStore(installer.hass, key=DOMAIN + ".template_jobs_v1")
        state = await store.async_load()
        if state is None:
            state = {"schema_version": 2, "jobs": {}}
        if (
            type(state) is not dict
            or set(state) != {"schema_version", "jobs"}
            or type(state["schema_version"]) is not int
            or state["schema_version"] not in {1, 2}
            or type(state["jobs"]) is not dict
            or len(state["jobs"]) > 4096
        ):
            raise Refusal("template_jobs_storage_invalid")
        from .whatsapp_template_api_v2 import descriptor_v2

        legacy = state["schema_version"] == 1
        for key, row in state["jobs"].items():
            if legacy:
                row["source_sha256"] = None
                if row["state"] == "queued":
                    row["state"], row["result"] = (
                        "unknown",
                        {"state": "unknown", "code": "legacy_source_snapshot_unavailable"},
                    )
            if (
                set(row)
                != {
                    "request",
                    "entry_id",
                    "grant_ref",
                    "state",
                    "result",
                    "expires_at",
                    "source_sha256",
                }
                or key != row["request"]["operation_id"]
                or row["state"]
                not in {"queued", "dispatching", "completed", "cancelled", "unknown"}
            ):
                raise Refusal("template_jobs_storage_invalid")
            descriptor_v2(row["request"])
            from .trusted_actions.validation import aware, reference

            aware(row["expires_at"])
            reference(row["entry_id"])
            digest = row["source_sha256"]
            if digest is not None and (
                type(digest) is not str
                or len(digest) != 64
                or any(char not in "0123456789abcdef" for char in digest)
            ):
                raise Refusal("template_jobs_storage_invalid")
            if row["state"] == "dispatching":
                row["state"], row["result"] = (
                    "unknown",
                    {"state": "unknown", "code": "ack_lost_no_replay"},
                )
        state["schema_version"] = 2
        result = cls(installer, store, state)
        await result.save(state)
        return result

    def native(self, request):
        self.installer.current()
        composition = self.installer.resources.composition
        host = composition.stable().host
        template = next(
            (
                t
                for t in host.templates
                if t.reference == request["template_ref"]
                and t.revision == request["expected_template_revision"]
                and (t.account, t.name, t.language)
                == (request["account"], request["template_name"], request["language"])
            ),
            None,
        )
        if template is None:
            raise Refusal("template_revision_conflict")
        person = host.manager.repository.get(request["recipient_ref"])
        if person.revision != request["expected_person_revision"]:
            raise Refusal("revision_conflict")
        snapshot = _person_snapshot(person, template)
        fields = dict(
            zip(
                ("display_name", "employee_no", "pin", "valid_from", "valid_until"),
                snapshot[3:],
                strict=True,
            )
        )
        parameters = descriptor(
            {
                "schema_version": 1,
                **{
                    k: request[k]
                    for k in (
                        "request_id",
                        "operation_id",
                        "recipient_ref",
                        "account",
                        "template_name",
                        "language",
                    )
                },
                "parameters": [fields[k] for k in template.parameter_fields],
            }
        )

        def current():
            self.installer.current()
            if (
                composition.stable().host is not host
                or _person_snapshot(host.manager.repository.get(person.id), template) != snapshot
            ):
                raise Refusal("template_source_unavailable")

        return parameters, current

    def source_hash(self, request):
        self.installer.current()
        host = self.installer.resources.composition.stable().host
        template = next(
            t
            for t in host.templates
            if t.reference == request["template_ref"]
            and t.revision == request["expected_template_revision"]
        )
        provider = next(p for p in host.providers if p.account.account == template.account)
        account = {
            key: getattr(provider.account, key)
            for key in ("account", "api_version", "business_id", "phone_number_id")
        }
        return hashlib.sha256(
            json.dumps({"template": asdict(template), "account": account}, sort_keys=True).encode()
        ).hexdigest()

    async def enqueue(self, principal, value, ttl_s):
        from .native_auto_installation import KEY
        from .whatsapp_template_api_v2 import descriptor_v2

        request = descriptor_v2(value)
        if type(ttl_s) is not int or not 1 <= ttl_s <= 300:
            raise Refusal("invalid_fields")
        principal.check()
        entry = principal.owner_key[0].entry
        grant = self.hass.data[DOMAIN][KEY].grant(entry)
        self.native(request)
        async with self.lock:
            principal.check()
            old = self.state["jobs"].get(request["operation_id"])
            if old is not None:
                if old["request"] != request or old["entry_id"] != entry.entry_id:
                    raise Refusal("operation_conflict")
                return self.public(request["operation_id"])
            if len(self.state["jobs"]) >= 4096 or any(
                row["request"]["request_id"] == request["request_id"]
                for row in self.state["jobs"].values()
            ):
                raise Refusal("template_capacity_or_request_conflict")
            state = deepcopy(self.state)
            state["jobs"][request["operation_id"]] = {
                "request": request,
                "entry_id": entry.entry_id,
                "grant_ref": grant,
                "state": "queued",
                "result": None,
                "expires_at": (datetime.now(UTC) + timedelta(seconds=ttl_s)).isoformat(),
                "source_sha256": self.source_hash(request),
            }
            await self.save(state)
            principal.check()
        self.wake.set()
        return self.public(request["operation_id"])

    def public(self, operation):
        row = self.state["jobs"].get(operation)
        if row is None:
            return {
                "schema_version": 1,
                "state": "unknown",
                "result": None,
                "operation_id": operation,
                "replay_available": False,
            }
        return {
            "schema_version": 1,
            "state": row["state"],
            "result": deepcopy(row["result"]),
            "operation_id": operation,
            "replay_available": False,
        }

    async def cancel(self, operation):
        async with self.lock:
            row = self.state["jobs"].get(operation)
            if row and row["state"] == "queued":
                state = deepcopy(self.state)
                state["jobs"][operation].update(
                    state="cancelled",
                    result={"state": "not_sent", "code": "cancelled_before_dispatch"},
                )
                await self.save(state)
        return self.public(operation)

    async def pump(self):
        from .native_auto_installation import KEY

        self.installer.current()
        async with self.lock:
            selected = next(
                ((key, row) for key, row in self.state["jobs"].items() if row["state"] == "queued"),
                None,
            )
            if selected is None:
                return
            key, row = selected
            state = deepcopy(self.state)
            state["jobs"][key]["state"] = "dispatching"
            await self.save(state)  # Durable ambiguity barrier BEFORE any provider dispatch.
        result = {"state": "unknown", "code": "provider_outcome_unknown"}
        entered_send = False
        try:
            if datetime.now(UTC) >= datetime.fromisoformat(row["expires_at"]):
                result = {"state": "not_sent", "code": "queue_expired", "retry_after_s": None}
            else:
                entry = self.hass.config_entries.async_get_entry(row["entry_id"])
                grant = self.hass.data[DOMAIN][KEY].grant(entry)
                if grant != row["grant_ref"]:
                    raise Refusal("installation_identity_changed")
                parameters, current = self.native(row["request"])
                if row["source_sha256"] != self.source_hash(row["request"]):
                    raise Refusal("template_source_changed")
                dispatch = InstalledTemplateDispatch()
                _DISPATCHES[dispatch] = (
                    self,
                    key,
                    row["request"],
                    grant,
                    entry,
                    self.hass.data[DOMAIN]["access"].repository,
                )

                def guard():
                    dispatch.check()
                    current()

                host = self.installer.resources.composition.stable().host
                entered_send = True
                result = await NativeTemplateSendHostV1.send(host, dispatch, parameters, guard)
                pacing = NativeTemplateSendHostV1.stable(host).pacing_results.get(
                    row["request"]["request_id"]
                )
                if pacing is not None:
                    result = {**result, "pacing_outcome": dict(pacing)}
        except Refusal:
            result = (
                {"state": "unknown", "code": "provider_outcome_unknown"}
                if entered_send
                else {
                    "state": "not_sent",
                    "code": "source_changed_before_dispatch",
                    "retry_after_s": None,
                }
            )
        except Exception:
            pass
        async with self.lock:
            state = deepcopy(self.state)
            state["jobs"][key].update(
                state="unknown" if result["state"] == "unknown" else "completed", result=result
            )
            await self.save(state)
        return self.public(key)

    def start(self):
        if self.task is not None:
            return

        async def run():
            while not self.closed:
                self.wake.clear()
                try:
                    await self.pump()
                except Exception:
                    pass  # No reset/replay; original persistent state remains authoritative.
                try:
                    await asyncio.wait_for(self.wake.wait(), 1)
                except TimeoutError:
                    pass

        self.task = self.hass.async_create_background_task(
            run(), "WisKey template worker", eager_start=False
        )

    async def close(self):
        self.closed = True
        self.wake.set()
        if self.task is not None:
            await self.task
