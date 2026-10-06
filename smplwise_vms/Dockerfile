ARG BUILD_FROM=ghcr.io/home-assistant/amd64-base-python:3.12-alpine3.22
FROM ${BUILD_FROM}

# poppler-utils provides pdftoppm/pdfinfo: PDF pages are rasterized in a separate, time-bounded process.
# pango: text shaping (HarfBuzz) and bidi (FriBidi) for the electricity bill PDF (WeasyPrint); with poppler-utils already
# present it adds only pango + libxft (~1 MB). Fonts are bundled in the package (assets/bill/fonts), none are installed.
# Verified on this image for amd64 (EL8: scripts/addon_image/check_bill_pdf.sh, docs/architecture/ELECTRICITY_BILL_PDF.md
# section 8.0); aarch64 checked for wheels only. The add-on logs the active PDF engine at start-up ("bill pdf engine: ...") and
# shows it in the billing settings. The image has no system fonts on purpose: every bill font is bundled.
RUN apk add --no-cache poppler-utils jpeg zlib libpng ffmpeg pango

WORKDIR /app
COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY backend/smplwise /app/smplwise
COPY www /app/www
# The bridge integration ships in the image and is copied into Home Assistant's custom_components at start-up.
COPY integration /app/integration
# The signed release APK (owner decision 2026-10-06) ships inside the image: scripts/stage_apk.py places SmplWiseArx.apk and
# SmplWiseArx.apk.json in downloads/ of the build context before a release. downloads/ always exists (a tracked README), so
# this COPY works with or without an APK - when none was staged the add-on offers nothing at the login screen.
COPY downloads/ /app/downloads/
RUN chmod -R a-w /app/downloads
COPY run.sh /run.sh
RUN chmod a+x /run.sh

ENV SW_WWW_DIR=/app/www \
    SW_DOWNLOADS_DIR=/app/downloads \
    SW_DATA_DIR=/data \
    SW_HOST=0.0.0.0 \
    SW_PORT=8099 \
    PYTHONUNBUFFERED=1

LABEL io.hass.version="2.3.0" io.hass.type="addon" io.hass.arch="amd64|aarch64"

CMD [ "/run.sh" ]
