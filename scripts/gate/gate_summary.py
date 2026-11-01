#!/usr/bin/env python3
"""Hebrew end summary of a gate (GATE-FAST-2291, item 9): real defects versus run problems, with the cause, always marked "likely".
Pure functions over the gate report dict; the engine puts the text at the top of the report and in gate_status.json. Rules (plan item 9):
  * a test that failed in the pool and PASSED when run alone (FLAKY)           -> likely a run problem (timing)
  * a failure whose text says timeout / goto / navigation / net::ERR while the machine load was above 30 -> likely a run problem
  * "no time left", "did not run", "did not start", shard without a pytest summary, budget exhausted, engine-level failures -> run problem
  * failed again alone / failed twice (the same way twice) on a calm machine   -> likely a REAL defect
  * tsc, build, release_check, count-drop, lint                               -> real (deterministic)
  * anything else                                                              -> unclear, to be looked at
CLI: gate_summary.py <gate report .json>   prints the summary.
"""
from __future__ import annotations

import json
import re
import sys

HIGH_LOAD = 30.0
RUN_TEXT = re.compile(r"no time left|did not run|did not start|no pytest summary|budget exhausted|time limit|not completed|interrupted|crash|job crashed|load error|zero tests|terminated", re.I)
TIMEOUT_TEXT = re.compile(r"timeout|timed out|page\.goto|navigation|net::ERR|ECONN|Target closed|browser has been closed", re.I)
DETERMINISTIC = {"tsc", "build", "release_check", "baseline", "lint"}


def classify_item(it: dict, max_load1) -> tuple[str, str]:
    """(kind, cause): kind is real | run | unclear (Hebrew cause text, always 'likely')."""
    cat, st, reason = it.get("category", ""), it.get("status", ""), (it.get("reason") or "")
    heavy = max_load1 is not None and max_load1 > HIGH_LOAD
    if st == "FLAKY":
        return "run", "כנראה תקלת ריצה: נכשל ועבר בהרצה חוזרת לבד"
    if cat in DETERMINISTIC:
        return "real", f"כנראה כשל אמיתי: בדיקה דטרמיניסטית ({cat})"
    if cat == "gate" or RUN_TEXT.search(reason) or RUN_TEXT.search(it.get("id", "")):
        return "run", "כנראה תקלת ריצה: התשתית או התקציב (לא תוצאת בדיקה)"
    if TIMEOUT_TEXT.search(reason) and heavy:
        return "run", f"כנראה תקלת ריצה: פסק זמן טעינה בעומס {max_load1:.0f} (מעל {HIGH_LOAD:.0f})"
    if re.search(r"failed again alone|failed twice", reason):
        return "real", "כנראה כשל אמיתי: נכשל באותה צורה גם בהרצה חוזרת לבד" + (" (אבל העומס היה גבוה)" if heavy else "")
    return "unclear", "לא ברור: לבדוק ידנית"


def summarize(doc: dict) -> dict:
    load = (doc.get("resources") or {}).get("max_load1")
    fails = [i for i in doc.get("items", []) if i.get("status") == "FAIL"]
    flaky = [i for i in doc.get("items", []) if i.get("status") == "FLAKY"]
    rows = [(i, *classify_item(i, load)) for i in fails]
    real = [(i, c) for i, k, c in rows if k == "real"]
    run = [(i, c) for i, k, c in rows if k == "run"]
    unc = [(i, c) for i, k, c in rows if k == "unclear"]
    head = ("ירוק" if doc.get("verdict") == "pass" else "אדום")
    line = f"{head}: {len(real)} כשלים כנראה אמיתיים, {len(run)} תקלות ריצה כנראה, {len(unc)} לא ברורים, {len(flaky)} FLAKY (עברו בהרצה לבד)."
    if load is not None:
        line += f" עומס מרבי {load}."
    return {"line": line, "real": real, "run": run, "unclear": unc, "flaky": len(flaky)}


def to_markdown(s: dict, limit: int = 15) -> list[str]:
    md = ["## סיכום בעברית: אמיתי מול תקלת ריצה", "", f"**{s['line']}**", "(הסיווג הוא הערכה אוטומטית לפי כללים, תמיד \"כנראה\".)", ""]
    for title, key in (("כנראה כשלים אמיתיים", "real"), ("כנראה תקלות ריצה", "run"), ("לא ברור", "unclear")):
        if s[key]:
            md += [f"### {title}", ""] + [f"- [{i['category']}] {i['id'][:140]}: {c}" for i, c in s[key][:limit]]
            if len(s[key]) > limit:
                md.append(f"- ... ועוד {len(s[key]) - limit}")
            md.append("")
    return md


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(2)
    print("\n".join(to_markdown(summarize(json.loads(open(sys.argv[1], encoding="utf-8").read())))))
