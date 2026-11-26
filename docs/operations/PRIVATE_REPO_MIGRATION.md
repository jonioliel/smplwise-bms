# Private development repository - migration runbook (PRIVATE-REPO-PREP-2550)

Status: **RUNBOOK, not executed.** No repository was created, renamed or made private, no remote was repointed, nothing was
pushed to a new remote, no GitHub setting, token or the `addon` branch was touched. Owner page (Hebrew, decisions and the
GitHub clicks he does himself): `private/planning/private_repo_owner_steps_2026-11-26_HE.md` (local, not in git).

Supersedes the 2.40.7 plan `docs/operations/PRIVATE_REPO_PLAN.md` (branch `docs/PRIVATE-REPO-PLAN-2407`, never merged): that
plan predates the app-store `addon` branch (14.11) and its publish script could not build 2.53.0 (section 9).

Basis - owner decisions already taken (do not re-ask):

| Date | Decision |
|---|---|
| 31.10 | all-rights-reserved `LICENSE`; later move development to a private repository; recommended split = private dev repo + public add-on-only repo |
| 07.11 (round 24, 4.4 א) | private dev repo; the public repo holds the add-on only; the lead writes the plan for approval |
| 07.11 (round 25) | 1 א rename the current repository and make it private (history stays with us); 2 א private name `smplwise-arx-dev`; 3 א keep the manual HACS path for the bridge; 4 א after 2.40.7 (not done since) |
| 07.11 (gate speed-ups) | the public repository keeps the name **`smplwise-bms`** (store URL unchanged), not `SMPLWISE-ARX` |
| 14.11 | the store installs from the slim orphan branch `addon` (`https://github.com/jonioliel/smplwise-bms#addon`), refreshed every release |
| 25.11 | roadmap: private repo is a 2.55+ item |

## 1. Facts this runbook is built on (read-only, 26.11, `origin/main` = `3b4654f8b` = tag `v2.53.0`)

