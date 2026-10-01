# Development environment for a second machine

What the second computer must replicate so a sub-developer (or a new master) behaves like the first. Versions are
those verified on the primary workstation (Windows 11). No secrets here.

## Claude Code

- Desktop app / CLI `claude-code` 2.1.x, signed in to the second subscription.
- Plugin `superpowers@superpowers-marketplace` v6.3.0 (marketplace `obra/superpowers-marketplace`, user scope):

  ```powershell
  claude plugin marketplace add obra/superpowers-marketplace
  claude plugin install superpowers@superpowers-marketplace
  ```

- Optional: the Claude in Chrome extension (for browser tasks in the real Chrome).
- Project dev servers are defined in `.claude/launch.json` on the primary machine (`frontend-preview` port 4173, `frontend-dev` port 5173). That file is not tracked in Git; recreate it, or run `npm run dev` / `npm run preview` in `frontend/` by hand.
- The lead's session memory is **not in git**. It lives in the private companion repository
  `https://github.com/jonioliel/smplwise-arx-private` (`claude-memory/`, `private-evidence/`). Clone it and copy
  `claude-memory/` into the second machine's `~/.claude/projects/<project-folder>/memory/` (the folder name is
  derived from the repo path Claude Code opens). `private-evidence/` goes into the repo root (gitignored).
- `secrets/` (for example `secrets/lab.env`) and any file over 50 MB travel **only** in a physical transfer package
  prepared by the owner. Never through Git, chat, or the coord branch. Without `secrets/` the machine is a
  no-lab machine: it must not take tasks with `requires_hardware: true`.

## Toolchain

| Tool | Version / source | Notes |
|---|---|---|
| Git | 2.54 | `core.autocrlf=false`; `.gitattributes` enforces LF. Commit messages from a UTF-8 file without BOM: `git commit -F`. |
| Python | 3.12.10, python.org installer under `%LOCALAPPDATA%\Programs\Python\Python312` | Never the bare `python` (Microsoft Store stub); use `py -3.12` or the full path. |
| Repo venv | `.venv` at the repo root | `py -3.12 -m venv .venv`, then `.venv\Scripts\python -m pip install -r smplwise_vms/backend/requirements.txt` (and the dev/test extras declared in `smplwise_vms/backend/pyproject.toml`). |
| Node | 24.21.0 via fnm (`winget install Schniz.fnm`) | Each PowerShell call: `$env:Path = "$env:APPDATA\fnm\node-versions\v24.21.0\installation;$env:Path"`. npm 11. |
| Frontend deps | `npm ci` in `frontend/` | lit, three, vite 6, typescript 5.9, `@playwright/test` 1.63, the rollup `wasm-node` override, gltf-validator. Do not use `npm install` (it rewrites the lock file). |
| Playwright browsers | `npx playwright install` | chromium + headless shell + ffmpeg bundle. |
| ffmpeg | full build, `winget install Gyan.FFmpeg` | Needed by video tests and fixtures. |
| OpenSSH client | Windows optional feature | For the lab host and Home Assistant SSH (only with `secrets/`). |
| Google Chrome | real, stable | Video tests (WebRTC/MSE) must be verified in real Chrome, not only the Playwright chromium. |
| GitHub access | `gh` or a credential manager with push rights to `smplwise-bms` | The coord branch and `pilot/...` pushes need it. |

## Known gotchas

- Playwright specs that import `/src/...` need the Vite **dev** server (5173), not `vite preview` (4173).
- pytest prints a summary line only with `-o addopts=""`; run it with the repo `.venv` and target specific files.
- Run scripts from an isolated working folder / worktree so a stray process does not lock the main checkout.
- Fixture control servers use the API port + 1; do not start another service on that port.
- Never run `git checkout -- .` before reading `git status` (it discards other sessions' uncommitted work).
- Workstation hygiene (a 16 GB machine froze once): run `scripts/dev_cleanup.ps1` after Playwright batches and at
  the end of a segment (`-StopBackend` when finishing), `--workers=1` for live specs, one background job at a
  time, stop if free RAM is under about 2 GB.
- go2rtc on the lab host also serves another project; only streams in the `smplwise_` namespace are ours.

## Verification checklist (run once on the new machine)

```powershell
git --version; git config core.autocrlf        # 2.54..., false
py -3.12 --version                              # 3.12.10
.venv\Scripts\python -m pytest -o addopts="" smplwise_vms/backend/tests/test_coord.py -q
node --version; npm --version                   # v24.21.0, 11.x  (after the PATH prepend)
claude plugin list                              # superpowers@superpowers-marketplace 6.3.0
py -3.12 scripts/coord.py status                # no error; prints lease JSON
```
