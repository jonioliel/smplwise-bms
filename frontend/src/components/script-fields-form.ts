import { LitElement, html, css, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { aIcon } from './automation-icons';
import { automationsStyles } from '../styles/automations-glass';
import { applyAutomationsGlass } from '../api/automations-demo';
import type { ScriptField } from '../api/automations';

import { fieldDefaults, missingFields, type FieldChoice } from '../screens/automations-logic';
export type { FieldChoice };
const clampNum = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n));

/**
 * CR-017 `<script-fields-form .fields .values .entityChoices>`: the short form of a script that has `fields` (CR §4.4): the five selector kinds
 * of the contract (number, boolean, select, text, entity; a `locked` selector is not shown - its default travels with the script). The form keeps
 * the values; every edit raises `change` {values, valid} (valid = every required field has a value). Targets are 44 px. The server validates again.
 */
@customElement('script-fields-form')
export class ScriptFieldsForm extends LitElement {
  @property({ attribute: false }) fields: ScriptField[] = [];
  /** Starting values (default: the fields' defaults). */
  @property({ attribute: false }) values: Record<string, unknown> | null = null;
  /** The entities an `entity` field may choose from (scoped by the server for the caller); the default value is always offered. */
  @property({ attribute: false }) entityChoices: Record<string, FieldChoice[]> = {};
  @state() private current: Record<string, unknown> = {};

  static styles = [...automationsStyles, css`
    :host {
      display: block;
    }
    .form {
      display: flex;
      flex-direction: column;
      border-radius: var(--dv-radius-md);
      background: var(--dv-surface);
      border: 1px solid var(--dv-border);
      padding: 4px 16px;
    }
    .f {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      min-block-size: 64px;
      border-block-end: 1px solid var(--dv-border);
      flex-wrap: wrap;
      padding-block: 8px;
    }
    .f:last-child {
      border-block-end: 0;
    }
    .f > .nm {
      font-size: var(--sw-fs-md);
      font-weight: 600;
    }
    .f > .nm small {
      display: block;
      font-size: var(--sw-fs-sm);
      font-weight: 500;
      color: var(--dv-text-2);
    }
    .f.bad .nm {
      color: var(--dv-danger);
    }
    .stepper {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      block-size: 44px;
      padding: 3px;
      border-radius: var(--dv-radius-control);
      background: var(--dv-surface-3);
    }
    .stepper button {
      inline-size: 38px;
      block-size: 38px;
      border: 0;
      border-radius: 50%;
      background: transparent;
      display: grid;
      place-items: center;
      color: var(--dv-text);
    }
    .stepper button:hover {
      background: var(--mm-seg-thumb);
      box-shadow: var(--dv-shadow-control);
    }
    .stepper button[disabled] {
      opacity: 0.35;
      pointer-events: none;
    }
    .stepper input {
      inline-size: 54px;
      text-align: center;
      border: 0;
      background: transparent;
      font: inherit;
      font-weight: 700;
      font-size: var(--sw-fs-lg);
      color: var(--dv-text);
      font-variant-numeric: tabular-nums;
      -moz-appearance: textfield;
      appearance: textfield;
    }
    .stepper input:focus-visible {
      outline: 2px solid var(--dv-focus);
      border-radius: var(--sw-r-sm);
    }
    .stepper small {
      color: var(--dv-text-2);
      font-size: var(--sw-fs-sm);
      margin-inline-end: 4px;
    }
    .inp {
      min-inline-size: 150px;
      max-inline-size: 100%;
    }
  `];

  protected willUpdate(c: PropertyValues<this>) {
    if (c.has('fields') || c.has('values')) this.current = { ...fieldDefaults(this.fields), ...(this.values ?? {}) };
  }

  connectedCallback() {
    super.connectedCallback();
    applyAutomationsGlass(this);
  }

  private set(key: string, v: unknown) {
    this.current = { ...this.current, [key]: v };
    this.dispatchEvent(new CustomEvent('change', { detail: { values: { ...this.current }, valid: missingFields(this.fields, this.current).length === 0 }, bubbles: true, composed: true }));
  }

