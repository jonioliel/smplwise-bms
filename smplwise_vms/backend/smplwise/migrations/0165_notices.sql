-- Final number 0165 (CR-NOTICE106 / NOTICE106B-295; built as PROVISIONAL 0160, renumbered at the 2.16.0 integration, release/2160).
-- Nothing else refers to the number.
--
-- CR-NOTICE106 - the building notice board (docs/changes/CR-NOTICE106.md section 3.1): notices, TV boards, the notices tagged to
-- a board, read marks. The module switch `notices.enabled` is OFF by default (a setting, not a table). The effective state of a
-- notice (draft / scheduled / active / expired / archived) is derived at read time - no worker, expiry exact to the second.
-- A board's link token is stored only as its SHA-256 (token_hash); the plain token is shown once at create / rotate.
-- Rollback: drop the four tables (no other table refers to them).

CREATE TABLE notices (
  id              TEXT PRIMARY KEY,
  title           TEXT NOT NULL,                                -- <= 120, plain text
  body            TEXT NOT NULL DEFAULT '',                     -- <= 2000, plain text, line breaks kept
  severity        TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'alert', 'critical')),
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  starts_at       TEXT NOT NULL,                                -- ISO UTC
  ends_at         TEXT,                                         -- ISO UTC; NULL = until archived (not for critical)
  pinned          INTEGER NOT NULL DEFAULT 0,
  dwell_s         INTEGER,                                      -- seconds on a TV board (NULL = the board's interval rule)
  when_text       TEXT,                                         -- optional manager wording of the window on the TV (<= 60)
  audience_json   TEXT NOT NULL DEFAULT '{}',                   -- {"everyone": true} | {"floors": [...], "groups": [...], "roles": [...]}; {} = TV only
  push_requested  INTEGER NOT NULL DEFAULT 0,
  pushed_at       TEXT,
  push_generation INTEGER NOT NULL DEFAULT 0,
  site_id         TEXT,
  building_id     TEXT,
  floor_id        TEXT,
  published_at    TEXT,                                         -- the first publication (the TV takeover window of an urgent notice)
  created_by      TEXT NOT NULL,
  created_at      TEXT NOT NULL,
  updated_by      TEXT,
  updated_at      TEXT NOT NULL,
  archived_at     TEXT,
  deleted_at      TEXT
);
CREATE INDEX idx_notices_state ON notices (status, starts_at, ends_at);
CREATE INDEX idx_notices_deleted ON notices (deleted_at);

CREATE TABLE notice_boards (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,                               -- <= 60
  slug             TEXT NOT NULL UNIQUE,                        -- a-z0-9-, <= 40, immutable after create
  enabled          INTEGER NOT NULL DEFAULT 1,
  display_json     TEXT NOT NULL DEFAULT '{}',                  -- section 8.4 (normalised by services/notices/model.py)
  token_hash       TEXT,                                        -- SHA-256 hex of the link token; NULL = no link
  token_generation INTEGER NOT NULL DEFAULT 0,
  token_rotated_at TEXT,
  control_json     TEXT,                                        -- the remote control lease {seq, cmd, until} (60 s)
  last_seen_at     TEXT,                                        -- the last successful feed read (a timestamp only)
  created_by       TEXT NOT NULL,
  created_at       TEXT NOT NULL,
  updated_by       TEXT,
  updated_at       TEXT NOT NULL,
  deleted_at       TEXT
);
CREATE INDEX idx_notice_boards_token ON notice_boards (token_hash);

CREATE TABLE notice_board_items (
  board_id  TEXT NOT NULL REFERENCES notice_boards(id),
  notice_id TEXT NOT NULL REFERENCES notices(id),
  position  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (board_id, notice_id)
);
CREATE INDEX idx_notice_board_items_notice ON notice_board_items (notice_id);

CREATE TABLE notice_reads (
  notice_id TEXT NOT NULL,
  user_id   TEXT NOT NULL,
  read_at   TEXT NOT NULL,
  PRIMARY KEY (notice_id, user_id)
);
