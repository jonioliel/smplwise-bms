"""CR-023 P2: electricity billing - customers, accounts, tariffs and VAT, the bill computation and its sealed snapshot,
numbering, the bill lifecycle, billing settings and the automatic generation at the end of each period.

Contracts: docs/architecture/ELECTRICITY_BILLING_API.md (REST), docs/architecture/ELECTRICITY_BILL_SNAPSHOT.md (the
document), docs/architecture/ELECTRICITY_BILLING_PROVIDER.md (what is read from the readings store). Owner decisions
2026-10-04 (rounds 1-3) win over the CR text where they differ.

Locking: the computation reads the readings store and the main database through a READ connection; only the short final
write (insert / seal / state change) takes the main write lock, and re-checks the row version it computed against."""
from __future__ import annotations

import base64
import datetime as dt
import hashlib
import io
import json
import logging
import re
import sqlite3
from dataclasses import dataclass
from decimal import Decimal
from pathlib import Path
from typing import Any

from .. import __version__
from ..audit import audit
from ..db import Database, get_setting, new_id, now_iso, set_setting
from ..errors import ApiError, conflict, not_found
from . import energy_formula as fx
from . import energy_periods as per
from . import energy_pricing as px
from . import energy_settings as es
from .energy_billing_provider import BillingReadings, get_provider
from .energy_consumption import MeterWindow, meter_window

log = logging.getLogger("smplwise.energy_billing")

SCHEMA = "arx.energy.bill_snapshot/1"
ENGINE = "arx.energy.billing/1"
SETTINGS_KEY = "energy.billing"  # registered in the energy settings registry below (own route /energy/billing-settings)
ISSUED_STATES = ("issued", "sent", "paid")
NOT_REPORTING_AFTER = dt.timedelta(minutes=60)  # the default; the effective value is energy.stale_after_minutes (stale_after(conn))
HISTORY_PERIODS = 12
AUTO_MAX_PER_ACCOUNT = 24
AUTO_RETRY = dt.timedelta(hours=6)
STATE_HE = {"draft": "טיוטה", "issued": "הונפק", "sent": "נשלח", "paid": "שולם", "void": "בוטל"}


def now_utc() -> dt.datetime:
    """The one clock seam of billing (tests pin it)."""
    return dt.datetime.now(dt.timezone.utc)


def _iso(at: dt.datetime | None) -> str | None:
    if at is None:
        return None
    return at.astimezone(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _parse_iso(s: str | None) -> dt.datetime | None:
    if not s:
        return None
    return dt.datetime.strptime(s, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=dt.timezone.utc)


def _date(s: str) -> dt.date:
    return dt.date.fromisoformat(s)


def canonical(obj: Any) -> bytes:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def sha256_of(obj: Any) -> str:
    return hashlib.sha256(canonical(obj)).hexdigest()


def _err(status: int, code: str, message: str, **details: Any) -> ApiError:
    return ApiError(status, code, message, details=details)


def _kwh(wh: Decimal) -> Decimal:
    return wh / Decimal(1000)


def _fmt_local(at: dt.datetime, tz: str) -> str:
    return at.astimezone(per.zone(tz)).strftime("%d.%m.%Y %H:%M")


def _fmt_date(d: dt.date) -> str:
    return d.strftime("%d.%m.%Y")


# ====================================================================== settings

DEFAULT_SETTINGS: dict[str, Any] = {
    "revision": 0,
    "default_price_mode": "ex_vat",
    "payment_terms": {"mode": "net_days", "days": 14, "day_of_month": 15},
    "business": {"name": "", "registration_no": "", "address": "", "phone": "", "email": "", "accent_color": "#2767ed", "footer_note": ""},
    "numbering": {"customer_digits": 4, "format": "YYYY-MM-NNNN"},
    "auto": {"delay_hours": 6},
    "logo": None,
}
_COLOR = re.compile(r"^#[0-9a-fA-F]{6}$")
# One registry of energy.* settings (services/energy_settings.py): the billing document is registered there with its own route.
es.register(es.SettingSpec(SETTINGS_KEY, DEFAULT_SETTINGS, "json", es.MANAGE, read_permission=es.BILLS, max_length=20000,
                           label_he="הגדרות חיוב", own_route="/energy/billing-settings"))


def stale_after(conn: sqlite3.Connection) -> dt.timedelta:
    """A meter whose last report is older than this before the period end is 'not reporting' (energy.stale_after_minutes)."""
    try:
        return dt.timedelta(minutes=es.stale_after_minutes(conn))
    except sqlite3.Error:
        return NOT_REPORTING_AFTER


def read_settings(conn: sqlite3.Connection) -> dict[str, Any]:
    raw = get_setting(conn, SETTINGS_KEY)
    out = json.loads(json.dumps(DEFAULT_SETTINGS))
    try:
        stored = json.loads(raw) if raw else {}
    except ValueError:
        stored = {}
    if isinstance(stored, dict):
        for k, v in stored.items():
            if k in out and isinstance(out[k], dict) and isinstance(v, dict):
                out[k].update({kk: vv for kk, vv in v.items() if kk in out[k]})
            elif k in out:
                out[k] = v
    out["numbering"]["format"] = "YYYY-MM-NNNN"
    return out


def update_settings(conn: sqlite3.Connection, patch: dict[str, Any], base_revision: int | None) -> tuple[dict[str, Any], list[str]]:
    cur = read_settings(conn)
    if base_revision is not None and base_revision != cur["revision"]:
        raise conflict("revision_conflict", "ההגדרות שונו בינתיים. יש לרענן ולנסות שוב.", current_revision=cur["revision"])
    changed: list[str] = []
    if "default_price_mode" in patch:
        if patch["default_price_mode"] not in ("ex_vat", "inc_vat"):
            raise _err(422, "validation", "מצב מחיר לא מוכר.", fields=["default_price_mode"])
        cur["default_price_mode"] = patch["default_price_mode"]
        changed.append("default_price_mode")
    if "payment_terms" in patch:
        t = {**cur["payment_terms"], **patch["payment_terms"]}
        if t["mode"] not in ("net_days", "day_of_month") or not (0 <= int(t["days"]) <= 120) or not (1 <= int(t["day_of_month"]) <= 31):
            raise _err(422, "validation", "תנאי התשלום אינם תקינים.", fields=["payment_terms"])
        cur["payment_terms"] = {"mode": t["mode"], "days": int(t["days"]), "day_of_month": int(t["day_of_month"])}
        changed.append("payment_terms")
    if "business" in patch:
        b = {**cur["business"], **patch["business"]}
        if b.get("accent_color") and not _COLOR.match(b["accent_color"]):
            raise _err(422, "validation", "צבע לא תקין (#RRGGBB).", fields=["business.accent_color"])
        cur["business"] = {k: str(b.get(k) or "")[:500] for k in DEFAULT_SETTINGS["business"]}
        changed.append("business")
    if "numbering" in patch:
        d = int(patch["numbering"].get("customer_digits", cur["numbering"]["customer_digits"]))
        if not 4 <= d <= 9:
            raise _err(422, "validation", "מספר הספרות של מספר לקוח הוא 4 עד 9.", fields=["numbering.customer_digits"])
        cur["numbering"]["customer_digits"] = d
        changed.append("numbering")
    if "auto" in patch:
        h = int(patch["auto"].get("delay_hours", cur["auto"]["delay_hours"]))
        if not 0 <= h <= 72:
            raise _err(422, "validation", "ההשהיה היא 0 עד 72 שעות.", fields=["auto.delay_hours"])
        cur["auto"]["delay_hours"] = h
        changed.append("auto")
    cur["revision"] += 1
    _store_settings(conn, cur)
    return cur, changed


def _store_settings(conn: sqlite3.Connection, s: dict[str, Any]) -> None:
    set_setting(conn, SETTINGS_KEY, json.dumps(s, ensure_ascii=False, sort_keys=True))


# ---------------------------------------------------------------- logo (content addressed, never deleted while referenced)

LOGO_MAX_PX = 800  # services/bill_pdf_logo.MAX_LOGO_SIDE
LOGO_ERROR_HE = {
    "logo_empty": "לא נבחר קובץ לוגו.",
    "logo_too_large": "הלוגו חייב להיות PNG או JPEG עד 1MB.",
    "logo_type": "הלוגו חייב להיות PNG או JPEG עד 1MB.",
    "logo_dimensions": "תמונת הלוגו גדולה מדי.",
    "logo_undecodable": "לא ניתן לקרוא את קובץ הלוגו.",
}


def store_logo(conn: sqlite3.Connection, data_dir: Path, content: bytes) -> dict[str, Any]:
    """The upload goes through the PDF renderer's own logo rules (services/bill_pdf_logo.sanitize_logo: PNG/JPEG by magic bytes,
    <= 1 MB, <= 25 megapixels, scaled to <= 800 px, metadata dropped, re-encoded as a new PNG), so a logo that is accepted
    here is never dropped at render time."""
    from PIL import Image

    from .bill_pdf_logo import LogoError, sanitize_logo

    try:
        png = sanitize_logo(content)
        with Image.open(io.BytesIO(png)) as im:
            width, height = im.size
    except LogoError as exc:
        code = str(exc)
        raise ApiError(422, "logo_invalid", LOGO_ERROR_HE.get(code, LOGO_ERROR_HE["logo_undecodable"]), details={"code": code}) from None
    digest = hashlib.sha256(png).hexdigest()
    rel = f"energy/assets/{digest}.png"
    path = data_dir / rel
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".tmp")
        tmp.write_bytes(png)
        tmp.replace(path)
    conn.execute("INSERT OR IGNORE INTO energy_assets(sha256, kind, mime, width, height, storage_path, created_at) VALUES (?, 'logo', 'image/png', ?, ?, ?, ?)",
                 (digest, width, height, rel, now_iso()))
    s = read_settings(conn)
    s["logo"] = {"sha256": digest, "mime": "image/png", "width": width, "height": height}
    s["revision"] += 1
    _store_settings(conn, s)
    return s["logo"]


