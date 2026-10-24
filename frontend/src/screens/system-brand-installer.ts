import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-card';
import '../components/sw-button';
import '../components/sw-icon';
import '../components/sw-brand';
import { describeError } from '../api/client';
import { deleteInstallerLogo, downloadInstallerPack, getInstaller, importInstallerPack, putInstaller, uploadInstallerLogo, type InstallerFull } from '../api/brand';
import { can, isApi } from '../api/session';
import { BRAND_PRESETS } from '../design/brand';
import { brandLogo, installerFromView, setBrandView, type InstallerState, type LogoVariant } from '../design/brand-logo';
import { t, type I18nKey } from '../i18n/he';
import { settingsStyles } from '../styles/settings';

type Tab = 'profile' | 'logos' | 'pack' | 'preview';
const ACCEPT = 'image/png,image/svg+xml,image/webp,image/jpeg,.png,.svg,.webp,.jpg,.jpeg';
const PACK_ACCEPT = 'application/zip,.zip';
const PRESET_IDS = Object.keys(BRAND_PRESETS);

/** The values an administrator edits before saving (the logo FILES and the pack are applied the moment they are sent). */
interface Draft {
  enabled: boolean;
  name: string;
  contact: string;
  accent: string;
}
const draftOf = (w: InstallerState): Draft => ({ enabled: w.enabled, name: w.name, contact: w.contact, accent: w.accent });

/**
 * הגדרות › כללי › מראה המערכת › מיתוג מתקין (WHITELABEL097-295). One tabbed card that never scrolls inside: (1) the installer's name,
 * contact line, accent (a preset only) and the master switch (OFF by default), (2) the light and dark logo, (3) the customer pack
 * (export a zip / import one from another installation), and a preview column (a fourth tab on a narrow screen) that draws the sign-in
 * card head from the UNSAVED draft. The installer's identity is added beside SmplWise's; there is no option that hides SmplWise.
 */
@customElement('system-brand-installer')
export class SystemBrandInstaller extends LitElement {
  @state() private tab: Tab = 'profile';
  @state() private canEdit = !isApi();
  @state() private saved: InstallerState = brandLogo().wl;
  @state() private draft: Draft = draftOf(brandLogo().wl);
  @state() private files: InstallerFull['files'] = { light: null, dark: null };
  @state() private busy: LogoVariant | 'save' | 'pack' | null = null;
  @state() private message = '';
  @state() private error = '';
  @state() private warnings: string[] = [];

