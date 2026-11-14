"""WISKEY-INSTALLER-NATIVE-2400 phase 4 (plan 2026-11-03 rows 50 and 82): the rest of WisKey's platform from Arx - station metadata and
maintenance windows, configuration export / import, the webhook, the maintenance queue, event retention, integrity, capacity and the
fleet configuration change (preview -> apply).

WisKey rc.10 (`operations_api.py`, `operations_center.py`, `maintenance_api.py`, `maintenance_jobs.py`, `capacity_history.py`; every one
administrator-only - `require_owner`; `platform/get|capacity|integrity|demo|config_read|maintenance_jobs` are READ commands, the rest carry
`api_contract`):

| op                  | command                       | keys                                   | notes |
|---------------------|-------------------------------|----------------------------------------|-------|
| `get`               | `platform/get`                | -                                      | the operations centre without its two keys; Arx keeps revision, retention, webhook (no key), station metadata, receipts, event usage |
| `capacity`          | `platform/capacity`           | -                                      | users / cards per station against the advertised limit, observed growth, days to the limit (an ESTIMATE) |
| `integrity`         | `platform/integrity`          | -                                      | which stores loaded; `writes_performed: false` |
| `demo`              | `platform/demo`               | -                                      | WisKey's synthetic walk-through (no device, no store) |
| `station_save`      | `platform/save`               | `collection="stations"`, `record_id`, `revision`, `values` | zone, owner, tags, alert thresholds, maintenance window |
| `export`            | `platform/export`             | -                                      | preferences only (WisKey: no users, rights, keys, destinations, journals) |
| `import_preview`    | `platform/import_preview`     | `content`, `mapping`                   | a one-use review; nothing saved |
| `import_apply`      | `platform/import_apply`       | `review_id`, `confirmed`               | typed "ייבוא תצורה" - replaces the station metadata it names and ALL message templates |
| `webhook_save`      | `platform/webhook_save`       | `revision`, `values`, `confirmed`      | https only, no credentials in the URL |
| `webhook_key`       | `platform/webhook_key`        | `confirmed`                            | typed "הצגת המפתח"; the signing KEY goes to the browser once (no-store) and to no log or audit row |
| `retention_preview` | `platform/retention_preview`  | `values{days,count,bytes}`             | how many event records the policy would drop |
| `retention_apply`   | `platform/retention_apply`    | `review_id`, `confirmed`               | typed "מחיקת אירועים"; deletes event records |
| `config_read`       | `platform/config_read`        | `station_ids`, `door`                  | 1-12 stations; each station's door read from the device |
| `config_preview`    | `platform/config_preview`     | `station_ids`, `door`, `changes`       | before / after per station, maintenance windows respected |
| `config_apply`      | `platform/config_apply`       | `review_id`, `confirmed`               | typed "החלה על העמדות"; a receipt per station (verified / failed + code) - a partial failure is shown per station |
| `maint_preview`     | `platform/maintenance_preview`| `station_ids`, `door`, `changes`       | as config_preview, with each station's window |
| `maint_enqueue`     | `platform/maintenance_enqueue`| `review_id`, `confirmed`               | typed "תזמון תחזוקה"; WisKey's worker writes each station inside its window (every 30 s) |
| `maint_jobs`        | `platform/maintenance_jobs`   | -                                      | the queue: job and row states are the progress |
| `maint_cancel`      | `platform/maintenance_cancel` | `job_id`, `fingerprint`, `confirmed`   | rows not yet written are cancelled |

Not driven from Arx (reported as gaps / decisions): `platform/config_pending|config_review|config_decide`, `maintenance_decide`,
`lifecycle_decide` (WisKey's dual approval needs a SECOND WisKey administrator; Arx has one identity), `platform/maintenance_resume_v1`
(the native bridge owner of policy B), `platform/archive` and `platform/report` (event history leaves WisKey with person data - the
event screens of Arx own that), `platform/delete` (views / reports / templates / door presets are WisKey panel objects)."""
from __future__ import annotations

import re
from typing import Any
from urllib.parse import urlsplit

from . import intercom_adapter as ad
from .wiskey_installer import WRITE_TIMEOUT_S, Op

