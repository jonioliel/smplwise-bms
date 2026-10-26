"""BUSTIMES-295: nearby public-transport times on the notice board (scheduled times only in v1; real-time is a later pilot).

Layers: `stride` (the Open Bus Stride client), `catalogue` (the nightly local stop catalogue), `poller` (one background loop,
de-duplicated by stop code), `digest` (what a board is told), `model` (settings). Nothing on a screen depends on the third party live:
the screen reads a digest of OUR cache, which carries its own age."""
