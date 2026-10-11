"""WisKey importer, stage 1 (docs/changes/CR-035-WISKEY-IMPORTER.md).

WisKey packages nothing (owner decisions 2026-10-04 and 2026-10-10). Arx receives WisKey's source as a read-only folder
`<exchange>/ready/<package>/` (a git bundle, support files, three metadata files, WisKey's transport manifest and SHA256SUMS),
validates it offline, builds its own import manifest and - for an install candidate only - prepares a staged, journalled
install of the integration into the platform's `custom_components/` (commit, then marker).

Modules:
  common   strict JSON, hashes (SHA-256 and the git blob id), path rules, semver, canonical JSON
  profile  the Arx-registered expectations of one package (`arx-wiskey/import-profile/0`): refs, metadata hashes, counts, limits
  gitbox   the isolated git runner: a throwaway bare repository, no remote, no network, no hooks, no user or system config
  scan     the value-free forbidden-content scan of the installable part (names, IPv4, MAC, secret literals, tokens, keys)
  intake   the offline verification (PASS / FAIL per check) and the Arx import manifest
  install  staging, journal, commit-then-marker install and recovery - designed and tested against fakes only
  store    the importer's own files under the data directory and the kill switch (`wiskey.import_enabled`, default off)

Nothing in this package executes, imports or checks out code from a delivered package: git objects are read as bytes
(`cat-file`), files are hashed and scanned as bytes, and nothing is ever installed into a live system by this stage.
"""
