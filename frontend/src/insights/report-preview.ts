import { html, nothing, type TemplateResult } from 'lit';
import type { ReportModel, SectionId } from '../api/insights';
import { ix, type IxKey, type IxLang } from '../i18n/insights';
import { deviceLabel, fmtChange, fmtHM, fmtNum, fmtWhen, monthLabel, reportFigures, shiftMonth } from './model';

/**
 * CR-INSIGHT215: the in-page preview of the monthly building report - the SAME model the PDF is made from, one section after the other in
 * the report's own language (the preview speaks the language the PDF will). Pure rendering: the screen owns the data and the picks.
 * Counts and names only: no person, no entity id.
 */
export interface PreviewOptions {
  /** The sections to draw (picked and not left out by the server), in report order. */
  sections: readonly SectionId[];
  /** Links in the doors / waste headers and the "not configured" row. */
  canDoors: boolean;
  canWaste: boolean;
  canManage: boolean;
}

const th = (lang: IxLang, k: IxKey, cls = '') => html`<th class=${cls}>${ix(k, undefined, lang)}</th>`;

function figures(model: ReportModel, lang: IxLang): TemplateResult | typeof nothing {
  const figs = reportFigures(model, lang);
  if (figs.length) {
    return html`<div class="figs">${figs.map(
      (f) => html`<div class="fig" data-fig=${f.id}><div class="l">${ix(f.label, undefined, lang)}</div>
        <div class="v">${f.value}${f.unit ? html` <small>${ix(f.unit, undefined, lang)}</small>` : nothing}</div>
        ${f.note ? html`<div class="d ${f.tone === 'up' ? 'up' : f.tone === 'down' ? 'down' : 'muted'}">${f.note}</div>` : nothing}</div>`,
    )}</div>`;
  }
  const lines = model.data.summary ?? [];
  return lines.length ? html`<div class="tw"><table class="sumtab"><tbody>${lines.map((l) => html`<tr><td>${l.title}</td><td>${l.text}</td></tr>`)}</tbody></table></div>` : nothing;
}