THRESHOLD_KEYS = ("offline", "sync_stalled", "event_gap")
WEBHOOK_KINDS = ("access_event", "security_denied", "configuration_result")
RECEIPT_STATES = frozenset({"verified", "failed"})
JOB_STATES = frozenset({"queued", "awaiting_approval", "rejected", "cancelled", "verified", "completed_with_errors", "expired"})
ROW_STATES = frozenset({"pending", "writing", "verified", "failed", "uncertain", "cancelled"})
ALERTS = frozenset({"unknown", "stale", "at_limit", "near_limit", "growth_to_limit", "observed"})
HHMM = re.compile(r"(?:[01]\d|2[0-3]):[0-5]\d")
TZ = re.compile(r"[A-Za-z0-9_+\-/]{1,100}")
DOOR_FIELDS = ("doorName", "openDuration", "relayReverseEnabled")


# ---------------------------------------------------------------- validation before sending (WisKey operations_center.record / window / retention)

def window_errors(w: Any) -> list[str]:
    if not isinstance(w, dict) or set(w) != {"enabled", "days", "start", "end", "timezone"}:
        return ["window"]
    bad = []
    if type(w["enabled"]) is not bool:
        bad.append("window.enabled")
    days = w["days"]
    if not isinstance(days, list) or any(type(d) is not int or not 0 <= d <= 6 for d in days) or len(set(days)) != len(days) or (w.get("enabled") and not days):
        bad.append("window.days")
    for k in ("start", "end"):
        if not isinstance(w[k], str) or not HHMM.fullmatch(w[k]):
            bad.append(f"window.{k}")
    if not bad and w["start"] >= w["end"]:
        bad.append("window.end")
    if not isinstance(w["timezone"], str) or not TZ.fullmatch(w["timezone"]):
        bad.append("window.timezone")
    return bad


def station_values_errors(v: Any) -> list[str]:
    if not isinstance(v, dict) or set(v) != {"zone", "owner", "tags", "thresholds", "window"}:
        return ["values"]
    bad = []
    for k in ("zone", "owner"):
        if not isinstance(v[k], str) or len(v[k]) > 120 or any(ord(c) < 32 for c in v[k]):
            bad.append(k)
    tags = v["tags"]
    if not isinstance(tags, list) or len(tags) > 16 or any(not isinstance(t, str) or not 1 <= len(t) <= 40 or any(ord(c) < 32 for c in t) for t in tags):
        bad.append("tags")
    th = v["thresholds"]
    if not isinstance(th, dict) or set(th) != set(THRESHOLD_KEYS) or any(type(x) is not int or not 60 <= x <= 86400 for x in th.values()):
        bad.append("thresholds")
    return bad + window_errors(v["window"])


def retention_errors(v: Any) -> list[str]:
    if not isinstance(v, dict) or set(v) != {"days", "count", "bytes"}:
        return ["values"]
    rules = {"days": (1, 365), "count": (100, 20000), "bytes": (262144, 25_165_824)}
    return [k for k, (lo, hi) in rules.items() if type(v[k]) is not int or not lo <= v[k] <= hi]


def webhook_errors(v: Any) -> list[str]:
    if not isinstance(v, dict) or set(v) != {"enabled", "url", "kinds"}:
        return ["values"]
    bad = []
    if type(v["enabled"]) is not bool:
        bad.append("enabled")
    kinds = v["kinds"]
    if not isinstance(kinds, list) or len(kinds) > 8 or any(k not in WEBHOOK_KINDS for k in kinds) or (v.get("enabled") is True and not kinds):
        bad.append("kinds")
    url = v["url"]
    if not isinstance(url, str) or len(url) > 1000:
        bad.append("url")
    elif url or v.get("enabled") is True:
        try:
            p = urlsplit(url)
            port = p.port
        except ValueError:
            return bad + ["url"]
        if p.scheme != "https" or not p.hostname or p.username or p.password or p.fragment or p.query or port not in (None, 443, 8443):
            bad.append("url")
    return bad


def change_errors(changes: Any) -> list[str]:
    if not isinstance(changes, dict) or not changes or set(changes) - set(DOOR_FIELDS):
        return ["changes"]
    bad = []
    for k, v in changes.items():
        if k == "relayReverseEnabled" and type(v) is not bool:
            bad.append(k)
        if k == "openDuration" and (type(v) is not int or not 0 <= v <= 255):
            bad.append(k)
        if k == "doorName" and (not isinstance(v, str) or not 1 <= len(v) <= 64 or any(ord(c) < 32 for c in v)):
            bad.append(k)
    return bad


