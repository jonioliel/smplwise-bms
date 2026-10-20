import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { defaultPolicy, doorAutomations, type DoorAutomationStatus, type DoorAutomationsAdapter, type DoorBlock, type DoorChoice, type DoorPolicy, type FireRow, type Simulation } from '../api/door-automations';
import { dat, datCode, datLang } from '../i18n/door-automation';
import { icon } from './automation-builder-icons';
import { editorShared } from './automation-editor-css';
import { canArm, dayOrder, formProblems, payload, sameDoor, stateChip, stateLine, toggleDay, toggleDoor } from './door-automation-logic';

/**
 * CR-AUTODOORS-295: the "open a door" block of the automation editor, under the "Then" section. Shown only to a holder of
 * `access.doors.automate` (`status.visible`); otherwise it renders nothing. A draft does nothing; "Activate" is a separate, confirmed
 * human step; any save of a running block turns it off; "Test" evaluates every condition and sends nothing. Everything is decided again
 * on the server. Clean operator wording: no platform names, no codes.
 *
 *   <door-automation-block .automationId=${id}></door-automation-block>
 */
@customElement('door-automation-block')
export class DoorAutomationBlock extends LitElement {
  @property({ attribute: 'automation-id' }) automationId: string | null = null;
  /** Tests and the demo inject an adapter; the app uses the HTTP one (or the mock without a backend). */
  @property({ attribute: false }) adapter: DoorAutomationsAdapter | null = null;

  @state() private status: DoorAutomationStatus | null = null;
  @state() private block: DoorBlock | null = null;
  @state() private choices: DoorChoice[] = [];
  @state() private editing = false;
  @state() private name = '';
  @state() private policy: DoorPolicy = defaultPolicy();
  @state() private dirty = false;
  @state() private busy = false;
  @state() private error: string | null = null;
  @state() private confirm: 'arm' | 'remove' | null = null;
  @state() private sim: Simulation | null = null;
  @state() private history: FireRow[] = [];
  @state() private problems: string[] = [];

  private get api(): DoorAutomationsAdapter {
    return this.adapter ?? doorAutomations();
  }

  updated(changed: PropertyValues<this>): void {
    if (changed.has('automationId') || changed.has('adapter')) void this.load();
  }

  private async load(): Promise<void> {
    this.error = null;
    this.sim = null;
    try {
      const st = await this.api.status();
      this.status = st;
      if (!st.visible || !this.automationId) return;
      const [block, choices] = await Promise.all([this.api.forAutomation(this.automationId), this.api.doors()]);
      this.choices = choices;
      this.setBlock(block);
      this.history = block ? await this.api.fires(block) : [];
    } catch {
      this.error = dat('loadError');
    }
  }

  private setBlock(block: DoorBlock | null): void {
    this.block = block;
    this.name = block?.name ?? '';
    this.policy = block ? structuredClone(block.policy) : defaultPolicy();
    this.dirty = false;
    this.problems = [];
  }

  private edit(fn: () => void): void {
    fn();
    this.dirty = true;
    this.sim = null;
  }

  private async run(fn: () => Promise<void>): Promise<void> {
    this.busy = true;
    this.error = null;
    try {
      await fn();
    } catch (e) {
      const msg = (e as { body?: { user_message?: string } })?.body?.user_message;
      this.error = typeof msg === 'string' && msg ? msg : dat('loadError');
    } finally {
      this.busy = false;
    }
  }

  private save(): Promise<void> {
    const problems = formProblems(this.name, this.policy);
    this.problems = problems;
    if (problems.length) return Promise.resolve();
    return this.run(async () => {
      const body = payload(this.policy);
      const next = this.block ? await this.api.update(this.block, this.name.trim(), body) : await this.api.create(this.automationId!, this.name.trim(), body);
      this.setBlock(next);
      this.editing = false;
    });
  }

  private arm(): Promise<void> {
    this.confirm = null;
    return this.run(async () => this.setBlock(await this.api.arm(this.block!)));
  }

  private disarm(): Promise<void> {
    return this.run(async () => this.setBlock(await this.api.disarm(this.block!)));
  }

  private simulate(): Promise<void> {
    return this.run(async () => {
      this.sim = await this.api.simulate(this.block!);
    });
  }

  private removeBlock(): Promise<void> {
    this.confirm = null;
    return this.run(async () => {
      await this.api.remove(this.block!);
      this.setBlock(null);
      this.editing = false;
      this.history = [];
    });
  }

  // ------------------------------------------------------------------ render

