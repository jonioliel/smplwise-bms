import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-icon';
import { describeError } from '../api/client';
import { createSchedule, deleteSchedule, getReportPreview, getReportRecipients, getSends, listSchedules, sendReport, type RecipientsResponse, type ReportParams,
  type ReportRange, type ReportRecipient, type Schedule, type SendRow, type TempUnit, type VendorChannel } from '../api/temperature';
import { REPORT_RANGES, bidi, chosenVendors, recipientPicks, unreachable, vendorChannel, vendorChannelReason, vendorChannelsOffered } from './model';
import { tempCss } from './styles';
import { TT_KEYS, tt, type TtKey } from '../i18n/temperature';
import { dateInputLang } from '../api/day-format';

type Freq = 'daily' | 'weekly' | 'monthly';

export { unreachable } from './model';

/**
 * CR-INFRA-TEMPERATURE 2.9.1 phase 2: send the temperature report on WhatsApp - a TEXT SUMMARY only for now (owner decision 2026-10-19,
 * option A; the PDF stays in the system). Recipients: the system users (a user without a confirmed number is marked and may still be chosen;
 * the row is then "not sent" with the reason) and the vendors - listed but DISABLED ("בקרוב") while vendor reports are off (the default); with
 * them on (TEMPVENDOR-295) a vendor is selectable and the channel - WhatsApp, or e-mail when that switch is on - is picked per vendor and per
 * report, never switched automatically; the reason shows when a channel is not available. A one-off send ("שליחה עכשיו") or a schedule (daily / weekly / monthly at a time). The installation's WhatsApp send hours apply:
 * a message outside the window waits for the next one (shown in the status list). Managers only (infra.temperature.manage).
 */
@customElement('temp-wa')
export class TempWa extends LitElement {
  @property({ attribute: false }) units: TempUnit[] = [];
  @property({ attribute: false }) params: ReportParams | null = null;
  @state() private rec: RecipientsResponse | null = null;
  @state() private chosen: string[] = [];
  @state() private channels: Record<string, VendorChannel> = {};
  @state() private q = '';
  @state() private range: ReportRange = '24h';
  @state() private text = '';
  @state() private scheduled = false;
  @state() private freq: Freq = 'weekly';
  @state() private dow = 0;
  @state() private dom = 1;
  @state() private at = '08:30';
  @state() private sends: SendRow[] = [];
  @state() private schedules: Schedule[] = [];
  @state() private err = '';
  @state() private ok = '';
  @state() private busy = false;
  private poll?: number;

