# ADR-014 — Repository layout and deployment path
Status: approved (owner, 2026-09-14: git install from the public repo, legacy stays local)
Owner / date / linked tasks / requirements: Claude Code / 2026-09-14 / T009, T010, T036 / R017–R020

Context and evidence:
- Owner created the public, empty GitHub repository `jonioliel/smplwise-bms` and wants to install the
  add-on in HA directly from it. Supervisor add-on repositories and HACS both require public git access.
- Legacy code (v1.5.27) must not be published (owner decision 3ג); it lives on the local branch
  `legacy/import` and in the owner's zip.
- Lab HA host is an Intel i7 machine (amd64), so local image builds by the Supervisor are acceptable.
- No Docker on the development workstation; Python 3.12 and Node 24 are installed.

Alternatives considered:
1. Separate repositories per artifact — more release ceremony, harder traceability. Rejected for now.
2. Prebuilt images from day one — needs CI before anything runs. Deferred to the pilot release gate.
3. **Chosen:** one repository that is simultaneously a Supervisor add-on repository, a HACS-compatible
   integration repository and the planning kit.

Decision and rationale — layout:
```
repository.yaml                     # Supervisor add-on repository metadata
smplwise_vms/                       # add-on: config.yaml, Dockerfile, build.yaml, DOCS.md, backend, built UI
custom_components/smplwise_vms/     # thin HA bridge integration (HACS-compatible), hacs.json at root
frontend/                           # TypeScript + Lit + Vite source; build output copied into the add-on
contracts/ docs/ management/ prompts/ scripts/ templates/   # planning kit (unchanged structure)
secrets/ private-evidence/          # gitignored
```
Phase 1: Supervisor builds the add-on locally from `Dockerfile` (no `image:` key); the built frontend is
committed so no Node is needed on the HA host. Phase 2 (before pilot release): GitHub Actions builds
multi-arch images to GHCR and `config.yaml` gains `image:`; installs become pull-only.

Effects on API, data, UX, permissions and operations:
- Branches: `main` (reviewed merges), `g0/…`, `pilot/T0xx-…`; owner installs from `main` only.
- Nothing private in the repository: no lab addresses, serials, credentials, floor plans or camera frames;
  redaction is part of every fixture pipeline.
- Development loop: backend and Vite dev server run on the workstation against the lab NVR/go2rtc;
  Ingress/identity tests run on the HA host by installing the add-on from the repository (or as a local
  add-on via SSH once available).

Validation evidence / rollback: T009 — the add-on installs and starts from the repository on the lab HA;
rollback by uninstalling the add-on and integration (legacy add-on untouched).

Approver / supersedes: owner 2026-09-14 / detail for ADR-001.
