"""CR-038 slice 2: department TICKET templates (`ticket_templates.kind = 'ticket'`) - a name plus a prefilled title, description,
category and priority that the create form offers - and the audit diff of a template edit (review T19: "template edits audited with
a diff"; template text is configuration, not personal data).

Message templates (`kind = 'message'`: purposes, languages, the placeholder allow-list of 9.7, `{link}` / `{code}` rules) are slice
5b's: it adds `validate_message()` here and accepts `kind = 'message'` on the same admin routes. Until then the routes refuse it."""
from __future__ import annotations

import difflib
from typing import Any

from . import model

KINDS_BUILT = ("ticket",)
PRIORITY_KEYS = ("urgent", "high", "normal", "low")
NAME_MAX = 60
DIFF_MAX = 4000


def validate_ticket(values: dict[str, Any], *, creating: bool) -> dict[str, Any]:
    """The fields of a ticket template that were sent (`creating`: the name is required). Text hygiene as everywhere (Cc / Cf
    stripped, review T9); the category's department is checked by the caller (it needs the store)."""
    out: dict[str, Any] = {}
    problems: list[model.Problem] = []

    def text(key: str, *, required: bool, max_len: int, multiline: bool = False) -> None:
        try:
            out[key] = model.text_field(values.get(key), key, required=required, max_len=max_len, multiline=multiline)
        except model.Invalid as exc:
            problems.extend(exc.problems)

    if creating or "name" in values:
        text("name", required=True, max_len=NAME_MAX)
    if "title" in values:
        text("title", required=False, max_len=model.TITLE_MAX)
    if "body" in values:
        text("body", required=False, max_len=model.DESCRIPTION_MAX, multiline=True)
    if "priority_key" in values:
        pk = values["priority_key"]
        if pk is not None and pk not in PRIORITY_KEYS:
            problems.append(model.Problem("priority_key", "unknown"))
        else:
            out["priority_key"] = pk
    if "category_id" in values:
        out["category_id"] = values["category_id"] or None
    if "active" in values:
        if not isinstance(values["active"], bool):
            problems.append(model.Problem("active", "boolean"))
        else:
            out["active"] = 1 if values["active"] else 0
    if problems:
        raise model.Invalid(problems)
    return out


def text_diff(before: dict[str, Any] | None, after: dict[str, Any] | None) -> str:
    """A unified diff of the template's texts (name, title, body), capped at DIFF_MAX characters - the audit row's `diff`."""
    def lines(t: dict[str, Any] | None) -> list[str]:
        if not t:
            return []
        out = [f"name: {t.get('name') or ''}", f"title: {t.get('title') or ''}"]
        out += [f"body: {ln}" for ln in (t.get("body") or "").split("\n")]
        return out

    diff = "\n".join(difflib.unified_diff(lines(before), lines(after), "before", "after", lineterm="", n=1))
    return diff if len(diff) <= DIFF_MAX else diff[: DIFF_MAX - 1] + "…"


def as_dict(t: dict[str, Any]) -> dict[str, Any]:
    return {"id": t["id"], "kind": t["kind"], "name": t["name"], "title": t["title"], "body": t["body"], "category_id": t.get("category_id"),
            "priority_key": t.get("priority_key"), "active": bool(t["active"]), "revision": t["revision"], "updated_at": t["updated_at"]}
