import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { ApiError } from '../api/client';
import { waNotify, type WaNotifyView, type WaTestResult } from '../api/notify-whatsapp';
import { nwt, nwtLang } from '../i18n/notify-whatsapp';
import { mediaGlassStyles } from '../styles/media-glass';
import { notifyControls, notifyKnobs } from './notify-css';
import { nIcon } from './notify-icons';
import { waLogic } from './notify-whatsapp-logic';

const DEDUPE_CHOICES = [0, 15, 30, 60] as const;

/**
 * NOTIFWA: the WhatsApp section of Settings › התראות - the master switch (OFF by default), the sending account (picked in Settings › ערוץ
 * ההודעות; shown here with its state), how many users can be reached (a count), the per-user hourly cap, the no-repeat window and the
 * own-number test. ONE separable element (the module's look is being redesigned): the screen places `<notify-whatsapp-section>` and
 * passes nothing; the element loads and saves through api/notify-whatsapp.ts by itself. Settings only - never an operator screen.
 */
@customElement('notify-whatsapp-section')
export class NotifyWhatsappSection extends LitElement {
  /** the anchor id the settings screen scrolls to */
  @property({ attribute: 'section-id' }) sectionId = 'wa';
  @state() private view: WaNotifyView | null = null;
  @state() private phase: 'loading' | 'ready' | 'error' = 'loading';
  @state() private busy = false;
  @state() private result: { ok: boolean; text: string } | null = null;
  @state() private error = '';

  static styles = [
    mediaGlassStyles,
    notifyKnobs,
    notifyControls,
    css`
      :host {
        display: block;
      }
      .sec {
        padding: var(--sw-s-4, 16px) var(--sw-s-5, 20px);
        display: flex;
        flex-direction: column;
        gap: 14px;
        min-inline-size: 0;
      }
      header {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }
      h2 {
        margin: 0;
        font-size: var(--sw-fs-xl);
        font-weight: 700;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      h2 .ic {
        font-size: var(--sw-fs-2xl);
        color: var(--sw-text-2);
      }
      header .sp {
        margin-inline-start: auto;
        display: flex;
        gap: 8px;
        align-items: center;
      }
      .sub {
        margin: 0;
        font-size: var(--sw-fs-sm);
        color: var(--sw-text-2);
      }
      .frow {
        display: flex;
        align-items: center;
        gap: 14px;
        min-block-size: 52px;
        padding: 4px 0;
        border-block-start: 1px solid var(--sw-border);
        flex-wrap: wrap;
      }
      .frow .l {
        flex: 1 1 180px;
        min-inline-size: 0;
        display: flex;
        flex-direction: column;
        line-height: 1.3;
      }
      .frow .l b {
        font-size: var(--sw-fs-md);
        font-weight: 600;
      }
      .frow .l small {
        font-size: var(--sw-fs-sm);
        color: var(--sw-text-2);
      }
      .frow .r {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
        justify-content: flex-end;
      }
      .frow.dis {
        opacity: 0.55;
      }
      .n {
        font-variant-numeric: tabular-nums;
      }
      .warn {
        color: var(--sw-danger-text);
        font-size: var(--sw-fs-base);
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      a.lnk {
        color: var(--sw-accent-text);
        font-weight: 600;
        text-decoration: none;
      }
      a.lnk:focus-visible {
        outline: var(--sw-focus-w, 2px) solid var(--sw-focus);
        outline-offset: 2px;
      }
      .skl {
        display: block;
        block-size: 44px;
        border-radius: var(--sw-r-md);
        background: var(--sw-surface-2);
      }
    `,
  ];

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  private async load() {
    this.phase = 'loading';
    try {
      this.view = await waNotify().view();
      this.phase = 'ready';
    } catch {
      this.phase = 'error';
    }
  }

  private errText(err: unknown): string {
    return err instanceof ApiError ? err.body.user_message || err.code : nwt('error');
  }

  private async save(patch: { enabled?: boolean; per_user_hour?: number; dedupe_min?: number }) {
    const v = this.view;
    if (!v || this.busy) return;
    this.view = { ...v, ...patch }; // shown at once
    this.busy = true;
    this.error = '';
    try {
      this.view = await waNotify().save({ ...patch, revision: v.revision });
      this.dispatchEvent(new CustomEvent('notify-saved', { bubbles: true, composed: true, detail: { text: nwt('saved') } }));
    } catch (err) {
      this.error = this.errText(err);
      await this.load(); // a stale revision or a refusal: back to what the server holds
    } finally {
      this.busy = false;
    }
  }

  private async test() {
    this.busy = true;
    this.result = null;
    try {
      const r: WaTestResult = await waNotify().test();
      this.result = { ok: r.ok, text: r.ok ? nwt('testOk') : `${nwt('testFail')} · ${r.code ?? r.outcome}` };
    } catch (err) {
      this.result = { ok: false, text: this.errText(err) };
    } finally {
      this.busy = false;
    }
  }

  private stateTag(v: WaNotifyView) {
    const a = v.account;
    if (!a.mapped) return html`<span class="tag bad" data-wa-account-state="none">${nwt('accountNone')}</span>`;
    const st = a.state ?? 'unknown';
    return html`<span class="tag ${st === 'connected' ? 'ok' : st === 'unknown' ? '' : 'bad'}" data-wa-account-state=${st}>${nwt(`st_${st}` as 'st_connected')}</span>`;
  }

