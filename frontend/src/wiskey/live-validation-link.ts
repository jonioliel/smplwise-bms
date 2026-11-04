// WISKEY-LIVE-VALIDATION-2390: the station drawer's one line to the acceptance tool (הגדרות › בדיקת קבלה לעמדות), in its technical
// section. Shown to whoever may run the checks (access.stations.manage somewhere; the server checks the station itself); not in the demo.
import { html, nothing, type TemplateResult } from 'lit';
import { canAnywhere, isApi } from '../api/session';
import { validationHref } from '../api/wiskey-validation';

export function liveValidationRow(stationId: string): TemplateResult | typeof nothing {
  if (!isApi() || !canAnywhere('access.stations.manage')) return nothing; // not in the demo: no existing baseline changes
  return html`<dt>בדיקת קבלה</dt><dd><a href=${validationHref(stationId)} data-wk-live-validation=${stationId}>הרצת בדיקת קבלה לעמדה</a></dd>`;
}