  private num(f: ScriptField & { selector: { kind: 'number'; min: number; max: number; step?: number; unit?: string } }): TemplateResult {
    const s = f.selector;
    const step = s.step ?? 1;
    const v = typeof this.current[f.key] === 'number' ? (this.current[f.key] as number) : Number(s.min);
    return html`<div class="stepper" role="group" aria-label=${f.name}>
      <button type="button" aria-label="פחות" data-field-minus=${f.key} ?disabled=${v <= s.min} @click=${() => this.set(f.key, clampNum(Math.round((v - step) * 1000) / 1000, s.min, s.max))}>${aIcon('minus')}</button>
      <input type="number" inputmode="decimal" min=${s.min} max=${s.max} step=${step} .value=${String(v)} aria-label=${f.name} data-field=${f.key} @change=${(e: Event) => { const n = Number((e.target as HTMLInputElement).value); if (Number.isFinite(n)) this.set(f.key, clampNum(n, s.min, s.max)); }} />
      ${s.unit ? html`<small>${s.unit}</small>` : nothing}
      <button type="button" aria-label="יותר" data-field-plus=${f.key} ?disabled=${v >= s.max} @click=${() => this.set(f.key, clampNum(Math.round((v + step) * 1000) / 1000, s.min, s.max))}>${aIcon('plus')}</button>
    </div>`;
  }

  private control(f: ScriptField): TemplateResult | typeof nothing {
    const s = f.selector;
    const v = this.current[f.key];
    switch (s.kind) {
      case 'number': return this.num(f as ScriptField & { selector: { kind: 'number'; min: number; max: number } });
      case 'boolean':
        return html`<button type="button" class="tog" role="switch" aria-checked=${String(v === true)} aria-label=${f.name} data-field=${f.key} @click=${() => this.set(f.key, v !== true)}></button>`;
      case 'select':
        return html`<select class="inp" aria-label=${f.name} data-field=${f.key} @change=${(e: Event) => this.set(f.key, (e.target as HTMLSelectElement).value)}>${s.options.map((o) => html`<option value=${o} ?selected=${v === o}>${o}</option>`)}</select>`;
      case 'text':
        return html`<input class="inp" type="text" maxlength=${s.max ?? 200} .value=${typeof v === 'string' ? v : ''} aria-label=${f.name} data-field=${f.key} @input=${(e: Event) => this.set(f.key, (e.target as HTMLInputElement).value)} />`;
      case 'entity': {
        const base = this.entityChoices[f.key] ?? [];
        const dflt = (Array.isArray(f.default) ? f.default : f.default ? [f.default] : []).map(String);
        const options = [...base, ...dflt.filter((d) => !base.some((b) => b.value === d)).map((d) => ({ value: d, label: d.split('.').slice(1).join('.').replace(/_/g, ' ') }))];
        const cur = Array.isArray(v) ? String(v[0] ?? '') : String(v ?? '');
        return html`<select class="inp" aria-label=${f.name} data-field=${f.key} @change=${(e: Event) => { const x = (e.target as HTMLSelectElement).value; this.set(f.key, Array.isArray(f.default) ? [x] : x); }}>${options.map((o) => html`<option value=${o.value} ?selected=${cur === o.value}>${o.label}</option>`)}</select>`;
      }
      default: return nothing;
    }
  }

  render() {
    const missing = new Set(missingFields(this.fields, this.current));
    const shown = this.fields.filter((f) => f.selector.kind !== 'locked');
    if (!shown.length) return nothing;
    return html`<div class="form" data-script-form>${shown.map((f) => html`<div class=${`f ${missing.has(f.key) ? 'bad' : ''}`} data-field-row=${f.key}><span class="nm">${f.name}${f.required ? ' *' : ''}</span>${this.control(f)}</div>`)}</div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'script-fields-form': ScriptFieldsForm;
  }
}