  static styles = [settingsStyles, css`
    :host { display: block; }
    .bcard { display: flex; flex-direction: column; gap: 10px; }
    .top { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .tabs { display: inline-flex; align-self: flex-start; gap: 2px; padding: 3px; border-radius: var(--sw-r-md); background: var(--sw-surface-3); max-inline-size: 100%; overflow-x: auto; scrollbar-width: none; }
    .tabs button { all: unset; box-sizing: border-box; cursor: pointer; display: inline-flex; align-items: center; min-block-size: 28px; padding: 0 12px; border-radius: var(--sw-r-sm); color: var(--sw-text-2); font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-medium); white-space: nowrap; }
    .tabs button[aria-selected='true'] { background: var(--sw-surface); color: var(--sw-accent-text); font-weight: var(--sw-fw-semibold); box-shadow: var(--sw-shadow-1); }
    .tabs button:focus-visible, .sw:focus-visible, .dot:focus-visible, .drop:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: var(--sw-focus-offset); }
    .tabs .ptab { display: none; }
    .grid { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 16px; align-items: start; }
    .pnl { display: none; flex-direction: column; gap: 12px; min-inline-size: 0; }
    .pnl.on { display: flex; }
    .side { display: flex; flex-direction: column; gap: 10px; padding-inline-start: 16px; border-inline-start: 1px solid var(--sw-border); min-inline-size: 0; }
    .side > b { font-size: var(--sw-fs-base); font-weight: var(--sw-fw-semibold); color: var(--sw-heading); }
    @media (max-width: 899px) {
      .grid { grid-template-columns: minmax(0, 1fr); }
      .side { display: none; padding: 0; border: 0; }
      .side.on { display: flex; }
      .tabs .ptab { display: inline-flex; }
    }
    .g2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; align-items: start; }
    @media (max-width: 599px) { .g2 { grid-template-columns: minmax(0, 1fr); } }
    .fld { display: flex; flex-direction: column; gap: 5px; min-inline-size: 0; }
    .fld > .lbl { display: flex; flex-direction: column; gap: 1px; font-size: var(--sw-fs-base); font-weight: var(--sw-fw-medium); color: var(--sw-text); }
    .inp { font: inherit; color: var(--sw-text); background: var(--sw-surface-solid, var(--sw-surface)); border: 1px solid var(--sw-border-strong); border-radius: var(--sw-r-sm); min-block-size: 34px; padding: 0 12px; inline-size: 100%; box-sizing: border-box; }
    .inp:disabled { opacity: var(--sw-disabled-opacity, 0.5); }
    .swrow { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .sw { all: unset; box-sizing: border-box; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px 4px 6px; border: 1.5px solid var(--sw-border-strong); border-radius: var(--sw-r-pill); font-size: var(--sw-fs-sm); color: var(--sw-text); }
    .sw[aria-pressed='true'] { border-color: var(--sw-accent); background: var(--sw-accent-soft); }
    .sw[disabled] { cursor: default; opacity: var(--sw-disabled-opacity, 0.5); }
    .dot { inline-size: 16px; block-size: 16px; border-radius: 50%; border: 1px solid var(--sw-border-strong); flex: none; }
    .sw-main { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border: 1px solid var(--sw-border); border-radius: var(--sw-r-md); background: var(--sw-surface-2); }
    .sw-main .t { flex: 1; display: flex; flex-direction: column; gap: 1px; min-inline-size: 0; }
    .sw-main .t b { font-weight: var(--sw-fw-semibold); }
    .tgl { all: unset; box-sizing: border-box; cursor: pointer; inline-size: 44px; block-size: 26px; border-radius: var(--sw-r-pill); background: var(--sw-border-strong); position: relative; flex: none; }
    .tgl::after { content: ''; position: absolute; inset-block-start: 3px; inset-inline-start: 3px; inline-size: 20px; block-size: 20px; border-radius: 50%; background: #fff; transition: inset-inline-start 120ms ease; }
    .tgl[aria-checked='true'] { background: var(--sw-toggle-on, var(--sw-accent)); }
    .tgl[aria-checked='true']::after { inset-inline-start: 21px; }
    .tgl[disabled] { cursor: default; opacity: var(--sw-disabled-opacity, 0.5); }
    .tgl:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: var(--sw-focus-offset); }
    .lbox { display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; border: 1px solid var(--sw-border); border-radius: var(--sw-r-md); background: var(--sw-surface-2); min-inline-size: 0; }
    .lbox .lt { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; min-block-size: 28px; }
    .lbox .lt b { font-size: var(--sw-fs-base); font-weight: var(--sw-fw-medium); }
    .lbox .lt .sp { flex: 1; }
    .acts { display: flex; gap: 6px; flex-wrap: wrap; }
    .tile { display: grid; place-items: center; min-block-size: 84px; border: 1px solid var(--sw-border-strong); border-radius: var(--sw-r-md); padding: 12px; }
    .tile.light, .mini.l { background: #ffffff; }
    .tile.dark, .mini.d { background: #0d1220; color: #e8edf7; }
    .drop { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; min-block-size: 84px; padding: 8px; border: 1.5px dashed var(--sw-border-strong); border-radius: var(--sw-r-md); color: var(--sw-text-2); font-size: var(--sw-fs-sm); text-align: center; }
    .meta { font-size: var(--sw-fs-xs); color: var(--sw-text-3); }
    .mini { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 14px 10px; border-radius: var(--sw-r-md); border: 1px solid var(--sw-border-strong); text-align: center; color: #1d2433; }
    .mini.d { color: #e8edf7; }
    .mini b { font-size: var(--sw-fs-sm); overflow-wrap: anywhere; unicode-bidi: plaintext; }
    .mini span.c { font-size: var(--sw-fs-xs); opacity: 0.8; overflow-wrap: anywhere; unicode-bidi: plaintext; }
    .mini .bar { inline-size: 40px; block-size: 4px; border-radius: var(--sw-r-2xs); margin-block-start: 4px; }
    .cap { display: block; margin-block-start: 4px; font-size: var(--sw-fs-xs); color: var(--sw-text-3); text-align: center; }
    .warn { display: inline-flex; align-items: center; gap: 6px; color: var(--sw-warning-text); font-size: var(--sw-fs-sm); }
    .foot .grow { flex: 1; }
    .chip { display: inline-flex; border-radius: var(--sw-r-pill); padding: 2px 9px; font-size: var(--sw-fs-xs); background: var(--sw-surface-3); color: var(--sw-text-2); }
    .chip.ok { background: var(--sw-success-soft); color: var(--sw-success-text); }
    input[type='file'] { display: none; }
  `];