  render() {
    const st = this.status;
    if (!st?.visible) return nothing;
    if (!this.automationId) return html`<section class="da"><p class="muted">${dat('saveFirst')}</p></section>`;
    const chip = stateChip(this.block, st);
    const line = stateLine(this.block);
    return html`<section class="da" data-door-automation aria-labelledby="da-title">
      <header>
        <span class="k">${icon('door', 14)}</span>
        <div class="hd"><h4 id="da-title">${dat('title')}</h4><small>${dat('sub')}</small></div>
        <span class="tag ${chip.tone}" data-state>${chip.text}</span>
      </header>
      ${line ? html`<p class="line">${line}</p>` : nothing}
      ${this.error ? html`<p class="err" role="alert">${this.error} <button class="link" type="button" @click=${() => void this.load()}>${dat('retry')}</button></p>` : nothing}
      ${!this.block && !this.editing
        ? html`<button class="btn" type="button" data-add ?disabled=${this.busy} @click=${() => { this.editing = true; this.setBlock(null); }}>${icon('door')}${dat('add')}</button>`
        : this.editing ? this.renderForm() : this.renderSummary()}
      ${this.renderConfirm()}${this.renderSim()}
    </section>`;
  }

  private renderSummary() {
    const b = this.block!;
    const st = this.status!;
    return html`<div class="sum">
        <div class="chips">${b.doors.map((d) => html`<span class="tag acc">${icon('door', 12)}<bdi>${d.name ?? '—'}</bdi></span>`)}</div>
        <div class="chips">${b.policy.windows.map((w) => html`<span class="tag"><bdi>${this.daysText(w.days)}</bdi> · <bdi dir="ltr">${w.start}–${w.end}</bdi></span>`)}</div>
      </div>
      <div class="row">
        <button class="btn" type="button" data-edit ?disabled=${this.busy} @click=${() => { this.editing = true; }}>${icon('edit')}${dat('edit')}</button>
        ${b.state === 'armed'
          ? html`<button class="btn" type="button" data-disarm ?disabled=${this.busy} @click=${() => void this.disarm()}>${dat('disarm')}</button>`
          : html`<button class="btn primary" type="button" data-arm ?disabled=${this.busy || !canArm(b, st, this.choices, this.dirty)} @click=${() => { this.confirm = 'arm'; }}>${dat('arm')}</button>`}
        <button class="btn" type="button" data-simulate ?disabled=${this.busy} @click=${() => void this.simulate()}>${icon('flask')}${dat('simulate')}</button>
        <button class="btn ghost" type="button" data-remove ?disabled=${this.busy} @click=${() => { this.confirm = 'remove'; }}>${icon('trash')}${dat('remove')}</button>
      </div>
      ${this.renderHistory()}`;
  }

  private daysText(days: number[]): string {
    const order = dayOrder(datLang());
    return order.filter((d) => days.includes(d)).map((d) => dat(`d${d}` as 'd0')).join(' ');
  }

  private renderForm() {
    const p = this.policy;
    const lang = datLang();
    return html`<form class="form" @submit=${(e: Event) => { e.preventDefault(); void this.save(); }}>
      <label class="fld"><span>${dat('name')}</span>
        <input type="text" maxlength="80" .value=${this.name} data-name @input=${(e: Event) => this.edit(() => { this.name = (e.target as HTMLInputElement).value; })} />
      </label>
      <fieldset><legend>${dat('doors')}</legend>
        ${this.choices.length === 0 ? html`<p class="muted">${dat('doorsEmpty')}</p>` : nothing}
        ${this.choices.map((c) => html`<label class="door ${c.can_arm ? '' : 'dim'}">
          <input type="checkbox" .checked=${p.doors.some((d) => sameDoor(d, c))} data-door=${`${c.station_id}#${c.relay}`}
            @change=${() => this.edit(() => { this.policy = toggleDoor(this.policy, c); })} />
          <bdi>${c.name}</bdi>
          ${!c.online ? html`<span class="tag">${dat('doorOffline')}</span>` : nothing}
          ${!c.can_arm ? html`<span class="tag warn">${dat('doorNoOpen')}</span>` : nothing}
        </label>`)}
      </fieldset>
      <fieldset><legend>${dat('windows')}</legend>
        ${p.windows.map((w, i) => html`<div class="win" data-window=${i}>
          <div class="days" role="group">${dayOrder(lang).map((d) => html`<button type="button" class="day ${w.days.includes(d) ? 'on' : ''}" aria-pressed=${w.days.includes(d) ? 'true' : 'false'}
            @click=${() => this.edit(() => { this.policy = { ...this.policy, windows: this.policy.windows.map((x, j) => (j === i ? toggleDay(x, d) : x)) }; })}>${dat(`d${d}` as 'd0')}</button>`)}</div>
          <label class="t"><span>${dat('from')}</span><input type="time" dir="ltr" .value=${w.start} @change=${(e: Event) => this.setWin(i, 'start', (e.target as HTMLInputElement).value)} /></label>
          <label class="t"><span>${dat('to')}</span><input type="time" dir="ltr" .value=${w.end === '24:00' ? '23:59' : w.end} @change=${(e: Event) => this.setWin(i, 'end', (e.target as HTMLInputElement).value)} /></label>
          ${p.windows.length > 1 ? html`<button type="button" class="link" @click=${() => this.edit(() => { this.policy = { ...this.policy, windows: this.policy.windows.filter((_, j) => j !== i) }; })}>${dat('windowRemove')}</button>` : nothing}
        </div>`)}
        ${p.windows.length < 7 ? html`<button type="button" class="link" data-add-window @click=${() => this.edit(() => { this.policy = { ...this.policy, windows: [...this.policy.windows, { days: [6, 0, 1, 2, 3], start: '07:00', end: '09:00' }] }; })}>+ ${dat('windowAdd')}</button>` : nothing}
      </fieldset>
      <details class="lim"><summary>${dat('limits')}</summary>
        ${this.num('cooldown', 'cooldown_s', 10, 3600)}${this.num('perHour', 'max_per_hour', 1, 30)}${this.num('perDay', 'max_per_day', 1, 200)}${this.num('armDays', 'arm_days', 1, 90)}
      </details>
      ${this.problems.length ? html`<p class="err" role="alert">${this.problems.map((k) => dat(k as 'needDoor')).join(' · ')}</p>` : nothing}
      <div class="row">
        <button class="btn primary" type="submit" data-save ?disabled=${this.busy}>${dat('save')}</button>
        <button class="btn" type="button" ?disabled=${this.busy} @click=${() => { this.editing = false; this.setBlock(this.block); }}>${dat('cancel')}</button>
      </div>
    </form>`;
  }

