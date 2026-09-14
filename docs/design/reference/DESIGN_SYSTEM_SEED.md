# Design System Seed

## Product personality
Calm, precise, premium, fast, spatial, trustworthy.

## Visual direction
- White / very light gray application surfaces.
- Dark neutral text with restrained blue interaction accents.
- Rounded cards and panels with subtle elevation.
- Dense information should be grouped, not visually heavy.
- Use color primarily for state, alert severity and interactive focus.
- Floor-plan overlays must remain legible above architectural drawings.

## Core interaction patterns
- Click camera marker -> instant live preview.
- Open/expand -> full live view.
- Playback -> timeline anchored to the selected camera/time.
- Multi-select cameras -> synchronized playback on one shared timeline.
- Click HA entity -> compact contextual control popover.
- Incident -> related cameras, entity events, notes and evidence export.

## Floor plan normalization
AI may analyze plans, but the product renderer owns the visual style. Preferred pipeline:
`PDF/PNG/JPG/SVG -> semantic extraction -> canonical geometry/schema -> SMPLWISE renderer`.
Do not use image-generation output as authoritative geometry.