  static styles = [tempCss, css`
    :host { position: fixed; inset: 0; z-index: var(--sw-z-modal); display: grid; place-items: center; padding: 16px; box-sizing: border-box; }
    .ovl { position: absolute; inset: 0; background: var(--sw-overlay); }
    .sheet { position: relative; inline-size: min(760px, 100%); max-block-size: calc(100dvh - 32px); display: flex; flex-direction: column; background: var(--sw-bg); border-radius: var(--sw-r-2xl); box-shadow: var(--sw-shadow-3); overflow: hidden; }
    .wh { display: flex; align-items: flex-start; gap: 10px; padding: 16px 20px 8px; }
    .wh h2 { margin: 0; font-size: var(--sw-fs-xl); }
    .wh small { color: var(--sw-text-2); }
    .wh .t { flex: 1; }
    .icb { inline-size: 36px; block-size: 36px; padding: 0; justify-content: center; }
    .wb { flex: 1; overflow: auto; padding: 8px 20px 16px; display: grid; gap: 14px; align-content: start; }
    .field { display: grid; gap: 6px; }
    .lbl { font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-semibold); }
    .in { min-block-size: var(--sw-ctl-h-sm); border-radius: var(--sw-r-md); border: 1px solid var(--sw-border); background: var(--sw-surface); color: var(--sw-text); padding: 0 10px; font: inherit; }
    .pills { display: flex; flex-wrap: wrap; gap: 6px; }
    .pill { display: inline-flex; align-items: center; gap: 6px; border-radius: var(--sw-r-pill); background: var(--sw-surface-2); padding: 3px 6px 3px 10px; font-size: var(--sw-fs-sm); }
    .pill button { border: 0; background: transparent; cursor: pointer; color: var(--sw-text-2); padding: 0; display: inline-grid; }
    .plist { border: 1px solid var(--sw-border); border-radius: var(--sw-r-md); max-block-size: 240px; overflow: auto; background: var(--sw-surface); }
    .grp { padding: 6px 12px; font-size: var(--sw-fs-xs); color: var(--sw-text-2); background: var(--sw-surface-2); position: sticky; inset-block-start: 0; }
    .row { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-block-end: 1px solid var(--sw-border); font-size: var(--sw-fs-sm); }
    .row[data-disabled] { opacity: 0.55; }
    .row .tx { flex: 1; min-inline-size: 0; }
    .row small { display: block; color: var(--sw-text-2); font-size: var(--sw-fs-xs); }
    .row .w { color: var(--sw-warning-text); font-size: var(--sw-fs-xs); }
    .row .seg { flex: none; }
    .row .seg button:disabled { opacity: 0.45; cursor: not-allowed; }
    .row .vw { display: grid; gap: 4px; justify-items: end; }
    .row input { inline-size: 18px; block-size: 18px; accent-color: var(--sw-accent); }
    .presets { display: flex; flex-wrap: wrap; gap: 6px; }
    .presets button { border: 1px solid var(--sw-border); background: var(--sw-surface); border-radius: var(--sw-r-pill); padding: 5px 12px; font: inherit; font-size: var(--sw-fs-sm); color: var(--sw-text); cursor: pointer; }
    .presets button[aria-pressed='true'] { border-color: var(--sw-accent); background: var(--sw-accent-soft); color: var(--sw-accent-text); font-weight: var(--sw-fw-semibold); }
    .bubble { justify-self: end; max-inline-size: 460px; white-space: pre-wrap; background: color-mix(in srgb, var(--sw-success) 14%, var(--sw-surface)); border-radius: var(--sw-r-md); padding: 10px 12px; font-size: var(--sw-fs-sm); line-height: 1.5; box-shadow: var(--sw-shadow-1); }
    .banner { display: flex; gap: 10px; align-items: center; padding: 10px 14px; border-radius: var(--sw-r-md); background: var(--sw-surface-2); font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
    .banner.warn { background: var(--sw-warning-soft); color: var(--sw-warning-text); }
    .sched { display: grid; gap: 8px; padding: 10px 12px; border-radius: var(--sw-r-md); background: var(--sw-surface-2); }
    .sched .r { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .seg { display: inline-flex; background: var(--sw-surface); border-radius: var(--sw-r-pill); padding: 3px; gap: 2px; }
    .seg button { border: 0; background: transparent; border-radius: var(--sw-r-pill); padding: 4px 12px; font: inherit; font-size: var(--sw-fs-sm); color: var(--sw-text-2); cursor: pointer; }
    .seg button[aria-pressed='true'] { background: var(--sw-accent-soft); color: var(--sw-accent-text); font-weight: var(--sw-fw-semibold); }
    .sw { display: inline-flex; align-items: center; gap: 8px; font-size: var(--sw-fs-sm); cursor: pointer; }
    .sw input { inline-size: 18px; block-size: 18px; accent-color: var(--sw-accent); }
    .status { display: grid; gap: 4px; font-size: var(--sw-fs-sm); }
    .wf { display: flex; gap: 8px; align-items: center; padding: 12px 20px; border-block-start: 1px solid var(--sw-border); background: var(--sw-surface); flex-wrap: wrap; }
    .wf .sp { flex: 1; }
    .err { color: var(--sw-danger-text); font-size: var(--sw-fs-sm); }
    .okm { color: var(--sw-success-text); font-size: var(--sw-fs-sm); }
    @media (max-width: 600px) {
      :host { padding: 0; }
      .sheet { inline-size: 100%; max-block-size: 100dvh; block-size: 100dvh; border-radius: 0; }
    }
  `];

