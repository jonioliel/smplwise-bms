# Local task runner (T073, optional)

`scripts/task_runner.py` dispatches **one** invocation of a local coding CLI per task card, and refuses to run
unless every gate holds. It is a tool for the technical lead, not a product feature, and it never simulates work.

```bash
python scripts/task_runner.py validate --cli claude
python scripts/task_runner.py run T065 --cli claude --model claude-sonnet-5 --effort medium --workspace . --budget-usd 5 --timeout-s 1800 --dry-run
python scripts/task_runner.py run T065 --cli claude --model claude-sonnet-5 --effort medium --workspace . --budget-usd 5 --timeout-s 1800
python scripts/task_runner.py stop T065
python scripts/task_runner.py status T065
```

Gates, in order:

1. **CLI validation** — the executable must answer `--version`; otherwise nothing is dispatched (`cli_invalid`).
2. **Dependency gate** — the card's dependencies must be `DONE` (`--gate evidence` accepts dependencies that
   carry evidence but are still BACKLOG, which is this project's pre-acceptance state).
3. **Attempt cap** — after `--max-attempts` (default 2) failed runs the task is `needs_review`: a person decides,
   nothing retries on its own.
4. **Workspace allowlist** — the workspace must be inside the repository and outside `secrets/`,
   `private-evidence/`, `legacy/`, `data/`, `.git/`; the prompt repeats the rule to the CLI, and files the run
   changed under a denied prefix are reported as `violations`.
5. **Budget** — a positive budget per run, capped at 25 USD, recorded in the invocation; the runner cannot
   authorise spend and has no purchase path.

While a run is active a hard `--timeout-s` terminates it, and a `STOP` file in the run directory (or
`task_runner.py stop <task>`) stops it by hand. Every run leaves `management/runs/<task>/<run id>/` with
`prompt.md`, `invocation.json`, `run.log` and `result.json` (schema `smplwise-task-run/1`: task, run id, CLI
version, model, effort, workspace, budget, timing, exit code, timed out, stopped by, changed files, violations,
the CLI's own `RESULT:` JSON report, status). `management/runs/` is a working directory: commit a run only when
it is evidence for a card.

The invocation template is a JSON argv list with placeholders `{cli} {model} {effort} {prompt} {prompt_file}
{workspace}`; the default is `["{cli}", "--print", "--model", "{model}", "{prompt}"]`.

Known limits: the runner observes writes through `git status` after the fact — it cannot sandbox the CLI; cost is
whatever the CLI reports, the runner only bounds the declared budget and the number of attempts.
