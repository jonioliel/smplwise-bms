-- ANDROID-PUSH-2550 (CR-012 section 4C, owner roadmap 25.11 "Android push without Google"): a phone without Google services
-- receives the app's notifications through UnifiedPush - a distributor app on the phone (e.g. ntfy) holds the connection to a
-- push server the site chose, and this server POSTs an RFC 8291 encrypted Web Push message (VAPID, services/push.py) to the
-- endpoint the app registered. A device has ONE push route at a time: the relay token (0057, FCM / APNs through the SmplWise
-- relay) or this endpoint; registering one clears the other (services/mobile_push.register / register_unifiedpush).
-- The endpoint is a capability URL of the push server: never returned by the API, never logged, never exported (local_privacy
-- lists its own columns), cleared with the relay token on every sign-out / revocation path (services/presence.py).
-- `p256dh` / `auth` are the phone's Web Push keys (public key and auth secret; base64url) - only the phone can decrypt.
-- Number 0227: the last number on origin/main (v2.53.0) is 0226; renumber at the train if another branch takes it.
-- Additive only; older code never reads the columns. Rollback: leave them (NULL everywhere = no UnifiedPush device).
ALTER TABLE mobile_devices ADD COLUMN push_up_endpoint TEXT;
ALTER TABLE mobile_devices ADD COLUMN push_up_p256dh TEXT;
ALTER TABLE mobile_devices ADD COLUMN push_up_auth TEXT;
CREATE INDEX idx_mobile_devices_up_endpoint ON mobile_devices (push_up_endpoint) WHERE push_up_endpoint IS NOT NULL;
