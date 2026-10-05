"""Evidence generator for the electricity bill PDF (CR-023 P3). Fake data only (tests/bill_pdf_samples.py).

Run on the Linux test runner from smplwise_vms/backend with the venv that has weasyprint, fpdf2, pillow and poppler on
PATH:   python ../../docs/evidence/electricity-pdf/generate.py <out dir>
Writes sample PDFs, page PNGs, extracted text and measurements.json (render times of the real child-process path, peak
memory of the child, PDF sizes). The numbers describe THIS machine only; they are not the target-hardware gate.
"""
from __future__ import annotations

import base64
import json
import os
import platform
import resource
import statistics
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
BACKEND = Path.cwd()
sys.path.insert(0, str(BACKEND))
sys.path.insert(0, str(BACKEND / "tests"))

import bill_pdf_samples as S  # noqa: E402
from smplwise.services.bill_pdf import render_bill_pdf  # noqa: E402

out = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE
out.mkdir(parents=True, exist_ok=True)


def sh(*cmd: str, **kw) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, **kw)


def pages(pdf: Path) -> int:
    info = sh("pdfinfo", str(pdf)).stdout.decode()
    return int([line for line in info.splitlines() if line.startswith("Pages")][0].split(":")[1])


def _foreign_name(snap: dict) -> dict:
    snap["customer"]["name"] = "Иван Петров / مرحبا / € — ½"
    return snap


# name -> (snapshot, kwargs)
samples = {
    "bill-issued": (S.base(), {"logo": S.logo_png()}),
    "bill-draft": (S.draft(), {"logo": S.logo_png()}),
    "bill-void": (S.base(), {"logo": S.logo_png(), "watermark": "void"}),
    "bill-revision": (S.revision(), {"logo": S.logo_png()}),
    "bill-missing-meter-note": (S.missing_report(), {"logo": S.logo_png()}),
    "bill-no-chart": (S.no_history(), {}),
    "bill-chart-partial-data": (S.with_history(
        S.previous([("2026-04-01", "2026-04-30", "610.75"), ("2026-07-01", "2026-07-31", "812.40")]) +
        S.previous([("2026-08-01", "2026-08-31", "500.00")], status="partial") +
        [{"from": "2026-05-01", "to": "2026-05-31", "kwh": None, "status": "missing", "source": None}],
        {"from": "2025-09-01", "to": "2025-09-30", "kwh": "702.10", "status": "partial", "source": "readings"}), {}),
    "bill-3-pages": (S.big(120), {"logo": S.logo_png()}),
    "bill-fallback-engine": (S.missing_report(), {"engine": "fpdf2"}),
    # EL8: a customer name outside the bundled Heebo subsets (Hebrew + Latin). On a machine with system fonts these
    # characters come from them; in the add-on image (no system font) they show as missing-glyph boxes: decision open.
    "bill-name-outside-heebo": (_foreign_name(S.base()), {}),
}
for name, (snap, kw) in samples.items():
    t0 = time.perf_counter()
    pdf = render_bill_pdf(snap, **kw)
    elapsed = time.perf_counter() - t0
    f = out / f"{name}.pdf"
    f.write_bytes(pdf)
    n = pages(f)
    sh("pdftoppm", "-r", "70", "-png", str(f), str(out / name))
    (out / f"{name}.txt").write_text(sh("pdftotext", "-layout", str(f), "-").stdout.decode(), encoding="utf-8")
    print(f"{name}: {n} page(s), {len(pdf)} bytes, {elapsed:.2f} s", flush=True)

# --- measurements of the real child process: cold start, repeat, memory
def job(snap, engine="auto", logo=None):
    return json.dumps({"snapshot": snap, "logo": base64.b64encode(logo).decode() if logo else None, "watermark": None,
                       "max_pages": 40, "engine": engine}).encode()


def cold(snap, engine="auto"):
    """One fresh interpreter, the way render_bill_pdf runs it. Returns (seconds, peak RSS MB, bytes)."""
    env = {"PATH": os.environ["PATH"], "PYTHONPATH": str(BACKEND), "HOME": "/tmp", "LANG": "C.UTF-8"}
    t0 = time.perf_counter()
    p = subprocess.run([sys.executable, "-s", "-m", "smplwise.services.bill_pdf_engine"], input=job(snap, engine),
                       capture_output=True, env=env, cwd=str(BACKEND))
    dt = time.perf_counter() - t0
    assert p.returncode == 0 and p.stdout.startswith(b"%PDF"), p.stderr[-300:]
    rss = resource.getrusage(resource.RUSAGE_CHILDREN).ru_maxrss / 1024  # peak of the largest child so far
    return dt, rss, len(p.stdout)


m: dict = {"host": f"{platform.machine()} {platform.system()} python {platform.python_version()}",
           "load_avg_at_start": os.getloadavg()[0], "note": "this machine only; not the target-hardware gate"}
for label, snap in (("1_page", S.base()), ("3_pages", S.big(120))):
    runs = [cold(snap) for _ in range(5)]
    m[f"weasyprint_cold_child_{label}"] = {
        "seconds": [round(r[0], 2) for r in runs], "median_s": round(statistics.median(r[0] for r in runs), 2),
        "bytes": runs[0][2]}
    fp = [cold(snap, "fpdf2") for _ in range(5)]
    m[f"fpdf2_cold_child_{label}"] = {"seconds": [round(r[0], 2) for r in fp], "median_s": round(statistics.median(r[0] for r in fp), 2),
                                      "bytes": fp[0][2]}
m["peak_rss_mb_largest_child"] = round(resource.getrusage(resource.RUSAGE_CHILDREN).ru_maxrss / 1024, 1)
m["pages_of_3_page_sample"] = pages(out / "bill-3-pages.pdf")
m["load_avg_at_end"] = os.getloadavg()[0]
(out / "measurements.json").write_text(json.dumps(m, indent=1, ensure_ascii=False), encoding="utf-8")
print(json.dumps(m, indent=1, ensure_ascii=False))