  private setWin(i: number, key: 'start' | 'end', value: string): void {
    this.edit(() => {
      const v = key === 'end' && value === '23:59' ? '24:00' : value;
      this.policy = { ...this.policy, windows: this.policy.windows.map((w, j) => (j === i ? { ...w, [key]: v } : w)) };
    });
  }

  private num(label: 'cooldown' | 'perHour' | 'perDay' | 'armDays', key: 'cooldown_s' | 'max_per_hour' | 'max_per_day' | 'arm_days', min: number, max: number) {
    return html`<label class="fld n"><span>${dat(label)}</span><input type="number" dir="ltr" min=${min} max=${max} .value=${String(this.policy[key])}
      @change=${(e: Event) => this.edit(() => { this.policy = { ...this.policy, [key]: Number((e.target as HTMLInputElement).value) }; })} /></label>`;
  }

  private renderConfirm() {
    if (!this.confirm || !this.block) return nothing;
    const arm = this.confirm === 'arm';
    return html`<div class="confirm" role="alertdialog" aria-labelledby="da-confirm-title" data-confirm=${this.confirm}>
      <h5 id="da-confirm-title">${arm ? dat('armTitle') : dat('removeTitle')}</h5>
      ${arm ? html`<p>${dat('armText', { days: this.block.policy.arm_days })}</p>` : nothing}
      <div class="row">
        <button class="btn ${arm ? 'primary' : 'danger'}" type="button" data-confirm-yes ?disabled=${this.busy} @click=${() => void (arm ? this.arm() : this.removeBlock())}>${arm ? dat('armConfirm') : dat('remove')}</button>
        <button class="btn" type="button" @click=${() => { this.confirm = null; }}>${dat('cancel')}</button>
      </div>
    </div>`;
  }

  private renderSim() {
    const s = this.sim;
    if (!s) return nothing;
    return html`<div class="sim" data-sim role="status">
      <h5>${dat('simTitle')} · <span class="tag ${s.would_send ? 'ok' : 'warn'}">${s.would_send ? dat('simWould') : dat('simWouldNot')}</span></h5>
      <ul>${s.gates.map((g) => html`<li class=${g.ok ? 'ok' : 'no'}>${g.ok ? '✓' : '✕'} ${g.ok ? datCode('g', g.gate) : datCode('r', g.reason)}</li>`)}
        ${s.doors.map((d) => html`<li class=${d.decision === 'would_open' ? 'ok' : 'no'}>${icon('door', 12)} <bdi>${d.door ?? '—'}</bdi>${d.reason ? html` · ${datCode('r', d.reason)}` : nothing}</li>`)}</ul>
      <small class="muted">${dat('simNothing')}</small>
    </div>`;
  }

  private renderHistory() {
    if (!this.block) return nothing;
    return html`<details class="hist"><summary>${dat('history')}</summary>
      ${this.history.length === 0 ? html`<p class="muted">${dat('historyEmpty')}</p>`
        : html`<ul>${this.history.slice(0, 10).map((f) => html`<li><bdi dir="ltr">${f.at.slice(0, 16).replace('T', ' ')}</bdi> · <bdi>${f.door ?? '—'}</bdi> · ${f.attempted ? datCode('o', f.outcome) : datCode('r', f.reason)}</li>`)}</ul>`}
    </details>`;
  }