  private onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') this.close();
  };

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('keydown', this.onKey);
    if (this.params?.range) this.range = this.params.range === 'custom' ? '7d' : this.params.range;
    void getReportRecipients().then((r) => (this.rec = r)).catch((e) => (this.err = describeError(e)));
    void listSchedules().then((r) => (this.schedules = r.schedules)).catch(() => undefined);
    void this.preview();
  }

  disconnectedCallback() {
    window.removeEventListener('keydown', this.onKey);
    window.clearInterval(this.poll);
    super.disconnectedCallback();
  }

  private get unitIds(): string[] {
    return this.params?.units?.length ? this.params.units : this.units.map((u) => u.id);
  }

  /** only vendors are chosen: the preview is the text a vendor gets (no "available in the system" note) */
  private get vendorOnly(): boolean {
    const v = chosenVendors(this.rec, this.chosen);
    return v > 0 && v === this.chosen.length;
  }

  private get repLang(): 'he' | 'en' {
    return this.params?.lang ?? 'he';
  }

  private async preview() {
    try {
      this.text = (await getReportPreview({ units: this.unitIds, range: this.range, lang: this.repLang, chart: false, events: false, signature: false, external: this.vendorOnly })).text_summary;
    } catch {
      this.text = '';
    }
  }

  private close() {
    this.dispatchEvent(new CustomEvent('close'));
  }

  private toggle(id: string, on: boolean) {
    const before = this.vendorOnly;
    this.chosen = on ? [...new Set([...this.chosen, id])] : this.chosen.filter((x) => x !== id);
    if (before !== this.vendorOnly) void this.preview();
  }

  private pick(id: string, channel: VendorChannel) {
    this.channels = { ...this.channels, [id]: channel };
  }

  private reasonText(code: string | null | undefined): string {
    if (!code) return '';
    const key = `waReason_${code}` as TtKey;
    return (TT_KEYS as string[]).includes(key) ? tt(key) : code;
  }

  private async send() {
    this.busy = true;
    this.err = '';
    this.ok = '';
    try {
      const r = await sendReport({ units: this.unitIds, range: this.range, lang: this.repLang, recipients: recipientPicks(this.rec, this.chosen, this.channels) });
      this.sends = r.sends;
      this.ok = tt('waQueued', { n: r.queued });
      window.clearInterval(this.poll);
      let left = 12;
      this.poll = window.setInterval(async () => {
        if (--left <= 0) window.clearInterval(this.poll);
        try {
          this.sends = (await getSends(r.batch_id)).sends;
          if (this.sends.every((s) => s.status !== 'queued' && s.status !== 'retry' && s.status !== 'handed')) window.clearInterval(this.poll);
        } catch {
          window.clearInterval(this.poll);
        }
      }, 10_000);
    } catch (e) {
      this.err = describeError(e);
    } finally {
      this.busy = false;
    }
  }

  private async saveSchedule() {
    this.busy = true;
    this.err = '';
    this.ok = '';
    try {
      await createSchedule({ units: this.unitIds, range: this.range, lang: this.repLang, freq: this.freq, at: this.at, dow: this.freq === 'weekly' ? this.dow : null,
        dom: this.freq === 'monthly' ? this.dom : null, recipients: recipientPicks(this.rec, this.chosen, this.channels) });
      this.schedules = (await listSchedules()).schedules;
      this.ok = tt('waScheduled');
    } catch (e) {
      this.err = describeError(e);
    } finally {
      this.busy = false;
    }
  }

  private person(p: ReportRecipient, vendor: boolean) {
    const on = this.chosen.includes(p.id);
    const warn = !vendor && p.reach && p.reach !== 'ok' ? tt(p.reach === 'no_address' ? 'waNoPhone' : 'waNoConsent') : '';
    const q = this.q.trim().toLowerCase();
    if (q && !p.name.toLowerCase().includes(q) && !(p.company ?? '').toLowerCase().includes(q)) return nothing;
    const live = vendor && !!p.channels; // vendor reports are on: the server sent the reason per channel
    const ch = live ? vendorChannel(p, this.channels[p.id], !!this.rec?.vendor_reports?.email) : null;
    const chReason = live && ch ? vendorChannelReason(p, ch) : '';
    return html`<label class="row" ?data-disabled=${!p.selectable} data-person=${p.id} data-kind=${vendor ? 'vendor' : 'user'}>
      <input type="checkbox" .checked=${on} ?disabled=${!p.selectable} @change=${(e: Event) => this.toggle(p.id, (e.target as HTMLInputElement).checked)} />
      <span class="tx">${p.name}${p.company ? html`<small>${p.company}</small>` : nothing}</span>
      ${live ? html`<span class="vw"><span class="seg" role="group" data-wa-channels=${p.id}>${vendorChannelsOffered(!!this.rec?.vendor_reports?.email).map((c) => html`<button type="button" ?disabled=${!p.selectable || vendorChannelReason(p, c) !== 'ok'}
            title=${vendorChannelReason(p, c) === 'ok' ? '' : this.reasonText(vendorChannelReason(p, c))} aria-pressed=${String(ch === c)} data-wa-channel=${c}
            @click=${(e: Event) => { e.preventDefault(); this.pick(p.id, c); }}>${tt(c === 'whatsapp' ? 'waChannelWhatsapp' : 'waChannelEmail')}</button>`)}</span>
          ${chReason && chReason !== 'ok' ? html`<span class="w" data-wa-reason>${this.reasonText(chReason)}</span>` : nothing}</span>`
        : vendor ? html`<span class="chip" title=${tt('waVendorsLater')}>${tt('waComingLater')}</span>` : warn ? html`<span class="w">${warn}</span>` : nothing}</label>`;
  }

  render() {
    const r = this.rec;
    const names = new Map([...(r?.users ?? []), ...(r?.vendors ?? [])].map((u) => [u.id, u.name]));
    const bad = unreachable(r?.users ?? [], this.chosen);
    const unitName = new Map(this.units.map((u) => [u.id, u.name]));
    return html`<div class="ovl" @click=${() => this.close()}></div>
      <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="wa-title" data-temp-wa>
        <div class="wh"><div class="t"><h2 id="wa-title">${tt('waTitle')}</h2><small>${tt(this.rec?.user_attachment === 'link' ? 'waSubLink' : 'waSub')}</small></div>
          <button type="button" class="btn icb" aria-label=${tt('close')} @click=${() => this.close()}><sw-icon name="close" size="16"></sw-icon></button></div>
        <div class="wb">
          <div class="field"><span class="lbl">${tt('waRecipients')}</span>
            <div class="pills">${this.chosen.map((id) => html`<span class="pill">${names.get(id) ?? id}<button type="button" aria-label=${tt('removeWindow')} @click=${() => this.toggle(id, false)}><sw-icon name="close" size="12"></sw-icon></button></span>`)}</div>
            <input class="in" type="search" .value=${this.q} placeholder=${tt('waSearch')} aria-label=${tt('waSearch')} @input=${(e: Event) => { this.q = (e.target as HTMLInputElement).value; }} />
            <div class="plist" data-wa-list>
              ${r ? html`<div class="grp">${tt('waUsers')}</div>${r.users.map((u) => this.person(u, false))}
                ${r.vendors.length ? html`<div class="grp">${tt('waVendors')}${r.vendor_reports?.enabled ? '' : html` · ${tt('waVendorsLater')}`}</div>${r.vendors.map((v) => this.person(v, true))}` : nothing}` : html`<p class="hint" style="padding:10px">…</p>`}
            </div>
            ${bad ? html`<div class="banner warn" data-wa-warn><sw-icon name="warning" size="16"></sw-icon><span>${tt('waWarn', { n: bad })}</span></div>` : nothing}
          </div>
          <div class="field"><span class="lbl">${tt('repRange')}</span><div class="presets">${REPORT_RANGES.filter((x) => x !== 'custom').map((x) => html`<button type="button" aria-pressed=${String(this.range === x)}
            data-wa-range=${x} @click=${() => { this.range = x; void this.preview(); }}>${tt(`rp${x}` as TtKey)}</button>`)}</div></div>
          <div class="field"><span class="lbl">${tt('waPreview')}</span><div class="bubble" dir=${this.repLang === 'he' ? 'rtl' : 'ltr'} data-wa-text>${this.text || '…'}</div>
            <span class="hint">${tt('waTextOnly')}</span></div>
          <div class="sched">
            <label class="sw"><input type="checkbox" .checked=${this.scheduled} @change=${(e: Event) => { this.scheduled = (e.target as HTMLInputElement).checked; }} data-wa-sched />${tt('waSchedule')}</label>
            ${this.scheduled ? html`<div class="r"><span class="seg" role="group">${(['daily', 'weekly', 'monthly'] as Freq[]).map((f) => html`<button type="button" aria-pressed=${String(this.freq === f)}
                @click=${() => { this.freq = f; }}>${tt(f === 'daily' ? 'waDaily' : f === 'weekly' ? 'waWeekly' : 'waMonthly')}</button>`)}</span>
              ${this.freq === 'weekly' ? html`<select class="in" aria-label=${tt('waWeekly')} @change=${(e: Event) => { this.dow = Number((e.target as HTMLSelectElement).value); }}>
                ${[0, 1, 2, 3, 4, 5, 6].map((d) => html`<option value=${d} ?selected=${this.dow === d}>${tt(`dow${d}` as TtKey)}</option>`)}</select>` : nothing}
              ${this.freq === 'monthly' ? html`<label class="sw">${tt('waDom')}<input class="in" type="number" min="1" max="28" style="inline-size:70px" .value=${String(this.dom)}
                @change=${(e: Event) => { this.dom = Math.max(1, Math.min(28, Number((e.target as HTMLInputElement).value) || 1)); }} /></label>` : nothing}
              <span>${tt('waAt')}</span><input class="in" type="time" lang=${dateInputLang()} .value=${this.at} @change=${(e: Event) => { this.at = (e.target as HTMLInputElement).value; }} aria-label=${tt('waAt')} /></div>` : nothing}
            ${this.schedules.length ? html`<div class="status"><span class="lbl">${tt('waSchedules')}</span>${this.schedules.map((s) => html`<div class="r" data-wa-schedule=${s.id}>
              <span>${tt(s.freq === 'daily' ? 'waDaily' : s.freq === 'weekly' ? 'waWeekly' : 'waMonthly')}${s.freq === 'weekly' && s.dow !== null ? ` · ${tt(`dow${s.dow}` as TtKey)}` : ''} · ${s.at} ·
                ${s.units.map((u) => unitName.get(u) ?? '').filter(Boolean).join(', ')} · ${s.recipients.map((x) => names.get(x.id) ?? '').filter(Boolean).join(', ')}</span>
              <button type="button" class="btn sm ghost" @click=${async () => { await deleteSchedule(s.id); this.schedules = this.schedules.filter((x) => x.id !== s.id); }}>${tt('waDelete')}</button></div>`)}</div>` : nothing}
          </div>
          ${r ? html`<div class="banner"><sw-icon name="clock" size="16"></sw-icon><span>${tt('waHours', { h: bidi(`${r.send_hours.from}–${r.send_hours.to}`) })}</span></div>` : nothing}
          ${this.sends.length ? html`<div class="status" data-wa-status>${this.sends.map((s) => html`<div>${s.name}${s.channel ? html` · ${tt(s.channel === 'email' ? 'waChannelEmail' : 'waChannelWhatsapp')}` : nothing} · <b>${tt(`waStatus_${s.status}` as TtKey)}</b>${s.reason ? html` <span class="hint">(${this.reasonText(s.reason)})</span>` : nothing}</div>`)}</div>` : nothing}
        </div>
        <div class="wf">
          <button type="button" class="btn ghost" @click=${() => this.close()}>${tt('cancel')}</button>
          <span class="sp"></span>${this.err ? html`<span class="err" role="alert">${this.err}</span>` : nothing}${this.ok ? html`<span class="okm" role="status">${this.ok}</span>` : nothing}
          ${this.scheduled ? html`<button type="button" class="btn" ?disabled=${this.busy || !this.chosen.length} data-wa-save @click=${() => this.saveSchedule()}><sw-icon name="calendar" size="16"></sw-icon>${tt('waSave')}</button>` : nothing}
          <button type="button" class="btn pri" ?disabled=${this.busy || !this.chosen.length} data-wa-send @click=${() => this.send()}><sw-icon name="check" size="16"></sw-icon>${tt('waSend')}</button>
        </div>
      </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'temp-wa': TempWa;
  }
}
