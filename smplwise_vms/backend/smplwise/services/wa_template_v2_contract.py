"""TPLV2-295: the ONE place that names every WisKey-defined thing the WhatsApp `template_send_v2` send path depends on.

Nothing else in the TPLV2-295 flow (services/wa_template_v2_flow.py, routers/access_control_template_v2.py) spells a WisKey command
name, a field name, a closed result code or a schema version: they read this module. When WisKey publishes or changes the numbered
contract, this is the only file (plus the two wire modules it re-exports from) that changes.

Each item carries a STATUS:
- `ADOPTED_W013`: taken from WisKey's `W013_TEMPLATE_SEND_V2.json` items 1-9 (contract revision 2, CODE 924df3e9) as already adopted
  on WK4ADOPT-295 / REL2210. Tested against Arx's FAKE only; never against a real station.
- `UNCONFIRMED`: Arx assumes it, WisKey has not confirmed it in writing. Marked here and listed in docs/changes/TPLV2-295.md.

`DIRECT_STATION_VERIFIED` is False: no real station or Mac queue has answered a v2 send. Honesty rule: nothing here lets a screen or a
report say "supported" or "delivered" - the strongest word is `accepted by the provider` (delivery stays unknown)."""
from __future__ import annotations

from typing import Any

from . import wa_template_send as wts
from . import wiskey_template_direct as wtd

ADOPTED = "ADOPTED_W013"
ADOPTED_MAC = "ADOPTED_MAC_2026_10_27"  # WISKEY-MAC-ADOPT-298: confirmed in writing by WisKey's seven template answers (product CODE c82b2d10)
UNCONFIRMED = "UNCONFIRMED"

# -- re-exported wire names (single import point for the flow) -------------------------------------------------------------------
COMMAND = wtd.V2_COMMAND                                 # "whatsapp/template_send_v2"
SCHEMA_VERSION = wts.SCHEMA_VERSION_V2                   # 2
REQUEST_KEYS = wts.V2_REQUEST_KEYS                       # the closed ten request keys
RESULT_KEYS = wts.V2_RESULT_KEYS                         # the closed six result keys
RESULT_COMBOS = wts.V2_COMBOS                            # (state, code, provider_accepted) -> accepted | not_sent | unknown
PACING_SCHEMA_VERSION = 1                                # WisKey's `pacing_schema_version` (exactly the JSON integer 1; see wa_pacing)

# Codes Arx itself produces when it refuses BEFORE any hand-over (never WisKey's words). All mean "nothing left Arx".
LOCAL_REFUSALS = ("template_unsupported", "template_not_found", "template_v2_unbound", "paced_unavailable", "paced", "pacing_expired",
                  "window_open", "invalid_reference", "invalid_fields")

# What WisKey's closed v2 result can say about a send it understood (codes of the three `not_sent`/`unknown` rows in RESULT_COMBOS).
WISKEY_NOT_SENT_CODES = tuple(sorted({c for (s, c, _pa) in RESULT_COMBOS if s == "not_sent"}))
WISKEY_UNKNOWN_CODES = tuple(sorted({c for (s, c, _pa) in RESULT_COMBOS if s == "unknown"}))

# -- the status table (also served to the Settings screen so nobody reads "supported" into a fake-only build) ----------------------
ITEMS: tuple[dict[str, str], ...] = (
    {"item": "command_name", "value": COMMAND, "status": ADOPTED, "note": "W013 item 1; discovered on the direct connection before use"},
    {"item": "request_keys", "value": "ten closed keys (no parameters, phone, PIN or body)", "status": ADOPTED, "note": "W013 item 2"},
    {"item": "result_schema", "value": "schema_version 2, six closed keys", "status": ADOPTED, "note": "W013 item 3-4; v1 results are never read as v2"},
    {"item": "template_ref_pair", "value": "template_ref + expected_template_revision", "status": ADOPTED,
     "note": "WisKey's private template reference; an administrator copies it from WisKey, Arx never invents it"},
    {"item": "person_revision_source", "value": "users/get `revision` of the recipient", "status": ADOPTED_MAC,
     "note": "WisKey answer 2 (Mac 03_template_peer, 27.10): the same native person revision users/get returns, compared before compose and "
             "re-checked before dispatch"},
    {"item": "pacing_schema_version", "value": str(PACING_SCHEMA_VERSION), "status": UNCONFIRMED,
     "note": "WisKey answer 3 (partial): v2 uses the native pacing ledger, message_class `code`; shared_budget_guaranteed=false - no shared "
             "provider budget is inferred"},
    {"item": "retry_after_on_not_sent", "value": "none in a closed v2 result", "status": ADOPTED_MAC,
     "note": "WisKey answer 4: `not_sent` + `source_or_admission_refused` is the closed non-dispatch result; no top-level retry_after; no "
             "delay or not_sent authorises replay of an UNKNOWN"},
    {"item": "conversation_window_signal", "value": "not needed: an explicit approved template is sent inside an open window", "status": ADOPTED_MAC,
     "note": "WisKey answer 5 option b; Arx's send_v2 no longer refuses `window_open` (WISKEY-MAC-ADOPT-298 item B)"},
    {"item": "queue_and_execution_source", "value": "Mac station production queue", "status": UNCONFIRMED,
     "note": "WisKey said the execution source and queue are not installed (23.10); no live v2 send has ever been made"},
)

DIRECT_STATION_VERIFIED = False


def items() -> list[dict[str, str]]:
    return [dict(i) for i in ITEMS]


def unconfirmed() -> list[str]:
    return [i["item"] for i in ITEMS if i["status"] == UNCONFIRMED]


def public_state() -> dict[str, Any]:
    """What Settings / the preview show about the contract: the list, how many items are unconfirmed, and that no station verified it."""
    return {"command": COMMAND, "station_verified": DIRECT_STATION_VERIFIED, "unconfirmed": unconfirmed(), "items": items()}
