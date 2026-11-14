-- CR-013 (the app shell, owner request 2026-09-29): a user's own interface preferences, stored on the server so they
-- follow the user to every device and channel (Ingress, SmplWise Arx, the Android app). One row per user and key; the
-- keys are a closed list validated by routers/me.py (today only `nav.order`, the order of the navigation tabs), never
-- arbitrary client storage. No row = the default. Only the user themselves reads or writes their rows.
CREATE TABLE user_prefs (
  user_id     TEXT NOT NULL,
  key         TEXT NOT NULL,
  value_json  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  PRIMARY KEY (user_id, key)
);