def clear_logo(conn: sqlite3.Connection) -> None:
    s = read_settings(conn)
    s["logo"] = None
    s["revision"] += 1
    _store_settings(conn, s)


def logo_bytes(conn: sqlite3.Connection, data_dir: Path, sha: str | None) -> bytes | None:
    if not sha:
        return None
    row = conn.execute("SELECT storage_path FROM energy_assets WHERE sha256 = ?", (sha,)).fetchone()
    if not row:
        return None
    p = data_dir / row["storage_path"]
    try:
        data = p.read_bytes()
    except OSError:
        return None
    return data if hashlib.sha256(data).hexdigest() == sha else None


# ====================================================================== customers

_DIGITS = re.compile(r"^[0-9]{1,9}$")
CONTACT_FIELDS = ("address", "phone", "email", "tax_id", "notes")


def _pad(number: str, digits: int) -> str:
    return number.lstrip("0").rjust(digits, "0") if number.strip("0") else "0".rjust(digits, "0")


def next_customer_number(conn: sqlite3.Connection) -> str:
    digits = read_settings(conn)["numbering"]["customer_digits"]
    best = 0
    for (n,) in conn.execute("SELECT customer_number FROM energy_customers").fetchall():
        if n.isdigit():
            best = max(best, int(n))
    return str(best + 1).rjust(digits, "0")


def customer_dict(conn: sqlite3.Connection, row: sqlite3.Row, contact: bool) -> dict[str, Any]:
    n = conn.execute("SELECT COUNT(*) FROM energy_accounts WHERE customer_id = ? AND deleted_at IS NULL", (row["id"],)).fetchone()[0]
    out = {"id": row["id"], "customer_number": row["customer_number"], "name": row["name"], "revision": row["revision"],
           "created_at": row["created_at"], "updated_at": row["updated_at"], "account_count": n}
    if contact:
        out.update({k: row[k] for k in CONTACT_FIELDS})
    return out


def get_customer(conn: sqlite3.Connection, cid: str) -> sqlite3.Row:
    row = conn.execute("SELECT * FROM energy_customers WHERE id = ? AND deleted_at IS NULL", (cid,)).fetchone()
    if not row:
        raise not_found("הלקוח לא נמצא.")
    return row


def _customer_number(conn: sqlite3.Connection, raw: str | None, exclude_id: str | None = None) -> str:
    digits = read_settings(conn)["numbering"]["customer_digits"]
    if raw is None or str(raw).strip() == "":
        return next_customer_number(conn)
    raw = str(raw).strip()
    if not _DIGITS.match(raw):
        raise _err(422, "validation", "מספר לקוח חייב להכיל ספרות בלבד (עד 9).", fields=["customer_number"])
    num = _pad(raw, digits)
    clash = conn.execute("SELECT id FROM energy_customers WHERE customer_number = ? AND id IS NOT ?", (num, exclude_id)).fetchone()
    if clash:
        raise conflict("customer_number_taken", "מספר הלקוח כבר בשימוש.", customer_number=num)
    return num


def create_customer(conn: sqlite3.Connection, actor_id: str | None, body: dict[str, Any]) -> str:
    num = _customer_number(conn, body.get("customer_number"))
    cid = new_id()
    now = now_iso()
    conn.execute(
        "INSERT INTO energy_customers(id, customer_number, name, address, phone, email, tax_id, notes, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (cid, num, body["name"].strip(), *(str(body.get(k) or "").strip() for k in CONTACT_FIELDS), actor_id, now, now),
    )
    return cid


def update_customer(conn: sqlite3.Connection, cid: str, body: dict[str, Any]) -> list[str]:
    row = get_customer(conn, cid)
    if body["base_revision"] != row["revision"]:
        raise conflict("revision_conflict", "הלקוח שונה בינתיים. יש לרענן ולנסות שוב.", current_revision=row["revision"])
    fields: dict[str, Any] = {}
    if "customer_number" in body and body["customer_number"] is not None:
        num = _customer_number(conn, body["customer_number"], exclude_id=cid)
        if num != row["customer_number"]:
            if conn.execute("SELECT 1 FROM energy_bills WHERE customer_id = ? AND number IS NOT NULL LIMIT 1", (cid,)).fetchone():
                raise conflict("customer_number_locked", "ללקוח יש חיובים ממוספרים; מספר הלקוח אינו ניתן לשינוי.")
            fields["customer_number"] = num
    if body.get("name") is not None:
        fields["name"] = body["name"].strip()
    for k in CONTACT_FIELDS:
        if body.get(k) is not None:
            fields[k] = str(body[k]).strip()
    if fields:
        sets = ", ".join(f"{k} = ?" for k in fields)
        conn.execute(f"UPDATE energy_customers SET {sets}, revision = revision + 1, updated_at = ? WHERE id = ?", (*fields.values(), now_iso(), cid))
    return sorted(fields)


def delete_customer(conn: sqlite3.Connection, cid: str, base_revision: int) -> None:
    row = get_customer(conn, cid)
    if base_revision != row["revision"]:
        raise conflict("revision_conflict", "הלקוח שונה בינתיים. יש לרענן ולנסות שוב.", current_revision=row["revision"])
    if conn.execute("SELECT 1 FROM energy_accounts WHERE customer_id = ? AND deleted_at IS NULL LIMIT 1", (cid,)).fetchone():
        raise conflict("customer_has_accounts", "ללקוח יש חשבונות פעילים. יש להעביר או למחוק אותם קודם.")
    # contact details are erased; the customer number stays reserved; issued bills keep their own snapshot copy
    conn.execute("UPDATE energy_customers SET deleted_at = ?, address = '', phone = '', email = '', tax_id = '', notes = '', revision = revision + 1, updated_at = ? WHERE id = ?",
                 (now_iso(), now_iso(), cid))


# ====================================================================== tariffs and VAT

def price_versions(conn: sqlite3.Connection, tariff_id: str) -> list[px.PriceVersion]:
    return [px.PriceVersion(r["id"], _date(r["effective_from"]), Decimal(r["price"]), r["price_mode"])
            for r in conn.execute("SELECT * FROM energy_tariff_versions WHERE tariff_id = ? ORDER BY effective_from", (tariff_id,)).fetchall()]


def vat_rates(conn: sqlite3.Connection) -> list[px.VatRate]:
    return [px.VatRate(r["id"], _date(r["effective_from"]), Decimal(r["rate_percent"]))
            for r in conn.execute("SELECT * FROM energy_vat_rates ORDER BY effective_from").fetchall()]


def get_tariff(conn: sqlite3.Connection, tid: str) -> sqlite3.Row:
    row = conn.execute("SELECT * FROM energy_tariffs WHERE id = ? AND deleted_at IS NULL", (tid,)).fetchone()
    if not row:
        raise not_found("התעריף לא נמצא.")
    return row


def tariff_dict(conn: sqlite3.Connection, row: sqlite3.Row, today: dt.date) -> dict[str, Any]:
    versions = conn.execute("SELECT * FROM energy_tariff_versions WHERE tariff_id = ? ORDER BY effective_from", (row["id"],)).fetchall()
    vs = [{"id": v["id"], "effective_from": v["effective_from"], "price": v["price"], "price_mode": v["price_mode"], "created_at": v["created_at"]} for v in versions]
    cur = None
    for v in vs:
        if v["effective_from"] <= today.isoformat():
            cur = v
    used = conn.execute("SELECT COUNT(*) FROM energy_accounts WHERE tariff_id = ? AND deleted_at IS NULL", (row["id"],)).fetchone()[0]
    return {"id": row["id"], "name": row["name"], "currency": row["currency"], "kind": row["kind"], "versions": vs, "current": cur, "used_by": used}


def _version_used(conn: sqlite3.Connection, version_id: str, field: str) -> bool:
    for (snap,) in conn.execute("SELECT snapshot_json FROM energy_bills WHERE state IN ('issued','sent','paid','void') AND number IS NOT NULL").fetchall():
        try:
            lines = json.loads(snap).get("lines") or []
        except ValueError:
            continue
        if any(ln.get(field) == version_id for ln in lines):
            return True
    return False


