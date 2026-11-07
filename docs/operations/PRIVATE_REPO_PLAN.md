# Private development repository + public add-on repository - plan

Status: **PLAN, awaiting the owner's approval.** Nothing here has been executed: no repository was created, renamed or
changed, no remote was repointed, no history was rewritten. Hebrew summary for the owner: `PRIVATE_REPO_PLAN_HE.md`.

Owner decision 2026-11-07: development moves to a private repository; the public repository keeps only what users need to
install the Home Assistant add-on, without the development history. Reason: the T005 secrets scan (finding N5,
`docs/changes/T005-AUDIT-2406.md` on `chore/T005-AUDIT-2406`) found 80+ files of the git-ignored `private/` folder (legal
pack, planning notes, runner notes) in the public history, and a real lab LAN address appears in 11 history commits (N3).
This supersedes the "one repository" choice of ADR-014 (the planned split was recorded on 2026-10-31 when the
all-rights-reserved `LICENSE` was added).

## 1. What we found (read-only investigation, 2026-11-07, `origin/main` = `a4652fda5` = tag `v2.40.5`)

| Topic | Finding | Consequence |
|---|---|---|
| GitHub repository | `jonioliel/smplwise-bms`, public, 0 forks, 0 stars, 0 open issues, **0 GitHub Releases**, ~3 GB, 64 `v*` tags, ~680 branches | renaming keeps everything; no fork network to split |
| GitHub Actions | none (`.github/` holds only `PULL_REQUEST_TEMPLATE.md`) | nothing to migrate; images are built by each Supervisor |
| Store metadata | `repository.yaml` (name, url, maintainer) at the root; no `repository.json` | the public repo needs `repository.yaml` at its root |
| Add-on | `smplwise_vms/`: `config.yaml` (version, slug `smplwise_vms`, no `image:` key -> the Supervisor builds locally from `Dockerfile`), `build.yaml` (base images), `Dockerfile`, `run.sh`, `CHANGELOG.md`, `DOCS.md`/`DOCS_HE.md`, `README*.md`, `LICENSE`; no `icon.png`/`logo.png`, no add-on `translations/` | the build context is `smplwise_vms/` only |
| What the Dockerfile copies | `backend/requirements.txt`, `backend/smplwise`, `www`, `www-public`, `CHANGELOG.md`, `integration`, `downloads/`, `run.sh` | `backend/tests` (1,082 files, some with the address of finding N3) and `backend/pyproject.toml` are NOT needed by users |
| Bridge integration | installed **by the add-on**: the image carries `smplwise_vms/integration/smplwise_bridge` (a mirror of `custom_components/smplwise_bridge`, `scripts/sync_integration.py`) and copies it into `<config>/custom_components` at start-up. `DOCS.md` also documents a manual path: "add the repository in HACS as a custom Integration repository" -> root `custom_components/smplwise_bridge` + `hacs.json` | published by default (same files the image already carries); `--no-hacs` drops them |
| WisKey integration | `smplwise_vms/integration/hikvision_intercom` (MIT, byte-exact pin) ships in the image | published (inside the add-on folder) |
| Store URL in installs | every HA that added the store has `https://github.com/jonioliel/smplwise-bms`. The Supervisor derives the installed add-on's full slug from a hash of that URL | **the public repository must keep exactly this URL**, otherwise every install is orphaned (shown as a different add-on, new data folder) |
| In-app update (CR-021) | `self_update.py` calls the Supervisor `POST /store/reload` and `POST /store/addons/{slug}/update`; it never contacts GitHub itself | unaffected while the URL is unchanged |
| Runner / gate / nightly / chains | all use the remote **name** `origin` in the clone `~/smplwisebms` (nightly, `branch_check.sh`, `release_gate.py`, `release_gate2.sh` uses `v*` tags reachable from `origin/<branch>`, `asgi_wiskey_run.sh`) and worktrees under `~/work` that share that clone's config. `private/runner/run_remote.sh` / `watcher/push_watch.py`: `git fetch` only. The only hard-coded URL: `REPO_URL` in `private/runner/setup_ubuntu.sh` and `setup_ubuntu_all_in_one.sh` (used for a fresh install; they already run `gh auth setup-git` "a private repo needs a credential") | repoint = one `git remote set-url origin ...` per clone; the private repo must carry all branches **and tags** |
| Workstation | `C:\cloude\smplwisebms` `origin` = the public URL; all `smplwise-wt-*` worktrees share it | one `set-url` |
| Docs naming the URL | `docs/operations/SECOND_COMPUTER_SETUP_HE.md` (clone command), `docs/architecture/ADR-014-repository-and-deployment.md`, `docs/security/CR021_SELF_UPDATE_SECURITY_NOTES.md` (branch rules), `management/upstream_watch.json` (`our_repository`), WisKey handoff docs; bridge `manifest.json` `documentation` / `issue_tracker` | the manifests and `DOCS.md` keep the public URL (correct); the dev docs get the private URL after cutover |

