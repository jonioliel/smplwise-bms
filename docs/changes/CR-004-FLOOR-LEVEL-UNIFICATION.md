# CR-004 — Unify floors and levels into one connected building model

**Numbering:** registered as CR-004 on 2026-09-26 (CR-001 through CR-003 are already taken: HA identity/RBAC, the
lab-accounts deviation, Plan Studio).

**Status:** Proposed 2026-09-26. Owner intends to take this up soon, right after the current queue clears (the
background-image toggle, multi-select + tags + alignment tools, and the T054 intercom/access-control tab). Not
started; no design decisions below are binding until the owner signs off on an approach.

## The report that raised this (owner, 2026-09-26, translated)

The owner tried to build a real case — a sports hall whose floor sits on one building floor (`floor -1`) with a
tribune/gallery entered from another building floor (`floor 0`), the tribune rising from one metre above the
parquet to two metres below the ceiling, entered midway up. Building this with today's tools (a precise-elevation
level plus a hand-drawn connector cross-linked between the two floors) works mechanically, but the owner found the
whole area — level height settings, stairs, landings, and linking one floor to another — "not easy or accessible
yet," and asked Claude to look at how other tools solve this.

## What other tools do (researched 2026-09-26)

- **Revit** (professional BIM): Levels are datum planes the *entire* model shares. The stair tool spans two levels
  automatically; a landing is sketched at the midpoint, or created automatically where two flights meet. A
  "multistory stairs" command repeats one design up several levels by ctrl-clicking them in order, bottom to top.
- **SketchUp**: no built-in multi-story manager at all. A landing between two flights is modeled as "one big step"
  in the same file; multi-story convention is left to the user or a community extension.
- **Consumer floor-plan apps** (RoomSketcher, SpacePlanner, MagicPlan, Planner 5D): every level of one building
  lives in **one file**. SpacePlanner's own words: *"a level is a height, not a second drawing."* Placing a stair
  automatically punches the matching opening in the floor above; every level is visible together in 3D immediately.

## The gap in our own model

SMPLWISE VMS splits a building into:
- **A floor** (`buildings.floors` row): a *separate* plan version / geometry document, with its own plan image,
  its own `map.*` permissions, its own NVR camera/anchor scoping. Two floors are two independent documents.
- **A level** (`GeomLevel`, inside one floor's document): a cheap sub-division that shares the same document, the
  same canvas, the same 3D scene, the same coordinate space. Levels within one floor already have the easy
  experience the owner is asking for (0.1.93 made them fully editable).

None of the tools researched above have this split. Every vertical division of a building is a "level" in their
sense — ours calls the *same concept* two different things depending on an organizational boundary (floor) that
exists for reasons unrelated to architectural modeling: NVR channel scoping and per-area access control.

This is why cross-floor linking (a connector, "קשר לקומה") feels harder than same-floor level linking even though
both are conceptually "go from one height to another": a cross-floor connector crosses a document boundary that
carries permission and camera-scoping weight, so the tooling around it is inherently more cautious than
same-document level editing, and it cannot compute or draw across that boundary the way a same-document connector
does (see the two structural facts below).

## Two structural facts a fix has to reckon with

1. **No shared elevation datum across floors.** Each floor's levels carry `elevation_m` relative to *that floor's
   own* default level (0.0). Floor 0 and floor -1 have no automatic notion of "floor 0 sits 3.35 m above floor
   -1 in the real building" — that number is not computed or stored anywhere. Revit's levels are shared precisely
   *because* Revit has one model; ours does not.
2. **A cross-floor connector renders independently on each side.** `scene-builder.ts`'s `connectors()` draws a
   connector's rise using `level_to`'s elevation when it is set; once cross-floor-linked (`level_to` cleared by
   `geometry_store.link_connector`), each floor's own 3D scene draws its own segment up to *its own* ceiling height
   — there is nothing computing "reaches exactly floor 0's real height." No automatic floor opening is punched in
   the floor above either, unlike SpacePlanner's stair placement.

## Directions worth weighing (not decided)

A. **Give floors an optional shared elevation.** A building-level "floor 0 sits at +3.35 m absolute" field, filled
   in once per floor, lets a cross-floor connector's 3D rise and an eventual "floor opening" be computed exactly,
   without merging the documents themselves. Smallest structural change; keeps today's permission/NVR-scoping
   split intact.
B. **Let a connector auto-punch a floor opening in the target document**, the way SpacePlanner's stairs do,
   instead of just registering a twin connector. Needs (A) or an equivalent to know how big the opening should be
   and where.
C. **Blur the floor/level boundary further** — e.g. let a "floor" optionally *be* a level of a parent floor for
   modeling purposes while keeping its own permission/NVR scope for everything else. Closest to what the
   researched tools do; the biggest change, and the one most likely to need real thought about backward
   compatibility with existing floors/levels/anchors.

## Scope impact (draft, pending a real design pass)

Likely touches: `plan_geometry.py` (schema — an optional floor elevation field, connector validation), `db.py`
migrations, `geometry_store.py` (`link_connector`), `scene-builder.ts` (cross-floor 3D rise, an optional floor
opening), `plan-studio-panel.ts` / `explore-plan-editor.ts` (a floor-elevation input, wherever it belongs), and the
whole-building isometric preview. Size: comparable to one of the larger Plan Studio phases already shipped (T085
or T086) — a few agent days once a direction is chosen, not a single-session fix.

## Next step

A real design pass (brainstorm + a written proposal, in the manner `docs/architecture/PLAN_STUDIO_DESIGN_HE.md`
was written for CR-003) once the owner is ready to prioritize it — pick one of the directions above (or another),
work out the exact schema and migration, and size it properly before implementation starts.
