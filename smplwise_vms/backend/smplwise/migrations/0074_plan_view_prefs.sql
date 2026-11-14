-- CR-029 S0 (Plan Studio 6, owner rule 2026-10-09: every look choice stays changeable later in settings): a person's own
-- override of the realistic-3D look dials (services/plan_view.py USER_DIALS: style, default view, time source, mouse look,
-- quality rung, eye height, DPR cap, section cut, temperatures, motion) over the installation's `plan.view` setting. One
-- row per user, a partial JSON object (only the dials they set); no row = follow the installation. Presentation only: no
-- permission, no device, no secret. In every backup (services/backup.PROJECT_TABLES). Additive: the previous version
-- ignores the table (rollback = leave it).
CREATE TABLE plan_view_prefs (
  user_id     TEXT PRIMARY KEY,
  value_json  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
