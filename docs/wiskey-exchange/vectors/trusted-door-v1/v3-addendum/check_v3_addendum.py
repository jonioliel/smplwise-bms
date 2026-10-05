#!/usr/bin/env python3
"""Offline checker for the v3-addendum vector package (wiskey-trusted-door-v1). Python 3.9+, standard library only.

No network, no subprocess, no writes. It checks:

1. JSON structure of MANIFEST.json and GOLDEN_VECTORS_v3_addendum.json (strict: duplicate keys, NaN/Infinity refused).
2. Unique case ids, also against the v2 and v3 case ids; counts per group equal the manifest.
3. SHA256SUMS lists every other file of this folder exactly once and every hash matches.
4. The earlier packages are unchanged: the pinned file hashes, the v1 `vectors` array hash inside GOLDEN_VECTORS.json,
   and the v3 metadata value that the addendum corrects.
5. Signed cases: service_data_json wraps signed_message_json; digests and the HMAC recomputed with the public TEST key;
   expected_response matches its schema; every forbidden response fails it; the corrected status_unknown schema refuses
   the three no-longer-valid reasons and still accepts every v3 status_unknown answer.
6. model_only / verified marking of every capabilities, clock and anchor case.

Usage:  python check_v3_addendum.py [--base DIR]
DIR holds the earlier files. Default: the exchange layout (this folder's parent, with v3/ beside it); otherwise the
repository layout (docs/contracts/wiskey-trusted-caller/, all files flat) found by walking up from this folder.
Exit code 0 = every check passed, 1 = at least one failure, 2 = a required file is missing.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import re
import sys
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
VECTORS = "GOLDEN_VECTORS_v3_addendum.json"
MANIFEST = "MANIFEST.json"
SUMS = "SHA256SUMS"
GROUPS = ("schema", "station", "capabilities", "clock", "anchor")
MODEL_ONLY_GROUPS = ("capabilities", "clock", "anchor")
KINDS = {"schema": "signed", "station": "signed", "clock": "signed", "capabilities": "capabilities_model", "anchor": "anchor_scenario"}
SCHEMA_KEYWORDS = {"type", "const", "enum", "pattern", "properties", "required", "additionalProperties", "oneOf"}
TOP_KEYS = {"format", "format_version", "protocol", "vectors_version", "package", "addendum_version", "generated_by", "status",
            "complements", "supersedes", "carried_supersedes", "test_hmac_key", "contract_addendum", "metadata_corrections",
            "case_format", "response_schema_dialect", "response_schemas", "counts", "cases"}
SIGNED_KEYS = {"id", "group", "category", "kind", "expect", "reason", "reject_stage", "reject_code", "service", "now", "now_iso",
               "signed_message_json", "service_data_json", "state_setup", "expected_side_effects", "response_schema",
               "expected_response"}
SIGNED_DIGEST_KEYS = {"signed_body", "canonical_utf8", "body_sha256", "hmac_input", "authenticated_message_sha256", "sig", "expected_dto"}
CAPS_KEYS = {"id", "group", "category", "kind", "expect", "reason", "service", "trigger", "cache_before", "service_call",
             "expected_selection", "expected_cache_after", "expected_actions", "model_only", "verified"}
ANCHOR_KEYS = {"id", "group", "category", "kind", "expect", "reason", "initial_state", "steps", "model_only", "verified"}
ANCHOR_OPS = {"bootstrap", "sample", "open", "replay_purge", "stop_trusted_calls", "rotate_hmac_generation",
              "verify_old_generation_rejected", "re_anchor_decrease", "resume_trusted_calls"}
SIDE_EFFECT_KEYS = {"pending_created", "dispatched", "status_read", "replay_purge_allowed", "fallback_used"}

failures: list[str] = []
passes = 0


def check(cond: bool, what: str) -> bool:
    global passes
    if cond:
        passes += 1
    else:
        failures.append(what)
    return cond


def strict_load(path: Path) -> Any:
    def pairs(items: list[tuple[str, Any]]) -> dict[str, Any]:
        keys = [k for k, _ in items]
        if len(keys) != len(set(keys)):
            raise ValueError(f"duplicate key in {path.name}")
        return dict(items)

    def no_const(c: str) -> Any:
        raise ValueError(f"non-JSON constant {c} in {path.name}")

    return json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=pairs, parse_constant=no_const)


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def schema_ok(schema: dict[str, Any], inst: Any) -> bool:
    if set(schema) - SCHEMA_KEYWORDS:
        raise ValueError(f"unknown schema keyword {set(schema) - SCHEMA_KEYWORDS}")
    t = schema.get("type")
    if t == "object" and not isinstance(inst, dict):
        return False
    if t == "string" and not isinstance(inst, str):
        return False
    if "const" in schema and not (type(inst) is type(schema["const"]) and inst == schema["const"]):
        return False
    if "enum" in schema and not any(type(inst) is type(e) and inst == e for e in schema["enum"]):
        return False
    if "pattern" in schema:
        p = schema["pattern"]
        if not isinstance(inst, str) or not (p.startswith("^") and p.endswith("$")) or not re.fullmatch(p[1:-1], inst):
            return False
    if isinstance(inst, dict):
        props = schema.get("properties", {})
        if any(k not in inst for k in schema.get("required", ())):
            return False
        if schema.get("additionalProperties") is False and set(inst) - set(props):
            return False
        if any(k in inst and not schema_ok(sub, inst[k]) for k, sub in props.items()):
            return False
    if "oneOf" in schema and sum(schema_ok(s, inst) for s in schema["oneOf"]) != 1:
        return False
    return True


def canonical(body: Any) -> str:
    return json.dumps(body, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def find_base(arg: str | None) -> tuple[Path, str]:
    if arg:
        b = Path(arg).resolve()
        return b, ("exchange" if (b / "v3").is_dir() else "repository")
    if (HERE.parent / "GOLDEN_VECTORS.json").is_file() and (HERE.parent / "v3" / "GOLDEN_VECTORS_v3.json").is_file():
        return HERE.parent, "exchange"
    for p in HERE.parents:
        c = p / "docs" / "contracts" / "wiskey-trusted-caller"
        if (c / "GOLDEN_VECTORS.json").is_file() and (c / "GOLDEN_VECTORS_v3.json").is_file():
            return c, "repository"
    return HERE.parent, "missing"


def earlier_path(base: Path, layout: str, rel: str) -> Path:
    parts = rel.split("/")[1:]  # drop the leading ".."
    return base.joinpath(*parts) if layout == "exchange" else base / parts[-1]


def main(argv: list[str]) -> int:
    base_arg = argv[argv.index("--base") + 1] if "--base" in argv else None
    for name in (VECTORS, MANIFEST, SUMS):
        if not (HERE / name).is_file():
            print(f"MISSING {name}")
            return 2
    doc = strict_load(HERE / VECTORS)
    man = strict_load(HERE / MANIFEST)

    # 1. structure and version fields
    check(set(doc) == TOP_KEYS, f"vectors top-level keys: {sorted(set(doc) ^ TOP_KEYS)}")
    for k, want in (("protocol", "wiskey-trusted-door-v1"), ("vectors_version", 3), ("package", "v3-addendum"), ("format_version", 1)):
        check(doc.get(k) == want and man.get(k) == want, f"version field {k}")
    check(type(doc.get("addendum_version")) is int and doc["addendum_version"] == man.get("addendum_version"), "addendum_version")
    check(doc["supersedes"] == man["supersedes"] and doc["complements"] == man["complements"], "manifest complements/supersedes == vectors")
    check(doc["test_hmac_key"]["value"] == "TEST-ONLY-golden-vectors-key-NOT-A-REAL-SECRET", "test key is the public v1-v3 TEST constant")
    key = doc["test_hmac_key"]["value"].encode("utf-8")
    schemas = doc["response_schemas"]
    check(schemas["status_unknown"]["properties"]["reason"]["enum"] == ["pending", "not_found_or_expired"],
          "corrected status_unknown.reason enum")
    check(doc["contract_addendum"]["status_unknown_reasons"] == ["pending", "not_found_or_expired"], "contract status_unknown_reasons")

    # 2. ids and counts
    cases = doc["cases"]
    ids = [c.get("id") for c in cases]
    check(all(isinstance(i, str) and i for i in ids), "every case has an id")
    dup = sorted({i for i in ids if ids.count(i) > 1})
    check(not dup, f"duplicate case ids: {dup}")
    counts: dict[str, int] = {g: 0 for g in GROUPS}
    for c in cases:
        if check(c.get("group") in GROUPS, f"{c.get('id')}: group"):
            counts[c["group"]] += 1
    for g in GROUPS:
        check(man["counts"][g]["total"] == counts[g] == doc["counts"][g]["total"], f"count of group {g}")
    check(man["counts"]["total"]["total"] == len(cases), "total count")

    # 3. SHA256SUMS
    listed: dict[str, str] = {}
    for line in (HERE / SUMS).read_text(encoding="utf-8").splitlines():
        m = re.fullmatch(r"([0-9a-f]{64})  (\S+)", line)
        if check(m is not None, f"SHA256SUMS line format: {line!r}"):
            check(m.group(2) not in listed, f"SHA256SUMS lists {m.group(2)} twice")
            listed[m.group(2)] = m.group(1)
    present = sorted(p.name for p in HERE.iterdir() if p.is_file() and p.name != SUMS)
    check(sorted(listed) == present, f"SHA256SUMS covers exactly the files present: listed={sorted(listed)} present={present}")
    for name, h in listed.items():
        if (HERE / name).is_file():
            check(sha256_file(HERE / name) == h, f"sha256 of {name}")
    check(sorted(f["path"] for f in man["files"]) == sorted(present + [SUMS]), "manifest file list == folder")

    # 4. earlier packages
    base, layout = find_base(base_arg)
    print(f"earlier files: {layout} layout at {base}")
    v2_ids: set[str] = set()
    v3_doc: dict[str, Any] | None = None
    if check(layout != "missing", "earlier files (GOLDEN_VECTORS.json, v3/GOLDEN_VECTORS_v3.json) found"):
        for f in man["earlier_files_pinned"]:
            p = earlier_path(base, layout, f["path"])
            if check(p.is_file(), f"earlier file present: {f['path']}"):
                check(sha256_file(p) == f["sha256"], f"earlier file unchanged: {f['path']}")
        if layout == "exchange":
            for rel, target in (("GOLDEN_VECTORS.sha256", "../GOLDEN_VECTORS.json"), ("v3/GOLDEN_VECTORS_v3.sha256", "../v3/GOLDEN_VECTORS_v3.json")):
                sp = base / rel
                if sp.is_file():
                    want = next(f["sha256"] for f in man["earlier_files_pinned"] if f["path"] == target)
                    check(sp.read_text(encoding="utf-8").split()[0] == want, f"{rel} matches the pinned hash")
        # plain json.loads, exactly as the v2 drift test reads it (its hash is already pinned above)
        v2 = json.loads(earlier_path(base, layout, "../GOLDEN_VECTORS.json").read_text(encoding="utf-8"))
        v1_sha = hashlib.sha256(canonical(v2["vectors"]).encode("utf-8")).hexdigest()
        check(v1_sha == man["v1_vectors_canonical_sha256"], "v1 vectors array unchanged (canonical SHA-256)")
        v2_ids = {v["id"] for v in v2["contract_vectors"]}
        v3_doc = strict_load(earlier_path(base, layout, "../v3/GOLDEN_VECTORS_v3.json"))
        v3_ids = {v["id"] for v in v3_doc["contract_vectors_v3"]}
        clash = sorted(set(ids) & (v2_ids | v3_ids))
        check(not clash, f"addendum ids do not reuse v2/v3 ids: {clash}")
        v3_by_id = {v["id"]: v for v in v3_doc["contract_vectors_v3"]}
        for mc in doc["metadata_corrections"]:
            v = v3_by_id.get(mc["case_id"])
            check(v is not None and v.get(mc["field"]) == mc["v3_value"] and mc["corrected_value"] == "not_applicable",
                  f"metadata correction targets the v3 value: {mc['case_id']}.{mc['field']}")
        for s in doc["supersedes"]:
            if "#case:" in s["target"]:
                check(s["target"].split("#case:")[1].split("/")[0] in v3_by_id, f"supersedes target exists: {s['target']}")
        for v in v3_doc["contract_vectors_v3"]:
            if v.get("response_schema") == "status_unknown":
                check(schema_ok(schemas["status_unknown"], v["expected_response"]), f"v3 case {v['id']} still valid under corrected status_unknown")

    # 5./6. cases
    for c in cases:
        cid, g = c["id"], c.get("group")
        check(c.get("kind") == KINDS.get(g), f"{cid}: kind")
        check(c.get("category") == g, f"{cid}: category == group")
        check(isinstance(c.get("reason"), str) and c["reason"], f"{cid}: reason")
        if g in MODEL_ONLY_GROUPS:
            check(c.get("model_only") is True and c.get("verified") is False, f"{cid}: model_only true, verified false")
        else:
            check("model_only" not in c, f"{cid}: not marked model_only")
        if c.get("kind") == "signed":
            check_signed(c, key, schemas, v3_doc)
        elif c.get("kind") == "capabilities_model":
            check(set(c) - {"open_response"} == CAPS_KEYS, f"{cid}: capabilities keys {sorted(set(c) ^ CAPS_KEYS)}")
            check(c["expect"] == "model", f"{cid}: expect model")
            sel = c["expected_selection"]
            check(set(sel) == {"enabled", "reason", "stations"} and type(sel["enabled"]) is bool, f"{cid}: expected_selection shape")
            acts = c["expected_actions"]
            check(acts.get("open_retried") is False and acts.get("alternate_relay_tried") is False
                  and acts.get("lock_fallback") is False and acts.get("stale_list_used") is False, f"{cid}: no retry/alternate/fallback/stale")
            call = c["service_call"]
            check(call is None or call.get("outcome") in ("ok", "service_missing", "timeout", "error"), f"{cid}: service_call outcome")
        elif c.get("kind") == "anchor_scenario":
            check(set(c) == ANCHOR_KEYS, f"{cid}: anchor keys {sorted(set(c) ^ ANCHOR_KEYS)}")
            check(c["expect"] == "model" and isinstance(c["steps"], list) and c["steps"], f"{cid}: steps")
            for i, s in enumerate(c["steps"]):
                check(s.get("op") in ANCHOR_OPS and isinstance(s.get("expect"), dict), f"{cid}: step {i} op/expect")

    print(f"cases: {len(cases)} ({', '.join(f'{g} {counts[g]}' for g in GROUPS)})")
    print(f"checks passed: {passes}, failed: {len(failures)}")
    for f in failures:
        print(f"FAIL {f}")
    print("RESULT: PASS" if not failures else "RESULT: FAIL")
    return 0 if not failures else 1


def check_signed(c: dict[str, Any], key: bytes, schemas: dict[str, Any], v3_doc: dict[str, Any] | None) -> None:
    cid = c["id"]
    missing = SIGNED_KEYS - set(c)
    check(not missing, f"{cid}: missing keys {sorted(missing)}")
    if missing:
        return
    check(c["expect"] in ("accept", "reject", "stateful"), f"{cid}: expect")
    check(json.loads(c["service_data_json"]) == {"signed_message_json": c["signed_message_json"]}, f"{cid}: service_data_json wraps the string")
    check(set(c["expected_side_effects"]) == SIDE_EFFECT_KEYS and c["expected_side_effects"]["fallback_used"] is False,
          f"{cid}: side effects shape, fallback_used false")
    wire = json.loads(c["signed_message_json"])
    body = {k: v for k, v in wire.items() if k not in ("ts", "nonce", "sig")}
    body_sha = hashlib.sha256(canonical(body).encode("utf-8")).hexdigest()
    hmac_input = f"{wire['ts']}.{wire['nonce']}.{body_sha}"
    sig = hmac.new(key, hmac_input.encode("utf-8"), hashlib.sha256).hexdigest()
    check(hmac.compare_digest(sig, wire["sig"]), f"{cid}: HMAC with the TEST key")
    if c["expect"] in ("accept", "stateful"):
        check(SIGNED_DIGEST_KEYS <= set(c), f"{cid}: digest fields")
        check(c.get("signed_body") == body and c.get("canonical_utf8") == canonical(body), f"{cid}: signed_body / canonical")
        check(c.get("body_sha256") == body_sha and c.get("hmac_input") == hmac_input and c.get("sig") == sig, f"{cid}: digests")
        check(c.get("authenticated_message_sha256") == hashlib.sha256(hmac_input.encode("utf-8")).hexdigest(), f"{cid}: authenticated digest")
        dto = c.get("expected_dto", {})
        check(dto.get("request_id") == wire["request_id"] and dto.get("nonce") == wire["nonce"] and dto.get("body_sha256") == body_sha,
              f"{cid}: expected_dto binds the message")
    name = c["response_schema"]
    if check(name in schemas, f"{cid}: response_schema known"):
        check(schema_ok(schemas[name], c["expected_response"]), f"{cid}: expected_response matches {name}")
        resp = c["expected_response"]
        if resp.get("result") == "rejected":
            check((resp.get("stage"), resp.get("code")) == (c["reject_stage"], c["reject_code"]), f"{cid}: refusal stage/code")
            check(resp.get("request_id") == wire["request_id"], f"{cid}: refusal echoes this request_id")
            se = c["expected_side_effects"]
            check(not se["pending_created"] and not se["dispatched"] and not se["status_read"], f"{cid}: refusal has no side effect")
        elif "request_id" in resp:
            check(resp["request_id"] == wire["request_id"], f"{cid}: response request_id is this call's")
        for f in c.get("forbidden_responses", ()):
            check(not schema_ok(schemas[name], f["response"]), f"{cid}: forbidden response fails {name}")
            if "must_fail_schema" in f:
                check(not schema_ok(schemas[f["must_fail_schema"]], f["response"]), f"{cid}: forbidden response fails corrected {f['must_fail_schema']}")
                if v3_doc is not None and f.get("accepted_by_v3_schema") is True:
                    check(schema_ok(v3_doc["response_schemas"][f["must_fail_schema"]], f["response"]),
                          f"{cid}: the same response was accepted by the v3 schema (what the correction closes)")
    if c["group"] == "station" and c["expected_response"].get("result") == "rejected":
        check(c["state_setup"].get("lock_fallback_configured") is True, f"{cid}: a lock exists and is still not used")


if __name__ == "__main__":
    try:
        sys.exit(main(sys.argv[1:]))
    except (ValueError, KeyError, TypeError) as e:
        print(f"FAIL structure: {type(e).__name__}: {e}")
        print("RESULT: FAIL")
        sys.exit(1)
