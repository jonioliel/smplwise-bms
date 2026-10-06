/**
 * Plan Studio 5 (T088, ST5): the import dialog of a signed plan package. The editor uploads the file for a dry run
 * (nothing is written), this dialog shows where the package comes from, what the draft would gain or lose in the chosen
 * mode (replace / merge) and what the package names that this system lacks; "ייבוא לטיוטה" then imports exactly what was
 * shown (the server checks the draft revision and the result hash). A package signed by another system needs the
 * person's explicit trust. Pure render function: the editor owns the state.
 */
import { css, html, nothing, type TemplateResult } from 'lit';
import type { PackageMode, PackageOrigin, PackagePreview } from '../api/geometry';
import { pkgCollection, pkgLang, pkgT } from '../i18n/plan-package';

export interface PackageImportState {
  file: File;
  mode: PackageMode;
  preview: PackagePreview | null;
  /** 'check' while the dry run runs, 'import' while the import runs. */
  busy: 'check' | 'import' | null;
  error: string;
  acceptForeign: boolean;
  /** The origin of a package the server will not check until the person trusts it (409 package_foreign on the preview). */
  foreign?: PackageOrigin | null;
}

export interface PackageImportActions {
  setMode(mode: PackageMode): void;
  setAcceptForeign(on: boolean): void;
  confirm(): void;
  cancel(): void;
}

const ORDER = ['walls', 'openings', 'rooms', 'objects', 'labels', 'connectors', 'levels', 'circuits', 'groups'];

function dateOf(iso: string | null, lang: 'he' | 'en'): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(lang === 'en' ? 'en-GB' : 'he-IL', { dateStyle: 'short', timeStyle: 'short' });
}

function renderChanges(p: PackagePreview, lang: 'he' | 'en'): TemplateResult {
  if (p.diff.same) return html`<div class="pkg-line" data-pkg-nochange>${pkgT('noChanges', lang)}</div>`;
  const names = Object.keys(p.diff.collections).sort((a, b) => (ORDER.indexOf(a) + 99 * +(ORDER.indexOf(a) < 0)) - (ORDER.indexOf(b) + 99 * +(ORDER.indexOf(b) < 0)));
  return html`<ul class="pkg-list" data-pkg-diff>
    ${names.map((name) => {
      const c = p.diff.collections[name];
      const parts = [
        c.added.length ? `${pkgT('added', lang)} ${c.added.length}` : '',
        c.removed.length ? `${pkgT('removed', lang)} ${c.removed.length}` : '',
        c.changed.length ? `${pkgT('changed', lang)} ${c.changed.length}` : '',
      ].filter(Boolean);
      return html`<li data-pkg-coll=${name}><strong>${pkgCollection(name, lang)}</strong> <span>${parts.join(' · ')}</span></li>`;
    })}
    ${p.diff.calibration_changed ? html`<li data-pkg-calibration>${pkgT('calibration', lang)}</li>` : nothing}
  </ul>`;
}

function renderMissing(p: PackagePreview, lang: 'he' | 'en'): TemplateResult | typeof nothing {
  const e = p.entities;
  const rows: [string, string, string[]][] = [
    ['cameras', pkgT('missing', lang), e.anchors_missing.map((a) => a.name || a.resource_id)],
    ['unplaced', pkgT('unplaced', lang), e.anchors_unplaced.map((a) => a.name || a.resource_id)],
    ['rooms', pkgT('rooms', lang), e.rooms_missing],
    ['switches', pkgT('switches', lang), e.switches_missing],
    ['items', pkgT('items', lang), e.items_missing],
  ];
  const shown = rows.filter(([, , list]) => list.length);
  const added = e.items_added.length ? html`<li data-pkg-items-added><strong>${pkgT('itemsAdded', lang)}</strong> <bdi>${e.items_added.join(', ')}</bdi></li>` : nothing;
  const differ = e.items_differ.length ? html`<li data-pkg-items-differ><strong>${pkgT('itemsDiffer', lang)}</strong> <bdi>${e.items_differ.join(', ')}</bdi></li>` : nothing;
  if (!shown.length && added === nothing && differ === nothing) return nothing;
  return html`<div class="pkg-sec" data-pkg-missing>
    <div class="pkg-h">${pkgT('missing', lang)}</div>
    <ul class="pkg-list">
      ${shown.map(([key, label, list]) => html`<li data-pkg-missing-kind=${key}><strong>${key === 'cameras' ? pkgT('cameras', lang) : label}</strong> <bdi>${list.slice(0, 12).join(', ')}${list.length > 12 ? ` +${list.length - 12}` : ''}</bdi></li>`)}
      ${added}${differ}
    </ul>
  </div>`;
}

