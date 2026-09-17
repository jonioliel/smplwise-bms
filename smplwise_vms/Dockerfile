ARG BUILD_FROM=ghcr.io/home-assistant/amd64-base-python:3.12-alpine3.22
FROM ${BUILD_FROM}

# poppler-utils provides pdftoppm/pdfinfo: PDF pages are rasterized in a separate, time-bounded process.
RUN apk add --no-cache poppler-utils jpeg zlib libpng ffmpeg

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

LABEL io.hass.version="0.1.70" io.hass.type="addon" io.hass.arch="amd64|aarch64"

CMD [ "/run.sh" ]
