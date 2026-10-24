/**
 * NOTICEPUSH-295 slice L: the approved SmplWise logo (private/review/logos-mockup-v3.html, symbols #sw-mark, #sw-word, #sw-word-dark) as
 * plain SVG markup strings, for the surfaces that draw HTML by string and cannot use the `<sw-brand>` component: the notice-board TV
 * bundle (src/notice-tv, a separate entry that reaches no other file). The app shell draws the same artwork through
 * components/sw-brand.ts (LOGOFIT-295); a unit test keeps the two copies identical.
 *
 * Light surface: blue tile mark #2767ed, "Smpl" grey, "Wise" #2767ed. Dark surface: "Smpl" #ffffff, "Wise" #8fb2ff. The word is set in
 * Heebo (the product's own font; 700 is the heaviest weight the application ships).
 */
export const SW_MARK_INNER =
  '<rect width="64" height="64" rx="14" fill="#2767ed"/><path d="M43 22c-2.4-3-6.2-4.6-10.6-4.6-6.6 0-11 3.5-11 8.6 0 10.8 22 5.3 22 16.4 0 5.6-4.9 9.2-12.2 9.2-5.2 0-9.4-1.9-12.2-5.2" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/><circle cx="46" cy="44" r="3.2" fill="#8fe1ff"/>';

/** The light scheme's "Smpl" (the muted text tier of the design tokens, --sw-text-3 on light). */
export const SW_SMPL_GREY = '#5e6d88';

export function swMarkSvg(alt = ''): string {
  return '<svg class="sw" viewBox="0 0 64 64" width="64" height="64" ' + (alt ? 'role="img" aria-label="' + alt + '"' : 'role="presentation" aria-hidden="true"') +
    ' data-brand-img="product" data-brand-art="mockup-v3-mark">' + SW_MARK_INNER + '</svg>';
}

export function swWordSvg(dark: boolean, alt = ''): string {
  return '<svg class="sw" viewBox="0 0 236 64" width="236" height="64" ' + (alt ? 'role="img" aria-label="' + alt + '"' : 'role="presentation" aria-hidden="true"') +
    ' data-brand-img="product" data-brand-art="' + (dark ? 'mockup-v3-word-dark' : 'mockup-v3-word') + '">' + SW_MARK_INNER +
    '<text x="76" y="45" direction="ltr" text-anchor="start" font-family="Heebo, Inter, Segoe UI, Arial, sans-serif" font-size="34" font-weight="800" letter-spacing="-1" fill="' +
    (dark ? '#ffffff' : SW_SMPL_GREY) + '">Smpl<tspan fill="' + (dark ? '#8fb2ff' : '#2767ed') + '">Wise</tspan></text></svg>';
}
