import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './sw-segmented';
import type { SegmentedChange } from './sw-segmented';
import { filterKeys, saveChosen, type BuildingFilterMeta } from './building-filter-logic';
import { tr } from '../i18n/msg/components';

/**
 * MULTI-BUILDING-NEXT-2500 (T119 MB-SCREENS-FILTER): THE building filter of a list on a multi-building site - one compact segmented row,
 * "כל האתר" then the buildings the caller's items sit in (the server's `building_filter`). A screen draws it only when its list answer
 * carries that key (the switch and the filter setting on, items in two or more buildings): a site of one building, the switch off, or a
 * caller whose list is one building's anyway sees nothing new.
 *
 *     ${meta ? html`<sw-building-filter .filter=${meta} value=${this.building}
 *       @building-change=${(e: CustomEvent<{ value: string }>) => (this.building = e.detail.value)}></sw-building-filter>` : nothing}
 *
 * Controlled like sw-segmented: a press fires `building-change` ({ value }, '' = the whole site; not bubbling) and the host re-renders
 * with the new `value`. The choice is remembered on the device (one key for every list). Display only: it never grants anything.
 */
@customElement('sw-building-filter')
export class SwBuildingFilter extends LitElement {
  @property({ attribute: false }) filter: BuildingFilterMeta | null = null;
  @property() value = '';

  static styles = css`
    :host {
      display: block;
      min-inline-size: 0;
    }
    sw-segmented {
      max-inline-size: 100%;
    }
  `;

  private choose(value: string) {
    saveChosen(value);
    this.dispatchEvent(new CustomEvent('building-change', { detail: { value } }));
  }

  render() {
    const f = this.filter;
    if (!f || f.buildings.length < 2) return nothing;
    return html`<sw-segmented size="sm" radio data-building-filter label=${tr('בניין')} value=${this.value}
      .options=${filterKeys(f).map((k) => ({ ...k, attrs: { 'data-building': k.value || 'all' } }))}
      @change=${(e: CustomEvent<SegmentedChange>) => this.choose(e.detail.value)}></sw-segmented>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-building-filter': SwBuildingFilter;
  }
}
