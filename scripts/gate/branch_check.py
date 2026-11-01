#!/usr/bin/env python3
"""The ENTRY CHECK verdict (ENTRY-CHECK-2310). branch_check.sh runs the release-gate engine with the gate-2 change-based selection of a
branch against origin/main; this module turns the engine's report into the short entry verdict. Runs no test.

Owner decision 30.10 night: no branch boards a release train without a GREEN entry check.

  GREEN    the engine verdict is pass, or every failure is a test in the ACTIVE quarantine (ticket + expiry <= 7 days); exit 0
  RED      any other failure (a test outside the quarantine, a test whose quarantine EXPIRED, tsc / build / engine guard); exit 1
  NOT_RUN  no engine report (queue limit reached, branch missing, engine crash); exit 1 - never green

Files (in ~/smplwise-results, next to the gate reports; the engine's own report stays in ~/smplwise-results/entry/):
  entry_<branch-tag>_<sha>.md    short Hebrew + English verdict for the lead and the agent
  entry_<branch-tag>_<sha>.json  the same as machine JSON

  branch_check.py verdict --branch B --sha S --base origin/main --out-dir DIR [--report gate_<b>_<sha>.json] [--selection ...]
                          [--quarantine FILE] [--base-sha S] [--waited-s N] [--started ISO] [--nightly-results DIR] [--why TEXT]
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import gate2_verdict as g2v      # noqa: E402  (quarantine loader, classify: one implementation)

HE = {"GREEN": "ירוק - מותר לעלות לרכבת", "RED": "אדום - אסור לעלות לרכבת", "NOT_RUN": "לא רץ - אסור לעלות לרכבת"}
EN = {"GREEN": "GREEN - may board a release train", "RED": "RED - may not board a release train",
      "NOT_RUN": "NOT RUN - may not board a release train"}


def tag_of(branch: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]", "-", branch)


def _sel_summary(sel: dict | None) -> dict:
    if not sel:
        return {}
    b, f = sel.get("backend") or {}, sel.get("frontend") or {}
    full = sel.get("full") or {}
    return {"base": sel.get("base"), "backend": f"{len(b.get('selected', []))}/{b.get('total', '?')}",
            "frontend": f"{len(f.get('selected', []))}/{f.get('total', '?')}", "full_backend": bool(full.get("backend")),
            "full_frontend": bool(full.get("frontend")), "deferred_to_nightly": len(sel.get("deferred_to_nightly") or {}),
            "error": sel.get("error") or ""}


def build_verdict(report: dict | None, sel: dict | None, active: list[dict], expired: list[dict], *, branch: str, sha: str, base: str,
                  base_sha: str = "", waited_s: int = 0, nightly: dict | None = None, reason: str = "", engine_report: str = "",
                  started: str = "", problems: list[str] | None = None) -> dict:
    v = {"kind": "entry-check", "branch": branch, "sha": sha, "base": base, "base_sha": base_sha, "started": started,
         "finished": dt.datetime.now().astimezone().isoformat(timespec="seconds"), "waited_s": int(waited_s or 0),
         "engine_report": engine_report, "selection": _sel_summary(sel), "hard": [], "failures": [], "quarantined": [], "flaky": [],
         "quarantine": {"active": len(active), "expired": [f"{e.get('match')} (ticket {e.get('ticket')}, expired {e.get('expires')})" for e in expired],
                        "problems": list(problems or [])},
         "nightly": nightly or {}, "counts": {}, "wall_s": 0}
    if report is None:
        v.update(verdict="NOT_RUN", exit=1, reason=reason or "the engine wrote no report")
        return v
    c = g2v.classify(report, active)
    v["hard"] = [i["id"][:160] for i in c["hard"]]
    v["failures"] = [i["id"][:160] for i in c["real"]]
    v["quarantined"] = [f"{i['id'][:140]} (ticket {e['ticket']}, expires {e['expires']})" for i, e in c["quarantined"]]
    v["flaky"] = [i["id"][:160] for i in c["flaky"]]
    v["counts"] = {k: x for k, x in (report.get("counts") or {}).items() if isinstance(x, dict)}
    v["wall_s"] = int(report.get("wall_seconds") or 0)
    if report.get("verdict") == "pass" or (not c["hard"] and not c["real"] and c["quarantined"]):
        v.update(verdict="GREEN", exit=0, reason=reason or ("engine pass" if report.get("verdict") == "pass"
                                                            else f"red only through {len(c['quarantined'])} quarantined test(s)"))
    else:
        n = len(c["hard"]) + len(c["real"])
        v.update(verdict="RED", exit=1, reason=reason or (f"{n} failure(s) outside the quarantine" if n else "engine verdict fail with no failing item listed"))
    return v


def render_md(v: dict) -> str:
    s = v.get("selection") or {}
    lines = [f"# בדיקת כניסה / Entry check: {v['branch']} @ {v['sha']}", "",
             f"- תוצאה: **{HE[v['verdict']]}**",
             f"- Verdict: **{EN[v['verdict']]}** ({v.get('reason', '')})",
             f"- בסיס / base: {v['base']}" + (f" @ {v['base_sha']}" if v.get("base_sha") else "")
             + f"; המתנה בתור / queued {v['waited_s'] // 60} min; ריצה / run {v.get('wall_s', 0) // 60} min"]
    if s:
        lines.append(f"- בחירה לפי שינוי / selection: backend {s.get('backend')} files, frontend {s.get('frontend')} specs, "
                     f"deferred to the nightly {s.get('deferred_to_nightly', 0)}" + (" (FULL backend)" if s.get("full_backend") else "")
                     + (" (FULL frontend)" if s.get("full_frontend") else ""))
    q = v.get("quarantine") or {}
    lines.append(f"- הסגר / quarantine list: {q.get('active', 0)} active, {len(q.get('expired', []))} EXPIRED (count as failures), "
                 f"{len(q.get('problems', []))} invalid (max 7 days, ticket required)")
    n = v.get("nightly") or {}
    if n:
        lines.append(f"- הלילי (מידע בלבד, לא משפיע) / nightly (information only): {n.get('state', '?')} - {str(n.get('why', ''))[:140]}")
    def block(title, items, cap=8):
        if items:
            lines.extend(["", f"## {title} ({len(items)})"] + [f"- {x}" for x in items[:cap]] + ([f"- ... +{len(items) - cap}"] if len(items) > cap else []))
    block("כשלים קשים / hard failures", v.get("hard", []))
    block("כשלים / failures", v.get("failures", []))
    block("בהסגר (מוסבר) / quarantined (explained)", v.get("quarantined", []), 5)
    block("הסגר שפג תוקפו - נספר ככשל / expired quarantine - counts as failure", q.get("expired", []), 5)
    if v["verdict"] != "GREEN":
        lines += ["", "מה עכשיו / next: לתקן, לדחוף לאותו ענף ולהריץ שוב `branch_check.sh " + v["branch"] + "` / fix, push, run it again."]
    if v.get("engine_report"):
        lines.append(f"\nדוח מלא / full report: {v['engine_report']}")
    return "\n".join(lines) + "\n"


def write_verdict(v: dict, out_dir: Path) -> tuple[Path, Path]:
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    base = out_dir / f"entry_{tag_of(v['branch'])}_{v['sha']}"
    md, js = base.with_name(base.name + ".md"), base.with_name(base.name + ".json")
    md.write_text(render_md(v), encoding="utf-8")
    js.write_text(json.dumps(v, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    return md, js


def _read_json(p: Path | None) -> dict | None:
    if not p:
        return None
    try:
        d = json.loads(Path(p).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    return d if isinstance(d, dict) else None


def _nightly(results: str | None) -> dict:
    if not results:
        return {}
    try:
        import gate2_select as gs   # the same health check release_gate2.sh prints; information only for the entry check
        h = gs.nightly_health(Path(results))
        return {"state": h.get("state", "missing" if not h.get("ok") else "green"), "why": h.get("why", "")}
    except Exception as e:     # noqa: BLE001 - informational only
        return {"state": "unknown", "why": f"{type(e).__name__}: {e}"[:160]}


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("cmd", choices=["verdict"])
    ap.add_argument("--report")
    ap.add_argument("--selection")
    ap.add_argument("--branch", required=True)
    ap.add_argument("--sha", required=True)
    ap.add_argument("--base", default="origin/main")
    ap.add_argument("--base-sha", default="")
    ap.add_argument("--out-dir", required=True)
    ap.add_argument("--quarantine", default=str(HERE / "gate2_quarantine.json"))
    ap.add_argument("--waited-s", type=int, default=0)
    ap.add_argument("--started", default="")
    ap.add_argument("--nightly-results")
    ap.add_argument("--why", default="")
    ap.add_argument("--today", help="YYYY-MM-DD (tests)")
    ns = ap.parse_args(argv)
    today = dt.date.fromisoformat(ns.today) if ns.today else None
    rp = Path(ns.report) if ns.report else None
    report = _read_json(rp)
    if report is not None and not ("verdict" in report and "items" in report):
        report = None
    sp = Path(ns.selection) if ns.selection else (rp.with_name(rp.name[:-len(".json")] + ".selection.json") if rp and rp.name.endswith(".json") else None)
    q = g2v.load_quarantine_full(Path(ns.quarantine), today)
    v = build_verdict(report, _read_json(sp), q["active"], q["expired"], branch=ns.branch, sha=ns.sha, base=ns.base, base_sha=ns.base_sha,
                      waited_s=ns.waited_s, nightly=_nightly(ns.nightly_results), reason=ns.why if report is None else "",
                      engine_report=str(rp) if report is not None else "", started=ns.started, problems=q["problems"])
    md, js = write_verdict(v, Path(ns.out_dir))
    print(render_md(v))
    print(f"entry check verdict: {v['verdict']} -> {md} (+ {js.name})")
    return v["exit"]


if __name__ == "__main__":
    sys.exit(main())