def targets_errors(station_ids: Any, door: Any) -> list[str]:
    bad = []
    if not isinstance(station_ids, list) or not 1 <= len(station_ids) <= 12 or len(set(station_ids)) != len(station_ids) or any(not ad._id(s) for s in station_ids):
        bad.append("station_ids")
    if door not in (1, 2) or type(door) is not int:
        bad.append("door")
    return bad


# ---------------------------------------------------------------- projections

def _window(w: Any) -> dict[str, Any] | None:
    if not isinstance(w, dict):
        return None
    return {"enabled": w.get("enabled") is True, "days": [d for d in (w.get("days") or [])[:7] if ad._int(d) is not None] if isinstance(w.get("days"), list) else [],
            "start": w.get("start") if isinstance(w.get("start"), str) and HHMM.fullmatch(w["start"]) else None,
            "end": w.get("end") if isinstance(w.get("end"), str) and HHMM.fullmatch(w["end"]) else None,
            "timezone": w.get("timezone") if isinstance(w.get("timezone"), str) and TZ.fullmatch(w["timezone"]) else None}


def _station_values(v: Any) -> dict[str, Any] | None:
    if not isinstance(v, dict):
        return None
    th = v.get("thresholds") if isinstance(v.get("thresholds"), dict) else {}
    return {"zone": ad._text(v.get("zone"), 120), "owner": ad._text(v.get("owner"), 120),
            "tags": [t for t in (v.get("tags") or [])[:16] if ad._text(t, 40)] if isinstance(v.get("tags"), list) else [],
            "thresholds": {k: ad._int(th.get(k)) for k in THRESHOLD_KEYS}, "window": _window(v.get("window"))}


def _webhook(w: Any) -> dict[str, Any]:
    w = w if isinstance(w, dict) else {}
    return {"enabled": w.get("enabled") is True, "url": ad._text(w.get("url"), 1000) or "",
            "kinds": [k for k in (w.get("kinds") or []) if k in WEBHOOK_KINDS] if isinstance(w.get("kinds"), list) else []}


def _receipt(r: Any) -> dict[str, Any]:
    r = r if isinstance(r, dict) else {}
    return {"at": ad._iso(r.get("at")), "station_id": ad._id(r.get("station_id")), "state": ad._enum(r.get("state"), RECEIPT_STATES), "code": ad._code(r.get("code") or None)}


def project_platform(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict) or ad._int(raw.get("revision")) is None:
        raise ValueError("unexpected platform answer")
    stations = raw.get("stations") if isinstance(raw.get("stations"), dict) else {}
    catalog = raw.get("catalog") if isinstance(raw.get("catalog"), dict) else {}
    usage = raw.get("event_usage") if isinstance(raw.get("event_usage"), dict) else {}
    ret = raw.get("retention") if isinstance(raw.get("retention"), dict) else {}
    return {
        "revision": raw["revision"],
        "retention": {k: ad._int(ret.get(k)) for k in ("days", "count", "bytes")},
        "webhook": _webhook(raw.get("webhook")),
        "stations": {sid: {"revision": raw["revision"], "values": _station_values((row or {}).get("values"))} for sid, row in list(stations.items())[:200] if ad._id(sid)},
        "catalog": {sid: ad._text(name, 64) for sid, name in list(catalog.items())[:200] if ad._id(sid)},
        "templates": len(raw.get("templates")) if isinstance(raw.get("templates"), dict) else None,
        "door_presets": len(raw.get("door_presets")) if isinstance(raw.get("door_presets"), dict) else None,
        "receipts": [_receipt(r) for r in (raw.get("receipts") if isinstance(raw.get("receipts"), list) else [])[-50:]],
        "event_usage": {k: ad._num(usage.get(k)) for k in ("records", "bytes", "days", "count_limit", "byte_limit", "observed_records_per_day", "count_horizon_days")}
        | {"storage_failed": ad._bool(usage.get("storage_failed"))},
        "capabilities": [c for c in (raw.get("capabilities") or [])[:16] if isinstance(c, str) and ad.CODE.fullmatch(c)] if isinstance(raw.get("capabilities"), list) else [],
    }


def _capacity_kind(v: Any) -> dict[str, Any]:
    v = v if isinstance(v, dict) else {}
    return {k: ad._num(v.get(k)) for k in ("count", "advertised_limit", "used_percent", "remaining", "observed_growth_per_day", "estimated_days_to_limit")} | {
        "alert": ad._enum(v.get("alert"), ALERTS)}