  connectedCallback() {
    super.connectedCallback();
    if (!isApi()) return;
    this.canEdit = can('system.configure');
    void getInstaller().then((r) => this.adopt(r)).catch(() => undefined);
  }

  /** the server's full profile -> the saved state; the shared brand store only learns of it while it is ON (the public view). */
  private adopt(r: InstallerFull) {
    this.files = r.files;
    this.saved = { ...installerFromView({ ...r, enabled: true }), enabled: r.enabled };
    this.draft = draftOf(this.saved);
    setBrandView({ installer: r.enabled ? { ...r } : { enabled: false } });
  }

  private get dirty(): boolean {
    return JSON.stringify(this.draft) !== JSON.stringify(draftOf(this.saved));
  }

  private set<K extends keyof Draft>(k: K, v: Draft[K]) {
    this.draft = { ...this.draft, [k]: v };
  }

  private flash(text: string) {
    this.message = text;
    setTimeout(() => (this.message = ''), 2500);
  }

  private async save() {
    this.busy = 'save';
    this.error = '';
    try {
      if (isApi()) this.adopt(await putInstaller({ ...this.draft }));
      else {
        this.saved = { ...this.saved, ...this.draft };
        setBrandView({ installer: this.saved.enabled ? { ...this.saved, logo_file: this.saved.files } : { enabled: false } });
      }
      this.flash(t('whiteLabel.saved'));
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = null;
    }
  }

  private async onFile(variant: LogoVariant, file: File | undefined) {
    if (!file || !this.canEdit || !isApi()) return;
    this.busy = variant;
    this.error = '';
    this.warnings = [];
    try {
      const r = await uploadInstallerLogo(variant, file);
      this.warnings = r.warnings.map((w) => w.message);
      this.adopt(r.view);
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = null;
    }
  }

  private async onRemove(variant: LogoVariant) {
    if (!this.canEdit || !isApi()) return;
    this.busy = variant;
    this.error = '';
    try {
      this.adopt(await deleteInstallerLogo(variant));
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = null;
    }
  }

  private async onExport() {
    this.busy = 'pack';
    this.error = '';
    try {
      await downloadInstallerPack();
      this.flash(t('whiteLabel.exported'));
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = null;
    }
  }

  private async onImport(file: File | undefined) {
    if (!file || !this.canEdit || !isApi()) return;
    this.busy = 'pack';
    this.error = '';
    try {
      this.adopt(await importInstallerPack(file));
      this.flash(t('whiteLabel.imported'));
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = null;
    }
  }

  private pick(sel: string) {
    this.renderRoot.querySelector<HTMLInputElement>(sel)?.click();
  }

  private renderProfile() {
    const d = this.draft;
    return html`<div class="sw-main"><span class="t"><b>${t('whiteLabel.switchLabel')}</b><span class="muted">${t('whiteLabel.switchHint')}</span></span>
        <span class="chip ${d.enabled ? 'ok' : ''}" data-wl-state>${t(d.enabled ? 'whiteLabel.on' : 'whiteLabel.off')}</span>
        <button type="button" class="tgl" role="switch" aria-checked=${d.enabled ? 'true' : 'false'} aria-label=${t('whiteLabel.switchLabel')} data-wl-enabled ?disabled=${!this.canEdit} @click=${() => this.set('enabled', !d.enabled)}></button></div>
      <div class="g2">
        <label class="fld"><span class="lbl">${t('whiteLabel.nameLabel')}<span class="muted">${t('whiteLabel.nameHint')}</span></span>
          <input class="inp" maxlength="60" data-wl-name .value=${d.name} ?disabled=${!this.canEdit} @input=${(e: Event) => this.set('name', (e.target as HTMLInputElement).value)} /></label>
        <label class="fld"><span class="lbl">${t('whiteLabel.contactLabel')}<span class="muted">${t('whiteLabel.contactHint')}</span></span>
          <input class="inp" maxlength="120" data-wl-contact .value=${d.contact} ?disabled=${!this.canEdit} @input=${(e: Event) => this.set('contact', (e.target as HTMLInputElement).value)} /></label>
      </div>
      <div class="fld"><span class="lbl">${t('whiteLabel.accentLabel')}<span class="muted">${t('whiteLabel.accentHint')}</span></span>
        <div class="swrow" role="group" aria-label=${t('whiteLabel.accentLabel')} data-wl-accent>
          <button type="button" class="sw" aria-pressed=${d.accent === 'default' ? 'true' : 'false'} data-accent="default" ?disabled=${!this.canEdit} @click=${() => this.set('accent', 'default')}><span class="dot" style="background:var(--sw-surface-3)"></span>${t('whiteLabel.accentDefault')}</button>
          ${PRESET_IDS.map((id) => html`<button type="button" class="sw" aria-pressed=${d.accent === id ? 'true' : 'false'} data-accent=${id} ?disabled=${!this.canEdit} @click=${() => this.set('accent', id)}><span class="dot" style=${`background:${BRAND_PRESETS[id]}`}></span>${t(`brandColors.preset_${id}` as I18nKey)}</button>`)}
        </div></div>`;
  }