def add_tariff_version(conn: sqlite3.Connection, tid: str, actor_id: str | None, effective_from: dt.date, price: Decimal, mode: str) -> str:
    if conn.execute("SELECT 1 FROM energy_tariff_versions WHERE tariff_id = ? AND effective_from = ?", (tid, effective_from.isoformat())).fetchone():
        raise conflict("version_exists", "כבר קיים מחיר מאותו תאריך.")
    vid = new_id()
    conn.execute("INSERT INTO energy_tariff_versions(id, tariff_id, effective_from, price, price_mode, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                 (vid, tid, effective_from.isoformat(), str(price), mode, actor_id, now_iso()))
    conn.execute("UPDATE energy_tariffs SET updated_at = ? WHERE id = ?", (now_iso(), tid))
    return vid


def _hdate(day: dt.date) -> str:
    return day.strftime("%d.%m.%Y")


def _sealed_periods(conn: sqlite3.Connection, version_ids: set[str]) -> list[tuple[dt.date, dt.date]]:
    """Periods (start inclusive, end exclusive) of sealed bills whose lines used one of `version_ids`."""
    out: list[tuple[dt.date, dt.date]] = []
    for row in conn.execute("SELECT period_start, period_end, snapshot_json FROM energy_bills WHERE state IN ('issued','sent','paid','void') AND number IS NOT NULL").fetchall():
        try:
            lines = json.loads(row["snapshot_json"]).get("lines") or []
        except ValueError:
            continue
        if any(ln.get("tariff_version_id") in version_ids for ln in lines):
            out.append((_date(row["period_start"]), _date(row["period_end"])))
    return out


def plan_version_change(conn: sqlite3.Connection, tid: str, target: sqlite3.Row, effective_from: dt.date, price: Decimal, mode: str) -> dict[str, Any]:
    """What a correction of `target` would do. A sealed bill never changes: when one covers the span the correction touches,
    the old price stays and the corrected one starts after the last sealed period (`later_only`)."""
    old_from = _date(target["effective_from"])
    if effective_from == old_from and price == Decimal(target["price"]) and mode == target["price_mode"]:
        raise conflict("nothing_changed", "לא בוצע שינוי במחיר.")
    others = [_date(r["effective_from"]) for r in conn.execute("SELECT effective_from FROM energy_tariff_versions WHERE tariff_id = ? AND id != ?", (tid, target["id"])).fetchall()]
    if effective_from in others:
        raise conflict("version_exists", "כבר קיים מחיר מהתאריך הזה. יש לערוך אותו במקום.")
    lo, anchor = min(old_from, effective_from), max(old_from, effective_from)
    nxt = min((d for d in others if d > anchor), default=None)
    ids = {r["id"] for r in conn.execute("SELECT id FROM energy_tariff_versions WHERE tariff_id = ?", (tid,)).fetchall()}
    sealed = [(a, b) for a, b in _sealed_periods(conn, ids) if b > lo and (nxt is None or a < nxt)]
    old = {"effective_from": old_from.isoformat(), "price": target["price"], "price_mode": target["price_mode"]}
    new = {"effective_from": effective_from.isoformat(), "price": str(price), "price_mode": mode}
    if not sealed:
        return {"kind": "in_place", "applies_from": effective_from.isoformat(), "old": old, "new": new,
                "message_he": "המחיר יוחלף. טיוטות, תחזית וחיובים עתידיים יחושבו במחיר החדש."}
    sealed_through = max(b for _, b in sealed)
    apply_from = max(effective_from, sealed_through)
    if apply_from in others or (nxt is not None and apply_from >= nxt):
        raise conflict("tariff_period_sealed", "החשבונות שכבר הופקו נשענים על המחיר הזה ולא ניתן לתקן אותו. הוסיפו מחיר חדש מתאריך מאוחר יותר.")
    new["effective_from"] = apply_from.isoformat()
    return {"kind": "later_only", "applies_from": apply_from.isoformat(), "old": old, "new": new,
            "message_he": f"החשבונות שכבר הופקו לא ישתנו. המחיר המתוקן יחול מ-{_hdate(apply_from)}."}


def apply_version_change(conn: sqlite3.Connection, tid: str, actor_id: str | None, target: sqlite3.Row, plan: dict[str, Any]) -> str:
    new = plan["new"]
    if plan["kind"] == "in_place":
        conn.execute("UPDATE energy_tariff_versions SET effective_from = ?, price = ?, price_mode = ? WHERE id = ?",
                     (new["effective_from"], new["price"], new["price_mode"], target["id"]))
        conn.execute("UPDATE energy_tariffs SET updated_at = ? WHERE id = ?", (now_iso(), tid))
        return target["id"]
    return add_tariff_version(conn, tid, actor_id, _date(new["effective_from"]), Decimal(new["price"]), new["price_mode"])


def delete_tariff_version(conn: sqlite3.Connection, tid: str, vid: str) -> None:
    row = conn.execute("SELECT * FROM energy_tariff_versions WHERE id = ? AND tariff_id = ?", (vid, tid)).fetchone()
    if not row:
        raise not_found("גרסת המחיר לא נמצאה.")
    if conn.execute("SELECT COUNT(*) FROM energy_tariff_versions WHERE tariff_id = ?", (tid,)).fetchone()[0] <= 1:
        raise conflict("tariff_in_use", "זה המחיר היחיד של התעריף.")
    if _version_used(conn, vid, "tariff_version_id"):
        raise conflict("tariff_in_use", "המחיר שימש בחיוב שהונפק ואינו ניתן למחיקה.")
    conn.execute("DELETE FROM energy_tariff_versions WHERE id = ?", (vid,))


def delete_tariff(conn: sqlite3.Connection, tid: str) -> None:
    get_tariff(conn, tid)
    if conn.execute("SELECT 1 FROM energy_accounts WHERE tariff_id = ? AND deleted_at IS NULL LIMIT 1", (tid,)).fetchone():
        raise conflict("tariff_in_use", "התעריף משמש חשבון פעיל.")
    conn.execute("UPDATE energy_tariffs SET deleted_at = ?, updated_at = ? WHERE id = ?", (now_iso(), now_iso(), tid))


def add_vat(conn: sqlite3.Connection, actor_id: str | None, effective_from: dt.date, rate: Decimal) -> str:
    if conn.execute("SELECT 1 FROM energy_vat_rates WHERE effective_from = ?", (effective_from.isoformat(),)).fetchone():
        raise conflict("version_exists", "כבר קיים שיעור מע״מ מאותו תאריך.")
    vid = new_id()
    conn.execute("INSERT INTO energy_vat_rates(id, effective_from, rate_percent, created_by, created_at) VALUES (?, ?, ?, ?, ?)",
                 (vid, effective_from.isoformat(), px.pct_str(rate), actor_id, now_iso()))
    return vid


def delete_vat(conn: sqlite3.Connection, vid: str) -> None:
    if not conn.execute("SELECT 1 FROM energy_vat_rates WHERE id = ?", (vid,)).fetchone():
        raise not_found("שיעור המע״מ לא נמצא.")
    if _version_used(conn, vid, "vat_rate_id"):
        raise conflict("tariff_in_use", "שיעור המע״מ שימש בחיוב שהונפק ואינו ניתן למחיקה.")
    conn.execute("DELETE FROM energy_vat_rates WHERE id = ?", (vid,))


# ====================================================================== accounts

def get_account(conn: sqlite3.Connection, aid: str) -> sqlite3.Row:
    row = conn.execute("SELECT * FROM energy_accounts WHERE id = ? AND deleted_at IS NULL", (aid,)).fetchone()
    if not row:
        raise not_found("החשבון לא נמצא.")
    return row


def get_account_any(conn: sqlite3.Connection, aid: str) -> sqlite3.Row:
    """Also a deleted account (its issued bills stay: marks and corrections keep working)."""
    row = conn.execute("SELECT * FROM energy_accounts WHERE id = ?", (aid,)).fetchone()
    if not row:
        raise not_found("החשבון לא נמצא.")
    return row


def cycle_of(acc: sqlite3.Row | dict) -> per.Cycle:
    return per.Cycle(int(acc["period_months"]), int(acc["period_anchor_day"]), int(acc["period_anchor_month"]), _date(acc["first_period_start"]))


def meter_names(provider: BillingReadings, ids: list[str] | None = None, include_retired: bool = True) -> dict[str, str]:
    names = {m.id: m.display_name for m in provider.list_meters(include_retired=include_retired)}
    return names if ids is None else {i: names[i] for i in ids if i in names}


def formula_from_input(provider: BillingReadings, formula: dict[str, Any]) -> fx.Compiled:
    """{text} or {ast} -> a compiled formula over meters the readings store knows (not retired). Raises fx.FormulaError."""
    names = meter_names(provider, include_retired=False)
    if "ast" in formula and formula["ast"] is not None:
        ast = fx.validate_ast(formula["ast"])
    elif isinstance(formula.get("text"), str):
        ast = fx.parse_text(formula["text"], names)
    else:
        raise fx.FormulaError("empty")
    return fx.compile_formula(ast, known=names.keys())


def formula_api(provider: BillingReadings, ast: dict[str, Any]) -> dict[str, Any]:
    ids = fx.meter_ids(ast)
    names = meter_names(provider, ids)
    return {"ast": ast, "text": fx.to_text(ast, names), "sentence_he": fx.sentence_he(ast, names), "meter_ids": ids}


def formula_error(e: fx.FormulaError) -> ApiError:
    return _err(422, "formula_invalid", e.as_dict()["message"], errors=[e.as_dict()])


def _account_fields(conn: sqlite3.Connection, provider: BillingReadings, body: dict[str, Any], current: sqlite3.Row | None, installation_tz: str) -> dict[str, Any]:
    f: dict[str, Any] = {}
    if "name" in body and body["name"] is not None:
        f["name"] = body["name"].strip()
    if body.get("customer_id") is not None:
        get_customer(conn, body["customer_id"])
        f["customer_id"] = body["customer_id"]
    if body.get("tariff_id") is not None:
        get_tariff(conn, body["tariff_id"])
        f["tariff_id"] = body["tariff_id"]
    if body.get("formula") is not None:
        try:
            comp = formula_from_input(provider, body["formula"])
        except fx.FormulaError as e:
            raise formula_error(e) from None
        f["formula_json"] = fx.dumps(comp.ast)
        f["_meters"] = comp.meter_ids
    for k in ("period_months", "period_anchor_day", "period_anchor_month", "auto_mode", "status"):
        if body.get(k) is not None:
            f[k] = body[k]
    if body.get("first_period_start") is not None:
        f["first_period_start"] = body["first_period_start"].isoformat() if isinstance(body["first_period_start"], dt.date) else body["first_period_start"]
    if body.get("timezone") is not None:
        if not per.valid_zone(body["timezone"]):
            raise _err(422, "validation", "אזור זמן לא מוכר.", fields=["timezone"])
        f["timezone"] = body["timezone"]
    elif current is None:
        f["timezone"] = installation_tz
    return f


def create_account(conn: sqlite3.Connection, provider: BillingReadings, actor_id: str | None, body: dict[str, Any], installation_tz: str) -> str:
    f = _account_fields(conn, provider, body, None, installation_tz)
    for k in ("name", "customer_id", "tariff_id", "formula_json", "period_months", "period_anchor_day", "first_period_start"):
        if k not in f:
            raise _err(422, "validation", "חסר שדה חובה.", fields=[k])
    aid = new_id()
    now = now_iso()
    meters = f.pop("_meters")
    conn.execute(
        """INSERT INTO energy_accounts(id, name, customer_id, formula_json, tariff_id, period_months, period_anchor_day, period_anchor_month,
             first_period_start, timezone, auto_mode, status, created_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)""",
        (aid, f["name"], f["customer_id"], f["formula_json"], f["tariff_id"], f["period_months"], f["period_anchor_day"], f.get("period_anchor_month", 1),
         f["first_period_start"], f["timezone"], f.get("auto_mode", "draft"), actor_id, now, now),
    )
    _set_account_meters(conn, aid, meters)
    return aid


def _set_account_meters(conn: sqlite3.Connection, aid: str, meters: list[str]) -> None:
    conn.execute("DELETE FROM energy_account_meters WHERE account_id = ?", (aid,))
    conn.executemany("INSERT INTO energy_account_meters(account_id, meter_id) VALUES (?, ?)", [(aid, m) for m in meters])


def update_account(conn: sqlite3.Connection, provider: BillingReadings, aid: str, body: dict[str, Any], installation_tz: str) -> list[str]:
    row = get_account(conn, aid)
    if body["base_revision"] != row["revision"]:
        raise conflict("revision_conflict", "החשבון שונה בינתיים. יש לרענן ולנסות שוב.", current_revision=row["revision"])
    f = _account_fields(conn, provider, body, row, installation_tz)
    meters = f.pop("_meters", None)
    if f:
        sets = ", ".join(f"{k} = ?" for k in f)
        conn.execute(f"UPDATE energy_accounts SET {sets}, revision = revision + 1, updated_at = ? WHERE id = ?", (*f.values(), now_iso(), aid))
    if meters is not None:
        _set_account_meters(conn, aid, meters)
    return sorted(f)


def delete_account(conn: sqlite3.Connection, aid: str, base_revision: int) -> int:
    row = get_account(conn, aid)
    if base_revision != row["revision"]:
        raise conflict("revision_conflict", "החשבון שונה בינתיים. יש לרענן ולנסות שוב.", current_revision=row["revision"])
    drafts = conn.execute("DELETE FROM energy_bills WHERE account_id = ? AND state = 'draft'", (aid,)).rowcount
    conn.execute("UPDATE energy_accounts SET deleted_at = ?, revision = revision + 1, updated_at = ? WHERE id = ?", (now_iso(), now_iso(), aid))
    conn.execute("DELETE FROM energy_account_meters WHERE account_id = ?", (aid,))
    return drafts


def account_dict(conn: sqlite3.Connection, provider: BillingReadings, row: sqlite3.Row, money: bool, today: dt.date | None = None) -> dict[str, Any]:
    cust = conn.execute("SELECT id, customer_number, name FROM energy_customers WHERE id = ?", (row["customer_id"],)).fetchone()
    tar = conn.execute("SELECT id, name FROM energy_tariffs WHERE id = ?", (row["tariff_id"],)).fetchone()
    tariff: dict[str, Any] = {"id": row["tariff_id"], "name": tar["name"] if tar else ""}
    today = today or per.local_date(now_utc(), row["timezone"])
    if money:
        cur = px.in_force(price_versions(conn, row["tariff_id"]), today)
        tariff.update({"price": str(cur.price) if cur else None, "price_mode": cur.mode if cur else None})
    c = cycle_of(row)
    nxt = per.period_containing(c, max(today, c.first_start))
    last = conn.execute("SELECT * FROM energy_bills WHERE account_id = ? ORDER BY period_end DESC, revision DESC, created_at DESC LIMIT 1", (row["id"],)).fetchone()
    return {
        "id": row["id"], "name": row["name"],
        "customer": {"id": cust["id"], "customer_number": cust["customer_number"], "name": cust["name"]} if cust else None,
        "formula": formula_api(provider, json.loads(row["formula_json"])),
        "tariff": tariff,
        "period_months": row["period_months"], "period_anchor_day": row["period_anchor_day"], "period_anchor_month": row["period_anchor_month"],
        "first_period_start": row["first_period_start"], "timezone": row["timezone"], "auto_mode": row["auto_mode"], "status": row["status"],
        "revision": row["revision"], "created_at": row["created_at"], "updated_at": row["updated_at"],
        "next_period": nxt.as_api() if nxt else None,
        "last_bill": bill_summary(conn, last, money) if last else None,
    }


# ====================================================================== the computation

@dataclass
class Computed:
    snapshot: dict[str, Any]
    kwh: str
    total: str
    end_caps: dict[str, str]


class ComputeError(ApiError):
    pass


def _prev_bill(conn: sqlite3.Connection, aid: str, start: dt.date) -> sqlite3.Row | None:
    return conn.execute(
        "SELECT * FROM energy_bills WHERE account_id = ? AND period_end = ? AND state IN ('issued','sent','paid') ORDER BY revision DESC, issued_at DESC LIMIT 1",
        (aid, start.isoformat()),
    ).fetchone()


def _carried_from(conn: sqlite3.Connection, aid: str, period: per.Period, w_start: dt.datetime) -> dict[str, dt.datetime]:
    prev = _prev_bill(conn, aid, period.start)
    if not prev:
        return {}
    out: dict[str, dt.datetime] = {}
    for m in json.loads(prev["snapshot_json"]).get("meters") or []:
        at = _parse_iso((m.get("end") or {}).get("at"))
        if at is not None and at < w_start:
            out[m["meter_id"]] = at
    return out


def _end_caps(conn: sqlite3.Connection, aid: str, period: per.Period, replaces: sqlite3.Row | None, w_end: dt.datetime) -> dict[str, dt.datetime]:
    """A correction of a bill that already has a successor keeps the original's per-meter end points, so the energy the
    successor carried is never billed twice."""
    if replaces is None:
        return {}
    succ = conn.execute("SELECT 1 FROM energy_bills WHERE account_id = ? AND period_start = ? AND state IN ('issued','sent','paid') LIMIT 1",
                        (aid, period.end.isoformat())).fetchone()
    if not succ:
        return {}
    out: dict[str, dt.datetime] = {}
    for m in json.loads(replaces["snapshot_json"]).get("meters") or []:
        at = _parse_iso((m.get("end") or {}).get("at"))
        if at is not None and at < w_end:
            out[m["meter_id"]] = at
    return out


def compute(conn: sqlite3.Connection, provider: BillingReadings, account: sqlite3.Row, period: per.Period, *, origin: str = "manual",
            replaces: sqlite3.Row | None = None, bill_id: str | None = None, now: dt.datetime | None = None) -> Computed:
    """The draft snapshot of `account` for `period` (raises ApiError: formula_invalid / formula_negative / tariff_missing /
    vat_missing). Reads only."""
    now = now or now_utc()
    tz = account["timezone"]
    customer = conn.execute("SELECT * FROM energy_customers WHERE id = ?", (account["customer_id"],)).fetchone()
    tariff = conn.execute("SELECT * FROM energy_tariffs WHERE id = ?", (account["tariff_id"],)).fetchone()
    settings = read_settings(conn)
    names_all = meter_names(provider)
    try:
        comp = fx.compile_formula(json.loads(account["formula_json"]), known=names_all.keys())
    except fx.FormulaError as e:
        raise formula_error(e) from None
    try:
        pieces = px.pieces(period.start, period.end, price_versions(conn, account["tariff_id"]), vat_rates(conn))
    except px.MissingRate as e:
        msg = "אין מחיר בתוקף לתאריך " if e.code == "tariff_missing" else "אין שיעור מע״מ בתוקף לתאריך "
        raise _err(422, e.code, msg + _fmt_date(e.day) + ".", date=e.day.isoformat()) from None
    bounds = [per.local_midnight_utc(p.start, tz) for p in pieces] + [per.local_midnight_utc(period.end, tz)]
    w_start, w_end = bounds[0], bounds[-1]
    carried = _carried_from(conn, account["id"], period, w_start)
    caps = _end_caps(conn, account["id"], period, replaces, w_end)
    windows: dict[str, MeterWindow] = {}
    for mid in comp.meter_ids:
        windows[mid] = meter_window(provider, mid, bounds, carried.get(mid), caps.get(mid))
    # lines: the formula per piece
    lines: list[px.Line] = []
    for i, piece in enumerate(pieces):
        values = {mid: windows[mid].pieces_wh[i] for mid in comp.meter_ids}
        kwh_exact = _kwh(comp.evaluate(values))
        if px.r2(kwh_exact) < 0:
            raise _err(422, "formula_negative", "התוצאה של נוסחת החשבון שלילית בתקופה " + _fmt_date(piece.start) + " - " + _fmt_date(piece.end - dt.timedelta(days=1)) + ". יש לתקן את הנוסחה או את המונים.",
                       period={"from": piece.start.isoformat(), "to": (piece.end - dt.timedelta(days=1)).isoformat()}, kwh=str(px.r2(kwh_exact)))
        lines.append(px.line(piece, kwh_exact))
    totals = px.totals(lines)
    # meters and notes
    notes: list[dict[str, Any]] = []
    meters_out: list[dict[str, Any]] = []
    stale = stale_after(conn)
    for mid in comp.meter_ids:
        w = windows[mid]
        name = names_all.get(mid, mid)
        cons = _kwh(w.wh)
        coef = comp.coefficients[mid]
        last_report = provider.last_report_at(mid)
        meters_out.append({
            "meter_id": mid, "name": name, "coefficient": fx._dec_str(coef),
            "start": {"at": _iso(w.start.at), "reading_kwh": str(px.r3(_kwh(w.start.reading_wh))) if w.start.reading_wh is not None else None, "kind": w.start.kind},
            "end": {"at": _iso(w.end.at), "reading_kwh": str(px.r3(_kwh(w.end.reading_wh))) if w.end.reading_wh is not None else None, "kind": w.end.kind},
            "consumption_kwh": px.s2(cons), "contribution_kwh": px.s2(cons * coef), "carried_in_kwh": px.s2(_kwh(w.carried_in_wh)),
            "resets": [{"at": _iso(r)} for r in w.resets],
            "last_report_at": _iso(last_report),
            "reported_to_end": bool(last_report is not None and last_report >= w_end - stale),
        })
        if last_report is None or last_report < w_end - stale:
            since = f"מאז {_fmt_local(last_report, tz)}" if last_report else "מעולם"
            notes.append({"code": "meter_not_reporting", "meter_id": mid, "at": _iso(last_report),
                          "text_he": f"המונה {name} לא מדווח {since}. הצריכה שלאחר מכן תחויב בחיוב הבא."})
        if w.carried_in_wh > 0:
            notes.append({"code": "carried_in", "meter_id": mid, "text_he": f"כולל {px.s2(_kwh(w.carried_in_wh))} קוט״ש של {name} מתקופה קודמת שדווחו באיחור."})
        for r in w.resets:
            notes.append({"code": "meter_reset", "meter_id": mid, "at": _iso(r), "text_he": f"כולל איפוס מונה {name} ב-{_fmt_local(r, tz)}."})
        for g0, g1 in w.long_gaps:
            notes.append({"code": "allocated_by_time", "meter_id": mid, "text_he": f"הצריכה של {name} בין {_fmt_local(g0, tz)} ל-{_fmt_local(g1, tz)} חולקה לפי זמן בגבול התקופה."})
    if len(pieces) > 1:
        cuts = ", ".join(_fmt_date(p.start) for p in pieces[1:])
        notes.append({"code": "period_split", "text_he": f"התקופה פוצלה ב-{cuts} בגלל שינוי מחיר או שיעור מע״מ."})
    terms = settings["payment_terms"]
    today_local = per.local_date(now, tz)
    names = {mid: names_all.get(mid, mid) for mid in comp.meter_ids}
    if replaces is not None:
        history = json.loads(replaces["snapshot_json"]).get("history")
        history = {**history, "current": {"from": period.start.isoformat(), "to": period.last_day.isoformat(), "kwh": totals["kwh"]}} if history else None
    else:
        history = None
    if history is None:
        history = compute_history(conn, provider, account, period, comp, totals["kwh"])
    biz = dict(settings["business"])
    biz["logo"] = settings["logo"]
    snapshot = {
        "schema": SCHEMA,
        "doc": {"title_he": "חשבון צריכת חשמל ודרישת תשלום", "subtitle_he": "אינו חשבונית מס", "is_tax_invoice": False},
        "bill": {
            "id": bill_id, "number": None, "revision": (replaces["revision"] + 1) if replaces is not None else 1,
            "replaces": {"bill_id": replaces["id"], "number": replaces["number"]} if replaces is not None else None,
            "state": "draft", "origin": origin, "issue_date": None, "due_date": None,
            "expected_due_date": px.due_date(today_local, terms).isoformat(), "payment_terms": terms,
            "issued_at": None, "issued_by": None,
        },
        "period": {"from": period.start.isoformat(), "to": period.last_day.isoformat(), "end_exclusive": period.end.isoformat(), "days": period.days,
                   "timezone": tz, "start_utc": _iso(w_start), "end_utc": _iso(w_end)},
        "business": biz,
        "customer": {"id": customer["id"], "customer_number": customer["customer_number"], "name": customer["name"],
                     **{k: customer[k] for k in ("address", "phone", "email", "tax_id")}},
        "account": {"id": account["id"], "name": account["name"], "tariff": {"id": tariff["id"], "name": tariff["name"]},
                    "formula": {"ast": comp.ast, "text": fx.to_text(comp.ast, names), "sentence_he": fx.sentence_he(comp.ast, names)}},
        "meters": meters_out,
        "lines": [ln.as_dict() for ln in lines],
        "totals": totals,
        "notes": notes,
        "history": history,
        "rounding": {"rule": "half_up", "kwh_places": 2, "unit_price_places": 4, "money_places": 2, "order": "per_line_then_sum", "vat": "per_line"},
        "meta": {"engine": ENGINE, "software_version": __version__, "computed_at": _iso(now)},
    }
    return Computed(snapshot, totals["kwh"], totals["total"], {k: _iso(v) or "" for k, v in caps.items()})


def period_kwh(conn: sqlite3.Connection, provider: BillingReadings, account: sqlite3.Row, p: per.Period, comp: fx.Compiled) -> dict[str, Any]:
    """kWh of the account in one period: from an issued bill of exactly that period when there is one, else from the readings
    store (raw readings / quarter-hour buckets / daily totals, allocated by time) with the account formula. Missing data stays
    null - never invented; partial coverage is 'partial'."""
    tz = account["timezone"]
    row = conn.execute(
        "SELECT kwh FROM energy_bills WHERE account_id = ? AND period_start = ? AND period_end = ? AND state IN ('issued','sent','paid') ORDER BY revision DESC LIMIT 1",
        (account["id"], p.start.isoformat(), p.end.isoformat()),
    ).fetchone()
    base = {"from": p.start.isoformat(), "to": p.last_day.isoformat()}
    if row and row["kwh"] is not None:
        return {**base, "kwh": row["kwh"], "status": "measured", "source": "bill"}
    a, b = per.utc_window(p, tz)
    total = Decimal(0)
    complete = True
    got = 0
    for mid, coef in comp.coefficients.items():
        try:
            c = provider.consumption(mid, a, b)
        except ValueError:  # e.g. edges not day-aligned beyond the quarter-hour retention: no data, never a guess
            continue
        if getattr(c, "wh", None) is None or getattr(c, "coverage", "none") == "none":
            continue
        got += 1
        total += coef * Decimal(int(c.wh))
        complete = complete and c.coverage == "full"
    if got == 0 or got < len(comp.coefficients):
        return {**base, "kwh": None, "status": "missing", "source": None}
    kwh = px.r2(_kwh(total))
    if kwh < 0:
        return {**base, "kwh": None, "status": "missing", "source": None}
    return {**base, "kwh": str(kwh), "status": "measured" if complete else "partial", "source": "readings"}


def compute_history(conn: sqlite3.Connection, provider: BillingReadings, account: sqlite3.Row, period: per.Period, comp: fx.Compiled, current_kwh: str | None) -> dict[str, Any]:
    """Owner round 3: up to 12 previous periods and the same period last year - from issued bills of the account when one
    covers exactly that period, else from the readings store's long-term totals; missing data stays null (never invented)."""
    try:
        cycle = cycle_of(account)
    except (TypeError, ValueError):
        cycle = None
    previous = [period_kwh(conn, provider, account, p, comp) for p in per.previous_like(period, cycle, HISTORY_PERIODS)]
    # trim leading entries that have no data at all (before the account / the meters existed)
    while previous and previous[0]["kwh"] is None:
        previous.pop(0)
    last_year = period_kwh(conn, provider, account, per.same_period_last_year(period), comp)
    return {"current": {"from": period.start.isoformat(), "to": period.last_day.isoformat(), "kwh": current_kwh},
            "previous": previous, "same_period_last_year": last_year if last_year["kwh"] is not None else None}


def account_history(conn: sqlite3.Connection, provider: BillingReadings, account: sqlite3.Row, past: int, money: bool, now: dt.datetime | None = None) -> dict[str, Any]:
    """Owner round 6: consumption per billing period for the account page, also for periods WITHOUT a bill (computed from the
    readings with the account formula), oldest first, ending with the latest ended period; plus the chart comparison (previous
    periods and the same period last year) of that latest period. Periods before any data are trimmed; gaps stay null."""
    now = now or now_utc()
    cycle = cycle_of(account)
    today = per.local_date(now, account["timezone"])
    ref = per.period_containing(cycle, max(today, cycle.first_start))
    out: dict[str, Any] = {"periods": [], "comparison": None}
    if ref is None:
        return out
    names_all = meter_names(provider)
    try:
        comp = fx.compile_formula(json.loads(account["formula_json"]), known=names_all.keys())
    except (fx.FormulaError, ValueError):
        return out
    rows: list[dict[str, Any]] = []
    for p in per.previous_like(ref, cycle, past):
        if p.end > today:
            continue  # only ended periods
        entry = period_kwh(conn, provider, account, p, comp)
        b = conn.execute("SELECT * FROM energy_bills WHERE account_id = ? AND period_start = ? AND period_end = ? AND state != 'void' ORDER BY revision DESC LIMIT 1",
                         (account["id"], p.start.isoformat(), p.end.isoformat())).fetchone()
        entry["bill"] = bill_summary(conn, b, money) if b is not None else None
        rows.append(entry)
    while rows and rows[0]["kwh"] is None and rows[0]["bill"] is None:
        rows.pop(0)
    out["periods"] = rows
    if rows:
        latest = per.Period(_date(rows[-1]["from"]), _date(rows[-1]["to"]) + dt.timedelta(days=1))
        out["comparison"] = compute_history(conn, provider, account, latest, comp, rows[-1]["kwh"])
    return out


# ====================================================================== bills: rows and serialisation

def get_bill(conn: sqlite3.Connection, bid: str) -> sqlite3.Row:
    row = conn.execute("SELECT * FROM energy_bills WHERE id = ?", (bid,)).fetchone()
    if not row:
        raise not_found("החיוב לא נמצא.")
    return row


def bill_actions(row: sqlite3.Row) -> list[str]:
    s = row["state"]
    if s == "draft":
        return ["recalculate", "delete", "issue", "pdf"]
    if s == "issued":
        return ["sent", "paid", "correct", "void", "pdf"]
    if s == "sent":
        return ["paid", "correct", "void", "pdf"]
    if s == "paid":
        return ["correct", "pdf"]
    return ["pdf"]


def bill_summary(conn: sqlite3.Connection, row: sqlite3.Row, money: bool = True) -> dict[str, Any]:
    acc = conn.execute("SELECT name FROM energy_accounts WHERE id = ?", (row["account_id"],)).fetchone()
    snap_c = json.loads(row["snapshot_json"]).get("customer") or {}
    out = {
        "id": row["id"], "account_id": row["account_id"], "account_name": acc["name"] if acc else "",
        "customer": {"id": row["customer_id"], "customer_number": snap_c.get("customer_number"), "name": snap_c.get("name")},
        "number": row["number"], "revision": row["revision"], "state": row["state"], "origin": row["origin"],
        "period": {"from": row["period_start"], "to": (_date(row["period_end"]) - dt.timedelta(days=1)).isoformat()},
        "issue_date": row["issue_date"], "due_date": row["due_date"], "kwh": row["kwh"],
        "replaces_bill_id": row["replaces_bill_id"], "replaced_by_bill_id": row["replaced_by_bill_id"],
        "row_version": row["row_version"], "created_at": row["created_at"], "updated_at": row["updated_at"],
    }
    if money:
        out["total"] = row["total"]
    return out


def pdf_engine_name() -> str | None:
    from . import energy_billing_pdf as pdfseam

    st = pdfseam.engine_status() or {}
    return st.get("last_render_engine") or st.get("active")


def pdf_event(conn: sqlite3.Connection, bid: str, action: str, actor: Any | None, details: dict[str, Any] | None = None) -> None:
    _event(conn, bid, action, actor, details)


def pdf_state(conn: sqlite3.Connection, row: sqlite3.Row) -> dict[str, Any]:
    """Owner round 6: is the PDF of this bill there, producible, failed, or impossible in this build.
    stored = the PDF of an issued bill is saved; ready = produced on request; failed = the last attempt failed (with the code);
    unavailable = no PDF engine works on this installation."""
    from . import energy_billing_pdf as pdfseam

    engine = pdf_engine_name()
    out: dict[str, Any] = {"state": "ready", "error_code": None, "failed_at": None, "engine": engine}
    if row["pdf_path"]:
        out["state"] = "stored"
        return out
    last = conn.execute("SELECT at, action, details_json FROM energy_bill_events WHERE bill_id = ? AND action IN ('pdf', 'pdf_failed') "
                        "ORDER BY at DESC, rowid DESC LIMIT 1", (row["id"],)).fetchone()
    if not pdfseam.available():
        out.update(state="unavailable", error_code="pdf_unavailable")
    elif last is not None and last["action"] == "pdf_failed":
        try:
            code = (json.loads(last["details_json"] or "{}") or {}).get("code")
        except ValueError:
            code = None
        out.update(state="failed", error_code=code or "pdf_render_failed", failed_at=last["at"])
    return out


def bill_dict(conn: sqlite3.Connection, row: sqlite3.Row) -> dict[str, Any]:
    out = bill_summary(conn, row)
    out.update({
        "snapshot": json.loads(row["snapshot_json"]),
        "snapshot_sha256": row["snapshot_sha256"],
        "sent": {"at": row["sent_at"], "how": row["sent_how"], "note": row["sent_note"]} if row["sent_at"] else None,
        "paid": {"at": row["paid_at"], "reference": row["paid_ref"]} if row["paid_at"] else None,
        "void": {"at": row["voided_at"], "reason": row["void_reason"]} if row["state"] == "void" else None,
        "actions": bill_actions(row),
        "pdf": pdf_state(conn, row),
    })
    return out


def _event(conn: sqlite3.Connection, bid: str, action: str, actor: Any | None, details: dict[str, Any] | None = None) -> None:
    conn.execute("INSERT INTO energy_bill_events(id, bill_id, at, action, actor_kind, actor_id, actor_name, details_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                 (new_id(), bid, now_iso(), action, "user" if actor is not None else "system", getattr(actor, "user_id", None),
                  (getattr(actor, "display_name", None) or getattr(actor, "username", None)) if actor is not None else None,
                  json.dumps(details, ensure_ascii=False) if details else None))


