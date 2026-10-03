#!/usr/bin/env bash
# CR-023 P0 PDF spike, run on the Ubuntu test runner (amd64, glibc) in its own folder. Light: one venv, a few renders.
# Usage: bash spike.sh <folder holding render.py, fpdf_fallback.py, alpine_size.py> <repo checkout with frontend/public/fonts>
set -uo pipefail
D="${1:?folder}"; REPO="${2:?repo}"; cd "$D"
echo "== host: $(uname -m) $(. /etc/os-release; echo "$PRETTY_NAME"); load: $(cut -d' ' -f1-3 /proc/loadavg)"
python3 -m venv venv && . venv/bin/activate
pip install -q --upgrade pip
T=$(date +%s); pip install -q weasyprint==70.0 fonttools brotli fpdf2==2.8.9 uharfbuzz; echo "pip install: $(( $(date +%s) - T )) s"
pip show weasyprint pydyf tinycss2 cssselect2 tinyhtml5 cffi fpdf2 uharfbuzz 2>/dev/null | grep -E '^(Name|Version)'
echo "== venv site-packages size of the WeasyPrint stack"
du -sh venv/lib/python3*/site-packages/{weasyprint,pydyf,tinycss2,cssselect2,tinyhtml5,pyphen,fontTools,brotli*,zopfli*,cffi*,_cffi*} 2>/dev/null

echo "== fonts: Heebo variable woff2 subsets from the product -> static TTF instances (400, 700)"
mkdir -p fonts
python - "$REPO" <<'PY'
import sys
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
repo = sys.argv[1]
for sub, tag in (("hebrew", "he"), ("latin", "la")):
    for w in (400, 700):
        f = TTFont(f"{repo}/frontend/public/fonts/heebo-{sub}-{w}.woff2")
        f.flavor = None
        if "fvar" in f:
            f = instancer.instantiateVariableFont(f, {"wght": w})
        f.save(f"fonts/Heebo-{tag}-{w}.ttf")
print("fonts ok")
PY
ls -la fonts

echo "== WeasyPrint render (5 runs each, same process; the first run is cold)"
/usr/bin/time -v python render.py 2> time.txt | tee render.json
grep -E 'Maximum resident|Elapsed' time.txt
echo "== cold single render in a fresh process (import + 1-page bill)"
/usr/bin/time -f "%e s wall, %M KB max RSS" python -c "import render; render.render('cold.pdf', 0, runs=1)"
echo "== text extraction (logical order check) and embedded fonts"
pdftotext -f 1 -l 1 sample-1p.pdf - | head -40
pdffonts sample-1p.pdf
pdfinfo sample-3p.pdf | grep -E 'Pages|File size'
pdftoppm -f 1 -l 1 -r 70 -png sample-1p.pdf page1
pdftoppm -f 3 -l 3 -r 50 -png sample-3p.pdf page3

echo "== fpdf2 fallback"
python fpdf_fallback.py && pdftotext fpdf-1p.pdf - | head -8 && pdftoppm -r 60 -png fpdf-1p.pdf fpdf

echo "== wheel availability for the add-on's base (Alpine = musllinux, Python 3.12), both architectures"
for plat in musllinux_1_2_x86_64 musllinux_1_2_aarch64; do
  rm -rf "wh_$plat"
  if pip download -q --only-binary=:all: --platform "$plat" --python-version 3.12 --implementation cp --abi cp312 \
       -d "wh_$plat" weasyprint==70.0 "pillow==12.3.0" fpdf2==2.8.9 uharfbuzz > "wh_$plat.log" 2>&1; then
    echo "$plat: OK, $(ls "wh_$plat" | wc -l) wheels, $(du -sh "wh_$plat" | cut -f1)"; ls "wh_$plat"
  else echo "$plat: FAILED"; tail -5 "wh_$plat.log"; fi
done

echo "== Alpine 3.22 package indexes: what apk add pango adds"
mkdir -p apk
for arch in x86_64 aarch64; do for repo in main community; do
  curl -fsS "https://dl-cdn.alpinelinux.org/alpine/v3.22/$repo/$arch/APKINDEX.tar.gz" | tar -xzO APKINDEX > "apk/$repo-$arch"
done; done
python alpine_size.py apk
echo "== done; load: $(cut -d' ' -f1-3 /proc/loadavg)"
