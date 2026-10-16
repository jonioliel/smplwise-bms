import { html, nothing, type TemplateResult } from 'lit';
import { bidi } from '../i18n/bidi';
import type { LocationsAnswer } from '../api/tickets-locations';
import { OTHER, OTHER_MAX, addressLine, pickerOptions } from './org-locations-model';
import { lt } from './org-locations-text';

export interface LocationPickerOptions {
  ans: LocationsAnswer | null;
  pick: string;
  other: string;
  disabled?: boolean;
  /** the "other" text is too long (the form's own error line) */
  error?: TemplateResult | typeof nothing;
  onPick: (value: string) => void;
  onOther: (value: string) => void;
  /** the label of the free-text field when there is no list (the form's old "מיקום" label) */
  label?: string;
  /** the RFQ form's old free-text field carried `data-rfq-place` (kept on the free-text input for the existing specs) */
  rfqPlaceAttr?: boolean;
}

/**
 * CR-ORG-LOCATIONS: the location field of the creation forms (RFQ, service request) - a select of the organisation's ACTIVE locations
 * ("no location", each location as "name - street, city", "other (free text)"), the free-text field under it when "other" is chosen.
 * While the list is loading, or when the organisation has no locations, it is the old free-text field (nothing regresses). Rendered
 * inside the form's own `.frm` grid with its `.fld` / `.inp` classes; every value is text (Lit escapes it).
 */
export function locationPicker(o: LocationPickerOptions): TemplateResult {
  const options = pickerOptions(o.ans);
  const otherField = (label: string) => html`<label class="fld">${label}<input class="inp" data-location-other ?data-rfq-place=${!!o.rfqPlaceAttr} maxlength=${OTHER_MAX} placeholder=${lt('otherPh')}
    ?disabled=${o.disabled} .value=${o.other} @input=${(e: Event) => o.onOther((e.target as HTMLInputElement).value)} />${o.error ?? nothing}</label>`;
  if (!options.length) return otherField(o.label ?? lt('fLocation'));
  return html`<label class="fld">${lt('fLocation')}<select class="inp" data-location-pick ?disabled=${o.disabled}
      @change=${(e: Event) => o.onPick((e.target as HTMLSelectElement).value)}>
      <option value="" ?selected=${o.pick === ''}>${lt('pickNone')}</option>
      ${options.map((l) => html`<option value=${l.id} ?selected=${o.pick === l.id}>${bidi([l.name, addressLine(l)].filter(Boolean).join(' – '))}</option>`)}
      <option value=${OTHER} ?selected=${o.pick === OTHER}>${lt('pickOther')}</option>
    </select>${o.pick !== OTHER ? o.error ?? nothing : nothing}</label>
    ${o.pick === OTHER ? otherField(lt('otherLabel')) : nothing}`;
}
