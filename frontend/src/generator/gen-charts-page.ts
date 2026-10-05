import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './gen-chart-set';
import type { GenDevice, GenRange, HistoryResponse, GenSettings } from '../api/generator';
import { getSettings } from '../api/generator';
import { navigate } from '../router';
import { he } from '../i18n/he';
import { elecCss } from '../electricity/styles';
import { SkinController } from '../design/skin';
import { genCss } from './gen-styles';
import { capsOf, customRangeError, fill, historyRoles, metricsOf, RANGES, toCsv } from './gen-logic';

const G = he.generator;
const pad = (n: number) => String(n).padStart(2, '0');
const local = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** תשתיות › גנרטור › גרפים: the full-size chart of one metric with the ranges 1h / 24h / 7d / 30d / custom (CSV export of what is shown). Only mapped metrics are offered. */
@customElement('gen-charts-page')
export class GenChartsPage extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @property({ attribute: false }) device!: GenDevice;
  @property({ attribute: false }) params: URLSearchParams = new URLSearchParams();
  @state() private range: GenRange = '24h';
  @state() private from = local(new Date(Date.now() - 2 * 86400_000));
  @state() private to = local(new Date());
  @state() private applied: { from: string; to: string } = { from: '', to: '' };
  @state() private data: HistoryResponse | null = null;
  @state() private retention = 35;
  @state() private rangeError = '';

  static styles = [elecCss, genCss];

  connectedCallback() {
    super.connectedCallback();
    void getSettings().then((s: GenSettings) => (this.retention = s.history_retention_days)).catch(() => undefined);
  }

  private pickRange(r: GenRange) {
    this.range = r;
    this.rangeError = '';
    if (r === 'custom') this.apply();
  }
  private apply() {
    const e = customRangeError(this.from, this.to, this.retention);
    this.rangeError = e ? G.charts.rangeError[e] : '';
    if (!e) this.applied = { from: this.from, to: this.to };
  }
  private csv() {
    if (!this.data) return;
    const roles = historyRoles(metricsOf(capsOf(this.device)));
    const blob = new Blob(['﻿', toCsv(this.data, roles)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `generator-${this.range}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  render() {
    const d = this.device;
    const caps = capsOf(d);
    const ms = metricsOf(caps);
    const metric = this.params.get('metric') && ms.some((m) => m.role === this.params.get('metric')) ? this.params.get('metric')! : ms[0]?.role ?? '';
    const ready = this.range !== 'custom' || !!this.applied.from;
    return html`<div class="col" data-gen-charts>
      <div class="row"><span class="h2">${G.charts.title}</span><div class="sp"></div>
        <div class="seg" role="group" aria-label=${G.charts.title} data-range>${RANGES.map((r) => html`<button aria-pressed=${this.range === r} @click=${() => this.pickRange(r)}>${G.charts.ranges[r]}</button>`)}</div>
        <button class="btn sm" @click=${() => this.csv()} ?disabled=${!this.data} data-csv>${G.charts.csv}</button></div>
      ${this.range === 'custom' ? html`<div class="row" data-custom><label class="row mut">${G.charts.from} <input type="datetime-local" .value=${this.from} @input=${(e: Event) => (this.from = (e.target as HTMLInputElement).value)} /></label>
        <label class="row mut">${G.charts.to} <input type="datetime-local" .value=${this.to} @input=${(e: Event) => (this.to = (e.target as HTMLInputElement).value)} /></label>
        <button class="btn sm pri" @click=${() => this.apply()}>${G.charts.apply}</button>${this.rangeError ? html`<span class="bad" role="alert">${this.rangeError}</span>` : nothing}</div>` : nothing}
      ${ms.length ? html`<div class="seg" role="group" data-metrics>${ms.map((m) => html`<button aria-pressed=${m.role === metric} @click=${() => navigate('/infra/generator/charts', { device: d.id, metric: m.role })}>${(G.charts.metrics as Record<string, string>)[m.role]}</button>`)}</div>` : nothing}
      ${ready ? html`<gen-chart-set mode="big" .deviceId=${d.id} .roles=${historyRoles(ms)} .range=${this.range} .from=${this.applied.from} .to=${this.applied.to} .metric=${metric} @history-loaded=${(e: CustomEvent<HistoryResponse>) => (this.data = e.detail)}></gen-chart-set>` : nothing}
      <div class="mut">${fill(G.charts.retention, { n: this.retention })}</div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'gen-charts-page': GenChartsPage;
  }
}
