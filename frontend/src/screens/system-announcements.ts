import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-card';
import '../components/sw-button';
import '../components/sw-toggle';
import '../components/sw-state-panel';
import {
  announceAreas, announceConfig, announcePutConfig, announceSpeak, announceTest,
  type AnnounceArea, type AnnounceConfigAnswer, type AnnounceConfigPatch, type AnnounceSpeaker,
} from '../api/announcements';
import { describeError } from '../api/client';
import { can, isApi, onRemote } from '../api/session';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';
import { announceLang, announceText } from '../i18n/announce';

const flash = (ms = 3000) => new Promise((r) => setTimeout(r, ms));

/**
 * MU2 הגדרות › מולטימדיה › "הכרזות קוליות" (administrator, `system.configure`; local network only): the switch, the speech engine, the language,
 * the per-minute limit, the speakers allowed to announce (nothing is allowed by default) with a test button on every row, a small
 * "announce now" row for people holding `media.announce`, and the last attempts (a person, a rule or a test). Every change is saved at once and
 * audited server-side (`media.announce.config`). Management lives here only: no operator screen carries a hint or a badge for it.
 */
@customElement('system-announcements')
export class SystemAnnouncements extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @state() private phase: 'loading' | 'ready' | 'error' | 'forbidden' | 'local' = 'loading';
  @state() private err = '';
  @state() private data: AnnounceConfigAnswer | null = null;
  @state() private areas: AnnounceArea[] = [];
  @state() private saved = '';
  @state() private busy = '';
  @state() private room = '';
  @state() private text = '';

  static styles = [bubbleChrome, css`
    :host { display: block; }
    .stack { display: flex; flex-direction: column; gap: 14px; }
    .row { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 10px 0; border-block-end: 1px solid var(--sw-border); flex-wrap: wrap; }
    .row:last-child { border-block-end: 0; }
    .lbl { display: flex; flex-direction: column; gap: 2px; min-inline-size: 0; font-size: var(--sw-fs-md); font-weight: var(--sw-fw-medium); }
    .muted { font-size: var(--sw-fs-xs); color: var(--sw-text-3); font-weight: var(--sw-fw-regular); }
    input[type='text'], input[type='number'], select {
      box-sizing: border-box; min-block-size: 36px; padding-inline: 10px; border: 1px solid var(--sw-border-strong); border-radius: 8px;
      background: var(--sw-surface); color: var(--sw-text); font: inherit; font-size: var(--sw-fs-sm); max-inline-size: 100%;
    }
    input[type='text'] { inline-size: 260px; }
    input[data-ltr] { direction: ltr; text-align: start; }
    input[type='number'] { inline-size: 80px; }
    .grow { flex: 1; min-inline-size: 200px; inline-size: auto; }
    .inl { display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .area { font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-medium); color: var(--sw-text-2); padding-block: 10px 2px; }
    .pick { display: inline-flex; align-items: center; gap: 8px; }
    .ok { color: var(--sw-live); font-size: var(--sw-fs-sm); }
    .err { padding: 10px 12px; border-radius: var(--sw-r-md); background: color-mix(in srgb, var(--sw-danger) 10%, var(--sw-surface)); color: var(--sw-danger); font-size: var(--sw-fs-sm); }
    table { inline-size: 100%; border-collapse: collapse; font-size: var(--sw-fs-sm); }
    th, td { text-align: start; padding: 6px 8px; border-block-end: 1px solid var(--sw-border); }
    td.msg { max-inline-size: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    @media (max-width: 600px) { input[type='text'] { inline-size: 100%; } }
  `];

  connectedCallback() {
    super.connectedCallback();
    void this.load();
  }

  private async load() {
    if (!isApi()) {
      this.phase = 'ready';
      return;
    }
    if (onRemote()) {
      this.phase = 'local';
      return;
    }
    if (!can('system.configure')) {
      this.phase = 'forbidden';
      return;
    }
    this.phase = 'loading';
    this.err = '';
    try {
      this.data = await announceConfig();
      this.areas = can('media.announce') ? (await announceAreas()).areas : [];
      if (!this.areas.some((a) => a.area_id === this.room)) this.room = this.areas[0]?.area_id ?? '';
      this.phase = 'ready';
    } catch (err) {
      this.err = describeError(err);
      this.phase = 'error';
    }
  }

  private note(msg: string) {
    this.saved = msg;
    void flash().then(() => {
      if (this.saved === msg) this.saved = '';
    });
  }

  private async save(patch: AnnounceConfigPatch) {
    this.err = '';
    try {
      this.data = await announcePutConfig(patch);
      if (can('media.announce')) this.areas = (await announceAreas()).areas;
      this.note(announceText().saved);
    } catch (err) {
      const msg = describeError(err);
      await this.load();
      this.err = msg;
    }
  }

  private async toggleSpeaker(s: AnnounceSpeaker, on: boolean) {
    const cur = new Set(this.data?.config.devices ?? []);
    if (on) cur.add(s.key);
    else cur.delete(s.key);
    await this.save({ devices: [...cur] });
  }

  private async run(id: string, fn: () => Promise<unknown>) {
    this.busy = id;
    this.err = '';
    try {
      await fn();
      this.note(announceText().sent);
    } catch (err) {
      this.err = describeError(err);
    } finally {
      this.busy = '';
    }
    try {
      this.data = await announceConfig();
    } catch {
      /* the next load shows it */
    }
  }

  private speakerRows(t: ReturnType<typeof announceText>) {
    const list = this.data?.speakers ?? [];
    if (!list.length) return html`<div class="muted" data-announce-none>${t.none}</div>`;
    const groups = new Map<string, AnnounceSpeaker[]>();
    for (const s of list) {
      const k = [s.floor_name, s.area_name].filter(Boolean).join(' · ') || t.noRoom;
      groups.set(k, [...(groups.get(k) ?? []), s]);
    }
    const on = !!this.data?.config.enabled && !!this.data?.config.engine;
    return html`${[...groups].map(([k, rows]) => html`<div class="area">${k}</div>${rows.map((s) => html`
      <div class="row" data-announce-speaker=${s.key}>
        <label class="pick"><input type="checkbox" .checked=${s.allowed} data-announce-allow @change=${(e: Event) => void this.toggleSpeaker(s, (e.target as HTMLInputElement).checked)} />${s.name}</label>
        <sw-button size="sm" data-announce-test ?disabled=${!s.allowed || !on || this.busy !== ''} @click=${() => void this.run(`t:${s.key}`, () => announceTest({ scope: 'device', ref: s.key, language: announceLang() }))}>${t.testAction}</sw-button>
      </div>`)}`)}`;
  }

  render() {
    const t = announceText();
    if (this.phase === 'forbidden') return html`<sw-state-panel state="forbidden" heading=${t.forbidden}></sw-state-panel>`;
    if (this.phase === 'local') return html`<sw-state-panel state="empty" heading=${t.local}></sw-state-panel>`;
    if (this.phase === 'loading') return html`<sw-state-panel state="loading"></sw-state-panel>`;
    if (this.phase === 'error') return html`<sw-state-panel state="error" heading=${this.err} actionLabel="↻" @action=${() => void this.load()}></sw-state-panel>`;
    const d = this.data;
    if (!d) return html`<sw-state-panel state="empty" heading=${t.none}></sw-state-panel>`;
    const cf = d.config;
    return html`<div class="stack" data-announce>
      ${this.err ? html`<div class="err" role="alert">${this.err}</div>` : nothing}
      <sw-card heading=${t.general}>
        <div class="row"><span class="lbl">${t.enabled}<span class="muted">${t.enabledHint}</span></span>
          <sw-toggle label=${t.enabled} labelHidden .checked=${cf.enabled} data-announce-enabled @change=${(e: CustomEvent<{ checked: boolean }>) => void this.save({ enabled: e.detail.checked })}></sw-toggle></div>
        <div class="row"><span class="lbl">${t.engine}<span class="muted">${t.engineHint}</span></span>
          <span class="inl"><input type="text" data-ltr data-announce-engine list="announce-engines" .value=${cf.engine} placeholder="tts.…"
            @change=${(e: Event) => void this.save({ engine: (e.target as HTMLInputElement).value.trim() })} />
          <datalist id="announce-engines">${d.engines.map((x) => html`<option value=${x}></option>`)}</datalist></span></div>
        <div class="row"><span class="lbl">${t.language}</span>
          <input type="text" data-ltr data-announce-language style="inline-size:100px" .value=${cf.language} @change=${(e: Event) => void this.save({ language: (e.target as HTMLInputElement).value.trim() })} /></div>
        <div class="row"><span class="lbl">${t.limit}</span>
          <input type="number" min="1" max="30" data-announce-limit .value=${String(cf.max_per_minute)} @change=${(e: Event) => void this.save({ max_per_minute: Number((e.target as HTMLInputElement).value) })} /></div>
      </sw-card>
      <sw-card heading=${t.speakers} subheading=${t.speakersHint}>${this.speakerRows(t)}</sw-card>
      ${this.areas.length ? html`<sw-card heading=${t.say} data-announce-now>
        <div class="row">
          <span class="inl"><select data-announce-room @change=${(e: Event) => (this.room = (e.target as HTMLSelectElement).value)} aria-label=${t.room}>${this.areas.map((a) => html`<option value=${a.area_id} ?selected=${a.area_id === this.room}>${[a.floor_name, a.name].filter(Boolean).join(' · ')}</option>`)}</select>
          <input type="text" class="grow" maxlength=${cf.max_text} data-announce-text aria-label=${t.text} .value=${this.text} @input=${(e: Event) => (this.text = (e.target as HTMLInputElement).value)} /></span>
          <sw-button size="sm" variant="primary" icon="check" data-announce-send ?disabled=${!this.text.trim() || !this.room || this.busy !== ''}
            @click=${() => void this.run('send', async () => { await announceSpeak({ scope: 'area', ref: this.room, text: this.text }); this.text = ''; })}>${t.send}</sw-button>
        </div></sw-card>` : nothing}
      <sw-card heading=${t.history}>
        ${d.history.length ? html`<table data-announce-history><tbody>${d.history.map((h) => html`<tr>
          <td>${new Intl.DateTimeFormat(announceLang() === 'en' ? 'en-GB' : 'he-IL', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(h.at))}</td>
          <td>${t.src[h.source] ?? h.source}</td><td class="msg">${h.message}</td><td>${t.status[h.status] ?? h.status}</td></tr>`)}</tbody></table>`
          : html`<div class="muted">${t.empty}</div>`}
      </sw-card>
      ${this.saved ? html`<div class="ok" role="status">${this.saved}</div>` : nothing}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-announcements': SystemAnnouncements;
  }
}
