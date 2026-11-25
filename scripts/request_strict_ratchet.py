"""ADR-019 D2 (L14) ratchet: the tolerant web-UI request-body models may only go down.

    python scripts/request_strict_ratchet.py            # the counts per family (tolerant web-UI bodies, nested-only tolerant models)
    python scripts/request_strict_ratchet.py --check    # exit 1 when a family has more tolerant models than the baseline
    python scripts/request_strict_ratchet.py --write    # lower the baseline after a family row (never raise it by hand)

"Tolerant" = pydantic's default `extra` or an explicit `extra="ignore"` (the observing `RequestModel` of smplwise/wire/request.py
counts as tolerant: it still drops the key in production). Only bodies the WEB UI sends are counted: the phone-app, browser-push and
HA-bridge bodies stay tolerant by ADR-019 D2 and are not part of the ratchet. The facts come from the static scan of
`scripts/error_contract_inventory.py` (`scan_request_models`), so the counts carry its caveat (a floor, not an audit).

The baseline is `scripts/request_strict_ratchet.json` (ADR019-L14-STRICT-F123-2520). It lives apart from the legacy-422 ratchet
(`scripts/error_contract_ratchet.json`) on purpose: the two are lowered by different rows."""
from __future__ import annotations

import argparse
import importlib.util
import json
import sys
from collections import Counter
from pathlib import Path
from typing import Any

REPO = Path(__file__).resolve().parents[1]
BASELINE = REPO / "scripts" / "request_strict_ratchet.json"
TOLERANT = ("default", "ignore")


def _inventory():
    spec = importlib.util.spec_from_file_location("error_contract_inventory", REPO / "scripts" / "error_contract_inventory.py")
    m = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(m)
    return m


def _family(inv: Any, model: str) -> str:
    return inv.family_of(model.rsplit(".", 1)[0].replace(".", "/") + ".py")


def counts(root: Path | None = None) -> dict[str, Any]:
    """`{"web_ui_bodies": {family: n}, "nested_only": {family: n}, "total": n}` - the tolerant models the web UI reaches."""
    inv = _inventory()
    req = inv.scan_request_models(root or inv.ROOT)
    top = Counter(_family(inv, m["model"]) for m in req["models"] if m["extra"] in TOLERANT and "web_ui" in m["clients"])
    web_nested = {n["model"] for m in req["models"] if "web_ui" in m["clients"] for n in m["nested"]}
    nested = Counter(_family(inv, k) for k, e in req["nested_only"].items() if e in TOLERANT and k in web_nested)
    return {"web_ui_bodies": dict(sorted(top.items())), "nested_only": dict(sorted(nested.items())),
            "total": sum(top.values()) + sum(nested.values())}


def problems(now: dict[str, Any], base: dict[str, Any]) -> list[str]:
    """The (kind, family) pairs above the baseline (a family not in the baseline counts from 0); [] when the ratchet holds."""
    out: list[str] = []
    for kind in ("web_ui_bodies", "nested_only"):
        allowed = base.get(kind, {})
        out += [f"{kind}/{fam}: {n} tolerant models (baseline {allowed.get(fam, 0)})" for fam, n in sorted(now.get(kind, {}).items())
                if n > allowed.get(fam, 0)]
    return out


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    ap.add_argument("--check", action="store_true", help="compare with scripts/request_strict_ratchet.json")
    ap.add_argument("--write", action="store_true", help="write the current counts as the new baseline")
    a = ap.parse_args(argv)
    now = counts()
    sys.stdout.reconfigure(encoding="utf-8")
    if a.write:
        doc = {"_note": "ADR-019 D2 ratchet: tolerant web-UI request models per family (scripts/request_strict_ratchet.py --check); "
                        "counts may only go down.", **now}
        BASELINE.write_text(json.dumps(doc, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
        print(f"wrote {BASELINE.name}: {now['total']} tolerant web-UI models")
        return 0
    if a.check:
        bad = problems(now, json.loads(BASELINE.read_text(encoding="utf-8")))
        print("\n".join(bad) if bad else f"request strictness ratchet holds: {now['total']} tolerant web-UI models")
        return 1 if bad else 0
    print(json.dumps(now, ensure_ascii=False, indent=1))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
