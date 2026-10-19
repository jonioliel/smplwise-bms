"""CR-038 slice 1 - the module's settings API: the display settings document (D18 / D22, `system.configure`), the display name
(D33, `tickets.configure`), departments with their categories, priorities and members (`tickets.configure`), the people pickers
and the list of who holds a ticket permission (the "הרשאות" tab, section 8.2).

Escalation rules (review T19, section 8): `tickets.configure` is sensitive; a member edit needs `tickets.configure` AND (a manager
member of that department OR `tickets.all_departments`); nobody makes themself a manager of a department they do not already manage
(directly or through a group they belong to); the creator of a department who does not hold `tickets.all_departments` becomes its first
manager. Department configuration is installation-wide, so these permissions are checked at installation scope. Every write is audited
(ids and field names, never free text). Mounted BEFORE routers/tickets.py (its `/tickets/{ticket_id}` would match these paths)."""
from __future__ import annotations

import json
import sqlite3
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, File, Path, Query, Request, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict, Field, StrictBool, StrictInt

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn
from ..db import now_iso
from ..errors import ApiError
from ..remote_channel import is_remote
from ..rbac import INSTALLATION, ROLES, Principal, all_roles, require, role_permissions, scope_name
from ..services.tickets import access, model, naming, org_locations, policy, settings_doc, sla, store, store_locations, templates
from ..services.tickets.access import Viewer, text
from .tickets import ID, module_gate

router = APIRouter(dependencies=[Depends(module_gate)])

KEY = r"^[a-z][a-z0-9_-]{1,31}$"
ICON = r"^[a-z][a-zA-Z0-9_-]{0,31}$"
COLOR = r"^--sw-[a-z0-9-]{1,40}$"
DOMAIN = r"^[a-z][a-z0-9_]{0,39}$"
GRANT_ROLES = ("tickets_view", "tickets_create", "tickets_manage", "tickets_all_departments", "tickets_external", "tickets_configure",
               "tickets_costs_view", "tickets_costs", "tickets_delete",  # + S9 (D31, 11A.8); + full deletion (owner 14.10)
               "tickets_handlers",  # + department managers' handlers (owner 2026-10-17)
               "tickets_technician_requests")  # + VPORTALRFQ: the portal's technician requests (owner 2026-10-17)


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _invalid(conn: sqlite3.Connection, field: str, code: str) -> ApiError:
    return ApiError(422, "validation", text(conn, "ערך לא תקין."), details={"fields": [{"field": field, "code": code}]})


def _configurer(conn: sqlite3.Connection, principal: Principal) -> Viewer:
    require(conn, principal, access.CONFIGURE, INSTALLATION)
    return Viewer(conn, principal)


def _clean(conn: sqlite3.Connection, value: Any, field: str, *, required: bool, max_len: int) -> str:
    try:
        return model.text_field(value, field, required=required, max_len=max_len)
    except model.Invalid as exc:
        raise _invalid(conn, exc.problems[0].field, exc.problems[0].code) from None


# ---------------------------------------------------------------- the display settings document (D18 / D22)

