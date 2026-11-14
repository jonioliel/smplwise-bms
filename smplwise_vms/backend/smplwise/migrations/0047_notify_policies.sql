-- CR-018: per-source notification policy, installation-wide (administrator, notify.manage). The rows are seeded from the source
-- catalogue in services/notify_policy.py (the one place that lists the sources and their defaults) the first time they are
-- read, so a later release that adds a source adds its row without a migration; an administrator's edit is never overwritten.
CREATE TABLE notify_policies (
  source          TEXT PRIMARY KEY,
  enabled         INTEGER NOT NULL DEFAULT 1,
  severity        TEXT NOT NULL CHECK (severity IN ('info', 'alert', 'critical')),
  category        TEXT NOT NULL,
  after_s         INTEGER NOT NULL DEFAULT 0,
  dedupe_window_s INTEGER NOT NULL DEFAULT 0,
  resolve_notice  INTEGER NOT NULL DEFAULT 0,
  recipients_json TEXT NOT NULL,
  channels_json   TEXT NOT NULL,
  revision        INTEGER NOT NULL DEFAULT 1,
  updated_by      TEXT,
  updated_at      TEXT
);

-- room for CR-012's `fcm | unifiedpush` next to the browser's Web Push
ALTER TABLE push_subscriptions ADD COLUMN kind TEXT NOT NULL DEFAULT 'webpush';
