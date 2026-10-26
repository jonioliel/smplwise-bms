import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-card';
import '../components/sw-button';
import '../components/sw-icon';
import '../components/sw-brand';
import { describeError } from '../api/client';
import { deleteLogo, getBrand, putBrand, uploadLogo, type BrandFileMeta, type BrandFull } from '../api/brand';
import { can, isApi } from '../api/session';
import {
  COMPANY_KINDS,
  DARK_MODES,
  LOGO_SCALE,
  LOGO_SIZES,
  LOGO_SIDES,
  COMPANY_SIZES,
  type LogoSide,
  type CompanySize,
  TITLE_MODES,
  brandFromView,
  brandLogo,
  composeTitle,
  setBrandView,
  type BrandLogoState,
  type CompanyKind,
  type DarkMode,
  type LogoSize,
  type LogoVariant,
  type TitleMode,
} from '../design/brand-logo';
import { t, type I18nKey } from '../i18n/he';
import { settingsStyles } from '../styles/settings';

type Tab = 'files' | 'look' | 'title' | 'preview';
const ACCEPT = 'image/png,image/svg+xml,image/webp,image/jpeg,.png,.svg,.webp,.jpg,.jpeg';

/** The values an administrator edits before saving (the logo FILES are saved the moment they are uploaded). */
interface Draft {
  size: LogoSize;
  logoSide: LogoSide;
  companySize: CompanySize;
  darkMode: DarkMode;
  companyName: string;
  kind: CompanyKind;
  projectName: string;
  titlePrefix: string;
  titleMode: TitleMode;
}

const draftOf = (b: BrandLogoState): Draft => ({ size: b.size, logoSide: b.logoSide, companySize: b.companySize, darkMode: b.darkMode, companyName: b.companyName, kind: b.kind, projectName: b.projectName, titlePrefix: b.titlePrefix, titleMode: b.titleMode });

/**
 * הגדרות › כללי › מראה המערכת › לוגו ושם המערכת (CR-LOGOS295, the approved mockup v3.1). One tabbed card that never scrolls inside:
 * (1) the light and the dark logo file side by side (upload / replace / remove; PNG, SVG, WebP, JPEG by content, 2 MB), (2) the size
 * scale and the dark-background behaviour (the screen opens here), (3) the names and the browser-tab title; a permanent preview column
 * (a fourth tab on a narrow screen) draws the real `<sw-brand>` placements for the light and the dark scheme from the UNSAVED draft.
 * system.configure edits; everyone else sees the preview only. The SmplWise logo is never an option here: it stays everywhere.
 */
@customElement('system-brand-logos')
export class SystemBrandLogos extends LitElement {
  @state() private tab: Tab = 'look';
  @state() private canEdit = !isApi();
  @state() private saved: BrandLogoState = brandLogo();
  @state() private draft: Draft = draftOf(brandLogo());
  @state() private files: BrandFull['files'] = { light: null, dark: null };
  @state() private busy: LogoVariant | 'save' | null = null;
  @state() private message = '';
  @state() private error = '';
  @state() private warnings: string[] = [];
  @state() private dragOver: LogoVariant | null = null;
  @state() private uploadName: Partial<Record<LogoVariant, string>> = {};

