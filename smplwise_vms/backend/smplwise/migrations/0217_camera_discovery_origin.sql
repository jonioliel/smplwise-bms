-- ONVIF-CLIENT-2500 (camera discovery phase 1; design docs/design/onvif-discovery-2412 section 6 "02xx_camera_discovery_origin"):
-- where a camera's manual video source came from.
--   origin     'manual' (typed by hand) | 'onvif' (added from "find cameras on the network"); NULL = a row from before this
--              migration, read as 'manual' (services/camera_sources.origin_of).
--   onvif_json the camera's own description at the add step (manufacturer, model, firmware, media service version, how it
--              accepted the credentials, the profile tokens chosen, the device-service host and port, a keyed hash of its ONVIF
--              endpoint reference). Never a credential, a serial number, a MAC address or a stream address.
-- Number 0217: the next free number on main and on every open branch (0216_review_indexes.sql); renumber at the train if another
-- branch took it. Additive only; older code never reads the columns. Rollback: run the previous version (the columns are ignored).

ALTER TABLE camera_stream_sources ADD COLUMN origin TEXT CHECK (origin IS NULL OR origin IN ('manual', 'onvif'));
ALTER TABLE camera_stream_sources ADD COLUMN onvif_json TEXT;