  private renderFileBox(variant: LogoVariant) {
    const meta = this.files[variant];
    const dark = variant === 'dark';
    const busy = this.busy === variant;
    const stored = this.saved.files[variant];
    const api = isApi();
    return html`<div class="lbox" data-wl-box=${variant}>
      <div class="lt"><b>${t(dark ? 'brandLogos.darkTitle' : 'brandLogos.lightTitle')}</b>${dark ? html`<span class="chip">${t('brandLogos.optional')}</span>` : nothing}<span class="sp"></span>
        ${this.canEdit && api && meta
          ? html`<span class="acts"><sw-button size="sm" icon="refresh" ?disabled=${busy} data-wl-replace=${variant} @click=${() => this.pick(`input[data-wl-file="${variant}"]`)}>${t('brandLogos.replace')}</sw-button>
              <sw-button size="sm" variant="danger" icon="trash" ?disabled=${busy} data-wl-remove=${variant} @click=${() => void this.onRemove(variant)}>${t('brandLogos.remove')}</sw-button></span>`
          : nothing}</div>
      <span class="muted">${t('brandLogos.rules')}</span>
      ${meta && stored
        ? html`<div class=${`tile ${dark ? 'dark' : 'light'}`} data-wl-preview=${variant}>
              <sw-brand kind="installer" .h=${48} .maxw=${220} scheme=${dark ? 'dark' : 'light'} .previewMode=${'file'} .previewState=${{ wl: { ...this.saved, enabled: true, files: dark ? { light: null, dark: stored } : { light: stored, dark: null } } }} .previewSize=${'m'}></sw-brand>
            </div>
            <div class="meta"><span class="ltr">${meta.mime === 'image/svg+xml' ? 'SVG' : 'PNG'} · ${Math.max(1, Math.round(meta.bytes / 1024))} KB · ${meta.width}×${meta.height}</span></div>`
        : html`<div class="drop" data-wl-drop=${variant}>
            ${busy ? html`<span>${t('brandLogos.uploading')}</span>`
              : api ? html`<sw-icon name="upload" size=${22}></sw-icon><span>${t(dark ? 'brandLogos.dropDark' : 'brandLogos.dropHere')}</span>
                  ${this.canEdit ? html`<sw-button size="sm" data-wl-choose=${variant} @click=${() => this.pick(`input[data-wl-file="${variant}"]`)}>${t('brandLogos.choose')}</sw-button>` : nothing}`
              : html`<span data-wl-needserver>${t('whiteLabel.needServer')}</span>`}
          </div>`}
      <input type="file" accept=${ACCEPT} data-wl-file=${variant} @change=${(e: Event) => { const el = e.target as HTMLInputElement; void this.onFile(variant, el.files?.[0]); el.value = ''; }} />
    </div>`;
  }

  private renderLogos() {
    return html`<div class="g2">${this.renderFileBox('light')}${this.renderFileBox('dark')}</div>
      ${this.warnings.map((w) => html`<span class="warn" role="status" data-wl-warning><sw-icon name="warning" size=${14}></sw-icon>${w}</span>`)}`;
  }

  private renderPack() {
    const api = isApi();
    return html`<div class="lbox"><b>${t('whiteLabel.packTitle')}</b><span class="muted">${t('whiteLabel.packHint')}</span>
        <div class="acts">
          <sw-button size="sm" icon="download" data-wl-export ?disabled=${!api || !this.canEdit || this.busy === 'pack'} @click=${() => void this.onExport()}>${t('whiteLabel.export')}</sw-button>
          <sw-button size="sm" icon="upload" data-wl-import ?disabled=${!api || !this.canEdit || this.busy === 'pack'} @click=${() => this.pick('input[data-wl-pack]')}>${t('whiteLabel.import')}</sw-button>
        </div>
        <span class="muted">${t('whiteLabel.importNote')}</span>
        ${api ? nothing : html`<span class="muted" data-wl-needserver>${t('whiteLabel.needServer')}</span>`}
        <input type="file" accept=${PACK_ACCEPT} data-wl-pack @change=${(e: Event) => { const el = e.target as HTMLInputElement; void this.onImport(el.files?.[0]); el.value = ''; }} />
      </div>`;
  }

