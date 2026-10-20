-- usr2-passkeys-only-mode: the optional per-user "passkeys only" sign-in mode of Arx-only (local) identities.
-- Number 0140: PROVISIONAL on branch pilot/PASSKEYONLY-295 (current last on main is 0127); the lead renumbers at integration.
-- Additive only: one column with a default of 0 (off) - the mode is off for every user and every customer until it is switched on.
-- With the mode on, password sign-in of that user is refused; it is only effective while a usable passkey exists and the owner switch
-- `security.local_passkey_first` is on (so a changed address or a switched-off owner switch can never lock a user out).
ALTER TABLE auth_local_credentials ADD COLUMN passkey_only INTEGER NOT NULL DEFAULT 0;
