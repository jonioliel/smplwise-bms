"""Response models of the investigation cases API (routers/cases.py, `/api/v1/cases...`, `/api/v1/events/{id}/route/confirm`,
`/api/v1/evidence/signing...`; T048-T050 cases, bookmarks and evidence bundles, T064 / M064 route confirm, T067 signing keys).
Field order is the order the router builds its dicts in. Stored documents pass through as stored: an imported case's `provenance`, an
imported item's `origin` (and the event copied from it), the bundle report's `signature` / `origin`."""
from __future__ import annotations

from typing import Any, Literal

from pydantic import Field

from . import Num, WireModel
from .events import EventRouteVia

# routes without a JSON body: the 204 deletes and the files
NO_JSON = frozenset({
    "DELETE /cases/{case_id}", "DELETE /cases/{case_id}/items/{item_id}", "GET /cases/{case_id}/items/{item_id}/file",
    "GET /cases/{case_id}/bundles/{name}",
})

Preservation = Literal["preserved", "preserving", "nvr_only", "missing", "unknown", "none", "not_in_bundle"]


class CaseCounts(WireModel):
    items: int
    events: int
    clips: int
    notes: int
    snapshots: int
    preserved: int


class CaseRow(WireModel):
    """One case (routers/cases.case_row); `origin` 'imported' cases carry the bundle's `provenance` document (T050)."""
    id: str
    title: str
    description: str
    status: str
    tags: list[str]
    owner_user_id: str
    owner_username: str
    revision: int
    created_at: str
    updated_at: str
    closed_at: str | None
    counts: CaseCounts
    origin: str
    provenance: dict[str, Any] | None


class CaseList(WireModel):
    cases: list[CaseRow]
    can_manage: bool
    can_import: bool


class CaseBookmark(WireModel):
    """A timeline bookmark (T049): an event / clip item of a case on one camera and local day."""
    id: str
    case_id: str
    case_title: str
    case_status: str
    kind: str
    event_id: str | None
    from_at: str | None
    to_at: str | None
    note: str
    added_by_username: str
    preservation: Literal["preserved", "preserving", "nvr"]


class CaseBookmarks(WireModel):
    camera_id: str
    date: str
    bookmarks: list[CaseBookmark]


class CaseItemExport(WireModel):
    """The export job that preserves the item's footage."""
    id: str
    state: str
    progress: Num
    download_ready: bool
    error: str | None


class CaseItem(WireModel):
    """One case item; `event` is the event's summary (an imported item: the event copied into the bundle, as stored)."""
    id: str
    case_id: str
    kind: str
    camera_id: str | None
    camera_name: str | None
    event_id: str | None
    event: dict[str, Any] | None
    export_job_id: str | None
    from_at: str | None
    to_at: str | None
    note: str
    added_by_username: str
    created_at: str
    preservation: Preservation
    export: CaseItemExport | None
    file_path: str | None
    file_sha256: str | None
    file_url: str | None
    imported: bool
    origin: dict[str, Any] | None


class CaseDetail(CaseRow):
    """`GET /cases/{id}`: the case with the items the caller may see; `checked` = the NVR coverage was probed."""
    items: list[CaseItem]
    hidden_items: int
    can_manage: bool
    checked: bool


class CaseRouteAdded(WireModel):
    """An item the route confirm added: the event (`event_id`) or a clip of a suggested camera (`relation`, `via`)."""
    id: str
    kind: Literal["event", "clip"]
    camera_id: str | None
    event_id: str = None
    relation: str = None
    via: EventRouteVia | None = None


class CaseRouteSkipped(WireModel):
    camera_id: str
    reason: str


class CaseRouteWindow(WireModel):
    from_: str = Field(alias="from")
    to: str


class CaseRouteConfirm(WireModel):
    """`POST /events/{id}/route/confirm` (M064): the case the suggested route went into - always a hypothesis."""
    case_id: str
    title: str
    created: bool
    added: list[CaseRouteAdded]
    skipped: list[CaseRouteSkipped]
    window: CaseRouteWindow
    hypothetical: bool


class CaseIntegrityFile(WireModel):
    item_id: str
    kind: str
    status: Literal["ok", "mismatch", "missing"]
    expected: str
    actual: str | None


class CaseIntegrity(WireModel):
    """`POST /cases/{id}/integrity`: every stored copy re-hashed against the hash recorded when it was captured or imported."""
    case_id: str
    checked_at: str
    ok: bool
    files: list[CaseIntegrityFile]
    hidden_items: int
    note: str


class CaseBundleSkipped(WireModel):
    item_id: str
    reason: str


class CaseBundleSignature(WireModel):
    alg: str
    kid: str


class CaseBundle(WireModel):
    """`POST /cases/{id}/bundle`: the evidence bundle written (services/bundle.build) plus the items the caller could not see."""
    name: str
    bytes: int
    sha256: str
    files: int
    skipped: list[CaseBundleSkipped]
    created_at: str
    download_url: str
    signature: CaseBundleSignature
    hidden_items: int


class CaseBundleFile(WireModel):
    name: str
    bytes: int
    created_at: str
    download_url: str
    signed: str | None


class CaseBundles(WireModel):
    bundles: list[CaseBundleFile]


class CaseVerifyFile(WireModel):
    path: str
    status: Literal["ok", "missing", "mismatch", "corrupt"]
    expected: str
    actual: str | None
    bytes: int | None


class CaseVerifyCounts(WireModel):
    ok: int
    missing: int
    mismatch: int
    corrupt: int
    extra: int


class CaseUpload(WireModel):
    """The uploaded bundle: its hash, size and the name the client gave."""
    sha256: str
    bytes: int
    name: str | None


class CaseAlreadyImported(WireModel):
    case_id: str
    title: str


class CaseVerify(WireModel):
    """`POST /cases/bundles/verify`: the verification report (services/bundle.verify_source) - `case` / `generated_at` only when the
    manifest was readable - plus the upload, whether this bundle's case already exists and whether it may be imported."""
    ok: bool
    schema_: str | None = Field(alias="schema")
    schema_version: int | None
    supported: bool
    files: list[CaseVerifyFile]
    extra: list[str]
    manifest_ok: bool | None
    errors: list[str]
    signature: dict[str, Any]
    authenticity: str
    origin: dict[str, Any] | None
    counts: CaseVerifyCounts
    summary: str
    case: str = None
    generated_at: str | None = None
    bundle: CaseUpload
    already_imported: CaseAlreadyImported | None
    importable: bool


class CaseImportReport(WireModel):
    """The verification report's summary kept with an import."""
    ok: bool
    summary: str
    counts: CaseVerifyCounts
    origin: dict[str, Any] | None
    signature: dict[str, Any]
    schema_: str | None = Field(alias="schema")
    schema_version: int | None
    authenticity: str


class CaseImport(WireModel):
    """`POST /cases/bundles/import`: the new imported case and what was stored."""
    case: CaseRow
    items: int
    files: int
    bytes: int
    bundle: CaseUpload
    report: CaseImportReport


class CaseSigningKey(WireModel):
    kid: str | None
    alg: str
    public_key: str | None
    created_at: str | None
    retired_at: str | None


class CaseSigning(WireModel):
    """`GET /evidence/signing` and the rotate answer (T067): the public halves of the installation's evidence-signing keys."""
    alg: str
    active: str | None
    keys: list[CaseSigningKey]
    trust: str
    can_rotate: bool
    installation_id: str = None
    """Only on `GET /evidence/signing`."""
