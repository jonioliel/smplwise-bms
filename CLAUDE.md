# SMPLWISE VMS — Claude Code working notes

Read `AGENTS.md` first. It is the operating contract; its Codex-oriented wording applies to Claude Code
unchanged. Precedence when documents disagree: approved change request → `MASTER_SPEC_HE.md` and
`docs/security/` → `AGENTS.md` → active task card → design assets → archive. Contradictions are recorded,
not silently resolved.

## Communication
- The product owner works in Hebrew. Chat replies, questions, and segment reports are in Hebrew, with
  numbered questions and short lettered options. Code, commit messages, and repository documents are in English.
- Never say a test passed unless it was actually run; report NOT_RUN / BLOCKED honestly.

## Workstation environment
- Python 3.12: `%LOCALAPPDATA%\Programs\Python\Python312\python.exe` (or `py -3.12`). The bare `python`
  alias is the Microsoft Store stub and must not be used.
- Node 24 LTS via fnm. Each PowerShell call starts from the app's environment, so prepend the install
  directory yourself: `$env:Path = "$env:APPDATA\fnm\node-versions\v24.21.0\installation;$env:Path"`
  (fnm itself lives under `%LOCALAPPDATA%\Microsoft\WinGet\Packages\Schniz.fnm_*\fnm.exe`).
- Git: `core.autocrlf=false` for this repo; `.gitattributes` enforces LF. Write commit messages to a file
  as UTF-8 **without BOM** and use `git commit -F`.
- Commit trailer: `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

## Secrets and private material
- `secrets/lab.env` (gitignored) holds lab hosts and credentials. Never echo its values into chat, commits,
  fixtures, logs, memory, or documentation. Lab IP addresses, serial numbers, and MAC addresses are treated
  as private too: redact them before anything leaves `secrets/` or `private-evidence/`.
- `private-evidence/` (gitignored): floor plans, legacy add-on logs, raw NVR/go2rtc captures.
  Copy into `tests/fixtures/` only after redaction and review.
- go2rtc on the lab host also serves a separate intercom project (door stations). Only streams in the
  `smplwise_` namespace belong to this product; never create, modify, or delete other streams.
- Home Assistant access is by owner-created Long-Lived Access Tokens and SSH key only. Claude does not log
  in with passwords, create accounts, or change HA users, groups, or admin flags.

## Process
- `management/tasks.json` and `management/test_catalog.json` are canonical. After editing them run
  `python scripts/project_status.py --write` and commit the regenerated views.
- Legacy source of the running system: `legacy/hikvision_nvr_v1.5.27/` (read-only, never edited).
  Audit documents: `docs/legacy/LEGACY_AUDIT.md`, `docs/legacy/REUSE_MATRIX.md`, `docs/legacy/KNOWN_QUIRKS.md`.
- Device access is read-only by default. No writes to the NVR, go2rtc configuration, HA users, recordings,
  or network settings, and no physical actions, without an explicit, task-specific approval from the owner.
- Work on isolated branches (`g0/...`, `pilot/T0xx-...`); `main` receives reviewed merges only.
