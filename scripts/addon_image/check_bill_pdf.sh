#!/usr/bin/env bash
# EL8: the electricity bill PDF inside the real add-on image (Alpine/musl), without Docker.
#
# Rebuilds the add-on image from smplwise_vms/Dockerfile with scripts/addon_image/addon_rootfs.py (the registry's base image,
# the Dockerfile's RUN steps replayed in a chroot), plus a baseline image without the bill PDF additions, and then, INSIDE the
# image: loads WeasyPrint, runs the engine self-check, renders the evidence samples (docs/evidence/electricity-pdf/generate.py),
# runs the PDF test files with SW_REQUIRE_BILL_PDF=1 (a missing library is a failure, not a skip), starts the add-on's own
# entry point (`python3 -m smplwise`) and reads the start-up engine line and the billing settings over HTTP, and checks that
# every Python package has a musllinux wheel for aarch64 too.
#
# Usage (Linux, x86_64 or aarch64, sudo -n, network to ghcr.io / Alpine / PyPI):
#   scripts/addon_image/check_bill_pdf.sh [work dir, default ~/el8-image]
# Output: <work>/out (report.txt, measurements, PDFs, PNGs, pytest log). Everything runs at nice 10; the only processes it
# stops are the ones it started (the add-on server, by PID). The trees under <work> are root-owned: remove with sudo rm -rf.
set -uo pipefail
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
WORK="${1:-$HOME/el8-image}"
OUT="$WORK/out"
TOOL="$REPO/scripts/addon_image/addon_rootfs.py"
FULL="$WORK/full"
T="sudo -n nice -n 10 unshare --mount --fork python3 $TOOL"
REPORT="$OUT/report.txt"
cd "$REPO" || exit 2
sudo -n rm -rf "$WORK"; mkdir -p "$OUT"
log() { echo "$*" | tee -a "$REPORT"; }
inimg() { $T run --repo "$REPO" --out "$OUT" "$FULL" -- "$@"; }
FAIL=0
step() { local name="$1"; shift; log "== $name"; if "$@" >> "$OUT/$name.log" 2>&1; then log "   PASS"; else log "   FAIL (see $name.log)"; FAIL=1; fi; tail -n 25 "$OUT/$name.log" | sed 's/^/   | /' >> "$REPORT"; }

log "EL8 add-on image check - repo $(git rev-parse --short HEAD) - $(date -u +%Y-%m-%dT%H:%M:%SZ) - host $(uname -m)"

# --- 1. images: base, baseline (no bill PDF additions), full
step pull $T pull --context smplwise_vms "$WORK/base"
sudo -n cp -a "$WORK/base" "$WORK/nopdf"; sudo -n cp -a "$WORK/base" "$FULL"
CTX="$WORK/ctx-nopdf"; mkdir -p "$CTX/backend"
sed -E 's/ pango$//' smplwise_vms/Dockerfile > "$CTX/Dockerfile"
grep -vE '^(weasyprint|fpdf2|uharfbuzz)' smplwise_vms/backend/requirements.txt > "$CTX/backend/requirements.txt"
ln -s "$REPO/smplwise_vms/backend/smplwise" "$CTX/backend/smplwise"
for d in www integration run.sh; do ln -s "$REPO/smplwise_vms/$d" "$CTX/$d"; done
step build_baseline $T build --context "$CTX" "$WORK/nopdf"
step build_full $T build --context smplwise_vms "$FULL"
if grep -qiE 'Building wheel|Running setup.py' "$OUT/build_full.log"; then log "   NOTE: pip built a package from source"; FAIL=1; fi
B=$(sudo -n python3 "$TOOL" size "$WORK/base"); N=$(sudo -n python3 "$TOOL" size "$WORK/nopdf"); F=$(sudo -n python3 "$TOOL" size "$FULL")
python3 - "$B" "$N" "$F" > "$OUT/image_size.json" <<'P'
import json, sys
b, n, f = (int(x) for x in sys.argv[1:])
print(json.dumps({"base_bytes": b, "baseline_without_bill_pdf_bytes": n, "full_bytes": f,
                  "bill_pdf_growth_mb": round((f - n) / 1e6, 1), "gate_mb": 60, "within_gate": (f - n) / 1e6 <= 60,
                  "method": "apparent size of the unpacked tree (hard links once), as docker image inspect reports uncompressed layers"}, indent=1))
P
log "   image size: $(tr -d '\n ' < "$OUT/image_size.json")"
sudo -n rm -rf "$WORK/nopdf"

