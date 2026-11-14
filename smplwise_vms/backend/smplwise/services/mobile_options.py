"""Mobile options - the phone UX guards (owner decisions 2026-09-30).

`ui.mobile` (PATCH /settings, installation-wide, system.configure like every ui.* key) is a JSON object of booleans, read
back as an object; each true value asks the phone UI (viewport narrower than 768 px) to hide one kind of management:

  hide_structure        sites / buildings / floors / plans: create, edit, delete, plan import, the plan editor, "עריכת המפה"   (default on)
  hide_layout_editor    the area layout editor                                                                                  (default off)
  hide_wall_arrange     the camera wall's arrangement mode                                                                      (default off)
  hide_settings_writes  settings screens that create or delete things (schedules, device catalogue, wizard, setup)              (default off)
  hide_permissions      the permissions and roles screen                                                                        (default off)
  hide_control_images   the floor map's "תמונות בקרה" export button                                                             (default on)

A UX guard only: no permission depends on it, the server still enforces every permission on every write, and a wide
window (or a phone browser's desktop mode) reaches the same screens. The frontend (shell/phone.ts) keeps the same keys.
Unknown keys and non-boolean values are refused (422), never dropped silently; keys left out keep their default."""
from __future__ import annotations

from typing import Any

DEFAULT: dict[str, bool] = {
    "hide_structure": True,
    "hide_layout_editor": False,
    "hide_wall_arrange": False,
    "hide_settings_writes": False,
    "hide_permissions": False,
    "hide_control_images": True,
}


def normalize(value: Any) -> dict[str, bool]:
    """The value in its canonical form (every key present), or ValueError."""
    if not isinstance(value, dict):
        raise ValueError("mobile options must be an object")
    unknown = sorted(set(value) - set(DEFAULT))
    if unknown:
        raise ValueError("unknown mobile option: " + ", ".join(str(k) for k in unknown))
    out = dict(DEFAULT)
    for key, flag in value.items():
        if not isinstance(flag, bool):
            raise ValueError(f"mobile option {key} must be true or false")
        out[key] = flag
    return out