def _audit(conn: sqlite3.Connection, actor: Any | None, action: str, rtype: str, rid: str, request_id: str | None = None, details: dict[str, Any] | None = None) -> None:
    audit(conn, actor=actor, action=action, decision="allowed", resource_type=rtype, resource_id=rid, request_id=request_id, details=details)


# ====================================================================== bills: create / recalculate / delete

def resolve_period(account: sqlite3.Row, period: dict[str, Any] | None, now: dt.datetime) -> per.Period:
    c = cycle_of(account)
    if period is None:
        ended = per.regular_periods(c, per.local_date(now, account["timezone"]))
        if not ended:
            raise _err(422, "period_invalid", "עוד לא הסתיימה תקופת חיוב בחשבון זה.")
        return ended[-1]
    start, last = period["from"], period["to"]
    p = per.Period(start, last + dt.timedelta(days=1))
    try:
        per.validate_adhoc(p.start, p.end)
    except ValueError:
        raise _err(422, "period_invalid", "התקופה אינה תקינה (תאריך סיום לפני ההתחלה או ארוכה משנה).") from None
    if p.start < c.first_start:
        raise _err(422, "period_invalid", "התקופה מתחילה לפני תחילת החיוב בחשבון.")
    return p


def _overlapping(conn: sqlite3.Connection, aid: str, p: per.Period, exclude: tuple[str, ...] = ()) -> sqlite3.Row | None:
    rows = conn.execute(
        "SELECT * FROM energy_bills WHERE account_id = ? AND state IN ('issued','sent','paid') AND period_start < ? AND period_end > ?",
        (aid, p.end.isoformat(), p.start.isoformat()),
    ).fetchall()
    for r in rows:
        if r["id"] not in exclude:
            return r
    return None


