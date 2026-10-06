-- TFA2 follow-ups of the optional TOTP second factor (owner decisions 2026-10-06). Additive only: both tables are ignored by the
-- previous version (rollback = run it; the lockout then lives in memory again and the per-user / per-role overrides do not apply).
-- Number 0069: 0068 is the Frigate branch and 0070 another; RENUMBER AT MERGE only if the order changed.

-- Review item L4: the wrong-code lockout survives a restart. One row per user: the instants (epoch seconds, JSON list) of the wrong
-- codes inside the sliding window, and the end of the lockout when one is running. No code, no secret. A row is deleted by a
-- correct code, by a reset / removal of the factor, and by the janitor once it can no longer matter.
CREATE TABLE auth_totp_failures (
  user_id      TEXT PRIMARY KEY,
  attempts_json TEXT NOT NULL DEFAULT '[]',
  locked_until REAL,
  updated_at   REAL NOT NULL
);
CREATE INDEX idx_auth_totp_failures_updated ON auth_totp_failures (updated_at);

-- Per-user and per-role override of the global `security.second_factor_policy`. A missing row = inherit. `optional` = never owed
-- by policy for that subject (the factor stays available), `required` = a remote sign-in owes it (a user with no factor gets the
-- enrolment-required answer; the local channel stays the break-glass path). subject_id is a user id or a role id (built-in or custom).
CREATE TABLE auth_totp_policy (
  subject_kind TEXT NOT NULL CHECK (subject_kind IN ('user', 'role')),
  subject_id   TEXT NOT NULL,
  policy       TEXT NOT NULL CHECK (policy IN ('optional', 'required')),
  updated_at   TEXT NOT NULL,
  updated_by   TEXT,
  PRIMARY KEY (subject_kind, subject_id)
);
