# Recorder credentials in the ffmpeg process list (accepted limit)

Status: **accepted limit, no code change** (code review 2026-11-13, finding 03:F27; branch `pilot/CR-DOCS-REGISTERS-2440`).
The review proposed recording it; the product owner can revoke the acceptance at any time. Review again when one of the
triggers at the end applies.

## What is exposed

A Provision-ISR export downloads the recording with ffmpeg over RTSP
(`smplwise_vms/backend/smplwise/services/recorders/provision_playback.py`, `rtsp_download`). The input address is built by
`export_url` from the recorder's current connection and has the form `rtsp://<user>:<password>@<host>:<port>/<request>`
(user and password percent-encoded). ffmpeg takes its input as a command-line argument (`-i <address>`), so for as long as
the download runs the complete address, **including the recorder's user name and password**, is part of the process's
argument list and can be read by anything that can list processes in the same PID namespace (`ps`, `/proc/<pid>/cmdline`).

Duration: one download at a time (the export worker runs one job), for the length of that download; bounded by the
3,600 s limit of `rtsp_download`.

An ffmpeg call that reads from standard input or from a local file (the Provision snapshot conversion in the same module,
the export post-processing in `services/exports.py`) does not carry an address. Any future ffmpeg call whose input is a
credentialed RTSP address has the same exposure and falls under rule 2 below.

## Who can read it

- Code running **inside the add-on container** (the backend and its own child processes). It already holds the same
  credentials: the backend reads them from its settings to build the address.
- **Root on the host** (the host shell, a privileged add-on). Such a party can also read the add-on's data directory, where
  the connection settings are stored.
- **Not** other add-ons in normal operation: the add-on does not ask for the host PID namespace (`host_pid` is not set in
  `smplwise_vms/config.yaml`), so its processes are not visible from another container.

So the process list gives nobody a credential they could not already reach. What it changes is how *easily* the credential
is seen: a process listing, a support screenshot, a diagnostics dump of the host.

## What is already done

- The address never reaches a log, an error or an API answer: `rtsp_download` replaces the address, the password, the user
  and the host in ffmpeg's error text before it is raised.
- The child gets a minimal environment (`services/child_env.minimal_env`), so no secret travels in environment variables.
- The input protocol is restricted (`-protocol_whitelist rtsp,rtp,tcp,udp`).
- A stored export row never supplies credentials: `export_url` reduces an old full address to its device request and takes
  user and password from the current connection.

## Why it is accepted

It is inherent to ffmpeg's RTSP input: the address is an argument. Alternatives considered:

| Alternative | Why not now |
|---|---|
| Pass the address through an options file with mode `0600` | Depends on the ffmpeg build in the add-on image accepting its input that way; not checked on the image (NOT_RUN). The file would hold the same secret on disk for the same time. |
| Let go2rtc proxy the download | The Provision `backup` request is a one-off, paced download, not a live stream; a larger change with its own risks. |
| An RTSP client inside the backend process | A new protocol implementation inside the security boundary for a small gain. |

## Rules that follow

1. Never paste a process listing, a `docker top` output or a host diagnostics dump of a running system into a ticket, a
   chat, a commit, a fixture or a document without redacting RTSP addresses. Same rule as for the values of
   `secrets/lab.env`.
2. New code that starts a child process with a credential on its command line gets a line in this document, or avoids it.
   Moving the credential into the child's environment is not an improvement.
3. Error text of such a child is scrubbed before it is logged or returned, as `rtsp_download` does.
4. Use a dedicated recorder account with the least rights the export needs, not the recorder's administrator account
   (operational advice; the code does not enforce it).

## Review triggers

- The add-on starts to need `host_pid`, or a process of a different trust level is added to the container.
- The ffmpeg in the image is shown to accept the input address from a protected options file (then prefer that).
- A recorder adapter appears whose only account is an administrator account.