export function renderPackageImportDialog(s: PackageImportState, a: PackageImportActions): TemplateResult {
  const lang = pkgLang();
  const p = s.preview;
  const foreign = !!p && (p.origin.trust !== 'installation' || !!p.origin.retired_key);
  const canImport = !!p && !s.busy && (!foreign || s.acceptForeign);
  const gate = !p && s.foreign ? s.foreign : null;
  return html`<sw-dialog open wide heading=${pkgT('title', lang)} subheading=${s.file.name} data-pkg-dialog ?locked=${s.busy === 'import'} @close=${() => a.cancel()}>
    <div class="modes" role="group" aria-label=${pkgT('mode', lang)}>
      ${(['replace', 'merge'] as PackageMode[]).map((m) => html`<button class=${s.mode === m ? 'on' : ''} aria-pressed=${s.mode === m} data-pkg-mode=${m} ?disabled=${!!s.busy} @click=${() => a.setMode(m)}>${pkgT(m, lang)}</button>`)}
    </div>
    ${s.busy === 'check' ? html`<div class="note" data-pkg-checking>${pkgT('checking', lang)}</div>` : nothing}
    ${s.error ? html`<div class="err" data-pkg-error>${s.error}</div>` : nothing}
    ${gate
      ? html`<div class="pkg-sec" data-pkg-origin data-pkg-gate>
            <div class="pkg-h">${pkgT('source', lang)}</div>
            <div class="pkg-line"><bdi>${gate.floor_name ?? ''}</bdi> · ${pkgT(gate.stage === 'draft' ? 'draft' : 'published', lang)} · <bdi>${dateOf(gate.generated_at, lang)}</bdi></div>
            <div class="pkg-line warn" data-pkg-trust=${gate.trust}>${pkgT('signedForeign', lang)}</div>
          </div>
          <label class="pkg-trust"><input type="checkbox" data-pkg-accept-foreign .checked=${s.acceptForeign} ?disabled=${!!s.busy} @change=${(e: Event) => a.setAcceptForeign((e.target as HTMLInputElement).checked)} /> ${pkgT('trustForeign', lang)}</label>`
      : nothing}
    ${p
      ? html`<div class="pkg-sec" data-pkg-origin>
            <div class="pkg-h">${pkgT('source', lang)}</div>
            <div class="pkg-line"><bdi>${p.origin.floor_name ?? ''}</bdi> · ${pkgT(p.origin.stage === 'draft' ? 'draft' : 'published', lang)} · <bdi>${dateOf(p.origin.generated_at, lang)}</bdi></div>
            <div class="pkg-line ${foreign ? 'warn' : 'ok'}" data-pkg-trust=${p.origin.trust}>${pkgT(foreign ? 'signedForeign' : 'signedHere', lang)}</div>
          </div>
          <div class="pkg-sec">
            <div class="pkg-h">${pkgT('changes', lang)}</div>
            ${renderChanges(p, lang)}
            ${p.warnings.includes('other_drawing') ? html`<div class="pkg-line warn" data-pkg-other-drawing>${pkgT('otherDrawing', lang)}</div>` : nothing}
            ${p.warnings.includes('newer_app_version') ? html`<div class="pkg-line warn" data-pkg-newer>${pkgT('newerApp', lang)}</div>` : nothing}
            ${p.issue_count ? html`<div class="pkg-line" data-pkg-issues>${pkgT('issues', lang)}: ${p.issue_count}</div>` : nothing}
          </div>
          ${renderMissing(p, lang)}
          ${foreign
            ? html`<label class="pkg-trust"><input type="checkbox" data-pkg-accept-foreign .checked=${s.acceptForeign} @change=${(e: Event) => a.setAcceptForeign((e.target as HTMLInputElement).checked)} /> ${pkgT('trustForeign', lang)}</label>`
            : nothing}`
      : nothing}
    <sw-button slot="footer" variant="ghost" data-pkg-cancel ?disabled=${s.busy === 'import'} @click=${() => a.cancel()}>${pkgT('cancel', lang)}</sw-button>
    <sw-button slot="footer" icon="download" data-pkg-confirm ?disabled=${!canImport} @click=${() => canImport && a.confirm()}>${s.busy === 'import' ? pkgT('importing', lang) : pkgT('importDraft', lang)}</sw-button>
  </sw-dialog>`;
}

export const packageDialogStyles = css`
  .pkg-sec {
    display: grid;
    gap: 4px;
  }
  .pkg-h {
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-3);
    font-weight: var(--sw-fw-semibold);
  }
  .pkg-line {
    font-size: var(--sw-fs-sm);
  }
  .pkg-line.warn {
    color: var(--sw-warning-text);
  }
  .pkg-line.ok {
    color: var(--sw-text-2);
  }
  .pkg-list {
    margin: 0;
    padding-inline-start: 18px;
    display: grid;
    gap: 2px;
    font-size: var(--sw-fs-sm);
  }
  .pkg-trust {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: var(--sw-fs-sm);
  }
  .exports label.btnlink {
    display: inline-flex;
    align-items: center;
  }
`;
