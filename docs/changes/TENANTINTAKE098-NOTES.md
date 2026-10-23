# TENANTINTAKE098-295 - free-text request intake, phases 1-3 (notes)

Branch `pilot/TENANTINTAKE098-295` (base v2.14.0). Design record: `docs/changes/CR-INTAKE99.md` (commit 3d512ecee on `pilot/INTAKE99-295`).
Owner answers: `private/planning/OWNER_ANSWERS_2026-10-24_batch2_notes.md` (143-156) and `..._batch3_notes.md` (267).

## What is built (OFF by default)

- `intake_rules.py` + `intake_seed_he.json`: the pure, rule-based Hebrew extractor (no model, no network). Abstains below medium confidence.
- Migration **0170** (built as provisional 0198; renumbered at the 2.16.0 integration, release/2160): `ticket_intake_known`, `_drafts`, `_lexicon`, `_feedback`, `_blocks`, `_unlisted`,
  `ticket_inbound.intake_draft_id`, and a rebuild of `ticket_outbox` that only adds the purpose `intake_reply`.
- `intake.py` + `routers/tickets_intake.py` (`/api/v1/tickets/intake/...`, operator side only, no public route): the inbound hook, caps,
  coalescing, drafts, edit / approve (through `create_ticket`, origin `inbound`, with a "needs review" note) / attach (by number) /
  reject (+ 30-day block), the managed list, the configurer's lexicon rows, retention and the daily summary.
- Permission `tickets.intake` (sensitive, role `tickets_intake`); system administrators by role, department managers implicitly (owner 143).
- Settings block `intake.*` (switches, default department, every cap and retention value; `system.configure`, audited).
- Notification sources `ticket.intake_new` (counts / urgency only) and `ticket.intake_unlisted` (daily count).
- UI: `tickets-intake-chip` (queue, five rows a page, no scrolling), `tickets-intake-settings` (settings + the managed list), Hebrew i18n.

## Owner answers as implemented

| # | Answer | Implementation |
|---|---|---|
| 143 | nobody by default; grant by name; managers and system admins automatic | `may_handle`: `tickets.intake` or a department manager; the list needs `tickets.intake` held explicitly or `tickets.configure` |
| 144 | reply only after approval: one message with the number | `intake_reply` / `starter:intake_approved`, only after approval, `intake.approval_reply` |
| 145, 147, 148 | web form code, status link, photos | NOT BUILT - public parts (answer 156) |
| 146 | known numbers only; unlisted must ask to be added; no self-registration | `ticket_intake_known`, managed in Settings; no registration route |
| 149 | free text only | no category picker; the handler corrects the suggestion |
| 150 | previous place as a weak hint | NOT BUILT (verified requesters only - needs the public/verified slice) |
| 151 | never add automatically to the directory | the list is its own table |
| 152 | numbers outside the backup | the new tables are not in `backup` |
| 153 | privacy notice to the lawyer pack | not part of phases 1-3; no notice text is shipped |
| 154 | no ETA | none shown |
| 155 | existing requests number, editable | the inbound account filter of the tickets module is unchanged (the tickets uses mapping decides) |
| 156 | phases 1-3 only | this branch |
| 267 | unlisted number: one fixed reply, no draft, daily summary to the list manager | `starter:intake_unlisted`, `ticket_intake_unlisted`, `ticket.intake_unlisted` |

## Deliberate narrowings (recorded, not silently resolved)

- Place: the extractor fills an organisation location (`location_id`) and the free-text place; it does not resolve floor / zone ids of the plan.
- A seed domain is mapped to a category by the configurer (`ticket_intake_lexicon` kind `domain_map`); `ticket_categories.domains_json` is not reused.
- The corpus is synthetic and has ~75 rows, below the record's 300; the gate numbers are the record's, applied to it.
- A message over 1000 characters is dropped by the existing inbound rule (`too_long`) before intake sees it.
- The unlisted reply and the approval reply use the number held in memory (unlisted) or on the list row (approved). A restart between queueing and sending loses an unlisted reply (`target_lost`).
- Recipients of the two sources are the notification policy's `managers`; there is no separate recipient list in the intake settings.

## Collision risk

The migration rebuilds `ticket_outbox` (same columns and indexes as 0128) only to add `intake_reply` to the purpose CHECK. Any other open branch that
rebuilds `ticket_outbox` must be folded by the integrator (union of the purpose lists); the code touches `outbox.py`, `channel.py`, `hours.py` and
`message_templates.py` for the purpose.