def _overlap_error(r: sqlite3.Row) -> ApiError:
    return conflict("period_overlap", f"התקופה חופפת לחיוב {r['number']} שכבר הונפק.", bill_id=r["id"], number=r["number"])


def insert_draft(conn: sqlite3.Connection, account: sqlite3.Row, p: per.Period, comp: Computed, *, actor: Any | None, origin: str,
                 request_id: str | None, client_request_id: str | None, replaces: sqlite3.Row | None = None) -> str:
    """The write half of "create a draft" (inside the caller's write transaction; the computation was done before)."""
    if replaces is None:
        hit = _overlapping(conn, account["id"], p)
        if hit:
            raise _overlap_error(hit)
    dup = conn.execute("SELECT id FROM energy_bills WHERE account_id = ? AND period_start = ? AND period_end = ? AND state = 'draft'",
                       (account["id"], p.start.isoformat(), p.end.isoformat())).fetchone()
    if dup:
        raise conflict("draft_exists", "כבר קיימת טיוטה לתקופה זו.", bill_id=dup["id"])
    bid = new_id()
    snap = comp.snapshot
    snap["bill"]["id"] = bid
    now = now_iso()
    conn.execute(
        """INSERT INTO energy_bills(id, account_id, customer_id, revision, replaces_bill_id, period_start, period_end, state, origin, kwh, total,
             snapshot_json, create_request_id, created_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?)""",
        (bid, account["id"], account["customer_id"], snap["bill"]["revision"], replaces["id"] if replaces is not None else None,
         p.start.isoformat(), p.end.isoformat(), origin, comp.kwh, comp.total, json.dumps(snap, ensure_ascii=False), client_request_id,
         getattr(actor, "user_id", None), now, now),
    )
    action = "correct" if replaces is not None else ("auto_draft" if origin == "auto" and actor is None else "draft")
    _event(conn, bid, action, actor, {"replaces": replaces["number"]} if replaces is not None else None)
    _audit(conn, actor, f"energy.bill.{action}", "energy_bill", bid, request_id, {"account_id": account["id"], "period": p.as_api()})
    return bid


