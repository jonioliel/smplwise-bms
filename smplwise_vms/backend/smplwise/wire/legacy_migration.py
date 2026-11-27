"""Response models of routers/legacy_migration.py (LEGACY-MIGRATION-2550, T070)."""
from __future__ import annotations

from typing import Any

from pydantic import Field

from . import ExactModel, Num


class LegacyImportRun(ExactModel):
    at: str
    by: str | None
    sha256: str
    container: str
    applied: Num
    unchanged: Num
    backup: str | None
    plan_digest: str


class LegacyImportConfirm(ExactModel):
    he: str
    en: str


class LegacyImportStatus(ExactModel):
    runs: list[LegacyImportRun]
    max_bytes: Num
    backup_kind: str
    confirm: LegacyImportConfirm
    legacy_version: str


class LegacyImportSource(ExactModel):
    container: str
    sha256: str
    bytes: Num
    legacy_version: str | None
    found: list[str]
    ignored_members: Num
    read_at: str


class LegacyImportSummary(ExactModel):
    create: Num
    update: Num
    same: Num
    keep: Num
    skip: Num
    manual: Num
    info: Num


class LegacyImportItem(ExactModel):
    id: str
    area: str
    action: str
    code: str
    note: str
    target: dict[str, Any] | None = None
    value: str | None = None


class LegacyImportWarning(ExactModel):
    code: str
    note: str


class LegacyImportTime(ExactModel):
    mode: str
    direction: str
    minutes: Num
    auto_minutes: Num
    manual_minutes: Num
    effective_minutes: Num
    zone: str


class LegacyImportReport(ExactModel):
    schema_: str = Field(alias="schema")
    source: LegacyImportSource
    summary: LegacyImportSummary
    items: list[LegacyImportItem]
    warnings: list[LegacyImportWarning]
    time: LegacyImportTime | None
    writes: dict[str, str]
    plan_digest: str
    applied_before: list[LegacyImportRun]


class LegacyImportBackup(ExactModel):
    name: str
    bytes: Num
    created_at: str


class LegacyImportCamera(ExactModel):
    camera_id: str
    channel: Num


class LegacyImportApply(ExactModel):
    applied: Num
    unchanged: Num
    cameras: list[LegacyImportCamera]
    backup: LegacyImportBackup | None
    already_applied: bool
    run: LegacyImportRun
