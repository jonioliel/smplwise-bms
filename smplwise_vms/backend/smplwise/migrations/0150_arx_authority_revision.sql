-- PROVISIONAL 0150 (WKBRIDGE-295, built on pilot/WKBRIDGE-295 from main @ c37c75c917c79f694039c961174db37d57d43c4c). The final number is
-- assigned at integration; the content does not depend on the number. Everything of this change that touches the schema is in this one file.
--
-- The authority revision Arx hands WisKey in its policy snapshot (WisKey round 3, T06 `authority_revision`; docs/changes/CR-WKBRIDGE295.md).
-- ONE monotonic counter, bumped by triggers in the SAME transaction as any write that can change who holds which access permission at a
-- WisKey station: role bindings, custom roles, group membership, a user's active flag, a station's placement, the buildings / sites a
-- placement hangs off, per-station person decisions and external door grants - and every bump of the existing `permission_revision`
-- setting (so an application-level bump is never missed). The application-level `permission_revision` is NOT reused as the authority
-- revision because several write paths change bindings / group membership / placement without bumping it; triggers cover every writer
-- (a route, a restore, a hand edit) without each one having to remember (the 0031 cache_versions pattern).
--
-- The counter only ever increases (no trigger decreases it, no code writes it). It carries no clock value, no id and no name.
-- Not in any backup allow-list (services/backup.py exports allow-listed tables only), so a `replace` restore never rolls it back: the
-- restore's own DELETE / INSERT of bindings etc. bump it instead. A restore of the whole database FILE would roll it back; WisKey refuses
-- a rollback (planned), so such a host must re-pair (known limit, CR-WKBRIDGE295).
-- Rollback: additive. Older code never reads the table; dropping the table and the triggers loses nothing else.

CREATE TABLE arx_authority_revision (
  id       INTEGER PRIMARY KEY CHECK (id = 1),
  revision INTEGER NOT NULL CHECK (revision >= 1)
);
INSERT INTO arx_authority_revision(id, revision) VALUES (1, 1);

CREATE TRIGGER trg_aar_bindings_ins AFTER INSERT ON bindings BEGIN UPDATE arx_authority_revision SET revision = revision + 1 WHERE id = 1; END;
CREATE TRIGGER trg_aar_bindings_upd AFTER UPDATE ON bindings BEGIN UPDATE arx_authority_revision SET revision = revision + 1 WHERE id = 1; END;
CREATE TRIGGER trg_aar_bindings_del AFTER DELETE ON bindings BEGIN UPDATE arx_authority_revision SET revision = revision + 1 WHERE id = 1; END;

CREATE TRIGGER trg_aar_roles_ins AFTER INSERT ON custom_roles BEGIN UPDATE arx_authority_revision SET revision = revision + 1 WHERE id = 1; END;
CREATE TRIGGER trg_aar_roles_upd AFTER UPDATE ON custom_roles BEGIN UPDATE arx_authority_revision SET revision = revision + 1 WHERE id = 1; END;
CREATE TRIGGER trg_aar_roles_del AFTER DELETE ON custom_roles BEGIN UPDATE arx_authority_revision SET revision = revision + 1 WHERE id = 1; END;

CREATE TRIGGER trg_aar_members_ins AFTER INSERT ON group_members BEGIN UPDATE arx_authority_revision SET revision = revision + 1 WHERE id = 1; END;
CREATE TRIGGER trg_aar_members_upd AFTER UPDATE ON group_members BEGIN UPDATE arx_authority_revision SET revision = revision + 1 WHERE id = 1; END;
CREATE TRIGGER trg_aar_members_del AFTER DELETE ON group_members BEGIN UPDATE arx_authority_revision SET revision = revision + 1 WHERE id = 1; END;

CREATE TRIGGER trg_aar_users_active AFTER UPDATE OF active ON users WHEN OLD.active IS NOT NEW.active BEGIN
  UPDATE arx_authority_revision SET revision = revision + 1 WHERE id = 1;