def project_capacity(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict) or not isinstance(raw.get("records"), list):
        raise ValueError("unexpected capacity answer")
    return {"records": [{"station_id": ad._id(r.get("station_id")), "name": ad._text(r.get("name"), 64), "sampled_at": ad._iso(r.get("sampled_at")),
                         "fresh": ad._bool(r.get("fresh")), "sample_count": ad._int(r.get("sample_count")), "users": _capacity_kind(r.get("users")),
                         "cards": _capacity_kind(r.get("cards"))} for r in raw["records"][:200] if isinstance(r, dict)],
            "forecast_is_estimate": True}


def project_integrity(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict) or not isinstance(raw.get("checks"), list):
        raise ValueError("unexpected integrity answer")
    return {"checks": [{"component": ad._code(c.get("component")), "state": ad._enum(c.get("state"), ("available", "unavailable", "invalid")),
                        "remedy": ad._code(c.get("remedy"))} for c in raw["checks"][:20] if isinstance(c, dict)],
            "writes_performed": raw.get("writes_performed") is True}


def project_demo(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict) or raw.get("demo") is not True:
        raise ValueError("unexpected demo answer")
    return {"demo": True, "steps": [s for s in (raw.get("steps") or [])[:12] if isinstance(s, str) and ad.CODE.fullmatch(s)],
            "device_writes": ad._int(raw.get("device_writes"))}


def project_export(raw: Any) -> dict[str, Any]:
    """The export as WisKey gives it (its own preferences file, no secrets by WisKey's construction); checked to be that shape."""
    if not isinstance(raw, dict) or raw.get("format") != "smplwise-operations" or raw.get("version") != 1:
        raise ValueError("unexpected export")
    return {"format": raw["format"], "version": 1, "stations": raw.get("stations") if isinstance(raw.get("stations"), dict) else {},
            "templates": raw.get("templates") if isinstance(raw.get("templates"), list) else []}


def project_import_review(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict) or not isinstance(raw.get("review_id"), str):
        raise ValueError("unexpected import review")
    return {"review_id": raw["review_id"][:200], "templates": ad._int(raw.get("templates")), "replaces_templates": raw.get("replaces_templates") is True,
            "stations": [{"source": ad._text(s.get("source"), 128), "name": ad._text(s.get("name"), 128), "target": ad._id(s.get("target")), "replaces": s.get("replaces") is True}
                         for s in (raw.get("stations") or [])[:500] if isinstance(s, dict)]}


def project_import_apply(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict):
        raise ValueError("unexpected import answer")
    return {"revision": ad._int(raw.get("revision")), "stations": ad._int(raw.get("stations"))}


def project_webhook_save(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict):
        raise ValueError("unexpected webhook answer")
    return {"revision": ad._int(raw.get("revision")), "enabled": raw.get("enabled") is True}


def project_key(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict) or not isinstance(raw.get("key"), str) or not re.fullmatch(r"[0-9a-f]{64}", raw["key"]):
        raise ValueError("unexpected key answer")
    return {"key": raw["key"]}


def project_retention_preview(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict) or not isinstance(raw.get("review_id"), str):
        raise ValueError("unexpected retention review")
    vals = raw.get("values") if isinstance(raw.get("values"), dict) else {}
    return {"review_id": raw["review_id"][:200], "before": ad._int(raw.get("before")), "after": ad._int(raw.get("after")), "removed": ad._int(raw.get("removed")),
            "values": {k: ad._int(vals.get(k)) for k in ("days", "count", "bytes")}}


def project_usage(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict):
        raise ValueError("unexpected usage")
    return {k: ad._num(raw.get(k)) for k in ("records", "bytes", "days", "count_limit", "byte_limit")}


def _door_values(v: Any) -> dict[str, Any] | None:
    if not isinstance(v, dict):
        return None
    out: dict[str, Any] = {}
    if ad._text(v.get("doorName"), 64) is not None:
        out["doorName"] = v["doorName"]
    if ad._int(v.get("openDuration")) is not None:
        out["openDuration"] = v["openDuration"]
    if ad._bool(v.get("relayReverseEnabled")) is not None:
        out["relayReverseEnabled"] = v["relayReverseEnabled"]
    return out