@router.get("/tickets/settings")
def get_settings(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    require(conn, principal, "system.configure", INSTALLATION)
    return settings_doc.read(conn)


class UiPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    detail: Literal["drawer", "fullscreen", "drawer_fullscreen"] | None = None
    new_ticket: Literal["sheet", "dialog"] | None = None
    board_floors: Literal["chips", "tree", "chips_tree"] | None = None  # D19 / D30 (slice 6)
    grouping: Literal["always", "no_status_filter", "never"] | None = None  # D20 (slice 6)
    closed_strip: Literal["week", "all", "hidden"] | None = None  # D21 (slice 6)
    detail_tab: Literal["overview", "conv", "costs", "history"] | None = None  # TKUI1 (2.6.0)
    drawer_size: Literal["drawer", "wide", "full"] | None = None  # TKUI1
    phone_sheet: Literal["full", "half"] | None = None  # TKUI1
    handled_days: StrictInt | None = None  # HANDLERLOAD: the default period of the "handled" number (days)
    # MGRDASH phase 1: the manager overview's display choices (settings_doc validates every value again)
    dash_handler_numbers: Literal["managers", "own", "everyone"] | None = None
    dash_vendors: Literal["tagged", "separate", "hidden"] | None = None
    dash_busy: StrictInt | None = None
    dash_busy_departments: dict[str, StrictInt] | None = Field(default=None, max_length=200)
    dash_compare: Literal["top", "below_numbers", "bottom"] | None = None
    dash_digest_hour: StrictInt | None = None  # MGRDASH phase 5: the morning summary's hour (settings_doc validates 0..23)
    dash_dept_stuck: StrictInt | None = None  # MGRDASH phase 5: the busy-department alert's threshold (1..999)


class PublicPatch(BaseModel):  # slice 4: the handler page's address and the peers whose client-address header is believed
    model_config = ConfigDict(extra="forbid")
    base_url: str | None = Field(default=None, max_length=300)
    trusted_proxy_cidrs: list[str] | None = Field(default=None, max_length=8)
    client_ip_header: Literal["cf-connecting-ip", "x-forwarded-for"] | None = None
    path_prefix: str | None = Field(default=None, max_length=40)  # TK255: the one path segment the listener serves itself under
    legacy_t_paths: bool | None = None  # TK255: keep answering the old /t/... links
    confirm_live_links: bool | None = None  # TK255 review F2b: required to change the page path while live links exist (not a setting)
    theme: Literal["light", "dark", "auto"] | None = None  # TK259: the handler page's look (harmless: allowed from a remote session too)


class StaffLinksPatch(BaseModel):
    """TKSTAFF1 (R6 / R8): the staff link's lifetime (settings_doc `staff_links.*`, the same ranges and cap >= sliding rule) and the
    code default."""
    model_config = ConfigDict(extra="forbid")
    sliding_days: StrictInt | None = None
    cap_days: StrictInt | None = None
    grace_hours: StrictInt | None = None
    require_code: StrictBool | None = None


class LinksPatch(BaseModel):
    """D5 installation values (ranges and the cap >= sliding rule: settings_doc.SCHEMA)."""
    model_config = ConfigDict(extra="forbid")
    sliding_days: StrictInt | None = None
    cap_days: StrictInt | None = None
    grace_hours: StrictInt | None = None


class HoursBody(BaseModel):
    """D4: a local-time window, `from` earlier than `to` (settings_doc.send_hours)."""
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    from_: str = Field(alias="from", max_length=5)
    to: str = Field(max_length=5)

    def window(self) -> dict[str, str]:
        return {"from": self.from_, "to": self.to}


class CodePatch(BaseModel):  # slice 7 (10.5 / 14.1): option B codes; the length is fixed at 6 (D2) - never a field here
    model_config = ConfigDict(extra="forbid")
    ttl_min: int | None = Field(default=None, ge=1, le=30)
    max_attempts: int | None = Field(default=None, ge=3, le=10)
    lock_min: int | None = Field(default=None, ge=5, le=240)


class CostsPatch(BaseModel):  # slice 9 (11A.14, D31 / D32): cost claims; department / vendor overrides live on their rows
    model_config = ConfigDict(extra="forbid")
    mode: Literal["required", "optional", "off"] | None = None
    currencies: list[str] | None = Field(default=None, max_length=5)
    vat_rate_bp: int | None = Field(default=None, ge=0, le=5000)
    claim_window_days: int | None = Field(default=None, ge=1, le=90)
    require_invoice: bool | None = None
    max_claim_total_minor: int | None = Field(default=None, ge=100, le=99_999_999_999)
    review_flag_above_minor: int | None = Field(default=None, ge=0, le=99_999_999_999)
    retention_days: int | None = Field(default=None, ge=730, le=3650)
    allowed_line_kinds: list[Literal["labor", "parts", "travel", "other"]] | None = Field(default=None, max_length=4)  # TKDETAILBE


class DirectoryPatch(BaseModel):
    """CR-DEPT-MANAGER-HANDLERS: "מנהלי מחלקה רואים מספרים מלאים" (settings_doc `directory.*`, default off)."""
    model_config = ConfigDict(extra="forbid")
    managers_full_phones: StrictBool | None = None
    review_pending_days: StrictInt | None = None  # NEEDSREVIEW (ranges: settings_doc.SCHEMA)
    review_idle_months: StrictInt | None = None


class PrivacyPatch(BaseModel):
    """PRIVORG-291: the contact point for privacy requests (e-mail or phone) and an optional https link (settings_doc `privacy.*`);
    the organisation name is the existing `organization_name`. settings_doc validates both values again."""
    model_config = ConfigDict(extra="forbid")
    contact: str | None = Field(default=None, max_length=200)
    link: str | None = Field(default=None, max_length=400)


class RfqAttachmentsPatch(BaseModel):  # RFQATT review 2.6.4: Word / Excel attachments on requests for quotation (OFF by default)
    model_config = ConfigDict(extra="forbid")
    allow_office: StrictBool | None = None


class RfqVendorUploadsPatch(BaseModel):  # RFQ-VENDOR-UPLOAD: a vendor's own files on his quote (a public upload route; OFF by default)
    model_config = ConfigDict(extra="forbid")
    enabled: StrictBool | None = None
    # the limits (owner 2026-10-17: administrator settings); settings_doc validates each against its hard cap (contract 19.10)
    max_files: StrictInt | None = None
    max_uploads: StrictInt | None = None
    max_image_mb: StrictInt | None = None
    max_doc_mb: StrictInt | None = None
    max_total_mb: StrictInt | None = None


class RfqPatch(BaseModel):
    """The requests-for-quotation section (settings_doc validates every range again). One model for the branches that added it at
    integ/264: RFQQUESTIONS (the existing `rfq` keys + `question_reminder_hours`; before this the section had no route),
    CR-RFQ-PAYMENT-SCHEDULE (`schedule_arrival`, `arrival_reminder_hours`; RFQ contract sections 13 / 20.9) and the RFQATT review
    (`attachments.allow_office`, nested, default OFF; contract 19.2)."""
    model_config = ConfigDict(extra="forbid")
    default_due_days: int | None = Field(default=None, ge=1, le=60)
    grace_hours: int | None = Field(default=None, ge=0, le=168)
    link_keep_days: int | None = Field(default=None, ge=1, le=365)
    retention_months: int | None = Field(default=None, ge=6, le=120)
    reminder_hours: int | None = Field(default=None, ge=0, le=168)
    question_reminder_hours: int | None = Field(default=None, ge=0, le=168)
    question_badge_all_viewers: StrictBool | None = None  # RFQQSET (default OFF)
    schedule_arrival: StrictBool | None = None  # the payment schedule + arrival confirmation (default OFF)
    arrival_reminder_hours: StrictInt | None = None  # settings_doc validates the range (0-168)
    instalment_reminder_hours: StrictInt | None = None  # RFQPAY2: hours between overdue-instalment reminders (0 = once; settings_doc: 0-168)
    award_notice: Literal["confirm", "auto", "off"] | None = None  # CR-AWARD-NOTICE: the award notice to the vendor (default confirm)
    postpone_late_hours: StrictInt | None = None  # CR-AWARD-NOTICE: the "late" tag of a postponement notice (settings_doc: 0-720)
    attachments: RfqAttachmentsPatch | None = None  # RFQATT review 2.6.4: rfq.attachments.allow_office
    vendor_uploads: RfqVendorUploadsPatch | None = None  # RFQ-VENDOR-UPLOAD: rfq.vendor_uploads.enabled


class VendorPortalPatch(BaseModel):
    """VPORTAL: the vendor portal on the public page (OFF by default), how far back closed requests are listed (1-24 months) and
    whether only a code-confirmed number may sign in (2.6.4 review F1, default ON). Editable from a remote session too (owner
    2026-10-17) - system.configure, audited as tickets.settings.update with the changed keys."""
    model_config = ConfigDict(extra="forbid")
    enabled: StrictBool | None = None
    closed_months: StrictInt | None = Field(default=None, ge=1, le=24)
    require_confirmed_number: StrictBool | None = None
    rfqs: StrictBool | None = None  # VPORTALRFQ: the vendor's open requests for quotation in the portal (default OFF)
    technician_requests: StrictBool | None = None  # VPORTALRFQ: "company technician requests" (default OFF)


class SettingsBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    revision: int = Field(ge=0)
    ui: UiPatch | None = None
    device_long_press: Literal["sheet", "menu"] | None = None  # D17 (slice 3)
    links: LinksPatch | None = None  # slice 2
    send_hours: HoursBody | None = None  # slice 2
    urgent_is_critical: StrictBool | None = None  # slice 2
    organization_name: str | None = Field(default=None, max_length=400)  # slice 4
    public: PublicPatch | None = None  # slice 4
    code: CodePatch | None = None  # slice 7
    costs: CostsPatch | None = None  # slice 9
    staff_links: StaffLinksPatch | None = None  # TKSTAFF1
    directory: DirectoryPatch | None = None  # CR-DEPT-MANAGER-HANDLERS (owner 2026-10-17)
    rfq: RfqPatch | None = None  # RFQQUESTIONS + CR-RFQ-PAYMENT-SCHEDULE + RFQATT review (attachments.allow_office)
    vendor_portal: VendorPortalPatch | None = None  # VPORTAL
    privacy: PrivacyPatch | None = None  # PRIVORG-291


def _problem(exc: ValueError) -> tuple[str, str]:
    field, _, code = str(exc).partition(":")
    if field == "unknown":
        return code or "body", "unknown"
    return field, code or "invalid"


def _confirm_prefix_change(conn: sqlite3.Connection, current: dict[str, Any], sent: "PublicPatch", confirmed: bool) -> None:
    """TK255 review F2b: a change of the path vendors' links carry breaks the links already sent under the old one (only the `/t/`
    spelling survives, and only while `public.legacy_t_paths` is on). With live links it needs an explicit `confirm_live_links`."""
    from ..services.tickets import handler_links, links as links_mod, store_links

    pub = current["public"]
    new_base = sent.base_url if sent.base_url is not None else pub["base_url"]
    new_prefix = sent.path_prefix if sent.path_prefix is not None else pub["path_prefix"]
    try:
        from ..services.tickets.public_prefix import validate_prefix

        before = links_mod.effective_prefix(pub["base_url"], pub["path_prefix"])
        after = links_mod.effective_prefix(new_base or "", validate_prefix(new_prefix))
    except Exception:  # noqa: BLE001 - an invalid value is judged (422) by the document itself
        return
    if before == after or confirmed:
        return
    live = int(store_links.link_state_counts(conn, handler_links.iso(handler_links.now_utc())).get("live", 0))
    if live > 0:
        raise ApiError(409, "confirm_live_links",
                       text(conn, "יש קישורים פעילים שכבר נשלחו לספקים. אחרי שינוי נתיב הדף הם ימשיכו לעבוד רק בצורת /t/ וכל עוד קבלת הקישורים הישנים פעילה. אשרו כדי להמשיך."),
                       details={"live_links": live})


@router.put("/tickets/settings")
def put_settings(body: SettingsBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "system.configure", INSTALLATION)
    if body.public is not None and is_remote(request) and any(v is not None for k, v in body.public.model_dump().items() if k != "theme"):
        # security review 2026-10-14 (2.5.1): the handler page's public address, trusted proxies and client-address header decide who
        # the listener believes - changed from a local session only (like the address probe). 2.5.3: only these keys are refused (the
        # whole PUT, no partial write); every other tickets setting saves normally through the remote channel.
        raise ApiError(403, "local_only", text(conn, "שינוי כתובת הדף הציבורי אפשרי רק בגישה מקומית: פתחו את המערכת מתוך Home Assistant או ברשת המקומית"), details={"field": "public"})
    current = settings_doc.read(conn)
    if body.revision != current["revision"]:
        raise ApiError(409, "settings_stale", text(conn, "ההגדרות השתנו בינתיים. טענו מחדש."), details={"revision": current["revision"]})
    confirm_live = bool(body.public.confirm_live_links) if body.public is not None else False
    if body.public is not None:
        _confirm_prefix_change(conn, current, body.public, confirm_live)
    patch: dict[str, Any] = {}
    if body.ui is not None:
        ui = {k: v for k, v in body.ui.model_dump().items() if v is not None}
        if ui:
            patch["ui"] = ui
    if body.device_long_press is not None:  # D17 (slice 3)
        patch["device_long_press"] = body.device_long_press
    for block in ("links", "public", "code", "costs", "staff_links", "directory", "rfq", "vendor_portal", "privacy"):  # slice 2 / 4 / 7 / 9 / TKSTAFF1 / CR-DEPT-MANAGER-HANDLERS / RFQQUESTIONS + CR-RFQ-PAYMENT-SCHEDULE / VPORTAL
        sent = getattr(body, block)
        if sent is not None:
            # `rfq.attachments` is the one nested block (RFQATT review): handled below, never as a flat value
            values = {k: v for k, v in sent.model_dump().items()
                      if v is not None and k not in ("confirm_live_links", "attachments", "vendor_uploads")}
            if values:
                patch[block] = values
    if body.rfq is not None and body.rfq.attachments is not None and body.rfq.attachments.allow_office is not None:
        # merged next to the other rfq keys of the same request (integ/264: one RfqPatch for RFQQUESTIONS / RFQPAY / RFQATT-FIX)
        patch.setdefault("rfq", {})["attachments"] = {"allow_office": body.rfq.attachments.allow_office}
    if body.rfq is not None and body.rfq.vendor_uploads is not None:
        # RFQ-VENDOR-UPLOAD: the second nested rfq block, merged the same way (audited as tickets.settings.update with the changed keys)
        vu = {k: v for k, v in body.rfq.vendor_uploads.model_dump().items() if v is not None}
        if vu:
            patch.setdefault("rfq", {})["vendor_uploads"] = vu
    if body.send_hours is not None:
        patch["send_hours"] = body.send_hours.window()
    if body.urgent_is_critical is not None:
        patch["urgent_is_critical"] = body.urgent_is_critical
    if body.organization_name is not None:
        patch["organization_name"] = body.organization_name
    try:
        doc, changed = settings_doc.apply_patch(conn, patch)
    except ValueError as exc:
        raise _invalid(conn, *_problem(exc)) from None
    pulled = 0
    if doc["links"]["cap_days"] < current["links"]["cap_days"]:  # D5 (slice 4): a LOWER cap shrinks the exposure of live links at once
        from ..services.tickets import handler_links

        pulled = handler_links.pull_in_caps(conn)
    if doc["staff_links"]["cap_days"] < current["staff_links"]["cap_days"]:  # TKSTAFF1 (R6): the same rule for staff links only
        from ..services.tickets import handler_links

        pulled += handler_links.pull_in_caps(conn, kind="staff")
    if "public.trusted_proxy_cidrs" in changed or "public.client_ip_header" in changed:  # W13 (slice 4): the running listener follows at once
        from ..services.tickets.public_runtime import RUNTIME

        RUNTIME.set_trusted(doc["public"]["trusted_proxy_cidrs"])
        RUNTIME.set_client_ip_header(doc["public"]["client_ip_header"])
    if {"public.path_prefix", "public.legacy_t_paths", "public.base_url"} & set(changed):  # TK255: the prefix the listener serves
        from ..services.tickets.public_runtime import RUNTIME

        RUNTIME.set_prefix(doc)
    if "vendor_portal.enabled" in changed:  # VPORTAL: the running edge serves the bare / any-case root only while the portal is on
        from ..services.tickets.public_runtime import RUNTIME

        RUNTIME.set_portal(doc)
    audit(conn, actor=principal, action="tickets.settings.update", decision="allowed", resource_type="installation", resource_id="tickets",
          request_id=_rid(request), details={"revision": doc["revision"], "changed": changed, **({"links_capped": pulled} if pulled else {})})
    return doc


# ---------------------------------------------------------------- VPORTAL: the organisation's logo on the public pages

_LOGO_WORDS = {
    "too_large": "קובץ הלוגו גדול מדי (עד 512KB).",
    "too_many_pixels": "הלוגו גדול מדי ברזולוציה.",
    "busy": "עיבוד תמונה אחר מתבצע כעת. נסו שוב בעוד רגע.",
}


@router.post("/tickets/settings/logo", status_code=201)
def upload_logo(request: Request, file: UploadFile = File(...), principal: Principal = Depends(current_principal),
                conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """The logo the public pages show next to the organisation name (services/tickets/brand.py): JPEG or PNG by content only (SVG and
    every other type refused), at most 512 KB, re-encoded to a fresh JPEG of at most 512 px. `system.configure`, audited."""
    from ..auth import settings_of
    from ..db import unlocked
    from ..services.tickets import brand

    require(conn, principal, "system.configure", INSTALLATION)
    data = file.file.read(brand.LOGO_MAX_BYTES + 1)
    with unlocked(conn):  # the decode never holds the write lock
        try:
            jpeg = brand.prepare(data)
        except brand.LogoRefused as exc:
            word = _LOGO_WORDS.get(exc.code, "הלוגו חייב להיות קובץ JPG או PNG תקין (הזיהוי לפי התוכן).")
            raise ApiError(exc.status, exc.code, text(conn, word), details=dict(exc.details)) from None
        stamp = brand.write(settings_of(request).data_dir, jpeg)
    doc, changed = settings_doc.apply_patch(conn, {"brand": {"logo": stamp}})
    audit(conn, actor=principal, action="tickets.settings.update", decision="allowed", resource_type="installation", resource_id="tickets",
          request_id=_rid(request), details={"revision": doc["revision"], "changed": changed or ["brand.logo"]})
    return {"logo": brand.logo_name(conn), "revision": doc["revision"]}


@router.delete("/tickets/settings/logo")
def delete_logo(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    from ..auth import settings_of
    from ..services.tickets import brand

    require(conn, principal, "system.configure", INSTALLATION)
    doc, changed = settings_doc.apply_patch(conn, {"brand": {"logo": ""}})
    brand.remove(settings_of(request).data_dir)
    audit(conn, actor=principal, action="tickets.settings.update", decision="allowed", resource_type="installation", resource_id="tickets",
          request_id=_rid(request), details={"revision": doc["revision"], "changed": changed})
    return {"logo": None, "revision": doc["revision"]}


@router.get("/tickets/settings/logo")
def read_logo(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> FileResponse:
    """The current logo for the settings preview (`system.configure`)."""
    from ..auth import settings_of
    from ..services.tickets import brand

    require(conn, principal, "system.configure", INSTALLATION)
    p = brand.resolve(settings_of(request).data_dir, brand.logo_name(conn) or "", brand.stamp(conn))
    if p is None:
        raise ApiError(404, "not_found", text(conn, "לא הוגדר לוגו."))
    return FileResponse(p, media_type="image/jpeg", headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"})


# ---------------------------------------------------------------- the display name (D33)

class NameEntry(BaseModel):
    model_config = ConfigDict(extra="forbid")
    one: str = Field(max_length=200)
    many: str = Field(max_length=200)
    gender: str = Field(default="", max_length=2)
    module: str | None = Field(default=None, max_length=200)  # owner rename 2026-10-14: the module's own name (optional)


class NameBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    revision: int = Field(ge=0)
    he: NameEntry | None = None
    en: NameEntry | None = None
    ar: NameEntry | None = None
    ru: NameEntry | None = None


@router.put("/tickets/name")
def put_name(body: NameBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """The module's display name (D33): one entry per language, edited with the module's settings permission."""
    require(conn, principal, access.CONFIGURE, INSTALLATION)
    current = naming.read(conn)
    if body.revision != current["revision"]:
        raise ApiError(409, "settings_stale", text(conn, "ההגדרות השתנו בינתיים. טענו מחדש."), details={"revision": current["revision"]})
    raw = {lang: getattr(body, lang).model_dump() for lang in naming.LANGS if getattr(body, lang) is not None}
    try:
        languages = naming.validate(raw)
    except naming.NameInvalid as exc:
        raise _invalid(conn, exc.field, exc.code) from None
    doc = naming.store(conn, languages, current["revision"] + 1)
    changed = sorted(lang for lang in languages if languages[lang] != current[lang])
    audit(conn, actor=principal, action="tickets.name.update", decision="allowed", resource_type="installation", resource_id="tickets",
          request_id=_rid(request), details={"revision": doc["revision"], "languages": changed})
    return doc


# ---------------------------------------------------------------- departments

def _member_dicts(conn: sqlite3.Connection, dept_id: str) -> list[dict[str, Any]]:
    from ..services.tickets import staff_links

    out = []
    for m in store.members(conn, dept_id):
        name = store.display_name(conn, m["subject_id"]) if m["subject_kind"] == "user" else store.group_name(conn, m["subject_id"])
        item = {"kind": m["subject_kind"], "id": m["subject_id"], "name": name, "role": m["member_role"], "notify_new": bool(m["notify_new"]),
                "added_at": m["added_at"]}
        if m["subject_kind"] == "user":  # TKSTAFF1: the mobile for the no-login staff link (a tickets.configure screen: the full number)
            sv = staff_links.view(conn, m["subject_id"])
            item.update({"mobile": sv["phone"], "mobile_confirmed": sv["confirmed"], "notify_whatsapp": sv["notify_whatsapp"], "lang": sv["lang"],
                         # TKNOTIFOTP: the directory row, its "verify with a code" switch, whether a code is required, the manager-mark token
                         "contact_id": sv["contact_id"], "phone_verify": sv["phone_verify"], "verify_required": sv["verify_required"],
                         "mobile_confirm": sv["confirm"]})
        out.append(item)
    return out


def domains_of(c: dict[str, Any]) -> list[str]:
    try:
        raw = json.loads(c.get("domains_json") or "[]")
    except ValueError:
        return []
    return [x for x in raw if isinstance(x, str)] if isinstance(raw, list) else []


def _department_dict(conn: sqlite3.Connection, viewer: Viewer, d: dict[str, Any], installation: dict[str, Any] | None = None) -> dict[str, Any]:
    inst = installation if installation is not None else settings_doc.read(conn)
    return {
        "id": d["id"], "key": d["key"], "name": d["name"], "description": d["description"], "icon": d.get("icon"), "color": d.get("color"),
        "sort_order": d["sort_order"], "active": bool(d["active"]), "open_to_all": bool(d["open_to_all"]), "reopen_days": d["reopen_days"],
        "revision": d["revision"], "open_tickets": store.open_ticket_count(conn, d["id"]),
        "categories": [{"id": c["id"], "name": c["name"], "parent_id": c.get("parent_id"), "default_priority_id": c.get("default_priority_id"),
                        "domains": domains_of(c), "sort_order": c["sort_order"], "active": bool(c["active"])} for c in store.categories(conn, d["id"])],
        "priorities": [{"id": p["id"], "key": p["key"], "name": p["name"], "rank": p["rank"], "severity": p["notify_severity"],
                        "is_default": bool(p["is_default"]), "active": bool(p["active"])} for p in store.priorities(conn, d["id"])],
        "members": _member_dicts(conn, d["id"]),
        "can_edit_members": _may_edit_members(viewer, d["id"]),
        # slice 2: the department's policy (its own overrides, NULL = the installation value) and what is in force
        "auto_close_after_days": d.get("auto_close_after_days"),
        "share_history_external": bool(d.get("share_history_external")),
        "overrides": policy.overrides_of(d),
        "effective": policy.resolve(inst, d).as_dict(),
        "sla": store.sla_rules(conn, d["id"]),
        "templates": [templates.as_dict(t) for t in store.templates(conn, d["id"], kind="ticket")],
    }


def _installation_defaults(inst: dict[str, Any]) -> dict[str, Any]:
    return {"links": dict(inst["links"]), "send_hours": dict(inst["send_hours"]), "urgent_is_critical": inst["urgent_is_critical"]}


def _may_edit_members(viewer: Viewer, dept_id: str) -> bool:
    return viewer.role(dept_id) == "manager" or viewer.holds_installation(access.ALL_DEPARTMENTS)


@router.get("/tickets/admin/departments")
def list_departments(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    viewer = _configurer(conn, principal)
    inst = settings_doc.read(conn)
    return {"departments": [_department_dict(conn, viewer, d, inst) for d in store.departments(conn)],
            "all_departments": viewer.holds_installation(access.ALL_DEPARTMENTS),
            "installation": _installation_defaults(inst),
            # owner 2026-10-14: the soft-deleted departments, for "מחלקות שנמחקו" and its restore action
            "deleted": [{"id": d["id"], "name": d["name"], "deleted_at": d["deleted_at"], "tickets": store.ticket_count(conn, d["id"])}
                        for d in store.deleted_departments(conn)]}


class DepartmentBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    key: str | None = Field(default=None, pattern=KEY)
    name: str | None = Field(default=None, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    icon: str | None = Field(default=None, pattern=ICON)
    color: str | None = Field(default=None, pattern=COLOR)
    sort_order: int | None = Field(default=None, ge=0, le=9999)
    active: bool | None = None
    open_to_all: bool | None = None
    reopen_days: int | None = Field(default=None, ge=1, le=90)
    revision: int | None = Field(default=None, ge=1)
    # slice 2 - the department's policy; an explicit null clears an override (back to the installation value / two-step close)
    auto_close_after_days: StrictInt | None = None
    share_history_external: StrictBool | None = None
    urgent_is_critical: StrictBool | None = None
    link_sliding_days: StrictInt | None = None
    link_cap_days: StrictInt | None = None
    link_grace_hours: StrictInt | None = None
    send_hours: HoursBody | None = None


POLICY_FIELDS = ("auto_close_after_days", "share_history_external", "urgent_is_critical", "link_sliding_days", "link_cap_days",
                 "link_grace_hours", "send_hours_json")


def _policy_fields(conn: sqlite3.Connection, body: DepartmentBody, sent: set[str], current: dict[str, Any] | None) -> dict[str, Any]:
    """The policy columns of a department write, validated with the installation ranges (policy._valid) and the cross-key rule
    against the values that will be in force (an override, or the installation value it falls back to)."""
    fields: dict[str, Any] = {}
    if "auto_close_after_days" in sent:
        v = body.auto_close_after_days
        if v is not None and not policy.AUTO_CLOSE_DAYS[0] <= v <= policy.AUTO_CLOSE_DAYS[1]:
            raise _invalid(conn, "auto_close_after_days", "range")
        fields["auto_close_after_days"] = v
    if "share_history_external" in sent:
        if body.share_history_external is None:
            raise _invalid(conn, "share_history_external", "required")
        fields["share_history_external"] = 1 if body.share_history_external else 0
    if "urgent_is_critical" in sent:
        fields["urgent_is_critical"] = None if body.urgent_is_critical is None else (1 if body.urgent_is_critical else 0)
    for key in ("link_sliding_days", "link_cap_days", "link_grace_hours"):
        if key in sent:
            v = getattr(body, key)
            if v is not None:
                try:
                    policy._valid(key, v)
                except ValueError as exc:
                    raise _invalid(conn, key, str(exc)) from None
            fields[key] = v
    if "send_hours" in sent:
        if body.send_hours is None:
            fields["send_hours_json"] = None
        else:
            try:
                window = settings_doc.send_hours(body.send_hours.window())
            except ValueError as exc:
                raise _invalid(conn, "send_hours", str(exc)) from None
            fields["send_hours_json"] = json.dumps(window, separators=(",", ":"))
    if {"link_sliding_days", "link_cap_days"} & set(fields):
        inst = settings_doc.read(conn)["links"]
        merged = {**(current or {}), **fields}
        sliding = merged.get("link_sliding_days") or inst["sliding_days"]
        cap = merged.get("link_cap_days") or inst["cap_days"]
        if cap < sliding:
            raise _invalid(conn, "link_cap_days", "below_sliding")
    return fields


def _department_fields(conn: sqlite3.Connection, body: DepartmentBody, *, creating: bool, current: dict[str, Any] | None = None) -> dict[str, Any]:
    sent = body.model_fields_set - {"revision"}
    fields: dict[str, Any] = {}
    # owner 2026-10-14: the new-department form asks for a name only - a missing key is made from the name (create_department)
    if "key" in sent and body.key:
        fields["key"] = body.key
    if creating or "name" in sent:
        fields["name"] = _clean(conn, body.name, "name", required=True, max_len=40)
    if "description" in sent:
        fields["description"] = _clean(conn, body.description, "description", required=False, max_len=200)
    for k in ("icon", "color"):
        if k in sent:
            fields[k] = getattr(body, k) or None
    for k in ("sort_order", "reopen_days"):
        if k in sent and getattr(body, k) is not None:
            fields[k] = getattr(body, k)
    for k in ("active", "open_to_all"):
        if k in sent and getattr(body, k) is not None:
            fields[k] = 1 if getattr(body, k) else 0
    fields.update(_policy_fields(conn, body, sent, current))
    return fields


# owner 2026-10-14: the department's identifier is made from its name (the form no longer asks for it). Hebrew is transliterated, then
# slugged to KEY; a name that leaves nothing usable gets "dept-" + 6 hex; a taken key gets "-2", "-3", ... (unique among live rows).
_HEB = {"א": "a", "ב": "b", "ג": "g", "ד": "d", "ה": "h", "ו": "v", "ז": "z", "ח": "ch", "ט": "t", "י": "y", "כ": "k", "ך": "k", "ל": "l",
        "מ": "m", "ם": "m", "נ": "n", "ן": "n", "ס": "s", "ע": "a", "פ": "p", "ף": "p", "צ": "tz", "ץ": "tz", "ק": "k", "ר": "r", "ש": "sh",
        "ת": "t"}


def slug_key(name: str) -> str:
    """A KEY-shaped slug of a name ('' when nothing usable is left)."""
    import re
    import unicodedata

    s = "".join(_HEB.get(ch, ch) for ch in (name or "").strip().lower())
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii")
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    s = re.sub(r"^[^a-z]+", "", s)[:28].strip("-")
    return s if re.fullmatch(KEY, s) else ""


def department_key_for(conn: sqlite3.Connection, name: str, *, except_id: str | None = None) -> str:
    import secrets

    base = slug_key(name) or f"dept-{secrets.token_hex(3)}"
    key, n = base, 2
    while store.department_key_taken(conn, key, except_id=except_id):
        key, n = f"{base[:28]}-{n}", n + 1
    return key


@router.post("/tickets/admin/departments", status_code=201)
def create_department(body: DepartmentBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = _configurer(conn, principal)
    fields = _department_fields(conn, body, creating=True)
    if not fields.get("key"):
        fields["key"] = department_key_for(conn, fields["name"])
    if store.department_key_taken(conn, fields["key"]):
        raise ApiError(409, "department_key_taken", text(conn, "כבר קיימת מחלקה עם המזהה הזה."), details={"key": fields["key"]})
    dept_id = store.insert_department(conn, fields)
    first_manager = None
    if not viewer.holds_installation(access.ALL_DEPARTMENTS):
        # section 8: the creator who does not see every department becomes the first manager of the new one
        store.upsert_member(conn, dept_id, "user", principal.user_id, "manager", 1, principal.user_id)
        first_manager = principal.user_id
    audit(conn, actor=principal, action="ticket.department.create", decision="allowed", resource_type="ticket_department", resource_id=dept_id,
          request_id=_rid(request), details={"key": fields["key"], "first_manager": first_manager})
    viewer = Viewer(conn, principal)
    return _department_dict(conn, viewer, store.department(conn, dept_id) or {})


def _dept_or_404(conn: sqlite3.Connection, dept_id: str) -> dict[str, Any]:
    d = store.department(conn, dept_id)
    if d is None:
        raise ApiError(404, "not_found", text(conn, "המחלקה לא נמצאה."))
    return d


@router.patch("/tickets/admin/departments/{dept_id}")
def patch_department(body: DepartmentBody, request: Request, dept_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
                     conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = _configurer(conn, principal)
    d = _dept_or_404(conn, dept_id)
    if body.revision is None:
        raise _invalid(conn, "revision", "required")
    fields = _department_fields(conn, body, creating=False, current=d)
    if "key" in fields and store.department_key_taken(conn, fields["key"], except_id=dept_id):
        raise ApiError(409, "department_key_taken", text(conn, "כבר קיימת מחלקה עם המזהה הזה."), details={"key": fields["key"]})
    if not store.update_department(conn, dept_id, fields, body.revision):
        raise ApiError(409, "department_stale", text(conn, "המחלקה השתנתה בינתיים. טענו מחדש."), details={"revision": d["revision"]})
    changed = sorted(k for k in fields if d.get(k) != fields[k])
    # policy values are configuration (numbers, flags, a time window): the audit row carries them before / after; texts never
    values = {k: [d.get(k), fields[k]] for k in changed if k in POLICY_FIELDS}
    if "auto_close_after_days" in changed:
        sla.refresh_many(conn, store.open_ticket_ids(conn, dept_id, status="done"))  # D10: the close time of waiting "done" tickets moves
    pulled = 0
    if {"link_cap_days", "link_sliding_days"} & set(changed):  # D5 (slice 4): a LOWER effective cap pulls the department's live links in
        from ..services.tickets import handler_links

        pulled = handler_links.pull_in_caps(conn, department_id=dept_id)
    audit(conn, actor=principal, action="ticket.department.update", decision="allowed", resource_type="ticket_department", resource_id=dept_id,
          request_id=_rid(request), details={"fields": changed, **({"policy": values} if values else {}), **({"links_capped": pulled} if pulled else {})})
    return _department_dict(conn, viewer, store.department(conn, dept_id) or {})


@router.delete("/tickets/admin/departments/{dept_id}")
def delete_department(request: Request, dept_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
                      conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _configurer(conn, principal)
    _dept_or_404(conn, dept_id)
    open_n = store.open_ticket_count(conn, dept_id)
    if open_n:
        raise ApiError(409, "department_in_use", text(conn, "במחלקה יש {tickets} פתוחות. העבירו או סגרו אותן קודם."), details={"open_tickets": open_n})
    store.soft_delete_department(conn, dept_id)
    audit(conn, actor=principal, action="ticket.department.delete", decision="allowed", resource_type="ticket_department", resource_id=dept_id, request_id=_rid(request))
    return {"deleted": dept_id}


class RestoreBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    key: str | None = Field(default=None, pattern=KEY)


@router.post("/tickets/admin/departments/{dept_id}/restore")
def restore_department(request: Request, body: RestoreBody | None = None, dept_id: str = Path(..., pattern=ID),
                       principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Owner request 2026-10-14 (his only department was deleted by mistake): a soft-deleted department comes back as it was - the
    delete only marked the department row, so its categories, priorities, members, SLA rules, templates and tickets were never
    touched and are in force again. Its identifier must be free among live departments: an explicit `key` that is taken answers 409;
    without one, a taken identifier is replaced by a free one made from the name (the form no longer shows identifiers)."""
    viewer = _configurer(conn, principal)
    d = store.department_any(conn, dept_id)
    if d is None or not d.get("deleted_at"):
        raise ApiError(404, "not_found", text(conn, "המחלקה לא נמצאה."))
    key = (body.key if body else None) or d["key"]
    if store.department_key_taken(conn, key, except_id=dept_id):
        if body and body.key:
            raise ApiError(409, "department_key_taken", text(conn, "כבר קיימת מחלקה עם המזהה הזה."), details={"key": key})
        key = department_key_for(conn, d["name"], except_id=dept_id)
    store.restore_department(conn, dept_id, key)
    audit(conn, actor=principal, action="ticket.department.restore", decision="allowed", resource_type="ticket_department", resource_id=dept_id,
          request_id=_rid(request), details={"key": key, "key_changed": key != d["key"]})
    out = _department_dict(conn, viewer, store.department(conn, dept_id) or {})
    out["key_changed"] = key != d["key"]
    return out


# ---------------------------------------------------------------- categories and priorities

class CategoryBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str | None = Field(default=None, max_length=200)
    parent_id: str | None = Field(default=None, pattern=ID)
    default_priority_id: str | None = Field(default=None, pattern=ID)
    sort_order: int | None = Field(default=None, ge=0, le=9999)
    active: bool | None = None
    # slice 2: device domains / types that preselect this category from a device (slice 3 reads them), e.g. ["climate", "fan"]
    domains: list[Annotated[str, Field(pattern=DOMAIN)]] | None = Field(default=None, max_length=20)


def _category_fields(conn: sqlite3.Connection, body: CategoryBody, dept_id: str, category_id: str | None, *, creating: bool) -> dict[str, Any]:
    sent = body.model_fields_set
    fields: dict[str, Any] = {}
    if creating or "name" in sent:
        fields["name"] = _clean(conn, body.name, "name", required=True, max_len=60)
    if "parent_id" in sent:
        if body.parent_id:
            parent = store.category(conn, body.parent_id)
            if parent is None or parent["department_id"] != dept_id or parent.get("parent_id") or parent["id"] == category_id:
                raise _invalid(conn, "parent_id", "unknown")  # one level only, inside the same department
        fields["parent_id"] = body.parent_id or None
    if "default_priority_id" in sent:
        if body.default_priority_id:
            p = store.priority(conn, body.default_priority_id)
            if p is None or p["department_id"] != dept_id:
                raise _invalid(conn, "default_priority_id", "unknown")
        fields["default_priority_id"] = body.default_priority_id or None
    if "sort_order" in sent and body.sort_order is not None:
        fields["sort_order"] = body.sort_order
    if "active" in sent and body.active is not None:
        fields["active"] = 1 if body.active else 0
    if "domains" in sent:
        fields["domains_json"] = json.dumps(sorted(set(body.domains or [])), separators=(",", ":"))
    return fields


@router.post("/tickets/admin/departments/{dept_id}/categories", status_code=201)
def create_category(body: CategoryBody, request: Request, dept_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
                    conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = _configurer(conn, principal)
    _dept_or_404(conn, dept_id)
    fields = _category_fields(conn, body, dept_id, None, creating=True)
    cid = store.insert_category(conn, dept_id, fields)
    audit(conn, actor=principal, action="ticket.category.create", decision="allowed", resource_type="ticket_category", resource_id=cid,
          request_id=_rid(request), details={"department_id": dept_id})
    return _department_dict(conn, viewer, store.department(conn, dept_id) or {})


def _category_or_404(conn: sqlite3.Connection, category_id: str) -> dict[str, Any]:
    c = store.category(conn, category_id)
    if c is None:
        raise ApiError(404, "not_found", text(conn, "הקטגוריה לא נמצאה."))
    return c


@router.patch("/tickets/admin/categories/{category_id}")
def patch_category(body: CategoryBody, request: Request, category_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
                   conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = _configurer(conn, principal)
    c = _category_or_404(conn, category_id)
    fields = _category_fields(conn, body, c["department_id"], category_id, creating=False)
    store.update_category(conn, category_id, fields)
    audit(conn, actor=principal, action="ticket.category.update", decision="allowed", resource_type="ticket_category", resource_id=category_id,
          request_id=_rid(request), details={"fields": sorted(fields)})
    return _department_dict(conn, viewer, store.department(conn, c["department_id"]) or {})


@router.delete("/tickets/admin/categories/{category_id}")
def delete_category(request: Request, category_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
                    conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = _configurer(conn, principal)
    c = _category_or_404(conn, category_id)
    store.soft_delete_category(conn, category_id)
    audit(conn, actor=principal, action="ticket.category.delete", decision="allowed", resource_type="ticket_category", resource_id=category_id, request_id=_rid(request))
    return _department_dict(conn, viewer, store.department(conn, c["department_id"]) or {})


class PriorityBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str | None = Field(default=None, max_length=200)
    notify_severity: Literal["info", "alert", "critical"] | None = None
    is_default: bool | None = None
    active: bool | None = None


@router.patch("/tickets/admin/priorities/{priority_id}")
def patch_priority(body: PriorityBody, request: Request, priority_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
                   conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = _configurer(conn, principal)
    p = store.priority(conn, priority_id)
    if p is None or store.department(conn, p["department_id"]) is None:
        raise ApiError(404, "not_found", text(conn, "העדיפות לא נמצאה."))
    sent = body.model_fields_set
    fields: dict[str, Any] = {}
    if "name" in sent:
        fields["name"] = _clean(conn, body.name, "name", required=True, max_len=30)
    if "notify_severity" in sent and body.notify_severity:
        fields["notify_severity"] = body.notify_severity
    if body.is_default:
        fields["is_default"] = 1
    if "active" in sent and body.active is not None:
        if not body.active and (p["is_default"] or body.is_default):
            raise ApiError(409, "priority_is_default", text(conn, "אי אפשר להשבית את עדיפות ברירת המחדל."))
        fields["active"] = 1 if body.active else 0
    if fields.get("is_default") and not p["active"] and fields.get("active") != 1:
        raise ApiError(409, "priority_inactive", text(conn, "עדיפות מושבתת אינה יכולה להיות ברירת המחדל."))
    store.update_priority(conn, priority_id, fields)
    audit(conn, actor=principal, action="ticket.priority.update", decision="allowed", resource_type="ticket_priority", resource_id=priority_id,
          request_id=_rid(request), details={"fields": sorted(fields)})
    return _department_dict(conn, viewer, store.department(conn, p["department_id"]) or {})


# ---------------------------------------------------------------- the SLA matrix (slice 2: every threshold per department x priority, 13.1 / D11)

class SlaRowBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    priority_id: str = Field(pattern=ID)
    revision: int = Field(ge=0)
    unassigned_after_min: StrictInt | None = None
    link_unopened_min: StrictInt | None = None
    ack_within_min: StrictInt | None = None
    stuck_after_min: StrictInt | None = None
    stuck_waiting_min: StrictInt | None = None
    resolve_within_min: StrictInt | None = None
    remind_every_min: StrictInt | None = None
    max_reminders: StrictInt | None = None
    manager_alert_after_steps: StrictInt | None = None


class SlaBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    rows: list[SlaRowBody] = Field(min_length=1, max_length=8)


@router.put("/tickets/admin/departments/{dept_id}/sla")
def put_sla(body: SlaBody, request: Request, dept_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
            conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Save rows of the department's SLA grid. Only the fields SENT change (an explicit null turns a threshold off). All rows are
    checked first - priority, values, revision - and nothing is written unless every row passes (409 `sla_stale` names the rows
    whose revision moved). Open tickets of a changed priority get their dues recomputed at once."""
    viewer = _configurer(conn, principal)
    _dept_or_404(conn, dept_id)
    prios = {p["id"]: p for p in store.priorities(conn, dept_id)}
    plans: list[tuple[dict[str, Any], dict[str, Any] | None, dict[str, Any], int]] = []
    problems: list[dict[str, str]] = []
    stale_rows: list[str] = []
    seen_ids: set[str] = set()
    for i, row in enumerate(body.rows):
        p = prios.get(row.priority_id)
        if p is None or row.priority_id in seen_ids:
            problems.append({"field": f"rows.{i}.priority_id", "code": "unknown"})
            continue
        seen_ids.add(row.priority_id)
        sent = {k: getattr(row, k) for k in row.model_fields_set - {"priority_id", "revision"}}
        try:
            clean = sla.validate_rule(sent)
        except model.Invalid as exc:
            problems.extend({"field": f"rows.{i}.{pr.field}", "code": pr.code} for pr in exc.problems)
            continue
        current = store.sla_rule(conn, dept_id, row.priority_id)
        if (current["revision"] if current else 0) != row.revision:
            stale_rows.append(row.priority_id)
            continue
        plans.append((p, current, clean, row.revision))
    if problems:
        raise ApiError(422, "validation", text(conn, "ערך לא תקין."), details={"fields": problems})
    if stale_rows:
        raise ApiError(409, "sla_stale", text(conn, "הספים השתנו בינתיים. טענו מחדש."), details={"priority_ids": stale_rows})
    for p, current, clean, revision in plans:
        changes = {k: [(current or {}).get(k), v] for k, v in clean.items() if (current or {}).get(k) != v}
        if not changes and current is not None:
            continue
        if not store.write_sla_rule(conn, dept_id, p["id"], clean, revision, principal.user_id):
            raise ApiError(409, "sla_stale", text(conn, "הספים השתנו בינתיים. טענו מחדש."), details={"priority_ids": [p["id"]]})
        sla.refresh_many(conn, store.open_ticket_ids(conn, dept_id, priority_id=p["id"]))
        audit(conn, actor=principal, action="ticket.sla.update", decision="allowed", resource_type="ticket_department", resource_id=dept_id,
              request_id=_rid(request), details={"priority_id": p["id"], "priority_key": p["key"], "changes": changes})
    return _department_dict(conn, viewer, store.department(conn, dept_id) or {})


# ---------------------------------------------------------------- ticket templates (slice 2; message templates are slice 5b's)

class TemplateBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["ticket", "message"] | None = None
    name: str | None = Field(default=None, max_length=200)
    title: str | None = Field(default=None, max_length=1000)
    body: str | None = Field(default=None, max_length=20000)
    category_id: str | None = Field(default=None, pattern=ID)
    priority_key: str | None = Field(default=None, max_length=20)
    active: StrictBool | None = None
    revision: int | None = Field(default=None, ge=1)


def _template_fields(conn: sqlite3.Connection, body: TemplateBody, dept_id: str, *, creating: bool) -> dict[str, Any]:
    if (body.kind or "ticket") not in templates.KINDS_BUILT:
        raise _invalid(conn, "kind", "not_supported")  # message templates arrive with the message channel (slice 5b)
    sent = {k: getattr(body, k) for k in body.model_fields_set - {"kind", "revision"}}
    try:
        fields = templates.validate_ticket(sent, creating=creating)
    except model.Invalid as exc:
        raise ApiError(422, "validation", text(conn, "ערך לא תקין."),
                       details={"fields": [{"field": p.field, "code": p.code} for p in exc.problems]}) from None
    if fields.get("category_id"):
        cat = store.category(conn, fields["category_id"])
        if cat is None or cat["department_id"] != dept_id:
            raise _invalid(conn, "category_id", "unknown")
    return fields


def _template_or_404(conn: sqlite3.Connection, template_id: str) -> dict[str, Any]:
    t = store.template(conn, template_id)
    if t is None or t["department_id"] is None or store.department(conn, t["department_id"]) is None:
        raise ApiError(404, "not_found", text(conn, "התבנית לא נמצאה."))
    return t


@router.post("/tickets/admin/departments/{dept_id}/templates", status_code=201)
def create_template(body: TemplateBody, request: Request, dept_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
                    conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = _configurer(conn, principal)
    _dept_or_404(conn, dept_id)
    fields = _template_fields(conn, body, dept_id, creating=True)
    if len(store.templates(conn, dept_id, kind="ticket")) >= 50:
        raise ApiError(409, "too_many_templates", text(conn, "הגעתם למספר התבניות המרבי למחלקה."), details={"max": 50})
    tid = store.insert_template(conn, dept_id, "ticket", fields, principal.user_id)
    audit(conn, actor=principal, action="ticket.template.create", decision="allowed", resource_type="ticket_template", resource_id=tid,
          request_id=_rid(request), details={"department_id": dept_id, "kind": "ticket", "diff": templates.text_diff(None, store.template(conn, tid))})
    return _department_dict(conn, viewer, store.department(conn, dept_id) or {})


@router.patch("/tickets/admin/templates/{template_id}")
def patch_template(body: TemplateBody, request: Request, template_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
                   conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = _configurer(conn, principal)
    before = _template_or_404(conn, template_id)
    if body.revision is None:
        raise _invalid(conn, "revision", "required")
    if body.kind is not None and body.kind != before["kind"]:
        raise _invalid(conn, "kind", "immutable")
    fields = _template_fields(conn, body, before["department_id"], creating=False)
    if not store.update_template(conn, template_id, fields, body.revision, principal.user_id):
        raise ApiError(409, "template_stale", text(conn, "התבנית השתנתה בינתיים. טענו מחדש."), details={"revision": before["revision"]})
    after = store.template(conn, template_id)
    changed = sorted(k for k in fields if before.get(k) != fields[k])
    audit(conn, actor=principal, action="ticket.template.update", decision="allowed", resource_type="ticket_template", resource_id=template_id,
          request_id=_rid(request), details={"department_id": before["department_id"], "kind": before["kind"], "fields": changed,
                                             "diff": templates.text_diff(before, after)})
    return _department_dict(conn, viewer, store.department(conn, before["department_id"]) or {})


@router.delete("/tickets/admin/templates/{template_id}")
def delete_template(request: Request, template_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
                    conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = _configurer(conn, principal)
    before = _template_or_404(conn, template_id)
    store.soft_delete_template(conn, template_id, principal.user_id)
    audit(conn, actor=principal, action="ticket.template.delete", decision="allowed", resource_type="ticket_template", resource_id=template_id,
          request_id=_rid(request), details={"department_id": before["department_id"], "kind": before["kind"], "diff": templates.text_diff(before, None)})
    return _department_dict(conn, viewer, store.department(conn, before["department_id"]) or {})


# ---------------------------------------------------------------- members (the escalation rule, review T19)

class MemberBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    role: Literal["manager", "member"]
    notify_new: bool | None = None


def _member_guard(conn: sqlite3.Connection, viewer: Viewer, dept_id: str, kind: str, subject_id: str, role: str | None, request: Request) -> None:
    def deny(reason: str) -> ApiError:
        audit(conn, actor=viewer.principal, action="ticket.member.change", decision="denied", resource_type="ticket_department", resource_id=dept_id,
              reason=reason, request_id=_rid(request), details={"subject_kind": kind, "subject_id": subject_id, "role": role})
        return ApiError(403, "forbidden", text(conn, "אין הרשאה לשנות את חברי המחלקה הזו."), details={"reason": reason})

    if not _may_edit_members(viewer, dept_id):
        raise deny("not_manager_of_department")
    me = viewer.uid
    concerns_me = (kind == "user" and subject_id == me) or (kind == "group" and subject_id in store.group_ids_of(conn, me))
    # nobody makes themself a manager of a department they do not already manage - except a holder of tickets.all_departments at the
    # installation (PENDING owner confirmation, 2026-10-14: a solo system administrator could not add himself as a manager). Such a
    # holder already sees and manages every department; the add is audited as usual with `self: true` (put_member).
    if concerns_me and role == "manager" and viewer.role(dept_id) != "manager" and not viewer.holds_installation(access.ALL_DEPARTMENTS):
        raise deny("self_escalation")


@router.put("/tickets/admin/departments/{dept_id}/members/{kind}/{subject_id}")
def put_member(body: MemberBody, request: Request, dept_id: str = Path(..., pattern=ID), kind: Literal["user", "group"] = Path(...),
               subject_id: str = Path(..., min_length=1, max_length=200), principal: Principal = Depends(current_principal),
               conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = _configurer(conn, principal)
    _dept_or_404(conn, dept_id)
    _member_guard(conn, viewer, dept_id, kind, subject_id, body.role, request)
    if kind == "user" and subject_id not in store.active_user_ids(conn):
        raise ApiError(404, "user_unknown", text(conn, "המשתמש לא נמצא או אינו פעיל."))
    if kind == "group" and not any(g["id"] == subject_id for g in store.groups(conn)):
        raise ApiError(404, "group_unknown", text(conn, "הקבוצה לא נמצאה."))
    before = store.member_row(conn, dept_id, kind, subject_id)
    notify_new = body.notify_new
    if notify_new is None:  # the department's FIRST manager is told about new tickets; later ones opt in (review: notification fatigue)
        notify_new = bool(before["notify_new"]) if before else (body.role == "manager" and store.manager_count(conn, dept_id) == 0)
    store.upsert_member(conn, dept_id, kind, subject_id, body.role, 1 if notify_new and body.role == "manager" else 0, principal.user_id)
    audit(conn, actor=principal, action="ticket.member.add" if before is None else "ticket.member.update", decision="allowed",
          resource_type="ticket_department", resource_id=dept_id, request_id=_rid(request),
          details={"subject_kind": kind, "subject_id": subject_id, "role": body.role, "before": before["member_role"] if before else None,
                   "self": (kind == "user" and subject_id == principal.user_id) or (kind == "group" and subject_id in store.group_ids_of(conn, principal.user_id))})
    return _department_dict(conn, Viewer(conn, principal), store.department(conn, dept_id) or {})


@router.delete("/tickets/admin/departments/{dept_id}/members/{kind}/{subject_id}")
def delete_member(request: Request, dept_id: str = Path(..., pattern=ID), kind: Literal["user", "group"] = Path(...),
                  subject_id: str = Path(..., min_length=1, max_length=200), principal: Principal = Depends(current_principal),
                  conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = _configurer(conn, principal)
    _dept_or_404(conn, dept_id)
    _member_guard(conn, viewer, dept_id, kind, subject_id, None, request)
    before = store.member_row(conn, dept_id, kind, subject_id)
    if before is None:
        raise ApiError(404, "not_found", text(conn, "החבר לא נמצא במחלקה."))
    store.delete_member(conn, dept_id, kind, subject_id)
    from ..services.tickets import staff_links  # TKSTAFF1 (R7 b): a user who left the department holds no live staff link

    staff_links.safe_recheck(conn)
    audit(conn, actor=principal, action="ticket.member.remove", decision="allowed", resource_type="ticket_department", resource_id=dept_id,
          request_id=_rid(request), details={"subject_kind": kind, "subject_id": subject_id, "role": before["member_role"]})
    return _department_dict(conn, Viewer(conn, principal), store.department(conn, dept_id) or {})


# ---------------------------------------------------------------- TKSTAFF1: a staff member's mobile (the no-login staff link)

class StaffMobileBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    phone: str | None = Field(default=None, max_length=40)
    lang: Literal["he", "en", "ar", "ru"] | None = None
    notify_whatsapp: StrictBool | None = None
    phone_verify: StrictBool | None = None  # TKNOTIFOTP: "verify the number with a code" for this person


@router.put("/tickets/admin/staff/{user_id}")
def put_staff_mobile(body: StaffMobileBody, request: Request, user_id: str = Path(..., min_length=1, max_length=200),
                     principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """"מטפלים וספקים" › מטפלים › "עם חשבון במערכת": the mobile (E.164), the message language and the user's WhatsApp switch of an
    internal employee with an account (services/tickets/staff_links.set_mobile; tickets.configure; audited without the number)."""
    from ..services.tickets import staff_links

    viewer = _configurer(conn, principal)
    sent = body.model_dump(exclude_unset=True)
    return staff_links.set_mobile(conn, viewer, user_id, sent, _rid(request))


# ---------------------------------------------------------------- pickers and the permissions overview (section 8.2)

@router.get("/tickets/admin/directory")
def directory(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn),
              q: str = Query("", max_length=60)) -> dict[str, Any]:
    """The people and groups a department's member list may name - names only (the member editor's picker)."""
    _configurer(conn, principal)
    needle = model.clean_text(q).casefold()
    users = [{"id": uid, "name": store.display_name(conn, uid)} for uid in store.active_user_ids(conn)]
    users = sorted((u for u in users if not needle or needle in u["name"].casefold()), key=lambda u: u["name"])[:200]
    groups = [g for g in store.groups(conn) if not needle or needle in g["name"].casefold()][:100]
    return {"users": users, "groups": groups}


@router.get("/tickets/admin/holders")
def holders(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """Who holds a ticket permission and through what - a role, a group, or a single-permission grant to that person (D25, section
    8.2): one place that shows every grant the bindings lists hold. Grants are made with the ordinary binding route (rbac.assign)."""
    _configurer(conn, principal)
    from ..rbac import role_name

    people: dict[str, dict[str, Any]] = {}
    for b in store.active_bindings(conn, now_iso()):
        perms = [p for p in role_permissions(conn, b["role_id"]) if p in access.TICKET_PERMISSIONS]
        if not perms:
            continue
        via = "grant" if b["role_id"] in GRANT_ROLES and b["subject_kind"] == "user" else "group" if b["subject_kind"] == "group" else "role"
        targets = [b["subject_id"]] if b["subject_kind"] == "user" else store.group_member_ids(conn, b["subject_id"])
        for uid in targets:
            entry = people.setdefault(uid, {"id": uid, "name": store.display_name(conn, uid), "active": store.user_is_active(conn, uid), "grants": []})
            entry["grants"].append({
                "binding_id": b["id"], "permissions": perms, "via": via, "role_id": b["role_id"], "role_name": role_name(conn, b["role_id"]),
                "group_name": store.group_name(conn, b["subject_id"]) if b["subject_kind"] == "group" else None,
                "scope_type": b["scope_type"], "scope_id": b["scope_id"], "scope_name": scope_name(conn, b["scope_type"], b["scope_id"]),
                "effect": b["effect"], "expires_at": b["expires_at"],
            })
    # slice 2 - the "מי רשאי" matrix: every role (built-in and organisation-defined) with the ticket permissions it carries; the
    # single-permission grant roles are the personal-grant card's, not rows here
    roles = []
    for role_id, perms in all_roles(conn).items():
        if role_id in GRANT_ROLES:
            continue
        roles.append({"id": role_id, "name": role_name(conn, role_id), "builtin": role_id in ROLES,
                      "permissions": [p for p in access.TICKET_PERMISSIONS if p in perms]})
    order = {r: i for i, r in enumerate(("viewer", "kiosk", "operator", "editor", "door_opener", "site_admin", "system_admin"))}
    roles.sort(key=lambda r: (not r["builtin"], order.get(r["id"], 50), r["name"]))
    return {"users": sorted(people.values(), key=lambda u: u["name"]), "grant_roles": [r for r in GRANT_ROLES if r in ROLES], "roles": roles}


# ---------------------------------------------------------------- CR-ORG-LOCATIONS: the organisation's locations (migration 0101, provisional)

class LocationBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str | None = Field(default=None, max_length=400)  # the real limits (40 / 60 / 30 / 200) are the service's: a 422 names the field
    street: str | None = Field(default=None, max_length=400)
    city: str | None = Field(default=None, max_length=400)
    details: str | None = Field(default=None, max_length=1000)
    lat: float | None = None
    lng: float | None = None
    active: StrictBool | None = None
    is_default: StrictBool | None = None
    sort_order: StrictInt | None = None
    revision: StrictInt | None = Field(default=None, ge=1)  # optional optimistic check on a patch


class DepartmentLocationBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    location_id: str | None = Field(default=None, max_length=64, pattern=ID)


def _loc_invalid(conn: sqlite3.Connection, exc: Any) -> ApiError:
    if exc.code == "duplicate":
        return ApiError(409, "location_name_taken", text(conn, "כבר קיים מיקום בשם הזה."), details={"fields": [{"field": "name", "code": "duplicate"}]})
    return _invalid(conn, exc.field, exc.code)


def _location_or_404(conn: sqlite3.Connection, location_id: str) -> dict[str, Any]:
    loc = store_locations.location(conn, location_id)
    if loc is None:
        raise ApiError(404, "location_not_found", text(conn, "המיקום לא נמצא."))
    return loc


@router.get("/tickets/locations")
def list_locations(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The ACTIVE locations (name + address, no coordinates) for the creation forms' picker, with the organisation and department
    defaults: whoever may see or create requests (tickets.view / create / external anywhere) or configure the module."""
    viewer = Viewer(conn, principal)
    if not org_locations.may_read(viewer):
        audit(conn, actor=principal, action="ticket.location.list", decision="denied", resource_type="installation", resource_id="*", reason="no_binding")
        raise ApiError(403, "forbidden", text(conn, "אין הרשאה ל{tickets}."), details={"permission": access.VIEW})
    return org_locations.reader_list(conn)


@router.get("/tickets/admin/locations")
def admin_locations(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    _configurer(conn, principal)
    return org_locations.admin_list(conn)


@router.post("/tickets/admin/locations", status_code=201)
def create_location(body: LocationBody, request: Request, principal: Principal = Depends(current_principal),
                    conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _configurer(conn, principal)
    if len(store_locations.locations(conn, active_only=False)) >= org_locations.LOCATIONS_MAX:
        raise ApiError(409, "locations_limit", text(conn, "הגעתם למספר המיקומים המרבי."))
    try:
        fields = org_locations.clean_fields(conn, body.model_dump(exclude={"revision"}, exclude_unset=True), current=None)
    except org_locations.Invalid as exc:
        raise _loc_invalid(conn, exc) from None
    if fields.get("is_default"):
        store_locations.clear_default(conn)
    lid = store_locations.insert(conn, fields, principal.user_id)
    audit(conn, actor=principal, action="ticket.location.create", decision="allowed", resource_type="ticket_org_location", resource_id=lid,
          request_id=_rid(request), details={"fields": sorted(fields)})
    out = org_locations.admin_list(conn)
    out["id"] = lid
    return out


@router.patch("/tickets/admin/locations/{location_id}")
def patch_location(body: LocationBody, request: Request, location_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
                   conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _configurer(conn, principal)
    loc = _location_or_404(conn, location_id)
    if body.revision is not None and body.revision != loc["revision"]:
        raise ApiError(409, "stale", text(conn, "המיקום עודכן בינתיים. רעננו ונסו שוב."), details={"revision": loc["revision"]})
    try:
        fields = org_locations.clean_fields(conn, body.model_dump(exclude={"revision"}, exclude_unset=True), current=loc)
    except org_locations.Invalid as exc:
        raise _loc_invalid(conn, exc) from None
    if fields.get("is_default"):
        store_locations.clear_default(conn, except_id=location_id)
    store_locations.update(conn, location_id, fields, principal.user_id)
    cleared = store_locations.clear_department_defaults_of(conn, location_id) if fields.get("active") == 0 else 0
    audit(conn, actor=principal, action="ticket.location.update", decision="allowed", resource_type="ticket_org_location", resource_id=location_id,
          request_id=_rid(request), details={"fields": sorted(fields), "department_defaults_cleared": cleared})
    return org_locations.admin_list(conn)


@router.delete("/tickets/admin/locations/{location_id}")
def delete_location(request: Request, location_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
                    conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """A hard delete of a location NO request or RFQ names (a department default pointing at it is cleared); a referenced one answers
    409 `location_in_use` - deactivate it instead (history keeps its snapshot either way)."""
    _configurer(conn, principal)
    _location_or_404(conn, location_id)
    refs = store_locations.references(conn, location_id)
    if refs["tickets"] or refs["rfqs"]:
        audit(conn, actor=principal, action="ticket.location.delete", decision="denied", resource_type="ticket_org_location", resource_id=location_id,
              request_id=_rid(request), reason="location_in_use", details={"tickets": refs["tickets"], "rfqs": refs["rfqs"]})
        raise ApiError(409, "location_in_use", text(conn, "המיקום כבר משמש בקשות קיימות. אפשר להשבית אותו במקום למחוק."),
                       details={"tickets": refs["tickets"], "rfqs": refs["rfqs"]})
    store_locations.clear_department_defaults_of(conn, location_id)
    store_locations.delete(conn, location_id)
    audit(conn, actor=principal, action="ticket.location.delete", decision="allowed", resource_type="ticket_org_location", resource_id=location_id,
          request_id=_rid(request))
    return org_locations.admin_list(conn)


@router.put("/tickets/admin/departments/{dept_id}/location")
def put_department_location(body: DepartmentLocationBody, request: Request, dept_id: str = Path(..., pattern=ID),
                            principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Owner answer 17.10 (b): the department's OPTIONAL default location (null = none; it then follows the organisation's default)."""
    _configurer(conn, principal)
    d = _dept_or_404(conn, dept_id)
    if body.location_id:
        loc = store_locations.location(conn, body.location_id)
        if loc is None or not loc["active"]:
            raise _invalid(conn, "location_id", "unknown")
    store_locations.set_department_default(conn, d["id"], body.location_id or None)
    audit(conn, actor=principal, action="ticket.location.department_default", decision="allowed", resource_type="ticket_department",
          resource_id=d["id"], request_id=_rid(request), details={"location_id": body.location_id or None})
    return org_locations.admin_list(conn)
