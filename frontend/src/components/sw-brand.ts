import { LitElement, html, svg, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { onDesign, resolvedTheme } from '../design/apply';
import { brandLogo, chooseCompanyLogo, companyLogoUrl, installerLogoUrl, logoScale, onBrandLogo, type BrandLogoState, type DarkMode, type LogoSize } from '../design/brand-logo';
import { t } from '../i18n/he';

/** LOGOFIT-295: the approved mockup's SmplWise mark (#sw-mark, logos-mockup-v3.html), drawn as-is. */
const MARK = svg`<rect width="64" height="64" rx="14" fill="#2767ed"/><path d="M43 22c-2.4-3-6.2-4.6-10.6-4.6-6.6 0-11 3.5-11 8.6 0 10.8 22 5.3 22 16.4 0 5.6-4.9 9.2-12.2 9.2-5.2 0-9.4-1.9-12.2-5.2" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/><circle cx="46" cy="44" r="3.2" fill="#8fe1ff"/>`;

function swMark(alt: string) {
  return html`<svg class="sw" viewBox="0 0 64 64" width="64" height="64" role=${alt ? 'img' : 'presentation'} aria-label=${alt || nothing} data-brand-img="product" data-brand-art="mockup-v3-mark">${MARK}</svg>`;
}

/** LOGOFIT-295: the approved mockup's SmplWise wordmark (#sw-word on a light background, #sw-word-dark on a dark one), drawn as-is. */
function swWord(alt: string, dark: boolean) {
  return html`<svg class="sw" viewBox="0 0 236 64" width="236" height="64" role=${alt ? 'img' : 'presentation'} aria-label=${alt || nothing} data-brand-img="product" data-brand-art=${dark ? 'mockup-v3-word-dark' : 'mockup-v3-word'}>${MARK}${svg`<text x="76" y="45" direction="ltr" text-anchor="start" font-family="Heebo, Inter, Segoe UI, Arial, sans-serif" font-size="34" font-weight="800" letter-spacing="-1" fill=${dark ? '#ffffff' : 'currentColor'}>Smpl<tspan fill=${dark ? '#8fb2ff' : '#2767ed'}>Wise</tspan></text>`}</svg>`;
}

/**
 * CR-LOGOS295 4.4: ONE logo component for every placement. `<sw-brand kind="company|product">` draws the installation's company logo or
 * the SmplWise logo at `h` pixels (the placement's base height; the administrator's size scale multiplies it - `logo_size`), and swaps
 * file / treatment when the scheme changes, without a reload.
 *
 *  - kind=company: nothing at all (the slot collapses, nothing shifts) until a company logo is uploaded; then the file of
 *    `chooseCompanyLogo` (light file / dark file / light file on a light plate / the administrator-chosen invert);
 *  - kind=product: the SmplWise logo (`mark` draws the square mark instead). Teal artwork that reads on both schemes - no treatment;
 *  - `scheme` forces a scheme (the notice-board TV is always dark; the Settings preview draws both side by side); default = the scheme
 *    in force; `mode` / `size` / `state` overrides serve the Settings card's live preview of an unsaved choice;
 *  - `decorative` = `alt=""` + aria-hidden (a placement that already carries the text "SmplWise Arx"); otherwise the company logo's alt
 *    is the company name and the product logo's alt is "SmplWise Arx".
 * Sized by a block-size box and `object-fit: contain`; never stretched, never mirrored (an <img> is not mirrored by dir).
 */
@customElement('sw-brand')
export class SwBrand extends LitElement {
  @property({ reflect: true }) kind: 'company' | 'product' | 'installer' = 'company';
  /** base height in px at the medium size */
  @property({ type: Number }) h = 36;
  /** base maximum width in px at the medium size (0 = none beyond the container) */
  @property({ type: Number }) maxw = 0;
  @property() scheme: 'auto' | 'light' | 'dark' = 'auto';
  @property({ type: Boolean }) mark = false;
  @property({ type: Boolean }) decorative = false;
  /** live preview of an unsaved choice */
  @property({ attribute: false }) previewMode?: DarkMode;
  @property({ attribute: false }) previewSize?: LogoSize;
  @property({ attribute: false }) previewState?: Partial<BrandLogoState>;

  @state() private theme = resolvedTheme();
  @state() private brand = brandLogo();
  private off: (() => void)[] = [];

  static styles = css`
    :host {
      display: inline-flex;
      align-items: center;
      min-inline-size: 0;
      flex: none;
    }
    :host([hidden]) {
      display: none;
    }
    .box {
      display: inline-flex;
      align-items: center;
      min-inline-size: 0;
      max-inline-size: 100%;
    }
    svg.sw {
      display: block;
      block-size: var(--_h);
      inline-size: auto;
      max-inline-size: min(100%, var(--_w, 100%));
      overflow: visible;
    }
    img {
      display: block;
      block-size: var(--_h);
      inline-size: auto;
      max-inline-size: min(100%, var(--_w, 100%));
      object-fit: contain;
      -webkit-user-drag: none;
      user-select: none;
    }
    .plate {
      background: #ffffff;
      border-radius: var(--sw-r-sm, 8px);
      padding: 2px 8px;
    }
    .plate.dk {
      background: #0d1220;
    }
    .plate img {
      block-size: calc(var(--_h) - 6px);
    }
    /* the one place a colour invert is allowed: the administrator chose it (brand.dark_mode = invert) */
    .invert img {
      filter: invert(1) hue-rotate(180deg);
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.off = [onDesign(() => (this.theme = resolvedTheme())), onBrandLogo(() => (this.brand = brandLogo()))];
    this.theme = resolvedTheme();
    this.brand = brandLogo();
  }

  disconnectedCallback() {
    this.off.forEach((f) => f());
    this.off = [];
    super.disconnectedCallback();
  }

  render() {
    const b: BrandLogoState = { ...this.brand, ...(this.previewState ?? {}) };
    const scale = logoScale(this.previewSize ?? b.size);
    const h = Math.round(this.h * scale * 10) / 10;
    const style = `--_h:${h}px;${this.maxw ? `--_w:${Math.round(this.maxw * scale)}px` : ''}`;
    const dark = (this.scheme === 'auto' ? this.theme : this.scheme) === 'dark';
    if (this.kind === 'product') {
      const alt = this.decorative ? '' : t('brandLogos.productAlt');
      // LOGOFIT-295 (owner 2026-10-24): the SmplWise logo exactly as the approved mockup draws it (private/review/logos-mockup-v3.html,
      // symbols #sw-mark / #sw-word / #sw-word-dark): the blue tile mark and the word "Smpl" + "Wise" in Heebo. The mint PNG of the
      // 2026-09-14 design baseline (public/brand/smplwise-logo.png / smplwise-mark.png) is not that logo. Inline (not an <img>) so the
      // word is set in the app's own Heebo, and "Smpl" follows the placement's text colour (currentColor) on the light scheme.
      return html`<span class="box" style=${style} ?aria-hidden=${this.decorative}>${this.mark ? swMark(alt) : swWord(alt, dark)}</span>`;
    }
    const installer = this.kind === 'installer';
    // WHITELABEL097-295: the installer's logo follows the same light / dark rules as the company's; nothing at all while the profile is off
    if (installer && !b.wl.enabled) return nothing;
    const pick = chooseCompanyLogo(installer ? b.wl.files : b.files, this.previewMode ?? b.darkMode, dark);
    const src = pick ? (installer ? installerLogoUrl(pick.variant, pick.file) : companyLogoUrl(pick.variant, pick.file)) : null;
    if (!pick || !src) return nothing;
    const alt = this.decorative ? '' : installer ? b.wl.name || t('whiteLabel.alt') : b.companyName || t('brandLogos.companyAlt');
    return html`<span class=${pick.treatment === 'plate' ? 'box plate' : pick.treatment === 'darkplate' ? 'box plate dk' : pick.treatment === 'invert' ? 'box invert' : 'box'} style=${style} data-brand-treatment=${pick.treatment}><img src=${src} alt=${alt} data-brand-img="company" data-brand-variant=${pick.variant} draggable="false" /></span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-brand': SwBrand;
  }
}
