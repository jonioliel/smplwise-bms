-- CR-038 TKMAP1 (owner 16.10): a map element attached to a service request - a camera / device anchor (`map_anchors`) or a Plan Studio
-- object (an `objects[]` entry of the floor's published structure document) - from the live map, a camera page or a request's picker.
-- Final number 0090 (integ/263, release 2.6.3). No table rebuild; nothing here is read while `tickets.enabled` is off.
--
-- One element per request (the primary key). The row is a REFERENCE plus a SNAPSHOT: the plan, level and element ids and the element's
-- position in plan pixels at attach time, and the element / floor / room names as they were then. When the element later leaves the
-- map the request keeps the snapshot (the vendor page shows the stored text only and no new image is drawn - services/tickets/map_element.py).
-- The ids are never sent to the public page; the vendor gets a server-rendered picture and the snapshot text only.

CREATE TABLE ticket_map_elements (
  ticket_id       TEXT PRIMARY KEY REFERENCES tickets(id) ON DELETE CASCADE,
  element_kind    TEXT NOT NULL CHECK (element_kind IN ('anchor', 'object')),
  element_type    TEXT NOT NULL CHECK (element_type IN ('camera', 'ha_entity', 'object')),
  element_id      TEXT NOT NULL,
  resource_id     TEXT,
  floor_id        TEXT NOT NULL,
  plan_version_id TEXT,
  level_id        TEXT,
  x_px            REAL NOT NULL,
  y_px            REAL NOT NULL,
  name_snapshot   TEXT NOT NULL DEFAULT '',
  floor_snapshot  TEXT NOT NULL DEFAULT '',
  room_snapshot   TEXT,
  attached_by     TEXT,
  attached_at     TEXT NOT NULL,
  revision        INTEGER NOT NULL DEFAULT 1
);