| Topic | Finding | Consequence |
|---|---|---|
| Store URL forms in use | Lab HA added the plain URL long ago: installed slug `0b8c26d5_smplwise_vms`. M-center HA uses `#addon`: slug `fd2db8b2_smplwise_vms`. The Supervisor names a repository `sha1(url.lower())[:8]`: `https://github.com/jonioliel/smplwise-bms` -> `0b8c26d5`, `...smplwise-bms#addon` -> `fd2db8b2` (computed 26.11; both match the recorded slugs) | **both URL strings must keep working, byte for byte**. Any other URL (new name, `.git` suffix -> `92c1c246`, self-hosted) is a different add-on to the Supervisor: new slug, new data folder, reinstall + restore |
| What each URL clones | plain URL = the repository's default branch; `#addon` = branch `addon`. On a store refresh the Supervisor fetches `depth=1` and hard-resets to `origin/<the branch it cloned>` (lab: `main`), re-cloning only when that fails | the public repository needs **both `main` and `addon`**, identical. Unrelated history is fine for a hard reset |
| `addon` branch today | orphan, 15 commits, first `c7246934c` (2.43.6), head `ba6e82452` = 2.53.0; 3,821 files incl. 1,424 under `smplwise_vms/backend/tests` | its history carries the backend tests; a fresh public history (section 4) leaves them out |
| Refresh routine today | manual: worktree `C:\cloude\smplwise-addonbr` (detached at `ba6e82452`) of the development clone; copy `smplwise_vms` + `repository.yaml` from the tag, strip `sourceMappingURL`, commit, `git push origin HEAD:addon` | that worktree shares the clone's `origin`: **after the repoint its push lands in the private repository and the store silently goes stale**. Retire it |
| Workstation | `C:\cloude\smplwisebms` `origin` = `https://github.com/jonioliel/smplwise-bms.git`; 86 worktrees share that config | one `git remote set-url` covers all of them |
| Runner | `~/smplwisebms` is the only clone: `release_gate.py` (`BASE = ~/smplwisebms`), `release_gate2.sh` / `branch_check.sh` (`GATE2_REPO` default), `nightly_tests.sh` (`DIR`), `asgi_wiskey_run.sh` (`SW_REPO`), worktrees `~/work/<branch>` and `~/work/gate-<branch>`. All address the remote **by name `origin`**, never by URL. `release_gate2.sh` picks the base as the newest `v*` tag reachable from `origin/<branch>`; `nightly_tests.sh` runs `git fetch --all --prune` with output discarded | one `set-url` on the runner. Never add the public repository as a second remote of any development clone: its `v*` tags (other commits, same names) make `fetch --all` fail quietly and corrupt the gate's base selection |
| `engine_sync.py` | compares installed gate files (`~/release_gate.py`, `~/gate2/*`) with `scripts/gate/*` of a local ref (`--repo ~/smplwisebms --ref origin/<b>`) | no URL; unchanged |
| `~/work/slotb.sh` | lock + gate-busy + memory wrapper around a command | no URL; unchanged (verify with the readiness check on the runner, section 7) |
| Lab installer `~/lab1311/install_addon.py` | HA API: `store/reload` -> wait for `version_latest` = X -> `update/install` (backup) on `update.smplwise_vms_update`; run with `~/smplwisebms/.venv/bin/python` | URL-agnostic. It only works once the public `main` carries version X (the lab follows `main`) |
| `push_watch.py`, `run_remote.sh` | `git fetch` only | need a credential once the repository is private |
| `scripts/coord.py` | multi-session lease = a non-force `git push` of a lease branch to `origin` | goes to the private repository: correct |
| Fresh runner install | `private/runner/setup_ubuntu.sh` + `setup_ubuntu_all_in_one.sh` hold `REPO_URL` (local, not in git); they already run `gh auth setup-git` | change the URL |
| In-app update (CR-021) | `self_update.py` calls the Supervisor `store/reload` + `store/addons/{slug}/update`; never GitHub | unaffected while the store URL is unchanged |
| GitHub Actions / Releases / Pages | none; `.github/` holds only the PR template | nothing to migrate |
| Runtime code / UI | no reference to the repository URL outside the store metadata (readiness check, section 8) | no add-on code change is needed |

## 2. What moves, what stays

| Item | Private `jonioliel/smplwise-arx-dev` | Public `jonioliel/smplwise-bms` |
|---|---|---|
| Full history, every branch and `v*` tag, PR template | yes (the current repository, renamed) | no |
| `docs/`, `management/`, `scripts/`, `frontend/` source, `legacy/`, `mobile/`, `services/`, tests, fixtures, `AGENTS.md`, `CLAUDE.md`, `MASTER_SPEC_HE.md` | yes | **never** |
| `repository.yaml`, `hacs.json`, `custom_components/smplwise_bridge`, `smplwise_vms/` | yes (source of truth) | the release tree only, built by `scripts/publish_public_addon.py` from a tag |
| Public tree (2.53.0 dry run) | - | 2,433 files, 52.9 MiB: `repository.yaml`, generated `README.md`, `LICENSE`, `THIRD_PARTY_NOTICES.md`, `.gitattributes`, `hacs.json`, `custom_components/smplwise_bridge/`, `smplwise_vms/` (Dockerfile build context only: `config.yaml`, `build.yaml`, `Dockerfile`, `.dockerignore`, `run.sh`, docs, `CHANGELOG.md`, `THIRD_PARTY_NOTICES.md`, `backend/requirements.txt`, `backend/constraints.txt`, `backend/smplwise/`, `www/`, `www-public/`, `integration/`, `downloads/README.txt`). No `backend/tests`, no `pyproject.toml`, no `*.map` |
| Branches | everything as today | **`main` and `addon`, always the same commit**; `v*` tag per release |
| Store URLs that keep working | - | `https://github.com/jonioliel/smplwise-bms` (lab, new installs) and `...#addon` (M-center and anyone who used it) |

