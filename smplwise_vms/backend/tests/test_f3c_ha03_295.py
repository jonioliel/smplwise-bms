"""F3C-295 HA-03: the pairing-code row shows a "replaced by a key rotation" text, not a bare dash, when the API answers pairing_code null.
Source pin (the screen is Lit; the rendering spec belongs to the Playwright suite)."""
from pathlib import Path

SCREEN = Path(__file__).resolve().parents[3] / "frontend" / "src" / "screens" / "system-diagnostics.ts"


def test_null_pairing_code_shows_the_rotation_text_not_a_dash():
    src = SCREEN.read_text(encoding="utf-8")
    assert "p.pairing_code === null ? '—'" not in src
    assert "data-pairing-replaced" in src and "Key rotation" in src
    # the reveal / copy controls only exist on the branch that has a code
    branch = src.split("p.pairing_code === null ?", 1)[1].split("</span></div>", 1)[0]
    assert branch.index("data-pairing-replaced") < branch.index("this.copyCode()")
