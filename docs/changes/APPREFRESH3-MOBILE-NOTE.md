# Note for the Android / iOS teams - device key, revision 2 (APPREFRESH3-295)

Full contract: `docs/changes/APPREFRESH-DEVICEKEY-SPEC.md` (sections 2, 5.1, 6 and the new 6a).

**What changed:** the server now remembers the device's ES256 key per device registration, also after the saved sign-in ends.
Re-registering the device, deleting and re-adding it, or an administrator ending the sign-in no longer frees the device for a new key.

**What you need to do:**

1. **Keep the key pair** across sign-outs, re-registrations and new mints of the same install. Re-mint with the SAME key: no extra
   step. Delete the old key only after a mint with a new key succeeded.
2. **Rotating to a new key** works as before: challenge, then send `device_key.replaces` signed by the OLD key. It now also works when
   no sign-in is live (the challenge returns a usable nonce for a pinned device).
3. **`409 device_key_bound` with no old key available:** show "Ask your administrator to reset this phone's security key" and stop.
   Do not retry in a loop. Once the administrator approves (the user gets a notification in the app and on the phone, valid for 24 hours),
   mint normally with the new key. No `replaces` is needed.
4. **The user's own sign-out frees the key.** That is the app's own `POST /auth/app/sign-out`, or "end this sign-in" / "sign out
   everywhere" on their own account. After it the next mint may use a new key with no proof, and the user receives a notification
   that the key was released (in the app and on the phone).

**Unchanged:** every request and response shape, the signed strings, the error codes and the `details.reason` values. Apps with no
device key are not affected. The only behaviour change for a rev-1 app: a mint with a NEW key after a re-registration or an
administrator's end now answers `409 device_key_bound` instead of `201`.
