# Rootless Podman on the test runner (task GT3)

Status 2026-10-06: installed and verified. Container runtime for the WisKey gate (images run with `--network=none`).

## What was changed on the runner
1. `apt-get install --no-install-recommends podman uidmap passt slirp4netns` (podman 4.9.3, crun 1.14.1, conmon; plus automatic dependencies: containernetworking-plugins, golang-github-containers-*, libslirp0, libyajl2, libsubid4, ...). One apt transaction (see `/var/log/apt/history.log`, 2026-10-06 12:21).
2. The package enabled root-level units `podman.socket` and `podman-auto-update.timer` (plus oneshot units). The script disabled `podman.socket` and `podman-auto-update.timer` (`systemctl disable --now`). Nothing else was touched.
3. As the test user: `~/.local/share/containers` (rootless storage, created on first use), `~/.cache/smplwise-podman/` (smoke-test rootfs tar) and the local image `localhost/smplwise-smoke:gt3`.

NOT changed: kernel sysctls (`user.max_user_namespaces=61892`, `kernel.unprivileged_userns_clone=1` were already fine; `kernel.apparmor_restrict_unprivileged_userns=1` stays, the Ubuntu podman package ships its own AppArmor profile so rootless works), `/etc/subuid` and `/etc/subgid` (the user already had 100000:65536), other projects' services, no reboot, no process killed.

## Run / re-run
`bash private/runner/setup_podman_rootless.sh [install|smoke|status|all]` (default `all`). Idempotent: installs only missing packages, adds subuid/subgid only if absent, refuses to install when load > 0.9 x cores. Needs passwordless sudo only for the apt/systemctl steps.

## Smoke test (no network)
Builds a local image from the host's bash/ls/cat (no registry pull), then checks: (1) `podman run --rm --network=none` runs a trivial command, (2) no non-loopback interface exists inside, (3) a TCP connect to a public address fails with "Network is unreachable" while the host has network, (4) `podman info` reports rootless.
Pattern for the gate: `podman run --rm --network=none --read-only --cap-drop=ALL --security-opt no-new-privileges <image> ...`.

## Undo
- Test image and storage: `podman rmi localhost/smplwise-smoke:gt3; rm -rf ~/.cache/smplwise-podman`; full wipe of all rootless data: `podman system reset -f` (or `rm -rf ~/.local/share/containers ~/.config/containers`).
- Units: restore package defaults with `sudo systemctl enable --now podman.socket podman-auto-update.timer` (not needed for rootless use).
- Packages: `sudo apt-get remove --purge podman passt slirp4netns uidmap && sudo apt-get autoremove` (uidmap/passt are tiny and may be used elsewhere; check `apt-cache rdepends --installed` first).
- Sysctl: none changed, nothing to undo. If a future kernel update requires it for rootless, the pre-approved change is `sudo sysctl kernel.apparmor_restrict_unprivileged_userns=0` (undo: set back to 1; persist only via /etc/sysctl.d/).

## Known notes
- Rootless `--network=none` needs no slirp4netns/passt; they are installed for the later case of controlled networks.
- Run under the shared flock protocol like any other test work; a container run is light but image builds are not.
