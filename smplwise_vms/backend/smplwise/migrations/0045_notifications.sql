-- CR-018 (notifications): one store for every notification source. A row is one OPEN CONDITION: a new signal with the same
-- dedupe key folds into it (count, last_at) and a resolve signal closes it. Rows never hold a person's name or an image;
-- the title / body are built from server templates with place parameters only. `notifications` is not part of a project
-- backup (like `events`). Everything here is added; push_prefs and rule_alerts keep working exactly as before.
CREATE TABLE notifications (
  id               TEXT PRIMARY KEY,
  source           TEXT NOT NULL,
  category         TEXT NOT NULL,
  severity         TEXT NOT NULL CHECK (severity IN ('info', 'alert', 'critical')),
  subject_kind     TEXT NOT NULL,
  subject_id       TEXT,
  area_id          TEXT,
  title            TEXT NOT NULL,
  body             TEXT NOT NULL DEFAULT '',
  place            TEXT,
  link             TEXT NOT NULL DEFAULT '',
  params_json      TEXT NOT NULL DEFAULT '{}',
  dedupe_key       TEXT NOT NULL,
  count            INTEGER NOT NULL DEFAULT 1,
  first_at         TEXT NOT NULL,
  last_at          TEXT NOT NULL,
  state            TEXT NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'acknowledged', 'resolved')),
  acked_at         TEXT,
  acked_by         TEXT,
  resolved_at      TEXT,
  resolution       TEXT,
  origin_json      TEXT NOT NULL DEFAULT '{}',
  initiator_user_id TEXT,
  escalation_step  INTEGER NOT NULL DEFAULT 0,
  escalate_at      TEXT,
  created_at       TEXT NOT NULL
);
-- one open (or acknowledged) row per condition; a resolved row frees the key
CREATE UNIQUE INDEX idx_notifications_open_key ON notifications (dedupe_key) WHERE state != 'resolved';
CREATE INDEX idx_notifications_last ON notifications (last_at DESC);
CREATE INDEX idx_notifications_escalate ON notifications (escalate_at) WHERE escalate_at IS NOT NULL;

-- who the row was created for (policy recipient rule x visibility, decided at creation and re-checked at every delivery and
-- every inbox read) and the only per-user state there is: read, snooze (owner decision 4b: no mutes, no preferences)
CREATE TABLE notification_recipients (
  notification_id TEXT NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL,
  read_at         TEXT,
  snoozed_until   TEXT,
  decision        TEXT NOT NULL DEFAULT 'policy',
  added_at        TEXT NOT NULL,
  PRIMARY KEY (notification_id, user_id)
);
CREATE INDEX idx_notification_recipients_user ON notification_recipients (user_id, read_at);

-- the detail view's timeline: created / folded / escalated / acknowledged / resolved / delivery_failed
CREATE TABLE notification_events (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  notification_id TEXT NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  at              TEXT NOT NULL,
  kind            TEXT NOT NULL,
  step            INTEGER,
  count           INTEGER,
  by_user_id      TEXT,
  channel         TEXT
);
CREATE INDEX idx_notification_events_n ON notification_events (notification_id, id);

-- one row per delivery target; `target_ref` is a push host or a MASKED e-mail address, never an endpoint or an address
CREATE TABLE notification_deliveries (
  id              TEXT PRIMARY KEY,
  notification_id TEXT NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id         TEXT,
  channel         TEXT NOT NULL,
  target_ref      TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL CHECK (status IN ('queued', 'sent', 'retry', 'failed', 'gone', 'skipped')),
  reason          TEXT,
  attempt         INTEGER NOT NULL DEFAULT 0,
  mode            TEXT NOT NULL DEFAULT 'new',
  created_at      TEXT NOT NULL,
  sent_at         TEXT
);
CREATE INDEX idx_notification_deliveries_n ON notification_deliveries (notification_id);
CREATE INDEX idx_notification_deliveries_time ON notification_deliveries (created_at DESC);

-- push action buttons: one-time tokens bound to (notification, user, action); only the hash is stored; never a door action
CREATE TABLE notify_action_tokens (
  token_hash      TEXT PRIMARY KEY,
  notification_id TEXT NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL,
  actions         TEXT NOT NULL,
  expires_at      TEXT NOT NULL,
  used_at         TEXT
);
CREATE INDEX idx_notify_action_tokens_exp ON notify_action_tokens (expires_at);

-- work that must happen AFTER the writer's commit (channel deliveries, UI frames): written inside the emitting transaction,
-- taken by the notifier thread - nothing is ever sent under the SQLite write lock
CREATE TABLE notify_outbox (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  kind            TEXT NOT NULL,
  notification_id TEXT,
  payload_json    TEXT NOT NULL DEFAULT '{}',
  created_at      TEXT NOT NULL
);

-- security.new_signin: the remote sign-in devices an account has used (a hash of the Arx client id / user agent)
CREATE TABLE notify_known_devices (
  user_id       TEXT NOT NULL,
  device_hash   TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  PRIMARY KEY (user_id, device_hash)
);

ALTER TABLE rule_alerts ADD COLUMN notification_id TEXT;
CREATE INDEX idx_rule_alerts_notification ON rule_alerts (notification_id);