def by_create_request(conn: sqlite3.Connection, client_request_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM energy_bills WHERE create_request_id = ?", (client_request_id,)).fetchone()


def store_recalculated(conn: sqlite3.Connection, bill: sqlite3.Row, comp: Computed, actor: Any | None, request_id: str | None, row_version: int) -> None:
    cur = get_bill(conn, bill["id"])
    if cur["state"] != "draft":
        raise conflict("bill_not_draft", "החיוב אינו טיוטה.", state=cur["state"])
    if cur["row_version"] != row_version:
        raise conflict("revision_conflict", "החיוב שונה בינתיים. יש לרענן ולנסות שוב.", current_revision=cur["row_version"])
    snap = comp.snapshot
    snap["bill"]["id"] = bill["id"]
    conn.execute("UPDATE energy_bills SET kwh = ?, total = ?, snapshot_json = ?, row_version = row_version + 1, updated_at = ? WHERE id = ?",
                 (comp.kwh, comp.total, json.dumps(snap, ensure_ascii=False), now_iso(), bill["id"]))
    _event(conn, bill["id"], "recalculate", actor)
    _audit(conn, actor, "energy.bill.recalculate", "energy_bill", bill["id"], request_id)


def delete_draft(conn: sqlite3.Connection, bid: str, row_version: int, actor: Any, request_id: str | None) -> None:
    row = get_bill(conn, bid)
    if row["state"] != "draft":
        raise conflict("bill_not_draft", "אפשר למחוק רק טיוטה.", state=row["state"])
    if row["row_version"] != row_version:
        raise conflict("revision_conflict", "החיוב שונה בינתיים. יש לרענן ולנסות שוב.", current_revision=row["row_version"])
    conn.execute("DELETE FROM energy_bills WHERE id = ?", (bid,))
    conn.execute("DELETE FROM energy_bill_events WHERE bill_id = ?", (bid,))
    _audit(conn, actor, "energy.bill.delete", "energy_bill", bid, request_id, {"account_id": row["account_id"]})


# ====================================================================== numbering and issue

def number_for(conn: sqlite3.Connection, bill: sqlite3.Row, customer_number: str) -> tuple[str, str, int]:
    """(number, base, seq) - YYYY-MM-CCCC[/S][-R]; month = month of the period's LAST day (owner round 2)."""
    last = _date(bill["period_end"]) - dt.timedelta(days=1)
    rev = int(bill["revision"])
    if bill["replaces_bill_id"]:
        root = get_bill(conn, bill["replaces_bill_id"])
        while root["replaces_bill_id"]:
            root = get_bill(conn, root["replaces_bill_id"])
        base, seq = root["number_base"], int(root["number_seq"])
    else:
        base = f"{last.year:04d}-{last.month:02d}-{customer_number}"
        row = conn.execute("SELECT MAX(number_seq) FROM energy_bill_numbers WHERE number_base = ?", (base,)).fetchone()
        row2 = conn.execute("SELECT MAX(number_seq) FROM energy_bills WHERE number_base = ?", (base,)).fetchone()
        seq = max(int(row[0] or 0), int(row2[0] or 0)) + 1
    number = base + (f"/{seq}" if seq > 1 else "") + (f"-{rev}" if rev > 1 else "")
    if conn.execute("SELECT 1 FROM energy_bill_numbers WHERE number = ?", (number,)).fetchone() or \
            conn.execute("SELECT 1 FROM energy_bills WHERE number = ?", (number,)).fetchone():
        raise conflict("number_taken", "מספר החיוב כבר נוצל. יש לנסות שוב.", number=number)
    return number, base, seq


def seal(conn: sqlite3.Connection, bill: sqlite3.Row, comp: Computed, *, actor: Any | None, issue_date: dt.date, request_id: str | None,
         client_request_id: str | None) -> None:
    """Issue a draft inside the caller's write transaction: overlap check, number, sealed snapshot + hash, the original of a
    correction cancelled. `comp` is the fresh computation the caller made before taking the write lock."""
    account = conn.execute("SELECT * FROM energy_accounts WHERE id = ?", (bill["account_id"],)).fetchone()
    p = per.Period(_date(bill["period_start"]), _date(bill["period_end"]))
    hit = _overlapping(conn, bill["account_id"], p, exclude=(bill["replaces_bill_id"],) if bill["replaces_bill_id"] else ())
    if hit:
        raise _overlap_error(hit)
    snap = comp.snapshot
    customer_number = snap["customer"]["customer_number"]
    number, base, seq = number_for(conn, bill, customer_number)
    terms = snap["bill"]["payment_terms"]
    due = px.due_date(issue_date, terms)
    at = now_utc()
    snap["bill"].update({
        "id": bill["id"], "number": number, "state": "issued", "issue_date": issue_date.isoformat(), "due_date": due.isoformat(),
        "expected_due_date": due.isoformat(), "issued_at": _iso(at),
        "issued_by": {"kind": "user", "display_name": getattr(actor, "display_name", "") or getattr(actor, "username", "")} if actor is not None else {"kind": "system"},
    })
    digest = sha256_of(snap)
    conn.execute(
        """UPDATE energy_bills SET state = 'issued', number = ?, number_base = ?, number_seq = ?, kwh = ?, total = ?, snapshot_json = ?, snapshot_sha256 = ?,
             issue_date = ?, due_date = ?, issued_by = ?, issued_at = ?, issue_request_id = ?, row_version = row_version + 1, updated_at = ? WHERE id = ?""",
        (number, base, seq, comp.kwh, comp.total, json.dumps(snap, ensure_ascii=False), digest, issue_date.isoformat(), due.isoformat(),
         getattr(actor, "user_id", None), _iso(at), client_request_id, now_iso(), bill["id"]),
    )
    conn.execute("INSERT INTO energy_bill_numbers(number, number_base, number_seq, revision, bill_id, assigned_at) VALUES (?, ?, ?, ?, ?, ?)",
                 (number, base, seq, int(bill["revision"]), bill["id"], now_iso()))
    action = "issue" if actor is not None else "auto_issue"
    _event(conn, bill["id"], action, actor, {"number": number})
    _audit(conn, actor, f"energy.bill.{action}", "energy_bill", bill["id"], request_id, {"number": number, "sha256": digest[:12], "account_id": account["id"] if account else None})
    if bill["replaces_bill_id"]:
        orig = get_bill(conn, bill["replaces_bill_id"])
        if orig["state"] != "void":
            reason = f"הוחלף ב-{number}"
            conn.execute("UPDATE energy_bills SET state = 'void', void_reason = ?, voided_at = ?, replaced_by_bill_id = ?, row_version = row_version + 1, updated_at = ? WHERE id = ?",
                         (reason, now_iso(), bill["id"], now_iso(), orig["id"]))
            _event(conn, orig["id"], "void", actor, {"reason": reason, "replaced_by": number})
            _audit(conn, actor, "energy.bill.void", "energy_bill", orig["id"], request_id, {"replaced_by": number})
        else:
            conn.execute("UPDATE energy_bills SET replaced_by_bill_id = ? WHERE id = ?", (bill["id"], orig["id"]))


# ====================================================================== lifecycle marks

def _check_version(row: sqlite3.Row, row_version: int | None) -> None:
    if row_version is not None and row["row_version"] != row_version:
        raise conflict("revision_conflict", "החיוב שונה בינתיים. יש לרענן ולנסות שוב.", current_revision=row["row_version"])


def mark_sent(conn: sqlite3.Connection, bid: str, at: str, how: str, note: str, actor: Any, request_id: str | None, row_version: int | None = None) -> None:
    row = get_bill(conn, bid)
    _check_version(row, row_version)
    if row["state"] not in ("issued", "sent"):
        raise conflict("bill_state", f"אי אפשר לסמן כנשלח חיוב במצב {STATE_HE[row['state']]}.", state=row["state"])
    conn.execute("UPDATE energy_bills SET state = 'sent', sent_at = ?, sent_how = ?, sent_note = ?, row_version = row_version + 1, updated_at = ? WHERE id = ?",
                 (at, how, note, now_iso(), bid))
    _event(conn, bid, "sent", actor, {"how": how})
    _audit(conn, actor, "energy.bill.sent", "energy_bill", bid, request_id, {"how": how})


def mark_paid(conn: sqlite3.Connection, bid: str, at: str, reference: str, actor: Any, request_id: str | None, row_version: int | None = None) -> None:
    row = get_bill(conn, bid)
    _check_version(row, row_version)
    if row["state"] not in ("issued", "sent"):
        raise conflict("bill_state", f"אי אפשר לסמן כשולם חיוב במצב {STATE_HE[row['state']]}.", state=row["state"])
    conn.execute("UPDATE energy_bills SET state = 'paid', paid_at = ?, paid_ref = ?, row_version = row_version + 1, updated_at = ? WHERE id = ?",
                 (at, reference, now_iso(), bid))
    _event(conn, bid, "paid", actor)
    _audit(conn, actor, "energy.bill.paid", "energy_bill", bid, request_id)


def void_bill(conn: sqlite3.Connection, bid: str, reason: str, actor: Any, request_id: str | None, row_version: int | None = None) -> None:
    row = get_bill(conn, bid)
    _check_version(row, row_version)
    if not reason or not reason.strip():
        raise _err(422, "reason_required", "חובה לציין סיבת ביטול.")
    if row["state"] not in ("issued", "sent"):
        raise conflict("bill_state", f"אי אפשר לבטל חיוב במצב {STATE_HE[row['state']]}.", state=row["state"])
    conn.execute("UPDATE energy_bills SET state = 'void', void_reason = ?, voided_at = ?, row_version = row_version + 1, updated_at = ? WHERE id = ?",
                 (reason.strip(), now_iso(), now_iso(), bid))
    _event(conn, bid, "void", actor, {"reason": reason.strip()})
    _audit(conn, actor, "energy.bill.void", "energy_bill", bid, request_id)


def open_correction(conn: sqlite3.Connection, bid: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM energy_bills WHERE replaces_bill_id = ? AND state = 'draft'", (bid,)).fetchone()


def check_correctable(conn: sqlite3.Connection, row: sqlite3.Row) -> None:
    if row["state"] not in ISSUED_STATES:
        raise conflict("bill_state", f"אי אפשר לתקן חיוב במצב {STATE_HE[row['state']]}.", state=row["state"])
    existing = open_correction(conn, row["id"])
    if existing:
        raise conflict("bill_state", "כבר קיימת טיוטת תיקון לחיוב זה.", bill_id=existing["id"], state=row["state"])


# ====================================================================== automatic generation (owner round 2)

@dataclass
class AutoOutcome:
    created: int = 0
    issued: int = 0
    failed: int = 0
    skipped: int = 0


def _due_periods(conn: sqlite3.Connection, acc: sqlite3.Row, now: dt.datetime, delay: dt.timedelta) -> list[per.Period]:
    tz = acc["timezone"]
    c = cycle_of(acc)
    created_local = per.local_date(_parse_iso(acc["created_at"]) or now, tz)
    out: list[per.Period] = []
    for p in per.regular_periods(c, per.local_date(now, tz)):
        if p.end <= created_local:
            continue  # periods that ended before the account existed are never generated automatically
        if per.local_midnight_utc(p.end, tz) + delay > now:
            continue
        run = conn.execute("SELECT status, next_attempt_at FROM energy_auto_runs WHERE account_id = ? AND period_start = ? AND period_end = ?",
                           (acc["id"], p.start.isoformat(), p.end.isoformat())).fetchone()
        if run is not None and not (run["status"] == "failed" and (run["next_attempt_at"] or "") <= _iso(now)):
            continue
        out.append(p)
        if len(out) >= AUTO_MAX_PER_ACCOUNT:
            break
    return out


def _record_run(conn: sqlite3.Connection, acc_id: str, p: per.Period, status: str, bill_id: str | None, error: str | None, now: dt.datetime) -> None:
    nxt = _iso(now + AUTO_RETRY) if status == "failed" else None
    conn.execute(
        """INSERT INTO energy_auto_runs(account_id, period_start, period_end, status, bill_id, error_code, attempts, next_attempt_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
           ON CONFLICT(account_id, period_start, period_end) DO UPDATE SET status = excluded.status, bill_id = excluded.bill_id,
             error_code = excluded.error_code, attempts = energy_auto_runs.attempts + 1, next_attempt_at = excluded.next_attempt_at, updated_at = excluded.updated_at""",
        (acc_id, p.start.isoformat(), p.end.isoformat(), status, bill_id, error, nxt, now_iso(), now_iso()),
    )


def auto_generate(db: Database, provider: BillingReadings | None = None, now: dt.datetime | None = None, settings: Any = None) -> AutoOutcome:
    """One pass of the automatic generation. Idempotent: the (account, period) run row is written in the same transaction
    as the draft, and the write re-checks it, so a second process, a double tick or a restart in the middle never makes a
    second bill. The computation runs before the write lock."""
    fixed = provider
    now = now or now_utc()
    out = AutoOutcome()
    with db.connection(mode="read", label="energy.auto.scan") as rconn:
        delay = dt.timedelta(hours=int(read_settings(rconn)["auto"]["delay_hours"]))
        accounts = rconn.execute("SELECT * FROM energy_accounts WHERE deleted_at IS NULL AND status = 'active' AND auto_mode != 'off' ORDER BY created_at").fetchall()
        work = [(acc, _due_periods(rconn, acc, now, delay)) for acc in accounts]
    for acc, periods in work:
        for p in periods:
            try:
                with db.connection(mode="read", label="energy.auto.compute") as rconn:
                    if rconn.execute("SELECT 1 FROM energy_bills WHERE account_id = ? AND period_start < ? AND period_end > ? AND state != 'void' LIMIT 1",
                                     (acc["id"], p.end.isoformat(), p.start.isoformat())).fetchone():
                        comp, error = None, "exists"
                    else:
                        provider = fixed or get_provider(rconn, settings)
                        comp, error = compute(rconn, provider, acc, p, origin="auto", now=now), None
            except ApiError as e:
                comp, error = None, e.code
            except Exception:  # noqa: BLE001 - one account never stops the others
                log.warning("automatic bill computation failed", exc_info=True)
                comp, error = None, "internal"
            with db.connection(label="energy.auto.write") as conn:
                run = conn.execute("SELECT status, next_attempt_at FROM energy_auto_runs WHERE account_id = ? AND period_start = ? AND period_end = ?",
                                   (acc["id"], p.start.isoformat(), p.end.isoformat())).fetchone()
                if run is not None and not (run["status"] == "failed" and (run["next_attempt_at"] or "") <= _iso(now)):
                    continue  # another pass got here first
                if error == "exists":
                    _record_run(conn, acc["id"], p, "skipped", None, None, now)
                    out.skipped += 1
                    continue
                if comp is None:
                    _record_run(conn, acc["id"], p, "failed", None, error, now)
                    _audit(conn, None, "energy.bill.auto_failed", "energy_account", acc["id"], None, {"period": p.as_api(), "error": error})
                    out.failed += 1
                    continue
                cur = conn.execute("SELECT * FROM energy_accounts WHERE id = ? AND deleted_at IS NULL", (acc["id"],)).fetchone()
                if cur is None or cur["revision"] != acc["revision"]:
                    continue  # changed meanwhile: the next pass computes it again
                try:
                    bid = insert_draft(conn, cur, p, comp, actor=None, origin="auto", request_id=None, client_request_id=None)
                except ApiError as e:
                    _record_run(conn, acc["id"], p, "skipped" if e.code in ("draft_exists", "period_overlap") else "failed", None, e.code, now)
                    out.skipped += 1
                    continue
                status = "created"
                if cur["auto_mode"] == "issue":
                    bill = get_bill(conn, bid)
                    try:
                        seal(conn, bill, comp, actor=None, issue_date=per.local_date(now, cur["timezone"]), request_id=None, client_request_id=None)
                        status = "issued"
                        out.issued += 1
                    except ApiError as e:
                        log.warning("automatic issue refused: %s", e.code)
                _record_run(conn, acc["id"], p, status, bid, None, now)
                out.created += 1
    return out


_LAST_AUTO: dict[str, float] = {}
AUTO_EVERY_S = 300


_LAST_RETENTION: dict[str, float] = {}
RETENTION_EVERY_S = 3600


def _int_setting(conn: sqlite3.Connection, key: str, default: int, lo: int, hi: int) -> int:
    """A retention key of the energy settings registry (validated and defaulted there)."""
    try:
        v = int(es.value(conn, key))
    except (KeyError, TypeError, ValueError):
        v = default
    return min(max(v, lo), hi)


def retention(db: Database, data_dir: Path | None, now: dt.datetime | None = None) -> dict[str, int]:
    """Drafts older than `energy.draft_retention_days` (30) and bills whose period ended more than
    `energy.bill_retention_years` (7) ago are deleted with their events and stored PDFs (keys owned by the meters branch's
    settings registry; read here with their defaults). The ledger of used numbers and the automatic-run rows stay, so a
    number is never reused and an old period is never generated again."""
    now = now or now_utc()
    with db.connection(label="energy.billing.retention") as conn:
        days = _int_setting(conn, "energy.draft_retention_days", 30, 7, 365)
        years = _int_setting(conn, "energy.bill_retention_years", 7, 1, 15)
        draft_cut = _iso(now - dt.timedelta(days=days))
        bill_cut = per.local_date(now, "UTC").replace(year=per.local_date(now, "UTC").year - years, day=1).isoformat()
        drafts = [r["id"] for r in conn.execute("SELECT id FROM energy_bills WHERE state = 'draft' AND updated_at < ?", (draft_cut,)).fetchall()]
        old = conn.execute("SELECT id, pdf_path FROM energy_bills WHERE state != 'draft' AND period_end < ?", (bill_cut,)).fetchall()
        ids = drafts + [r["id"] for r in old]
        for bid in ids:
            conn.execute("DELETE FROM energy_bill_events WHERE bill_id = ?", (bid,))
            conn.execute("DELETE FROM energy_bills WHERE id = ?", (bid,))
        if ids:
            _audit(conn, None, "energy.bill.retention", "energy_bill", "*", None, {"drafts": len(drafts), "bills": len(old)})
    if data_dir is not None:
        for r in old:
            if r["pdf_path"]:
                try:
                    (data_dir / r["pdf_path"]).unlink(missing_ok=True)
                except OSError:
                    pass
    return {"drafts": len(drafts), "bills": len(old)}


def janitor(db: Database, settings: Any = None) -> AutoOutcome | None:
    """The janitor step (main.janitor_tick, every 30 s): the automatic generation at most every 5 minutes, retention hourly."""
    import time

    key = str(getattr(db, "path", ""))
    if time.monotonic() - _LAST_RETENTION.get(key, -1e9) >= RETENTION_EVERY_S:
        _LAST_RETENTION[key] = time.monotonic()
        retention(db, getattr(settings, "data_dir", None))
    if time.monotonic() - _LAST_AUTO.get(key, -1e9) < AUTO_EVERY_S:
        return None
    _LAST_AUTO[key] = time.monotonic()
    return auto_generate(db, settings=settings)


# ====================================================================== PDF storage

def pdf_rel_path(row: sqlite3.Row) -> str:
    year = (row["issue_date"] or row["created_at"])[:4]
    return f"energy/bills/{year}/{row['id']}.pdf"


def b64(data: bytes) -> str:  # pragma: no cover - helper for tools
    return base64.b64encode(data).decode("ascii")