  static styles = [settingsStyles, css`
    :host {
      display: block;
    }
    .bcard {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .top {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .tabs {
      display: inline-flex;
      align-self: flex-start;
      gap: 2px;
      padding: 3px;
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-3);
      max-inline-size: 100%;
      overflow-x: auto;
      scrollbar-width: none;
    }
    .tabs button {
      all: unset;
      box-sizing: border-box;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      min-block-size: 28px;
      padding: 0 12px;
      border-radius: var(--sw-r-sm);
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
      white-space: nowrap;
    }
    .tabs button[aria-selected='true'] {
      background: var(--sw-surface);
      color: var(--sw-accent-text);
      font-weight: var(--sw-fw-semibold);
      box-shadow: var(--sw-shadow-1);
    }
    .tabs button:focus-visible,
    .opt:focus-visible,
    .seg button:focus-visible,
    .drop:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset);
    }
    .tabs .ptab {
      display: none;
    }
    .grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 320px;
      gap: 16px;
      align-items: start;
    }
    .pnl {
      display: none;
      flex-direction: column;
      gap: 12px;
      min-inline-size: 0;
    }
    .pnl.on {
      display: flex;
    }
    .side {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding-inline-start: 16px;
      border-inline-start: 1px solid var(--sw-border);
      min-inline-size: 0;
    }
    .side > b {
      font-size: var(--sw-fs-base);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-heading);
    }
    @media (max-width: 899px) {
      .grid {
        grid-template-columns: minmax(0, 1fr);
      }
      .side {
        display: none;
        padding: 0;
        border: 0;
      }
      .side.on {
        display: flex;
      }
      .tabs .ptab {
        display: inline-flex;
      }
    }
    .g2 {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      align-items: start;
    }
    @media (max-width: 599px) {
      .g2 {
        grid-template-columns: minmax(0, 1fr);
      }
    }
    .fld {
      display: flex;
      flex-direction: column;
      gap: 5px;
      min-inline-size: 0;
    }
    .fld > .lbl {
      display: flex;
      flex-direction: column;
      gap: 1px;
      font-size: var(--sw-fs-base);
      font-weight: var(--sw-fw-medium);
      color: var(--sw-text);
    }
    .inp {
      font: inherit;
      color: var(--sw-text);
      background: var(--sw-surface-solid, var(--sw-surface));
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      min-block-size: 34px;
      padding: 0 12px;
      inline-size: 100%;
      box-sizing: border-box;
    }
    .inp:disabled {
      opacity: var(--sw-disabled-opacity, 0.5);
    }
    .seg {
      display: inline-flex;
      flex-wrap: wrap;
      /* FIX2200: the padding counts inside the width, so a wrapped row (the five company sizes on a phone) never pokes 8 px past the card */
      box-sizing: border-box;
      max-inline-size: 100%;
      padding: 3px;
      gap: 2px;
      background: var(--sw-surface-3);
      border-radius: var(--sw-r-sm);
      align-self: flex-start;
    }
    .seg button {
      all: unset;
      box-sizing: border-box;
      cursor: pointer;
      padding: 5px 12px;
      min-block-size: 28px;
      border-radius: calc(var(--sw-r-sm) - 2px);
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
      white-space: nowrap;
    }
    .seg button[aria-pressed='true'] {
      background: var(--sw-surface);
      color: var(--sw-text);
      font-weight: var(--sw-fw-semibold);
      box-shadow: var(--sw-shadow-1);
    }
    .seg button[disabled] {
      cursor: default;
    }
    .lbox {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 10px 12px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2);
      min-inline-size: 0;
    }
    .lbox .lt {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      min-block-size: 28px;
    }
    .lbox .lt b {
      font-size: var(--sw-fs-base);
      font-weight: var(--sw-fw-medium);
    }
    .lbox .lt .sp {
      flex: 1;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      border-radius: var(--sw-r-pill);
      padding: 2px 9px;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
      white-space: nowrap;
    }
    .chip.ok {
      background: var(--sw-success-soft);
      color: var(--sw-success-text);
    }
    .acts {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .tile {
      display: grid;
      place-items: center;
      min-block-size: 84px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      padding: 12px;
    }
    /* the two preview surfaces are fixed colours on purpose: they show the OTHER scheme, whatever scheme the page is in */
    .tile.light,
    .mini.l {
      background: #ffffff;
    }
    .tile.dark,
    .mini.d {
      background: #0d1220;
    }
    .drop {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 6px;
      min-block-size: 84px;
      padding: 8px;
      border: 1.5px dashed var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
      text-align: center;
    }
    .drop.over {
      border-color: var(--sw-accent);
      background: var(--sw-accent-soft);
    }
    .drop.bad {
      border-color: var(--sw-danger);
    }
    .meta {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .opts {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
    }
    @media (max-width: 599px) {
      .opts {
        grid-template-columns: minmax(0, 1fr);
      }
    }
    .opt {
      all: unset;
      box-sizing: border-box;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 8px;
      border: 1.5px solid var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      color: var(--sw-text);
      min-inline-size: 0;
    }
    .opt[aria-pressed='true'] {
      border-color: var(--sw-accent);
      background: var(--sw-accent-soft);
      box-shadow: 0 0 0 1px var(--sw-accent) inset;
    }
    .opt[disabled] {
      cursor: default;
    }
    .opt .tile {
      min-block-size: 56px;
      padding: 8px;
    }
    .opt b {
      font-size: var(--sw-fs-base);
      font-weight: var(--sw-fw-semibold);
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }
    .opt .d {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      line-height: 1.4;
    }
    .mini {
      border-radius: var(--sw-r-md);
      border: 1px solid var(--sw-border-strong);
      overflow: hidden;
    }
    .mini .bar {
      display: flex;
      align-items: center;
      gap: 10px;
      min-block-size: 40px;
      padding: 5px 12px;
    }
    .mini.l .bar {
      background: #ffffff;
      border-block-end: 1px solid #e7ebf2;
    }
    .mini.d .bar {
      background: #151c2c;
      border-block-end: 1px solid #232e45;
    }
    .mini .body {
      block-size: 40px;
      padding: 8px 12px;
      display: flex;
      gap: 6px;
    }
    .mini .body i {
      display: block;
      flex: 1;
      border-radius: var(--sw-r-xs);
    }
    .mini.l .body {
      background: #f5f7fb;
    }
    .mini.l .body i {
      background: #ffffff;
      border: 1px solid #e7ebf2;
    }
    .mini.d .body i {
      background: #151c2c;
      border: 1px solid #232e45;
    }
    /* LOGOSIDE-295: the stub stands for the page title: side start = the logos take the start of the row before the title, side end = the title
       takes the start and the logos sit beside the SmplWise logo */
    .mini .ttl {
      flex: none;
      inline-size: 34px;
      block-size: 8px;
      border-radius: var(--sw-r-pill);
      background: #8896af;
      opacity: 0.45;
    }
    .mini .sp {
      flex: 1;
    }
    .mini .pill {
      inline-size: 44px;
      block-size: 20px;
      border-radius: var(--sw-r-pill);
      border: 1px solid #8896af;
      opacity: 0.5;
    }
    .cap {
      display: block;
      margin-block-start: 4px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      text-align: center;
    }
    .tabdemo {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 10px 12px;
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-3);
    }
    .ctab {
      display: flex;
      align-items: center;
      gap: 8px;
      min-inline-size: 0;
      block-size: 26px;
      padding: 0 12px;
      border-radius: var(--sw-r-sm) var(--sw-r-sm) 0 0;
      background: var(--sw-surface);
      color: var(--sw-text);
      font-size: var(--sw-fs-xs);
    }
    .ctab .ttl {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      unicode-bidi: plaintext;
    }
    .tabdemo small {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .warn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: var(--sw-warning-text);
      font-size: var(--sw-fs-sm);
    }
    .foot .grow {
      flex: 1;
    }
    input[type='file'] {
      display: none;
    }
  `];

