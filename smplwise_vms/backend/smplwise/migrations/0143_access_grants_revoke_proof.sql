-- PROVISIONAL number 0143 (built on pilot/WKV2B-295 from c55b7a901; the lead renumbers at integration). The content does not depend on it.
--
-- WKV2B-295 (owner decision 2026-10-21, the WisKey v1 revoke-proof middle path): a v1 access_state answer never proves a revoke.
-- A grant that finished its strip on Arx's own readback plus a v1 answer in the clean-looking shape ends as before (`revoked` / `ended`),
-- but it is recorded as "revoked, not verified by the other side": `revoke_proof` = 'unverified'. A strip proven by a v2 answer records
-- 'verified'. NULL = a row that finished before this column existed, or one that did not finish through a strip (no claim either way).
ALTER TABLE access_grants ADD COLUMN revoke_proof TEXT CHECK (revoke_proof IS NULL OR revoke_proof IN ('verified', 'unverified'));