def project_config_read(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict) or not isinstance(raw.get("rows"), list):
        raise ValueError("unexpected configuration read")
    return {"rows": [{"station_id": ad._id(r.get("station_id")), "name": ad._text(r.get("name"), 64),
                      "values": _door_values((r.get("configuration") or {}).get("values")) if isinstance(r.get("configuration"), dict) else None,
                      "error": ad._code(r.get("error"))} for r in raw["rows"][:12] if isinstance(r, dict)]}


def project_change_preview(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict) or not isinstance(raw.get("rows"), list):
        raise ValueError("unexpected preview")
    return {"review_id": raw.get("review_id")[:200] if isinstance(raw.get("review_id"), str) else None,
            "count": ad._int(raw.get("apply_count") if "apply_count" in raw else raw.get("queue_count")),
            "rows": [{"station_id": ad._id(r.get("station_id")), "name": ad._text(r.get("name"), 64), "before": _door_values(r.get("before")),
                      "after": _door_values(r.get("after")), "window": _window(r.get("window")), "error": ad._code(r.get("error"))}
                     for r in raw["rows"][:12] if isinstance(r, dict)]}


def project_receipts(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict) or not isinstance(raw.get("receipts"), list):
        raise ValueError("unexpected receipts")
    receipts = [_receipt(r) for r in raw["receipts"][:12]]
    return {"receipts": receipts, "verified": sum(r["state"] == "verified" for r in receipts), "failed": sum(r["state"] != "verified" for r in receipts)}


def _job(j: Any) -> dict[str, Any]:
    j = j if isinstance(j, dict) else {}
    return {"id": j.get("id") if isinstance(j.get("id"), str) and len(j["id"]) <= 64 else None,
            "fingerprint": j.get("fingerprint") if isinstance(j.get("fingerprint"), str) and len(j["fingerprint"]) <= 128 else None,
            "state": ad._enum(j.get("state"), JOB_STATES), "created_at": ad._iso(j.get("created_at")), "expires_at": ad._iso(j.get("expires_at")),
            "own_request": ad._bool(j.get("own_request")), "dual_required": ad._bool(j.get("dual_required")),
            "rows": [{"station_id": ad._id(r.get("station_id")), "name": ad._text(r.get("name"), 64), "door": ad._int(r.get("door")),
                      "changes": _door_values(r.get("changes")), "state": ad._enum(r.get("state"), ROW_STATES), "code": ad._code(r.get("code") or None),
                      "window": _window(r.get("window"))} for r in (j.get("rows") or [])[:12] if isinstance(r, dict)]}


def project_jobs(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict) or not isinstance(raw.get("records"), list):
        raise ValueError("unexpected maintenance jobs")
    return {"records": [_job(j) for j in raw["records"][:50]]}


def project_enqueue(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict):
        raise ValueError("unexpected enqueue answer")
    return {"job_id": raw.get("job_id") if isinstance(raw.get("job_id"), str) and len(raw["job_id"]) <= 64 else None, "state": ad._enum(raw.get("state"), JOB_STATES)}


def project_station_save(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict):
        raise ValueError("unexpected save answer")
    return {"revision": ad._int(raw.get("revision")), "values": _station_values(raw.get("values"))}


# ---------------------------------------------------------------- audit summaries (counts and codes; no URL path, no key, no template text)

def _sum_station(p: dict[str, Any]) -> dict[str, Any]:
    return {"revision": p.get("revision")}


def _sum_webhook(p: dict[str, Any]) -> dict[str, Any]:
    return {"revision": p.get("revision"), "enabled": p.get("enabled")}


def _sum_key(_p: dict[str, Any]) -> dict[str, Any]:
    return {"revealed": True}  # never the key


def _sum_receipts(p: dict[str, Any]) -> dict[str, Any]:
    return {"verified": p.get("verified"), "failed": p.get("failed"), "codes": sorted({r.get("code") for r in p.get("receipts") or [] if r.get("code")})}


def _sum_usage(p: dict[str, Any]) -> dict[str, Any]:
    return {"records": p.get("records")}


def _sum_import(p: dict[str, Any]) -> dict[str, Any]:
    return {"revision": p.get("revision"), "stations": p.get("stations")}


def _sum_enqueue(p: dict[str, Any]) -> dict[str, Any]:
    return {"job_id": p.get("job_id"), "state": p.get("state")}


