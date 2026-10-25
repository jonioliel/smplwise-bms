# WisKey synthetic vectors (WKCAPWIRE-295)

Provenance: WisKey delivery `wiskey_inbox_2026-10-24`, folder `03_signed_vectors` (WisKey product CODE
`fa05c60b001ad1af092a9e43e8f9170388e708c3`; capture vectors made with the original Arx WKCAP source
`4a68d92ce8b36363f45a2ed3950a716cf04a52c1`). All keys are public test keys that are never production; every message is
synthetic and not a live request.

| file | sha256 of this copy | note |
|---|---|---|
| `DIRECT_SIGNING_TEST_VECTOR.json` | `7310ded1071c4529a115443ff460401e06fccdb3423eaaae4bd5bec3cfe2f53e` | byte-identical to the delivered file (`direct/connect`, key `wiskey-direct-v1-public-test-key`) |
| `wiskey_capture_two_layer_vectors_v1.json` | `6591d731fe6988b4aa89b1c0ba9dba120aa57cf9cd4b7bfc5a8f316d5d3baec7` | byte-identical (8 vectors, 7 capture actions, `revoke` in two scopes) |
| `wiskey_direct_simulator_profile_v1.json` | `6a84a9602454db6671e51af7644338d370386946b3f575c44de0f48d94d95839` | the delivered file (sha256 `4e16d8c8d455ad4acf0accd114b93f93d456144e37ed2b179cb56348270f7750`) with ONE edit: the `station_id` of the real HA registry snapshot is replaced by `SYNTHETICSTATION000000001` (a lab identifier) |

These are consumed by `tests/test_wkcapwire_295.py`. The all-families and DIRECT_ONLY corpus is NOT_PRODUCED by WisKey; do not add
runtime-built messages here as if they were a corpus.

## WKVEC-295 additions (Mac owner continuation, 2026-10-25)

| file | sha256 of this copy | note |
|---|---|---|
| `wiskey_native_family_vectors_v1.json` | `4cf8ff6b12ace8478e6759e2b7eb4d9375b40e6ec67e066b36a547be8213c448` | byte-identical; 47 family vectors, 43 families, public key `synthetic-round4-direct-pairing`; ids inside are generated synthetic ULIDs, not lab identifiers |
| `wiskey_direct_simulator.py` | `fb552ccc3b1622fe6af78914b6c4640aaf453f56a6d277cf346b622a6832b2d2` | byte-identical stdlib loopback server (`SyntheticDirectServer`); loaded by path, never installed or started outside a test |

Consumed by `tests/test_wkvec_295.py` (per-vector results are the parametrised test ids).