Copies made while the repository was public (clones, caches, GH Archive, Software Heritage) cannot be recalled; the move
limits future exposure only. Items from the T005 audit (two password-like literals in history, the lab LAN address) stay on
the rotation / redaction list regardless.

## 3. Delivery path for the add-on store - options

The Supervisor store accepts only a **git repository URL** (optionally `#branch`) that it can clone **without credentials**.
It does not read release assets, tarballs or a bare `repository.yaml` over HTTP.

| Option | How | Slugs of existing installs | Effort / risk | Verdict |
|---|---|---|---|---|
| **A. Public "dist" repository under the old name** | rename the current repo to `smplwise-arx-dev` (private), create a new public `smplwise-bms` holding only the published tree on `main` + `addon` | unchanged (same two URL strings) | one extra commit + push per release (replaces today's `#addon` refresh); GitHub rulesets work on public repos on the free plan | **recommended** |
| B. GitHub release asset | publish the add-on as a zip on a GitHub Release | the store cannot install from an asset. Only a manual copy into `/addons` (local add-on, slug `local_smplwise_vms`) = new add-on on every HA, no store updates, no in-app update (CR-021) | high per-site work, breaks CR-021 | rejected. Release assets are useful later only *next to* A (prebuilt images, notes) |
| B2. Prebuilt images (`image:` in `config.yaml`, ghcr.io) | still needs a public git store (A) for `config.yaml`; images in a public registry | unchanged if done on top of A | needs CI, multi-arch builds, GPL notices for ffmpeg/poppler (dependency audit 31.10) | later improvement on top of A, not a replacement |
| C. Self-hosted repository | own git server (Gitea/Forgejo or `git-http-backend` with smart HTTP: the Supervisor clones `depth=1`, which dumb HTTP does not serve) e.g. on a smplwise.com host | **all change** (new URL = new hash): every HA reinstalls + restores, M-center and lab included | server, TLS, uptime and backups become ours; a GitHub-independent path | not now. Keep as the exit if GitHub ever becomes unsuitable; decide per new customer |
| D. Private store repo + token in the URL | `https://<token>@github.com/...` on each HA | all change | token sits in every customer HA, unofficial, revocation breaks updates | rejected |

## 4. Public history: fresh, built by the publish script

Recommended: the new public repository starts with **one commit = the published tree of the cutover release**, then one
commit per release on top (fast-forward, so a "block force-push" ruleset holds). The alternative - pushing today's 15-commit
`addon` history - keeps the 1,424 backend test files in public history and gains nothing (the Supervisor hard-resets; history
is irrelevant to it).

`scripts/publish_public_addon.py` (brought over from the 2.40.7 branch, fixed here - section 9):

- reads the git objects of a `v*` tag (never the working tree), allow-list + a deny-list that refuses the run (exit 3), PEM key
  scan, `--forbid-env FILE` (repeatable; reports file:key names, never values), private-IPv4 scan (`--strict` = error), version
  gate tag = `config.yaml` = Dockerfile label, and now **every Dockerfile `COPY` source must be in the tree**;
- `--dry-run` writes nothing; `--out DIR` replaces everything except `.git/` in a clone of the public repository; it never
  commits or pushes.

## 5. Component by component

| Component | Today | After the cutover |
|---|---|---|
| Workstation clone `C:\cloude\smplwisebms` (+86 worktrees) | `origin` = public URL | `git remote set-url origin https://github.com/jonioliel/smplwise-arx-dev.git`; Git Credential Manager already holds the owner's GitHub login (needed for the private fetch); check `git ls-remote origin refs/tags/v2.53.0` |
| Store refresh worktree `C:\cloude\smplwise-addonbr` | worktree of the dev clone, pushes `addon` | **retired** (`git worktree remove` after the cutover is verified). Replaced by a separate clone `C:\cloude\smplwise-public` of the public repository: the only place with the public URL as `origin` |
| Runner `~/smplwisebms` (gate, nightly, `branch_check`, `asgi_wiskey_run`, `~/work/*` worktrees) | `origin` = public URL, anonymous fetch may be all it uses today | `set-url` to the private URL. A credential becomes mandatory: `gh auth status` must show a token with `repo` access (classic) or a fine-grained token that includes `smplwise-arx-dev` (contents: read; write if the runner pushes UI rebuild commits); `gh auth setup-git` |
| `~/gate2/*`, `~/release_gate.py`, `engine_sync.py`, `~/work/slotb.sh`, cron (nightly 03:00, prune Sun+Wed 05:00, push_watch) | name `origin` only | unchanged; confirm with `private_repo_readiness.py` on the runner (section 7) and one manual `nightly_tests.sh --dry-run` |
| Lab installer `~/lab1311/install_addon.py` | waits for `version_latest` from the store (lab follows `main` of the public URL = today the dev `main`) | unchanged code. Order changes: the version reaches the lab only after the **public** push (section 6) |
| Fresh runner install `private/runner/setup_ubuntu*.sh` | `REPO_URL` = public | private URL (local edit, not in git) |
| Second computer / test PC | `docs/operations/SECOND_COMPUTER_SETUP_HE.md` clones the public URL | private URL + "sign in to GitHub first" (docs commit after the cutover) |
| `management/upstream_watch.json` `our_repository` | public URL | keep the public URL (what users install) or set the private one; decide when the watch script is next touched (it reads GitHub anonymously) |
| ADR-014, `CR021_SELF_UPDATE_SECURITY_NOTES.md` | "one public repository" | new ADR (repository split) supersedes ADR-014's layout decision; CR-021 notes: the protection rules now live on the **public** store repository |
| Protection rules (CR-021 O9: block deletion + force-push on `main` and `v*`) | on the public `smplwise-bms` | the existing rules move with the rename to the private repo; GitHub enforces rulesets on a **private** repository of a personal account only on a paid plan (Pro), so on the free plan they stop being enforced there. The public store repo gets fresh rules (step 7) - that is the repository CR-021 protects. Owner decides whether the private repo needs Pro |
| Store metadata in the source (`repository.yaml`, `config.yaml` `url`, bridge `manifest.json` documentation/issue_tracker, `DOCS*.md`) | public URL | **unchanged** - correct by design |

## 6. The lead's release steps

Today (after the gate is green and the owner approved): `release_check.py`, `main` fast-forward + push, tag `vX.Y.Z` + push,
`#addon` refresh from `smplwise-addonbr`, `install_addon.py X.Y.Z` on the lab, read-only probe.

After the cutover:

```
# private repository - unchanged
python scripts/release_check.py --tag
git push origin main ; git tag -a vX.Y.Z ... ; git push origin vX.Y.Z

# public store repository - replaces the #addon refresh
python scripts/publish_public_addon.py --ref vX.Y.Z --dry-run --strict --forbid-env secrets/lab.env [--forbid-env secrets/<other>.env ...]
python scripts/publish_public_addon.py --ref vX.Y.Z --strict --forbid-env secrets/lab.env [...] --out C:\cloude\smplwise-public
cd C:\cloude\smplwise-public ; git status --short | head ; git diff --stat | tail -3     # review: only smplwise_vms/... changes
git add -A ; git commit -F ..\msg_public.txt            # "release: X.Y.Z" (UTF-8 without BOM)
git tag -a vX.Y.Z -F ..\msg_public.txt
git push origin HEAD:main HEAD:addon vX.Y.Z             # ONE push: both branches stay identical
git ls-remote origin main addon                         # same SHA twice

# lab - unchanged
~/smplwisebms/.venv/bin/python ~/lab1311/install_addon.py X.Y.Z ; read-only probe
```

The release document records both SHAs (private tag, public commit). The `#addon` line of the release checklist becomes
"public store commit `<sha>` (main = addon)".

## 7. Cutover - in order

Pick a quiet window: no gate, nightly, entry check or chain running; the previous release fully published; owner reachable.
The order keeps HA stores working for all but a few minutes: GitHub redirects the old name after the rename, so the clones
are repointed while everything still works, and the store is down only between "create public repo" and "first push".

| # | Who | Step | Check |
|---|---|---|---|
| 0 | owner | decisions on his page (delivery A, fresh history, window, Issues, rules on the private repo) | - |
| 1 | lead | dry-run checklist (section 10) complete; public tree of the current tag built into a scratch folder and build-checked on the runner | all ticks |
| 2 | owner | **rename** `smplwise-bms` -> `smplwise-arx-dev` (Settings -> General) | old URL redirects; HA store refresh still works (redirect) |
| 3 | lead | repoint every development clone: workstation, runner, second computer: `git remote set-url origin https://github.com/jonioliel/smplwise-arx-dev.git` ; `git fetch origin` ; `git ls-remote origin refs/tags/vX.Y.Z` ; then `python scripts/private_repo_readiness.py --expect-origin https://github.com/jonioliel/smplwise-arx-dev.git` (workstation) and `python3 scripts/private_repo_readiness.py --expect-origin ... --extra ~/gate2 --extra ~/work/slotb.sh --extra ~/lab1311 --extra ~/nightly_tests.sh --crontab` (runner) | exit 0 everywhere; no clone left on the old URL |
| 4 | lead | stop using `smplwise-addonbr` (do not delete yet); update `REPO_URL` in `private/runner/setup_ubuntu*.sh` | grep |
| 5 | owner | **create** the new public repository `jonioliel/smplwise-bms`, empty (no README / licence / .gitignore). The redirect ends here | anonymous page = empty repository |
| 6 | lead | `git clone https://github.com/jonioliel/smplwise-bms.git C:\cloude\smplwise-public` ; publish the current tag into it (section 6) ; push `HEAD:main HEAD:addon vX.Y.Z` | `git ls-remote` shows main = addon; anonymous shallow clone has no `docs/`, `scripts/`, `tests/`, `private/` |
| 7 | owner | public repo: rulesets (block deletion + force-push on `main`, `addon`, `v*`; restrict creation of any other branch), disable Wiki / Projects / Discussions / Actions, Issues per his decision. Only **after** step 6, because "restrict creation" would block the first push of `addon` | a test push of a stray branch name is refused |
| 8 | owner | **make `smplwise-arx-dev` private** (Settings -> General -> Danger zone) | anonymous `https://github.com/jonioliel/smplwise-arx-dev` = 404; lead: `git fetch` on workstation + runner still OK |
| 9 | lead (owner approves; lab install is the standing pre-approval only if he says so for this step) | lab: store refresh (`install_addon.py` path or Supervisor `store/reload`), then read: repository list, slug `0b8c26d5_smplwise_vms`, installed version unchanged, no repair notice | same add-on, same version |
| 10 | lead | M-center (`#addon`, slug `fd2db8b2_smplwise_vms`): read-only store state after its next refresh | `version_latest` = current, no repair |
| 11 | lead | next release through section 6; lab update from the store builds and starts | health = new version |
| 12 | lead | docs commit in the private repo: SECOND_COMPUTER_SETUP_HE, new ADR, CR-021 notes, release checklist, `upstream_watch.json` decision; then `git worktree remove C:\cloude\smplwise-addonbr` | reviewed merge |

If a store reports "repository is broken" after step 6: Settings -> System -> Repairs -> the repository's repair (reset/re-clone).
Never remove the store repository while the add-on is installed (that is an uninstall path).

## 8. Readiness check: `scripts/private_repo_readiness.py`

Read-only. Lists every hard-coded public URL / `#addon` / `addon` push / `smplwise-addonbr` reference in the tracked tree,
in extra untracked folders, in `crontab -l` (runner) and in the clones' remotes, and finds worktrees that hold the store
tree. Categories: CUTOVER (must change), REVIEW (docs to update), PUBLIC (must stay), HISTORY (receipts, never rewritten).
`--expect-origin URL` after step 3 fails (exit 1) on a clone whose `origin` differs. `--strict` exits 1 while CUTOVER items
remain. The runner was **not** scanned in this task (no remote access was used); step 3 runs it there.

Output on the workstation, 26.11, branch `chore/PRIVATE-REPO-PREP-2550` (= `v2.53.0` + this change), with the untracked
`private/runner` and `private/handoff-package` folders (lines of untracked files show only the matched token):

```
$ python scripts/private_repo_readiness.py --ref HEAD --extra ../smplwisebms/private/runner --extra ../smplwisebms/private/handoff-package   (exit 0, ~2 min)
private_repo_readiness: ref HEAD; extra ['../smplwisebms/private/runner', '../smplwisebms/private/handoff-package']; repos ['C:\\cloude\\smplwise-privrepo']
  add-on version at HEAD: 2.53.0
  tag v2.53.0: present (not HEAD)
  publish step scripts/publish_public_addon.py: present
  origin/addon (fetched copy): ba6e82452, add-on 2.53.0

== CUTOVER: 6 line(s) in 6 place(s)
  C:/cloude/smplwise-addonbr  [worktree] - app-store refresh worktree shares this clone's origin: retire it and refresh the store from a separate clone of the public repository
             addon-worktree               detached ba6e82452
  C:\cloude\smplwise-privrepo  [remote] - `remote.origin.url` = the public repository; repoint with `git remote set-url` (shared by 86 worktrees)
             remote                       https://github.com/jonioliel/smplwise-bms.git
  docs/operations/SECOND_COMPUTER_SETUP_HE.md  [tracked] - clone command for a new computer
         L14 public-url,repo-slug         3. שכפול הריפו: `git clone https://github.com/jonioliel/smplwise-bms.git`, מעבר לענף העבודה (`g0/intake`, או
  management/upstream_watch.json  [tracked] - our_repository: which repository the upstream watch reports on
       L3819 public-url,repo-slug         "our_repository": "https://github.com/jonioliel/smplwise-bms"
  private/runner/setup_ubuntu.sh  [extra] - runner setup: fresh clone URL must become the private repository
          L7 public-url,repo-slug         github.com/jonioliel/smplwise-bms, jonioliel/smplwise-bms
  private/runner/setup_ubuntu_all_in_one.sh  [extra] - runner setup: fresh clone URL must become the private repository
          L6 public-url,repo-slug         github.com/jonioliel/smplwise-bms, jonioliel/smplwise-bms

== REVIEW: 4 line(s) in 3 place(s)
  docs/architecture/ADR-014-repository-and-deployment.md  [tracked] - documentation
          L6 repo-slug                    - Owner created the public, empty GitHub repository `jonioliel/smplwise-bms` and wants to install the
  docs/security/CR021_SELF_UPDATE_SECURITY_NOTES.md  [tracked] - documentation
         L34 repo-slug                    | Supply chain: malicious release | an attacker who controls the store repository (`jonioliel/smplwise-bms`) or the owner's GitHub account pushes a release; eve
         L50 repo-slug                    2. A rule on `main` and on `v*` tags of `jonioliel/smplwise-bms`: block deletion and force-push. "Require a pull request" is NOT
  management/project.json  [tracked] - project metadata: repository link
         L46 public-url,repo-slug         "repository": "https://github.com/jonioliel/smplwise-bms (public; legacy code excluded by owner decision)"

== PUBLIC: 8 line(s) in 6 place(s)
  custom_components/smplwise_bridge/manifest.json  [tracked] - bridge documentation / issue_tracker links
          L5 public-url,repo-slug         "documentation": "https://github.com/jonioliel/smplwise-bms",
          L6 public-url,repo-slug         "issue_tracker": "https://github.com/jonioliel/smplwise-bms/issues",
  repository.yaml  [tracked] - store metadata; the public repository root carries it
          L2 public-url,repo-slug         url: https://github.com/jonioliel/smplwise-bms
  smplwise_vms/DOCS.md  [tracked] - install instructions for users
         L11 public-url,repo-slug         `https://github.com/jonioliel/smplwise-bms` → **Add**.
  smplwise_vms/DOCS_HE.md  [tracked] - install instructions for users
         L15 public-url,repo-slug         `https://github.com/jonioliel/smplwise-bms` ← **הוספה**.
  smplwise_vms/config.yaml  [tracked] - add-on url shown in the store
          L5 public-url,repo-slug         url: https://github.com/jonioliel/smplwise-bms
  smplwise_vms/integration/smplwise_bridge/manifest.json  [tracked] - bridge documentation / issue_tracker links
          L5 public-url,repo-slug         "documentation": "https://github.com/jonioliel/smplwise-bms",
          L6 public-url,repo-slug         "issue_tracker": "https://github.com/jonioliel/smplwise-bms/issues",

== SELF: 42 line(s) in 3 place(s)
     23  docs/operations/PRIVATE_REPO_MIGRATION.md
     18  scripts/private_repo_readiness.py
      1  scripts/publish_public_addon.py

== HISTORY: 53 line(s) in 20 place(s)
      1  PROJECT_BOARD.html
      1  docs/changes/BRIDGE-UPDATE-LISTENER-2401.md
      1  docs/changes/RELEASE-2438-TRAIN.md
      2  docs/changes/RELEASE-2439-TRAIN.md
      2  docs/changes/RELEASE-2440-TRAIN.md
      2  docs/changes/RELEASE-2450-TRAIN.md
      2  docs/changes/RELEASE-2460-TRAIN.md
      1  docs/changes/RELEASE-2470-TRAIN.md
      1  docs/changes/RELEASE-2500-TRAIN.md
      1  docs/changes/RELEASE-2510-TRAIN.md
      1  docs/changes/WISKEY-RESYNC-2520.md
      7  management/tasks.json
      1  management/tasks/RELEASE-2480-TRAIN.md
      1  management/tasks/RELEASE-2500-TRAIN.md
      1  management/tasks/RELEASE-2510-TRAIN.md
      2  private/handoff-package/READ_FIRST_2026-11-15.md
     20  private/handoff-package/READ_FIRST_2026-11-16-PM.md
      1  private/handoff-package/READ_FIRST_2026-11-16.md
      3  private/handoff-package/RESUME_PROMPT_2026-11-22.txt
      2  private/handoff-package/TEST_PC_PROMPT_HE.txt

SUMMARY: CUTOVER 6, REVIEW 4, PUBLIC 8, HISTORY 53
This check only reads; it changed nothing.
```

Reading: the 6 CUTOVER items are exactly the expected ones (workstation remote shared by 86 worktrees, the `smplwise-addonbr`
store worktree, the second-computer clone command, `upstream_watch.json`, the two runner setup scripts). The 8 PUBLIC lines must
stay. No runtime code, UI source, gate script, `engine_sync.py` or release script hard-codes the repository URL.

## 9. Fix to the publish script found by this preparation

The 2.40.7 `publish_public_addon.py`, run on `v2.53.0`, reported OK but its tree **would not build**: the Dockerfile now
copies `backend/constraints.txt` (PY-CONSTRAINTS-LOCK-2407) and `THIRD_PARTY_NOTICES.md` of the add-on folder, both missing
from its allow-list (found by comparing with the live `addon` branch: only those two, `.dockerignore` and
`backend/pyproject.toml` differed besides the tests). Fixed: both files and `.dockerignore` are allowed, and the script now
refuses (exit 3) when any Dockerfile `COPY`/`ADD` source is missing from the published tree. Negative check: the allow-list
without the two files -> `ERROR MISSING Dockerfile source backend/constraints.txt ...` and `... THIRD_PARTY_NOTICES.md ...`,
exit 3. `--forbid-env` is repeatable now (all `secrets/*.env`), reporting `file:key` only; checked with two scratch env files
(a value present in the tree -> exit 3 naming only `fake2.env:FAKE_B`; an absent value -> exit 0).

Dry run, `python scripts/publish_public_addon.py --ref v2.53.0 --dry-run --strict`: exit 0, **2,433 files, 52.9 MiB**, 0 source
maps (the build already archives them), no IPv4 warning. File list = the live `addon` branch minus `backend/tests` (1,424
files) and `backend/pyproject.toml`, plus the HACS bridge path (`hacs.json`, `custom_components/smplwise_bridge`, owner 3 א)
and the root `THIRD_PARTY_NOTICES.md`.

NOT_RUN here: `--forbid-env` against the real `secrets/*.env` (the lead runs it, step 1; this preparation does not read
`secrets/`); a Supervisor-style build of the published tree (no Docker on the workstation; on the runner: copy the published
tree into a scratch checkout together with `scripts/` of the tag and run `scripts/gate/addon_build_check.sh --root <it>`);
the store refresh on a real HA (steps 9-11 are the real check).

## 10. Dry-run checklist (everything before step 2, nothing external)

- [ ] Owner answered his page; this runbook merged (or at least the two scripts on `main`, so the runner has them)
- [ ] `python scripts/private_repo_readiness.py --extra private/runner` on the workstation: CUTOVER list = the expected 6
- [ ] same on the runner from `~/smplwisebms` with `--extra ~/gate2 --extra ~/work/slotb.sh --extra ~/lab1311 --extra ~/nightly_tests.sh --crontab`: no unexpected CUTOVER item (anything new is added to section 5 first)
- [ ] runner credential: `gh auth status` shows a token that will reach a **private** repository of the account (classic `repo` scope, or a fine-grained token listing all repositories / the renamed one); `git config --get-all credential.https://github.com.helper` set by `gh auth setup-git`
- [ ] workstation credential: `git credential-manager github list` (or a recent authenticated `git push`) shows the owner's account
- [ ] `publish_public_addon.py --ref <current tag> --dry-run --strict --forbid-env secrets/lab.env` (+ every other `secrets/*.env`): exit 0
- [ ] `--out` into a scratch folder; on the runner `addon_build_check.sh` on that tree (with `scripts/` of the tag): PASS
- [ ] the scratch tree contains no `docs/`, `scripts/`, `tests/`, `private/`, `*.map`, `pyproject.toml`; `repository.yaml` url = `https://github.com/jonioliel/smplwise-bms`
- [ ] read-only: list the store repositories of every HA we know runs Arx (lab, M-center, any other site) and note the URL form each uses (plain / `#addon` / other); an HA with another form needs its own plan
- [ ] no gate, nightly, entry check or chain is running; the cron jobs' next start is outside the window
- [ ] commit message files ready (UTF-8 without BOM) for the public first commit; `C:\cloude\smplwise-public` path free
- [ ] rollback (section 11) read by whoever executes

## 11. Rollback

| Point reached | Rollback |
|---|---|
| after 2 (renamed, still public), before 5 | rename back to `smplwise-bms`; `set-url` back on every clone: identical to today |
| after 5-6 (new public repo exists), store misbehaves | fix forward: republish from the tag (the public repo holds only generated content). Or: delete the new public repo, rename `smplwise-arx-dev` back to `smplwise-bms` (still public if step 8 not done), `set-url` back - today's state, incl. the `addon` branch which was never changed |
| after 8 (private), installs cannot update and the repair does not help | delete the new public repo, make the dev repo public again and rename it back - **re-publishes the history**: only on the owner's explicit decision. Interim alternative without re-publishing: keep the new public repo and push the old `addon` history to it (`git push <public> refs/remotes/origin/addon:refs/heads/addon refs/remotes/origin/addon:refs/heads/main --force` from a clone that still has it - needs the owner to lift the force-push rule for that one push) |
| runner cannot fetch after 8 | credential problem, not a repository problem: `gh auth login` / `gh auth setup-git` on the runner; the gate waits, nothing is lost |
| a development branch was pushed to the public repo by mistake | owner deletes that branch on GitHub at once (ruleset "restrict creation" should have refused it); treat its content as disclosed |