  static styles = [
    editorShared,
    css`
      .da {
        margin-block-start: 14px;
        padding: 14px;
        border-radius: 16px;
        border: 1px solid var(--dv-border-strong, var(--sw-border));
        background: var(--dv-surface-2, var(--sw-surface));
        display: grid;
        gap: 10px;
      }
      header {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      header .k {
        display: inline-grid;
        place-items: center;
        inline-size: 28px;
        block-size: 28px;
        border-radius: 8px;
        background: var(--dv-accent-soft);
        color: var(--dv-accent-text);
        flex: none;
      }
      .hd {
        flex: 1;
        min-inline-size: 0;
      }
      h4 {
        margin: 0;
        font-size: var(--sw-fs-base);
      }
      h5 {
        margin: 0 0 6px;
        font-size: var(--sw-fs-sm);
      }
      small,
      .muted,
      .line {
        color: var(--dv-text-2);
        font-size: var(--sw-fs-sm);
        margin: 0;
      }
      .tag.live {
        background: var(--dv-success-soft);
        color: var(--ab-ok-text, #1a7f37);
      }
      .tag.off,
      .tag.neutral {
        background: var(--dv-surface-3);
        color: var(--dv-text-2);
      }
      .err {
        color: var(--dv-danger);
        font-size: var(--sw-fs-sm);
        margin: 0;
      }
      .row,
      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
      }
      .sum {
        display: grid;
        gap: 6px;
      }
      .btn.ghost {
        background: transparent;
        box-shadow: none;
      }
      .btn.danger {
        background: var(--dv-danger);
        border-color: var(--dv-danger);
        color: #fff;
      }
      .link {
        background: none;
        border: none;
        padding: 0;
        color: var(--dv-accent-text);
        font-weight: 600;
        min-block-size: 32px;
      }
      .form {
        display: grid;
        gap: 12px;
      }
      fieldset {
        border: 1px solid var(--dv-border, var(--sw-border));
        border-radius: 12px;
        padding: 8px 12px 12px;
        margin: 0;
        display: grid;
        gap: 8px;
      }
      legend {
        font-weight: 600;
        font-size: var(--sw-fs-sm);
        padding-inline: 4px;
      }
      .fld {
        display: grid;
        gap: 4px;
        font-size: var(--sw-fs-sm);
      }
      .fld.n {
        grid-template-columns: 1fr 96px;
        align-items: center;
      }
      input[type='text'],
      input[type='number'],
      input[type='time'] {
        font: inherit;
        min-block-size: 40px;
        padding: 0 10px;
        border-radius: 10px;
        border: 1px solid var(--dv-border-strong, var(--sw-border));
        background: var(--dv-surface-solid, var(--sw-surface));
        color: inherit;
      }
      .door {
        display: flex;
        align-items: center;
        gap: 8px;
        min-block-size: 40px;
        flex-wrap: wrap;
      }
      .door.dim bdi {
        color: var(--dv-text-2);
      }
      .door input {
        inline-size: 20px;
        block-size: 20px;
      }
      .win {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
      }
      .days {
        display: flex;
        gap: 4px;
        flex-wrap: wrap;
      }
      .day {
        min-inline-size: 40px;
        min-block-size: 36px;
        border-radius: 999px;
        border: 1px solid var(--dv-border-strong, var(--sw-border));
        background: transparent;
        font-size: var(--sw-fs-sm);
        font-weight: 600;
      }
      .day.on {
        background: var(--dv-accent);
        border-color: var(--dv-accent);
        color: var(--dv-on-accent, #fff);
      }
      .t {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: var(--sw-fs-sm);
      }
      .lim {
        display: grid;
        gap: 8px;
      }
      .lim[open] {
        padding-block-end: 4px;
      }
      summary {
        cursor: pointer;
        font-weight: 600;
        font-size: var(--sw-fs-sm);
        min-block-size: 32px;
        display: flex;
        align-items: center;
      }
      .confirm,
      .sim {
        border-radius: 12px;
        padding: 12px;
        background: var(--dv-warning-soft, rgba(255, 159, 10, 0.12));
      }
      .sim {
        background: var(--dv-surface-3);
      }
      .confirm p {
        margin: 0 0 10px;
        font-size: var(--sw-fs-sm);
      }
      ul {
        margin: 0;
        padding-inline-start: 18px;
        display: grid;
        gap: 2px;
        font-size: var(--sw-fs-sm);
      }
      li.no {
        color: var(--dv-text-2);
      }
      @media (max-width: 600px) {
        .row .btn {
          flex: 1 1 auto;
          min-block-size: 44px;
        }
      }
    `,
  ];
}

declare global {
  interface HTMLElementTagNameMap {
    'door-automation-block': DoorAutomationBlock;
  }
}