# --- 2. inside the image (sizes are taken; test tooling may now be added to the tree)
step weasyprint_loads inimg python3 -c "import weasyprint, sys; from weasyprint import HTML; print('weasyprint', weasyprint.__version__, 'pages', len(HTML(string='<p>x</p>').render().pages), sys.version.split()[0])"
step native_libraries inimg sh -c "cat /etc/alpine-release; apk info -v 2>/dev/null | grep -E '^(pango|harfbuzz|fribidi|cairo|fontconfig|freetype|poppler-utils|glib)-[0-9]'; ls /usr/share/fonts 2>&1 | head -3"
step engine_self_check inimg sh -c "cd /app && python3 -c \"from smplwise.services import bill_pdf; s = bill_pdf.self_check(timeout_s=90); print(s); raise SystemExit(0 if s['active'] == 'weasyprint' else 1)\""
sudo -n cp -r "$REPO/smplwise_vms/backend/tests" "$FULL/app/tests"
sudo -n cp "$REPO/smplwise_vms/backend/pyproject.toml" "$FULL/app/pyproject.toml"
step generate_evidence inimg sh -c "cd /app && python3 /w/docs/evidence/electricity-pdf/generate.py /out/samples"
step rasterize inimg sh -c "mkdir -p /out/png && for f in /out/samples/*.pdf; do pdftoppm -r 110 -png \"\$f\" /out/png/\$(basename \"\$f\" .pdf); done; pdffonts /out/samples/bill-issued.pdf; pdfinfo /out/samples/bill-issued.pdf | grep -E 'Pages|Page size|Producer'"
step pytest_install inimg pip install --no-cache-dir --root-user-action=ignore -q pytest
step pytest_bill_pdf inimg sh -c "cd /app && SW_REQUIRE_BILL_PDF=1 SW_BILL_PDF_EVIDENCE_DIR=/out/pipeline python3 -m pytest -q -rs -o addopts= -p no:cacheprovider --basetemp=/tmp/pt tests/test_bill_pdf.py tests/test_energy_bill_pdf_pipeline.py tests/test_energy_integration.py tests/test_energy_billing_api.py tests/test_energy_billing_engine.py"
if grep -qE 'SKIPPED.*(WeasyPrint|poppler)' "$OUT/pytest_bill_pdf.log"; then log "   NOTE: a render test was skipped for a missing library"; FAIL=1; fi
step rasterize_pipeline inimg sh -c "for f in /out/pipeline/*.pdf; do pdftoppm -r 110 -png \"\$f\" /out/png/\$(basename \"\$f\" .pdf); pdftotext -layout \"\$f\" /out/pipeline/\$(basename \"\$f\" .pdf).txt; done; pdffonts /out/pipeline/pipeline-issued.pdf"

# --- 3. the add-on's own entry point: start-up engine line and the billing settings over HTTP (dev user, loopback only)
PORT=$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1]); s.close()')
sudo -n mkdir -p "$FULL/tmp/arx-data"
$T run --out "$OUT" -e SW_HOST=127.0.0.1 -e SW_PORT="$PORT" -e SW_DATA_DIR=/tmp/arx-data -e SW_OPTIONS_FILE=/nonexistent \
   -e SW_DEV_USER=el8 -e SW_BOOTSTRAP_ADMIN=el8 -e SW_ENERGY_SAMPLER=0 -e SW_RECORDER_HEALTH=0 \
   "$FULL" -- sh -c "cd /app && exec python3 -m smplwise" > "$OUT/addon_server.log" 2>&1 &
SPID=$!
ok=0
for _ in $(seq 1 60); do
  if grep -q "bill pdf engine" "$OUT/addon_server.log" 2>/dev/null && curl -fs -m 5 "http://127.0.0.1:$PORT/api/v1/energy/billing-settings" -o "$OUT/billing_settings.json"; then ok=1; break; fi
  sleep 1
done
# stop only what this script started: the descendants of $SPID (deepest first: the server, the tool, unshare), then $SPID
desc() { local p; for p in $(pgrep -P "$1" 2>/dev/null); do desc "$p"; echo "$p"; done; }
for p in $(desc "$SPID"); do sudo -n kill -TERM "$p" 2>/dev/null; done
sleep 3; for p in $(desc "$SPID"); do sudo -n kill -KILL "$p" 2>/dev/null; done
wait "$SPID" 2>/dev/null
log "== addon_server (python3 -m smplwise inside the image)"
grep -E "bill pdf engine" "$OUT/addon_server.log" | sed 's/^/   | /' | tee -a "$REPORT"
if [ "$ok" = 1 ] && grep -q '"active": *"weasyprint"' "$OUT/billing_settings.json"; then
  log "   PASS: $(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["pdf_engine"])' "$OUT/billing_settings.json")"
else log "   FAIL (see addon_server.log)"; FAIL=1; fi

# --- 4. aarch64: every package must exist as a binary wheel for musllinux aarch64 (no emulation here, no compiler in the image)
step aarch64_wheels inimg sh -c "pip download --no-cache-dir -q --only-binary=:all: --platform musllinux_1_2_aarch64 --platform musllinux_1_1_aarch64 --platform any --python-version 3.12 --implementation cp -r /app/requirements.txt -d /tmp/wheels-aarch64 && ls /tmp/wheels-aarch64 | grep -E '^(weasyprint|fpdf2|uharfbuzz|cffi|fonttools|brotli|zopfli|pillow)' "

log "== result: $([ "$FAIL" = 0 ] && echo ALL PASS || echo FAILURES)"
sudo -n chown -R "$(id -u):$(id -g)" "$OUT"
exit "$FAIL"