def _sum_jobs(p: dict[str, Any]) -> dict[str, Any]:
    return {"jobs": len(p.get("records") or [])}


T = WRITE_TIMEOUT_S
OPS: dict[str, Op] = {
    "get": Op("get", "platform/get", "read", "intercom.installer.platform_read", read_command=True, project=project_platform),
    "capacity": Op("capacity", "platform/capacity", "read", "intercom.installer.platform_read", read_command=True, project=project_capacity),
    "integrity": Op("integrity", "platform/integrity", "read", "intercom.installer.platform_read", read_command=True, project=project_integrity),
    "demo": Op("demo", "platform/demo", "read", "intercom.installer.platform_read", read_command=True, project=project_demo),
    "maint_jobs": Op("maint_jobs", "platform/maintenance_jobs", "read", "intercom.installer.platform_read", read_command=True, project=project_jobs),
    "config_read": Op("config_read", "platform/config_read", "read", "intercom.installer.platform_read", ("station_ids", "door"), read_command=True, timeout_s=T,
                      project=project_config_read),
    # previews: WisKey stores a one-use review token only (no setting, no device write) - a read for Arx, sent with api_contract
    "export": Op("export", "platform/export", "read", "intercom.installer.platform_read", project=project_export),
    "import_preview": Op("import_preview", "platform/import_preview", "read", "intercom.installer.platform_read", ("content", "mapping"), project=project_import_review),
    "retention_preview": Op("retention_preview", "platform/retention_preview", "read", "intercom.installer.platform_read", ("values",), project=project_retention_preview),
    "config_preview": Op("config_preview", "platform/config_preview", "read", "intercom.installer.platform_read", ("station_ids", "door", "changes"), timeout_s=T,
                         project=project_change_preview),
    "maint_preview": Op("maint_preview", "platform/maintenance_preview", "read", "intercom.installer.platform_read", ("station_ids", "door", "changes"), timeout_s=T,
                        project=project_change_preview),
    # writes
    "station_save": Op("station_save", "platform/save", "write", "intercom.installer.platform_station_save", ("collection", "record_id", "revision", "values"),
                       danger="confirm", scope="station", cooldown_s=2.0, project=project_station_save, summary=_sum_station),
    "webhook_save": Op("webhook_save", "platform/webhook_save", "write", "intercom.installer.platform_webhook_save", ("revision", "values", "confirmed"),
                       danger="confirm", cooldown_s=2.0, project=project_webhook_save, summary=_sum_webhook),
    "webhook_key": Op("webhook_key", "platform/webhook_key", "write", "intercom.installer.platform_webhook_key", ("confirmed",), danger="typed", cooldown_s=30.0,
                      typed_word="הצגת המפתח", project=project_key, summary=_sum_key),
    "import_apply": Op("import_apply", "platform/import_apply", "write", "intercom.installer.platform_import_apply", ("review_id", "confirmed"), danger="typed",
                       cooldown_s=10.0, typed_word="ייבוא תצורה", project=project_import_apply, summary=_sum_import),
    "retention_apply": Op("retention_apply", "platform/retention_apply", "write", "intercom.installer.platform_retention_apply", ("review_id", "confirmed"),
                          danger="typed", cooldown_s=10.0, typed_word="מחיקת אירועים", project=project_usage, summary=_sum_usage),
    "config_apply": Op("config_apply", "platform/config_apply", "write", "intercom.installer.platform_config_apply", ("review_id", "confirmed"), danger="typed",
                       timeout_s=T, cooldown_s=10.0, typed_word="החלה על העמדות", project=project_receipts, summary=_sum_receipts),
    "maint_enqueue": Op("maint_enqueue", "platform/maintenance_enqueue", "write", "intercom.installer.platform_maintenance_enqueue", ("review_id", "confirmed"),
                        danger="typed", cooldown_s=5.0, typed_word="תזמון תחזוקה", project=project_enqueue, summary=_sum_enqueue),
    "maint_cancel": Op("maint_cancel", "platform/maintenance_cancel", "write", "intercom.installer.platform_maintenance_cancel", ("job_id", "fingerprint", "confirmed"),
                       danger="confirm", cooldown_s=2.0, project=project_jobs, summary=_sum_jobs),
}
COMMANDS = frozenset(op.command for op in OPS.values())
