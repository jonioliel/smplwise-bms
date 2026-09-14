# G0 intake — complete in the authorized local workspace

| Input | Initial state | Closure evidence |
|---|---|---|
| Working legacy repository + exact commit | Missing | Source path, commit, repeatable run instructions |
| NVR model/firmware/codec/tracks | Not verified | Redacted read-only probe and source-time samples |
| HA version and identity/permissions path | Not verified | Authenticated identity + negative permission tests |
| External go2rtc version/config behavior | Not verified | Namespace-limited probe, restart and consumer behavior |
| Playback accuracy and source anchor | Not verified | Known-time recording, actual frame timestamp, parity |
| Secrets outside repository | Not verified | Restricted secret location + redaction test |
| Lab changes/physical actions approval | Not granted by this kit | Named scope, operator, expiry and rollback |
| AI/cloud usage budget and privacy consent | Not granted | Explicit approved limit and permitted inputs |

Read-only does not mean unlimited: bound search windows, probes, streams and exports so the NVR keeps recording. Capture API methods as observed, not guessed from archived endpoint tables. Export original footage to a private evidence location only when authorized. Never commit secrets or identifiable camera frames by default.
