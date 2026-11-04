"""scripts/progress.py counts a card as evidenced only through EXACT markers (REGISTRY-AUDIT-20261103 follow-up).

The old matcher used `marker in line`, so "SELFTEST PASSED", "the lab server" inside a NOT_RUN line and "no merge commit named
after it" counted a card, and so did work that exists only on an unmerged branch. These tests pin the false positives the audit
found (WXD7 / WXD7R, T06 / T061 style neighbours included) and the shapes that must keep counting. Pure functions, no registry file.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "scripts"))
import progress  # noqa: E402

marker = progress.evidence_line_marker


def card(status="BACKLOG", *evidence, phase="V1", **extra):
    return {"id": extra.pop("id", "X1"), "phase": phase, "status": status, "evidence": list(evidence), **extra}


# --- shapes that must keep counting ----------------------------------------------------------------------------------------

@pytest.mark.parametrize(
    "line, expected",
    [
        ("pre-evidence (2026-09-16, 0.1.17): services/backup.py - zip format 1", "pre-evidence"),
        ("pre-evidence: implemented ahead of dependency closure", "pre-evidence"),
        ("partial (2026-09-16, 0.1.9): a local, deterministic normalizer", "partial"),
        ("2026-10-05 (TASKS-SYNC, housekeeping): partial - CR-024 multi-NVR is in the repository and shipped", "partial"),
        ("fix (2026-09-15): every network-bound phase now runs in an unlocked window", "fix ("),
        ("lab (2026-09-15): sync connected in ~10 s with 318 entities", "lab"),
        ("lab measurement (real Chrome, headless): sub profile plays over WebRTC", "lab"),
        ("design SW A (2026-09-16, 0.1.9): the owner's 50-screen handoff", "design SW A"),
        ("frontend/tests/screens.spec.ts (93 checks): all states at 1440/1024/390 - 129 PASS 2026-09-14", "PASS"),
        ("tests/test_plans.py PASS", "PASS"),
        ("commit 22a833ce3 (release 0.1.2, on origin/main) - 2026-11-04 (REGISTRY-AUDIT-20261103): implemented.", "commit"),
        ("commit 079cd363a (release 2.4.9, on origin/main); also 22cc4b257 (release 2.4.9, on origin/main) - shipped", "commit"),
        ("2026-09-27 (0.1.102, on commit 1ade8c7): owner request - embed the integration", "commit"),
        ("2026-10-31 (TASKS-SYNC-3110): merged into main and shipped in v2.7.2 (commit 4768e4a1c); status was stale", "commit"),
        ("2026-09-26 (0.1.96, on commits 3bf094f, 139c355, d3a3d7c): owner request - multi-select", "commit"),
        # an all-digit abbreviated id is a real commit id too
        ("commit 837481230 (release 2.33.2, on origin/main) - shipped", "commit"),
    ],
)
def test_real_evidence_shapes_count(line, expected):
    assert marker(line) == expected


# --- substring false positives ---------------------------------------------------------------------------------------------

@pytest.mark.parametrize(
    "line",
    [
        "selftest_gate.py SELFTEST PASSED (41 OK)",  # PASS inside PASSED
        "the BYPASS list and PASSWORD rotation were reviewed",  # PASS inside longer words
        "not PASS yet: the live run was skipped",  # negated
        "no PASS recorded for this card",
        "never PASS on a real phone",
        "a supervised run on a real phone (saved sign-in on the lab server)",  # lab mid-sentence
        "No backend, device, HA or lab contact; nothing else run.",
        "main-stream encoding check + lab check; D10 native push later",
        "The branch was merged through release/2341-train (no merge commit named after it).",  # commit + prose
        "every commit named in this card is contained in v2.7.2",
        "commit message pending",  # 'message' is not an id
        "commit WXD7R is not implemented",  # a card id is not a commit id
        "commit 20261103 audit round",  # a YYYYMMDD date is not a commit id
        "the partials of the wall layout",  # 'partial' inside another word
        "partially shipped",
        "prefix (2026-09-15) of the lab run",  # 'fix (' inside 'prefix ('
        "collab (2026-09-15): notes",  # 'lab' inside another word
        "Wiskey pre-evidence-free review",  # not at line start
        "WXD7R partial-credit idea, not started",  # 'partial-' is not the 'partial -' idiom
    ],
)
def test_substring_false_positives_do_not_count(line):
    assert marker(line) is None


def test_lines_that_state_what_is_missing_never_count():
    for line in (
        "NOT_RUN: a supervised run on a real phone; PASS expected after commit 22a833ce3",
        "Not done: the relay Worker was not run against APNs; lab run pending (commit 22a833ce3)",
        "Not proven by the repository: any real write; lab session needed",
        "Open: first install on the lab HA; partial - the Supervisor build is untried",
    ):
        assert marker(line) is None, line


def test_non_string_evidence_is_ignored():
    assert marker(None) is None
    assert marker({"pass": True}) is None


# --- work in flight (not on origin/main) -----------------------------------------------------------------------------------

def test_in_flight_commit_alone_is_not_evidence():
    line = "commit 6142b9a64 (branch only, not on origin/main, not released) - 2026-11-04 (REGISTRY-AUDIT-20261103): in flight."
    assert marker(line) is None
    assert not progress.has_evidence(card("BACKLOG", line))


def test_in_flight_id_repeated_in_the_prose_stays_in_flight():
    line = (
        "commit 6142b9a64 (branch only, not on origin/main, not released) - in flight. built on pilot/BOARD-MGMT-2381 @ 6142b9a64 "
        "and merged into release/2382-train (merge 30b92b6a2), not released."
    )
    assert marker(line) is None


def test_second_id_on_main_makes_the_line_evidence():
    line = (
        "commit 267d19e70 (branch only, not on origin/main, not released); also f18932f04 (release 2.4.9, on origin/main) - shipped"
    )
    assert marker(line) == "commit"


def test_in_progress_status_alone_does_not_count_the_card():
    line = "commit 604fe0c73 (pilot/WISKEY-TALK-DIAL-2382, not on origin/main, not released) - in flight."
    t = card("IN_PROGRESS", line)
    assert progress.evidence_basis(t) is None
    assert not progress.has_evidence(t)
    # ... but shipped evidence on the same card still does
    shipped = card("IN_PROGRESS", "commit 604fe0c73 (release 2.4.9, on origin/main) - shipped")
    assert progress.evidence_basis(shipped) == "marker:commit"


def test_done_status_counts_the_card():
    assert progress.evidence_basis(card("DONE")) == "status:DONE"


# --- neighbouring card ids -------------------------------------------------------------------------------------------------

def test_neighbouring_ids_do_not_share_evidence():
    """WXD7 shipped, WXD7R (its follow-up row) was never run; T061 has evidence, T06 does not. Each card is judged on its own
    lines only, and a line that merely names the neighbour ('WXD7', 'T061') carries no marker."""
    wxd7 = card("BACKLOG", "commit 079cd363a (release 2.4.9, on origin/main) - shipped. read-only door-path inventory", id="WXD7")
    wxd7r = card(
        "BACKLOG",
        "2026-11-04 (REGISTRY-AUDIT-20261103): not implemented. the inventory read named in WXD7 never ran; no commit names this card.",
        id="WXD7R",
    )
    t061 = card("BACKLOG", "partial (2026-09-16, 0.1.9): source vs stylized side by side", id="T061")
    t06 = card("BACKLOG", "depends on T061 (partial coverage), see T0610 notes; commit message not yet written", id="T06")
    assert progress.has_evidence(wxd7)
    assert not progress.has_evidence(wxd7r)
    assert progress.has_evidence(t061)
    assert not progress.has_evidence(t06)


def test_basis_names_the_first_qualifying_line():
    t = card("REVIEW", "NOT_RUN: nothing", "2026-09-16: notes only", "lab (2026-09-15): measured", "tests PASS")
    assert progress.evidence_basis(t) == "marker:lab"
    assert progress.evidence_basis(card("DONE")) == "status:DONE"
    assert progress.evidence_basis(card("REVIEW", "no evidence here")) is None
    assert progress.evidence_basis({"id": "Y", "status": "REVIEW"}) is None


def test_excluded_cards_are_still_left_out_of_the_denominator():
    t = card("BACKLOG", "EXCLUDED - owner decision 2026-09-22", blocker="Excluded by the owner")
    assert progress.is_excluded(t)