END;
CREATE TRIGGER trg_aar_users_del AFTER DELETE ON users BEGIN UPDATE arx_authority_revision SET revision = revision + 1 WHERE id = 1; END;

CREATE TRIGGER trg_aar_placement_ins AFTER INSERT ON intercom_station_placement BEGIN UPDATE arx_authority_revision SET revision = revision + 1 WHERE id = 1; END;
CREATE TRIGGER trg_aar_placement_upd AFTER UPDATE ON intercom_station_placement BEGIN UPDATE arx_authority_revision SET revision = revision + 1 WHERE id = 1; END;
CREATE TRIGGER trg_aar_placement_del AFTER DELETE ON intercom_station_placement BEGIN UPDATE arx_authority_revision SET revision = revision + 1 WHERE id = 1; END;

-- the station chain (rbac.station_chain) follows a placement's building to its site and skips deleted buildings / sites
CREATE TRIGGER trg_aar_buildings_upd AFTER UPDATE OF site_id, deleted_at ON buildings BEGIN UPDATE arx_authority_revision SET revision = revision + 1 WHERE id = 1; END;
CREATE TRIGGER trg_aar_buildings_del AFTER DELETE ON buildings BEGIN UPDATE arx_authority_revision SET revision = revision + 1 WHERE id = 1; END;
CREATE TRIGGER trg_aar_sites_upd AFTER UPDATE OF deleted_at ON sites BEGIN UPDATE arx_authority_revision SET revision = revision + 1 WHERE id = 1; END;
CREATE TRIGGER trg_aar_sites_del AFTER DELETE ON sites BEGIN UPDATE arx_authority_revision SET revision = revision + 1 WHERE id = 1; END;

-- per-station person decisions (0134 / 0142): the decided effect and relays, not the sync bookkeeping that moves on every push
CREATE TRIGGER trg_aar_asp_ins AFTER INSERT ON access_station_permissions BEGIN UPDATE arx_authority_revision SET revision = revision + 1 WHERE id = 1; END;
CREATE TRIGGER trg_aar_asp_upd AFTER UPDATE OF effect, relays_json, group_grants ON access_station_permissions BEGIN
  UPDATE arx_authority_revision SET revision = revision + 1 WHERE id = 1;
END;
CREATE TRIGGER trg_aar_asp_del AFTER DELETE ON access_station_permissions BEGIN UPDATE arx_authority_revision SET revision = revision + 1 WHERE id = 1; END;

-- external door grants (0107): the doors, the validity window, the timing and the state (not the code-message / retry bookkeeping)
CREATE TRIGGER trg_aar_grants_ins AFTER INSERT ON access_grants BEGIN UPDATE arx_authority_revision SET revision = revision + 1 WHERE id = 1; END;
CREATE TRIGGER trg_aar_grants_upd AFTER UPDATE OF doors_json, valid_from, valid_until, timing_json, state ON access_grants BEGIN
  UPDATE arx_authority_revision SET revision = revision + 1 WHERE id = 1;
END;
CREATE TRIGGER trg_aar_grants_del AFTER DELETE ON access_grants BEGIN UPDATE arx_authority_revision SET revision = revision + 1 WHERE id = 1; END;

-- every application-level bump (db.bump_permission_revision) moves the authority revision too
CREATE TRIGGER trg_aar_permrev_ins AFTER INSERT ON settings WHEN NEW.key = 'permission_revision' BEGIN
  UPDATE arx_authority_revision SET revision = revision + 1 WHERE id = 1;
END;
CREATE TRIGGER trg_aar_permrev_upd AFTER UPDATE ON settings WHEN NEW.key = 'permission_revision' AND OLD.value IS NOT NEW.value BEGIN
  UPDATE arx_authority_revision SET revision = revision + 1 WHERE id = 1;
END;
