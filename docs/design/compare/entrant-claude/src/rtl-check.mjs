// Reading-direction check, run in the real browser on every rendered board (build.mjs) or on demand
// (node inspect.mjs rtl --skin=<id>). Fails the build when:
//   - a chevron points against the reading direction: `.ic-fwd` must point to the inline-end (left in RTL, right in LTR),
//     `.ic-back` to the inline-start; a chevron with neither class must be rotated (a drop-down ▾), otherwise it is an
//     undeclared directional glyph;
//   - a slider / progress fill does not start at the inline-start edge of its track, or the slider thumb is not centred
//     on the end of the fill.
// The check reads computed transforms and boxes, so it sees exactly what the PNG shows.

export const readingDirectionIssues = () => {
  const out = [];
  const visible = (el) => el.getClientRects().length > 0;
  const dirOf = (el) => (el.matches(':dir(rtl)') ? 'rtl' : 'ltr');
  const where = (el) => {
    const card = el.closest('[class]');
    const txt = (el.closest('a,button,h3,.tile,.room,.lrow,.fbtn,.select,.details') || card)?.textContent.trim().replace(/\s+/g, ' ').slice(0, 40);
    return `${card ? '.' + [...card.classList].slice(0, 3).join('.') : el.tagName} “${txt || ''}”`;
  };
  // rotated on itself or on one of the next three ancestors (fbtn / select / a wrapper span)
  const rotated = (el) => { let n = el; for (let i = 0; i < 4 && n && n !== document.body; i++, n = n.parentElement) { const cs = getComputedStyle(n); if (cs.rotate !== 'none' || (cs.transform !== 'none' && new DOMMatrix(cs.transform).b !== 0)) return true; } return false; };

  for (const svg of document.querySelectorAll('svg[data-ic="chevron"]')) {
    if (!visible(svg)) continue;
    const dir = dirOf(svg);
    const kind = svg.classList.contains('ic-fwd') ? 'fwd' : svg.classList.contains('ic-back') ? 'back' : null;
    if (!kind) { if (!rotated(svg)) out.push({ kind: 'undeclared chevron (no fwd/back, not rotated)', dir, at: where(svg) }); continue; }
    const m = new DOMMatrix(getComputedStyle(svg).transform);
    const pointsRight = m.a > 0; // the path points right; scaleX(-1) flips it
    const shouldPointRight = (kind === 'fwd') === (dir === 'ltr');
    if (pointsRight !== shouldPointRight) out.push({ kind: `chevron ${kind} points ${pointsRight ? 'right' : 'left'} in ${dir}`, dir, at: where(svg) });
  }
  for (const s of document.querySelectorAll('.slider')) {
    if (!visible(s)) continue;
    const dir = dirOf(s);
    const t = s.querySelector('.track').getBoundingClientRect(), f = s.querySelector('.fill').getBoundingClientRect(), th = s.querySelector('.thumb')?.getBoundingClientRect();
    const start = dir === 'rtl' ? t.right : t.left, fStart = dir === 'rtl' ? f.right : f.left, fEnd = dir === 'rtl' ? f.left : f.right;
    if (Math.abs(fStart - start) > 1.5) out.push({ kind: `slider fill does not start at the inline-start (${dir})`, dir, at: where(s) });
    if (th && Math.abs((th.left + th.right) / 2 - fEnd) > 2.5) out.push({ kind: `slider thumb off the fill end by ${Math.round((th.left + th.right) / 2 - fEnd)}px (${dir})`, dir, at: where(s) });
  }
  for (const b of document.querySelectorAll('.bar-ind')) {
    if (!visible(b)) continue;
    const dir = dirOf(b);
    const t = b.getBoundingClientRect(), f = b.querySelector('i').getBoundingClientRect();
    if (Math.abs((dir === 'rtl' ? f.right - t.right : f.left - t.left)) > 1.5) out.push({ kind: `progress fill does not start at the inline-start (${dir})`, dir, at: where(b) });
  }
  return out;
};

// Run the check on an open Playwright page; returns the issue list.
export async function rtlIssues(page) {
  return page.evaluate(readingDirectionIssues);
}

export function formatIssues(file, issues) {
  return issues.map((i) => `  RTL ✗ ${file}: ${i.kind} — ${i.at}`).join('\n');
}
