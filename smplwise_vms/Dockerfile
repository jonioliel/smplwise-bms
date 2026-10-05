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
COPY run.sh /run.sh
RUN chmod a+x /run.sh

ENV SW_WWW_DIR=/app/www \
    SW_DATA_DIR=/data \
    SW_HOST=0.0.0.0 \
    SW_PORT=8099 \
    PYTHONUNBUFFERED=1

LABEL io.hass.version="2.0.1" io.hass.type="addon" io.hass.arch="amd64|aarch64"

CMD [ "/run.sh" ]