  connectedCallback() {
    super.connectedCallback();
    if (!isApi()) return;
    this.canEdit = can('system.configure');
    void getBrand()
      .then((r) => this.adopt(r))
      .catch(() => undefined);
  }

  private adopt(r: Pick<BrandFull, 'files'> & Partial<BrandFull>) {
    this.files = r.files;
    if (r.company) {
      this.saved = brandFromView(r, this.saved);
      setBrandView(r);
      this.draft = draftOf(this.saved);
    }
  }

  private get dirty(): boolean {
    return JSON.stringify(this.draft) !== JSON.stringify(draftOf(this.saved));
  }

  private set<K extends keyof Draft>(k: K, v: Draft[K]) {
    this.draft = { ...this.draft, [k]: v };
  }

  /** the draft as the placements draw it (the unsaved choice; the files are the saved ones) */
  private get previewState(): Partial<BrandLogoState> {
    return { companyName: this.draft.companyName, size: this.draft.size, companySize: this.draft.companySize, darkMode: this.draft.darkMode, files: this.saved.files };
  }

  private async save() {
    this.busy = 'save';
    this.error = '';
    try {
      if (isApi()) {
        const d = this.draft;
        const r = await putBrand({ company_name: d.companyName, company_kind: d.kind, logo_size: d.size, logo_side: d.logoSide, company_logo_size: d.companySize, dark_mode: d.darkMode, title_prefix: d.titlePrefix, title_mode: d.titleMode, project_name: d.projectName });
        this.adopt(r);
      } else {
        this.saved = { ...this.saved, ...this.draft };
        setBrandView({ company: { name: this.saved.companyName, kind: this.saved.kind, logo: this.saved.files, logo_file: this.saved.files }, size: this.saved.size, logo_side: this.saved.logoSide, company_logo_size: this.saved.companySize, dark_mode: this.saved.darkMode, title: { prefix: this.saved.titlePrefix, mode: this.saved.titleMode }, project: { name: this.saved.projectName } });
      }
      this.flash(t('brandLogos.saved'));
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = null;
    }
  }