## 2. Target layout

### 2.1 Private development repository (everything that exists today)

Recommended: the **current repository renamed and made private**, e.g. `jonioliel/smplwise-arx-dev` (name: owner's choice).
It keeps the full history, every branch and tag, the PR template, all docs, `management/`, `scripts/`, `frontend/` source,
tests and `legacy/` exactly as today. `repository.yaml`, `hacs.json` and `smplwise_vms/` stay in it: they are the source of
truth from which the public tree is built.

### 2.2 Public add-on repository (`jonioliel/smplwise-bms`, same URL as today)

Built only by `scripts/publish_public_addon.py` from a release tag; one commit and one `vX.Y.Z` tag per release, history
starting fresh at the cutover release.

```
repository.yaml                 # url rewritten to the public URL
README.md                       # generated: what this is, how to add the store, links to DOCS / CHANGELOG / LICENSE
LICENSE  THIRD_PARTY_NOTICES.md  .gitattributes
hacs.json                       # manual HACS path for the bridge (DOCS.md); --no-hacs drops it
custom_components/smplwise_bridge/
smplwise_vms/
  config.yaml build.yaml Dockerfile run.sh CHANGELOG.md DOCS.md DOCS_HE.md README.md README_HE.md LICENSE
  backend/requirements.txt  backend/smplwise/
  www/  www-public/  integration/  downloads/README.txt
```

At `v2.40.5`: **1,946 files, 47.1 MiB** (of 17,370 tracked files). Left out inside the allowed folders: the 239 UI source maps
(`*.map`, they embed the whole frontend TypeScript source; the browser only logs a 404 when dev tools are open;
`--keep-source-maps` keeps them), `__pycache__`, `*.pyc`, backup files.

### 2.3 Never public

`private/`, `secrets/`, `private-evidence/`, `legacy/`, `management/`, `prompts/`, `docs/` (spec, security notes, change
receipts, legal), `scripts/` (gate, runner, lab probes), `frontend/` source, `mobile/`, `services/` (push relay / fleet
workers), `contracts/`, `templates/`, every `tests/` and `fixtures/` folder (lab-derived values), `MODEL_POLICY*.json`,
`AGENTS.md`, `CLAUDE.md`, `MASTER_SPEC_HE.md`, `PROJECT_BOARD.html`, `PACKAGE_MANIFEST.json`, root `CHANGELOG.md`, `Makefile`,
`.claude/`, `.github/`, any `.env` / key / keystore / database / APK file.

## 3. The publish step: `scripts/publish_public_addon.py`

- Reads **git objects of the ref** (`git ls-tree` + `git cat-file --batch`), never the working tree: uncommitted or ignored
  files cannot leak.
- Allow-list selection (section 2.2), then a **deny-list that refuses the whole run** (exit 3, nothing written) if any selected
  path is under `private/`, `secrets/`, `private-evidence/`, `legacy/` or another dev folder, has a `tests` / `fixtures` /
  `private` / `secrets` / `data` folder segment, is an env / key / keystore / database / APK / `MODEL_POLICY.json` file, a
  symlink or a submodule.
- Content checks on every published byte: PEM private keys refuse; `--forbid-env secrets/lab.env` compares every value
  (6+ characters) of a local env file and refuses on a match, **reporting key names only, never values**; private-range IPv4
  literals (RFC 1918, RFC 6598) are warnings, errors with `--strict`. Known-benign constants are not reported: network
  addresses (`x.y.z.0`, the SSRF guard ranges), the Supervisor network addresses (gateway, Supervisor) and the two named addresses inside 100.64/10 (Tailscale MagicDNS, the blocked cloud-metadata address of `connection_probe.py`).
- Version gate: the ref must be exactly a `v*` tag (`--allow-untagged` for check runs only) and tag = `config.yaml`
  version = Dockerfile `io.hass.version` label.
- `--dry-run` lists and checks, writes nothing (`--list` prints every path, `--json FILE` writes the list and the checks).
- `--out DIR`: an empty folder or an existing clone of the public repository; everything except `.git/` is replaced; it
  refuses an `--out` inside the development repository. The script never commits or pushes.

Release routine after the cutover (added to the release checklist):

```
python scripts/publish_public_addon.py --ref vX.Y.Z --dry-run --strict --forbid-env secrets/lab.env
python scripts/publish_public_addon.py --ref vX.Y.Z --strict --forbid-env secrets/lab.env --out ..\smplwise-public
cd ..\smplwise-public ; git status ; git diff --stat        # review
git add -A ; git commit -F msg.txt                            # "release: X.Y.Z"
git tag vX.Y.Z ; git push origin main vX.Y.Z
```

The installs see the new version on their next store refresh, exactly as today.

## 4. Cutover - in order, with who does what

Choose a quiet moment: no gate, nightly or chain running, no release half-published.

| # | Who | Step | Check |
|---|---|---|---|
| 0 | owner | Approve this plan; choose the private name (default `smplwise-arx-dev`) and the history option of section 6 (default: A, private) | - |
| 1 | lead | Tag check: the last release tag exists on `origin` and `publish_public_addon.py --ref <tag> --dry-run --strict` is OK; `--forbid-env secrets/lab.env` run locally (prints key names only) | exit 0 |
| 2 | owner | GitHub -> `smplwise-bms` -> Settings -> General -> **Rename** to the private name | old URL now redirects |
| 3 | owner | Same page -> Danger zone -> **Change visibility -> Private** | anonymous `https://github.com/jonioliel/<private-name>` = 404 |
| 4 | lead | Repoint every development clone **before step 6**: workstation `C:\cloude\smplwisebms` (worktrees share it), runner `~/smplwisebms` (nightly, gate, `~/work` worktrees share it), the second computer if present: `git remote set-url origin https://github.com/jonioliel/<private-name>.git`, then `git fetch origin` and `git ls-remote origin refs/tags/v2.40.5` | every clone: `git remote get-url origin` = private URL; fetch OK with the existing credential (`gh auth setup-git` on the runner, Git Credential Manager on Windows; a fine-grained token scoped to the repository keeps working after a rename, the repository id is unchanged) |
| 5 | lead | Update `REPO_URL` in `private/runner/setup_ubuntu*.sh` (local, not in git) | grep |
| 6 | owner | Create the **new public repository** `jonioliel/smplwise-bms`: empty (no README, licence or .gitignore), description "SmplWise Arx - Home Assistant add-on". This ends GitHub's redirect from the old name | anonymous 200, empty |
| 7 | owner | On the public repository: Settings -> Rules -> a ruleset for "all branches except `main`": restrict creation; another on `main` and `v*` tags: block deletion and force-push (as `CR021_SELF_UPDATE_SECURITY_NOTES.md` requires); disable Wiki/Projects; Issues as he wishes | a test push of a stray branch is refused |
| 8 | owner | Give the lead push access to the public repository (it is his own account: nothing to do; if a fine-grained token is used, add the new repository to it) | - |
| 9 | lead | `git clone https://github.com/jonioliel/smplwise-bms.git ..\smplwise-public`; run the release routine of section 3 for the current release tag; push `main` + the tag | anonymous clone has 1,946-ish files, `repository.yaml` url = public URL |
| 10 | owner approves, lead runs | On the lab HA: store refresh (`POST /store/reload`, the same call the in-app update makes) | SmplWise Arx still listed under the same repository, installed version unchanged, slug unchanged, no repair notice |
| 11 | lead | Next release: publish a version bump through the routine; lab "update" from the store builds and starts | version shown, healthz green |
| 12 | lead | Docs on a branch of the private repo: `SECOND_COMPUTER_SETUP_HE.md` (clone from the private URL, with credential), ADR-014 superseded note (new ADR-0xx), `CR021_SELF_UPDATE_SECURITY_NOTES.md` (rules now on the public repo; the private one needs the same deletion/force-push block), `management/upstream_watch.json` `our_repository`, release checklist gains the publish step | reviewed merge |

Risk to watch at step 10: the Supervisor keeps a shallow clone of the store; the new public history is unrelated to the old
one. Current Supervisors fetch and hard-reset to the remote branch, and re-clone when that fails; if a repair notice
("repository is broken") appears, the owner uses **Settings -> System -> Repairs -> reset repository**. Never remove the
store repository while the add-on is installed. Step 10 is done on the lab first, before any other installation refreshes.

Window between steps 2 and 6: a store refresh on any HA follows the redirect to a private repository and fails with an
error; nothing is uninstalled. Keep the window short (minutes).

Hazard after step 6: a clone still pointing at the old URL would push development branches into the PUBLIC repository.
Step 4 must be complete first; step 7's "restrict creation" ruleset is the safety net.

## 5. Rollback

| Point reached | Rollback |
|---|---|
| after 2-3 (renamed/private), before 6 | rename back to `smplwise-bms`, visibility public, `set-url` back: identical to today |
| after 6-9, the public repository misbehaves | fix forward: it holds only the published tree, republish from the tag; or delete the new public repository and repeat 6-9 |
| installs cannot update from the new public repository (step 10 fails and the repair does not help) | delete the new public repository, rename the private one back and make it public again (this re-publishes the history - only with the owner's explicit decision); `set-url` back |
| runner cannot fetch | `git remote set-url origin` back to the old URL works only while the redirect lives (before step 6); after it, fix the credential (`gh auth status`, `gh auth setup-git`) |

## 6. The existing public history - owner's choice

| Option | Effect | Recommendation |
|---|---|---|
| **A. Rename + make private** (section 4) | the history, branches, tags stay with us, hidden from the web at once; the public URL is freed for the add-on repository; no push of 3 GB needed | **recommended** |
| B. New private repository + delete the old one | owner creates an empty private repository, lead pushes every branch and tag to it (`git push <new> 'refs/remotes/origin/*:refs/heads/*' --tags`, ~3 GB, without `origin/HEAD`), then the owner **deletes** the old repository and creates the public one under the old name. Deletion is final for the public; GitHub can restore a deleted repository for about 90 days on request | only if a fresh repository is wanted |
| C. Archive the old repository | archived = read-only but still **public** and still owns the name; the add-on repository could not keep the URL | not suitable |
| D. Keep it public and force-push one clean commit | rewrites history (forbidden without explicit approval); old commits stay reachable by SHA and in GitHub caches until GitHub support purges them; branches and tags would all have to be deleted | not recommended |

In every option: **copies already taken cannot be recalled** - clones and forks made by anyone while the repository was
public, GitHub's cached views and API responses, the GH Archive event log (commit metadata), Software Heritage and search
engine caches. Treat everything that was ever in the history as disclosed: the owner can see the last 14 days of clones under
Insights -> Traffic; any credential that might have been committed (T005 N4: two password-like literals in history) is
rotated; the lab LAN address (N3) is a private RFC 1918 address, not reachable from outside, but stays on the redaction list.
GitHub support can be asked to purge cached views of specific commits (sensitive-data removal request) if the owner wants.

## 7. Checklist

- [ ] Owner approved the plan, the private name and history option A/B
- [ ] `publish_public_addon.py --dry-run --strict` OK on the release tag; `--forbid-env secrets/lab.env` OK
- [ ] No gate / nightly / chain running
- [ ] (owner) renamed, made private; anonymous access 404
- [ ] (lead) workstation, runner, second computer: `origin` = private URL; fetch + tags OK
- [ ] (lead) `setup_ubuntu*.sh` REPO_URL updated
- [ ] (owner) new public `smplwise-bms` created empty; rulesets on; access for the lead
- [ ] (lead) public tree published from the tag, tag pushed; anonymous clone checked: no `private/`, `docs/`, `scripts/`, `tests/`
- [ ] (owner approval) lab store refresh: same add-on, same slug, same version, no repair
- [ ] next release published through the routine and updated on the lab
- [ ] docs updated (second computer, ADR, CR-021 notes, upstream watch, release checklist)
- [ ] old public history: option recorded; exposure noted (Traffic page); N4 credentials reviewed/rotated

## 8. Dry-run evidence (2026-11-07, workstation)

`python scripts/publish_public_addon.py --ref v2.40.5 --dry-run --strict`: exit 0, **1,946 files, 47.1 MiB**, 239 source
maps skipped, no warning, no error. No published path under `private/`, `secrets/`, `private-evidence/`, `docs/`, `scripts/`,
`management/` or any `tests/` folder. Negative checks: forcing `smplwise_vms/backend/tests` and `MODEL_POLICY.json` into the
allow-list -> exit 3 (1,083 DENY lines); a fake env value present in the tree -> exit 3, key name reported, value not
printed; an untagged ref -> exit 2; `--out` inside the repository -> exit 2; a real write to a scratch folder produced the same
1,946 files with every Dockerfile `COPY` source present. The `--forbid-env secrets/lab.env` run is NOT_RUN here (the
investigating agent does not read `secrets/`); the lead runs it at step 1. The Supervisor build of the published tree is
NOT_RUN (no Docker on the workstation; step 10-11 is the real check).