function sectionBody(s: SectionId, model: ReportModel, lang: IxLang, o: PreviewOptions): { head: string; right?: TemplateResult | string; body: TemplateResult | typeof nothing } {
  const d = model.data;
  const T = (k: IxKey, v?: Record<string, string | number>) => ix(k, v, lang);
  const head = T(`sec_${s}` as IxKey);
  switch (s) {
    case 'summary':
      return { head, right: d.energy?.available ? T('vsMonth', { m: monthLabel(shiftMonth(model.month, -1), lang) }) : '', body: figures(model, lang) };
    case 'tickets': {
      const t = d.tickets;
      if (!t) return { head, body: nothing };
      return {
        head,
        right: t.median_close_h !== null ? T('medianClose', { h: fmtNum(t.median_close_h, 1) }) : '',
        body: html`<div class="figs" style="margin-block-end:12px">
            <div class="fig"><div class="l">${T('opened')}</div><div class="v">${fmtNum(t.opened)}</div></div>
            <div class="fig"><div class="l">${T('closed')}</div><div class="v">${fmtNum(t.closed)}</div></div>
            <div class="fig"><div class="l">${T('openAtEnd')}</div><div class="v">${fmtNum(t.open_end)}</div></div>
            <div class="fig"><div class="l">${T('overdue')}</div><div class="v">${fmtNum(t.overdue)}</div></div></div>
          ${t.by_department.length ? html`<div class="tw"><table><thead><tr>${th(lang, 'department')}${th(lang, 'opened', 'n')}${th(lang, 'closed', 'n')}</tr></thead>
            <tbody>${t.by_department.map((r) => html`<tr><td>${r.name}</td><td class="n">${r.opened}</td><td class="n">${r.closed}</td></tr>`)}</tbody></table></div>` : nothing}
          ${t.oldest_open.length ? html`<div class="tw" style="margin-block-start:12px"><table><thead><tr>${th(lang, 'number')}${th(lang, 'department')}${th(lang, 'daysOpen', 'n')}</tr></thead>
            <tbody>${t.oldest_open.map((r) => html`<tr><td class="num">${r.number}</td><td>${r.department}</td><td class="n">${r.age_days}</td></tr>`)}</tbody></table></div>` : nothing}`,
      };
    }
    case 'energy': {
      const e = d.energy;
      if (!e) return { head, body: nothing };
      if (!e.available) return { head, body: html`<div class="muted">${T('noData')}</div>` };
      const ch = e.change_pct;
      return {
        head,
        right: html`<span class="num">${fmtNum(e.total_kwh)} ${T('kwh')}</span>`,
        body: html`<div class="split"><div class="tw"><table><thead><tr>${th(lang, 'meter')}${th(lang, 'kwh', 'n')}${th(lang, 'prevMonthCol', 'n')}${th(lang, 'lastYear', 'n hide-m')}</tr></thead>
            <tbody>${e.meters.map((m) => html`<tr><td>${m.name}</td><td class="n">${fmtNum(m.kwh)}</td><td class="n">${fmtNum(m.prev_kwh)}</td><td class="n hide-m">${fmtNum(m.last_year_kwh)}</td></tr>`)}</tbody></table></div>
          <table class="sumtab"><tbody>
            <tr><td>${T('total')}</td><td class="n">${fmtNum(e.total_kwh)} ${T('kwh')}</td></tr>
            <tr><td>${T('prevMonthCol')}</td><td class="n">${fmtNum(e.prev_total_kwh)} ${T('kwh')}</td></tr>
            <tr><td>${T('change')}</td><td class="n ${ch !== null && ch !== undefined ? (ch > 0 ? 'up' : ch < 0 ? 'down' : '') : ''}">${fmtChange(ch, lang)}</td></tr>
          </tbody></table></div>`,
      };
    }
    case 'elevators': {
      const e = d.elevators;
      if (!e) return { head, body: nothing };
      return {
        head,
        right: html`<span class="num">${fmtHM(e.down_min)}</span>`,
        body: html`<div class="tw"><table><thead><tr>${th(lang, 'elevator')}${th(lang, 'faultCol', 'n')}${th(lang, 'outCol', 'n')}${th(lang, 'fireCol', 'n hide-m')}</tr></thead>
          <tbody>${e.items.map((i) => html`<tr><td>${i.name}${i.history_from ? html` <span class="muted">· ${T('historyFrom', { d: fmtWhen(i.history_from) })}</span>` : nothing}</td>
            <td class="n">${fmtHM(i.fault_min)}</td><td class="n">${fmtHM(i.out_min)}</td><td class="n hide-m">${fmtHM(i.fire_min)}</td></tr>`)}</tbody></table></div>`,
      };
    }
    case 'generator': {
      const g = d.generator;
      if (!g) return { head, body: nothing };
      const runs = g.runs;
      const alerts = g.alerts !== false;
      const runsTable = runs
        ? html`<div class="tw" data-gen-runs><table><thead><tr>${th(lang, 'device')}${th(lang, 'runsCol', 'n')}${th(lang, 'runHoursCol', 'n')}${th(lang, 'longestCol', 'n hide-m')}${th(lang, 'meterCol', 'n hide-m')}</tr></thead>
            <tbody>${runs.devices.map((x) => html`<tr><td>${x.name}</td><td class="n">${x.runs}</td><td class="n">${fmtNum(x.hours)}</td><td class="n hide-m">${x.runs ? x.longest_min : '-'}</td><td class="n hide-m">${x.meter_hours === null ? '-' : fmtNum(x.meter_hours)}</td></tr>`)}</tbody></table></div>`
        : nothing;
      const alertsTable = !alerts
        ? nothing
        : g.devices.length
          ? html`<div class="tw" data-gen-alerts><table><thead><tr>${th(lang, 'device')}${th(lang, 'critical', 'n')}${th(lang, 'alertCol', 'n')}${th(lang, 'info', 'n')}${th(lang, 'total', 'n')}</tr></thead>
            <tbody>${g.devices.map((x) => html`<tr><td>${x.name}</td><td class="n">${x.critical}</td><td class="n">${x.alert}</td><td class="n">${x.info}</td><td class="n">${x.total}</td></tr>`)}</tbody></table></div>`
          : runs ? nothing : html`<div class="muted">${T('none')}</div>`;
      return {
        head,
        right: html`<span class="num">${runs ? `${runs.runs} · ${fmtNum(runs.hours)} ${T('hoursShort')}` : g.total}</span>`,
        body: html`${runsTable}${alertsTable}`,
      };
    }
    case 'temperature': {
      const x = d.temperature;
      if (!x) return { head, body: nothing };
      return {
        head,
        right: html`<span class="num">${x.alarms}</span>`,
        body: x.units.length
          ? html`<div class="tw"><table><thead><tr>${th(lang, 'unit')}${th(lang, 'alarms', 'n')}${th(lang, 'warnings', 'n')}${th(lang, 'outOfRange', 'n hide-m')}${th(lang, 'offline', 'n hide-m')}</tr></thead>
            <tbody>${x.units.map((u) => html`<tr><td>${u.name}</td><td class="n">${u.alarms}</td><td class="n">${u.warnings}</td><td class="n hide-m">${fmtHM(u.out_min)}</td><td class="n hide-m">${u.offline || '-'}</td></tr>`)}</tbody></table></div>`
          : html`<div class="muted">${T('none')}</div>`,
      };
    }
    case 'doors': {
      const x = d.doors;
      if (!x) return { head, body: nothing };
      const link = o.canDoors ? html`<a class="muted" href="#/infra/doors" data-go="doors">${fmtNum(x.total.openings)} ${T('openings')}</a>` : html`<span class="muted num">${fmtNum(x.total.openings)} ${T('openings')}</span>`;
      return {
        head,
        right: x.configured ? link : '',
        body: x.configured
          ? html`<div class="tw"><table><thead><tr>${th(lang, 'door')}${th(lang, 'openings', 'n')}${th(lang, 'unexplained', 'n')}${th(lang, 'unverifiable', 'n')}</tr></thead>
            <tbody>${x.doors.map((r) => html`<tr><td>${r.name}</td><td class="n">${r.openings}</td>
              <td class="n">${r.unexplained ? html`<span class="state s-bad">${r.unexplained}</span>` : 0}</td>
              <td class="n">${r.unverifiable ? html`<span class="state s-unk">${r.unverifiable}</span>` : 0}</td></tr>`)}</tbody></table></div>`
          : html`<div class="muted">${T('notConfigured')}${o.canManage ? html` · <a href="#/system/infra/insights">${T('toSettings')}</a>` : nothing}</div>`,
      };
    }
    case 'cameras': {
      const c = d.cameras;
      if (!c) return { head, body: nothing };
      return {
        head,
        right: html`<span class="num">${fmtNum(c.events)} ${T('events')}</span>`,
        body: c.top.length
          ? html`<div class="tw"><table><thead><tr>${th(lang, 'cameraOrRecorder')}${th(lang, 'events', 'n')}${th(lang, 'minutes', 'n')}</tr></thead>
            <tbody>${c.top.map((r) => html`<tr><td>${r.name ?? T('recorder')}</td><td class="n">${r.count}</td><td class="n">${r.minutes}</td></tr>`)}</tbody></table></div>`
          : html`<div class="muted">${T('none')}</div>`,
      };
    }
    case 'waste': {
      const w = d.waste;
      if (!w) return { head, body: nothing };
      const hours = (w.minutes.empty_room + w.minutes.after_hours) / 60;
      const link = o.canWaste ? html`<a class="muted" href="#/infra/waste" data-go="waste">${fmtNum(hours, 0)} ${T('hoursShort')}</a>` : html`<span class="muted num">${fmtNum(hours, 0)}</span>`;
      return {
        head,
        right: link,
        body: html`${w.top.length
          ? html`<div class="tw"><table><thead><tr>${th(lang, 'place')}${th(lang, 'device', 'hide-m')}${th(lang, 'kind')}${th(lang, 'minutes', 'n')}</tr></thead>
            <tbody>${w.top.map((r) => html`<tr><td>${r.area ?? r.name}</td><td class="hide-m">${r.area ? r.name : ''}</td><td>${T(r.kind === 'empty_room' ? 'kEmpty' : 'kAfter')} · ${T(deviceLabel(r.domain))}</td><td class="n">${fmtHM(r.minutes)}</td></tr>`)}</tbody></table></div>`
          : html`<div class="muted">${T('none')}</div>`}
          ${w.anomalies ? html`<div class="tw" style="margin-block-start:12px"><table><thead><tr>${th(lang, 'meter')}${th(lang, 'kNight')}${th(lang, 'kwh', 'n')}</tr></thead>
            <tbody>${w.anomaly_top.map((r) => html`<tr><td>${r.name}</td><td class="date">${r.night}</td><td class="n">${fmtNum(r.kwh, 1)} / ${fmtNum(r.baseline_kwh, 1)}</td></tr>`)}</tbody></table></div>` : nothing}`,
      };
    }
  }
}

export function renderPreview(model: ReportModel, o: PreviewOptions): TemplateResult {
  const lang = model.lang;
  return html`<div class="doc rep-data" dir=${lang === 'he' ? 'rtl' : 'ltr'} data-report-doc data-lang=${lang}>
    ${o.sections.map((s) => {
      const r = sectionBody(s, model, lang, o);
      return html`<section class="rs" data-sec=${s}><div class="rh"><h2>${r.head}</h2>${r.right ? html`<span class="muted">${r.right}</span>` : nothing}</div>${r.body}</section>`;
    })}
  </div>`;
}
