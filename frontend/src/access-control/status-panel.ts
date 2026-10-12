/**
 * CR-036 S10: the one state panel a Settings segment (or a card) shows when its read did not give a payload, and the loading
 * skeletons - the same sentence for the same state on every card. `failure` is a status-feed `Failure`; the page names the integration
 * (a Settings page keeps the technical truth).
 */
import { html, type TemplateResult } from 'lit';
import '../components/sw-state-panel';
import type { PanelState } from '../components/sw-state-panel';
import { st, type StKey } from '../i18n/access-status';
import type { Failure } from './status-feed';

interface PanelSpec {
  panel: PanelState;
  heading: StKey;
  hint?: StKey;
  retry: boolean;
}

const SPEC: Record<Failure, PanelSpec> = {
  not_configured: { panel: 'stale', heading: 'sNotConfigured', retry: false },
  connecting: { panel: 'loading', heading: 'sConnecting', retry: false },
  unavailable: { panel: 'error', heading: 'sUnavailable', hint: 'sUnavailableHint', retry: true },
  not_installed: { panel: 'empty', heading: 'sNotInstalled', retry: false },
  unsupported: { panel: 'empty', heading: 'sUnsupported', retry: false },
  forbidden: { panel: 'forbidden', heading: 'sForbidden', retry: false },
  rate: { panel: 'stale', heading: 'sRate', hint: 'sRateHint', retry: true },
  error: { panel: 'error', heading: 'sError', retry: true },
  network: { panel: 'error', heading: 'sNetwork', retry: true },
};

/** The panel for a failed read; `message` is a sentence the server did not word (a 5xx) and replaces the preset's hint. */
export function failurePanel(failure: Failure, message: string, retry: () => void, compact = false): TemplateResult {
  const s = SPEC[failure];
  const hint = failure === 'error' && message ? message : s.hint ? st(s.hint) : '';
  return html`<sw-state-panel quiet ?compact=${compact} data-access-state=${failure} state=${s.panel} heading=${st(s.heading)} hint=${hint} actionLabel=${s.retry ? st('retry') : ''} @action=${retry}></sw-state-panel>`;
}

/** A list of `n` placeholder rows (a dot, two lines, a pill). */
export function skeletonRows(n = 4): TemplateResult {
  return html`<div class="sk-list" data-access-loading aria-busy="true">
    ${Array.from({ length: n }, () => html`<div class="sk-row"><span class="sk dotp"></span><div class="sk-main"><span class="sk l"></span><span class="sk m"></span></div><span class="sk pill"></span></div>`)}
  </div>`;
}

/** Four placeholder tiles. */
export function skeletonTiles(): TemplateResult {
  return html`<div class="tiles" data-access-loading aria-busy="true">${Array.from({ length: 4 }, () => html`<span class="sk tilebox"></span>`)}</div>`;
}
