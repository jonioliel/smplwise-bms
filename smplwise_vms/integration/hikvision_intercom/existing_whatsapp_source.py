"""Read the versioned same-integration descriptor; never expose account values."""

import json
from pathlib import Path
from .access.native_sqlite_backup import read_private

RELATIVE = ".storage/hikvision_intercom.arx_installation/existing_whatsapp_source.v1.json"


def inspect(config_root):
    try:
        value = json.loads(read_private(Path(config_root) / RELATIVE, limit=1048576))
    except FileNotFoundError:
        return {
            "contract": "wiskey-existing-template-source-status.v1",
            "schema_version": 1,
            "state": "not_identified",
            "accounts_count": 0,
            "missing_fields": [],
        }
    if (
        type(value) is not dict
        or set(value)
        != {
            "format",
            "schema_version",
            "integration",
            "service",
            "service_fields",
            "accounts",
            "template_metadata",
            "templates",
            "missing_fields",
            "cloud_credentials",
        }
        or value["format"] != "wiskey-existing-whatsapp-source.v1"
        or type(value["schema_version"]) is not int
        or value["schema_version"] != 1
        or value["integration"] != "ha-whatsapp"
        or value["service"] != "whatsapp.send_message"
        or value["service_fields"] != ["account", "target", "message"]
        or type(value["accounts"]) is not list
        or value["template_metadata"] != "not_exposed_by_send_service"
        or value["templates"] != []
        or value["cloud_credentials"] != "not_applicable_to_this_service_interface"
        or value["missing_fields"]
        != [
            "approved_template_reference",
            "template_revision",
            "account_binding",
            "approved_body",
            "language",
            "ordered_parameter_fields",
            "approval_provenance",
        ]
    ):
        raise ValueError("existing_whatsapp_source_invalid")
    for row in value["accounts"]:
        if (
            type(row) is not dict
            or set(row) != {"account", "service_account"}
            or any(type(v) is not str or not v for v in row.values())
        ):
            raise ValueError("existing_whatsapp_source_invalid")
    return {
        "contract": "wiskey-existing-template-source-status.v1",
        "schema_version": 1,
        "state": "metadata_missing",
        "accounts_count": len(value["accounts"]),
        "missing_fields": value["missing_fields"],
    }