  private flash(text: string) {
    this.message = text;
    setTimeout(() => (this.message = ''), 2500);
  }

  private async onFile(variant: LogoVariant, file: File | undefined) {
    if (!file || !this.canEdit) return;
    this.busy = variant;
    this.error = '';
    this.warnings = [];
    this.uploadName = { ...this.uploadName, [variant]: file.name };
    try {
      const r = await uploadLogo(variant, file);
      this.files = r.files;
      setBrandView(r.view);
      this.saved = brandFromView(r.view, this.saved);
      this.warnings = r.warnings.map((w) => w.message);
      this.flash(t('brandLogos.uploaded'));
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = null;
    }
  }

  private async onRemove(variant: LogoVariant) {
    if (!this.canEdit) return;
    this.busy = variant;
    this.error = '';
    try {
      const r = (await deleteLogo(variant)) as unknown as BrandFull;
      this.files = r.files;
      setBrandView(r);
      this.saved = brandFromView(r, this.saved);
      this.flash(t('brandLogos.removed'));
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = null;
    }
  }

  private pickFile(variant: LogoVariant) {
    this.renderRoot.querySelector<HTMLInputElement>(`input[data-file="${variant}"]`)?.click();
  }

  private renderFileBox(variant: LogoVariant) {
    const meta: BrandFileMeta | null = this.files[variant];
    const dark = variant === 'dark';
    const heading = t(dark ? 'brandLogos.darkTitle' : 'brandLogos.lightTitle');
    const busy = this.busy === variant;
    const stored = this.saved.files[variant];
    return html`<div class="lbox" data-logo-box=${variant}>
      <div class="lt"><b>${heading}</b>${dark ? html`<span class="chip">${t('brandLogos.optional')}</span>` : nothing}<span class="sp"></span>
        ${this.canEdit && meta
          ? html`<span class="acts"><sw-button size="sm" icon="refresh" ?disabled=${busy} data-logo-replace=${variant} @click=${() => this.pickFile(variant)}>${t('brandLogos.replace')}</sw-button>
              <sw-button size="sm" variant="danger" icon="trash" ?disabled=${busy} data-logo-remove=${variant} @click=${() => void this.onRemove(variant)}>${t('brandLogos.remove')}</sw-button></span>`
          : nothing}</div>
      <span class="muted">${t(dark ? 'brandLogos.darkRules' : 'brandLogos.rules')}</span>
      ${meta && stored
        ? html`<div class=${`tile ${dark ? 'dark' : 'light'}`} data-logo-preview=${variant}>
              <sw-brand kind="company" .h=${48} .maxw=${220} scheme=${dark ? 'dark' : 'light'} .previewMode=${dark ? 'file' : 'plate'} .previewState=${{ files: dark ? { light: null, dark: stored } : { light: stored, dark: null }, companyName: this.draft.companyName, companySize: 'same' }} .previewSize=${'m'}></sw-brand>
            </div>
            <div class="meta"><span class="ltr">${meta.mime === 'image/svg+xml' ? 'SVG' : 'PNG'} · ${Math.max(1, Math.round(meta.bytes / 1024))} KB · ${meta.width}×${meta.height}</span>${meta.uploaded_by ? html`<span>· ${t('brandLogos.uploadedBy')} ${meta.uploaded_by}</span>` : nothing}</div>`
        : html`<div class=${`drop ${this.dragOver === variant ? 'over' : ''}`} data-logo-drop=${variant} tabindex=${this.canEdit ? 0 : -1}
            @dragover=${(e: DragEvent) => { if (!this.canEdit) return; e.preventDefault(); this.dragOver = variant; }}
            @dragleave=${() => (this.dragOver = null)}
            @drop=${(e: DragEvent) => { e.preventDefault(); this.dragOver = null; void this.onFile(variant, e.dataTransfer?.files?.[0]); }}
            @keydown=${(e: KeyboardEvent) => { if (this.canEdit && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); this.pickFile(variant); } }}>
            ${busy
              ? html`<span>${t('brandLogos.uploading')} ${this.uploadName[variant] ?? ''}</span>`
              : html`<sw-icon name="upload" size=${22}></sw-icon><span>${t(dark ? 'brandLogos.dropDark' : 'brandLogos.dropHere')}</span>
                  ${this.canEdit ? html`<sw-button size="sm" data-logo-choose=${variant} @click=${() => this.pickFile(variant)}>${t('brandLogos.choose')}</sw-button>` : nothing}`}
          </div>`}
      <input type="file" accept=${ACCEPT} data-file=${variant} @change=${(e: Event) => { const el = e.target as HTMLInputElement; void this.onFile(variant, el.files?.[0]); el.value = ''; }} />
    </div>`;
  }

  private renderFiles() {
    return html`<div class="g2">${this.renderFileBox('light')}${this.renderFileBox('dark')}</div>
      ${this.warnings.map((w) => html`<span class="warn" role="status" data-logo-warning><sw-icon name="warning" size=${14}></sw-icon>${w}</span>`)}`;
  }

  private renderLook() {
    const d = this.draft;
    const sc = LOGO_SCALE[d.size];
    const csc = LOGO_SCALE[d.companySize === 'same' ? d.size : d.companySize];
    const noDark = d.darkMode === 'file' && !this.saved.files.dark;
    return html`<div class="fld"><span class="lbl">${t('brandLogos.sizeLabel')}<span class="muted">${t('brandLogos.sizeHint')}</span></span>
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          <span class="seg" role="group" aria-label=${t('brandLogos.sizeLabel')} data-logo-size>
            ${LOGO_SIZES.map((s) => html`<button type="button" aria-pressed=${d.size === s ? 'true' : 'false'} data-size=${s} ?disabled=${!this.canEdit} @click=${() => this.set('size', s)}>${t(`brandLogos.size_${s}` as I18nKey)}</button>`)}
          </span>
          <span class="muted ltr" data-logo-size-px>${Math.round(36 * sc)}px · ${Math.round(28 * sc)}px</span>
        </div></div>
      <div class="fld"><span class="lbl">${t('brandLogos.companySizeLabel')}<span class="muted">${t('brandLogos.companySizeHint')}</span></span>
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          <span class="seg" role="group" aria-label=${t('brandLogos.companySizeLabel')} data-logo-company-size>
            ${COMPANY_SIZES.map((s) => html`<button type="button" aria-pressed=${d.companySize === s ? 'true' : 'false'} data-company-size=${s} ?disabled=${!this.canEdit} @click=${() => this.set('companySize', s)}>${t(s === 'same' ? 'brandLogos.csize_same' : (`brandLogos.size_${s}` as I18nKey))}</button>`)}
          </span>
          <span class="muted ltr" data-logo-company-size-px>${Math.round(34 * csc)}px</span>
        </div></div>
      <div class="fld"><span class="lbl">${t('brandLogos.sideLabel')}<span class="muted">${t('brandLogos.sideHint')}</span></span>
        <span class="seg" role="group" aria-label=${t('brandLogos.sideLabel')} data-logo-side>
          ${LOGO_SIDES.map((s) => html`<button type="button" aria-pressed=${d.logoSide === s ? 'true' : 'false'} data-side=${s} ?disabled=${!this.canEdit} @click=${() => this.set('logoSide', s)}>${t(`brandLogos.side_${s}` as I18nKey)}</button>`)}
        </span></div>
      <div class="fld"><span class="lbl">${t('brandLogos.darkLabel')}<span class="muted">${t('brandLogos.darkHint')}</span></span>
        <div class="opts" role="group" aria-label=${t('brandLogos.darkLabel')} data-logo-darkmode>
          ${DARK_MODES.map((m) => html`<button type="button" class="opt" aria-pressed=${d.darkMode === m ? 'true' : 'false'} data-dark-mode=${m} ?disabled=${!this.canEdit} @click=${() => this.set('darkMode', m)}>
            <span class="tile dark"><sw-brand kind="company" .h=${26} .maxw=${150} scheme="dark" .previewMode=${m} .previewSize=${'m'} .previewState=${{ files: this.saved.files, companyName: d.companyName, companySize: 'same' }}></sw-brand></span>
            <b>${t(`brandLogos.mode_${m}` as I18nKey)}${m === 'invert' ? html`<span class="chip ok">${t('brandLogos.recommended')}</span>` : nothing}</b>
            <span class="d">${t(`brandLogos.mode_${m}_d` as I18nKey)}</span></button>`)}
        </div>
        ${noDark ? html`<span class="warn" role="status" data-logo-nodark><sw-icon name="warning" size=${14}></sw-icon>${t('brandLogos.noDarkFile')}<sw-button size="sm" variant="ghost" @click=${() => (this.tab = 'files')}>${t('brandLogos.toUpload')}</sw-button></span>` : nothing}
      </div>`;
  }

  private renderTitle() {
    const d = this.draft;
    return html`<div class="g2">
        <label class="fld"><span class="lbl">${t('brandLogos.nameLabel')}<span class="muted">${t('brandLogos.nameHint')}</span></span>
          <input class="inp" maxlength="60" data-brand-name .value=${d.companyName} ?disabled=${!this.canEdit} @input=${(e: Event) => this.set('companyName', (e.target as HTMLInputElement).value)} /></label>
        <div class="fld"><span class="lbl">${t('brandLogos.kindLabel')}</span>
          <span class="seg" role="group" aria-label=${t('brandLogos.kindLabel')}>${COMPANY_KINDS.map((k) => html`<button type="button" aria-pressed=${d.kind === k ? 'true' : 'false'} data-kind=${k} ?disabled=${!this.canEdit} @click=${() => this.set('kind', k)}>${t(`brandLogos.kind_${k}` as I18nKey)}</button>`)}</span></div>
      </div>
      <div class="g2">
        <label class="fld"><span class="lbl">${t('brandLogos.projectLabel')}<span class="muted">${t('brandLogos.projectHint')}</span></span>
          <input class="inp" maxlength="60" data-brand-project .value=${d.projectName} ?disabled=${!this.canEdit} @input=${(e: Event) => this.set('projectName', (e.target as HTMLInputElement).value)} /></label>
        <label class="fld"><span class="lbl">${t('brandLogos.prefixLabel')}<span class="muted">${t('brandLogos.prefixHint')}</span></span>
          <input class="inp ltr" maxlength="40" data-brand-prefix .value=${d.titlePrefix} ?disabled=${!this.canEdit} @input=${(e: Event) => this.set('titlePrefix', (e.target as HTMLInputElement).value)} /></label>
      </div>
      <div class="fld"><span class="lbl">${t('brandLogos.modeLabel')}</span>
        <span class="seg" role="group" aria-label=${t('brandLogos.modeLabel')} data-logo-titlemode>${TITLE_MODES.map((m) => html`<button type="button" aria-pressed=${d.titleMode === m ? 'true' : 'false'} data-title-mode=${m} ?disabled=${!this.canEdit} @click=${() => this.set('titleMode', m)}>${t(`brandLogos.tmode_${m}` as I18nKey)}</button>`)}</span></div>
      ${this.renderTabDemo()}`;
  }

  private renderTabDemo() {
    const d = this.draft;
    return html`<div class="tabdemo"><div class="ctab"><sw-brand kind="product" mark decorative .h=${14}></sw-brand><span class="ttl" data-brand-title>${composeTitle(d.titlePrefix, d.titleMode, d.companyName, d.projectName)}</span></div><small>${t('brandLogos.tabDemo')}</small></div>`;
  }

  private renderMini(scheme: 'light' | 'dark') {
    const cls = scheme === 'light' ? 'l' : 'd';
    const company = html`<sw-brand kind="company" .h=${20} .maxw=${64} scheme=${scheme} decorative .previewMode=${this.draft.darkMode} .previewSize=${this.draft.size} .previewState=${this.previewState}></sw-brand>`;
    const start = this.draft.logoSide === 'start';
    return html`<div><div class=${`mini ${cls}`} data-logo-mini=${scheme}><div class="bar" data-side=${this.draft.logoSide}>
        ${start ? html`${company}<i class="ttl"></i><span class="sp"></span>` : html`<i class="ttl"></i><span class="sp"></span>${company}`}
        <span class="pill"></span><sw-brand kind="product" .h=${18} scheme=${scheme} decorative .previewSize=${this.draft.size}></sw-brand></div>
        <div class="body"><i></i><i></i><i></i></div></div>
      <span class="cap">${t(scheme === 'light' ? 'brandLogos.previewLightCap' : 'brandLogos.previewDarkCap')}</span></div>`;
  }

  render() {
    const tabs: [Tab, I18nKey][] = [['files', 'brandLogos.tabFiles'], ['look', 'brandLogos.tabLook'], ['title', 'brandLogos.tabTitle'], ['preview', 'brandLogos.tabPreview']];
    return html`<sw-card data-brand-logos-card>
      <div class="bcard">
        <div class="top"><div><div style="font-size:var(--sw-fs-lg);font-weight:var(--sw-fw-semibold);color:var(--sw-heading)">${t('brandLogos.heading')}</div>
          <div class="muted">${t('brandLogos.subheading')}</div></div>
          <span style="flex:1"></span>${this.canEdit ? nothing : html`<span class="msg" data-logo-readonly><sw-icon name="lock" size=${13}></sw-icon>${t('brandLogos.readOnly')}</span>`}</div>
        <div class="tabs" role="tablist" aria-label=${t('brandLogos.tabs')}>
          ${tabs.map(([id, key]) => html`<button type="button" role="tab" class=${id === 'preview' ? 'ptab' : ''} aria-selected=${this.tab === id ? 'true' : 'false'} data-logo-tab=${id} @click=${() => (this.tab = id)}>${t(key)}</button>`)}
        </div>
        <div class="grid">
          <div style="min-inline-size:0">
            <section class=${`pnl ${this.tab === 'files' ? 'on' : ''}`} data-logo-panel="files">${this.renderFiles()}</section>
            <section class=${`pnl ${this.tab === 'look' ? 'on' : ''}`} data-logo-panel="look">${this.renderLook()}</section>
            <section class=${`pnl ${this.tab === 'title' ? 'on' : ''}`} data-logo-panel="title">${this.renderTitle()}</section>
          </div>
          <aside class=${`side ${this.tab === 'preview' ? 'on' : ''}`} data-logo-panel="preview" aria-label=${t('brandLogos.previewTitle')}>
            <b>${t('brandLogos.previewTitle')}</b>
            ${this.renderMini('light')}${this.renderMini('dark')}
            ${this.renderTabDemo()}
            <span class="muted">${t('brandLogos.previewNote')}</span>
          </aside>
        </div>
        <div class="foot">
          ${this.canEdit ? html`<sw-button variant="primary" size="sm" icon="check" data-logo-save ?disabled=${!this.dirty || this.busy === 'save'} @click=${() => void this.save()}>${t('brandLogos.save')}</sw-button>` : nothing}
          ${this.message ? html`<span class="msg ok" role="status" data-logo-message><sw-icon name="check" size=${13}></sw-icon>${this.message}</span>` : nothing}
          ${this.error ? html`<span class="msg err" role="alert" data-logo-error><sw-icon name="warning" size=${13}></sw-icon>${this.error}</span>` : nothing}
          <span class="grow"></span><span class="muted">${t('brandLogos.stays')}</span>
        </div>
      </div>
    </sw-card>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-brand-logos': SystemBrandLogos;
  }
}
