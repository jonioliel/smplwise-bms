"""M12-04 candidate consumer: passive Core observation, never add-on imports.

No official fixed image is identified. Numeric versions or a disk hash alone
cannot allow a native mapped image. An image verifier belongs to the original
runtime/image provider, not a request field or a new authority in this module.

WISKEY-RC7-ADOPT-2331 S2 (Arx): adopted unchanged in logic from the WisKey M12 policy B contribution (M12-POLICY-B.20261102.01,
`after/smplwise_vms/backend/smplwise/services/wiskey_core_runtime_gate.py`; WisKey MIT notice as carried since 2.32.0). Arx has no
image verifier, so `read_core` never returns `supported`: a managed-profile bundle is never staged even after the owner's ON
(`wiskey_auto_install.preflight_managed_runtime`). Called only after the owner's ON, never with the switch off. Inside a running event
loop `read_core` refuses (`core_runtime_observation_thread_required`) - conservative; the add-on start-up calls it from a worker thread.
The bootstrap bridge observer (`smplwise_bridge/core_runtime_v1`) is slice S4 (not on this branch yet): until then the read answers
`unknown_command` and the gate is `core_runtime_bootstrap_unavailable` or `core_runtime_unavailable`.
"""

import secrets

COMMANDS = (
    "smplwise_bridge/core_runtime_v1",  # bootstrap without loading Native
    "hikvision_intercom/installation/core_runtime_v1",
)


OBSERVATION_FIELDS = frozenset({"contract", "schema_version", "challenge", "process_id", "boot_id", "process_started_at", "boot_scope", "observer_ref", "observed_monotonic_ns", "core_version", "python", "implementation", "soabi", "architecture", "platform", "image_identity", "image_provenance", "modules", "scope"})
MODULE_FIELDS = {"loaded", "version", "disk", "loaded_code_sha256", "native_image_attestation"}

def _hex(value):
    return type(value) is str and len(value)==64 and all(c in "0123456789abcdef" for c in value)

def _shape(value):
    import math
    if set(value)!=OBSERVATION_FIELDS or type(value["schema_version"]) is not int or value["schema_version"]!=1:
        return False
    if (type(value["challenge"]) is not str or not 16<=len(value["challenge"])<=128
            or type(value["process_id"]) is not int or value["process_id"]<1
            or type(value["observed_monotonic_ns"]) is not int or value["observed_monotonic_ns"]<0
            or value["image_identity"] is not None or value["image_provenance"]!="unavailable"
            or value["scope"]!="loaded process observation; disk hashes are not native image attestation"):
        return False
    for name in ("python","implementation","architecture","platform","observer_ref"):
        if type(value[name]) is not str or not 1<=len(value[name])<=128:return False
    for name in ("core_version","soabi","boot_id"):
        if value[name] is not None and type(value[name]) is not str:return False
    birth=value["process_started_at"]
    if birth is not None and (type(birth) not in (int,float) or not math.isfinite(birth) or birth<0):return False
    if value["boot_scope"] not in ("core_process_birth","unavailable"):return False
    modules=value["modules"]
    if type(modules) is not dict or set(modules)!={"orjson","orjson.orjson","aiohttp","aiohttp.web_ws"}:return False
    for row in modules.values():
        if (type(row) is not dict or set(row)!=MODULE_FIELDS or type(row["loaded"]) is not bool
                or row["version"] is not None and type(row["version"]) is not str
                or row["native_image_attestation"]!="unavailable"
                or row["loaded_code_sha256"] is not None and not _hex(row["loaded_code_sha256"])):return False
        disk=row["disk"]
        if disk is not None and (type(disk) is not dict or set(disk)!={"name","sha256","bytes"}
                or type(disk["name"]) is not str or not 1<=len(disk["name"])<=128 or not _hex(disk["sha256"])
                or type(disk["bytes"]) is not int or not 0<=disk["bytes"]<=33554432):return False
    return True


def evaluate(observation, challenge, *, image_verifier=None):
    if not isinstance(observation, dict) or observation.get("contract") != "wiskey-core-runtime-observation.v1":
        return {"state": "unavailable", "code": "core_runtime_unavailable"}
    if not _shape(observation) or observation.get("challenge") != challenge:
        return {"state": "refused", "code": "core_runtime_observation_invalid"}
    if (observation.get("boot_scope") != "core_process_birth"
            or type(observation.get("process_started_at")) not in (int, float)
            or type(observation.get("boot_id")) is not str or not observation["boot_id"]):
        return {"state": "unavailable", "code": "core_runtime_process_unavailable"}
    # True/False/None are results of the ORIGINAL trusted image verifier,
    # never booleans taken from the observation JSON. Version alone neither
    # allows an unverified build nor rejects a correctly attested backport.
    verdict = None if image_verifier is None else image_verifier(observation)
    if verdict is True:
        return {"state": "supported", "code": None}
    if verdict is False:
        return {"state": "unsupported", "code": "core_runtime_unsupported"}
    return {"state": "unverified", "code": "core_runtime_provenance_unavailable"}



def observe(reader, *, image_verifier=None):
    """reader is the original authenticated HA WS request, not Direct/grant().

    Missing preinstalled bootstrap bridge and missing independently verified
    official image evidence narrowly block staging; no install-to-discover.
    """
    for command in COMMANDS:
        challenge = secrets.token_hex(24)
        response = reader(command, {"challenge": challenge})
        if isinstance(response, dict) and response.get("success") is True:
            return evaluate(response.get("result"), challenge, image_verifier=image_verifier)
        if not isinstance(response, dict) or response.get("error", {}).get("code") != "unknown_command":
            return {"state": "unavailable", "code": "core_runtime_unavailable"}
    return {"state": "unavailable", "code": "core_runtime_bootstrap_unavailable"}


def read_core(settings, *, timeout_s=10.0):
    """Original authenticated HA WS client, bounded READ only. No new HA user.

    No approved official image verifier is identified in the supplied source.
    Observation may succeed, while provenance/compatibility remains unverified.
    """
    import asyncio
    from . import ha_client

    async def collect():
        stop = asyncio.Event()
        result = {"state": "unavailable", "code": "core_runtime_bootstrap_unavailable"}
        async def ready(call):
            nonlocal result
            try:
                for command in COMMANDS:
                    challenge = secrets.token_hex(24)
                    response = await call(command, challenge=challenge)
                    if response.get("success") is True:
                        result = evaluate(response.get("result"), challenge)
                        break
                    if response.get("error", {}).get("code") != "unknown_command":
                        result = {"state": "unavailable", "code": "core_runtime_unavailable"}
                        break
            finally:
                stop.set()
        async with asyncio.timeout(timeout_s):
            await ha_client.ws_session(settings, ready, lambda _: None, stop)
        return result
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        try:
            return asyncio.run(collect())
        except Exception:
            return {"state": "unavailable", "code": "core_runtime_unavailable"}
    return {"state": "unavailable", "code": "core_runtime_observation_thread_required"}
