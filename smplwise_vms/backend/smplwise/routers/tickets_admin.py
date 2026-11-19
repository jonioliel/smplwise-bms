"""CR-038 slice 1 - the module's settings API: the display settings document (D18 / D22, `system.configure`), the display name
(D33, `tickets.configure`), departments with their categories, priorities and members (`tickets.configure`), the people pickers
and the list of who holds a ticket permission (the "הרשאות" tab, section 8.2).

Escalation rules (review T19, section 8): `tickets.configure` is sensitive; a member edit needs `tickets.configure` AND (a manager
member of that department OR `tickets.all_departments`); nobody makes themself a manager of a department they do not already manage
(directly or through a group they belong to); the creator of a department who does not hold `tickets.all_departments` becomes its first
manager. Department configuration is installation-wide, so these permissions are checked at installation scope. Every write is audited
(ids and field names, never free text). Mounted BEFORE routers/tickets.py (its `/tickets/{ticket_id}` would match these paths).

CR-SPLIT-TICKETS-ADMIN-2440 (review 05:P2-08): the 1,400 lines that lived here are split along their section comments into
sibling modules, moved unchanged - tickets_admin_base (patterns, shared helpers), _settings (the settings document, the logo, the
display name), _departments, _catalogue (categories, priorities, SLA, templates), _people (members, staff mobile, pickers, the
permissions overview) and _locations. Every part declares its router with the module gate, as this one did. This module is what
it was for every importer: `router` carries the same routes in the same order and every name is re-exported below. New code
imports from the part itself; a test that replaces a module-level value patches the part that reads it."""
from __future__ import annotations

from fastapi import APIRouter

from . import tickets_admin_catalogue, tickets_admin_departments, tickets_admin_locations, tickets_admin_people, tickets_admin_settings
from .tickets_admin_base import (
    COLOR, DOMAIN, GRANT_ROLES, ICON, KEY, _clean, _configurer,
)
from .tickets_admin_catalogue import (
    CategoryBody, PriorityBody, SlaBody, SlaRowBody, TemplateBody, _category_fields, _category_or_404, _template_fields, _template_or_404,
    create_category, create_template, delete_category, delete_template, patch_category, patch_priority, patch_template, put_sla,
)
from .tickets_admin_departments import (
    DepartmentBody, POLICY_FIELDS, RestoreBody, _HEB, _department_dict, _department_fields, _dept_or_404, _installation_defaults, _may_edit_members,
    _member_dicts, _policy_fields, create_department, delete_department, department_key_for, domains_of, list_departments, patch_department,
    restore_department, slug_key,
)
from .tickets_admin_locations import (
    DepartmentLocationBody, LocationBody, _loc_invalid, _location_or_404, admin_locations, create_location, delete_location, list_locations,
    location_plan_areas, patch_location, put_department_location,
)
from .tickets_admin_people import (
    MemberBody, StaffMobileBody, _member_guard, delete_member, directory, holders, put_member, put_staff_mobile,
)
from .tickets_admin_settings import (
    BudgetsPatch, CodePatch, CostsPatch, DirectoryPatch, HoursBody, IntakePatch, LinksPatch, NameBody, NameEntry, NotifyPatch, PrivacyPatch,
    PublicPatch, ReportsPatch, RfqAttachmentsPatch, RfqPatch, RfqVendorUploadsPatch, SettingsBody, StaffLinksPatch, UiPatch, VendorDocumentsPatch,
    VendorPortalPatch, VendorStatsPatch, VisitsPatch, _LOGO_WORDS, _confirm_prefix_change, _problem, delete_logo, get_notify_matrix, get_settings,
    put_name, put_settings, read_logo, upload_logo,
)

# the parts that declare routes, in the old route order (a test that walks this router's routes walks these); each part's own
# router carries the module gate, so this one needs no dependency of its own
PARTS = (tickets_admin_settings.router, tickets_admin_departments.router, tickets_admin_catalogue.router, tickets_admin_people.router, tickets_admin_locations.router)
router = APIRouter()
for _part in PARTS:
    router.include_router(_part)
del _part  # (the loop name must not stay bound: a module walk would read the last part's router as this module's)

__all__ = [
    "BudgetsPatch", "COLOR", "CategoryBody", "CodePatch", "CostsPatch", "DOMAIN", "DepartmentBody", "DepartmentLocationBody", "DirectoryPatch",
    "GRANT_ROLES", "HoursBody", "ICON", "IntakePatch", "KEY", "LinksPatch", "LocationBody", "MemberBody", "NameBody", "NameEntry", "NotifyPatch",
    "PARTS", "POLICY_FIELDS", "PriorityBody", "PrivacyPatch", "PublicPatch", "ReportsPatch", "RestoreBody", "RfqAttachmentsPatch", "RfqPatch",
    "RfqVendorUploadsPatch", "SettingsBody", "SlaBody", "SlaRowBody", "StaffLinksPatch", "StaffMobileBody", "TemplateBody", "UiPatch",
    "VendorDocumentsPatch", "VendorPortalPatch", "VendorStatsPatch", "VisitsPatch", "_HEB", "_LOGO_WORDS", "_category_fields", "_category_or_404",
    "_clean", "_configurer", "_confirm_prefix_change", "_department_dict", "_department_fields", "_dept_or_404", "_installation_defaults",
    "_loc_invalid", "_location_or_404", "_may_edit_members", "_member_dicts", "_member_guard", "_policy_fields", "_problem", "_template_fields",
    "_template_or_404", "admin_locations", "create_category", "create_department", "create_location", "create_template", "delete_category",
    "delete_department", "delete_location", "delete_logo", "delete_member", "delete_template", "department_key_for", "directory", "domains_of",
    "get_notify_matrix", "get_settings", "holders", "list_departments", "list_locations", "location_plan_areas", "patch_category", "patch_department",
    "patch_location", "patch_priority", "patch_template", "put_department_location", "put_member", "put_name", "put_settings", "put_sla",
    "put_staff_mobile", "read_logo", "restore_department", "router", "slug_key", "upload_logo",
]
