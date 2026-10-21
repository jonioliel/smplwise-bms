"""REGSTART-295: the "identity" (local_reset) and "access" (access_grants) messaging uses are in the registry from application start.

Both join the registry only when their module is imported. create_app now imports them itself, so the Settings messaging accounts
screen never depends on what ran since the restart (same defect as temperature, TEMPREG-295).

Checked in a FRESH interpreter: re-importing these modules inside the pytest process would rebind their module-level state (senders,
hooks) and break later tests, so the test must not touch this process's module cache."""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

_SCRIPT = r"""
import json, sys
from pathlib import Path
from smplwise.config import Settings
from smplwise.services import messaging_runtime as mr

def state():
    mods = {getattr(p, "__module__", "") for p in mr._USE_PROVIDERS}
    return {"local_reset": "smplwise.services.local_reset" in mods, "access_grants": "smplwise.services.access_grants" in mods,
            "labels": sorted(set(mr._MODULE_LABELS) & {"identity", "access"}), "renderers": sorted(set(mr._LABELS) & {"identity", "access"})}

before = state()
from smplwise.main import create_app
data = Path(sys.argv[1])
create_app(Settings(data_dir=data / "data", www_dir=None, in_addon=False, trusted_proxies=("172.30.32.2",), dev_user="joni",
                    bootstrap_admin_username="joni", nvr_host="nvr-placeholder.test", nvr_http_port=80, nvr_user=None, nvr_password=None,
                    go2rtc_url=None, log_level="warning", max_upload_bytes=5 * 1024 * 1024, max_pdf_pages=5, max_render_px=800, preview_px=300))
print("RESULT" + json.dumps({"before": before, "after": state()}))
"""


def test_both_uses_are_registered_by_application_start_in_a_fresh_process(tmp_path: Path):
    r = subprocess.run([sys.executable, "-c", _SCRIPT, str(tmp_path)], capture_output=True, text=True, timeout=120, cwd=Path(__file__).resolve().parents[1])
    line = next((x for x in r.stdout.splitlines() if x.startswith("RESULT")), None)
    assert line is not None, r.stderr[-2000:]
    res = json.loads(line[len("RESULT"):])
    assert res["before"]["local_reset"] is False and res["before"]["access_grants"] is False  # nothing imported them yet: the starting point is the defect's
    after = res["after"]
    assert after["local_reset"] and after["access_grants"]
    assert after["labels"] == ["access", "identity"] and after["renderers"] == ["access", "identity"]