  private renderMini(scheme: 'light' | 'dark') {
    const w = { ...this.saved, ...this.draft, enabled: true };
    const hex = w.accent === 'default' ? 'var(--sw-accent)' : BRAND_PRESETS[w.accent];
    return html`<div><div class=${`mini ${scheme === 'light' ? 'l' : 'd'}`} data-wl-mini=${scheme}>
        <sw-brand kind="installer" .h=${28} .maxw=${160} scheme=${scheme} decorative .previewMode=${'file'} .previewState=${{ wl: w }} .previewSize=${'m'}></sw-brand>
        ${w.name ? html`<b>${w.name}</b>` : nothing}${w.contact ? html`<span class="c">${w.contact}</span>` : nothing}
        <span class="bar" style=${`background:${hex}`}></span></div>
      <span class="cap">${t(scheme === 'light' ? 'brandLogos.previewLightCap' : 'brandLogos.previewDarkCap')}</span></div>`;
  }

  render() {
    const tabs: [Tab, I18nKey][] = [['profile', 'whiteLabel.tabProfile'], ['logos', 'whiteLabel.tabLogos'], ['pack', 'whiteLabel.tabPack'], ['preview', 'whiteLabel.tabPreview']];
    return html`<sw-card data-wl-card>
      <div class="bcard">
        <div class="top"><div><div style="font-size:var(--sw-fs-lg);font-weight:var(--sw-fw-semibold);color:var(--sw-heading)">${t('whiteLabel.heading')}</div>
          <div class="muted">${t('whiteLabel.subheading')}</div></div>
          <span style="flex:1"></span>${this.canEdit ? nothing : html`<span class="msg" data-wl-readonly><sw-icon name="lock" size=${13}></sw-icon>${t('whiteLabel.readOnly')}</span>`}</div>
        <div class="tabs" role="tablist" aria-label=${t('whiteLabel.tabs')}>
          ${tabs.map(([id, key]) => html`<button type="button" role="tab" class=${id === 'preview' ? 'ptab' : ''} aria-selected=${this.tab === id ? 'true' : 'false'} data-wl-tab=${id} @click=${() => (this.tab = id)}>${t(key)}</button>`)}
        </div>
        <div class="grid">
          <div style="min-inline-size:0">
            <section class=${`pnl ${this.tab === 'profile' ? 'on' : ''}`} data-wl-panel="profile">${this.renderProfile()}</section>
            <section class=${`pnl ${this.tab === 'logos' ? 'on' : ''}`} data-wl-panel="logos">${this.renderLogos()}</section>
            <section class=${`pnl ${this.tab === 'pack' ? 'on' : ''}`} data-wl-panel="pack">${this.renderPack()}</section>
          </div>
          <aside class=${`side ${this.tab === 'preview' ? 'on' : ''}`} data-wl-panel="preview" aria-label=${t('whiteLabel.previewTitle')}>
            <b>${t('whiteLabel.previewTitle')} · ${t('whiteLabel.previewLogin')}</b>
            ${this.renderMini('light')}${this.renderMini('dark')}
            ${this.draft.enabled ? nothing : html`<span class="muted" data-wl-previewoff>${t('whiteLabel.previewOff')}</span>`}
          </aside>
        </div>
        <div class="foot">
          ${this.canEdit ? html`<sw-button variant="primary" size="sm" icon="check" data-wl-save ?disabled=${!this.dirty || this.busy === 'save'} @click=${() => void this.save()}>${t('whiteLabel.save')}</sw-button>` : nothing}
          ${this.message ? html`<span class="msg ok" role="status" data-wl-message><sw-icon name="check" size=${13}></sw-icon>${this.message}</span>` : nothing}
          ${this.error ? html`<span class="msg err" role="alert" data-wl-error><sw-icon name="warning" size=${13}></sw-icon>${this.error}</span>` : nothing}
          <span class="grow"></span><span class="muted">${t('whiteLabel.stays')}</span>
        </div>
      </div>
    </sw-card>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-brand-installer': SystemBrandInstaller;
  }
}

