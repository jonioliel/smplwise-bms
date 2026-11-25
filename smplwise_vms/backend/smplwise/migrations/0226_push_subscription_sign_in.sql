-- FE-SAFETY-FIX-2520 (deep review 2520 frontend core, finding FC-02): a browser's Web Push subscription survived the sign-out of the
-- remote sign-in it was registered through, so a signed-out shared device kept receiving that user's notifications. Each row now
-- records WHICH sign-in registered it: the sessions list's public id of that sign-in (services/ha_user_auth.public_id - a hash, never
-- a cookie value), NULL for a browser inside Home Assistant (Ingress) and for rows written before this migration. A sign-out, one
-- sign-in revoked from the sessions list, or the other sign-ins ended after a password change / a first second factor remove the rows
-- of those sign-ins; "sign out everywhere", an administrator ending every sign-in, disabling or resetting the user remove all of the
-- user's rows (services/push.end_for_sign_ins / end_for_user).
-- Number 0226: the last number on release/2520-train is 0225; renumber at the train if another branch takes it.
-- Additive only; older code never reads the column. Rollback: leave it (NULL everywhere = the old behaviour).
ALTER TABLE push_subscriptions ADD COLUMN sign_in TEXT;
CREATE INDEX idx_push_subscriptions_sign_in ON push_subscriptions (sign_in) WHERE sign_in IS NOT NULL;
