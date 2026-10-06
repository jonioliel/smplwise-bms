/**
 * Test harness (evidence-plan-package.spec.ts, fixture part): mounts the plan package import dialog and the studio
 * panel's export row with the real render functions, styles and API helpers, outside the editor - the editor needs a
 * backend to open its structure tool. The flow mirrors explore-plan-editor (startPackageImport / previewPackage /
 * confirmPackageImport); the live part of the spec drives the editor itself. Served by the vite dev server only.
 */
import { LitElement, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../../src/components/sw-dialog';
import '../../src/components/sw-button';
import '../../src/components/sw-card';
import { ApiError, describeError } from '../../src/api/client';
import { importPlanPackage, previewPlanPackage, type PackageMode, type PackageOrigin } from '../../src/api/geometry';
import { packageDialogStyles, renderPackageImportDialog, type PackageImportState } from '../../src/screens/plan-package-dialog';
import { studioPanelStyles } from '../../src/screens/plan-studio-panel';
import { pkgT } from '../../src/i18n/plan-package';

@customElement('pkg-harness')
export class PkgHarness extends LitElement {
  static styles = [studioPanelStyles, packageDialogStyles];
  @state() s: PackageImportState | null = null;
  @state() imported = 0;
  versionId = 'v1';

  async start(file: File) {
    this.s = { file, mode: 'replace', preview: null, busy: null, error: '', acceptForeign: false, foreign: null };
    await this.preview('replace');
  }

  async preview(mode: PackageMode) {
    const s = this.s;
    if (!s || s.busy) return;
    this.s = { ...s, mode, busy: 'check', error: '', preview: s.mode === mode ? s.preview : null };
    try {
      const preview = await previewPlanPackage(this.versionId, s.file, mode, s.acceptForeign);
      this.s = { ...this.s!, preview, busy: null };
    } catch (err) {
      const origin = err instanceof ApiError && err.code === 'package_foreign' ? ((err.body.details as { origin?: PackageOrigin } | undefined)?.origin ?? null) : null;
      this.s = origin
        ? { ...this.s!, preview: null, busy: null, error: '', foreign: origin, acceptForeign: false }
        : { ...this.s!, preview: null, busy: null, error: describeError(err) };
    }
  }

  trust(on: boolean) {
    const s = this.s;
    if (!s) return;
    this.s = { ...s, acceptForeign: on };
    if (on && !s.preview && s.foreign) void this.preview(s.mode);
  }

  async confirm() {
    const s = this.s;
    if (!s?.preview || s.busy) return;
    this.s = { ...s, busy: 'import', error: '' };
    try {
      await importPlanPackage(this.versionId, s.file, s.preview, s.acceptForeign);
      this.s = null;
      this.imported += 1;
    } catch (err) {
      this.s = { ...this.s!, busy: null, error: describeError(err) };
    }
  }

  render() {
    return html`<div class="exports" data-harness-exports>
        <span class="btnlink">${pkgT('dxf')}</span><span class="btnlink">${pkgT('exportPackage')}</span>
        <label class="btnlink">${pkgT('importPackage')}<input type="file" data-import-package hidden @change=${(e: Event) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) void this.start(f); (e.target as HTMLInputElement).value = ''; }} /></label>
      </div>
      <div data-harness-imported=${this.imported}></div>
      ${this.s
        ? renderPackageImportDialog(this.s, {
            setMode: (m) => void this.preview(m),
            setAcceptForeign: (on) => this.trust(on),
            confirm: () => void this.confirm(),
            cancel: () => { if (this.s?.busy !== 'import') this.s = null; },
          })
        : nothing}`;
  }
}
