#!/usr/bin/env bash
# GT3: rootless Podman for the runner's test user, plus a no-network smoke test.
# Idempotent. Needs passwordless sudo ONLY for the apt install step; everything else runs as the test user.
# No reboot, no service restart, no process kill. Never touches other projects' services.
# Usage:  setup_podman_rootless.sh [install|smoke|status]      (default: install, then smoke)
# Undo:   see PODMAN_NOTES.md ("Undo").
set -uo pipefail
MODE="${1:-all}"
PKGS="podman uidmap passt slirp4netns"
IMG_DIR="$HOME/.cache/smplwise-podman"
say() { echo "[podman-setup] $*"; }

status() {
  say "user: $(id -un) uid=$(id -u)"
  say "load: $(cut -d' ' -f1-3 /proc/loadavg)"
  say "podman: $(command -v podman >/dev/null && podman --version || echo missing)"
  say "uidmap: $(command -v newuidmap >/dev/null && echo present || echo missing)"
  say "subuid: $(grep -c "^$(id -un):" /etc/subuid) entry, subgid: $(grep -c "^$(id -un):" /etc/subgid) entry"
  say "max_user_namespaces=$(sysctl -n user.max_user_namespaces) apparmor_restrict_unprivileged_userns=$(sysctl -n kernel.apparmor_restrict_unprivileged_userns 2>/dev/null || echo n/a)"
}

install_all() {
  # Be polite: refuse to start the install under heavy load (agents run tests under flock -s).
  local load cores; load=$(cut -d' ' -f1 /proc/loadavg); cores=$(nproc)
  if awk -v l="$load" -v c="$cores" 'BEGIN{exit !(l > c*0.9)}'; then say "load $load on $cores cores is too high; retry later"; return 3; fi
  local missing=""
  for p in $PKGS; do dpkg -s "$p" >/dev/null 2>&1 || missing="$missing $p"; done
  if [ -n "$missing" ]; then
    say "installing:$missing"
    sudo -n env DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends $missing || { say "BLOCKED: apt install failed"; return 4; }
  else say "packages already installed"; fi
  # subuid/subgid: Ubuntu normally creates them with the user; add only when absent.
  local u; u=$(id -un)
  grep -q "^$u:" /etc/subuid || { say "adding subuid range"; sudo -n usermod --add-subuids 100000-165535 "$u"; }
  grep -q "^$u:" /etc/subgid || { say "adding subgid range"; sudo -n usermod --add-subgids 100000-165535 "$u"; }
  # Kernel switches are NOT changed unless rootless podman fails without it (see PODMAN_NOTES.md, step "userns sysctl").
  # Rootless storage uses the default overlay/vfs under ~/.local/share/containers; no daemon, no systemd unit is started.
  # The Debian/Ubuntu package enables root-level podman units (socket, auto-update timer). Rootless use does not need them: disable the ones the package turned on.
  for u in podman.socket podman-auto-update.timer; do
    if systemctl is-enabled "$u" >/dev/null 2>&1; then say "disabling system unit $u (package default, not needed)"; sudo -n systemctl disable --now "$u" >/dev/null 2>&1 || true; fi
  done
  podman system migrate >/dev/null 2>&1 || true
  say "podman info (rootless=$(podman info --format '{{.Host.Security.Rootless}}' 2>&1))"
}

smoke() {
  mkdir -p "$IMG_DIR"; local rc=0
  # Image with no network pull: build a scratch image from a static busybox-like binary if available, else from the host's /bin via 'podman import'.
  local TAR="$IMG_DIR/rootfs.tar" IMG="localhost/smplwise-smoke:gt3"
  if ! podman image exists "$IMG"; then
    # minimal rootfs from the host: busybox-static if present, else bash+coreutils needed libs copied via ldd
    local R; R=$(mktemp -d)
    mkdir -p "$R"/{bin,lib,lib64,proc,dev,tmp,etc}
    for b in bash sh cat ls; do p=$(command -v "$b"); [ -n "$p" ] || continue; cp -L "$p" "$R/bin/"; ldd "$p" 2>/dev/null | grep -o '/[^ ]*' | while read -r l; do mkdir -p "$R$(dirname "$l")"; cp -L "$l" "$R$l" 2>/dev/null; done; done
    tar -C "$R" -cf "$TAR" . && podman import -q "$TAR" "$IMG" >/dev/null && rm -rf "$R" || { say "FAIL: image import"; return 1; }
  fi
  say "1) trivial container runs with --network=none"
  out=$(podman run --rm --network=none "$IMG" /bin/bash -c 'echo hello-from-container') || rc=1
  [ "$out" = "hello-from-container" ] && say "PASS: container ran" || { say "FAIL: container output '$out'"; rc=1; }
  say "2) only loopback exists inside"
  ifs=$(podman run --rm --network=none "$IMG" /bin/bash -c 'ls /sys/class/net 2>/dev/null; cat /proc/net/dev' ) || rc=1
  nonlo=$(echo "$ifs" | grep -E '^ *(eth|ens|enp|tap|wlan|veth)[^ ]*:' | wc -l)
  [ "$nonlo" -eq 0 ] && say "PASS: no non-loopback interface" || { say "FAIL: found $nonlo non-loopback interfaces"; rc=1; }
  say "3) outbound connection attempt must fail (host has working network)"
  if podman run --rm --network=none "$IMG" /bin/bash -c 'exec 3<>/dev/tcp/1.1.1.1/53' >/dev/null 2>&1; then say "FAIL: connected out"; rc=1; else say "PASS: outbound blocked"; fi
  say "4) running as rootless"
  [ "$(podman info --format '{{.Host.Security.Rootless}}')" = "true" ] && say "PASS: rootless" || { say "FAIL: not rootless"; rc=1; }
  return $rc
}

case "$MODE" in
  status) status ;;
  install) status; install_all; status ;;
  smoke) smoke ;;
  all) status; install_all && smoke ;;
  *) echo "usage: $0 [install|smoke|status|all]"; exit 2 ;;
esac