  render() {
    const dir = nwtLang() === 'he' || nwtLang() === 'ar' ? 'rtl' : 'ltr';
    if (this.phase === 'loading')
      return html`<section class="glass sec" id=${`sec-${this.sectionId}`} data-wa-section data-wa-phase="loading" aria-busy="true" dir=${dir}><span class="skl"></span><span class="skl"></span></section>`;
    if (this.phase === 'error' || !this.view)
      return html`<section class="glass sec" id=${`sec-${this.sectionId}`} data-wa-section data-wa-phase="error" dir=${dir}><div class="warn" role="alert">${nIcon('warning')}${nwt('error')}</div><div><button type="button" class="btn sm" data-wa-retry @click=${() => void this.load()}>${nIcon('refresh')}${nwt('retry')}</button></div></section>`;
    const v = this.view;
    const tone = waLogic.tone(v);
    const off = !v.enabled;
    const warning = waLogic.warning(v);
    return html`<section class="glass sec" id=${`sec-${this.sectionId}`} data-wa-section data-wa-phase="ready" data-wa-enabled=${String(v.enabled)} dir=${dir}>
      <header><h2>${nIcon('chat')}${nwt('title')}</h2><div class="sp"><button type="button" class="tog" role="switch" aria-checked=${String(v.enabled)} aria-label=${nwt('enabled')} data-wa-switch ?disabled=${this.busy} @click=${() => void this.save({ enabled: !v.enabled })}></button></div></header>
      <p class="sub">${nwt('sub')}</p>
      <div class="frow"><div class="l"><b>${nwt('enabled')}</b><small>${nwt('enabledHint')}</small></div><div class="r"><span class="tag ${tone === 'ok' ? 'ok' : tone === 'bad' ? 'bad' : ''}" data-wa-tone=${tone}>${nIcon(tone === 'ok' ? 'check' : tone === 'bad' ? 'warning' : 'moon')}${nwt(tone === 'ok' ? 'on' : tone === 'bad' ? 'attention' : 'off')}</span></div></div>
      ${warning ? html`<div class="warn" role="alert" data-wa-warning=${warning}>${nIcon('warning')}${nwt('warnOffAccount')}</div>` : nothing}
      <div class="frow"><div class="l"><b>${nwt('account')}</b>${v.account.mapped && v.account.label ? html`<small data-wa-account-label>${v.account.label}</small>` : nothing}</div><div class="r">${this.stateTag(v)}<a class="lnk" href=${v.accounts_href} data-wa-accounts-link>${nwt('accountPick')}</a></div></div>
      <div class="frow"><div class="l"><b>${nwt('reach')}</b><small>${nwt('reachHint')}</small></div><div class="r"><span class="tag" data-wa-reach><span class="n">${v.reachable_users}</span></span></div></div>
      <div class="frow ${off ? 'dis' : ''}"><div class="l"><b>${nwt('cap')}</b><small>${nwt('capHint')}</small></div><div class="r"><span class="stp"><button type="button" data-wa-cap-step="-1" aria-label=${nwt('less')} ?disabled=${this.busy} @click=${() => void this.save({ per_user_hour: waLogic.stepCap(v, -1) })}>${nIcon('minus')}</button><span class="vv" data-wa-cap><span class="n">${v.per_user_hour}</span></span><button type="button" data-wa-cap-step="1" aria-label=${nwt('more')} ?disabled=${this.busy} @click=${() => void this.save({ per_user_hour: waLogic.stepCap(v, 1) })}>${nIcon('plus')}</button></span></div></div>
      <div class="frow ${off ? 'dis' : ''}"><div class="l"><b>${nwt('dedupe')}</b></div><div class="r"><div class="seg sm" role="group" aria-label=${nwt('dedupe')}>${DEDUPE_CHOICES.map((m) => html`<button type="button" aria-pressed=${String(v.dedupe_min === m)} data-wa-dedupe=${m} ?disabled=${this.busy} @click=${() => void this.save({ dedupe_min: m })}>${m === 0 ? '—' : html`<span class="n">${m}</span> ${nwt('minutes')}`}</button>`)}</div></div></div>
      <div class="frow"><div class="l"><b>${nwt('test')}</b><small data-wa-test-hint>${v.test.own_number ? nwt('testHint', { masked: `⁦${v.test.masked ?? ''}⁩` }) : nwt('testNoNumber')}</small></div><div class="r">${this.result ? html`<span class="tag ${this.result.ok ? 'ok' : 'bad'}" data-wa-test-result=${this.result.ok ? 'ok' : 'bad'}>${nIcon(this.result.ok ? 'check' : 'warning')}${this.result.text}</span>` : nothing}<button type="button" class="btn quiet" data-wa-test ?disabled=${this.busy || !waLogic.canTest(v)} @click=${() => void this.test()}>${nIcon(this.busy ? 'refresh' : 'send')}${this.busy ? nwt('testing') : nwt('test')}</button></div></div>
      ${this.error ? html`<div class="warn" role="alert" data-wa-error>${this.error}</div>` : nothing}
    </section>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'notify-whatsapp-section': NotifyWhatsappSection;
  }
}
