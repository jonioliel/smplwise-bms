"""The tickets settings API: the display settings document (D18 / D22, `system.configure`), the organisation's logo on the
public pages (VPORTAL) and the display name (D33, `tickets.configure`).

CR-SPLIT-TICKETS-ADMIN-2440 (review 05:P2-08): moved unchanged out of routers/tickets_admin.py, which still exports every name."""
from __future__ import annotations

import sqlite3
from typing import Any, Literal

from fastapi import APIRouter, Depends, File, Request, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict, Field, StrictBool, StrictInt

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn
from ..errors import ApiError, field_error
from ..rbac import INSTALLATION, Principal, all_roles, require
from ..remote_channel import is_remote
from ..services import tickets_admin_settings_store
from ..services.tickets import access, naming, settings_doc, sla, store
from ..services.tickets.access import text
from ._common import rid as _rid
from ._tickets_common import invalid
from .tickets import module_gate

router = APIRouter(dependencies=[Depends(module_gate)])


# ---------------------------------------------------------------- the display settings document (D18 / D22)

@router.get("/tickets/settings")
def get_settings(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    require(conn, principal, "system.configure", INSTALLATION)
    return settings_doc.read(conn)


@router.get("/tickets/settings/notify-matrix")
def get_notify_matrix(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """TKNOTIFMATRIX: what the matrix screen needs - the sources a department can be tuned for (key, label, whether "digest" is
    allowed), the departments, and how many events wait for the next digest. `system.configure`, like the document itself."""
    require(conn, principal, "system.configure", INSTALLATION)
    from ..rbac import ROLE_NAMES_HE
    from ..services import notify_channels
    from ..services.tickets import notify_matrix

    by_dept = notify_matrix.pending_by_department(conn)
    custom = {r["id"]: r["name_he"] for r in tickets_admin_settings_store.live_custom_role_names(conn)}
    from ..i18n import localize_for

    return localize_for(conn, principal, {"sources": [{"key": k, "label": notify_matrix.LABELS.get(k, k), "digest": k in notify_matrix.DIGESTABLE,
                         "assignee": k in notify_matrix.ASSIGNEE_SOURCES, "sla": k in notify_matrix.SLA_SOURCES} for k in notify_matrix.MATRIX_SOURCES],
            # 2.9.1: each department's priorities (the SLA policies are department x priority) and its held events
            "departments": [{"id": d["id"], "name": d["name"], "pending": by_dept.get(d["id"], 0),
                             "priorities": [{"id": p["id"], "key": p["key"], "name": p["name"]} for p in store.priorities(conn, d["id"]) if p["active"]]}
                            for d in store.departments(conn)],
            "users": [{"id": r["id"], "name": r["display_name"] or r["username"]}
                      for r in tickets_admin_settings_store.active_users(conn)],
            "roles": [{"id": rid, "name": ROLE_NAMES_HE.get(rid) or custom.get(rid) or rid} for rid in all_roles(conn)],
            # the channel groups this installation can deliver (push = web push / the phone app); in-app is always on
            "channels": [g for g, names in notify_matrix.CHANNEL_GROUPS.items() if any(n in notify_channels.CHANNELS for n in names)],
            "pending": notify_matrix.pending(conn)})  # I18N-BACKEND-2490 (third pass): source labels and role names in the reader's language


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
    table_mid_width: Literal["sentence", "department"] | None = None  # TICKETS-1440-COLUMN-SETTING-2360: the column the default table keeps at a medium width
    handled_days: StrictInt | None = None  # HANDLERLOAD: the default period of the "handled" number (days)
    camera_viewfinder: StrictBool | None = None  # CR-CAMVF-295: the live in-page camera viewfinder (default off)
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


class ReportsPatch(BaseModel):
    """CR-VENDORQ-294: reports to external contacts through the message queue and their documents by a temporary link (settings_doc
    `reports.*`; both switches OFF by default; settings_doc validates the ranges again)."""
    model_config = ConfigDict(extra="forbid")
    to_contacts: StrictBool | None = None
    documents: StrictBool | None = None
    email: StrictBool | None = None  # VENDORQ2-295
    document_hours: StrictInt | None = None
    document_max_opens: StrictInt | None = None


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
    start_worker: StrictBool | None = None  # SECFIX2-295 / PUB-04: portal/start's work on the listener's worker thread (default OFF)


class IntakePatch(BaseModel):
    """CR-INTAKE99: free-text request intake (WhatsApp drafts, OFF by default; settings_doc validates the ranges again)."""
    model_config = ConfigDict(extra="forbid")
    enabled: StrictBool | None = None
    whatsapp: StrictBool | None = None
    default_department: str | None = Field(default=None, max_length=64)
    classifier: Literal["rules", "off"] | None = None
    approval_reply: StrictBool | None = None
    unlisted_reply: StrictBool | None = None
    unlisted_reply_per_day: StrictInt | None = None
    coalesce_min: StrictInt | None = None
    sender_per_day: StrictInt | None = None
    sender_per_week: StrictInt | None = None
    installation_per_hour: StrictInt | None = None
    installation_per_day: StrictInt | None = None
    open_max: StrictInt | None = None
    draft_ttl_days: StrictInt | None = None
    rejected_keep_days: StrictInt | None = None
    block_days: StrictInt | None = None


class NotifyPatch(BaseModel):
    """TKNOTIFMATRIX: the per-department notification matrix and the daily digest (both OFF by default = today's behaviour).
    `matrix` is {department id | "*": {source: "now" | "digest" | "off"}}; settings_doc validates every cell again."""
    model_config = ConfigDict(extra="forbid")
    matrix_enabled: StrictBool | None = None
    matrix: dict[str, dict[str, str]] | None = Field(default=None, max_length=201)
    digest_enabled: StrictBool | None = None
    digest_time: str | None = Field(default=None, max_length=5)
    # 2.9.1: per department digest time / recipients / channel override, the urgent rule and its per-SLA override (settings_doc validates)
    departments: dict[str, dict[str, Any]] | None = Field(default=None, max_length=201)
    urgent_immediate: StrictBool | None = None
    sla_urgent: dict[str, str] | None = Field(default=None, max_length=2000)


class VendorStatsPatch(BaseModel):
    """CR-SVC215 (owner answers 28 / 30 / 36): the computed vendor card - its switch (default ON), the numbers shown, the default
    window, the repeat-visit window, who opens it and who sees money on it. settings_doc validates every value again."""
    model_config = ConfigDict(extra="forbid")
    enabled: StrictBool | None = None
    numbers: list[str] | None = Field(default=None, max_length=6)
    default_months: StrictInt | None = None
    repeat_days: StrictInt | None = None
    card_permission: str | None = Field(default=None, max_length=40)
    money_permission: str | None = Field(default=None, max_length=40)
    list_limit: StrictInt | None = None
    csv_columns: StrictBool | None = None
    strip_numbers: list[str] | None = Field(default=None, max_length=6)


class VendorDocumentsPatch(BaseModel):
    """CR-SVC215 slice 2: the vendor-document surfaces of the service module (the data is CR-MAINT215's)."""
    model_config = ConfigDict(extra="forbid")
    confirm_on_assign: StrictBool | None = None
    confirm_expiring: StrictBool | None = None
    comparison_marks: StrictBool | None = None


class VisitsPatch(BaseModel):
    """CR-SVC215 (owner answers 31 / 32 / 35 / 36): vendor visits and the missed-arrival detector (settings_doc validates the ranges)."""
    model_config = ConfigDict(extra="forbid")
    enabled: StrictBool | None = None
    grace_min: StrictInt | None = None
    claim_counts: StrictBool | None = None
    public_arrival: StrictBool | None = None
    staff_can_undo_claim: StrictBool | None = None
    early_min: StrictInt | None = None
    eta_window_min: StrictInt | None = None
    rfq_window_min: StrictInt | None = None
    notify_vendor_on_miss: StrictBool | None = None
    offer_access_request: StrictBool | None = None  # VENDORARRIVAL126B-295
    notify_internal_owner: StrictBool | None = None
    backfill_days: StrictInt | None = None


class BudgetsPatch(BaseModel):
    """CR-SVC215 (owner answers 33 / 34 / 36): budgets against approved costs (settings_doc validates the ranges)."""
    model_config = ConfigDict(extra="forbid")
    enabled: StrictBool | None = None
    warn_bp: StrictInt | None = None
    require_confirmation: StrictBool | None = None
    count_committed: StrictBool | None = None
    notify_configurers: StrictBool | None = None


class SettingsBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    vendor_stats: VendorStatsPatch | None = None  # CR-SVC215
    vendor_documents: VendorDocumentsPatch | None = None  # CR-SVC215 slice 2
    visits: VisitsPatch | None = None  # CR-SVC215
    budgets: BudgetsPatch | None = None  # CR-SVC215
    revision: int = Field(ge=0)
    ui: UiPatch | None = None
    device_long_press: Literal["sheet", "menu"] | None = None  # D17 (slice 3)
    links: LinksPatch | None = None  # slice 2
    send_hours: HoursBody | None = None  # slice 2
    calendar: dict[str, Any] | None = None  # SLACAL: the working-hours calendar, validated whole by services/tickets/work_calendar.validate_doc
    urgent_is_critical: StrictBool | None = None  # slice 2
    organization_name: str | None = Field(default=None, max_length=400)  # slice 4
    public: PublicPatch | None = None  # slice 4
    code: CodePatch | None = None  # slice 7
    costs: CostsPatch | None = None  # slice 9
    staff_links: StaffLinksPatch | None = None  # TKSTAFF1
    directory: DirectoryPatch | None = None  # CR-DEPT-MANAGER-HANDLERS (owner 2026-10-17)
    rfq: RfqPatch | None = None  # RFQQUESTIONS + CR-RFQ-PAYMENT-SCHEDULE + RFQATT review (attachments.allow_office)
    vendor_portal: VendorPortalPatch | None = None  # VPORTAL
    notify: NotifyPatch | None = None  # TKNOTIFMATRIX
    privacy: PrivacyPatch | None = None  # PRIVORG-291
    reports: ReportsPatch | None = None  # CR-VENDORQ-294
    intake: IntakePatch | None = None  # CR-INTAKE99


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
        raise field_error(text(conn, "שינוי כתובת הדף הציבורי אפשרי רק בגישה מקומית: פתחו את המערכת מתוך Home Assistant או ברשת המקומית"),
                          ["public"], code="local_only", status=403, legacy={"field": "public"})
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
    for block in ("links", "public", "code", "costs", "staff_links", "directory", "rfq", "vendor_portal", "notify", "privacy", "reports",
                  "vendor_stats", "vendor_documents", "visits", "budgets", "intake"):  # TKNOTIFMATRIX / PRIVORG-291 / slice 2 / 4 / 7 / 9 / TKSTAFF1 / CR-DEPT-MANAGER-HANDLERS / RFQQUESTIONS + CR-RFQ-PAYMENT-SCHEDULE / VPORTAL / CR-SVC215 / CR-INTAKE99
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
    if body.calendar is not None:
        patch["calendar"] = body.calendar
    if body.urgent_is_critical is not None:
        patch["urgent_is_critical"] = body.urgent_is_critical
    if body.organization_name is not None:
        patch["organization_name"] = body.organization_name
    try:
        doc, changed = settings_doc.apply_patch(conn, patch)
    except ValueError as exc:
        raise invalid(conn, *_problem(exc)) from None
    if "calendar" in changed:  # SLACAL: the dues of every open ticket follow the new working hours at once
        sla.refresh_all_open(conn)
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
        raise invalid(conn, exc.field, exc.code) from None
    doc = naming.store(conn, languages, current["revision"] + 1)
    changed = sorted(lang for lang in languages if languages[lang] != current[lang])
    audit(conn, actor=principal, action="tickets.name.update", decision="allowed", resource_type="installation", resource_id="tickets",
          request_id=_rid(request), details={"revision": doc["revision"], "languages": changed})
    return doc
